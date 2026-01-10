/**
 * ============================================================================
 * GAMMA TRACKER - MAIN INDEX
 * ============================================================================
 * 
 * Sistema completo de análise de opções com Half Pipe Model
 * Combina persistência robusta com arquitetura modular
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 3.0 - FINAL
 * ============================================================================
 */

require('dotenv').config();

// Core
const Logger = require('./utils/logger');

// Database & Persistence
const Database = require('./database/Database');
const DataPersistenceService = require('./database/services/DataPersistenceService');
const DataRetentionService = require('./database/services/DataRetentionService');

// Data Collection
const DataCollector = require('./collectors/DataCollector');

// Calculators
const GEXCalculator = require('./calculators/GEXCalculator');
const RegimeAnalyzer = require('./calculators/RegimeAnalyzer');
const MaxPainCalculator = require('./calculators/MaxPainCalculator');
const SentimentAnalyzer = require('./calculators/SentimentAnalyzer');
const VolSurfaceCalculator = require('./calculators/VolatilitySurfaceCalculator');
const AnomalyDetector = require('./calculators/VolatilityAnomalyDetector');

// Entropy & Market Analysis V2
const EntropyCalculatorV2 = require('./calculators/EntropyCalculatorV2');
const RSICalculatorV2 = require('./calculators/RSICalculatorV2');
const CombinedMarketAnalyzer = require('./calculators/CombinedMarketAnalyzer');

// Strategy Recommendation
const MarketStateAnalyzer = require('./recommender/MarketStateAnalyzer');
const StrategyRecommender = require('./recommender/StrategyRecommender');
const { STRATEGIES } = require('./recommender/strategies');

// IV Comparison (Binance vs Deribit)
const BinanceAdapter = require('./integrations/BinanceAdapter');
const DeribitAPI = require('./integrations/DeribitAPI');
const IVComparator = require('./calculators/IVComparator');

// API Server
const APIServer = require('./api/server');

class GammaTracker {
  constructor(config = {}) {
    this.logger = new Logger('GammaTracker');
    
    // Configuration
    this.config = {
      underlying: config.underlying || process.env.DEFAULT_UNDERLYING || 'BTC',
      apiPort: config.apiPort || process.env.API_PORT || 3300,
      spotPrice: config.spotPrice || 95000, // Preço inicial estimado
      
      // Persistence
      enablePersistence: config.enablePersistence !== false, // Default: true
      persistenceInterval: config.persistenceInterval || 10 * 60 * 1000 // 10 minutes
    };
    
    // Core Components
    this.dataCollector = null;
    this.gexCalculator = null;
    this.regimeAnalyzer = null;
    this.apiServer = null;
    
    // Database & Persistence
    this.database = null;
    this.persistence = null;
    this.retention = null;
    this.persistenceTimer = null;
    
    // Calculators
    this.maxPainCalculator = null;
    this.sentimentAnalyzer = null;
    this.volSurfaceCalculator = null;
    this.anomalyDetector = null;
    
    // Entropy & Market Analysis
    this.entropyCalc = null;
    this.rsiCalc = null;
    this.marketAnalyzer = null;
    
    // Strategy Recommendation
    this.marketStateAnalyzer = null;
    this.strategyRecommender = null;
    this.strategies = null;
    
    // IV Comparison
    this.binanceAdapter = null;
    this.deribitAPI = null;
    this.ivComparator = null;
  }

