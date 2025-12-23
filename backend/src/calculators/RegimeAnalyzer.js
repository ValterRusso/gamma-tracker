/**
 * RegimeAnalyzer - Analisa o regime de mercado baseado em GEX
 */

const Logger = require('../utils/logger');

class RegimeAnalyzer {
  constructor() {
    this.logger = new Logger('RegimeAnalyzer');
  }

  /**
   * Determina o regime de mercado baseado no GEX e posição relativa ao Gamma Flip
   * 
   * @param {Object} metrics - Métricas calculadas pelo GEXCalculator
   * @returns {Object} - { regime, description, implications }
   */
  analyzeRegime(metrics) {
    const { spotPrice, totalGEX, gammaFlip } = metrics;
    
    const netGamma = totalGEX.total;
    const isAboveGammaFlip = gammaFlip.level ? spotPrice > gammaFlip.level : null;
    
    let regime = 'UNKNOWN';
    let description = '';
    let implications = [];
    let volatilityExpectation = 'NORMAL';
    
    // Regime 1: Gamma Positiva + Acima do Gamma Flip
    if (netGamma > 0 && isAboveGammaFlip) {
      regime = 'POSITIVE_GAMMA_ABOVE_FLIP';
      description = 'Dealers têm gamma positiva e o preço está acima do gamma flip';
      implications = [
        'Dealers compram na alta e vendem na baixa (hedging estabiliza o mercado)',
        'Movimentos de preço tendem a ser contidos',
        'Resistência em níveis de Call Wall',
        'Volatilidade realizada tende a ser menor que IV'
      ];
      volatilityExpectation = 'LOW';
    }
    // Regime 2: Gamma Positiva + Abaixo do Gamma Flip
    else if (netGamma > 0 && !isAboveGammaFlip) {
      regime = 'POSITIVE_GAMMA_BELOW_FLIP';
      description = 'Dealers têm gamma positiva mas o preço está abaixo do gamma flip';
      implications = [
        'Transição entre regimes - situação instável',
        'Possível movimento em direção ao gamma flip',
        'Suporte em níveis de Put Wall',
        'Volatilidade pode aumentar se romper o flip'
      ];
      volatilityExpectation = 'MEDIUM';
    }
    // Regime 3: Gamma Negativa + Abaixo do Gamma Flip
    else if (netGamma < 0 && !isAboveGammaFlip) {
      regime = 'NEGATIVE_GAMMA_BELOW_FLIP';
      description = 'Dealers têm gamma negativa e o preço está abaixo do gamma flip';
      implications = [
        'Dealers vendem na baixa e compram na alta (hedging amplifica movimentos)',
        'Movimentos de preço tendem a ser exagerados',
        'Maior probabilidade de gaps e movimentos rápidos',
        'Volatilidade realizada tende a ser maior que IV'
      ];
      volatilityExpectation = 'HIGH';
    }
    // Regime 4: Gamma Negativa + Acima do Gamma Flip
    else if (netGamma < 0 && isAboveGammaFlip) {
      regime = 'NEGATIVE_GAMMA_ABOVE_FLIP';
      description = 'Dealers têm gamma negativa mas o preço está acima do gamma flip';
      implications = [
        'Situação incomum - possível erro nos dados ou evento especial',
        'Monitorar de perto para mudanças',
        'Volatilidade pode ser imprevisível'
      ];
      volatilityExpectation = 'UNCERTAIN';
    }
    
    return {
      regime,
      description,
      implications,
      volatilityExpectation,
      confidence: gammaFlip.confidence,
      metrics: {
        netGamma: netGamma,
        gammaFlipLevel: gammaFlip.level,
        spotPrice: spotPrice,
        isAboveGammaFlip: isAboveGammaFlip
      }
    };
  }

