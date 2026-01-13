/**
 * ============================================================================
 * DEX Heatmap Routes
 * ============================================================================
 * 
 * Endpoints for Delta Exposure (DEX) heatmap visualization:
 * - GET /api/dex/heatmap      - Get DEX heatmap data for time range
 * - GET /api/dex/timestamps   - Get available timestamps (time slider)
 * - GET /api/dex/snapshot     - Get DEX snapshot at specific time
 * - GET /api/dex/strike/:strike - Get DEX history for specific strike
 * 
 * DEX = Delta × Open Interest × 100
 * Similar to GEX but uses delta instead of gamma for pressure analysis.
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

module.exports = (dependencies) => {
  const { dexSnapshotService } = dependencies;

  /**
   * GET /api/dex/heatmap
   * Get DEX heatmap data for time range
   * 
   * Query params:
   * - timeframe: '1h', '4h', '1d' (default: '1h')
   * - asset: 'BTCUSDT' (default)
   * 
   * Returns: Array of { timestamp, strike, totalDex, callDex, putDex, ... }
   */
  router.get('/dex/heatmap',
    cache(10000), // 10s cache
    validateQuery({
      timeframe: { type: 'string', enum: ['1h', '4h', '1d', '7d'], default: '1h' },
      asset: { type: 'string', default: 'BTCUSDT' }
    }),
    asyncHandler(async (req, res) => {
      const { timeframe, asset } = req.query;
      
      // Calculate time range
      const now = Date.now();
      const timeframes = {
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000
      };
      
      const startTime = now - timeframes[timeframe];
      const endTime = now;
      
      const data = await dexSnapshotService.getHeatmapData(startTime, endTime, asset);
      
      res.json({
        success: true,
        data: {
          timeframe,
          startTime,
          endTime,
          points: data.length,
          heatmap: data
        }
      });
    })
  );

  /**
   * GET /api/dex/timestamps
   * Get available timestamps for time slider
   * 
   * Query params:
   * - timeframe: '1h', '4h', '1d' (default: '1h')
   * - asset: 'BTCUSDT' (default)
   * 
   * Returns: Array of timestamps
   */
  router.get('/dex/timestamps',
    cache(10000),
    validateQuery({
      timeframe: { type: 'string', enum: ['1h', '4h', '1d', '7d'], default: '1h' },
      asset: { type: 'string', default: 'BTCUSDT' }
    }),
    asyncHandler(async (req, res) => {
      const { timeframe, asset } = req.query;
      
      const now = Date.now();
      const timeframes = {
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000
      };
      
      const startTime = now - timeframes[timeframe];
      const endTime = now;
      
      const timestamps = await dexSnapshotService.getTimestamps(startTime, endTime, asset);
      
      res.json({
        success: true,
        data: {
          timeframe,
          count: timestamps.length,
          timestamps
        }
      });
    })
  );

  /**
   * GET /api/dex/snapshot
   * Get DEX snapshot at specific timestamp
   * 
   * Query params:
   * - timestamp: Unix timestamp in ms (required)
   * - asset: 'BTCUSDT' (default)
   * 
   * Returns: Array of strikes at this timestamp
   */
  router.get('/dex/snapshot',
    cache(30000), // 30s cache (historical data)
    validateQuery({
      timestamp: { type: 'string', required: true },
      asset: { type: 'string', default: 'BTCUSDT' }
    }),
    asyncHandler(async (req, res) => {
      const timestamp = parseInt(req.query.timestamp, 10);
      const { asset } = req.query;
      
      if (isNaN(timestamp)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid timestamp'
        });
      }
      
      const snapshot = await dexSnapshotService.getSnapshotAtTime(timestamp, asset);
      
      res.json({
        success: true,
        data: {
          timestamp,
          strikes: snapshot.length,
          snapshot
        }
      });
    })
  );

  /**
   * GET /api/dex/strike/:strike
   * Get DEX history for specific strike
   * 
   * Query params:
   * - timeframe: '1h', '4h', '1d' (default: '1h')
   * - asset: 'BTCUSDT' (default)
   * 
   * Returns: Time series for this strike
   */
  router.get('/dex/strike/:strike',
    cache(10000),
    validateParams({
      strike: { type: 'string', required: true }
    }),
    validateQuery({
      timeframe: { type: 'string', enum: ['1h', '4h', '1d', '7d'], default: '1h' },
      asset: { type: 'string', default: 'BTCUSDT' }
    }),
    asyncHandler(async (req, res) => {
      const strike = parseFloat(req.params.strike);
      const { timeframe, asset } = req.query;
      
      if (isNaN(strike)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid strike'
        });
      }
      
      const now = Date.now();
      const timeframes = {
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000
      };
      
      const startTime = now - timeframes[timeframe];
      const endTime = now;
      
      const history = await dexSnapshotService.getStrikeHistory(strike, startTime, endTime, asset);
      
      res.json({
        success: true,
        data: {
          strike,
          timeframe,
          points: history.length,
          history
        }
      });
    })
  );

  return router;
};
