/**
 * GEXCalculator - Calcula Gamma Exposure e métricas relacionadas
 */

const Logger = require('../utils/logger');

class GEXCalculator {
  constructor(spotPrice) {
    this.logger = new Logger('GEXCalculator');
    this.spotPrice = spotPrice;
    this.lastMetrics = null;
  }

  /**
   * Atualiza o preço spot do underlying
   */
  setSpotPrice(price) {
    this.spotPrice = parseFloat(price);
  }

  /**
   * Calcula GEX para uma única option
   * 
   * Fórmula: GEX = Gamma × Contract_Size × Open_Interest × Spot_Price² × 0.01 × (-1 se Put)
   * 
   * @param {Option} option - Objeto Option
   * @returns {number} - Valor do GEX em USD
   */
  calculateOptionGEX(option) {
    if (!option || option.gamma === 0 || option.openInterest === 0) {
      return 0;
    }

    const gamma = option.gamma;
    const contractSize = option.contractSize;
    const openInterest = option.openInterest;
    const spotPrice = this.spotPrice;
    
    // Multiplicador de sinal: +1 para Calls, -1 para Puts
    // Assumindo que dealers são long calls e short puts
    const signMultiplier = option.side === 'CALL' ? 1 : -1;
    
    // Cálculo do GEX
    const gex = gamma * contractSize * openInterest * Math.pow(spotPrice, 2) * 0.01 * signMultiplier;
    
    return gex;
  }

  /**
   * Calcula GEX agregado por strike
   * 
   * @param {Array<Option>} options - Array de options
   * @returns {Map<number, Object>} - Map de strike -> { gex, calls, puts, totalOI }
   */
  calculateGEXByStrike(options) {
    const gexByStrike = new Map();
    
    options.forEach(option => {
      const strike = option.strike;
      const gex = this.calculateOptionGEX(option);
      
      if (!gexByStrike.has(strike)) {
        gexByStrike.set(strike, {
          strike: strike,
          totalGEX: 0,
          callGEX: 0,
          putGEX: 0,
          callOI: 0,
          putOI: 0,
          totalOI: 0,
          callGamma: 0,
          putGamma: 0
        });
      }
      
      const strikeData = gexByStrike.get(strike);
      strikeData.totalGEX += gex;
      
      if (option.side === 'CALL') {
        strikeData.callGEX += gex;
        strikeData.callOI += option.openInterest;
        strikeData.callGamma += option.gamma * option.openInterest;
      } else {
        strikeData.putGEX += gex;
        strikeData.putOI += option.openInterest;
        strikeData.putGamma += Math.abs(option.gamma) * option.openInterest;
      }
      
      strikeData.totalOI = strikeData.callOI + strikeData.putOI;
    });
    
    return gexByStrike;
  }

  /**
   * Calcula GEX total
   * 
   * @param {Array<Option>} options - Array de options
   * @returns {Object} - { total, calls, puts }
   */
  calculateTotalGEX(options) {
    let totalGEX = 0;
    let callGEX = 0;
    let putGEX = 0;
    
    options.forEach(option => {
      const gex = this.calculateOptionGEX(option);
      totalGEX += gex;
      
      if (option.side === 'CALL') {
        callGEX += gex;
      } else {
        putGEX += gex;
      }
    });
    
    return {
      total: totalGEX,
      calls: callGEX,
      puts: putGEX,
      netGamma: totalGEX > 0 ? 'POSITIVE' : 'NEGATIVE'
    };
  }

  /**
   * Calcula perfil de gamma (gamma profile)
   * Retorna array ordenado por strike
   * 
   * @param {Array<Option>} options - Array de options
   * @returns {Array<Object>} - Array de objetos com dados por strike
   */
  calculateGammaProfile(options) {
    const gexByStrike = this.calculateGEXByStrike(options);
    
    // Converter Map para Array e ordenar por strike
    const profile = Array.from(gexByStrike.values())
      .sort((a, b) => a.strike - b.strike);
    
    return profile;
  }

