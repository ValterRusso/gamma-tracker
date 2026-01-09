/**
 * ============================================================================
 * INTEGRATIONS INDEX
 * ============================================================================
 * 
 * Exporta todas as integrações externas para fácil importação
 * 
 * USO:
 * const { BinanceAdapter, DeribitAdapter } = require('./integrations');
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

module.exports = {
  // ========================================
  // EXCHANGE ADAPTERS
  // ========================================
  BinanceAdapter: require('./BinanceAdapter'),
  DeribitAdapter: require('./DeribitAPI'),
  
  // ========================================
  // API CLIENTS
  // ========================================
  BinanceAPIClient: require('./BinanceAPIClient'),
  DeribitAPIClient: require('./DeribitAPIClient'),
  
  // ========================================
  // WEBSOCKET CLIENTS
  // ========================================
  BinanceWebSocket: require('./BinanceWebSocket'),
  DeribitWebSocket: require('./DeribitWebSocket'),
  
  // ========================================
  // DATA PARSERS
  // ========================================
  BinanceParser: require('./BinanceParser'),
  DeribitParser: require('./DeribitParser'),
  
  // ========================================
  // RATE LIMITERS
  // ========================================
  ExchangeRateLimiter: require('./ExchangeRateLimiter'),
  
  // Adicione outras integrações aqui
};