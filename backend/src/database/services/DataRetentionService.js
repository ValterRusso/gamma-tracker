const Logger = require('../../utils/logger');
const { Op } = require('sequelize');

class DataRetentionService {
  constructor(database) {
    this.db = database;
    this.logger = new Logger('DataRetention');
    
    // Retention policies (in days)
    this.policies = {
      detailedSnapshots: 7,      // Tier 1: High frequency data
      aggregatedSnapshots: 30,   // Tier 2: Aggregated data (future)
      dailySnapshots: 365,       // Tier 3: Daily summaries (future)
      criticalAnomalies: null,   // Permanent
      highAnomalies: null,       // Permanent
      mediumAnomalies: 90,
      lowAnomalies: 90
    };
    
    this.cleanupInterval = null;
  }
  
  startAutomatedCleanup(intervalHours = 24) {
    this.logger.info(`Iniciando limpeza automática a cada ${intervalHours}h`);
    
    // Run immediately on start
    this.runCleanup();
    
    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, intervalHours * 60 * 60 * 1000);
  }
  
  stopAutomatedCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.info('Limpeza automática interrompida');
    }
  }
  
  async runCleanup() {
    try {
      this.logger.info('Iniciando limpeza de dados antigos...');
      
      const results = {
        snapshots: 0,
        options: 0,
        anomalies: 0
      };
      
      // 1. Clean old snapshots (CASCADE will delete related options)
      results.snapshots = await this.cleanOldSnapshots();
      
      // 2. Clean old anomalies (by severity)
      results.anomalies = await this.cleanOldAnomalies();
      
      // 3. Log statistics
      await this.logRetentionStats();
      
      this.logger.info(`Limpeza concluída: ${results.snapshots} snapshots, ${results.anomalies} anomalias removidos`);
      
      return results;
    } catch (error) {
      this.logger.error('Erro durante limpeza de dados', error);
      throw error;
    }
  }
  
  async cleanOldSnapshots() {
    const MarketSnapshot = this.db.getModel('MarketSnapshot');
    
    // Calculate cutoff date (7 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.policies.detailedSnapshots);
    
    const deleted = await MarketSnapshot.destroy({
      where: {
        created_at: {
          [Op.lt]: cutoffDate
        }
      }
    });
    
    this.logger.info(`${deleted} snapshots antigos removidos (> ${this.policies.detailedSnapshots} dias)`);
    
    return deleted;
  }
  
  async cleanOldAnomalies() {
    const AnomaliesLog = this.db.getModel('AnomaliesLog');
    
    // Calculate cutoff date (90 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.policies.mediumAnomalies);
    
    // Delete only MEDIUM and LOW severity (CRITICAL and HIGH are permanent)
    const deleted = await AnomaliesLog.destroy({
      where: {
        severity: {
          [Op.in]: ['MEDIUM', 'LOW']
        },
        created_at: {
          [Op.lt]: cutoffDate
        }
      }
    });
    
    this.logger.info(`${deleted} anomalias antigas removidas (MEDIUM/LOW > ${this.policies.mediumAnomalies} dias)`);
    
    return deleted;
  }
  
  async logRetentionStats() {
    try {
      const stats = await this.getRetentionStats();
      
      this.logger.info('=== Estatísticas de Retenção ===');
      this.logger.info(`Snapshots: ${stats.snapshots.total} registros, ${stats.snapshots.retentionDays} dias`);
      this.logger.info(`Options: ${stats.options.total} registros, ${stats.options.retentionDays} dias`);
      this.logger.info(`Anomalias: ${stats.anomalies.total} registros (${stats.anomalies.bySeverity.CRITICAL} CRITICAL, ${stats.anomalies.bySeverity.HIGH} HIGH, ${stats.anomalies.bySeverity.MEDIUM} MEDIUM, ${stats.anomalies.bySeverity.LOW} LOW)`);
      this.logger.info('================================');
    } catch (error) {
      this.logger.error('Erro ao obter estatísticas de retenção', error);
    }
  }
  
  async getRetentionStats() {
    const MarketSnapshot = this.db.getModel('MarketSnapshot');
    const OptionsHistory = this.db.getModel('OptionsHistory');
    const AnomaliesLog = this.db.getModel('AnomaliesLog');
    
    // Snapshots stats
    const snapshotsCount = await MarketSnapshot.count();
    const oldestSnapshot = await MarketSnapshot.findOne({
      order: [['created_at', 'ASC']],
      attributes: ['created_at']
    });
    
    const snapshotRetentionDays = oldestSnapshot 
      ? Math.floor((Date.now() - new Date(oldestSnapshot.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    // Options stats
    const optionsCount = await OptionsHistory.count();
    const oldestOption = await OptionsHistory.findOne({
      order: [['created_at', 'ASC']],
      attributes: ['created_at']
    });
    
    const optionRetentionDays = oldestOption
      ? Math.floor((Date.now() - new Date(oldestOption.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    // Anomalies stats
    const anomaliesCount = await AnomaliesLog.count();
    const anomaliesBySeverity = await AnomaliesLog.findAll({
      attributes: [
        'severity',
        [this.db.sequelize.fn('COUNT', this.db.sequelize.col('id')), 'count']
      ],
      group: ['severity'],
      raw: true
    });
    
    const severityCounts = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0
    };
    
    anomaliesBySeverity.forEach(row => {
      severityCounts[row.severity] = parseInt(row.count);
    });
    
    return {
      snapshots: {
        total: snapshotsCount,
        retentionDays: snapshotRetentionDays
      },
      options: {
        total: optionsCount,
        retentionDays: optionRetentionDays
      },
      anomalies: {
        total: anomaliesCount,
        bySeverity: severityCounts
      }
    };
  }
  
  // Manual cleanup methods
  async cleanAllData() {
    this.logger.warn('ATENÇÃO: Limpando TODOS os dados do banco!');
    
    const MarketSnapshot = this.db.getModel('MarketSnapshot');
    const AnomaliesLog = this.db.getModel('AnomaliesLog');
    
    await AnomaliesLog.destroy({ where: {}, truncate: true });
    await MarketSnapshot.destroy({ where: {}, truncate: true });
    // OptionsHistory will be cascade deleted
    
    this.logger.info('Todos os dados foram removidos');
  }
  
  async cleanDataOlderThan(days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const MarketSnapshot = this.db.getModel('MarketSnapshot');
    const deleted = await MarketSnapshot.destroy({
      where: {
        created_at: {
          [Op.lt]: cutoffDate
        }
      }
    });
    
    this.logger.info(`${deleted} snapshots removidos (> ${days} dias)`);
    return deleted;
  }
}

module.exports = DataRetentionService;


