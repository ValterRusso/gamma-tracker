/**
 * ============================================================================
 * MARKET ANALYSIS ROUTES (NEW!)
 * ============================================================================
 * 
 * Endpoints de análise combinada (Entropy + RSI + Volume):
 * - GET /api/market-analysis           - Análise completa
 * - GET /api/market-analysis/history   - Histórico de análises
 * - GET /api/market-analysis/stats     - Estatísticas do analyzer
 * - GET /api/patterns/:pattern         - Explicação de patterns
 * 
 * @author Valter Russo
 * @version 1.0
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const cache = require('../middleware/cache');
const { validateQuery } = require('../middleware/validation');
const MarketAnalysisService = require('../../services/MarketanalysisService');

module.exports = (dependencies) => {
  const { marketAnalyzer } = dependencies;
  
  // Create service
  const analysisService = new MarketAnalysisService(marketAnalyzer);

  /**
   * GET /api/market-analysis
   * Análise completa do mercado (cached 30s)
   */
  router.get('/market-analysis', cache(30000), asyncHandler(async (req, res) => {
    const analysis = await analysisService.getAnalysis();
    
    res.json({ success: true, data: analysis });
  }));

  /**
   * GET /api/market-analysis/history
   * Histórico de análises
   */
  router.get('/market-analysis/history',
    validateQuery({
      limit: { type: 'number', min: 1, max: 50 }
    }),
    asyncHandler(async (req, res) => {
      const limit = req.query.limit || 10;
      
      const history = await analysisService.getHistory(limit);
      
      res.json({ success: true, data: history });
    })
  );

  /**
   * GET /api/market-analysis/stats
   * Estatísticas do analyzer
   */
  router.get('/market-analysis/stats', asyncHandler(async (req, res) => {
    const stats = await analysisService.getStats();
    
    res.json({ success: true, data: stats });
  }));

  /**
   * GET /api/patterns/:pattern
   * Explicação de um pattern específico
   */
  router.get('/patterns/:pattern', asyncHandler(async (req, res) => {
    const { pattern } = req.params;
    
    const explanation = await analysisService.getPatternExplanation(pattern);
    
    res.json({
      success: true,
      pattern: pattern.toUpperCase(),
      data: explanation
    });
  }));

  return router;
};