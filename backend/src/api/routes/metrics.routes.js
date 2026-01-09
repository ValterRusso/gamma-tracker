/**
 * ============================================================================
 * METRICS ROUTES (UPDATED)
 * ============================================================================
 * 
 * Endpoints para métricas GEX completas com validação e cache otimizado
 * 
 * ENDPOINTS:
 * - GET /api/metrics         - Métricas completas (cached)
 * - GET /api/gamma-profile   - Gamma profile com filtro inteligente
 * - GET /api/total-gex       - GEX total
 * - GET /api/gamma-flip      - Gamma flip point
 * - GET /api/walls           - Put/Call walls
 * - GET /api/wall-zones      - Wall zones (suporte/resistência)
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0 (Updated)
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const cache = require('../middleware/cache');
const { validateQuery } = require('../middleware/validation');
const MetricsService = require('../../services/MetricsService');

module.exports = (dependencies) => {
  const { dataCollector, gexCalculator } = dependencies;
  
  // Create service
  const metricsService = new MetricsService(dataCollector, gexCalculator);

  /**
   * GET /api/metrics
   * Métricas GEX completas
   * Cache: 5s
   */
  router.get('/metrics', 
    cache(5000), 
    asyncHandler(async (req, res) => {
      const metrics = await metricsService.getMetrics();
      
      res.json({
        success: true,
        data: metrics
      });
    })
  );

  /**
   * GET /api/gamma-profile
   * Gamma profile com filtro inteligente
   * 
   * Query params:
   * - range (opcional): Range percentual (padrão: 0.3 = ±30%)
   * - threshold (opcional): GEX threshold (padrão: 0.02 = 2%)
   * - auto (opcional): Auto range (padrão: true)
   * 
   * Cache: 5s
   */
  router.get('/gamma-profile',
    cache(5000),
    validateQuery({
      range: { min: 0.1, max: 1.0 },
      threshold: { min: 0.001, max: 0.1 },
      auto: { enum: ['true', 'false'] }
    }),
    asyncHandler(async (req, res) => {
      const options = {
        rangePercent: parseFloat(req.query.range) || 0.3,
        gexThreshold: parseFloat(req.query.threshold) || 0.02,
        autoRange: req.query.auto !== 'false' // default true
      };
      
      const result = await metricsService.getGammaProfile(options);
      
      res.json({
        success: true,
        data: result.profile,
        rangeInfo: result.rangeInfo,
        spotPrice: result.spotPrice
      });
    })
  );

  /**
   * GET /api/total-gex
   * GEX total do mercado
   * Cache: 5s
   */
  router.get('/total-gex', 
    cache(5000), 
    asyncHandler(async (req, res) => {
      const totalGEX = await metricsService.getTotalGEX();
      
      res.json({
        success: true,
        data: totalGEX
      });
    })
  );

  /**
   * GET /api/gamma-flip
   * Gamma flip point
   * Cache: 5s
   */
  router.get('/gamma-flip', 
    cache(5000), 
    asyncHandler(async (req, res) => {
      const gammaFlip = await metricsService.getGammaFlip();
      
      res.json({
        success: true,
        data: gammaFlip
      });
    })
  );

  /**
   * GET /api/walls
   * Put/Call walls
   * Cache: 5s
   */
  router.get('/walls', 
    cache(5000), 
    asyncHandler(async (req, res) => {
      const walls = await metricsService.getWalls();
      
      res.json({
        success: true,
        data: walls
      });
    })
  );

  /**
   * GET /api/wall-zones
   * Wall zones com distâncias calculadas
   * Cache: 5s
   */
  router.get('/wall-zones', 
    cache(5000), 
    asyncHandler(async (req, res) => {
      const wallZones = await metricsService.getWallZones();
      
      res.json({
        success: true,
        data: wallZones
      });
    })
  );

  return router;
};