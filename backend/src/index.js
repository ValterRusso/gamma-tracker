/**
 * Gamma Tracker - Aplicação Principal
 * Mini Spot-Gamma Tracker para Options de Crypto
 */

require('dotenv').config();
const DataCollector = require('./collectors/DataCollector');
const GEXCalculator = require('./calculators/GEXCalculator');
const RegimeAnalyzer = require('./calculators/RegimeAnalyzer');
const MaxPainCalculator = require('./calculators/MaxPainCalculator');
const SentimentAnalyzer = require('./calculators/SentimentAnalyzer');
const OrderBookAnalyzer = require('./collectors/OrderBookAnalyzer');
const APIServer = require('./api/server');
const Logger = require('./utils/logger');

// ← ADICIONAR: Imports do Database
const Database = require('./database/Database');
const DataPersistenceService = require('./database/services/DataPersistenceService');
const DataRetentionService = require('./database/services/DataRetentionService');

class GammaTracker {
  constructor(config = {}) {
    this.logger = new Logger('GammaTracker');
    
    // Configuração
    this.config = {
      underlying: config.underlying || process.env.DEFAULT_UNDERLYING || 'BTC',
      apiPort: config.apiPort || process.env.API_PORT || 3300,
      spotPrice: config.spotPrice || 95000, // Preço inicial estimado para BTC
      // ← ADICIONAR: Configuração de persistência
      enablePersistence: config.enablePersistence !== false, // Default: true
      persistenceInterval: config.persistenceInterval || 10 * 60 * 1000 // 10 minutos
    };
    
    // Componentes
    this.dataCollector = null;
    this.gexCalculator = null;
    this.regimeAnalyzer = null;
    this.maxPainCalculator = null;
    this.sentimentAnalyzer = null;
    this.apiServer = null;
    
    // ← ADICIONAR: Componentes de persistência
    this.database = null;
    this.persistence = null;
    this.retention = null;
    this.persistenceTimer = null;
  }

  /**
   * Inicializa todos os componentes
   */
  async initialize() {
    this.logger.info('Inicializando Gamma Tracker...');
    this.logger.info(`Underlying: ${this.config.underlying}`);
    
    try {
      // ← ADICIONAR: 1. Inicializar Database (PRIMEIRO)
      if (this.config.enablePersistence) {
        await this.initializeDatabase();
      }
      
      // 2. Inicializar calculadoras
      this.gexCalculator = new GEXCalculator(this.config.spotPrice);
      this.regimeAnalyzer = new RegimeAnalyzer();
      this.maxPainCalculator = new MaxPainCalculator();
      this.sentimentAnalyzer = new SentimentAnalyzer();
      this.logger.success('Calculadoras inicializadas');
      
      // 3. Inicializar coletor de dados
      this.dataCollector = new DataCollector({
        underlying: this.config.underlying
      });
      this.dataCollector.orderBookAnalyzer = new OrderBookAnalyzer(
        `${this.config.underlying}USDT`,
        this.logger

      );
      
      // Configurar event listeners
      this.setupEventListeners();
      
      // Iniciar coleta
      await this.dataCollector.start();
      this.logger.success('Coletor de dados iniciado');
      
      // ← ADICIONAR: 4. Iniciar loop de persistência (DEPOIS do start)
      if (this.config.enablePersistence) {
        this.startPersistenceLoop();
      }
      
      // 5. Inicializar API Server
      this.apiServer = new APIServer(
        this.dataCollector,
        this.gexCalculator,
        this.regimeAnalyzer,
        this.database,
        { port: this.config.apiPort }
      );
      
      await this.apiServer.start();
      this.logger.success('API Server iniciado');
      
      this.logger.success('✓ Gamma Tracker inicializado com sucesso!');
      this.printStatus();
      
    } catch (error) {
      this.logger.error('Erro ao inicializar Gamma Tracker', error);
      throw error;
    }
  }

  // ← ADICIONAR: Método para inicializar database
  async initializeDatabase() {
    try {
      this.logger.info('Inicializando Database...');
      
      // 1. Conectar ao MySQL
      this.database = new Database();
      await this.database.connect();
      
      // 2. Inicializar serviço de persistência
      this.persistence = new DataPersistenceService(this.database);
      await this.persistence.initialize(this.config.underlying);
      
      // 3. Inicializar serviço de retenção (cleanup automático a cada 24h)
      this.retention = new DataRetentionService(this.database);
      this.retention.startAutomatedCleanup(24);
      
      this.logger.success('✓ Database inicializado com persistência ativada');
      
    } catch (error) {
      this.logger.error('Erro ao inicializar Database', error);
      this.logger.warn('Sistema continuará SEM persistência');
      this.config.enablePersistence = false;
    }
  }

