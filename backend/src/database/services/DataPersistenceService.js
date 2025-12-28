const Logger = require('../../utils/logger');

class DataPersistenceService {
  constructor(database) {
    this.db = database;
    this.logger = new Logger('DataPersistence');
    this.currentAssetId = null;
  }
  
  async initialize(assetSymbol = 'BTC') {
    try {
      // Get or create asset
      const Asset = this.db.getModel('Asset');
      let asset = await Asset.findOne({ where: { symbol: assetSymbol } });
      
      if (!asset) {
        asset = await Asset.create({
          symbol: assetSymbol,
          name: this.getAssetName(assetSymbol),
          isActive: true
        });
        this.logger.info(`Asset criado: ${assetSymbol}`);
      }
      
      this.currentAssetId = asset.id;
      this.logger.info(`DataPersistence inicializado para ${assetSymbol} (ID: ${this.currentAssetId})`);
      
      return true;
    } catch (error) {
      this.logger.error('Erro ao inicializar DataPersistence', error);
      throw error;
    }
  }
  
  getAssetName(symbol) {
    const names = {
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'SOL': 'Solana'
    };
    return names[symbol] || symbol;
  }
  
  async saveSnapshot(data) {
    try {
      const { options, spotPrice, metrics, anomalies } = data;
      
      if (!this.currentAssetId) {
        throw new Error('DataPersistence não inicializado. Chame initialize() primeiro.');
      }
      
      // Use transaction for atomicity
      const snapshot = await this.db.transaction(async (t) => {
        // 1. Create market snapshot
        const MarketSnapshot = this.db.getModel('MarketSnapshot');
        const snapshot = await MarketSnapshot.create({
          assetId: this.currentAssetId,
          timestamp: Date.now(),
          spotPrice: spotPrice,
          totalOptions: options.length,
          totalVolume: this.calculateTotalVolume(options),
          totalOpenInterest: this.calculateTotalOI(options),
          totalGex: metrics?.totalGEX?.total || 0,
          maxGexStrike: metrics?.maxGEXStrike || null,
          regime: metrics?.regime || 'NEUTRAL' // Default to NEUTRAL if not provided
        }, { transaction: t });
        
        // 2. Save options history
        if (options && options.length > 0) {
          await this.saveOptionsHistory(snapshot.id, options, spotPrice, t);
        }
        
        // 3. Save anomalies
        if (anomalies && anomalies.length > 0) {
          await this.saveAnomalies(snapshot.id, anomalies, t);
        }
        
        return snapshot;
      });
      
      this.logger.info(`Snapshot salvo: ID ${snapshot.id}, ${options.length} options, ${anomalies?.length || 0} anomalias`);
      
      return snapshot;
    } catch (error) {
      this.logger.error('Erro ao salvar snapshot', error);
      throw error;
    }
  }
  
  async saveOptionsHistory(snapshotId, options, spotPrice, transaction) {
    const OptionsHistory = this.db.getModel('OptionsHistory');
    
    const records = options.map(opt => {
      // Calculate DTE if not provided
      const dte = opt.dte !== undefined
         ? opt.dte
         : Math.max(0, Math.ceil((opt.expiryDate - Date.now()) / (1000 * 60 * 60 * 24)));
      
      // IMPORTANT: Use camelCase for fields that have field: 'snake_case' in the model
      // Sequelize will automatically map camelCase -> snake_case based on model definition
      return {
        snapshotId: snapshotId,           // Maps to snapshot_id
        assetId: this.currentAssetId,     // Maps to asset_id
        symbol: opt.symbol,
        strike: opt.strike,
        expiryDate: opt.expiryDate,       // Maps to expiry_date
        dte: dte,
        side: opt.side || opt.type,
        markPrice: opt.markPrice,         // Maps to mark_price
        markIv: opt.markIV,               // Maps to mark_iv
        underlyingPrice: spotPrice, // Maps to underlying_price
        delta: opt.delta,
        gamma: opt.gamma,
        theta: opt.theta,
        vega: opt.vega,
        volume: opt.volume || 0,          // Default to 0 if not provided
        openInterest: opt.openInterest,   // Maps to open_interest
        bidPrice: opt.bidPrice || null,   // Maps to bid_price
        askPrice: opt.askPrice || null    // Maps to ask_price
      };
    });
    
    // Bulk insert for performance
    await OptionsHistory.bulkCreate(records, { transaction });
    
    this.logger.debug(`${records.length} options salvos no histórico`);
  }
  
