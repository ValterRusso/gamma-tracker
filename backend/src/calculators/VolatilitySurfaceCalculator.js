const Logger = require('../utils/logger');

/**
 * Calculadora de Superfície de Volatilidade
 * Processa options para gerar IV surface 3D
 */
class VolatilitySurfaceCalculator {
  constructor() {
    this.logger = new Logger('VolSurfaceCalc');
  }

  /**
   * Constrói a superfície de volatilidade
   * @param {Array<Option>} options - Array de options com IV
   * @param {number} spotPrice - Preço spot atual
   * @returns {Object} - Dados estruturados para visualização 3D
   */
  buildSurface(options, spotPrice) {
    this.logger.info(`Building surface with ${options?.length || 0} options, spot: ${spotPrice}`);
    if (!options || options.length === 0) {
      this.logger.warn('No options provided');  
      return null;
    }

    // 1. Filtrar options válidas (com IV)
    const validOptions = options.filter(opt => 
      opt.markIV && 
      opt.markIV > 0 &&
      opt.strike > 0 &&
      opt.expiryDate
    );

    this.logger.info(`Valid options with IV: ${validOptions.length}`);

    if (validOptions.length === 0) {
      this.logger.warn('Nenhuma option com IV válida');

      // DEBUG: Ver o que tem nas options
    if (options.length > 0) {
      const sample = options[0];
      this.logger.warn('Sample option:', JSON.stringify({
        symbol: sample.symbol,
        strike: sample.strike,
        type: sample.type,
        expiryDate: sample.expiryDate,
        markIV: sample.markIV,
        vega: sample.vega
     }));
    }

      return null;
    }

    // 2. Calcular DTE (Days to Expiration) e Moneyness
    const now = new Date();
    const enrichedOptions = validOptions.map(opt => {
      const expiry = new Date(opt.expiryDate);
      const dte = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));
      const moneyness = opt.strike / spotPrice;
      
      return {
        ...opt,
        dte: dte,
        moneyness: moneyness,
        moneynessPercent: ((moneyness - 1) * 100).toFixed(1)
      };
    });

    // 3. Agrupar por DTE e Strike
    const surfaceMap = new Map();
    
    this.logger.info(`Agrupando ${enrichedOptions.length} options por DTE e Strike`);
    
    enrichedOptions.forEach(opt => {
      const key = `${opt.dte}_${opt.strike}`;
      
      if (!surfaceMap.has(key)) {
        surfaceMap.set(key, {
          dte: opt.dte,
          strike: opt.strike,
          moneyness: opt.moneyness,
          expiryDate: opt.expiryDate,
          calls: [],
          puts: []
        });
      }
      
      const point = surfaceMap.get(key);
      
      if (opt.type === 'CALL') {
        point.calls.push({
          iv: opt.markIV,
          volume: opt.volume || 0,
          openInterest: opt.openInterest || 0
        });
      } else if (opt.type === 'PUT') {
        point.puts.push({
          iv: opt.markIV,
          volume: opt.volume || 0,
          openInterest: opt.openInterest || 0
        });
      } else {
        this.logger.warn(`Option com type inválido: ${opt.symbol}, type: ${opt.type}`);
      }
    });

    // 4. Calcular IV médio por ponto (weighted by OI)
    this.logger.info(`Surface map tem ${surfaceMap.size} pontos únicos (DTE x Strike)`);
    
    // DEBUG: Ver alguns pontos
    let debugCount = 0;
    surfaceMap.forEach((point, key) => {
      if (debugCount < 3) {
        this.logger.info(`Ponto ${key}: calls=${point.calls.length}, puts=${point.puts.length}`);
        debugCount++;
      }
    });
    
    const surfacePoints = Array.from(surfaceMap.values()).map(point => {
      const calcWeightedIV = (options) => {
        if (options.length === 0) return null;
        
        const totalOI = options.reduce((sum, o) => sum + o.openInterest, 0);
        
        if (totalOI === 0) {
          // Se não tem OI, usa média simples
          return options.reduce((sum, o) => sum + o.iv, 0) / options.length;
        }
        
        // Média ponderada por OI
        const weightedSum = options.reduce((sum, o) => sum + (o.iv * o.openInterest), 0);
        return weightedSum / totalOI;
      };

      return {
        dte: point.dte,
        strike: point.strike,
        moneyness: point.moneyness,
        expiryDate: point.expiryDate,
        callIV: calcWeightedIV(point.calls),
        putIV: calcWeightedIV(point.puts),
        avgIV: calcWeightedIV([...point.calls, ...point.puts])
      };
    });

    // 5. Extrair strikes e DTEs únicos (ordenados)
    const uniqueStrikes = [...new Set(surfacePoints.map(p => p.strike))].sort((a, b) => a - b);
    const uniqueDTEs = [...new Set(surfacePoints.map(p => p.dte))].sort((a, b) => a - b);
    const uniqueExpiries = [...new Set(surfacePoints.map(p => p.expiryDate))].sort();

    // 6. Construir matriz 2D de IV (DTE x Strike)
    const ivMatrix = uniqueDTEs.map(dte => {
      return uniqueStrikes.map(strike => {
        const point = surfacePoints.find(p => p.dte === dte && p.strike === strike);
        return point ? point.avgIV : null;
      });
    });

    const callIVMatrix = uniqueDTEs.map(dte => {
      return uniqueStrikes.map(strike => {
        const point = surfacePoints.find(p => p.dte === dte && p.strike === strike);
        return point ? point.callIV : null;
      });
    });

    const putIVMatrix = uniqueDTEs.map(dte => {
      return uniqueStrikes.map(strike => {
        const point = surfacePoints.find(p => p.dte === dte && p.strike === strike);
        return point ? point.putIV : null;
      });
    });

    // 7. Calcular ATM IV e Skew
    const atmStrike = this.findATMStrike(uniqueStrikes, spotPrice);
    const atmIV = this.getATMIV(surfacePoints, atmStrike);
    const skew = this.calculateSkew(surfacePoints, spotPrice);

    return {
      strikes: uniqueStrikes,
      dte: uniqueDTEs,
      expiries: uniqueExpiries,
      spotPrice: spotPrice,
      atmStrike: atmStrike,
      atmIV: atmIV,
      skew: skew,
      iv: ivMatrix,
      callIV: callIVMatrix,
      putIV: putIVMatrix,
      points: surfacePoints,
      stats: {
        totalPoints: surfacePoints.length,
        strikeCount: uniqueStrikes.length,
        expiryCount: uniqueDTEs.length,
        minIV: Math.min(...surfacePoints.filter(p => p.avgIV).map(p => p.avgIV)),
        maxIV: Math.max(...surfacePoints.filter(p => p.avgIV).map(p => p.avgIV))
      }
    };
  }

  /**
   * Encontra o strike ATM (mais próximo do spot)
   */
  findATMStrike(strikes, spotPrice) {
    return strikes.reduce((prev, curr) => 
      Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
    );
  }

  /**
   * Calcula IV ATM (média dos front month ATM calls e puts)
   */
  getATMIV(surfacePoints, atmStrike) {
    const atmPoints = surfacePoints.filter(p => p.strike === atmStrike);
    
    if (atmPoints.length === 0) return null;
    
    // Pegar o DTE mais próximo (front month)
    const minDTE = Math.min(...atmPoints.map(p => p.dte));
    const frontMonth = atmPoints.filter(p => p.dte === minDTE);
    
    const ivs = frontMonth
      .map(p => p.avgIV)
      .filter(iv => iv !== null);
    
    if (ivs.length === 0) return null;
    
    return ivs.reduce((sum, iv) => sum + iv, 0) / ivs.length;
  }

  /**
   * Calcula skew de volatilidade (put vs call)
   */
  calculateSkew(surfacePoints, spotPrice) {
    // Filtrar front month
    const minDTE = Math.min(...surfacePoints.map(p => p.dte));
    const frontMonth = surfacePoints.filter(p => p.dte === minDTE);

    // OTM Puts (strike < spot)
    const otmPuts = frontMonth
      .filter(p => p.strike < spotPrice && p.putIV)
      .sort((a, b) => b.strike - a.strike); // Mais próximo do ATM primeiro

    // OTM Calls (strike > spot)
    const otmCalls = frontMonth
      .filter(p => p.strike > spotPrice && p.callIV)
      .sort((a, b) => a.strike - b.strike); // Mais próximo do ATM primeiro

    // Pegar 25-delta aproximado (simplificado: ~10% OTM)
    const putSkewStrike = otmPuts.find(p => p.moneyness <= 0.90);
    const callSkewStrike = otmCalls.find(p => p.moneyness >= 1.10);

    const atmIV = this.getATMIV(surfacePoints, this.findATMStrike(
      [...new Set(surfacePoints.map(p => p.strike))],
      spotPrice
    ));

    return {
      putSkew: putSkewStrike && atmIV ? putSkewStrike.putIV - atmIV : null,
      callSkew: callSkewStrike && atmIV ? callSkewStrike.callIV - atmIV : null,
      totalSkew: putSkewStrike && callSkewStrike ? 
        putSkewStrike.putIV - callSkewStrike.callIV : null
    };
  }
}

module.exports = VolatilitySurfaceCalculator;