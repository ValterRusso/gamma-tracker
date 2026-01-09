/**
 * ============================================================================
 * SERVICES INDEX
 * ============================================================================
 * 
 * Exporta todos os services para fácil importação
 * 
 * USO:
 * const { EntropyService, MetricsService } = require('../../services');
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

module.exports = {
  // Core Services (COMPLETOS)
  MetricsService: require('./MetricsService'),
  EntropyService: require('./EntropyService'),  
  EscapeService: require('./EscapeService'),
  VolatilityService: require('./VolatilityService'),
  SentimentService: require('./SentimentService'),
  StrategyService: require('./StrategyService'),
  LiquidationService: require('./LiquidationService'),
  HistoryService: require('./HistoryService'),
  OptionsService: require('./OptionsService'),
  OrderBookService: require('./OrderbookService'),
  ComparisonService: require('./ComparisonService'),
  IvComparisonService: require('./IvcomparisonService')
};