  /**
   * Identifica o nível de Gamma Flip (Zero Gamma)
   * Ponto onde o GEX total cruza o zero
   * 
   * @param {Array<Option>} options - Array de options
   * @returns {Object} - { level, confidence, nearbyStrikes }
   */
  findGammaFlip(options) {
    const profile = this.calculateGammaProfile(options);
    
    if (profile.length === 0) {
      return { level: null, confidence: 'NONE', nearbyStrikes: [] };
    }
    
    
    // Usar GEX total direto (não cumulativo)
    const gexProfile = profile.map(item => ({
    strike: item.strike,
    totalGEX: item.totalGEX
    }));

    
    // Encontrar onde o GEX cumulativo cruza o zero
    let gammaFlipLevel = null;
    let confidence = 'LOW';
    let nearbyStrikes = [];
    
    for (let i = 0; i < gexProfile.length - 1; i++) {
      const current = gexProfile[i];
      const next = gexProfile[i + 1];
      
      // Verificar se há mudança de sinal
      if ((current.totalGEX > 0 && next.totalGEX < 0) ||
          (current.totalGEX < 0 && next.totalGEX > 0)) {
        
        // Interpolar o nível exato
        const ratio = Math.abs(current.totalGEX) / 
                     (Math.abs(current.totalGEX) + Math.abs(next.totalGEX));
        gammaFlipLevel = current.strike + (next.strike - current.strike) * ratio;
        
        confidence = 'HIGH';
        nearbyStrikes = [current.strike, next.strike];
        break;
      }
    }
    
    // Se não encontrou cruzamento, usar o strike com GEX cumulativo mais próximo de zero
    if (!gammaFlipLevel) {
      const closest = gexProfile.reduce((prev, curr) => 
        Math.abs(curr.totalGEX) < Math.abs(prev.totalGEX) ? curr : prev
      );
      gammaFlipLevel = closest.strike;
      confidence = 'MEDIUM';
      nearbyStrikes = [closest.strike];
    }
    
    return {
      level: gammaFlipLevel,
      confidence: confidence,
      nearbyStrikes: nearbyStrikes,
      currentSpot: this.spotPrice,
      distanceFromSpot: gammaFlipLevel - this.spotPrice,
      distancePercent: ((gammaFlipLevel - this.spotPrice) / this.spotPrice) * 100
    };
  }

  /**
   * Identifica Put Wall (maior concentração de Put GEX)
   * 
   * @param {Array<Option>} options - Array de options
   * @returns {Object} - { strike, gex, oi }
   */
  findPutWall(options) {
    const profile = this.calculateGammaProfile(options);
    
    if (profile.length === 0) {
      return { strike: null, gex: 0, oi: 0 };
    }
    
    // Encontrar strike com maior Put GEX (em valor absoluto)
    const putWall = profile.reduce((max, current) => {
      return Math.abs(current.putGEX) > Math.abs(max.putGEX) ? current : max;
    }, profile[0]);
    
    return {
      strike: putWall.strike,
      gex: putWall.putGEX,
      oi: putWall.putOI,
      gamma: putWall.putGamma,
      distanceFromSpot: putWall.strike - this.spotPrice,
      distancePercent: ((putWall.strike - this.spotPrice) / this.spotPrice) * 100
    };
  }

  /**
   * Identifica Call Wall (maior concentração de Call GEX)
   * 
   * @param {Array<Option>} options - Array de options
   * @returns {Object} - { strike, gex, oi }
   */
  findCallWall(options) {
    const profile = this.calculateGammaProfile(options);
    
    if (profile.length === 0) {
      return { strike: null, gex: 0, oi: 0 };
    }
    
    // Encontrar strike com maior Call GEX
    const callWall = profile.reduce((max, current) => {
      return current.callGEX > max.callGEX ? current : max;
    }, profile[0]);
    
    return {
      strike: callWall.strike,
      gex: callWall.gex,
      oi: callWall.callOI,
      gamma: callWall.callGamma,
      distanceFromSpot: callWall.strike - this.spotPrice,
      distancePercent: ((callWall.strike - this.spotPrice) / this.spotPrice) * 100
    };
  }

