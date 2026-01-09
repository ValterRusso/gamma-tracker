/**
 * ============================================================================
 * HISTORY SERVICE
 * ============================================================================
 * 
 * Business logic para queries históricas do database
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

const { Op } = require('sequelize');

class HistoryService {
  constructor(database) {
    this.database = database;
  }

  /**
   * Get market history
   * @param {Object} options - { limit, hours, fields }
   */
  async getMarketHistory(options = {}) {
    const {
      limit = 100,
      hours = 24,
      fields = null
    } = options;

    // Get MarketSnapshot model
    const MarketSnapshot = this.database.models.MarketSnapshot;

    if (!MarketSnapshot) {
      throw new Error('MarketSnapshot model not found');
    }

    // Calculate time range
    const startTime = Date.now() - (hours * 60 * 60 * 1000);

    // Build attributes list
    const attributes = fields || [
      'id',
      'timestamp',
      'spot_price',
      'total_options',
      'total_gex',
      'max_gex_strike',
      'regime',
      'max_pain_strike',
      'max_pain_oi',
      'max_pain_distance',
      'max_pain_distance_pct',
      'sentiment',
      'put_call_oi_ratio',
      'put_call_vol_ratio'
    ];

    // Query snapshots
    const snapshots = await MarketSnapshot.findAll({
      attributes: attributes,
      where: {
        timestamp: { [Op.gte]: startTime }
      },
      order: [['timestamp', 'DESC']],
      limit: limit
    });

    return {
      snapshots,
      count: snapshots.length,
      timeRange: {
        start: startTime,
        end: Date.now(),
        hours: hours
      }
    };
  }

  /**
   * Get regime history
   * @param {number} hours - Time range in hours
   */
  async getRegimeHistory(hours = 24) {
    // Get MarketSnapshot model
    const MarketSnapshot = this.database.models.MarketSnapshot;

    if (!MarketSnapshot) {
      throw new Error('MarketSnapshot model not found');
    }

    // Calculate time range
    const startTime = Date.now() - (hours * 60 * 60 * 1000);

    // Query regime changes
    const snapshots = await MarketSnapshot.findAll({
      attributes: ['timestamp', 'regime', 'spot_price', 'total_gex'],
      where: {
        timestamp: { [Op.gte]: startTime },
        regime: { [Op.ne]: null }
      },
      order: [['timestamp', 'ASC']]
    });

    // Detect regime changes
    const regimeChanges = [];
    let lastRegime = null;

    snapshots.forEach(snapshot => {
      if (snapshot.regime !== lastRegime) {
        regimeChanges.push({
          timestamp: snapshot.timestamp,
          regime: snapshot.regime,
          spotPrice: snapshot.spot_price,
          totalGex: snapshot.total_gex
        });
        lastRegime = snapshot.regime;
      }
    });

    // Calculate regime duration statistics
    const regimeStats = this._calculateRegimeStats(regimeChanges);

    return {
      currentRegime: lastRegime,
      regimeChanges: regimeChanges,
      regimeStats: regimeStats,
      timeRange: {
        start: startTime,
        end: Date.now(),
        hours: hours
      }
    };
  }

  /**
   * Calculate regime statistics
   * @private
   */
  _calculateRegimeStats(regimeChanges) {
    const regimeStats = {};

    for (let i = 0; i < regimeChanges.length; i++) {
      const regime = regimeChanges[i].regime;
      
      // Calculate duration
      const duration = i < regimeChanges.length - 1
        ? regimeChanges[i + 1].timestamp - regimeChanges[i].timestamp
        : Date.now() - regimeChanges[i].timestamp;

      // Initialize stats for this regime
      if (!regimeStats[regime]) {
        regimeStats[regime] = {
          count: 0,
          totalDuration: 0,
          avgDuration: 0
        };
      }

      // Update stats
      regimeStats[regime].count++;
      regimeStats[regime].totalDuration += duration;
      regimeStats[regime].avgDuration = regimeStats[regime].totalDuration / regimeStats[regime].count;
    }

    return regimeStats;
  }
}

module.exports = HistoryService;