  // ← ADICIONAR: Loop de persistência
  startPersistenceLoop() {
    this.logger.info(`Iniciando loop de persistência (intervalo: ${this.config.persistenceInterval / 1000}s)`);
    
    // Executar imediatamente
    setTimeout(() => {
      this.saveSnapshot();
    
    // Agendar execuções periódicas
    this.persistenceTimer = setInterval(() => {
      this.saveSnapshot();
    }, this.config.persistenceInterval);
   },30000); // Esperar 30s antes da primeira execução
  }

  // ← ADICIONAR: Método para salvar snapshot
  async saveSnapshot() {
     this.logger.info('🔍 [DEBUG] saveSnapshot() chamado');
    try {
      // Obter dados atuais
      const options = this.dataCollector.getAllOptions();
      this.logger.info(`🔍 [DEBUG] Options obtidas: ${options ? options.length : 0}`);
      
      if (!options || options.length === 0) {
      this.logger.debug('Nenhuma option disponível para salvar');
      return;
    }
     
     // Obter spot price do stats
      const stats = this.dataCollector.getStats();
      const spotPrice = stats.spotPrice;
      this.logger.info(`🔍 [DEBUG] Spot price: ${spotPrice}`);

      if (!spotPrice || spotPrice <= 0) {
      this.logger.debug('Spot price inválido (ainda não recebeu update do WebSocket)');
      return;
    }

    this.logger.info('🔍 [DEBUG] Obtendo métricas do APIServer...');
    // Usar o método getMetrics do APIServer (que já funciona!)
    const metrics = await this.apiServer.getMetrics();

    if (!metrics) {
      this.logger.debug('Métricas não disponíveis');
      return;
    }

    this.logger.info('🔍 [DEBUG] Detectando anomalias...');

    // Detectar anomalias (se disponível)
    let anomalies = [];
    if (this.apiServer.anomalyDetector && this.apiServer.volSurfaceCalculator) {
      try {
        const volSurface = this.apiServer.volSurfaceCalculator.buildSurface(options, spotPrice);
        if (volSurface && volSurface.points) {
          // detectAnomalies expects (surfaceData, threshold)
          const anomalies_detected = this.apiServer.anomalyDetector.detectAnomalies(
            volSurface,  // Pass entire volSurface object, not just points
            2.0          // threshold
          );
          anomalies = anomalies_detected || [];         
        }
      } catch (error) {
        this.logger.error('Erro ao detectar anomalias', error.message);
      }
    }
    
    // Calcular Max Pain
    this.logger.info('🔍 [DEBUG] Calculando Max Pain...');
    let maxPainData = null;
    try {
      maxPainData = this.maxPainCalculator.calculateMaxPain(options, spotPrice);
      if (maxPainData) {
        this.logger.info(`Max Pain: Strike ${maxPainData.maxPainStrike} com ${maxPainData.maxPainOI.toFixed(0)} OI`);
      }
    } catch (error) {
      this.logger.error('Erro ao calcular Max Pain', error.message);
    }
    
    // Analisar Sentimento
    this.logger.info('🔍 [DEBUG] Analisando sentimento...');
    let sentimentData = null;
    try {
      sentimentData = this.sentimentAnalyzer.analyzeSentiment(options);
      if (sentimentData) {
        this.logger.info(`Sentimento: ${sentimentData.sentiment} (P/C OI: ${sentimentData.putCallOIRatio.toFixed(2)})`);
      }
    } catch (error) {
      this.logger.error('Erro ao analisar sentimento', error.message);
    }     
   
      this.logger.info('🔍 [DEBUG] Salvando no banco...');
      // Salvar no banco
      await this.persistence.saveSnapshot({
        options: options,
        spotPrice: spotPrice,
        metrics: metrics,
        anomalies: anomalies,
        maxPain: maxPainData,
        sentiment: sentimentData
      });
      
      this.logger.info(`✓ Snapshot salvo: ${options.length} options, ${anomalies.length} anomalias`);
      
    } catch (error) {
      this.logger.error('Erro ao salvar snapshot', error);
    }
  }

