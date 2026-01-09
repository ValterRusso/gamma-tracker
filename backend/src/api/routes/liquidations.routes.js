/**
 * ============================================================================
 * LIQUIDATIONS ROUTES
 * ============================================================================
 * 
 * Endpoints de rastreamento de liquidações forçadas (Binance Futures)
 * 
 * ENDPOINTS:
 * - GET /api/liquidations/stats     - Estatísticas gerais
 * - GET /api/liquidations/energy    - Energy score (Half Pipe Model)
 * - GET /api/liquidations/summary   - Resumo completo (stats + energy)
 * - GET /api/liquidations/recent    - Liquidações recentes
 * - GET /api/liquidations/early     - Early spike detection (H2 - Falso Escape)
 * - GET /api/liquidations/growth    - Taxa de crescimento (H1 - Escape Bom)
 * - GET /api/liquidations/cascade   - Detecção de cascata
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
const LiquidationService = require('../../services/LiquidationService');

module.exports = (dependencies) => {
  const { dataCollector, liquidationTracker } = dependencies;
  
  // Create service
  const liqService = new LiquidationService(dataCollector, liquidationTracker);

  /**
   * GET /api/liquidations/stats
   * Estatísticas gerais de liquidações em múltiplos períodos
   * Cache: 5s
   */
  router.get('/liquidations/stats', 
    cache(5000), 
    asyncHandler(async (req, res) => {
      const stats = await liqService.getStats();
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date()
      });
    })
  );

  /**
   * GET /api/liquidations/energy
   * Energy score para Half Pipe Model
   * Combina valor, frequência, cascata e imbalance
   * Cache: 5s
   */
  router.get('/liquidations/energy', 
    cache(5000), 
    asyncHandler(async (req, res) => {
      const energy = await liqService.getEnergy();
      
      res.json({
        success: true,
        data: energy,
        timestamp: new Date()
      });
    })
  );

  /**
   * GET /api/liquidations/summary
   * Resumo completo: stats + energy em uma única chamada
   * Cache: 5s
   */
  router.get('/liquidations/summary', 
    cache(5000), 
    asyncHandler(async (req, res) => {
      const summary = await liqService.getSummary();
      
      res.json({
        success: true,
        data: summary
      });
    })
  );

  /**
   * GET /api/liquidations/recent
   * Lista de liquidações recentes
   * Query: minutes (opcional, padrão: 5)
   */
  router.get('/liquidations/recent',
    validateQuery({
      minutes: { type: 'number', min: 1, max: 60 }
    }),
    asyncHandler(async (req, res) => {
      const minutes = parseInt(req.query.minutes) || 5;
      
      const recent = await liqService.getRecent(minutes);
      
      res.json({
        success: true,
        data: recent,
        timestamp: new Date()
      });
    })
  );

  /**
   * GET /api/liquidations/early
   * Early spike detection - indicador de H2 (Falso Escape)
   * Query: minutes (opcional, padrão: 2)
   * 
   * INTERPRETAÇÃO:
   * - percentage < 0.5: Distribuição normal
   * - percentage 0.5-0.7: MEDIUM risk, monitorar
   * - percentage > 0.7: HIGH risk, provável falso escape (H2)
   */
  router.get('/liquidations/early',
    validateQuery({
      minutes: { type: 'number', min: 1, max: 10 }
    }),
    asyncHandler(async (req, res) => {
      const minutes = parseInt(req.query.minutes) || 2;
      
      const early = await liqService.getEarly(minutes);
      
      res.json({
        success: true,
        data: early,
        timestamp: new Date()
      });
    })
  );

  /**
   * GET /api/liquidations/growth
   * Taxa de crescimento das liquidações - indicador de H1 (Escape Bom)
   * Cache: 10s
   * 
   * INTERPRETAÇÃO:
   * - INCREASING + growth > 0.5: GOOD - Escape direcional (H1)
   * - STABLE: NEUTRAL - Sem sinal claro
   * - DECREASING: POOR - Energia enfraquecendo
   */
  router.get('/liquidations/growth', 
    cache(10000), 
    asyncHandler(async (req, res) => {
      const growth = await liqService.getGrowth();
      
      res.json({
        success: true,
        data: growth,
        timestamp: new Date()
      });
    })
  );

  /**
   * GET /api/liquidations/cascade
   * Detecção de cascata de liquidações
   * Cache: 2s (precisa ser rápido)
   */
  router.get('/liquidations/cascade', 
    cache(2000), 
    asyncHandler(async (req, res) => {
      const cascade = await liqService.getCascade();
      
      res.json({
        success: true,
        data: cascade,
        timestamp: new Date()
      });
    })
  );

  return router;
};