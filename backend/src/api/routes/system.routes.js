/**
 * ============================================================================
 * SYSTEM ROUTES
 * ============================================================================
 * 
 * Endpoints de sistema:
 * - GET /health       - Health check
 * - GET /api/status   - Status detalhado
 * 
 * @author Valter Russo
 * @version 1.0
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');

module.exports = (dependencies) => {
  const { dataCollector, gexCalculator, regimeAnalyzer, database } = dependencies;

  /**
   * GET /health
   * Health check simples
   */
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime()
    });
  });

  /**
   * GET /api/status
   * Status detalhado do sistema
   */
  router.get('/status', asyncHandler(async (req, res) => {
    const stats = dataCollector.getStats();
    
    // Check components health
    const health = {
      dataCollector: stats.totalOptions > 0,
      websocket: stats.wsConnected,
      database: database ? await checkDatabaseHealth(database) : false,
      gexCalculator: !!gexCalculator,
      regimeAnalyzer: !!regimeAnalyzer
    };
    
    // Overall status
    const allHealthy = Object.values(health).every(h => h === true);
    
    res.json({
      success: true,
      data: {
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: Date.now(),
        uptime: process.uptime(),
        components: health,
        stats: {
          underlying: stats.underlying,
          totalOptions: stats.totalOptions,
          validOptions: stats.validOptions,
          uniqueStrikes: stats.uniqueStrikes,
          uniqueExpiries: stats.uniqueExpiries,
          spotPrice: stats.spotPrice,
          lastUpdate: stats.lastUpdate
        }
      }
    });
  }));

  return router;
};

/**
 * Check database health
 */
async function checkDatabaseHealth(database) {
  try {
    if (!database || !database.sequelize) {
      return false;
    }
    await database.sequelize.authenticate();
    return true;
  } catch (error) {
    return false;
  }
}