/**
 * ============================================================================
 * RECOMMENDER INDEX
 * ============================================================================
 * 
 * Exporta todos os strategy recommenders para fácil importação
 * 
 * USO:
 * const { StrategyRecommender, MarketStateAnalyzer } = require('./recommender');
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

module.exports = {
  // ========================================
  // STRATEGY RECOMMENDATION
  // ========================================
  StrategyRecommender: require('./StrategyRecommender'),
  
  // ========================================
  // MARKET ANALYSIS
  // ========================================
  MarketStateAnalyzer: require('./MarketStateAnalyzer'),
  
  // ========================================
  // RISK MANAGEMENT
  // ========================================
  RiskCalculator: require('./RiskCalculator'),
  PositionSizer: require('./PositionSizer'),
  
  // ========================================
  // BACKTESTING
  // ========================================
  BacktestEngine: require('./BacktestEngine'),
  PerformanceAnalyzer: require('./PerformanceAnalyzer'),
  
  // Adicione outros recommenders aqui
};
