/**
 * STRATEGIES ROUTES
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const cache = require('../middleware/cache');
const StrategyService = require('../../services/StrategyService');

module.exports = (dependencies) => {
  const { database, marketStateAnalyzer, strategyRecommender, strategies } = dependencies;
  const strategyService = new StrategyService(database, marketStateAnalyzer, strategyRecommender, strategies);

  // GET /api/strategies/recommend
  router.get('/strategies/recommend', cache(10000), asyncHandler(async (req, res) => {
    const topN = parseInt(req.query.topN) || 5;
    const minScore = parseInt(req.query.minScore) || 50;
    
    const result = await strategyService.recommend({ topN, minScore });
    res.json({ success: true, data: result });
  }));

  // GET /api/strategies/all
  router.get('/strategies/all', cache(10000), asyncHandler(async (req, res) => {
    const result = await strategyService.getAllWithScores();
    res.json({ success: true, data: result });
  }));

  // GET /api/strategies/:id
  router.get('/strategies/:id', cache(10000), asyncHandler(async (req, res) => {
    const strategy = await strategyService.getStrategy(req.params.id);
    res.json({ success: true, data: strategy });
  }));

  return router;
};