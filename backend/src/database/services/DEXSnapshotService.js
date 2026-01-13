const Logger = require('../../utils/logger');

/**
 * DEXSnapshotService
 * 
 * Calculates Delta Exposure (DEX) heatmaps from options_history data.
 * DEX = Delta × Open Interest × 100
 * 
 * Similar to GEX but uses delta instead of gamma for pressure analysis.
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 */
class DEXSnapshotService {
  constructor(database) {
    this.db = database;
    this.logger = new Logger('DEXSnapshotService');
  }

  /**
   * Get DEX heatmap data for time range
   * 
   * Calculates DEX from options_history:
   * DEX = delta × openInterest × 100 × (side === 'CALL' ? 1 : -1)
   * 
   * @param {number} startTime - Start timestamp (ms)
   * @param {number} endTime - End timestamp (ms)
   * @param {string} assetSymbol - Asset symbol (not used yet, for future multi-asset)
   * @returns {Promise<Array>} - Array of { timestamp, strike, totalDex, callDex, putDex, spotPrice }
   */
  async getHeatmapData(startTime, endTime, assetSymbol = 'BTCUSDT') {
    try {
      this.logger.debug(`Getting DEX heatmap data from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
      
      // Get all market snapshots in time range
      const MarketSnapshot = this.db.getModel('MarketSnapshot');
      const OptionsHistory = this.db.getModel('OptionsHistory');
      
      const snapshots = await MarketSnapshot.findAll({
        where: {
          timestamp: {
            [this.db.sequelize.Sequelize.Op.between]: [startTime, endTime]
          }
        },
        attributes: ['id', 'timestamp', 'spotPrice'],
        order: [['timestamp', 'ASC']],
        raw: true
      });
      
      if (snapshots.length === 0) {
        this.logger.warn('No snapshots found in time range');
        return [];
      }
      
      this.logger.debug(`Found ${snapshots.length} snapshots`);
      
      // Get all options for these snapshots
      const snapshotIds = snapshots.map(s => s.id);
      
      const options = await OptionsHistory.findAll({
        where: {
          snapshotId: {
            [this.db.sequelize.Sequelize.Op.in]: snapshotIds
          }
        },
        attributes: ['snapshotId', 'strike', 'side', 'delta', 'openInterest'],
        raw: true
      });
      
      this.logger.debug(`Found ${options.length} options records`);
      
      // Build snapshot ID to timestamp/spotPrice map
      const snapshotMap = {};
      for (const snap of snapshots) {
        snapshotMap[snap.id] = {
          timestamp: snap.timestamp,
          spotPrice: snap.spotPrice
        };
      }
      
      // Calculate DEX by (timestamp, strike)
      const dexMap = {};
      
      for (const opt of options) {
        const snapshotId = opt.snapshotId;
        const strike = parseFloat(opt.strike);
        const delta = parseFloat(opt.delta) || 0;
        const oi = parseFloat(opt.openInterest) || 0;
        const side = opt.side;
        
        // DEX = delta × OI × 100
        // Calls are positive, puts are negative
        const dex = delta * oi * 100;
        
        const snapInfo = snapshotMap[snapshotId];
        if (!snapInfo) continue;
        
        const key = `${snapInfo.timestamp}_${strike}`;
        
        if (!dexMap[key]) {
          dexMap[key] = {
            timestamp: snapInfo.timestamp,
            strike: strike,
            totalDex: 0,
            callDex: 0,
            putDex: 0,
            spotPrice: parseFloat(snapInfo.spotPrice)
          };
        }
        
        if (side === 'CALL') {
          dexMap[key].callDex += dex;
          dexMap[key].totalDex += dex;
        } else if (side === 'PUT') {
          dexMap[key].putDex += dex;
          dexMap[key].totalDex += dex;
        }
      }
      
      // Convert map to array
      const result = Object.values(dexMap);
      
      this.logger.debug(`Calculated DEX for ${result.length} data points`);
      
      return result;
    } catch (error) {
      this.logger.error('Error getting DEX heatmap data', error);
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
      const MarketSnapshot = this.db.getModel('MarketSnapshot');
      
      const snapshots = await MarketSnapshot.findAll({
        where: {
          timestamp: {
            [this.db.sequelize.Sequelize.Op.between]: [startTime, endTime]
          }
        },
        attributes: ['timestamp'],
        order: [['timestamp', 'ASC']],
        raw: true
      });
      
      return snapshots.map(s => s.timestamp);
    } catch (error) {
      this.logger.error('Error getting timestamps', error);
      throw error;
    }
  }

  /**
   * Get DEX snapshot at specific timestamp
   * 
   * @param {number} timestamp - Timestamp (ms)
   * @param {string} assetSymbol - Asset symbol
   * @returns {Promise<Array>} - All strikes at this timestamp
   */
  async getSnapshotAtTime(timestamp, assetSymbol = 'BTCUSDT') {
    try {
      const MarketSnapshot = this.db.getModel('MarketSnapshot');
      const OptionsHistory = this.db.getModel('OptionsHistory');
      
      // Find snapshot at this timestamp
      const snapshot = await MarketSnapshot.findOne({
        where: { timestamp: timestamp },
        attributes: ['id', 'timestamp', 'spotPrice'],
        raw: true
      });
      
      if (!snapshot) {
        return [];
      }
      
      // Get all options for this snapshot
      const options = await OptionsHistory.findAll({
        where: { snapshotId: snapshot.id },
        attributes: ['strike', 'side', 'delta', 'openInterest'],
        raw: true
      });
      
      // Calculate DEX by strike
      const dexByStrike = {};
      
      for (const opt of options) {
        const strike = parseFloat(opt.strike);
        const delta = parseFloat(opt.delta) || 0;
        const oi = parseFloat(opt.openInterest) || 0;
        const side = opt.side;
        const dex = delta * oi * 100;
        
        if (!dexByStrike[strike]) {
          dexByStrike[strike] = {
            timestamp: snapshot.timestamp,
            strike: strike,
            totalDex: 0,
            callDex: 0,
            putDex: 0,
            spotPrice: parseFloat(snapshot.spotPrice)
          };
        }
        
        if (side === 'CALL') {
          dexByStrike[strike].callDex += dex;
          dexByStrike[strike].totalDex += dex;
        } else if (side === 'PUT') {
          dexByStrike[strike].putDex += dex;
          dexByStrike[strike].totalDex += dex;
        }
      }
      
      return Object.values(dexByStrike);
    } catch (error) {
      this.logger.error('Error getting DEX snapshot at time', error);
      throw error;
    }
  }

  /**
   * Get DEX history for specific strike
   * 
   * @param {number} strike - Strike price
   * @param {number} startTime - Start timestamp (ms)
   * @param {number} endTime - End timestamp (ms)
   * @param {string} assetSymbol - Asset symbol
   * @returns {Promise<Array>} - Time series for this strike
   */
  async getStrikeHistory(strike, startTime, endTime, assetSymbol = 'BTCUSDT') {
    try {
      const MarketSnapshot = this.db.getModel('MarketSnapshot');
      const OptionsHistory = this.db.getModel('OptionsHistory');
      
      // Get snapshots in range
      const snapshots = await MarketSnapshot.findAll({
        where: {
          timestamp: {
            [this.db.sequelize.Sequelize.Op.between]: [startTime, endTime]
          }
        },
        attributes: ['id', 'timestamp', 'spotPrice'],
        order: [['timestamp', 'ASC']],
        raw: true
      });
      
      const snapshotIds = snapshots.map(s => s.id);
      const snapshotMap = {};
      for (const snap of snapshots) {
        snapshotMap[snap.id] = {
          timestamp: snap.timestamp,
          spotPrice: snap.spotPrice
        };
      }
      
      // Get options for this strike
      const options = await OptionsHistory.findAll({
        where: {
          snapshotId: {
            [this.db.sequelize.Sequelize.Op.in]: snapshotIds
          },
          strike: strike
        },
        attributes: ['snapshotId', 'side', 'delta', 'openInterest'],
        raw: true
      });
      
      // Group by snapshot
      const dexBySnapshot = {};
      
      for (const opt of options) {
        const snapshotId = opt.snapshotId;
        const delta = parseFloat(opt.delta) || 0;
        const oi = parseFloat(opt.openInterest) || 0;
        const side = opt.side;
        const dex = delta * oi * 100;
        
        const snapInfo = snapshotMap[snapshotId];
        if (!snapInfo) continue;
        
        if (!dexBySnapshot[snapshotId]) {
          dexBySnapshot[snapshotId] = {
            timestamp: snapInfo.timestamp,
            strike: strike,
            totalDex: 0,
            callDex: 0,
            putDex: 0,
            spotPrice: parseFloat(snapInfo.spotPrice)
          };
        }
        
        if (side === 'CALL') {
          dexBySnapshot[snapshotId].callDex += dex;
          dexBySnapshot[snapshotId].totalDex += dex;
        } else if (side === 'PUT') {
          dexBySnapshot[snapshotId].putDex += dex;
          dexBySnapshot[snapshotId].totalDex += dex;
        }
      }
      
      return Object.values(dexBySnapshot);
    } catch (error) {
      this.logger.error('Error getting DEX strike history', error);
      throw error;
    }
  }
}

module.exports = DEXSnapshotService;
