const Logger = require('../../utils/logger');

/**
 * GEXSnapshotService
 * 
 * Manages GEX historical snapshots for heatmap visualization.
 * Stores time-series GEX data by strike for SpotGamma-style analysis.
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 */
class GEXSnapshotService {
  constructor(database) {
    this.db = database;
    this.logger = new Logger('GEXSnapshotService');
    this.snapshotInterval = 60000; // 1 minute default
    this.lastSnapshotTime = 0;
  }

  /**
   * Save GEX snapshot for all strikes
   * 
   * @param {Map} gexByStrike - Map from GEXCalculator.calculateGEXByStrike()
   * @param {number} spotPrice - Current spot price
   * @param {string} assetSymbol - Asset symbol (default: BTCUSDT)
   * @returns {Promise<number>} - Number of records inserted
   */
  async saveSnapshot(gexByStrike, spotPrice, assetSymbol = 'BTCUSDT') {
    try {
      const now = Date.now();
      
      // Throttle: only save if enough time has passed
      if (now - this.lastSnapshotTime < this.snapshotInterval) {
        return 0;
      }
      
      const GEXSnapshot = this.db.getModel('GEXSnapshot');
      
      // Convert Map to array of records
      const records = Array.from(gexByStrike.values()).map(strikeData => ({
        timestamp: now,
        strike: strikeData.strike,
        totalGex: strikeData.totalGEX || 0,
        callGex: strikeData.callGEX || 0,
        putGex: strikeData.putGEX || 0,
        callOi: strikeData.callOI || 0,
        putOi: strikeData.putOI || 0,
        totalOi: strikeData.totalOI || 0,
        callGamma: strikeData.callGamma || 0,
        putGamma: strikeData.putGamma || 0,
        spotPrice: spotPrice,
        assetSymbol: assetSymbol
      }));
      
      // Bulk insert for performance
      await GEXSnapshot.bulkCreate(records, {
        ignoreDuplicates: true
      });
      
      this.lastSnapshotTime = now;
      this.logger.debug(`Saved GEX snapshot: ${records.length} strikes at ${new Date(now).toISOString()}`);
      
      return records.length;
    } catch (error) {
      this.logger.error('Error saving GEX snapshot', error);
      throw error;
    }
  }

  /**
   * Get heatmap data for time range
   * 
   * @param {number} startTime - Start timestamp (ms)
   * @param {number} endTime - End timestamp (ms)
   * @param {string} assetSymbol - Asset symbol
   * @returns {Promise<Array>} - Array of { timestamp, strike, totalGex, callGex, putGex, ... }
   */
  async getHeatmapData(startTime, endTime, assetSymbol = 'BTCUSDT') {
    try {
      const GEXSnapshot = this.db.getModel('GEXSnapshot');
      
      const snapshots = await GEXSnapshot.findAll({
        where: {
          timestamp: {
            [this.db.sequelize.Sequelize.Op.between]: [startTime, endTime]
          },
          assetSymbol: assetSymbol
        },
        attributes: [
          'timestamp',
          'strike',
          'totalGex',
          'callGex',
          'putGex',
          'callOi',
          'putOi',
          'totalOi',
          'spotPrice'
        ],
        order: [
          ['timestamp', 'ASC'],
          ['strike', 'ASC']
        ],
        raw: true
      });
      
      this.logger.debug(`Retrieved ${snapshots.length} heatmap data points`);
      return snapshots;
    } catch (error) {
      this.logger.error('Error getting heatmap data', error);
      throw error;
    }
  }

  /**
   * Get unique timestamps in range (for time slider)
   * 
   * @param {number} startTime - Start timestamp (ms)
   * @param {number} endTime - End timestamp (ms)
   * @param {string} assetSymbol - Asset symbol
   * @returns {Promise<Array<number>>} - Array of timestamps
   */
  async getTimestamps(startTime, endTime, assetSymbol = 'BTCUSDT') {
    try {
      const GEXSnapshot = this.db.getModel('GEXSnapshot');
      
      const results = await GEXSnapshot.findAll({
        where: {
          timestamp: {
            [this.db.sequelize.Sequelize.Op.between]: [startTime, endTime]
          },
          assetSymbol: assetSymbol
        },
        attributes: [
          [this.db.sequelize.fn('DISTINCT', this.db.sequelize.col('timestamp')), 'timestamp']
        ],
        order: [['timestamp', 'ASC']],
        raw: true
      });
      
      return results.map(r => r.timestamp);
    } catch (error) {
      this.logger.error('Error getting timestamps', error);
      throw error;
    }
  }

