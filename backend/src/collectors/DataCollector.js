/**
 * DataCollector - Coleta híbrida de dados da Binance Options API
 * Combina WebSocket (mark price + ticker) com REST polling (apenas gregas)
 * EVITA BAN usando WebSocket para volume/bid/ask em vez de REST polling
 */

require('dotenv').config();
const WebSocket = require('ws');
const axios = require('axios');
const EventEmitter = require('events');
const Logger = require('../utils/logger');
const Option = require('../models/Option');
const SpotPriceCollector = require('./SpotPriceCollector');
const OpenInterestCollector = require('./OpenInterestCollector');
const LiquidationTracker = require('./LiquidationTracker');
const OrderBookAnalyzer = require('./OrderBookAnalyzer')

class DataCollector extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      wsBaseUrl: config.wsBaseUrl || process.env.WS_BASE_URL || 'wss://nbstream.binance.com/eoptions/stream',
      restBaseUrl: config.restBaseUrl || process.env.REST_BASE_URL || 'https://eapi.binance.com',
      underlying: config.underlying || process.env.DEFAULT_UNDERLYING || 'BTC',
      greeksPollingInterval: config.greeksPollingInterval || 5000, // 5 segundos
      reconnectDelay: config.reconnectDelay || 5000
    };
    
    this.logger = new Logger('DataCollector');
    
    // Armazenamento de options
    this.options = new Map(); // symbol -> Option
    
    // WebSocket connections
    this.wsMarkPrice = null;
    this.wsTicker = null;
    this.wsMarkPriceConnected = false;
    this.wsTickerConnected = false;
    
    // Polling interval
    this.greeksPollingTimer = null;
    
    // Spot price do underlying
    this.spotPrice = 0;
    this.spotPriceCollector = null;
    
    // Open Interest
    this.openInterestCollector = null;
    
    // Liquidation Tracker
    this.liquidationTracker = null;

    // Order Book Analyzer (futuros)
    this.OrderBookAnalyzer = null;
  }

  /**
   * Inicia a coleta de dados
   */
  async start() {
    this.logger.info('Iniciando DataCollector...');
    
    try {
      // 1. Carregar informações dos contratos
      await this.loadExchangeInfo();
      
      // 2. Fazer carga inicial das gregas
      await this.fetchGreeks();
      
      // 3. Fazer carga inicial do ticker (volume, bid, ask) - UMA VEZ APENAS
      await this.fetchTickerInitial();
      
      // 4. Inicializar coletor de spot price
      this.spotPriceCollector = new SpotPriceCollector({
        symbol: `${this.config.underlying}USDT`
      });
      
      this.spotPriceCollector.on('price-updated', (data) => {
        this.spotPrice = data.price;
        this.emit('spot-price-updated', data);
      });
      
      this.spotPriceCollector.start();
      this.logger.success('Coletor de spot price iniciado');
      
      // 5. Conectar ao WebSocket para mark price
      this.connectMarkPriceWebSocket();
      
      // 6. Conectar ao WebSocket para ticker (volume, bid, ask) - NOVO
      this.connectTickerWebSocket();
      
      // 7. Iniciar polling APENAS das gregas (não ticker!)
      this.startGreeksPolling();
      
      // 8. Inicializar coletor de Open Interest
      this.openInterestCollector = new OpenInterestCollector({
        underlying: this.config.underlying
      });
      
      this.openInterestCollector.on('updated', (count) => {
        this.updateOptionsWithOI();
        this.emit('oi-updated', count);
      });
      
      // Obter datas de expiração únicas e iniciar coleta de OI
      const expiries = this.getUniqueExpiries();
      await this.openInterestCollector.start(expiries);
      this.logger.success('Coletor de Open Interest iniciado');
      
      // 9. Inicializar e conectar LiquidationTracker
      this.liquidationTracker = new LiquidationTracker(
        `${this.config.underlying.toLowerCase()}usdt`,
        this.logger
      );
      
      this.liquidationTracker.on('connected', () => {
        this.logger.success('✅ LiquidationTracker conectado');
        this.emit('liquidation-tracker-connected');
      });
      
      this.liquidationTracker.on('liquidation', (liq) => {
        // Emitir evento para quem quiser processar cada liquidação
        this.emit('liquidation', liq);
      });
      
      this.liquidationTracker.on('cascade', (stats) => {
        this.logger.warn('🚨 CASCATA DE LIQUIDAÇÕES DETECTADA!', stats);
        this.emit('liquidation-cascade', stats);
      });
      
      this.liquidationTracker.on('error', (error) => {
        this.logger.error('❌ LiquidationTracker error:', error);
        this.emit('liquidation-tracker-error', error);
      });
      
      this.liquidationTracker.connect();
      this.logger.success('LiquidationTracker iniciado');

      // 10. Inicializar e conectar OrderBookAnalyzer (futuros)
      this.orderBookAnalyzer = new OrderBookAnalyzer(
        `${this.config.underlying.toLowerCase()}usdt`,
        this.logger
      );
      this.orderBookAnalyzer.on('connected', () => {
        this.logger.success('✅ OrderBookAnalyzer conectado');
        this.emit('orderbook-analyzer-connected');
      });
      this.orderBookAnalyzer.on('update', (metrics) => {
        // Emitir evento para quem quiser processar as métricas do order book
        this.emit('orderbook-analyzer-update', metrics);
      });
      this.orderBookAnalyzer.on('error', (error) => {
        this.logger.error('❌ OrderBookAnalyzer error:', error);
        this.emit('orderbook-analyzer-error', error);
      });
      this.orderBookAnalyzer.connect();
      this.logger.success('OrderBookAnalyzer iniciado');
      
      this.logger.success('DataCollector iniciado com sucesso');
      this.emit('ready');
      
    } catch (error) {
      this.logger.error('Erro ao iniciar DataCollector', error);
      throw error;
    }
  }

  /**
   * Para a coleta de dados
   */
  stop() {
    this.logger.info('Parando DataCollector...');
    
    // Parar polling
    if (this.greeksPollingTimer) {
      clearInterval(this.greeksPollingTimer);
      this.greeksPollingTimer = null;
    }
    
    // Parar coletor de spot price
    if (this.spotPriceCollector) {
      this.spotPriceCollector.stop();
    }
    
    // Parar coletor de Open Interest
    if (this.openInterestCollector) {
      this.openInterestCollector.stop();
    }
    
    // Parar LiquidationTracker
    if (this.liquidationTracker) {
      this.liquidationTracker.disconnect();
      this.liquidationTracker = null;
    }
    // Parar OrderBookAnalyzer (futuros)
    if (this.orderBookAnalyzer) {
      this.orderBookAnalyzer.disconnect();
      this.orderBookAnalyzer = null;
    }
    
    // Fechar WebSockets
    if (this.wsMarkPrice) {
      this.wsMarkPrice.close();
      this.wsMarkPrice = null;
    }
    
    if (this.wsTicker) {
      this.wsTicker.close();
      this.wsTicker = null;
    }
    
    this.wsMarkPriceConnected = false;
    this.wsTickerConnected = false;
    this.logger.success('DataCollector parado');
  }

  /**
   * Carrega informações dos contratos de options
   */
  async loadExchangeInfo() {
    this.logger.info('Carregando informações dos contratos...');
    
    try {
      const response = await axios.get(`${this.config.restBaseUrl}/eapi/v1/exchangeInfo`);
      const data = response.data;
      
      // Filtrar options do underlying desejado
      const underlyingAsset = `${this.config.underlying}USDT`;
      const relevantOptions = data.optionSymbols.filter(opt => opt.underlying === underlyingAsset);
      
      // Criar objetos Option
      relevantOptions.forEach(optData => {
        const option = new Option(optData);
        this.options.set(option.symbol, option);
      });
      
      this.logger.success(`${this.options.size} options carregadas para ${this.config.underlying}`);
      
    } catch (error) {
      this.logger.error('Erro ao carregar exchange info', error);
      throw error;
    }
  }

  /**
   * Busca gregas via REST API
   */
  async fetchGreeks() {
    try {
      const response = await axios.get(`${this.config.restBaseUrl}/eapi/v1/mark`);
      const data = response.data;
      
      let updatedCount = 0;
      
      data.forEach(item => {
        const option = this.options.get(item.symbol);
        if (option) {
          option.updateGreeks(item);
          option.updateMarkPrice(item.markPrice);
          updatedCount++;
        }
      });
      
      this.logger.debug(`Gregas atualizadas para ${updatedCount} options`);
      this.emit('greeks-updated', updatedCount);
      
    } catch (error) {
      this.logger.error('Erro ao buscar gregas', error);
    }
  }

  /**
   * Busca ticker inicial via REST API (UMA VEZ APENAS na inicialização)
   */
  async fetchTickerInitial() {
    try {
      this.logger.info('Carregando ticker inicial (volume, bid, ask)...');
      const response = await axios.get(`${this.config.restBaseUrl}/eapi/v1/ticker`);
      const data = response.data;
      
      let updatedCount = 0;
      
      data.forEach(item => {
        const option = this.options.get(item.symbol);
        if (option) {
          option.updateTicker({
            volume: parseFloat(item.volume) || 0,
            bidPrice: item.bidPrice !== undefined && item.bidPrice !== '' ? parseFloat(item.bidPrice) : null,
            askPrice: item.askPrice !== undefined && item.askPrice !== '' ? parseFloat(item.askPrice) : null,
            lastPrice: item.lastPrice !== undefined && item.lastPrice !== '' ? parseFloat(item.lastPrice) : null
          });
          updatedCount++;
        }
      });
      
      this.logger.success(`Ticker inicial carregado para ${updatedCount} options`);
      
    } catch (error) {
      this.logger.error('Erro ao buscar ticker inicial', error);
      // Não lançar erro - continuar mesmo sem ticker inicial
    }
  }

  /**
   * Conecta ao WebSocket para mark price em tempo real
   */
  connectMarkPriceWebSocket() {
    const streamName = `${this.config.underlying}@markPrice`;
    const wsUrl = `${this.config.wsBaseUrl}?streams=${streamName}`;
    
    this.logger.info(`Conectando ao WebSocket Mark Price: ${streamName}`);
    
    this.wsMarkPrice = new WebSocket(wsUrl);
    
    this.wsMarkPrice.on('open', () => {
      this.wsMarkPriceConnected = true;
      this.logger.success('WebSocket Mark Price conectado');
      this.emit('ws-markprice-connected');
    });
    
    this.wsMarkPrice.on('message', (data) => {
      this.handleMarkPriceMessage(data);
    });
    
    this.wsMarkPrice.on('error', (error) => {
      this.logger.error('Erro no WebSocket Mark Price', error);
      this.emit('ws-markprice-error', error);
    });
    
    this.wsMarkPrice.on('close', () => {
      this.wsMarkPriceConnected = false;
      this.logger.warn('WebSocket Mark Price desconectado');
      this.emit('ws-markprice-disconnected');
      
      // Tentar reconectar
      setTimeout(() => {
        if (!this.wsMarkPriceConnected) {
          this.logger.info('Tentando reconectar WebSocket Mark Price...');
          this.connectMarkPriceWebSocket();
        }
      }, this.config.reconnectDelay);
    });
  }

  /**
   * Conecta ao WebSocket para ticker (volume, bid, ask) em tempo real - NOVO
   */
  connectTickerWebSocket() {
    const streamName = `${this.config.underlying}@ticker`;
    const wsUrl = `${this.config.wsBaseUrl}?streams=${streamName}`;
    
    this.logger.info(`Conectando ao WebSocket Ticker: ${streamName}`);
    
    this.wsTicker = new WebSocket(wsUrl);
    
    this.wsTicker.on('open', () => {
      this.wsTickerConnected = true;
      this.logger.success('WebSocket Ticker conectado');
      this.emit('ws-ticker-connected');
    });
    
    this.wsTicker.on('message', (data) => {
      this.handleTickerMessage(data);
    });
    
    this.wsTicker.on('error', (error) => {
      this.logger.error('Erro no WebSocket Ticker', error);
      this.emit('ws-ticker-error', error);
    });
    
    this.wsTicker.on('close', () => {
      this.wsTickerConnected = false;
      this.logger.warn('WebSocket Ticker desconectado');
      this.emit('ws-ticker-disconnected');
      
      // Tentar reconectar
      setTimeout(() => {
        if (!this.wsTickerConnected) {
          this.logger.info('Tentando reconectar WebSocket Ticker...');
          this.connectTickerWebSocket();
        }
      }, this.config.reconnectDelay);
    });
  }

  /**
   * Processa mensagens do WebSocket Mark Price
   */
  handleMarkPriceMessage(data) {
    try {
      const message = JSON.parse(data);
      
      if (message.data && Array.isArray(message.data)) {
        const optionsData = message.data;
        
        optionsData.forEach(item => {
          const option = this.options.get(item.s); // s = symbol
          if (option && item.mp) { // mp = mark price
            option.updateMarkPrice(item.mp);
          }
        });
        
        this.emit('markprice-updated', optionsData.length);
      }
      
    } catch (error) {
      this.logger.error('Erro ao processar mensagem WebSocket Mark Price', error);
    }
  }

  /**
   * Processa mensagens do WebSocket Ticker - NOVO
   */
  handleTickerMessage(data) {
    try {
      const message = JSON.parse(data);
      
      if (message.data && Array.isArray(message.data)) {
        const tickerData = message.data;
        
        let updatedCount = 0;
        
        tickerData.forEach(item => {
          const option = this.options.get(item.s); // s = symbol
          if (option) {
            option.updateTicker({
              volume: item.v ? parseFloat(item.v) : 0,           // v = volume
              bidPrice: item.b ? parseFloat(item.b) : null,      // b = bid price
              askPrice: item.a ? parseFloat(item.a) : null,      // a = ask price
              lastPrice: item.c ? parseFloat(item.c) : null      // c = close/last price
            });
            updatedCount++;
          }
        });
        
        if (updatedCount > 0) {
          this.emit('ticker-updated', updatedCount);
        }
      }
      
    } catch (error) {
      this.logger.error('Erro ao processar mensagem WebSocket Ticker', error);
    }
  }

  /**
   * Inicia polling periódico APENAS das gregas (não ticker!)
   */
  startGreeksPolling() {
    this.logger.info(`Iniciando polling de gregas (intervalo: ${this.config.greeksPollingInterval}ms)`);
    this.logger.info('Ticker será atualizado via WebSocket em tempo real');
    
    this.greeksPollingTimer = setInterval(() => {
      this.fetchGreeks();
      // NÃO chamar fetchTicker() aqui - usar WebSocket!
    }, this.config.greeksPollingInterval);
  }

  /**
   * Obtém todas as options
   */
  getAllOptions() {
    return Array.from(this.options.values());
  }

  /**
   * Obtém options por strike
   */
  getOptionsByStrike(strike) {
    return this.getAllOptions().filter(opt => opt.strike === strike);
  }

  /**
   * Obtém options por tipo (CALL ou PUT)
   */
  getOptionsBySide(side) {
    return this.getAllOptions().filter(opt => opt.side === side);
  }

  /**
   * Obtém options por data de expiração
   */
  getOptionsByExpiry(expiryDate) {
    return this.getAllOptions().filter(opt => 
      opt.expiryDate && opt.expiryDate.getTime() === expiryDate.getTime()
    );
  }

  /**
   * Obtém lista de strikes únicos
   */
  getUniqueStrikes() {
    const strikes = new Set();
    this.options.forEach(opt => strikes.add(opt.strike));
    return Array.from(strikes).sort((a, b) => a - b);
  }

  /**
   * Obtém lista de datas de expiração únicas
   */
  getUniqueExpiries() {
    const expiries = new Set();
    this.options.forEach(opt => {
      if (opt.expiryDate) {
        const timestamp = opt.expiryDate instanceof Date ? opt.expiryDate.getTime() : opt.expiryDate;
        expiries.add(timestamp);
      }
    });
    return Array.from(expiries).map(ts => new Date(ts)).sort((a, b) => a - b);
  }

  /**
   * Atualiza options com dados de Open Interest
   */
  updateOptionsWithOI() {
    let updatedCount = 0;
    
    this.options.forEach(option => {
      const oi = this.openInterestCollector.getOpenInterest(option.symbol);
      if (oi > 0) {
        option.updateOpenInterest(oi);
        updatedCount++;
      }
    });
    
    this.logger.debug(`Open Interest atualizado para ${updatedCount} options`);
  }

  /**
   * Obtém estatísticas de liquidações
   */
  getLiquidationStats() {
    if (!this.liquidationTracker) {
      return null;
    }
    return this.liquidationTracker.getStats();
  }

  /**
   * Obtém energy score das liquidações
   */
  getLiquidationEnergy() {
    if (!this.liquidationTracker) {
      return null;
    }
    return this.liquidationTracker.getEnergyScore();
  }
  /**
 * Obter métricas do OrderBookAnalyzer
 */
  getOrderBookMetrics() {
    if (!this.orderBookAnalyzer) {
      throw new Error('OrderBookAnalyzer não inicializado');
    }
    return this.orderBookAnalyzer.getMetrics();
  }

  getOrderBookImbalance() {
    if (!this.orderBookAnalyzer) {
      throw new Error('OrderBookAnalyzer não inicializado');
    }
    return this.orderBookAnalyzer.getBookImbalance();
  }

  getOrderBookDepth() {
    if (!this.orderBookAnalyzer) {
      throw new Error('OrderBookAnalyzer não inicializado');
    }
    return this.orderBookAnalyzer.getDepth();
  }

  getOrderBookSpread() {
    if (!this.orderBookAnalyzer) {
      throw new Error('OrderBookAnalyzer não inicializado');
    }
    return this.orderBookAnalyzer.getSpreadQuality();
  }

  getOrderBookWalls() {
    if (!this.orderBookAnalyzer) {
      throw new Error('OrderBookAnalyzer não inicializado');
    }
    return this.orderBookAnalyzer.getWalls();
  }

  getOrderBookEnergy() {
    if (!this.orderBookAnalyzer) {
      throw new Error('OrderBookAnalyzer não inicializado');
    }
    return this.orderBookAnalyzer.getEnergyScore();
  }

  getOrderBookHistory() {
    if (!this.orderBookAnalyzer) {
      throw new Error('OrderBookAnalyzer não inicializado');
    }
    return this.orderBookAnalyzer.getHistory();
  }


  /**
   * Obtém estatísticas do coletor
   */
  getStats() {
    const allOptions = this.getAllOptions();
    const validOptions = allOptions.filter(opt => opt.gamma > 0);
    
    const stats = {
      totalOptions: allOptions.length,
      validOptions: validOptions.length,
      wsMarkPriceConnected: this.wsMarkPriceConnected,
      wsTickerConnected: this.wsTickerConnected,
      underlying: this.config.underlying,
      spotPrice: this.spotPrice,
      uniqueStrikes: this.getUniqueStrikes().length,
      uniqueExpiries: this.getUniqueExpiries().length
    };
    
    // Adicionar stats de liquidações se disponível
    if (this.liquidationTracker) {
      stats.liquidationTrackerConnected = this.liquidationTracker.connected;
      stats.liquidationEnergy = this.liquidationTracker.getEnergyScore();
    }
    
    if (this.orderBookAnalyzer) {
      stats.orderBookAnalyzerConnected = this.orderBookAnalyzer.connected;
      stats.orderBookEnergy = this.orderBookAnalyzer.getEnergyScore();
    }
    
    return stats;
  }
  

}

module.exports = DataCollector;
