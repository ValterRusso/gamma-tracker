/**
 * ============================================================================
 * HISTORY ROUTES
 * ============================================================================
 * 
 * Endpoints para histórico de dados do database
 * Query MarketSnapshot para análise temporal
 * 
 * ENDPOINTS:
 * - GET /api/market-history   - Histórico de snapshots do mercado
 * - GET /api/regime-history   - Histórico de mudanças de regime
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
const HistoryService = require('../../services/HistoryService');

module.exports = (dependencies) => {
  const { database } = dependencies;
  
  // Create service
  const historyService = new HistoryService(database);

  /**
   * GET /api/market-history
   * Histórico de snapshots do mercado
   * 
   * Query params:
   * - limit (opcional): Máximo de registros (padrão: 100, max: 1000)
   * - hours (opcional): Últimas N horas (padrão: 24)
   * - fields (opcional): Campos específicos (comma-separated)
   * 
   * Cache: 30s (dados históricos)
   */
  router.get('/market-history',
    cache(30000),
    validateQuery({
      limit: { type: 'number', min: 1, max: 1000 },
      hours: { type: 'number', min: 1, max: 168 } // Max 1 week
    }),
    asyncHandler(async (req, res) => {
      const options = {
        limit: Math.min(parseInt(req.query.limit) || 100, 1000),
        hours: parseInt(req.query.hours) || 24,
        fields: req.query.fields ? req.query.fields.split(',') : null
      };
      
      const result = await historyService.getMarketHistory(options);
      
      res.json({
        success: true,
        data: result.snapshots,
        count: result.count,
        timeRange: result.timeRange
      });
    })
  );

  /**
   * GET /api/regime-history
   * Histórico de mudanças de regime
   * 
   * Query params:
   * - hours (opcional): Últimas N horas (padrão: 24)
   * 
   * Cache: 30s
   */
  router.get('/regime-history',
    cache(30000),
    validateQuery({
      hours: { type: 'number', min: 1, max: 168 } // Max 1 week
    }),
    asyncHandler(async (req, res) => {
      const hours = parseInt(req.query.hours) || 24;
      
      const result = await historyService.getRegimeHistory(hours);
      
      res.json({
        success: true,
        data: {
          currentRegime: result.currentRegime,
          regimeChanges: result.regimeChanges,
          regimeStats: result.regimeStats,
          timeRange: result.timeRange
        }
      });
    })
  );

  return router;
};