/**
 * ============================================================================
 * ORDERBOOK ROUTES
 * ============================================================================
 * 
 * Endpoints para análise detalhada do Order Book
 * Integrado com OrderBookAnalyzer para métricas em tempo real
 * 
 * ENDPOINTS:
 * - GET /api/orderbook/metrics     - Todas as métricas
 * - GET /api/orderbook/imbalance   - Book Imbalance (BI) detalhado
 * - GET /api/orderbook/depth       - Análise de profundidade
 * - GET /api/orderbook/spread      - Qualidade do spread
 * - GET /api/orderbook/walls       - Walls detectadas (suporte/resistência)
 * - GET /api/orderbook/energy      - Energy Score (Half Pipe Model)
 * - GET /api/orderbook/history     - Histórico completo (60s)
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const cache = require('../middleware/cache');
const { validateQuery } = require('../middleware/validation');
const OrderBookService = require('../../services/OrderBookService');

module.exports = (dependencies) => {
  const { dataCollector, orderBookAnalyzer } = dependencies;
  
  // Create service
  const obService = new OrderBookService(dataCollector, orderBookAnalyzer);

  /**
   * GET /api/orderbook/metrics
   * Retorna TODAS as métricas do OrderBookAnalyzer
   * Cache: 1s (precisa ser rápido!)
   */
  router.get('/orderbook/metrics', 
    cache(1000), 
    asyncHandler(async (req, res) => {
      const metrics = await obService.getMetrics();
      
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date()
      });
    })
  );

  /**
   * GET /api/orderbook/imbalance
   * Análise detalhada do Book Imbalance (BI)
   * Inclui interpretação automática e recomendações
   * Cache: 1s
   */
  router.get('/orderbook/imbalance', 
    cache(1000), 
    asyncHandler(async (req, res) => {
      const imbalance = await obService.getImbalance();
      
      res.json({
        success: true,
        data: imbalance,
        timestamp: new Date()
      });
    })
  );

  /**
   * GET /api/orderbook/depth
   * Análise de profundidade do order book
   * Detecta H3 (colapso de liquidez)
   * Cache: 2s
   */
  router.get('/orderbook/depth', 
    cache(2000), 
    asyncHandler(async (req, res) => {
      const depth = await obService.getDepth();
      
      res.json({
        success: true,
        data: depth,
        timestamp: new Date()
      });
    })
  );

  /**
   * GET /api/orderbook/spread
   * Qualidade do spread bid-ask
   * Cache: 1s
   */
  router.get('/orderbook/spread', 
    cache(1000), 
    asyncHandler(async (req, res) => {
      const spread = await obService.getSpread();
      
      res.json({
        success: true,
        data: spread,
        timestamp: new Date()
      });
    })
  );

  /**
   * GET /api/orderbook/walls
   * Detecta walls (suporte/resistência)
   * Identifica manipulação e spoofing
   * Cache: 2s
   */
  router.get('/orderbook/walls', 
    cache(2000), 
    asyncHandler(async (req, res) => {
      const walls = await obService.getWalls();
      
      res.json({
        success: true,
        data: walls,
        timestamp: new Date()
      });
    })
  );

  /**
   * GET /api/orderbook/energy
   * Energy Score para Half Pipe Model
   * Combina BI + persistence + spread + depth
   * Cache: 2s
   */
  router.get('/orderbook/energy', 
    cache(2000), 
    asyncHandler(async (req, res) => {
      const energy = await obService.getEnergy();
      
      res.json({
        success: true,
        data: energy,
        timestamp: new Date()
      });
    })
  );

  /**
   * GET /api/orderbook/history
   * Histórico completo das métricas (últimos 60s)
   * Query: window (segundos, max 60)
   * Cache: 5s (dados históricos)
   */
  router.get('/orderbook/history',
    cache(5000),
    validateQuery({
      window: { type: 'number', min: 1, max: 60 }
    }),
    asyncHandler(async (req, res) => {
      const window = parseInt(req.query.window) || 60;
      
      const history = await obService.getHistory(window);
      
      res.json({
        success: true,
        data: history,
        timestamp: new Date()
      });
    })
  );

  return router;
};