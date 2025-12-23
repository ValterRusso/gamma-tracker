/**
 * DataCollector - Coleta híbrida de dados da Binance Options API
 * Combina WebSocket (mark price) com REST polling (gregas e OI)
 */

require('dotenv').config();
const WebSocket = require('ws');
const axios = require('axios');
const EventEmitter = require('events');
const Logger = require('../utils/logger');
const Option = require('../models/Option');
const SpotPriceCollector = require('./SpotPriceCollector');
const OpenInterestCollector = require('./OpenInterestCollector');

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
    
    // WebSocket connection
    this.ws = null;
    this.wsConnected = false;
    
    // Polling interval
    this.greeksPollingTimer = null;
    
    // Spot price do underlying
    this.spotPrice = 0;
    this.spotPriceCollector = null;
    
    // Open Interest
    this.openInterestCollector = null;
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
      
      // 3. Inicializar coletor de spot price
      this.spotPriceCollector = new SpotPriceCollector({
        symbol: `${this.config.underlying}USDT`
      });
      
      this.spotPriceCollector.on('price-updated', (data) => {
        this.spotPrice = data.price;
        this.emit('spot-price-updated', data);
      });
      
      this.spotPriceCollector.start();
      this.logger.success('Coletor de spot price iniciado');
      
      // 4. Conectar ao WebSocket para mark price
      this.connectWebSocket();
      
      // 5. Iniciar polling das gregas
      this.startGreeksPolling();
      
      // 6. Inicializar coletor de Open Interest
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
    
    // Fechar WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.wsConnected = false;
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
   * Conecta ao WebSocket para mark price em tempo real
   */
  connectWebSocket() {
    const streamName = `${this.config.underlying}@markPrice`;
    const wsUrl = `${this.config.wsBaseUrl}?streams=${streamName}`;
    
    this.logger.info(`Conectando ao WebSocket: ${streamName}`);
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.on('open', () => {
      this.wsConnected = true;
      this.logger.success('WebSocket conectado');
      this.emit('ws-connected');
    });
    
    this.ws.on('message', (data) => {
      this.handleWebSocketMessage(data);
    });
    
    this.ws.on('error', (error) => {
      this.logger.error('Erro no WebSocket', error);
      this.emit('ws-error', error);
    });
    
    this.ws.on('close', () => {
      this.wsConnected = false;
      this.logger.warn('WebSocket desconectado');
      this.emit('ws-disconnected');
      
      // Tentar reconectar
      setTimeout(() => {
        if (!this.wsConnected) {
          this.logger.info('Tentando reconectar WebSocket...');
          this.connectWebSocket();
        }
      }, this.config.reconnectDelay);
    });
  }

  /**
   * Processa mensagens do WebSocket
   */
  handleWebSocketMessage(data) {
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
      this.logger.error('Erro ao processar mensagem WebSocket', error);
    }
  }

  /**
   * Inicia polling periódico das gregas
   */
  startGreeksPolling() {
    this.logger.info(`Iniciando polling de gregas (intervalo: ${this.config.greeksPollingInterval}ms)`);
    
    this.greeksPollingTimer = setInterval(() => {
      this.fetchGreeks();
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
   * Obtém estatísticas do coletor
   */
  getStats() {
    const allOptions = this.getAllOptions();
    const validOptions = allOptions.filter(opt => opt.gamma > 0);
    
    return {
      totalOptions: allOptions.length,
      validOptions: validOptions.length,
      wsConnected: this.wsConnected,
      underlying: this.config.underlying,
      spotPrice: this.spotPrice,
      uniqueStrikes: this.getUniqueStrikes().length,
      uniqueExpiries: this.getUniqueExpiries().length
    };
  }
}

module.exports = DataCollector;