  /**
   * Initialize all components
   * SEQUÊNCIA CORRETA: Database → Calculators → DataCollector → Persistence → API
   */
  async initialize() {
    this.logger.info('Inicializando Gamma Tracker...');
    this.logger.info(`Underlying: ${this.config.underlying}`);
    
    try {
      // ========================================
      // 1. DATABASE (PRIMEIRO!)
      // ========================================
      if (this.config.enablePersistence) {
        await this.initializeDatabase();
      } else {
        this.logger.warn('⚠️  Persistência desabilitada');
      }

      // ========================================
      // 2. CALCULATORS
      // ========================================
      this.logger.info('🧮 Inicializando calculadoras...');
      
      // GEX & Regime
      this.gexCalculator = new GEXCalculator(this.config.spotPrice);
      this.regimeAnalyzer = new RegimeAnalyzer();
      
      // Volatility
      this.volSurfaceCalculator = new VolSurfaceCalculator();
      this.anomalyDetector = new AnomalyDetector(this.logger);
      
      // Sentiment
      this.maxPainCalculator = new MaxPainCalculator();
      this.sentimentAnalyzer = new SentimentAnalyzer();
      
      // Entropy V2
      this.entropyCalc = new EntropyCalculatorV2(this.logger);
      this.rsiCalc = new RSICalculatorV2(this.logger);
      
      // 🆕 Inicializar RSI Calculator com dados da Binance
      this.logger.info('📊 Inicializando RSI Calculator...');
      await this.rsiCalc.initialize();
      this.logger.success('✓ RSI Calculator inicializado com dados históricos');
      
      this.marketAnalyzer = new CombinedMarketAnalyzer(
        this.entropyCalc,
        this.rsiCalc,
        this.logger
      );
      
      this.logger.success('✓ Calculadoras inicializadas');

      // ========================================
      // 3. DATA COLLECTOR
      // ========================================
      this.logger.info('📡 Inicializando data collector...');
      
      this.dataCollector = new DataCollector({
        underlying: this.config.underlying
      });
      
      // Event listeners
      this.setupEventListeners();
      
      // START data collector (cria liquidationTracker, escapeTypeDetector, etc)
      await this.dataCollector.start();
      
      this.logger.success('✓ Data collector iniciado');

      // ========================================
      // 4. IV COMPARISON
      // ========================================
      this.logger.info('📊 Inicializando IV comparison...');
      
      try {
        this.binanceAdapter = new BinanceAdapter(this.dataCollector, this.logger);
        this.deribitAPI = new DeribitAPI(this.logger);
        this.ivComparator = new IVComparator(
          this.binanceAdapter,
          this.deribitAPI,
          this.logger
        );
        this.logger.success('✓ IV Comparison inicializado');
      } catch (error) {
        this.logger.warn('⚠️  IV Comparison não disponível:', error.message);
      
        this.binanceAdapter = null;
        this.deribitAPI = null;
        this.ivComparator = null
      }

      

      // ========================================
      // 5. STRATEGY RECOMMENDATION
      // ========================================
      this.logger.info('🎯 Inicializando strategy recommender...');
      
      try {
        this.marketStateAnalyzer = MarketStateAnalyzer;
        this.strategyRecommender = StrategyRecommender;
        this.strategies = STRATEGIES;
        this.logger.success('✓ Strategy recommender inicializado');
      } catch (error) {
        this.logger.warn('⚠️  Strategy recommender não disponível:', error.message);
        // Fallback
        this.marketStateAnalyzer = { analyze: () => ({ regime: 'UNKNOWN' }) };
        this.strategyRecommender = { recommend: () => [] };
        this.strategies = [];
      }      
    

      // ========================================
      // 6. PERSISTENCE LOOP (DEPOIS do start!)
      // ========================================
      if (this.config.enablePersistence && this.persistence) {
        this.startPersistenceLoop();
      }

      // ========================================
      // 7. API SERVER (POR ÚLTIMO!)
      // ========================================
      this.logger.info('🌐 Inicializando API server...');
      
      this.apiServer = new APIServer({
        // Core
        dataCollector: this.dataCollector,
        gexCalculator: this.gexCalculator,
        regimeAnalyzer: this.regimeAnalyzer,
        database: this.database,
        logger: this.logger,
        
        // Calculators
        volSurfaceCalculator: this.volSurfaceCalculator,
        anomalyDetector: this.anomalyDetector,
        maxPainCalculator: this.maxPainCalculator,
        sentimentAnalyzer: this.sentimentAnalyzer,
        
        // Entropy & Market Analysis V2
        entropyCalc: this.entropyCalc,
        rsiCalc: this.rsiCalc,
        marketAnalyzer: this.marketAnalyzer,
        orderbook: this.dataCollector.orderBookAnalyzer,
        
        // Strategy Recommendation
        marketStateAnalyzer: this.marketStateAnalyzer,
        strategyRecommender: this.strategyRecommender,
        strategies: this.strategies,
        
        // Liquidations (criados no dataCollector.start())
        liquidationTracker: this.dataCollector.liquidationTracker,
        
        // Escape Detection (criados no dataCollector.start())
        escapeTypeDetector: this.dataCollector.escapeTypeDetector,
        
        // IV Comparison
        binanceAdapter: this.binanceAdapter,
        deribitAPI: this.deribitAPI,
        ivComparator: this.ivComparator,
        
        // Config
        config: {
          port: this.config.apiPort,
          host: '0.0.0.0'
        }
      });
      
      await this.apiServer.start();
      
      this.logger.success('✅ Gamma Tracker inicializado com sucesso!');
      this.printStatus();
      
    } catch (error) {
      this.logger.error('❌ Erro ao inicializar Gamma Tracker', error);
      throw error;
    }
  }

