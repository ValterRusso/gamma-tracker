/**
 * ============================================================================
 * COLLECTORS INDEX
 * ============================================================================
 * 
 * Exporta todos os data collectors para fácil importação
 * 
 * USO:
 * const { BinanceDataCollector, OrderBookAnalyzer } = require('./collectors');
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

module.exports = {
  // ========================================
  // MAIN DATA COLLECTORS
  // ========================================
  BinanceDataCollector: require('./BinanceDataCollector'),
  
  // ========================================
  // SPECIALIZED COLLECTORS
  // ========================================
  OrderBookAnalyzer: require('./OrderBookAnalyzer'),
  LiquidationTracker: require('./LiquidationTracker'),
  TradeFlowAnalyzer: require('./TradeFlowAnalyzer'),
  
  // ========================================
  // EXTERNAL DATA SOURCES
  // ========================================
  DeribitAPIClient: require('./DeribitAPIClient'),
  
  // ========================================
  // WEBSOCKET HANDLERS
  // ========================================
  WebSocketManager: require('./WebSocketManager'),
  
  // Adicione outros collectors aqui
};