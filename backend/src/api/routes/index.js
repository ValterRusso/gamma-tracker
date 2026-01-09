/**
 * ============================================================================
 * ROUTES INDEX - CENTRAL ROUTER
 * ============================================================================
 * 
 * Monta todas as routes da API em um único router
 * 
 * Total: 14 route files
 * Total: 72+ endpoints
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

const express = require('express');
const router = express.Router();

// Import all route modules
const systemRoutes = require('./system.routes');
const metricsRoutes = require('./metrics.routes');
const entropyRoutes = require('./entropy.routes');
const marketAnalysisRoutes = require('./market-analysis.routes');
const liquidationsRoutes = require('./liquidations.routes');
const strategiesRoutes = require('./strategies.routes');
const orderbookRoutes = require('./orderbook.routes');
const sentimentRoutes = require('./sentiment.routes');
const volatilityRoutes = require('./volatility.routes');
const escapeRoutes = require('./escape.routes');
const historyRoutes = require('./history.routes');
const ivComparisonRoutes = require('./iv-comparison.routes');
const optionsRoutes = require('./options.routes');

module.exports = (dependencies) => {
  // Mount all routes
  router.use(systemRoutes(dependencies));           // 2 endpoints
  router.use(metricsRoutes(dependencies));          // 6 endpoints
  router.use(entropyRoutes(dependencies));          // 12 endpoints
  router.use(marketAnalysisRoutes(dependencies));   // 4 endpoints
  router.use(liquidationsRoutes(dependencies));     // 7 endpoints
  router.use(strategiesRoutes(dependencies));       // 3 endpoints
  router.use(orderbookRoutes(dependencies));        // 7 endpoints
  router.use(sentimentRoutes(dependencies));        // 2 endpoints
  router.use(volatilityRoutes(dependencies));       // 3 endpoints
  router.use(escapeRoutes(dependencies));           // 7 endpoints
  router.use(historyRoutes(dependencies));          // 2 endpoints
  router.use(ivComparisonRoutes(dependencies));     // 13 endpoints
  router.use(optionsRoutes(dependencies));          // 4 endpoints
  
  return router;
};