  /**
 * Identifica zonas de Put/Call Walls (não apenas pontos únicos)
 * Considera uma zona como 70% do pico de GEX
 * 
 * @param {Array<Option>} options - Array de options
 * @param {number} threshold - Percentual do pico para considerar zona (padrão: 0.7)
 * @returns {Object} - { putWallZone, callWallZone }
 */
findWallZones(options, threshold = 0.7) {
  const profile = this.calculateGammaProfile(options);
  
  if (profile.length === 0) {
    return {
      putWallZone: null,
      callWallZone: null
    };
  }

  // Encontrar picos de Put e Call
  const putPeak = profile.reduce((max, item) => 
    item.putGEX < max.putGEX ? item : max
  );
  
  const callPeak = profile.reduce((max, item) => 
    item.callGEX > max.callGEX ? item : max
  );

  // Calcular zona de Put Wall
  let putWallZone = null;
  if (putPeak && putPeak.putGEX < 0) {
    const putThreshold = Math.abs(putPeak.putGEX) * threshold;
    const putZoneStrikes = profile
      .filter(p => p.putGEX < 0 && Math.abs(p.putGEX) >= putThreshold)
      .map(p => ({
        strike: p.strike,
        gex: p.putGEX,
        percentage: (Math.abs(p.putGEX) / Math.abs(putPeak.putGEX)) * 100
      }))
      .sort((a, b) => a.strike - b.strike);

    if (putZoneStrikes.length > 0) {
      const zoneLow = putZoneStrikes[0].strike;
      const zoneHigh = putZoneStrikes[putZoneStrikes.length - 1].strike;
      
      putWallZone = {
        peak: putPeak.strike,
        peakGEX: putPeak.putGEX,
        zoneLow: zoneLow,
        zoneHigh: zoneHigh,
        zoneWidth: zoneHigh - zoneLow,
        zoneStrikes: putZoneStrikes,
        strikeCount: putZoneStrikes.length,
        threshold: threshold,
        totalZoneGEX: putZoneStrikes.reduce((sum, s) => sum + s.gex, 0)
      };
    }
  }

  // Calcular zona de Call Wall
  let callWallZone = null;
  if (callPeak && callPeak.callGEX > 0) {
    const callThreshold = callPeak.callGEX * threshold;
    const callZoneStrikes = profile
      .filter(p => p.callGEX > 0 && p.callGEX >= callThreshold)
      .map(p => ({
        strike: p.strike,
        gex: p.callGEX,
        percentage: (p.callGEX / callPeak.callGEX) * 100
      }))
      .sort((a, b) => a.strike - b.strike);

    if (callZoneStrikes.length > 0) {
      const zoneLow = callZoneStrikes[0].strike;
      const zoneHigh = callZoneStrikes[callZoneStrikes.length - 1].strike;
      
      callWallZone = {
        peak: callPeak.strike,
        peakGEX: callPeak.callGEX,
        zoneLow: zoneLow,
        zoneHigh: zoneHigh,
        zoneWidth: zoneHigh - zoneLow,
        zoneStrikes: callZoneStrikes,
        strikeCount: callZoneStrikes.length,
        threshold: threshold,
        totalZoneGEX: callZoneStrikes.reduce((sum, s) => sum + s.gex, 0)
      };
    }
  } 

  return {
    putWallZone,
    callWallZone
  };
}

/**
 * Calcula range inteligente de strikes para visualização
 * Combina: Wall Zones + % do spot + threshold de GEX
 * 
 * @param {Array} gammaProfile - Profile completo de gamma
 * @param {number} spotPrice - Preço spot atual
 * @param {Object} wallZones - Zonas de Put/Call Wall
 * @param {number} rangePercent - Percentual do spot (padrão: 0.3 = ±30%)
 * @param {number} gexThreshold - Threshold mínimo de GEX (padrão: 0.02 = 2%)
 * @returns {Object} - { minStrike, maxStrike, filteredProfile }
 */
calculateSmartRange(gammaProfile, spotPrice, wallZones, rangePercent = 0.3, gexThreshold = 0.02) {
  if (!gammaProfile || gammaProfile.length === 0) {
    return {
      minStrike: spotPrice * (1 - rangePercent),
      maxStrike: spotPrice * (1 + rangePercent),
      filteredProfile: []
    };
  }

  // 1. Calcular range baseado em Wall Zones
  let zoneLow = spotPrice * (1 - rangePercent);
  let zoneHigh = spotPrice * (1 + rangePercent);

  if (wallZones.putWallZone && wallZones.callWallZone) {
    // Expandir range para incluir as zonas com margem
    const margin = spotPrice * 0.05; // 5% de margem
    zoneLow = Math.min(zoneLow, wallZones.putWallZone.zoneLow - margin);
    zoneHigh = Math.max(zoneHigh, wallZones.callWallZone.zoneHigh + margin);
  }

  // 2. Encontrar GEX máximo para calcular threshold
  const maxAbsGEX = Math.max(
    ...gammaProfile.map(p => Math.max(Math.abs(p.callGEX), Math.abs(p.putGEX)))
  );
  const minSignificantGEX = maxAbsGEX * gexThreshold;

  // 3. Filtrar strikes
  const filteredProfile = gammaProfile.filter(p => {
    // Dentro do range de preço
    const inPriceRange = p.strike >= zoneLow && p.strike <= zoneHigh;
    
    // GEX significativo OU dentro das wall zones
    const hasSignificantGEX = 
      Math.abs(p.callGEX) >= minSignificantGEX || 
      Math.abs(p.putGEX) >= minSignificantGEX;
    
    const inWallZone = 
      (wallZones.putWallZone && 
       p.strike >= wallZones.putWallZone.zoneLow && 
       p.strike <= wallZones.putWallZone.zoneHigh) ||
      (wallZones.callWallZone && 
       p.strike >= wallZones.callWallZone.zoneLow && 
       p.strike <= wallZones.callWallZone.zoneHigh);

    return inPriceRange && (hasSignificantGEX || inWallZone);
  });

  // 4. Ajustar range final baseado nos strikes filtrados
  if (filteredProfile.length > 0) {
    const strikes = filteredProfile.map(p => p.strike);
    zoneLow = Math.min(...strikes);
    zoneHigh = Math.max(...strikes);
  }

  return {
    minStrike: zoneLow,
    maxStrike: zoneHigh,
    filteredProfile: filteredProfile,
    totalStrikes: gammaProfile.length,
    filteredStrikes: filteredProfile.length,
    compressionRatio: ((1 - filteredProfile.length / gammaProfile.length) * 100).toFixed(1)
  };
}

/**
 * Encontra o strike com maior GEX (em valor absoluto)
 * Este é o strike com maior impacto no mercado
 * 
 * @param {Array<Option>} options - Array de options
 * @returns {number|null} - Strike com maior GEX absoluto
 */
findMaxGEXStrike(options) {
  const profile = this.calculateGammaProfile(options);
  
  if (profile.length === 0) {
    return null;
  }
  
  // Encontrar strike com maior GEX em valor absoluto
  const maxGEXItem = profile.reduce((max, current) => {
    return Math.abs(current.totalGEX) > Math.abs(max.totalGEX) ? current : max;
  }, profile[0]);
  
  return maxGEXItem.strike;
}



  /**
   * Calcula todas as métricas de uma vez
   * 
   * @param {Array<Option>} options - Array de options
   * @returns {Object} - Objeto com todas as métricas
   */
  calculateAllMetrics(options) {
    const totalGEX = this.calculateTotalGEX(options);
    const gammaProfile = this.calculateGammaProfile(options);
    const gammaFlip = this.findGammaFlip(options);
    const putWall = this.findPutWall(options);
    const callWall = this.findCallWall(options);
    const maxGEXStrike = this.findMaxGEXStrike(options);
    
    this.lastMetrics = {
      spotPrice: this.spotPrice,
      totalGEX: totalGEX,
      gammaProfile: gammaProfile,
      gammaFlip: gammaFlip,
      putWall: putWall,
      callWall: callWall,
      maxGEXStrike: maxGEXStrike,
      timestamp: Date.now()
    };
    return this.lastMetrics;
  }
  /**
   * Get last calculated GEX metrics
   * @returns {Object|null} - Last metrics or null if not calculated yet
   */
  getGEX() {
    return this.lastMetrics;
  }
}


module.exports = GEXCalculator;