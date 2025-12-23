/**
 * Gamma Tracker - Aplicação Principal
 * Mini Spot-Gamma Tracker para Options de Crypto
 */

require('dotenv').config();
const DataCollector = require('./collectors/DataCollector');
const GEXCalculator = require('./calculators/GEXCalculator');
const RegimeAnalyzer = require('./calculators/RegimeAnalyzer');
const APIServer = require('./api/server');
const Logger = require('./utils/logger');

class GammaTracker {
  constructor(config = {}) {
    this.logger = new Logger('GammaTracker');
    
    // Configuração
    this.config = {
      underlying: config.underlying || process.env.DEFAULT_UNDERLYING || 'BTC',
      apiPort: config.apiPort || process.env.API_PORT || 3300,
      spotPrice: config.spotPrice || 95000 // Preço inicial estimado para BTC
    };
    
    // Componentes
    this.dataCollector = null;
    this.gexCalculator = null;
    this.regimeAnalyzer = null;
    this.apiServer = null;
  }

  /**
   * Inicializa todos os componentes
   */
  async initialize() {
    this.logger.info('Inicializando Gamma Tracker...');
    this.logger.info(`Underlying: ${this.config.underlying}`);
    
    try {
      // 1. Inicializar calculadoras
      this.gexCalculator = new GEXCalculator(this.config.spotPrice);
      this.regimeAnalyzer = new RegimeAnalyzer();
      this.logger.success('Calculadoras inicializadas');
      
      // 2. Inicializar coletor de dados
      this.dataCollector = new DataCollector({
        underlying: this.config.underlying
      });
      
      // Configurar event listeners
      this.setupEventListeners();
      
      // Iniciar coleta
      await this.dataCollector.start();
      this.logger.success('Coletor de dados iniciado');
      
      // 3. Inicializar API Server
      this.apiServer = new APIServer(
        this.dataCollector,
        this.gexCalculator,
        this.regimeAnalyzer,
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
    
    console.log('\n' + '='.repeat(70));
    console.log('Sistema rodando. Pressione Ctrl+C para sair.\n');
  }

  /**
   * Para o sistema
   */
  async shutdown() {
    this.logger.info('Encerrando Gamma Tracker...');
    
    try {
      if (this.apiServer) {
        await this.apiServer.stop();
      }
      
      if (this.dataCollector) {
        this.dataCollector.stop();
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