  /**
   * Initialize database and persistence services
   */
  async initializeDatabase() {
    try {
      this.logger.info('📦 Inicializando Database...');
      
      // 1. Connect to MySQL
      this.database = new Database();
      await this.database.connect();
      
      // 2. Initialize persistence service
      this.persistence = new DataPersistenceService(this.database);
      await this.persistence.initialize(this.config.underlying);
      
      // 3. Initialize retention service (automated cleanup every 24h)
      this.retention = new DataRetentionService(this.database);
      this.retention.startAutomatedCleanup(24);
      
      this.logger.success('✓ Database inicializado com persistência ativada');
      
    } catch (error) {
      this.logger.error('❌ Erro ao inicializar Database', error);
      this.logger.warn('⚠️  Sistema continuará SEM persistência');
      this.config.enablePersistence = false;
      
      // Reset
      this.database = null;
      this.persistence = null;
      this.retention = null;
    }
  }

  /**
   * Start persistence loop (save snapshots every 10 minutes)
   */
  startPersistenceLoop() {
    const intervalSec = this.config.persistenceInterval / 1000;
    this.logger.info(`💾 Iniciando loop de persistência (intervalo: ${intervalSec}s)`);
    
    // Wait 30s before first execution (let system warm up)
    setTimeout(() => {
      this.saveSnapshot();
      
      // Schedule periodic executions
      this.persistenceTimer = setInterval(() => {
        this.saveSnapshot();
      }, this.config.persistenceInterval);
      
    }, 30000);
  }

