/**
 * VolumeCollector - Coleta dados de volume e liquidez via REST API
 * NOVO - 2024-12-28
 * 
 * Busca dados do endpoint /eapi/v1/depth para cada option
 */

const axios = require('axios');
const EventEmitter = require('events');
const Logger = require('../utils/logger');

class VolumeCollector extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      restBaseUrl: config.restBaseUrl || process.env.REST_BASE_URL || 'https://eapi.binance.com',
      pollingInterval: config.pollingInterval || 120000, // 2 MINUTOS (era 30s)
      depthLimit: config.depthLimit || 10,
      batchSize: config.batchSize || 10,   // 10 por batch (era 20)
      batchDelay: config.batchDelay || 2000 // 2 SEGUNDOS entre batches (era 300ms)
    };
    
    this.logger = new Logger('VolumeCollector');
    
    // Estado
    this.volumeData = new Map(); // symbol -> { volume, spread, etc }
    this.pollingTimer = null;
    this.lastUpdate = 0;
    this.symbols = [];
  }

  /**
   * Inicia a coleta de volume
   * OTIMIZADO: Filtra apenas options relevantes para evitar ban
   */
  async start(symbols, spotPrice = null) {
    this.logger.info(`Iniciando coleta de volume/liquidez...`);
    
    if (!symbols || symbols.length === 0) {
      this.logger.warn('Nenhum símbolo fornecido');
      return;
    }
    
    // FILTRO: Se temos spotPrice, buscar apenas options próximas ao ATM
    let filteredSymbols = symbols;
    
    if (spotPrice && spotPrice > 0) {
      this.logger.info(`Filtrando options próximas ao spot ($${spotPrice})...`);
      
      filteredSymbols = symbols.filter(symbol => {
        const strike = this.parseStrike(symbol);
        if (!strike) return false;
        
        // Pegar apenas options dentro de ±30% do spot
        const pctFromSpot = Math.abs((strike - spotPrice) / spotPrice);
        return pctFromSpot <= 0.30; // 30% range
      });
      
      this.logger.info(`Filtradas: ${filteredSymbols.length}/${symbols.length} options (±30% do spot)`);
    }
    
    this.symbols = filteredSymbols;
    this.logger.info(`Monitorando ${this.symbols.length} symbols`);
    
    // Fazer carga inicial
    await this.fetchAllVolume();
    
    // Iniciar polling
    this.startPolling();
  }

  /**
   * Parse strike do symbol
   */
  parseStrike(symbol) {
    try {
      const parts = symbol.split('-');
      return parts.length >= 3 ? parseFloat(parts[2]) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Para a coleta
   */
  stop() {
    this.logger.info('Parando coleta de volume...');
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Busca volume para todos os símbolos em batches
   */
  async fetchAllVolume() {
    this.logger.debug(`Buscando volume para ${this.symbols.length} symbols...`);
    
    const batches = this.createBatches(this.symbols, this.config.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      // Processar batch em paralelo
      const promises = batch.map(symbol => this.fetchVolumeForSymbol(symbol));
      await Promise.allSettled(promises);
      
      // Delay entre batches para evitar rate limit
      if (i < batches.length - 1) {
        await new Promise(r => setTimeout(r, this.config.batchDelay));
      }
    }
    
    this.lastUpdate = Date.now();
    this.logger.success(`Volume atualizado: ${this.volumeData.size} options`);
    this.emit('updated', this.volumeData.size);
  }

  /**
   * Busca volume/depth para um símbolo específico
   */
  async fetchVolumeForSymbol(symbol) {
    try {
      const url = `${this.config.restBaseUrl}/eapi/v1/depth`;
      const params = {
        symbol: symbol,
        limit: this.config.depthLimit
      };
      
      const response = await axios.get(url, { params });
      const data = response.data;
      
      // Calcular métricas de liquidez
      const metrics = this.calculateMetrics(data, symbol);
      
      this.volumeData.set(symbol, metrics);
      
    } catch (error) {
      if (error.response?.status === 400) {
        // Symbol pode estar expirado ou inválido - não logar como erro
        this.logger.debug(`Symbol ${symbol} não disponível (400)`);
      } else {
        this.logger.error(`Erro ao buscar depth para ${symbol}:`, error.message);
      }
    }
  }

  /**
   * Calcula métricas de liquidez a partir do depth
   */
  calculateMetrics(depthData, symbol) {
    const bids = depthData.bids || [];
    const asks = depthData.asks || [];
    
    // Best bid/ask
    const bestBid = bids.length > 0 ? parseFloat(bids[0][0]) : 0;
    const bestAsk = asks.length > 0 ? parseFloat(asks[0][0]) : 0;
    
    // Spread
    const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
    const spreadPercent = bestAsk > 0 ? (spread / bestAsk) * 100 : 0;
    
    // Volume no book (soma dos primeiros N níveis)
    const bidVolume = bids.reduce((sum, level) => sum + parseFloat(level[1]), 0);
    const askVolume = asks.reduce((sum, level) => sum + parseFloat(level[1]), 0);
    const totalBookVolume = bidVolume + askVolume;
    
    // Imbalance (desbalanço bid/ask)
    const imbalance = bidVolume > 0 || askVolume > 0 
      ? (bidVolume - askVolume) / (bidVolume + askVolume)
      : 0;
    
    return {
      symbol,
      bestBid,
      bestAsk,
      spread,
      spreadPercent,
      bidVolume,
      askVolume,
      totalBookVolume,
      imbalance,
      bidLevels: bids.length,
      askLevels: asks.length,
      timestamp: Date.now()
    };
  }

  /**
   * Divide array em batches
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Inicia polling periódico
   */
  startPolling() {
    this.logger.info(`Iniciando polling de volume (intervalo: ${this.config.pollingInterval}ms)`);
    
    this.pollingTimer = setInterval(() => {
      this.fetchAllVolume();
    }, this.config.pollingInterval);
  }

  /**
   * Obtém dados de volume de um símbolo
   */
  getVolumeData(symbol) {
    return this.volumeData.get(symbol) || null;
  }

  /**
   * Obtém volume total no book (para compatibilidade)
   */
  getVolume(symbol) {
    const data = this.volumeData.get(symbol);
    return data ? data.totalBookVolume : 0;
  }

  /**
   * Obtém todos os dados de volume
   */
  getAllVolumeData() {
    return Array.from(this.volumeData.values());
  }

  /**
   * Obtém estatísticas
   */
  getStats() {
    const allData = this.getAllVolumeData();
    
    const avgSpread = allData.length > 0
      ? allData.reduce((sum, d) => sum + d.spreadPercent, 0) / allData.length
      : 0;
    
    const totalVolume = allData.reduce((sum, d) => sum + d.totalBookVolume, 0);
    
    return {
      totalSymbols: this.volumeData.size,
      totalVolumeInBook: totalVolume,
      avgSpreadPercent: avgSpread,
      lastUpdate: this.lastUpdate,
      age: this.lastUpdate > 0 ? Date.now() - this.lastUpdate : null
    };
  }
}

module.exports = VolumeCollector;