  /**
   * Get GEX history for specific strike
   * 
   * @param {number} strike - Strike price
   * @param {number} startTime - Start timestamp (ms)
   * @param {number} endTime - End timestamp (ms)
   * @param {string} assetSymbol - Asset symbol
   * @returns {Promise<Array>} - Time series for this strike
   */
  async getStrikeHistory(strike, startTime, endTime, assetSymbol = 'BTCUSDT') {
    try {
      const GEXSnapshot = this.db.getModel('GEXSnapshot');
      
      const history = await GEXSnapshot.findAll({
        where: {
          strike: strike,
          timestamp: {
            [this.db.sequelize.Sequelize.Op.between]: [startTime, endTime]
          },
          assetSymbol: assetSymbol
        },
        order: [['timestamp', 'ASC']],
        raw: true
      });
      
      return history;
    } catch (error) {
      this.logger.error('Error getting strike history', error);
      throw error;
    }
  }

  /**
   * Get snapshot at specific timestamp
   * 
   * @param {number} timestamp - Timestamp (ms)
   * @param {string} assetSymbol - Asset symbol
   * @returns {Promise<Array>} - All strikes at this timestamp
   */
  async getSnapshotAtTime(timestamp, assetSymbol = 'BTCUSDT') {
    try {
      const GEXSnapshot = this.db.getModel('GEXSnapshot');
      
      const snapshot = await GEXSnapshot.findAll({
        where: {
          timestamp: timestamp,
          assetSymbol: assetSymbol
        },
        order: [['strike', 'ASC']],
        raw: true
      });
      
      return snapshot;
    } catch (error) {
      this.logger.error('Error getting snapshot at time', error);
      throw error;
    }
  }

  /**
   * Cleanup old snapshots
   * 
   * @param {number} olderThan - Delete snapshots older than this timestamp (ms)
   * @returns {Promise<number>} - Number of deleted records
   */
  async cleanup(olderThan) {
    try {
      const GEXSnapshot = this.db.getModel('GEXSnapshot');
      
      const deleted = await GEXSnapshot.destroy({
        where: {
          timestamp: {
            [this.db.sequelize.Sequelize.Op.lt]: olderThan
          }
        }
      });
      
      if (deleted > 0) {
        this.logger.info(`Cleaned up ${deleted} old GEX snapshots`);
      }
      
      return deleted;
    } catch (error) {
      this.logger.error('Error cleaning up snapshots', error);
      throw error;
    }
  }

  /**
   * Set snapshot interval (throttle)
   * 
   * @param {number} intervalMs - Interval in milliseconds
   */
  setSnapshotInterval(intervalMs) {
    this.snapshotInterval = intervalMs;
    this.logger.info(`Snapshot interval set to ${intervalMs}ms`);
  }

  /**
   * Get statistics
   * 
   * @returns {Promise<Object>} - { totalSnapshots, oldestTimestamp, newestTimestamp, uniqueStrikes }
   */
  async getStats() {
    try {
      const GEXSnapshot = this.db.getModel('GEXSnapshot');
      
      const [stats] = await this.db.query(`
        SELECT 
          COUNT(*) as totalSnapshots,
          MIN(timestamp) as oldestTimestamp,
          MAX(timestamp) as newestTimestamp,
          COUNT(DISTINCT strike) as uniqueStrikes,
          COUNT(DISTINCT timestamp) as uniqueTimestamps
        FROM gex_snapshots
      `);
      
      return stats[0];
    } catch (error) {
      this.logger.error('Error getting stats', error);
      throw error;
    }
  }
}

module.exports = GEXSnapshotService;