  /**
   * Analisa a distribuição de GEX e identifica concentrações
   * 
   * @param {Array} gammaProfile - Perfil de gamma por strike
   * @param {number} spotPrice - Preço spot atual
   * @returns {Object} - Análise da distribuição
   */
  analyzeDistribution(gammaProfile, spotPrice) {
    if (!gammaProfile || gammaProfile.length === 0) {
      return { status: 'NO_DATA' };
    }
    
    // Calcular estatísticas
    const totalAbsGEX = gammaProfile.reduce((sum, item) => sum + Math.abs(item.totalGEX), 0);
    const avgGEX = totalAbsGEX / gammaProfile.length;
    
    // Identificar concentrações significativas (> 2x a média)
    const significantLevels = gammaProfile
      .filter(item => Math.abs(item.totalGEX) > avgGEX * 2)
      .map(item => ({
        strike: item.strike,
        gex: item.totalGEX,
        distanceFromSpot: item.strike - spotPrice,
        distancePercent: ((item.strike - spotPrice) / spotPrice) * 100,
        type: item.totalGEX > 0 ? 'POSITIVE' : 'NEGATIVE'
      }))
      .sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex));
    
    // Identificar range provável de trading
    const positiveGEXStrikes = gammaProfile.filter(item => item.totalGEX > 0).map(item => item.strike);
    const negativeGEXStrikes = gammaProfile.filter(item => item.totalGEX < 0).map(item => item.strike);
    
    const upperBound = positiveGEXStrikes.length > 0 ? Math.max(...positiveGEXStrikes) : null;
    const lowerBound = negativeGEXStrikes.length > 0 ? Math.min(...negativeGEXStrikes) : null;
    
    return {
      status: 'OK',
      totalAbsGEX,
      avgGEX,
      significantLevels: significantLevels.slice(0, 10), // Top 10
      probableTradingRange: {
        upper: upperBound,
        lower: lowerBound,
        spotPrice: spotPrice,
        upperDistance: upperBound ? ((upperBound - spotPrice) / spotPrice) * 100 : null,
        lowerDistance: lowerBound ? ((lowerBound - spotPrice) / spotPrice) * 100 : null
      }
    };
  }

  /**
   * Gera interpretação inteligente das métricas
   * 
   * @param {Object} metrics - Métricas completas
   * @returns {Object} - Interpretação e recomendações
   */
  generateInsights(metrics) {
    const regime = this.analyzeRegime(metrics);
    const distribution = this.analyzeDistribution(metrics.gammaProfile, metrics.spotPrice);
    
    const insights = {
      regime: regime,
      distribution: distribution,
      keyLevels: {
        gammaFlip: metrics.gammaFlip,
        putWall: metrics.putWall,
        callWall: metrics.callWall
      },
      summary: this.generateSummary(metrics, regime, distribution),
      timestamp: Date.now()
    };
    
    return insights;
  }

  /**
   * Gera resumo textual das condições de mercado
   */
  generateSummary(metrics, regime, distribution) {
    const lines = [];
    
    // Linha 1: GEX total
    const gexBillions = (metrics.totalGEX.total / 1e9).toFixed(2);
    const gexDirection = metrics.totalGEX.total > 0 ? 'POSITIVA' : 'NEGATIVA';
    lines.push(`GEX Total: $${Math.abs(gexBillions)}B (${gexDirection})`);
    
    // Linha 2: Regime
    lines.push(`Regime: ${regime.regime}`);
    lines.push(`Volatilidade Esperada: ${regime.volatilityExpectation}`);
    
    // Linha 3: Níveis chave
    // Linha 3: Níveis chave
    if (metrics.gammaFlip?.level) {
      const flipDistance = (metrics.gammaFlip.distancePercent ?? 0).toFixed(2);
      lines.push(`Gamma Flip: $${metrics.gammaFlip.level.toFixed(0)} (${flipDistance}% do spot)`);
    }

    
    
    if (metrics.putWall.strike) {
      lines.push(`Put Wall: $${metrics.putWall.strike.toFixed(0)} (Suporte)`);
    }
    
    if (metrics.callWall.strike) {
      lines.push(`Call Wall: $${metrics.callWall.strike.toFixed(0)} (Resistência)`);
    }
    
    // Linha 4: Range provável
    if (distribution.probableTradingRange.lower && distribution.probableTradingRange.upper) {
      lines.push(
        `Range Provável: $${distribution.probableTradingRange.lower.toFixed(0)} - ` +
        `$${distribution.probableTradingRange.upper.toFixed(0)}`
      );
    }
    
    return lines;
  }
}

module.exports = RegimeAnalyzer;