  async saveAnomalies(snapshotId, anomalies, transaction) {
    const AnomaliesLog = this.db.getModel('AnomaliesLog');
    
    const records = anomalies.map(a => ({
      snapshotId: snapshotId,           // Maps to snapshot_id
      assetId: this.currentAssetId,     // Maps to asset_id
      anomalyType: a.type || a.anomalyType, // Maps to anomaly_type
      severity: a.severity || 'MEDIUM',
      strike: a.strike || null,
      dte: a.dte || null,
      moneyness: a.moneyness || null,
      iv: a.iv || null,
      callIv: a.callIV || null,         // Maps to call_iv
      putIv: a.putIV || null,           // Maps to put_iv
      expectedIv: a.expectedIV || null, // Maps to expected_iv
      deviation: a.deviation || null,
      deviationPct: a.deviationPct || null, // Maps to deviation_pct
      zScore: a.zScore || null,         // Maps to z_score
      spread: a.spread || null,
      expectedSpread: a.expectedSpread || null, // Maps to expected_spread
      priceType: a.priceType || null,   // Maps to price_type
      skewType: a.skewType || null,     // Maps to skew_type
      isWing: a.isWing || false,        // Maps to is_wing
      relevanceScore: a.relevanceScore || null, // Maps to relevance_score
      volume: a.volume || null,
      openInterest: a.openInterest || null // Maps to open_interest
    }));
    
    await AnomaliesLog.bulkCreate(records, { transaction });
    
    this.logger.debug(`${records.length} anomalias salvas no log`);
  }
  
  calculateTotalVolume(options) {
    return options.reduce((sum, opt) => sum + (parseFloat(opt.volume) || 0), 0);
  }
  
  calculateTotalOI(options) {
    return options.reduce((sum, opt) => sum + (parseFloat(opt.openInterest) || 0), 0);
  }
  
  // Query methods
  async getRecentSnapshots(limit = 10) {
    const MarketSnapshot = this.db.getModel('MarketSnapshot');
    return await MarketSnapshot.findAll({
      where: { assetId: this.currentAssetId },
      order: [['timestamp', 'DESC']],
      limit: limit
    });
  }
  
  async getSnapshotById(snapshotId) {
    const MarketSnapshot = this.db.getModel('MarketSnapshot');
    return await MarketSnapshot.findByPk(snapshotId, {
      include: [
        { model: this.db.getModel('OptionsHistory'), as: 'options' },
        { model: this.db.getModel('AnomaliesLog'), as: 'anomalies' }
      ]
    });
  }
  
  async getAnomaliesByTimeRange(startTime, endTime, severity = null) {
    const AnomaliesLog = this.db.getModel('AnomaliesLog');
    const MarketSnapshot = this.db.getModel('MarketSnapshot');
    
    const where = {
      assetId: this.currentAssetId
    };
    
    if (severity) {
      where.severity = severity;
    }
    
    return await AnomaliesLog.findAll({
      where: where,
      include: [{
        model: MarketSnapshot,
        as: 'snapshot',
        where: {
          timestamp: {
            [this.db.sequelize.Sequelize.Op.between]: [startTime, endTime]
          }
        }
      }],
      order: [['created_at', 'DESC']]
    });
  }
}

module.exports = DataPersistenceService;