  /**
   * Configura event listeners
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
    
    this.dataCollector.on('greeks-updated', (count) => {
      this.logger.debug(`Gregas atualizadas: ${count} options`);
    });
    
    this.dataCollector.on('markprice-updated', (count) => {
      this.logger.debug(`Mark prices atualizados: ${count} options`);
    });
    
    this.dataCollector.on('spot-price-updated', (data) => {
      this.logger.debug(`Spot price atualizado: ${data.price.toFixed(2)}`);
      // Atualizar GEXCalculator com novo spot price
      if (this.gexCalculator) {
        this.gexCalculator.setSpotPrice(data.price);
      }
    });
    
    this.dataCollector.on('oi-updated', (count) => {
      this.logger.debug(`Open Interest atualizado: ${count} options`);
    });
  }

  /**
   * Imprime status do sistema
   */
  printStatus() {
    console.log('\n' + '='.repeat(70));
    console.log('  GAMMA TRACKER - STATUS');
    console.log('='.repeat(70));
    
    const stats = this.dataCollector.getStats();
    
    console.log(`\n📊 Estatísticas:`);
    console.log(`   Underlying: ${stats.underlying}`);
    console.log(`   Total de Options: ${stats.totalOptions}`);
    console.log(`   Options Válidas: ${stats.validOptions}`);
    console.log(`   Strikes Únicos: ${stats.uniqueStrikes}`);
    console.log(`   Expirações Únicas: ${stats.uniqueExpiries}`);
    console.log(`   WebSocket: ${stats.wsConnected ? '✓ Conectado' : '✗ Desconectado'}`);
    
    // ← ADICIONAR: Status de persistência
    if (this.config.enablePersistence) {
      console.log(`\n💾 Persistência:`);
      console.log(`   Database: ${this.database ? '✓ Conectado' : '✗ Desconectado'}`);
      console.log(`   Intervalo: ${this.config.persistenceInterval / 1000}s`);
      console.log(`   Retenção: 7 dias (detalhado), 90 dias (anomalias)`);
    }
    
    console.log(`\n🌐 API Endpoints:`);
    console.log(`   Health: http://localhost:${this.config.apiPort}/health`);
    console.log(`   Status: http://localhost:${this.config.apiPort}/api/status`);
    console.log(`   Métricas: http://localhost:${this.config.apiPort}/api/metrics`);
    console.log(`   Insights: http://localhost:${this.config.apiPort}/api/insights`);
    console.log(`   Gamma Profile: http://localhost:${this.config.apiPort}/api/gamma-profile`);
    console.log(`   Total GEX: http://localhost:${this.config.apiPort}/api/total-gex`);
    console.log(`   Gamma Flip: http://localhost:${this.config.apiPort}/api/gamma-flip`);
    console.log(`   Walls: http://localhost:${this.config.apiPort}/api/walls`);
    console.log(`   wall-zones: http://localhost:${this.config.apiPort}/api/wall-zones`);
    console.log(`   Vol Surface: http://localhost:${this.config.apiPort}/api/vol-surface`);
    console.log(`   Anomalias: http://localhost:${this.config.apiPort}/api/vol-anomalies`);
    console.log(`   Max Pain: http://localhost:${this.config.apiPort}/api/max-pain`);
    console.log(`   Sentimento: http://localhost:${this.config.apiPort}/api/sentiment`);  

    
    console.log('\n' + '='.repeat(70));
    console.log('Sistema rodando. Pressione Ctrl+C para sair.\n');
  }

  /**
   * Para o sistema
   */
  async shutdown() {
    this.logger.info('Encerrando Gamma Tracker...');
    
    try {
      // ← ADICIONAR: Parar loop de persistência
      if (this.persistenceTimer) {
        clearInterval(this.persistenceTimer);
        this.persistenceTimer = null;
      }
      
      // ← ADICIONAR: Salvar snapshot final antes de desligar
      if (this.persistence) {
        this.logger.info('Salvando snapshot final...');
        await this.saveSnapshot();
      }
      
      if (this.apiServer) {
        await this.apiServer.stop();
      }
      
      if (this.dataCollector) {
        this.dataCollector.stop();
      }
      
      // ← ADICIONAR: Desconectar database
      if (this.retention) {
        this.retention.stopAutomatedCleanup();
      }
      
      if (this.database) {
        await this.database.disconnect();
      }
      
      this.logger.success('Gamma Tracker encerrado');
      
    } catch (error) {
      this.logger.error('Erro ao encerrar Gamma Tracker', error);
    }
  }
}

// Executar se for o arquivo principal
if (require.main === module) {
  const tracker = new GammaTracker();
  
  // Inicializar
  tracker.initialize().catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
  
  // Handlers para encerramento gracioso
  process.on('SIGINT', async () => {
    console.log('\n\nRecebido SIGINT, encerrando...');
    await tracker.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n\nRecebido SIGTERM, encerrando...');
    await tracker.shutdown();
    process.exit(0);
  });
}

module.exports = GammaTracker;