  /**
   * Save current market snapshot to database
   * MÉTODO TESTADO E FUNCIONANDO do index antigo!
   */
  async saveSnapshot() {
    if (!this.persistence) {
      return;
    }
    
    try {
      this.logger.info('💾 Salvando snapshot...');
      
      // Get current options
      const options = this.dataCollector.getAllOptions();
      
      if (!options || options.length === 0) {
        this.logger.debug('Nenhuma option disponível para salvar');
        return;
      }
      
      // Get spot price from stats
      const stats = this.dataCollector.getStats();
      const spotPrice = stats.spotPrice;
      
      if (!spotPrice || spotPrice <= 0) {
        this.logger.debug('Spot price inválido (aguardando WebSocket update)');
        return;
      }
      
      // Get metrics from APIServer (MÉTODO QUE FUNCIONA!)
      const metrics = await this.apiServer.getMetrics();
      
      if (!metrics) {
        this.logger.debug('Métricas não disponíveis ainda');
        return;
      }
      
      // Detect anomalies
      let anomalies = [];
      if (this.anomalyDetector && this.volSurfaceCalculator) {
        try {
          const volSurface = this.volSurfaceCalculator.buildSurface(options, spotPrice);
          if (volSurface && volSurface.points) {
            anomalies = this.anomalyDetector.detectAnomalies(volSurface, 2.0) || [];
          }
        } catch (error) {
          this.logger.error('Erro ao detectar anomalias:', error.message);
        }
      }
      
      // Calculate Max Pain
      let maxPainData = null;
      try {
        maxPainData = this.maxPainCalculator.calculateMaxPain(options, spotPrice);
        if (maxPainData) {
          this.logger.info(`Max Pain: Strike ${maxPainData.maxPainStrike} com ${maxPainData.maxPainOI.toFixed(0)} OI`);
        }
      } catch (error) {
        this.logger.error('Erro ao calcular Max Pain:', error.message);
      }
      
      // Analyze Sentiment
      let sentimentData = null;
      try {
        sentimentData = this.sentimentAnalyzer.analyzeSentiment(options);
        if (sentimentData) {
          this.logger.info(`Sentimento: ${sentimentData.sentiment} (P/C OI: ${sentimentData.putCallOIRatio.toFixed(2)})`);
        }
      } catch (error) {
        this.logger.error('Erro ao analisar sentimento:', error.message);
      }
      
      // Save to database
      await this.persistence.saveSnapshot({
        options,
        spotPrice,
        metrics,
        anomalies,
        maxPain: maxPainData,
        sentiment: sentimentData
      });
      
      this.logger.success(`✓ Snapshot salvo: ${options.length} options, ${anomalies.length} anomalias`);
      
    } catch (error) {
      this.logger.error('Erro ao salvar snapshot:', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.dataCollector.on('ready', () => {
      this.logger.info('DataCollector pronto');
    });
    
    this.dataCollector.on('ws-connected', () => {
      this.logger.info('WebSocket conectado');
    });
    
    this.dataCollector.on('ws-disconnected', () => {
      this.logger.warn('WebSocket desconectado');
    });
    
    this.dataCollector.on('spot-price-updated', (data) => {
      this.logger.debug(`Spot price atualizado: ${data.price.toFixed(2)}`);
      // Update GEXCalculator with new spot price
      if (this.gexCalculator) {
        this.gexCalculator.setSpotPrice(data.price);
      }
    });
    
    this.dataCollector.on('oi-updated', (count) => {
      this.logger.debug(`Open Interest atualizado: ${count} options`);
    });
  }

  /**
   * Print system status
   */
  printStatus() {
    const stats = this.dataCollector.getStats();
    
    console.log('\n' + '='.repeat(70));
    console.log('  GAMMA TRACKER - STATUS');
    console.log('='.repeat(70));
    
    console.log(`\n📊 Estatísticas:`);
    console.log(`   Underlying: ${stats.underlying}`);
    console.log(`   Total de Options: ${stats.totalOptions}`);
    console.log(`   Options Válidas: ${stats.validOptions}`);
    console.log(`   Strikes Únicos: ${stats.uniqueStrikes}`);
    console.log(`   Expirações Únicas: ${stats.uniqueExpiries}`);
    console.log(`   Spot Price: ${stats.spotPrice ? stats.spotPrice.toFixed(2) : 'N/A'}`);
    console.log(`   WebSocket: ${stats.wsConnected ? '✓ Conectado' : '✗ Desconectado'}`);
    
    if (this.config.enablePersistence) {
      console.log(`\n💾 Persistência:`);
      console.log(`   Database: ${this.database ? '✓ Conectado' : '✗ Desconectado'}`);
      console.log(`   Intervalo: ${this.config.persistenceInterval / 1000}s`);
      console.log(`   Retenção: 7 dias (detalhado), 90 dias (anomalias)`);
    }
    
    console.log(`\n🌐 API Server:`);
    console.log(`   URL: http://localhost:${this.config.apiPort}`);
    console.log(`   Endpoints: 72+ routes disponíveis`);
    console.log(`   Health: http://localhost:${this.config.apiPort}/health`);
    console.log(`   Metrics: http://localhost:${this.config.apiPort}/api/metrics`);
    console.log(`   Dashboard: http://localhost:3301 (frontend)`);
    
    console.log('\n' + '='.repeat(70));
    console.log('Sistema rodando. Pressione Ctrl+C para sair.\n');
  }

  /**
   * Shutdown gracefully
   */
  async shutdown() {
    this.logger.info('Encerrando Gamma Tracker...');
    
    try {
      // Stop persistence loop
      if (this.persistenceTimer) {
        clearInterval(this.persistenceTimer);
        this.persistenceTimer = null;
      }
      
      // Save final snapshot
      if (this.persistence) {
        this.logger.info('💾 Salvando snapshot final...');
        await this.saveSnapshot();
      }
      
      // Stop API server
      if (this.apiServer) {
        await this.apiServer.stop();
      }
      
      // Stop data collector
      if (this.dataCollector) {
        this.dataCollector.stop();
      }
      
      // Stop IV comparison
      if (this.ivComparator && typeof this.ivComparator.stop === 'function') {
        try {
          await this.ivComparator.stop();
        } catch (error) {
          this.logger.warn('⚠️  IV Comparator stop error:', error.message);
        }
      }
      
      // Stop retention service
      if (this.retention) {
        this.retention.stopAutomatedCleanup();
      }
      
      // Disconnect database
      if (this.database) {
        await this.database.disconnect();
      }
      
      this.logger.success('✅ Gamma Tracker encerrado com sucesso');
      
    } catch (error) {
      this.logger.error('❌ Erro ao encerrar Gamma Tracker', error);
    }
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

if (require.main === module) {
  const tracker = new GammaTracker();
  
  // Initialize
  tracker.initialize().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
  
  // Graceful shutdown handlers
  process.on('SIGINT', async () => {
    console.log('\n\nSIGINT recebido, encerrando graciosamente...');
    await tracker.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n\nSIGTERM recebido, encerrando graciosamente...');
    await tracker.shutdown();
    process.exit(0);
  });
}

module.exports = GammaTracker;