const Logger = require('../../utils/logger');

/**
 * DataPersistenceService
 * Gerencia persistência de dados no banco MySQL
 */
class DataPersistenceService {
  constructor(database) {
    this.db = database;
    this.logger = new Logger('DataPersistence');
    this.currentAssetId = null;
  }

  /**
   * Inicializa o serviço e garante que o asset existe
   */
  async initialize(underlying = 'BTC') {
    try {
      const Asset = this.db.getModel('Asset');
      
      // Buscar ou criar asset
      let [asset, created] = await Asset.findOrCreate({
        where: { symbol: underlying },
        defaults: {
          symbol: underlying,
          name: this.getAssetName(underlying),
          type: 'CRYPTO'
        }
      });
      
      this.currentAssetId = asset.id;
      
      if (created) {
        this.logger.info(`Asset criado: ${underlying} (ID: ${asset.id})`);
      } else {
        this.logger.info(`Asset encontrado: ${underlying} (ID: ${asset.id})`);
      }
      
    } catch (error) {
      this.logger.error('Erro ao inicializar DataPersistence', error);
      throw error;
    }
  }

  getAssetName(symbol) {
    const names = {
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum'
    };
    return names[symbol] || symbol;
  }
  
  async saveSnapshot(data) {
    try {
      const { options, spotPrice, metrics, anomalies, maxPain, sentiment } = data;
      
      if (!this.currentAssetId) {
        throw new Error('DataPersistence não inicializado. Chame initialize() primeiro.');
      }
      
      // Use transaction for atomicity
      const snapshot = await this.db.transaction(async (t) => {
        // 1. Create market snapshot
        const MarketSnapshot = this.db.getModel('MarketSnapshot');
        
        // Prepare snapshot data
        const snapshotData = {
          assetId: this.currentAssetId,
          timestamp: Date.now(),
          spotPrice: spotPrice,
          totalOptions: options.length,
          totalVolume: this.calculateTotalVolume(options),
          totalOpenInterest: this.calculateTotalOI(options),
          totalGex: metrics?.totalGEX?.total || 0,
          maxGexStrike: metrics?.maxGEXStrike || null,
          regime: metrics?.regime || null
        };
        
        // Add Max Pain data if available
        if (maxPain) {
          snapshotData.maxPainStrike = maxPain.maxPainStrike || null;
          snapshotData.maxPainOi = maxPain.maxPainOI || null;
          snapshotData.maxPainCallOi = maxPain.maxPainCallOI || null;
          snapshotData.maxPainPutOi = maxPain.maxPainPutOI || null;
          
          if (maxPain.analysis) {
            snapshotData.maxPainDistance = maxPain.analysis.distance || null;
            snapshotData.maxPainDistancePct = maxPain.analysis.distancePct || null;
          }
        }
        
        // Add Sentiment data if available
        if (sentiment) {
          snapshotData.putCallOiRatio = sentiment.putCallOIRatio || null;
          snapshotData.putCallVolRatio = sentiment.putCallVolRatio || null;
          snapshotData.sentiment = sentiment.sentiment || null;
          snapshotData.totalCallOi = sentiment.totalCallOI || null;
          snapshotData.totalPutOi = sentiment.totalPutOI || null;
          snapshotData.totalCallVolume = sentiment.totalCallVolume || null;
          snapshotData.totalPutVolume = sentiment.totalPutVolume || null;
        }
        
        const snapshot = await MarketSnapshot.create(snapshotData, { transaction: t });
        
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
      // Garantir que expiryDate é um timestamp válido
      let expiryTimestamp = opt.expiryDate;
      
      // Se expiryDate for string, converter para timestamp
      if (typeof expiryTimestamp === 'string') {
        expiryTimestamp = new Date(expiryTimestamp).getTime();
      }
      
      // Se ainda não for número, tentar parsear
      if (typeof expiryTimestamp !== 'number' || isNaN(expiryTimestamp)) {
        this.logger.warn(`Option ${opt.symbol} tem expiryDate inválida: ${opt.expiryDate}`);
        expiryTimestamp = null;
      }
      
      // Calcular DTE (Days to Expiration)
      let dte = null;
      if (expiryTimestamp) {
        const now = Date.now();
        const diffMs = expiryTimestamp - now;
        dte = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }
      
      return {
        snapshotId: snapshotId,
        assetId: this.currentAssetId,
        symbol: opt.symbol,
        type: opt.type,
        side: opt.side,
        strike: opt.strike,
        expiryDate: expiryTimestamp,
        dte: dte,
        markPrice: opt.markPrice,
        bidPrice: opt.bidPrice,
        askPrice: opt.askPrice,
        lastPrice: opt.lastPrice,
        volume: opt.volume,
        openInterest: opt.openInterest,
        delta: opt.delta,
        gamma: opt.gamma,
        vega: opt.vega,
        theta: opt.theta,
        markIv: opt.markIV
      };
    });
    
    // Bulk insert
    await OptionsHistory.bulkCreate(records, { 
      transaction,
      validate: true
    });
    
    this.logger.debug(`${records.length} options salvas no histórico`);
  }
  
  async saveAnomalies(snapshotId, anomalies, transaction) {
    const AnomaliesLog = this.db.getModel('AnomaliesLog');
    
    const records = anomalies.map(anomaly => ({
      snapshotId: snapshotId,
      assetId: this.currentAssetId,
      anomalyType: anomaly.type,
      severity: anomaly.severity,
      strike: anomaly.strike,
      dte: anomaly.dte,
      moneyness: anomaly.moneyness,
      iv: anomaly.iv || null,
      callIv: anomaly.callIV || null,
      putIv: anomaly.putIV || null,
      expectedIv: anomaly.expectedIV || null,
      deviation: anomaly.deviation || null,
      deviationPct: anomaly.deviationPct || null,
      zScore: anomaly.zScore,
      spread: anomaly.spread || null,
      expectedSpread: anomaly.expectedSpread || null,
      priceType: anomaly.priceType || null,
      skewType: anomaly.skewType || null,
      isWing: anomaly.isWing || false,
      relevanceScore: anomaly.relevanceScore || null,
      volume: anomaly.volume || 0,
      openInterest: anomaly.openInterest || 0,
      // NEW FIELDS
      oiVolumeRatio: anomaly.oiVolumeRatio || null,
      spreadPct: anomaly.spreadPct || null,
      bidPrice: anomaly.bidPrice || null,
      askPrice: anomaly.askPrice || null
    }));
    
    await AnomaliesLog.bulkCreate(records, { 
      transaction,
      validate: true
    });
    
    this.logger.debug(`${records.length} anomalias salvas`);
  }
  
  calculateTotalVolume(options) {
    return options.reduce((sum, opt) => sum + (opt.volume || 0), 0);
  }
  
  calculateTotalOI(options) {
    return options.reduce((sum, opt) => sum + (opt.openInterest || 0), 0);
  }
  
  /**
   * Busca snapshots recentes
   */
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
      include: ['options', 'anomalies']
    });
  }
  
  /**
   * Busca anomalias recentes
   */
  async getRecentAnomalies(limit = 50) {
    const AnomaliesLog = this.db.getModel('AnomaliesLog');
    const MarketSnapshot = this.db.getModel('MarketSnapshot');
    
    return await AnomaliesLog.findAll({
      where: { assetId: this.currentAssetId },
      include: [{
        model: MarketSnapshot,
        as: 'snapshot',
        attributes: ['timestamp', 'spotPrice']
      }],
      order: [['created_at', 'DESC']],
      limit: limit
    });
  }
}

module.exports = DataPersistenceService;
