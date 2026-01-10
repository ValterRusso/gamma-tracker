/**
 * ============================================================================
 * IV COMPARISON ROUTES
 * ============================================================================
 * 
 * Endpoints para comparação de IV entre Binance e Deribit
 * Detecta Retail Panic Index e divergências de pricing
 * 
 * BINANCE ENDPOINTS:
 * - GET /api/binance/iv-surface        - IV surface Binance
 * - GET /api/binance/iv-metrics/:dte   - Métricas por DTE
 * - GET /api/binance/stats             - Estatísticas do adapter
 * 
 * DERIBIT ENDPOINTS:
 * - GET /api/deribit/iv-surface        - IV surface Deribit
 * - GET /api/deribit/iv-metrics/:dte   - Métricas por DTE
 * 
 * COMPARISON ENDPOINTS:
 * - GET /api/iv-comparison/:dte        - Comparação para 1 DTE
 * - GET /api/iv-comparison/multiple    - Comparação múltiplos DTEs
 * - GET /api/iv-comparison/history     - Histórico de spreads
 * - GET /api/iv-comparison/stats       - Estatísticas do comparador
 * - GET /api/retail-panic-index        - Retail Panic Index (simplificado)
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const cache = require('../middleware/cache');
const { validateQuery, validateParams } = require('../middleware/validation');
const IVComparisonService = require('../../services/IvcomparisonService')


module.exports = (dependencies) => {
  const { binanceAdapter, deribitAPI, ivComparator } = dependencies;
  
  // Create service
  const ivService = new IVComparisonService(binanceAdapter, deribitAPI, ivComparator);

  // ========================================
  // BINANCE ENDPOINTS
  // ========================================

  /**
   * GET /api/binance/iv-surface
   * IV surface completa da Binance
   * Cache: 10s
   */
  router.get('/binance/iv-surface', 
    cache(10000), 
    asyncHandler(async (req, res) => {
      const surface = await ivService.getBinanceIVSurface();
      
      res.json({
        success: true,
        data: surface
      });
    })
  );

  /**
   * GET /api/binance/iv-metrics/:dte
   * Métricas de IV da Binance para DTE específico
   * Cache: 10s
   */
  router.get('/binance/iv-metrics/:dte',
    cache(10000),
    validateParams({
      dte: { type: 'string', required: true }
    }),
    asyncHandler(async (req, res) => {
      const dte = parseInt(req.params.dte);
      
      if (isNaN(dte) || dte < 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid DTE parameter'
        });
      }
      
      const metrics = await ivService.getBinanceIVMetrics(dte);
      
      res.json({
        success: true,
        data: metrics
      });
    })
  );

  /**
   * GET /api/binance/stats
   * Estatísticas do Binance adapter
   * Cache: 5s
   */
  router.get('/binance/stats', 
    cache(5000), 
    asyncHandler(async (req, res) => {
      const stats = await ivService.getBinanceStats();
      
      res.json({
        success: true,
        data: stats
      });
    })
  );

  // ========================================
  // DERIBIT ENDPOINTS
  // ========================================

  /**
   * GET /api/deribit/iv-surface
   * IV surface completa da Deribit
   * Cache: 10s
   */
  router.get('/deribit/iv-surface', 
    cache(10000), 
    asyncHandler(async (req, res) => {
      const surface = await ivService.getDeribitIVSurface();
      
      res.json({
        success: true,
        data: surface
      });
    })
  );

  /**
   * GET /api/deribit/iv-metrics/:dte
   * Métricas de IV da Deribit para DTE específico
   * Cache: 10s
   */
  router.get('/deribit/iv-metrics/:dte',
    cache(10000),
    validateParams({
      dte: { type: 'string', required: true }
    }),
    asyncHandler(async (req, res) => {
      const dte = parseInt(req.params.dte);
      
      if (isNaN(dte) || dte < 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid DTE parameter'
        });
      }
      
      const metrics = await ivService.getDeribitIVMetrics(dte);
      
      res.json({
        success: true,
        data: metrics
      });
    })
  );

  // ========================================
  // COMPARISON ENDPOINTS
  // ========================================

  /**
   * GET /api/iv-comparison/:dte
   * Comparação completa Binance vs Deribit para 1 DTE
   * ENDPOINT PRINCIPAL ⭐
   * Cache: 10s
   */
  router.get('/iv-comparison/:dte',
    cache(10000),
    validateParams({
      dte: { type: 'string', required: true }
    }),
    asyncHandler(async (req, res) => {
      const dte = parseInt(req.params.dte);
      
      if (isNaN(dte) || dte < 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid DTE parameter'
        });
      }
      
      const comparison = await ivService.compare(dte);
      
      res.json(comparison);
    })
  );

  /**
   * GET /api/iv-comparison/multiple
   * Compara múltiplos DTEs de uma vez
   * Query: ?dtes=1,2,3,7,30
   * Cache: 10s
   */
  router.get('/iv-compare/multiple',
    cache(10000),
    validateQuery({
      dtes: { type: 'string', required: false }
    }),
    asyncHandler(async (req, res) => {
      const dtesParam = req.query.dtes || '1,2,3,7,30';
      
      const dtes = dtesParam
        .split(',')
        .map(d => parseInt(d.trim()))
        .filter(d => !isNaN(d) && d >= 0);
      
      if (dtes.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid DTEs parameter',
          example: '/api/iv-comparison/multiple?dtes=1,2,3,7'
        });
      }
      
      const comparisons = await ivService.compareMultiple(dtes);
      
      res.json({
        success: true,
        dtes: dtes,
        data: comparisons
      });
    })
  );

  /**
   * GET /api/iv-comparison/history
   * Histórico de spreads
   * Query: ?dte=1&hours=24
   * Cache: 30s (histórico)
   */
  router.get('/iv-compare/history',
    cache(30000),
    validateQuery({
      hours: { type: 'int', min: 1, max: 168, default: 24 },
      interval: { type: 'int', min: 1, max: 60, default: 5 }
    }),
    async (req, res) => {
      const { hours, interval } = req.query;       
         
      const history = await ivComparator.getHistory?.({hours, interval});

      if (!history) {
        // Se método não existe, retornar histórico básico
        const comparison = await ivComparator.getSpreadHistory();
        
        res.json({
          success: true,
          data: {
            history: comparison ? [comparison] : [],
            hours,
            interval,
            note: 'Historical data collection not yet implemented'
          }
        });
        return;
      }

      
      res.json({
        success: true,       
        data: {
          history,
          hours,
          interval
        }

      });
    });
  

  /**
   * GET /api/iv-comparison/stats
   * Estatísticas do comparador
   * Cache: 5s
   */
  router.get('/iv-compare/stats', 
    cache(5000), 
    asyncHandler(async (req, res) => {
      const stats = await ivService.getStats();
      
      res.json({
        success: true,
        data: stats,
        timestamp: Date.now()
      });
    })
  );

  /**
   * GET /api/retail-panic-index
   * Retail Panic Index (endpoint simplificado)
   * Query: ?dte=1
   * Cache: 10s
   */
  router.get('/retail-panic-index',
    cache(10000),
    validateQuery({
      dte: { type: 'number', min: 0, max: 365 }
    }),
    asyncHandler(async (req, res) => {
      const dte = req.query.dte ? parseInt(req.query.dte) : 1;
      
      const result = await ivService.getRetailPanicIndex(dte);
      
      res.json(result);
    })
  );

  return router;
};