const express = require('express');
const router = express.Router();

module.exports = (dependencies) => {
  const positionCalculator = require('../../database/services/PositionCalculatorService');

  /**
   * POST /api/positions/calculate
   * Calculate P&L, Greeks, and other metrics for a position
   * 
   * Body:
   * {
   *   legs: [
   *     {
   *       symbol: "BTC-260327-100000-C",
   *       underlying: "BTC",
   *       strike: 100000,
   *       expiryDate: 1774598400000,
   *       side: "CALL",
   *       action: "buy",
   *       quantity: 1,
   *       entryPrice: 4787.517,
   *       delta: 0.42468257,
   *       gamma: 0.00002305,
   *       theta: -45.92163021,
   *       vega: 164.40305133
   *     }
   *   ],
   *   config: {
   *     spotPrices: [90000, 95000, 100000, 105000, 110000], // optional
   *     daysToExpiry: null // optional, null = current time
   *   }
   * }
   */
  router.post('/positions/calculate', async (req, res) => {
    try {
      const { legs, config } = req.body;

      // Validate input
      if (!legs || !Array.isArray(legs) || legs.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid input: legs array is required'
        });
      }

      // Calculate position
      const result = await positionCalculator.calculatePosition(legs, config || {});

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error calculating position:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/positions/greeks
   * Calculate only Greeks for a position (faster)
   */
  router.post('/positions/greeks', async (req, res) => {
    try {
      const { legs } = req.body;

      if (!legs || !Array.isArray(legs) || legs.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid input: legs array is required'
        });
      }

      const greeks = positionCalculator.calculatePositionGreeks(legs);
      const totalCost = positionCalculator.calculateTotalCost(legs);

      res.json({
        success: true,
        data: {
          greeks,
          totalCost
        }
      });
    } catch (error) {
      console.error('Error calculating Greeks:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/positions/scenarios
   * Calculate P&L for multiple scenarios (different times/IVs)
   */
  router.post('/positions/scenarios', async (req, res) => {
    try {
      const { legs, scenarios } = req.body;

      if (!legs || !Array.isArray(legs) || legs.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid input: legs array is required'
        });
      }

      if (!scenarios || !Array.isArray(scenarios)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid input: scenarios array is required'
        });
      }

      const results = [];

      for (const scenario of scenarios) {
        const { label, daysToExpiry } = scenario;
        
        const result = await positionCalculator.calculatePosition(legs, {
          daysToExpiry
        });

        results.push({
          label,
          daysToExpiry,
          pnlCurve: result.pnlCurve
        });
      }

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Error calculating scenarios:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/positions/health
   * Health check endpoint
   */
  router.get('/positions/health', (req, res) => {
    res.json({
      success: true,
      message: 'Positions API is healthy',
      timestamp: new Date().toISOString()
    });
  });

  return router;
};
