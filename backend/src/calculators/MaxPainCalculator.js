/**
 * MaxPainCalculator.js
 * 
 * Calcula o "Max Pain" - strike onde o maior número de contratos expiraria OTM (Out of The Money).
 * Este é o ponto onde market makers teriam a menor perda, e o preço tende a gravitar para ele
 * próximo à expiry devido ao hedging de dealers.
 * 
 * Teoria:
 * - Market makers vendem options e hedgam com o underlying
 * - Próximo à expiry, eles ajustam hedges, criando pressão no preço
 * - Preço tende a se mover para o strike com maior OI total (Max Pain)
 * 
 * Uso:
 * - Identificar níveis de "pinning" pré-expiry
 * - Prever movimento de curto prazo
 * - Complementar análise de GEX
 */

const Logger = require('../utils/Logger');

class MaxPainCalculator {
  constructor() {
    this.logger = new Logger('MaxPainCalculator');
  }

  /**
   * Calcula Max Pain para um conjunto de options
   * 
   * @param {Array<Option>} options - Array de options
   * @param {number} spotPrice - Spot price (optional, will try to get from options if not provided)
   * @returns {Object} { maxPainStrike, maxPainOI, strikeOIMap, analysis }
   */
  calculateMaxPain(options, spotPrice = null) {
    try {
      if (!options || options.length === 0) {
        this.logger.warn('Nenhuma option fornecida para cálculo de Max Pain');
        return null;
      }

      // Agrupar OI por strike
      const strikeOIMap = this._groupOIByStrike(options);

      // Encontrar strike com maior OI total
      const maxPainData = this._findMaxPainStrike(strikeOIMap);

      if (!maxPainData) {
        this.logger.warn('Não foi possível calcular Max Pain');
        return null;
      }

      // Análise adicional
      const analysis = this._analyzeMaxPain(maxPainData, options, spotPrice);

      this.logger.debug(`Max Pain calculado: Strike ${maxPainData.strike} com ${maxPainData.totalOI.toFixed(0)} OI`);

      return {
        maxPainStrike: maxPainData.strike,
        maxPainOI: maxPainData.totalOI,
        maxPainCallOI: maxPainData.callOI,
        maxPainPutOI: maxPainData.putOI,
        strikeOIMap: strikeOIMap,
        analysis: analysis
      };

    } catch (error) {
      this.logger.error('Erro ao calcular Max Pain:', error);
      return null;
    }
  }

  /**
   * Agrupa Open Interest por strike
   * 
   * @param {Array<Option>} options
   * @returns {Object} { strike: { callOI, putOI, totalOI } }
   * @private
   */
  _groupOIByStrike(options) {
    const strikeOIMap = {};

    options.forEach(opt => {
      const strike = opt.strike;
      const oi = opt.openInterest || 0;

      if (!strikeOIMap[strike]) {
        strikeOIMap[strike] = {
          strike: strike,
          callOI: 0,
          putOI: 0,
          totalOI: 0
        };
      }

      if (opt.side === 'CALL') {
        strikeOIMap[strike].callOI += oi;
      } else if (opt.side === 'PUT') {
        strikeOIMap[strike].putOI += oi;
      }

      strikeOIMap[strike].totalOI += oi;
    });

    return strikeOIMap;
  }

  /**
   * Encontra o strike com maior OI total (Max Pain)
   * 
   * @param {Object} strikeOIMap
   * @returns {Object} { strike, totalOI, callOI, putOI }
   * @private
   */
  _findMaxPainStrike(strikeOIMap) {
    const strikes = Object.values(strikeOIMap);

    if (strikes.length === 0) {
      return null;
    }

    // Ordenar por OI total (decrescente)
    strikes.sort((a, b) => b.totalOI - a.totalOI);

    return strikes[0];
  }

  /**
   * Analisa Max Pain em relação ao spot price
   * 
   * @param {Object} maxPainData
   * @param {Array<Option>} options
   * @param {number} spotPrice - Spot price (optional)
   * @returns {Object}
   * @private
   */
  _analyzeMaxPain(maxPainData, options, spotPrice = null) {
    // Use provided spotPrice or try to get from options
    if (!spotPrice) {
      spotPrice = options[0]?.underlyingPrice || options[0]?.spotPrice;
    }

    if (!spotPrice) {
      return {
        distance: null,
        distancePct: null,
        direction: 'UNKNOWN',
        interpretation: 'Spot price não disponível'
      };
    }

    const distance = maxPainData.strike - spotPrice;
    const distancePct = (distance / spotPrice) * 100;

    let direction, interpretation;

    if (Math.abs(distancePct) < 1) {
      direction = 'AT_SPOT';
      interpretation = 'Max Pain muito próximo do spot - alta probabilidade de pinning';
    } else if (distance > 0) {
      direction = 'ABOVE_SPOT';
      interpretation = `Max Pain ${distancePct.toFixed(2)}% acima - pressão de alta esperada`;
    } else {
      direction = 'BELOW_SPOT';
      interpretation = `Max Pain ${Math.abs(distancePct).toFixed(2)}% abaixo - pressão de baixa esperada`;
    }

    return {
      spotPrice: spotPrice,
      distance: distance,
      distancePct: distancePct,
      direction: direction,
      interpretation: interpretation
    };
  }

  /**
   * Calcula Top N strikes por OI
   * 
   * @param {Array<Option>} options
   * @param {number} topN - Número de strikes a retornar
   * @returns {Array<Object>}
   */
  getTopOIStrikes(options, topN = 5) {
    const strikeOIMap = this._groupOIByStrike(options);
    const strikes = Object.values(strikeOIMap);

    // Ordenar por OI total
    strikes.sort((a, b) => b.totalOI - a.totalOI);

    return strikes.slice(0, topN);
  }

  /**
   * Calcula distribuição de OI por faixa de strike
   * 
   * @param {Array<Option>} options
   * @param {number} numBuckets - Número de faixas (default: 5)
   * @returns {Array<Object>}
   */
  calculateOIDistribution(options, numBuckets = 5) {
    if (!options || options.length === 0) {
      return [];
    }

    const strikeOIMap = this._groupOIByStrike(options);
    const strikes = Object.keys(strikeOIMap).map(Number).sort((a, b) => a - b);

    const minStrike = Math.min(...strikes);
    const maxStrike = Math.max(...strikes);
    const range = maxStrike - minStrike;

    const totalOI = Object.values(strikeOIMap).reduce((sum, s) => sum + s.totalOI, 0);

    const distribution = [];

    for (let i = 0; i < numBuckets; i++) {
      const bucketMin = minStrike + (range * i / numBuckets);
      const bucketMax = minStrike + (range * (i + 1) / numBuckets);

      const bucketStrikes = strikes.filter(s => s >= bucketMin && s < bucketMax);
      
      const bucketCallOI = bucketStrikes.reduce((sum, s) => sum + strikeOIMap[s].callOI, 0);
      const bucketPutOI = bucketStrikes.reduce((sum, s) => sum + strikeOIMap[s].putOI, 0);
      const bucketTotalOI = bucketCallOI + bucketPutOI;

      const pct = (bucketTotalOI / totalOI) * 100;

      distribution.push({
        bucketMin: bucketMin,
        bucketMax: bucketMax,
        callOI: bucketCallOI,
        putOI: bucketPutOI,
        totalOI: bucketTotalOI,
        percentage: pct
      });
    }

    return distribution;
  }
}

module.exports = MaxPainCalculator;
