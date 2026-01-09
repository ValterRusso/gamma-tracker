/**
 * ============================================================================
 * ESCAPE ROUTES
 * ============================================================================
 * 
 * Endpoints para detecção de tipo de escape (Half Pipe Model)
 * Analisa H1 (Escape Bom), H2 (Falso Escape), H3 (Colapso)
 * 
 * ENDPOINTS:
 * - GET /api/escape/detect       - Detecção atual de tipo de escape
 * - GET /api/escape/probability  - Probabilidade de escape (P_escape)
 * - GET /api/escape/energy       - Breakdown de energia (sustained + injected)
 * - GET /api/escape/conditions   - Condições de cada hipótese (H1/H2/H3)
 * - GET /api/escape/history      - Histórico de detecções
 * - GET /api/escape/summary      - Resumo completo
 * - GET /api/escape/alerts       - Alertas ativos
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
const EscapeService = require('../../services/EscapeService');

module.exports = (dependencies) => {
  const { dataCollector, escapeTypeDetector } = dependencies;
  
  // Create service
  const escapeService = new EscapeService(dataCollector, escapeTypeDetector);

  /**
   * GET /api/escape/detect
   * Detecção atual de tipo de escape
   * Cache: 2s (precisa ser rápido!)
   */
  router.get('/escape/detect', 
    cache(2000), 
    asyncHandler(async (req, res) => {
      const detection = await escapeService.getDetection();
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        detection
      });
    })
  );

  /**
   * GET /api/escape/probability
   * Probabilidade de escape (P_escape)
   * Cache: 2s
   */
  router.get('/escape/probability', 
    cache(2000), 
    asyncHandler(async (req, res) => {
      const probability = await escapeService.getProbability();
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        probability
      });
    })
  );

  /**
   * GET /api/escape/energy
   * Breakdown de energia (sustained + injected)
   * Cache: 2s
   */
  router.get('/escape/energy', 
    cache(2000), 
    asyncHandler(async (req, res) => {
      const energy = await escapeService.getEnergy();
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        energy
      });
    })
  );

  /**
   * GET /api/escape/conditions
   * Condições de cada hipótese (H1/H2/H3)
   * Cache: 3s
   */
  router.get('/escape/conditions', 
    cache(3000), 
    asyncHandler(async (req, res) => {
      const conditions = await escapeService.getConditions();
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        conditions: conditions.conditions,
        currentType: conditions.currentType,
        currentConfidence: conditions.currentConfidence
      });
    })
  );

  /**
   * GET /api/escape/history
   * Histórico de detecções
   * Query: minutes (padrão: 60, max: 3600)
   * Cache: 5s
   */
  router.get('/escape/history',
    cache(5000),
    validateQuery({
      minutes: { type: 'number', min: 1, max: 3600 }
    }),
    asyncHandler(async (req, res) => {
      const minutes = Math.min(3600, Math.max(1, parseInt(req.query.minutes) || 60));
      
      const result = await escapeService.getHistory(minutes);
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        minutes,
        history: result.history,
        stats: result.stats
      });
    })
  );

  /**
   * GET /api/escape/summary
   * Resumo completo (detection + history + stats + alerts)
   * Cache: 3s
   */
  router.get('/escape/summary', 
    cache(3000), 
    asyncHandler(async (req, res) => {
      const summary = await escapeService.getSummary();
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        summary
      });
    })
  );

  /**
   * GET /api/escape/alerts
   * Alertas ativos com resumo por severidade
   * Cache: 2s
   */
  router.get('/escape/alerts', 
    cache(2000), 
    asyncHandler(async (req, res) => {
      const result = await escapeService.getAlerts();
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        alerts: result.alerts,
        summary: result.summary
      });
    })
  );

  return router;
};