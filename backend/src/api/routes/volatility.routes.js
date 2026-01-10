/**
 * ============================================================================
 * VOLATILITY ROUTES
 * ============================================================================
 * 
 * Endpoints para análise de volatilidade
 * 
 * ENDPOINTS:
 * - GET /api/vol-surface      - Superfície de volatilidade 3D
 * - GET /api/anomalies        - Anomalias detectadas
 * - GET /api/insights         - Insights de regime
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
const VolatilityService = require('../../services/VolatilityService');
// const GEXCalculator = require('../../calculators/GEXCalculator');

module.exports = (dependencies) => {
  const { dataCollector, volSurfaceCalculator, anomalyDetector, regimeAnalyzer, gexCalculator } = dependencies;
  
  // Create service
  const volatilityService = new VolatilityService(
    dataCollector,
    volSurfaceCalculator,
    anomalyDetector,
    regimeAnalyzer,
    gexCalculator
  );

  /**
   * GET /api/vol-surface
   * Superfície de volatilidade 3D
   * Cache: 10s
   */
  router.get('/vol-surface', 
    cache(10000), 
    asyncHandler(async (req, res) => {
      const surface = await volatilityService.getVolSurface();
      
      res.json({
        success: true,
        data: surface
      });
    })
  );

  /**
   * GET /api/anomalies
   * Anomalias de volatilidade detectadas
   * 
   * Query params:
   * - threshold (opcional): 1.0-5.0 (padrão: 2.0)
   * - limit (opcional): 1-200 (padrão: 50)
   * - severity (opcional): CRITICAL|HIGH|MEDIUM|LOW
   * - type (opcional): IV_OUTLIER|SKEW_ANOMALY
   * 
   * Cache: 10s
   */
  router.get('/anomalies',
    cache(10000),
    validateQuery({
      threshold: {  min: 1.0, max: 5.0, required: false },
      limit: {  min: 1, max: 200, required: false },
      severity: { enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], required: false },
      type: { enum: ['IV_OUTLIER', 'SKEW_ANOMALY'], required: false }
    }),
    asyncHandler(async (req, res) => {
      const options = {
        threshold: parseFloat(req.query.threshold) || 2.0,
        limit: parseInt(req.query.limit) || 50,
        severityFilter: req.query.severity || null,
        typeFilter: req.query.type || null
      };
      
      const anomalies = await volatilityService.getAnomalies(options);
      
      res.json({
        success: true,
        data: anomalies
      });
    })
  );

  /**
   * GET /api/insights
   * Insights de análise de regime
   * Cache: 10s
   */
  router.get('/insights', 
    cache(10000), 
    asyncHandler(async (req, res) => {
      const insights = await volatilityService.getInsights();
      
      res.json({
        success: true,
        data: insights
      });
    })
  );

  return router;
};