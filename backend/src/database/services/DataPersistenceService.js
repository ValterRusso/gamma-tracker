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
          regime: metrics?.regime || null
        }, { transaction: t });
        
        // 2. Save options history
        if (options && options.length > 0) {
          await this.saveOptionsHistory(snapshot.id, options, t);
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
  
  async saveOptionsHistory(snapshotId, options, transaction) {
    const OptionsHistory = this.db.getModel('OptionsHistory');

    // DEBUG: Ver primeiro item
     this.logger.debug(`Tentando salvar ${options.length} options`);
    if (options.length > 0) {
      this.logger.debug('Primeira option:', JSON.stringify(options[0], null, 2));
      this.logger.debug('Campos disponíveis:', Object.keys(options[0]));
    }
    
    const records = options.map(opt => {

      const dte = opt.dte !== undefined
         ? opt.dte
         : Math.max(0, Math.ceil((opt.expiryDate - Date.now()) / (1000 * 60 * 60 * 24)));
         
      return {
        snapshot_id: snapshotId,
        asset_id: this.currentAssetId,
        symbol: opt.symbol,
        strike: opt.strike,
        expiryDate: opt.expiryDate,
        dte: dte,
        side: opt.side || opt.type, // 'side' or 'type' field
        markPrice: opt.markPrice,
        markIv: opt.markIV,
        underlyingPrice: opt.underlyingPrice,
        delta: opt.delta,
        gamma: opt.gamma,
        theta: opt.theta,
        vega: opt.vega,
        volume: opt.volume,
        openInterest: opt.openInterest,
        bidPrice: opt.bidPrice,
        askPrice: opt.askPrice
      };
    });
    
    // Bulk insert for performance
    await OptionsHistory.bulkCreate(records, { transaction });
    
    this.logger.debug(`${records.length} options salvos no histórico`);
  }
  
  async saveAnomalies(snapshotId, anomalies, transaction) {
    const AnomaliesLog = this.db.getModel('AnomaliesLog');
    
    const records = anomalies.map(a => ({
      snapshotId: snapshotId,
      assetId: this.currentAssetId,
      type: a.type,
      severity: a.severity,
      strike: a.strike,
      dte: a.dte,
      moneyness: a.moneyness,
      iv: a.iv,
      callIv: a.callIV,
      putIv: a.putIV,
      expectedIv: a.expectedIV,
      deviation: a.deviation,
      deviationPct: a.deviationPct,
      zScore: a.zScore,
      spread: a.spread,
      expectedSpread: a.expectedSpread,
      priceType: a.priceType,
      skewType: a.skewType,
      isWing: a.isWing || false,
      relevanceScore: a.relevanceScore,
      volume: a.volume,
      openInterest: a.openInterest
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