/**
 * SentimentAnalyzer.js
 * 
 * Analisa sentimento do mercado baseado em métricas de options:
 * - Put/Call OI Ratio
 * - Put/Call Volume Ratio
 * - Skew (já existe no sistema)
 * - GEX (já existe no sistema)
 * 
 * Teoria:
 * - P/C Ratio > 1.0 = Bearish (mais puts que calls)
 * - P/C Ratio < 1.0 = Bullish (mais calls que puts)
 * - P/C Ratio ~1.0 = Neutral
 * 
 * Uso:
 * - Identificar sentimento predominante
 * - Confirmar análise de regime (BULLISH/BEARISH/NEUTRAL)
 * - Detectar mudanças de posicionamento
 */

const Logger = require('../utils/Logger');

class SentimentAnalyzer {
  constructor() {
    this.logger = new Logger('SentimentAnalyzer');
  }

  /**
   * Analisa sentimento completo do mercado
   * 
   * @param {Array<Option>} options - Array de options
   * @returns {Object} { sentiment, pcOIRatio, pcVolRatio, metrics, interpretation }
   */
  analyzeSentiment(options) {
    try {
      if (!options || options.length === 0) {
        this.logger.warn('Nenhuma option fornecida para análise de sentimento');
        return null;
      }

      // Calcular métricas
      const oiMetrics = this._calculateOIMetrics(options);
      const volMetrics = this._calculateVolumeMetrics(options);

      // Determinar sentimento
      const sentiment = this._determineSentiment(oiMetrics.pcRatio);

      // Interpretação
      const interpretation = this._interpretSentiment(sentiment, oiMetrics, volMetrics);

      this.logger.debug(`Sentimento: ${sentiment} (P/C OI: ${oiMetrics.pcRatio.toFixed(2)})`);

      return {
        sentiment: sentiment,
        putCallOIRatio: oiMetrics.pcRatio,
        putCallVolRatio: volMetrics.pcRatio,
        totalCallOI: oiMetrics.totalCallOI,
        totalPutOI: oiMetrics.totalPutOI,
        totalCallVolume: volMetrics.totalCallVol,
        totalPutVolume: volMetrics.totalPutVol,
        interpretation: interpretation
      };

    } catch (error) {
      this.logger.error('Erro ao analisar sentimento:', error);
      return null;
    }
  }

  /**
   * Calcula métricas de Open Interest
   * 
   * @param {Array<Option>} options
   * @returns {Object}
   * @private
   */
  _calculateOIMetrics(options) {
    let totalCallOI = 0;
    let totalPutOI = 0;

    options.forEach(opt => {
      const oi = opt.openInterest || 0;

      if (opt.side === 'CALL') {
        totalCallOI += oi;
      } else if (opt.side === 'PUT') {
        totalPutOI += oi;
      }
    });

    const pcRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;

    return {
      totalCallOI,
      totalPutOI,
      pcRatio
    };
  }

  /**
   * Calcula métricas de Volume
   * 
   * @param {Array<Option>} options
   * @returns {Object}
   * @private
   */
  _calculateVolumeMetrics(options) {
    let totalCallVol = 0;
    let totalPutVol = 0;

    options.forEach(opt => {
      const vol = opt.volume || 0;

      if (opt.side === 'CALL') {
        totalCallVol += vol;
      } else if (opt.side === 'PUT') {
        totalPutVol += vol;
      }
    });

    const pcRatio = totalCallVol > 0 ? totalPutVol / totalCallVol : 0;

    return {
      totalCallVol,
      totalPutVol,
      pcRatio
    };
  }

  /**
   * Determina sentimento baseado em P/C Ratio
   * 
   * Thresholds:
   * - < 0.7: VERY_BULLISH
   * - 0.7-0.9: BULLISH
   * - 0.9-1.1: NEUTRAL
   * - 1.1-1.3: BEARISH
   * - > 1.3: VERY_BEARISH
   * 
   * @param {number} pcRatio
   * @returns {string}
   * @private
   */
  _determineSentiment(pcRatio) {
    if (pcRatio < 0.7) {
      return 'VERY_BULLISH';
    } else if (pcRatio < 0.9) {
      return 'BULLISH';
    } else if (pcRatio < 1.1) {
      return 'NEUTRAL';
    } else if (pcRatio < 1.3) {
      return 'BEARISH';
    } else {
      return 'VERY_BEARISH';
    }
  }

