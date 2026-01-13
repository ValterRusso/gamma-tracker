/**
 * ============================================================================
 * DVOL ROUTES - Deribit Volatility Index
 * ============================================================================
 * 
 * Endpoints for Deribit Volatility Index (DVOL) data
 * Similar to VIX for crypto markets
 * 
 * ENDPOINTS:
 * - GET /api/dvol/current      - Current DVOL for BTC and ETH
 * - GET /api/dvol/historical   - Historical DVOL data (7d/30d/90d)
 * - GET /api/dvol/stats        - Volatility statistics (percentile, rank)
 * - GET /api/dvol/health       - Health check
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const DVOLService = require('../../database/services/DVOLService');

// Cache for DVOL data (5 minutes for current, 1 hour for historical)
const cache = {
  current: { data: null, timestamp: 0, ttl: 5 * 60 * 1000 }, // 5 minutes
  historical: { data: {}, timestamp: {}, ttl: 60 * 60 * 1000 } // 1 hour
};

module.exports = () => {
  /**
   * GET /api/dvol/current
   * Get current DVOL for BTC and ETH
   */
  router.get('/dvol/current', asyncHandler(async (req, res) => {
    const now = Date.now();
    
    // Check cache
    if (cache.current.data && (now - cache.current.timestamp) < cache.current.ttl) {
      console.log('[DVOL API] Returning cached current DVOL');
      return res.json({
        success: true,
        data: cache.current.data,
        cached: true
      });
    }

    console.log('[DVOL API] Fetching current DVOL from Deribit...');
    const data = await DVOLService.getCurrentDVOLBoth();

    // Update cache
    cache.current.data = data;
    cache.current.timestamp = now;

    res.json({
      success: true,
      data,
      cached: false
    });
  }));

  /**
   * GET /api/dvol/historical
   * Get historical DVOL data
   * Query params: timeframe (7d, 30d, 90d)
   */
  router.get('/dvol/historical', asyncHandler(async (req, res) => {
    const { timeframe = '7d' } = req.query;

    // Validate timeframe
    if (!['7d', '30d', '90d'].includes(timeframe)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timeframe. Must be 7d, 30d, or 90d'
      });
    }

    const now = Date.now();
    const cacheKey = timeframe;

    // Check cache
    if (
      cache.historical.data[cacheKey] && 
      cache.historical.timestamp[cacheKey] &&
      (now - cache.historical.timestamp[cacheKey]) < cache.historical.ttl
    ) {
      console.log(`[DVOL API] Returning cached historical DVOL (${timeframe})`);
      return res.json({
        success: true,
        data: cache.historical.data[cacheKey],
        cached: true
      });
    }

    console.log(`[DVOL API] Fetching historical DVOL from Deribit (${timeframe})...`);
    const data = await DVOLService.getHistoricalDVOLBoth(timeframe);

    // Update cache
    cache.historical.data[cacheKey] = data;
    cache.historical.timestamp[cacheKey] = now;

    res.json({
      success: true,
      data,
      cached: false
    });
  }));

  /**
   * GET /api/dvol/stats
   * Get volatility statistics (percentile, rank, etc.)
   * Query params: currency (BTC, ETH)
   */
  router.get('/dvol/stats', asyncHandler(async (req, res) => {
    const { currency = 'BTC' } = req.query;

    // Validate currency
    if (!['BTC', 'ETH'].includes(currency.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid currency. Must be BTC or ETH'
      });
    }

    console.log(`[DVOL API] Calculating stats for ${currency}...`);

    // Get current and historical data
    const [current, historical90d] = await Promise.all([
      DVOLService.getCurrentDVOL(currency),
      DVOLService.getHistoricalDVOL(currency, '90d')
    ]);

    // Calculate statistics
    const percentile = DVOLService.calculateIVPercentile(current.volatility, historical90d);
    const ivRank = DVOLService.calculateIVRank(current.volatility, historical90d);

    // Calculate 30-day average
    const last30Days = historical90d.slice(-30);
    const avg30d = last30Days.length > 0
      ? last30Days.reduce((sum, d) => sum + d.volatility, 0) / last30Days.length
      : current.volatility;

    res.json({
      success: true,
      data: {
        currency,
        current: current.volatility,
        percentile,
        ivRank: ivRank.rank,
        high52w: ivRank.high52w,
        low52w: ivRank.low52w,
        avg30d: Math.round(avg30d * 1000) / 1000,
        change24h: current.change24h,
        changePercent24h: current.changePercent24h
      }
    });
  }));

  /**
   * GET /api/dvol/health
   * Health check endpoint
   */
  router.get('/dvol/health', (req, res) => {
    res.json({
      success: true,
      service: 'DVOL API',
      status: 'operational',
      timestamp: Date.now()
    });
  });

  return router;
};
