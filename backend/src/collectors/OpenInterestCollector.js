/**
 * OpenInterestCollector - Coleta Open Interest das options via REST API
 */

const axios = require('axios');
const EventEmitter = require('events');
const Logger = require('../utils/logger');

class OpenInterestCollector extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      restBaseUrl: config.restBaseUrl || process.env.REST_BASE_URL || 'https://eapi.binance.com',
      underlying: config.underlying || 'BTC',
      pollingInterval: config.pollingInterval || 60000 // 60 segundos (OI atualiza a cada 60s)
    };
    
    this.logger = new Logger('OpenInterestCollector');
    
    // Estado
    this.openInterestData = new Map(); // symbol -> OI
    this.pollingTimer = null;
    this.lastUpdate = 0;
    this.expirationDates = [];
  }

  /**
   * Inicia a coleta de Open Interest
   */
  async start(expirationDates) {
    this.logger.info(`Iniciando coleta de Open Interest para ${this.config.underlying}...`);
    
    if (!expirationDates || expirationDates.length === 0) {
      this.logger.warn('Nenhuma data de expiração fornecida');
      return;
    }
    
    this.expirationDates = expirationDates;
    this.logger.info(`Monitorando ${expirationDates.length} datas de expiração`);
    
    // Fazer carga inicial
    await this.fetchAllOpenInterest();
    
    // Iniciar polling
    this.startPolling();
  }

  /**
   * Para a coleta
   */
  stop() {
    this.logger.info('Parando coleta de Open Interest...');
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Busca Open Interest para todas as datas de expiração
   */
  async fetchAllOpenInterest() {
    this.logger.debug(`Buscando OI para ${this.expirationDates.length} expirações...`);
    
    const promises = this.expirationDates.map(date => 
      this.fetchOpenInterestForExpiry(date)
    );
    
    try {
      await Promise.all(promises);
      this.lastUpdate = Date.now();
      this.logger.success(`OI atualizado: ${this.openInterestData.size} options`);
      this.emit('updated', this.openInterestData.size);
    } catch (error) {
      this.logger.error('Erro ao buscar OI', error);
    }
  }

  /**
   * Busca Open Interest para uma data de expiração específica
   */
  async fetchOpenInterestForExpiry(expiryDate) {
    try {
      // Converter Date para formato YYMMDD
      const formattedDate = this.formatExpiryDate(expiryDate);
      
      const url = `${this.config.restBaseUrl}/eapi/v1/openInterest`;
      const params = {
        underlyingAsset: this.config.underlying,
        expiration: formattedDate
      };
      
      const response = await axios.get(url, { params });
      const data = response.data;
      
      // Armazenar OI por símbolo
      data.forEach(item => {
        this.openInterestData.set(item.symbol, {
          symbol: item.symbol,
          openInterest: parseFloat(item.sumOpenInterest),
          openInterestUsd: parseFloat(item.sumOpenInterestUsd),
          timestamp: parseInt(item.timestamp),
          expiry: expiryDate
        });
      });
      
      this.logger.debug(`OI atualizado para ${formattedDate}: ${data.length} options`);
      
    } catch (error) {
      this.logger.error(`Erro ao buscar OI para ${expiryDate}`, error.response?.data || error.message);
    }
  }

  /**
   * Formata data de expiração para o formato YYMMDD
   */
  formatExpiryDate(date) {
    const year = date.getFullYear().toString().slice(-2); // Últimos 2 dígitos do ano
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * Inicia polling periódico
   */
  startPolling() {
    this.logger.info(`Iniciando polling de OI (intervalo: ${this.config.pollingInterval}ms)`);
    
    this.pollingTimer = setInterval(() => {
      this.fetchAllOpenInterest();
    }, this.config.pollingInterval);
  }

  /**
   * Obtém Open Interest de um símbolo específico
   */
  getOpenInterest(symbol) {
    const data = this.openInterestData.get(symbol);
    return data ? data.openInterest : 0;
  }

  /**
   * Obtém todos os dados de Open Interest
   */
  getAllOpenInterest() {
    return Array.from(this.openInterestData.values());
  }

  /**
   * Obtém estatísticas
   */
  getStats() {
    const totalOI = Array.from(this.openInterestData.values())
      .reduce((sum, item) => sum + item.openInterest, 0);
    
    const totalOIUsd = Array.from(this.openInterestData.values())
      .reduce((sum, item) => sum + item.openInterestUsd, 0);
    
    return {
      underlying: this.config.underlying,
      totalOptions: this.openInterestData.size,
      totalOI: totalOI,
      totalOIUsd: totalOIUsd,
      expirationDates: this.expirationDates.length,
      lastUpdate: this.lastUpdate,
      age: this.lastUpdate > 0 ? Date.now() - this.lastUpdate : null
    };
  }
}

module.exports = OpenInterestCollector;