  /**
   * Interpreta sentimento e fornece insights
   * 
   * @param {string} sentiment
   * @param {Object} oiMetrics
   * @param {Object} volMetrics
   * @returns {string}
   * @private
   */
  _interpretSentiment(sentiment, oiMetrics, volMetrics) {
    const pcOI = oiMetrics.pcRatio;
    const pcVol = volMetrics.pcRatio;

    let interpretation = '';

    // Interpretação baseada em OI
    if (sentiment === 'VERY_BULLISH') {
      interpretation = `Sentimento MUITO BULLISH: P/C OI Ratio ${pcOI.toFixed(2)} indica forte posicionamento em calls. Mercado espera alta.`;
    } else if (sentiment === 'BULLISH') {
      interpretation = `Sentimento BULLISH: P/C OI Ratio ${pcOI.toFixed(2)} indica mais calls que puts. Viés de alta.`;
    } else if (sentiment === 'NEUTRAL') {
      interpretation = `Sentimento NEUTRAL: P/C OI Ratio ${pcOI.toFixed(2)} indica equilíbrio entre calls e puts. Mercado indeciso.`;
    } else if (sentiment === 'BEARISH') {
      interpretation = `Sentimento BEARISH: P/C OI Ratio ${pcOI.toFixed(2)} indica mais puts que calls. Viés de baixa.`;
    } else if (sentiment === 'VERY_BEARISH') {
      interpretation = `Sentimento MUITO BEARISH: P/C OI Ratio ${pcOI.toFixed(2)} indica forte posicionamento em puts. Mercado espera queda.`;
    }

    // Adicionar análise de volume se divergir de OI
    const divergence = Math.abs(pcVol - pcOI);
    if (divergence > 0.3) {
      if (pcVol > pcOI) {
        interpretation += ` ATENÇÃO: Volume de puts está aumentando (P/C Vol: ${pcVol.toFixed(2)}) - possível mudança de sentimento.`;
      } else {
        interpretation += ` ATENÇÃO: Volume de calls está aumentando (P/C Vol: ${pcVol.toFixed(2)}) - possível mudança de sentimento.`;
      }
    }

    return interpretation;
  }

  /**
   * Calcula sentimento por expiry (term structure de sentimento)
   * 
   * @param {Array<Option>} options
   * @returns {Array<Object>}
   */
  analyzeSentimentByExpiry(options) {
    // Agrupar por expiry
    const byExpiry = {};

    options.forEach(opt => {
      const expiry = opt.expiryDate;
      if (!byExpiry[expiry]) {
        byExpiry[expiry] = [];
      }
      byExpiry[expiry].push(opt);
    });

    // Calcular sentimento para cada expiry
    const results = [];

    Object.entries(byExpiry).forEach(([expiry, opts]) => {
      const sentiment = this.analyzeSentiment(opts);
      
      if (sentiment) {
        results.push({
          expiryDate: parseInt(expiry),
          dte: Math.max(0, Math.ceil((parseInt(expiry) - Date.now()) / (1000 * 60 * 60 * 24))),
          sentiment: sentiment.sentiment,
          pcOIRatio: sentiment.putCallOIRatio,
          pcVolRatio: sentiment.putCallVolRatio
        });
      }
    });

    // Ordenar por DTE
    results.sort((a, b) => a.dte - b.dte);

    return results;
  }

  /**
   * Detecta mudança de sentimento comparando com histórico
   * 
   * @param {number} currentPCRatio - P/C Ratio atual
   * @param {Array<number>} historicalPCRatios - Histórico de P/C Ratios
   * @returns {Object}
   */
  detectSentimentShift(currentPCRatio, historicalPCRatios) {
    if (!historicalPCRatios || historicalPCRatios.length < 5) {
      return {
        shift: 'INSUFFICIENT_DATA',
        magnitude: 0,
        interpretation: 'Histórico insuficiente para detectar mudança'
      };
    }

    // Calcular média histórica
    const avgHistorical = historicalPCRatios.reduce((sum, r) => sum + r, 0) / historicalPCRatios.length;

    // Calcular desvio
    const deviation = currentPCRatio - avgHistorical;
    const deviationPct = (deviation / avgHistorical) * 100;

    let shift, interpretation;

    if (Math.abs(deviationPct) < 10) {
      shift = 'NO_SHIFT';
      interpretation = 'Sentimento estável, sem mudanças significativas';
    } else if (deviation > 0) {
      shift = 'BEARISH_SHIFT';
      interpretation = `Mudança BEARISH detectada: P/C Ratio ${deviationPct.toFixed(1)}% acima da média histórica`;
    } else {
      shift = 'BULLISH_SHIFT';
      interpretation = `Mudança BULLISH detectada: P/C Ratio ${Math.abs(deviationPct).toFixed(1)}% abaixo da média histórica`;
    }

    return {
      shift,
      magnitude: Math.abs(deviationPct),
      currentPCRatio,
      historicalAvg: avgHistorical,
      deviation,
      deviationPct,
      interpretation
    };
  }
}

module.exports = SentimentAnalyzer;
