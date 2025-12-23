/**
 * SpotPriceCollector - Coleta preço spot do mercado à vista via WebSocket
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const Logger = require('../utils/logger');

class SpotPriceCollector extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      wsBaseUrl: config.wsBaseUrl || 'wss://stream.binance.com:9443/ws',
      symbol: config.symbol || 'btcusdt',
      reconnectDelay: config.reconnectDelay || 5000
    };
    
    this.logger = new Logger('SpotPriceCollector');
    
    // Estado
    this.ws = null;
    this.wsConnected = false;
    this.spotPrice = 0;
    this.lastUpdate = 0;
  }

  /**
   * Inicia a coleta de spot price
   */
  start() {
    this.logger.info(`Iniciando coleta de spot price para ${this.config.symbol.toUpperCase()}...`);
    this.connectWebSocket();
  }

  /**
   * Para a coleta
   */
  stop() {
    this.logger.info('Parando coleta de spot price...');
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.wsConnected = false;
  }

  /**
   * Conecta ao WebSocket do mercado spot
   */
  connectWebSocket() {
    // Stream: <symbol>@ticker
    // Exemplo: btcusdt@ticker
    const streamName = `${this.config.symbol.toLowerCase()}@ticker`;
    const wsUrl = `${this.config.wsBaseUrl}/${streamName}`;
    
    this.logger.info(`Conectando ao WebSocket: ${streamName}`);
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.on('open', () => {
      this.wsConnected = true;
      this.logger.success('WebSocket de spot price conectado');
      this.emit('connected');
    });
    
    this.ws.on('message', (data) => {
      this.handleMessage(data);
    });
    
    this.ws.on('error', (error) => {
      this.logger.error('Erro no WebSocket de spot price', error);
      this.emit('error', error);
    });
    
    this.ws.on('close', () => {
      this.wsConnected = false;
      this.logger.warn('WebSocket de spot price desconectado');
      this.emit('disconnected');
      
      // Tentar reconectar
      setTimeout(() => {
        if (!this.wsConnected) {
          this.logger.info('Tentando reconectar WebSocket de spot price...');
          this.connectWebSocket();
        }
      }, this.config.reconnectDelay);
    });
  }

  /**
   * Processa mensagens do WebSocket
   */
  handleMessage(data) {
    try {
      const ticker = JSON.parse(data);
      
      // Estrutura do ticker 24hr:
      // {
      //   "e": "24hrTicker",
      //   "E": 123456789,
      //   "s": "BTCUSDT",
      //   "c": "95123.45",  // Close price (último preço)
      //   "o": "94000.00",  // Open price
      //   "h": "96000.00",  // High price
      //   "l": "93500.00",  // Low price
      //   "v": "12345.67",  // Volume
      //   ...
      // }
      
      if (ticker.e === '24hrTicker' && ticker.c) {
        const newPrice = parseFloat(ticker.c);
        const oldPrice = this.spotPrice;
        
        this.spotPrice = newPrice;
        this.lastUpdate = Date.now();
        
        // Emitir evento de atualização
        this.emit('price-updated', {
          symbol: ticker.s,
          price: newPrice,
          oldPrice: oldPrice,
          change: newPrice - oldPrice,
          changePercent: oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0,
          timestamp: this.lastUpdate
        });
        
        this.logger.debug(`Spot price atualizado: ${newPrice.toFixed(2)}`);
      }
      
    } catch (error) {
      this.logger.error('Erro ao processar mensagem de spot price', error);
    }
  }

  /**
   * Obtém o spot price atual
   */
  getSpotPrice() {
    return this.spotPrice;
  }

  /**
   * Verifica se está conectado
   */
  isConnected() {
    return this.wsConnected;
  }

  /**
   * Obtém estatísticas
   */
  getStats() {
    return {
      symbol: this.config.symbol.toUpperCase(),
      spotPrice: this.spotPrice,
      connected: this.wsConnected,
      lastUpdate: this.lastUpdate,
      age: this.lastUpdate > 0 ? Date.now() - this.lastUpdate : null
    };
  }
}

module.exports = SpotPriceCollector;