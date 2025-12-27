const { Sequelize } = require('sequelize');
const Logger = require('../../src/utils/logger');

class Database {
  constructor(config = {}) {
    this.logger = new Logger('Database');
    
    // Database configuration from environment or defaults
    this.config = {
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || process.env.DB_PORT || 3306,
      database: config.database || process.env.DB_NAME || 'gamma_tracker',
      username: config.username || process.env.DB_USER || 'root',
      password: config.password || process.env.DB_PASSWORD || '',
      dialect: 'mysql',
      logging: (msg) => this.logger.debug(msg),
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      define: {
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
      }
    };
    
    this.sequelize = null;
    this.models = {};
  }
  
  async connect() {
    try {
      this.logger.info(`Conectando ao MySQL: ${this.config.host}:${this.config.port}/${this.config.database}`);
      
      this.sequelize = new Sequelize(
        this.config.database,
        this.config.username,
        this.config.password,
        this.config
      );
      
      // Test connection
      await this.sequelize.authenticate();
      this.logger.info('✓ Conexão com MySQL estabelecida');
      
      // Initialize models
      this.initModels();
      
      // Sync models (development only - use migrations in production)
      if (process.env.NODE_ENV !== 'production') {
        await this.sequelize.sync({ alter: false });
        this.logger.info('✓ Models sincronizados com o banco');
      }
      
      return true;
    } catch (error) {
      this.logger.error('Erro ao conectar ao MySQL', error);
      throw error;
    }
  }
  
  initModels() {
    // Import models
    const Asset = require('./models/Asset')(this.sequelize);
    const MarketSnapshot = require('./models/MarketSnapshot')(this.sequelize);
    const OptionsHistory = require('./models/OptionsHistory')(this.sequelize);
    const AnomaliesLog = require('./models/AnomaliesLog')(this.sequelize);
    
    this.models = {
      Asset,
      MarketSnapshot,
      OptionsHistory,
      AnomaliesLog
    };
    
    // Setup associations
    Object.values(this.models).forEach(model => {
      if (model.associate) {
        model.associate(this.models);
      }
    });
    
    this.logger.info('✓ Models carregados e associações configuradas');
  }
  
  async disconnect() {
    if (this.sequelize) {
      await this.sequelize.close();
      this.logger.info('✓ Conexão com MySQL fechada');
    }
  }
  
  // Helper methods
  getModel(name) {
    return this.models[name];
  }
  
  async transaction(callback) {
    return await this.sequelize.transaction(callback);
  }
  
  async query(sql, options = {}) {
    return await this.sequelize.query(sql, {
      type: Sequelize.QueryTypes.SELECT,
      ...options
    });
  }
}

module.exports = Database;