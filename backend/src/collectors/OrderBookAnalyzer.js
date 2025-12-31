/**
 * ============================================================================
 * ORDER BOOK ANALYZER
 * ============================================================================
 * 
 * Analisa o order book de futuros perpétuos da Binance em tempo real.
 * Calcula métricas de microestrutura de mercado para o Half Pipe Model.
 * 
 * MÉTRICAS PRINCIPAIS:
 * - Book Imbalance (BI): Pressão de compra vs venda
 * - BI Persistence: Sustentação do fluxo direcional
 * - Depth: Profundidade de liquidez
 * - Spread Quality: Qualidade do spread bid/ask
 * - Walls Detection: Detecção de ordens grandes
 * - Energy Score: Score combinado de energia sustentada
 * 
 * CONEXÃO:
 * - WebSocket: wss://fstream.binance.com/ws/{symbol}@depth20@100ms
 * - Update rate: 100ms
 * - Depth levels: 20 níveis de cada lado
 * 
 * AUTOR: Gamma Tracker Team
 * DATA: 2025-12-30
 * ============================================================================
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class OrderBookAnalyzer extends EventEmitter {
  /**
   * Constructor
   * @param {string} symbol - Par de trading (ex: 'btcusdt')
   * @param {object} logger - Logger instance
   * @param {object} config - Configuração opcional
   */
  constructor(symbol, logger, config = {}) {
    super();
    
    this.symbol = symbol.toLowerCase();
    this.logger = logger;
    
    // WebSocket
    this.ws = null;
    this.wsUrl = `wss://fstream.binance.com/ws/${this.symbol}@depth20@100ms`;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.isConnected = false;
    
    // Order Book State
    this.bids = new Map();  // price → quantity
    this.asks = new Map();  // price → quantity
    this.lastUpdateId = 0;
    this.spotPrice = 0;     // Mid price
    
    // Métricas Atuais
    this.metrics = {
      // Book Imbalance
      BI: 0,                    // (Vbid - Vask) / (Vbid + Vask)
      BI_direction: 'NEUTRAL',  // BULLISH, BEARISH, NEUTRAL
      BI_strength: 'WEAK',      // WEAK, MODERATE, STRONG
      
      // BI History (últimos 60s)
      BI_history: [],
      BI_persistence: 0,        // % tempo com BI significativo
      BI_avg_60s: 0,
      
      // Depth (Profundidade)
      totalBidVolume: 0,        // Volume total de bids
      totalAskVolume: 0,        // Volume total de asks
      totalDepth: 0,            // Vbid + Vask
      depthRatio: 1,            // Vbid / Vask
      depthChange: 0,           // % mudança vs média
      depth_history: [],
      
      // Spread
      bestBid: 0,
      bestAsk: 0,
      spread: 0,                // ask - bid
      spread_pct: 0,            // spread / mid
      spread_pulse: 0,          // Volatilidade do spread
      spread_history: [],
      
      // Walls
      bidWall: null,            // { price, size, distance, ratio }
      askWall: null,
      
      // Energy Score (0-1)
      energyScore: 0,
      energyLevel: 'LOW',       // LOW, MEDIUM, HIGH
      
      // Timestamp
      lastUpdate: null
    };
    
    // Histórico (60 segundos)
    this.historyWindow = 60000;  // 60s em ms
    this.updateInterval = 100;   // 100ms
    this.maxHistorySize = Math.ceil(this.historyWindow / this.updateInterval);
    
    // Configuração
    this.config = {
      depthLevels: 20,          // Quantos níveis analisar
      wallThreshold: 10,        // 10x média = wall
      BI_threshold: 0.3,        // BI > 0.3 = significativo
      spread_threshold: 0.001,  // 0.1% = spread normal
      ...config
    };
    
    // Stats
    this.stats = {
      updates: 0,
      errors: 0,
      reconnects: 0,
      startTime: null,
      uptime: 0
    };
  }
  
  /**
   * ========================================================================
   * CONEXÃO WEBSOCKET
   * ========================================================================
   */
  
  /**
   * Conectar ao WebSocket
   */
  connect() {
    if (this.ws) {
      this.logger.warn('OrderBookAnalyzer já está conectado');
      return;
    }
    
    this.logger.info(`Conectando OrderBookAnalyzer: ${this.wsUrl}`);
    
    this.ws = new WebSocket(this.wsUrl);
    
    this.ws.on('open', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.stats.startTime = new Date();
      this.logger.success(`✅ OrderBookAnalyzer conectado: ${this.symbol}`);
      this.emit('connected', { symbol: this.symbol });
    });
    
    this.ws.on('message', (data) => {
      try {
        const update = JSON.parse(data);
        this.handleDepthUpdate(update);
      } catch (error) {
        this.logger.error('Erro ao processar mensagem do order book:', error);
        this.stats.errors++;
      }
    });
    
    this.ws.on('error', (error) => {
      this.logger.error('WebSocket error (OrderBook):', error);
      this.stats.errors++;
      this.emit('error', error);
    });
    
    this.ws.on('close', () => {
      this.isConnected = false;
      this.logger.warn('OrderBookAnalyzer desconectado');
      this.emit('disconnected');
      
      // Auto-reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.logger.info(`Tentando reconectar OrderBookAnalyzer (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        setTimeout(() => this.reconnect(), this.reconnectDelay);
      } else {
        this.logger.error('Max reconnect attempts reached (OrderBook)');
        this.emit('max-reconnect-attempts');
      }
    });
  }
  
  /**
   * Reconectar
   */
  reconnect() {
    this.ws = null;
    this.stats.reconnects++;
    this.connect();
  }
  
  /**
   * Desconectar
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.logger.info('OrderBookAnalyzer desconectado manualmente');
    }
  }
  
  /**
   * ========================================================================
   * PROCESSAMENTO DE DADOS
   * ========================================================================
   */
  
  /**
   * Processar update do order book
   * @param {object} update - Dados do WebSocket
   */
  handleDepthUpdate(update) {
    try {
      // Validar update
      if (!update.b || !update.a) {
        return;
      }
      
      // Atualizar bids
      for (const [price, qty] of update.b) {
        const priceNum = parseFloat(price);
        const qtyNum = parseFloat(qty);
        
        if (qtyNum === 0) {
          this.bids.delete(priceNum);
        } else {
          this.bids.set(priceNum, qtyNum);
        }
      }
      
      // Atualizar asks
      for (const [price, qty] of update.a) {
        const priceNum = parseFloat(price);
        const qtyNum = parseFloat(qty);
        
        if (qtyNum === 0) {
          this.asks.delete(priceNum);
        } else {
          this.asks.set(priceNum, qtyNum);
        }
      }
      
      // Atualizar métricas
      this.calculateMetrics();
      
      // Stats
      this.stats.updates++;
      
      // Emit event
      this.emit('update', this.metrics);
      
    } catch (error) {
      this.logger.error('Erro ao processar depth update:', error);
      this.stats.errors++;
    }
  }
  
  /**
   * ========================================================================
   * CÁLCULO DE MÉTRICAS
   * ========================================================================
   */
  
  /**
   * Calcular todas as métricas
   */
  calculateMetrics() {
    const now = Date.now();
    
    // 1. Best bid/ask e spread
    this.calculateSpread();
    
    // 2. Volumes totais
    this.calculateVolumes();
    
    // 3. Book Imbalance (BI)
    this.calculateBookImbalance();
    
    // 4. Depth analysis
    this.calculateDepth();
    
    // 5. Walls detection
    this.detectWalls();
    
    // 6. Energy Score
    this.calculateEnergyScore();
    
    // 7. Atualizar histórico
    this.updateHistory(now);
    
    // 8. Calcular métricas derivadas
    this.calculateDerivedMetrics();
    
    // Timestamp
    this.metrics.lastUpdate = now;
  }
  
  /**
   * Calcular spread
   */
  calculateSpread() {
    if (this.bids.size === 0 || this.asks.size === 0) {
      return;
    }
    
    // Best bid = maior preço de compra
    this.metrics.bestBid = Math.max(...Array.from(this.bids.keys()));
    
    // Best ask = menor preço de venda
    this.metrics.bestAsk = Math.min(...Array.from(this.asks.keys()));
    
    // Spread absoluto
    this.metrics.spread = this.metrics.bestAsk - this.metrics.bestBid;
    
    // Mid price (spot price)
    this.spotPrice = (this.metrics.bestBid + this.metrics.bestAsk) / 2;
    
    // Spread percentual
    this.metrics.spread_pct = this.metrics.spread / this.spotPrice;
    
    // Adicionar ao histórico
    this.metrics.spread_history.push({
      time: Date.now(),
      spread: this.metrics.spread,
      spread_pct: this.metrics.spread_pct
    });
    
    // Limitar histórico
    if (this.metrics.spread_history.length > this.maxHistorySize) {
      this.metrics.spread_history.shift();
    }
  }
  
  /**
   * Calcular volumes totais
   */
  calculateVolumes() {
    // Volume total de bids
    this.metrics.totalBidVolume = Array.from(this.bids.values())
      .reduce((sum, qty) => sum + qty, 0);
    
    // Volume total de asks
    this.metrics.totalAskVolume = Array.from(this.asks.values())
      .reduce((sum, qty) => sum + qty, 0);
    
    // Depth total
    this.metrics.totalDepth = this.metrics.totalBidVolume + this.metrics.totalAskVolume;
    
    // Ratio
    if (this.metrics.totalAskVolume > 0) {
      this.metrics.depthRatio = this.metrics.totalBidVolume / this.metrics.totalAskVolume;
    }
  }
  
  /**
   * Calcular Book Imbalance (BI)
   */
  calculateBookImbalance() {
    const Vbid = this.metrics.totalBidVolume;
    const Vask = this.metrics.totalAskVolume;
    
    if (Vbid + Vask === 0) {
      this.metrics.BI = 0;
      return;
    }
    
    // BI = (Vbid - Vask) / (Vbid + Vask)
    this.metrics.BI = (Vbid - Vask) / (Vbid + Vask);
    
    // Classificar direção
    if (this.metrics.BI > this.config.BI_threshold) {
      this.metrics.BI_direction = 'BULLISH';
    } else if (this.metrics.BI < -this.config.BI_threshold) {
      this.metrics.BI_direction = 'BEARISH';
    } else {
      this.metrics.BI_direction = 'NEUTRAL';
    }
    
    // Classificar força
    const absBI = Math.abs(this.metrics.BI);
    if (absBI > 0.6) {
      this.metrics.BI_strength = 'STRONG';
    } else if (absBI > 0.3) {
      this.metrics.BI_strength = 'MODERATE';
    } else {
      this.metrics.BI_strength = 'WEAK';
    }
    
    // Adicionar ao histórico
    this.metrics.BI_history.push({
      time: Date.now(),
      BI: this.metrics.BI,
      direction: this.metrics.BI_direction
    });
    
    // Limitar histórico
    if (this.metrics.BI_history.length > this.maxHistorySize) {
      this.metrics.BI_history.shift();
    }
  }
  
  /**
   * Calcular depth analysis
   */
  calculateDepth() {
    // Adicionar ao histórico
    this.metrics.depth_history.push({
      time: Date.now(),
      totalDepth: this.metrics.totalDepth,
      bidVolume: this.metrics.totalBidVolume,
      askVolume: this.metrics.totalAskVolume
    });
    
    // Limitar histórico
    if (this.metrics.depth_history.length > this.maxHistorySize) {
      this.metrics.depth_history.shift();
    }
    
    // Calcular mudança vs média
    if (this.metrics.depth_history.length > 10) {
      const avgDepth = this.metrics.depth_history
        .slice(-60)  // Últimos 60 updates (~6s)
        .reduce((sum, d) => sum + d.totalDepth, 0) / 60;
      
      this.metrics.depthChange = (this.metrics.totalDepth - avgDepth) / avgDepth;
    }
  }
  
  /**
   * Detectar walls (ordens grandes)
   */
  detectWalls() {
    // Calcular tamanho médio das ordens
    const avgBidSize = this.metrics.totalBidVolume / this.bids.size;
    const avgAskSize = this.metrics.totalAskVolume / this.asks.size;
    
    // Detectar bid wall
    let maxBid = { price: 0, size: 0, ratio: 0 };
    for (const [price, qty] of this.bids.entries()) {
      const ratio = qty / avgBidSize;
      if (ratio > this.config.wallThreshold && qty > maxBid.size) {
        maxBid = { price, size: qty, ratio };
      }
    }
    
    if (maxBid.size > 0) {
      const distance = ((this.spotPrice - maxBid.price) / this.spotPrice) * 100;
      this.metrics.bidWall = {
        price: maxBid.price,
        size: maxBid.size,
        ratio: maxBid.ratio,
        distance: distance  // % abaixo do spot
      };
    } else {
      this.metrics.bidWall = null;
    }
    
    // Detectar ask wall
    let maxAsk = { price: 0, size: 0, ratio: 0 };
    for (const [price, qty] of this.asks.entries()) {
      const ratio = qty / avgAskSize;
      if (ratio > this.config.wallThreshold && qty > maxAsk.size) {
        maxAsk = { price, size: qty, ratio };
      }
    }
    
    if (maxAsk.size > 0) {
      const distance = ((maxAsk.price - this.spotPrice) / this.spotPrice) * 100;
      this.metrics.askWall = {
        price: maxAsk.price,
        size: maxAsk.size,
        ratio: maxAsk.ratio,
        distance: distance  // % acima do spot
      };
    } else {
      this.metrics.askWall = null;
    }
  }
  
  /**
   * Calcular Energy Score
   * 
   * Combina múltiplos fatores:
   * - |BI| (40%): Magnitude do imbalance
   * - BI persistence (30%): Sustentação do fluxo
   * - Spread quality (20%): Qualidade do spread
   * - Depth (10%): Profundidade relativa
   */
  calculateEnergyScore() {
    let score = 0;
    
    // 1. |BI| component (0-1)
    const BI_component = Math.min(Math.abs(this.metrics.BI) / 0.8, 1.0);
    score += BI_component * 0.4;
    
    // 2. BI persistence component (0-1)
    score += this.metrics.BI_persistence * 0.3;
    
    // 3. Spread quality component (0-1)
    // Spread menor = melhor qualidade
    const spread_quality = Math.max(0, 1 - (this.metrics.spread_pct / this.config.spread_threshold));
    score += spread_quality * 0.2;
    
    // 4. Depth component (0-1)
    // Depth maior que média = melhor
    const depth_component = Math.max(0, Math.min(1 + this.metrics.depthChange, 1.0));
    score += depth_component * 0.1;
    
    this.metrics.energyScore = Math.max(0, Math.min(score, 1.0));
    
    // Classificar nível
    if (this.metrics.energyScore > 0.7) {
      this.metrics.energyLevel = 'HIGH';
    } else if (this.metrics.energyScore > 0.4) {
      this.metrics.energyLevel = 'MEDIUM';
    } else {
      this.metrics.energyLevel = 'LOW';
    }
  }
  
  /**
   * Atualizar histórico
   */
  updateHistory(now) {
    // Limpar dados antigos (>60s)
    const cutoff = now - this.historyWindow;
    
    this.metrics.BI_history = this.metrics.BI_history.filter(h => h.time > cutoff);
    this.metrics.depth_history = this.metrics.depth_history.filter(h => h.time > cutoff);
    this.metrics.spread_history = this.metrics.spread_history.filter(h => h.time > cutoff);
  }
  
  /**
   * Calcular métricas derivadas
   */
  calculateDerivedMetrics() {
    // BI Persistence: % do tempo com BI significativo na mesma direção
    if (this.metrics.BI_history.length > 10) {
      const significantCount = this.metrics.BI_history.filter(h => 
        Math.abs(h.BI) > this.config.BI_threshold &&
        h.direction === this.metrics.BI_direction
      ).length;
      
      this.metrics.BI_persistence = significantCount / this.metrics.BI_history.length;
    }
    
    // BI Average 60s
    if (this.metrics.BI_history.length > 0) {
      this.metrics.BI_avg_60s = this.metrics.BI_history
        .reduce((sum, h) => sum + h.BI, 0) / this.metrics.BI_history.length;
    }
    
    // Spread Pulse (volatilidade do spread)
    if (this.metrics.spread_history.length > 10) {
      const spreads = this.metrics.spread_history.map(h => h.spread_pct);
      const mean = spreads.reduce((sum, s) => sum + s, 0) / spreads.length;
      const variance = spreads.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / spreads.length;
      this.metrics.spread_pulse = Math.sqrt(variance);
    }
  }
  
  /**
   * ========================================================================
   * MÉTODOS PÚBLICOS - GETTERS
   * ========================================================================
   */
  
  /**
   * Obter todas as métricas
   */
  getMetrics() {
    return {
      ...this.metrics,
      spotPrice: this.spotPrice,
      symbol: this.symbol
    };
  }
  
  /**
   * Obter Book Imbalance
   */
  getBookImbalance() {
    return {
      BI: this.metrics.BI,
      direction: this.metrics.BI_direction,
      strength: this.metrics.BI_strength,
      persistence: this.metrics.BI_persistence,
      avg_60s: this.metrics.BI_avg_60s
    };
  }
  
  /**
   * Obter Depth analysis
   */
  getDepth() {
    return {
      totalDepth: this.metrics.totalDepth,
      bidVolume: this.metrics.totalBidVolume,
      askVolume: this.metrics.totalAskVolume,
      ratio: this.metrics.depthRatio,
      change: this.metrics.depthChange
    };
  }
  
  /**
   * Obter Spread quality
   */
  getSpreadQuality() {
    return {
      spread: this.metrics.spread,
      spread_pct: this.metrics.spread_pct,
      pulse: this.metrics.spread_pulse,
      bestBid: this.metrics.bestBid,
      bestAsk: this.metrics.bestAsk
    };
  }
  
  /**
   * Obter Walls
   */
  getWalls() {
    return {
      bidWall: this.metrics.bidWall,
      askWall: this.metrics.askWall
    };
  }
  
  /**
   * Obter Energy Score
   */
  getEnergyScore() {
    return {
      score: this.metrics.energyScore,
      level: this.metrics.energyLevel,
      components: {
        BI: Math.abs(this.metrics.BI),
        persistence: this.metrics.BI_persistence,
        spread_quality: 1 - (this.metrics.spread_pct / this.config.spread_threshold),
        depth: 1 + this.metrics.depthChange
      }
    };
  }
  
  /**
   * Obter histórico completo
   */
  getHistory() {
    return {
      BI_history: this.metrics.BI_history,
      depth_history: this.metrics.depth_history,
      spread_history: this.metrics.spread_history
    };
  }
  
  /**
   * Obter estatísticas
   */
  getStats() {
    if (this.stats.startTime) {
      this.stats.uptime = Date.now() - this.stats.startTime;
    }
    
    return {
      ...this.stats,
      isConnected: this.isConnected,
      symbol: this.symbol,
      bidsCount: this.bids.size,
      asksCount: this.asks.size
    };
  }
}

module.exports = OrderBookAnalyzer;
