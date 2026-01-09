/**
 * ============================================================================
 * SENTIMENT ROUTES
 * ============================================================================
 * 
 * Endpoints para análise de sentimento do mercado de opções
 * 
 * ENDPOINTS:
 * - GET /api/max-pain    - Cálculo de Max Pain (maior dor dos MM)
 * - GET /api/sentiment   - Análise de sentimento geral
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const cache = require('../middleware/cache');
const SentimentService = require('../../services/SentimentService');

module.exports = (dependencies) => {
  const { dataCollector, maxPainCalculator, sentimentAnalyzer } = dependencies;
  
  // Create service
  const sentimentService = new SentimentService(
    dataCollector,
    maxPainCalculator,
    sentimentAnalyzer
  );

  /**
   * GET /api/max-pain
   * Calcula Max Pain (strike com maior dor para os Market Makers)
   * Inclui análise de OI e top 10 strikes
   * Cache: 10s
   */
  router.get('/max-pain', 
    cache(10000), 
    asyncHandler(async (req, res) => {
      const maxPain = await sentimentService.getMaxPain();
      
      res.json({
        success: true,
        data: maxPain
      });
    })
  );

  /**
   * GET /api/sentiment
   * Análise de sentimento do mercado baseado em opções
   * Cache: 10s
   */
  router.get('/sentiment', 
    cache(10000), 
    asyncHandler(async (req, res) => {
      const sentiment = await sentimentService.getSentiment();
      
      res.json({
        success: true,
        data: sentiment
      });
    })
  );

  return router;
};