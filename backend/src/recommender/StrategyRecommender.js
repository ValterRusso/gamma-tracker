/**
 * Strategy Recommender
 * 
 * Motor de recomendação que calcula score de adequação para cada estratégia
 * baseado no estado atual do mercado.
 */

class StrategyRecommender {
  constructor(strategies, marketState) {
    this.strategies = strategies;
    this.marketState = marketState;
  }
  
  /**
   * Recomenda as melhores estratégias baseado no estado do mercado
   * @param {Object} options - Opções de filtragem
   * @param {number} options.topN - Número de estratégias a retornar
   * @param {number} options.minScore - Score mínimo para considerar
   * @returns {Array} Array de estratégias com scores
   */
  recommend(options = {}) {
    const { topN = 3, minScore = 50 } = options;
    
    // Calcular score para cada estratégia
    const scoredStrategies = this.strategies.map(strategy => {
      const score = this.calculateScore(strategy);
      const reasoning = this.generateReasoning(strategy, score);
      
      return {
        ...strategy,
        score,
        reasoning,
        marketFit: this.getMarketFit(score)
      };
    });
    
    // Ordenar por score e filtrar
    const recommended = scoredStrategies
      .filter(s => s.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
    
    return recommended;
  }
  
  /**
   * Calcula o score de adequação de uma estratégia (0-100)
   */
  calculateScore(strategy) {
    const conditions = strategy.idealConditions;
    const weights = strategy.scoringWeights;
    let totalScore = 0;
    
    // 1. Regime Score
    if (conditions.regime && conditions.regime.includes(this.marketState.regime)) {
      totalScore += 100 * weights.regime;
    }
    
    // 2. Volatility Score
    if (conditions.volatility && conditions.volatility.includes(this.marketState.volatility)) {
      totalScore += 100 * weights.volatility;
    }
    
    // 3. Skew Score
    if (conditions.skew && conditions.skew.includes(this.marketState.skew)) {
      totalScore += 100 * weights.skew;
    }
    
    // 4. GEX Score
    if (conditions.gex && conditions.gex.includes(this.marketState.gex)) {
      totalScore += 100 * weights.gex;
    }
    
    // 5. Max Pain Distance Score
    if (conditions.maxPainDistance) {
      const mpDist = this.marketState.maxPainDistance;
      if (mpDist >= conditions.maxPainDistance.min && 
          mpDist <= conditions.maxPainDistance.max) {
        totalScore += 100 * weights.maxPainDistance;
      }
    }
    
    // 6. Sentiment Score
    if (conditions.sentiment && weights.sentiment) {
      const pcRatio = this.marketState.sentiment.putCallRatio;
      
      // Check divergence condition
      if (conditions.sentiment.divergence !== undefined) {
        if (conditions.sentiment.divergence === this.marketState.sentiment.divergence) {
          totalScore += 100 * weights.sentiment;
        }
      }
      // Check put/call ratio range
      else if (conditions.sentiment.putCallRatio) {
        const minOk = !conditions.sentiment.putCallRatio.min || pcRatio >= conditions.sentiment.putCallRatio.min;
        const maxOk = !conditions.sentiment.putCallRatio.max || pcRatio <= conditions.sentiment.putCallRatio.max;
        
        if (minOk && maxOk) {
          totalScore += 100 * weights.sentiment;
        }
      }
    }
    
    // 7. Anomalies Bonus (se aplicável)
    if (weights.anomalies && conditions.anomalies) {
      const hasRelevantAnomaly = conditions.anomalies.some(a => 
        this.marketState.anomalies.includes(a)
      );
      if (hasRelevantAnomaly) {
        totalScore += 100 * weights.anomalies;
      }
    }
    
    return Math.round(totalScore);
  }
  
  /**
   * Gera explicação do por quê a estratégia é adequada
   */
  generateReasoning(strategy, score) {
    const reasons = [];
    const conditions = strategy.idealConditions;
    
    // Regime
    if (conditions.regime && conditions.regime.includes(this.marketState.regime)) {
      reasons.push(`Regime ${this.marketState.regime} favorece esta estratégia`);
    }
    
    // Volatility
    if (conditions.volatility && conditions.volatility.includes(this.marketState.volatility)) {
      if (this.marketState.volatility === 'HIGH' && strategy.category === 'NEUTRAL') {
        reasons.push('Volatilidade alta é ideal para vender premium');
      } else if (this.marketState.volatility === 'LOW' && strategy.category === 'VOLATILITY') {
        reasons.push('Volatilidade baixa é ideal para comprar volatilidade');
      } else {
        reasons.push(`Volatilidade ${this.marketState.volatility} é adequada`);
      }
    }
    
    // GEX
    if (conditions.gex && conditions.gex.includes(this.marketState.gex)) {
      if (this.marketState.gex === 'POSITIVE' && strategy.category === 'NEUTRAL') {
        reasons.push('GEX positivo indica mercado range-bound');
      } else if (this.marketState.gex === 'NEGATIVE' && strategy.category === 'VOLATILITY') {
        reasons.push('GEX negativo indica possível movimento forte');
      }
    }
    
    // Max Pain Distance
    const mpDist = Math.abs(this.marketState.maxPainDistance);
    if (mpDist < 2 && strategy.category === 'NEUTRAL') {
      reasons.push('Spot próximo do Max Pain favorece estratégias neutras');
    }
    
    // Sentiment Divergence
    if (this.marketState.sentiment.divergence && strategy.category === 'VOLATILITY') {
      reasons.push('Divergência OI vs Volume indica movimento iminente');
    }
    
    // Anomalies
    if (this.marketState.anomalies.length > 0 && strategy.category === 'VOLATILITY') {
      reasons.push(`Anomalias detectadas: ${this.marketState.anomalies.join(', ')}`);
    }
    
    // Se não tiver razões específicas, adicionar razão genérica
    if (reasons.length === 0) {
      reasons.push('Condições de mercado parcialmente favoráveis');
    }
    
    return reasons;
  }
  
  /**
   * Converte score numérico em classificação qualitativa
   */
  getMarketFit(score) {
    if (score >= 80) return 'EXCELLENT';
    if (score >= 65) return 'GOOD';
    if (score >= 50) return 'FAIR';
    return 'POOR';
  }
  
  /**
   * Retorna todas as estratégias com seus scores (para página detalhada)
   */
  getAllWithScores() {
    return this.strategies.map(strategy => {
      const score = this.calculateScore(strategy);
      const reasoning = this.generateReasoning(strategy, score);
      
      return {
        ...strategy,
        score,
        reasoning,
        marketFit: this.getMarketFit(score)
      };
    }).sort((a, b) => b.score - a.score);
  }
}

module.exports = StrategyRecommender;
