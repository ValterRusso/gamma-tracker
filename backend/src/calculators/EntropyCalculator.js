/**
 * ============================================================================
 * ENTROPY CALCULATOR
 * ============================================================================
 * 
 * Calcula entropia de Shannon do order book para detectar concentração
 * de liquidez e prever reversões de preço.
 * 
 * MÉTRICAS PRINCIPAIS:
 * - Bid Entropy: Entropia dos níveis de compra
 * - Ask Entropy: Entropia dos níveis de venda
 * - Ratio BID/ASK: Assimetria de concentração
 * - Delta 5m/15m: Mudança percentual de entropia
 * - Dynamic Bands: Bandas de Bollinger para entropia
 * 
 * EVENTOS DETECTADOS:
 * - BID_COLLAPSE: Entropia BID cai >15% (reversão de fundo)
 * - ASK_SPIKE: Entropia ASK sobe >15% (reversão de topo)
 * - SQUEEZE: Ambas as entropias colapsam (compressão extrema)
 * 
 * FÓRMULA DE SHANNON:
 * H = -Σ (p_i * log₂(p_i))
 * Onde p_i = volume_i / volume_total
 * 
 * AUTOR: Valter Russo - Gamma Tracker Team
 * DATA: 2026-01-04
 * ============================================================================
 */

const EventEmitter = require('events');

class EntropyCalculator extends EventEmitter {
  /**
   * Constructor
   * @param {object} logger - Logger instance
   * @param {object} config - Configuração opcional
   */
  constructor(logger, config = {}) {
    super();
    
    this.logger = logger;
    
    // Configuração
    this.config = {
      // Histórico
      historyWindow: 900000,        // 15 minutos em ms
      maxHistorySize: 1800,          // 1800 pontos (30s interval = 15min)
      
      // Thresholds de eventos (BTC)
      collapseThreshold: -0.18,      // -18% = colapso (mais conservador)
      spikeThreshold: 0.18,          // +18% = spike (mais conservador)
      squeezeThreshold: -0.12,       // -12% ambos = squeeze
      
      // Banda dinâmica (Bollinger)
      bandWindow: 20,                // 20 pontos para média móvel
      bandStdDevs: 2,                // 2 desvios padrão
      
      // Persistência de evento
      eventPersistence: 3,           // 3 amostras consecutivas
      
      // Rate limiting
      minCalculationInterval: 1000,  // Mínimo 1 segundo entre cálculos
      
      // Event cooldown
      eventCooldown: 30000,          // 30 segundos entre mesmos eventos
      
      ...config
    };
    
    // Histórico de entropia
    this.history = {
      bid: [],    // { timestamp, entropy }
      ask: [],
      ratio: []   // { timestamp, ratio }
    };
    
    // Última entropia calculada
    this.current = {
      bid_entropy: 0,
      ask_entropy: 0,
      ratio: 1,
      timestamp: null
    };
    
    // Bandas dinâmicas
    this.bands = {
      bid: { mean: null, upper: null, lower: null, stdDev: null, ready: false },
      ask: { mean: null, upper: null, lower: null, stdDev: null, ready: false }
    };
    
    // Eventos recentes
    this.recentEvents = [];
    this.maxRecentEvents = 50;
    
    // Rate limiting
    this.lastCalculationTime = 0;
    
    // Event cooldown tracking
    this.lastEventTime = {
      BID_COLLAPSE: 0,
      ASK_SPIKE: 0,
      SQUEEZE: 0
    };
    
    // Stats
    this.stats = {
      calculations: 0,
      events_detected: 0,
      bid_collapses: 0,
      ask_spikes: 0,
      squeezes: 0,
      rate_limited: 0,
      cooldown_skipped: 0
    };
  }
  
  /**
   * ========================================================================
   * CÁLCULO DE ENTROPIA
   * ========================================================================
   */
  
  /**
   * Calcular entropia de Shannon
   * @param {Array} volumes - Array de volumes [v1, v2, v3, ...]
   * @returns {number} - Entropia em bits
   */
  calculateShannon(volumes) {
    // Filtrar volumes válidos (> 0)
    const validVolumes = volumes.filter(v => v > 0);
    
    if (validVolumes.length === 0) {
      return 0;
    }
    
    // Calcular total
    const total = validVolumes.reduce((sum, v) => sum + v, 0);
    
    if (total === 0) {
      return 0;
    }
    
    // Calcular probabilidades
    const probabilities = validVolumes.map(v => v / total);
    
    // Calcular entropia: H = -Σ (p_i * log₂(p_i))
    const entropy = -probabilities.reduce((sum, p) => {
      return sum + (p * Math.log2(p));
    }, 0);
    
    return entropy;
  }
  
  /**
   * Calcular entropia do order book
   * @param {Map|Array} bids - Bids do order book (Map<price, volume> ou [[price, volume], ...])
   * @param {Map|Array} asks - Asks do order book
   * @returns {object} - { bid_entropy, ask_entropy, ratio, timestamp }
   */
  calculate(bids, asks) {
    try {
      const timestamp = Date.now();
      
      // Rate limiting: Skip if called too frequently
      if (timestamp - this.lastCalculationTime < this.config.minCalculationInterval) {
        this.stats.rate_limited++;
        return this.current; // Return last calculation
      }
      
      this.lastCalculationTime = timestamp;
      
      // Converter Map para Array se necessário
      const bidVolumes = this._extractVolumes(bids);
      const askVolumes = this._extractVolumes(asks);
      
      // Calcular entropias
      const bid_entropy = this.calculateShannon(bidVolumes);
      const ask_entropy = this.calculateShannon(askVolumes);
      
      // Calcular ratio
      const ratio = ask_entropy > 0 ? bid_entropy / ask_entropy : 1;
      
      // Atualizar current
      this.current = {
        bid_entropy,
        ask_entropy,
        ratio,
        timestamp
      };
      
      // Adicionar ao histórico
      this._addToHistory(timestamp, bid_entropy, ask_entropy, ratio);
      
      // Atualizar bandas dinâmicas
      this._updateBands();
      
      // Detectar eventos
      const event = this._detectEvent();
      
      // Stats
      this.stats.calculations++;
      
      // Emit event
      this.emit('calculated', {
        ...this.current,
        bands: this.bands,
        event
      });
      
      return {
        ...this.current,
        bands: this.bands,
        event
      };
      
    } catch (error) {
      this.logger.error('Erro ao calcular entropia:', error);
      return null;
    }
  }
  
  /**
   * Extrair volumes de bids/asks
   * @private
   */
  _extractVolumes(data) {
    if (!data) return [];
    
    // Se for Map
    if (data instanceof Map) {
      return Array.from(data.values());
    }
    
    // Se for Array de [price, volume]
    if (Array.isArray(data)) {
      return data.map(item => {
        if (Array.isArray(item)) {
          return parseFloat(item[1]); // [price, volume]
        }
        return parseFloat(item.volume || item.qty || item);
      });
    }
    
    return [];
  }
  
  /**
   * ========================================================================
   * HISTÓRICO E BANDAS
   * ========================================================================
   */
  
  /**
   * Adicionar ao histórico
   * @private
   */
  _addToHistory(timestamp, bid_entropy, ask_entropy, ratio) {
    // Adicionar ao histórico
    this.history.bid.push({ timestamp, entropy: bid_entropy });
    this.history.ask.push({ timestamp, entropy: ask_entropy });
    this.history.ratio.push({ timestamp, ratio });
    
    // Limitar tamanho do histórico
    const cutoff = timestamp - this.config.historyWindow;
    
    this.history.bid = this.history.bid.filter(h => h.timestamp > cutoff);
    this.history.ask = this.history.ask.filter(h => h.timestamp > cutoff);
    this.history.ratio = this.history.ratio.filter(h => h.timestamp > cutoff);
    
    // Limitar por tamanho máximo também
    if (this.history.bid.length > this.config.maxHistorySize) {
      this.history.bid.shift();
    }
    if (this.history.ask.length > this.config.maxHistorySize) {
      this.history.ask.shift();
    }
    if (this.history.ratio.length > this.config.maxHistorySize) {
      this.history.ratio.shift();
    }
  }
  
  /**
   * Atualizar bandas dinâmicas (Bollinger-style)
   * @private
   */
  _updateBands() {
    // Banda BID
    if (this.history.bid.length >= this.config.bandWindow) {
      const bidValues = this.history.bid
        .slice(-this.config.bandWindow)
        .map(h => h.entropy);
      
      this.bands.bid = { ...this._calculateBand(bidValues), ready: true };
    } else {
      this.bands.bid = { mean: null, upper: null, lower: null, stdDev: null, ready: false };
    }
    
    // Banda ASK
    if (this.history.ask.length >= this.config.bandWindow) {
      const askValues = this.history.ask
        .slice(-this.config.bandWindow)
        .map(h => h.entropy);
      
      this.bands.ask = { ...this._calculateBand(askValues), ready: true };
    } else {
      this.bands.ask = { mean: null, upper: null, lower: null, stdDev: null, ready: false };
    }
  }
  
  /**
   * Calcular banda (média ± N desvios padrão)
   * @private
   */
  _calculateBand(values) {
    const n = values.length;
    
    // Média
    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    
    // Desvio padrão
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    // Bandas
    const upper = mean + (this.config.bandStdDevs * stdDev);
    const lower = mean - (this.config.bandStdDevs * stdDev);
    
    return { mean, upper, lower, stdDev };
  }
  
  /**
   * ========================================================================
   * DELTAS E MÉTRICAS DERIVADAS
   * ========================================================================
   */
  
  /**
   * Calcular delta (mudança percentual)
   * @param {string} type - 'bid' ou 'ask'
   * @param {number} windowMs - Janela de tempo em ms (ex: 300000 = 5min)
   * @returns {number} - Delta percentual
   */
  calculateDelta(type, windowMs) {
    const history = this.history[type];
    
    if (history.length < 2) {
      return 0;
    }
    
    const now = Date.now();
    const cutoff = now - windowMs;
    
    // Encontrar valor mais antigo dentro da janela
    const oldValue = history.find(h => h.timestamp >= cutoff);
    
    if (!oldValue) {
      // Se não encontrou, usar o mais antigo disponível
      const oldest = history[0];
      const current = history[history.length - 1];
      
      if (oldest.entropy === 0) return 0;
      
      return (current.entropy - oldest.entropy) / oldest.entropy;
    }
    
    const current = this.current[`${type}_entropy`];
    
    if (oldValue.entropy === 0) return 0;
    
    return (current - oldValue.entropy) / oldValue.entropy;
  }
  
  /**
   * Obter métricas completas
   * @returns {object}
   */
  getMetrics() {
    return {
      // Valores atuais
      bid_entropy: this.current.bid_entropy,
      ask_entropy: this.current.ask_entropy,
      ratio: this.current.ratio,
      timestamp: this.current.timestamp,
      
      // Deltas
      bid_delta_5m: this.calculateDelta('bid', 300000),   // 5 min
      ask_delta_5m: this.calculateDelta('ask', 300000),
      bid_delta_15m: this.calculateDelta('bid', 900000),  // 15 min
      ask_delta_15m: this.calculateDelta('ask', 900000),
      
      // Bandas
      bands: this.bands,
      
      // Histórico (últimos N pontos)
      history: {
        bid: this.history.bid.slice(-100),
        ask: this.history.ask.slice(-100),
        ratio: this.history.ratio.slice(-100)
      },
      
      // Stats
      stats: this.stats
    };
  }
  
  /**
   * ========================================================================
   * DETECÇÃO DE EVENTOS
   * ========================================================================
   */
  
  /**
   * Detectar eventos (colapsos, spikes, squeezes)
   * @private
   * @returns {object|null} - Evento detectado ou null
   */
  _detectEvent() {
    const bid_delta_5m = this.calculateDelta('bid', 300000);
    const ask_delta_5m = this.calculateDelta('ask', 300000);
    
    let event = null;
    
    // 1. BID COLLAPSE (reversão de fundo)
    if (bid_delta_5m < this.config.collapseThreshold) {
      event = {
        type: 'BID_COLLAPSE',
        timestamp: this.current.timestamp,
        bid_entropy: this.current.bid_entropy,
        bid_delta: bid_delta_5m,
        confidence: Math.min(Math.abs(bid_delta_5m) / 0.20, 1.0),
        signal: 'BUY',
        interpretation: 'Strong BID collapse detected! Whale absorbing sells. Potential reversal imminent.'
      };
      
      this.stats.bid_collapses++;
      this.stats.events_detected++;
    }
    
    // 2. ASK SPIKE (reversão de topo)
    else if (ask_delta_5m > this.config.spikeThreshold) {
      event = {
        type: 'ASK_SPIKE',
        timestamp: this.current.timestamp,
        ask_entropy: this.current.ask_entropy,
        ask_delta: ask_delta_5m,
        confidence: Math.min(ask_delta_5m / 0.20, 1.0),
        signal: 'SELL',
        interpretation: 'ASK entropy spike detected! Sellers positioning. Potential top forming.'
      };
      
      this.stats.ask_spikes++;
      this.stats.events_detected++;
    }
    
    // 3. SQUEEZE (ambos colapsam)
    else if (bid_delta_5m < this.config.squeezeThreshold && 
             ask_delta_5m < this.config.squeezeThreshold) {
      event = {
        type: 'SQUEEZE',
        timestamp: this.current.timestamp,
        bid_entropy: this.current.bid_entropy,
        ask_entropy: this.current.ask_entropy,
        bid_delta: bid_delta_5m,
        ask_delta: ask_delta_5m,
        confidence: Math.min((Math.abs(bid_delta_5m) + Math.abs(ask_delta_5m)) / 0.40, 1.0),
        signal: 'NEUTRAL',
        interpretation: 'Extreme liquidity concentration on both sides. Breakout imminent!'
      };
      
      this.stats.squeezes++;
      this.stats.events_detected++;
    }
    
    // Adicionar evento à lista de recentes
    if (event) {
      // Cooldown check: Skip if same event type emitted recently
      const timeSinceLastEvent = Date.now() - this.lastEventTime[event.type];
      
      if (timeSinceLastEvent < this.config.eventCooldown) {
        this.stats.cooldown_skipped++;
        return null; // Skip event, still in cooldown
      }
      
      // Update last event time
      this.lastEventTime[event.type] = Date.now();
      
      this.recentEvents.push(event);
      
      // Limitar tamanho
      if (this.recentEvents.length > this.maxRecentEvents) {
        this.recentEvents.shift();
      }
      
      // Emit event
      this.emit('event', event);
      
      this.logger.info(`🚨 Entropy Event: ${event.type} (confidence: ${(event.confidence * 100).toFixed(0)}%)`);
    }
    
    return event;
  }
  
  /**
   * Obter eventos recentes
   * @param {number} limit - Número máximo de eventos
   * @param {string} type - Tipo de evento (opcional)
   * @returns {Array}
   */
  getRecentEvents(limit = 10, type = null) {
    let events = this.recentEvents;
    
    // Filtrar por tipo se especificado
    if (type) {
      events = events.filter(e => e.type === type);
    }
    
    // Ordenar por timestamp (mais recente primeiro)
    events = events.sort((a, b) => b.timestamp - a.timestamp);
    
    // Limitar
    return events.slice(0, limit);
  }
  
  /**
   * ========================================================================
   * UTILIDADES
   * ========================================================================
   */
  
  /**
   * Obter histórico completo
   * @param {number} limit - Número máximo de pontos
   * @returns {Array}
   */
   getHistory(limit = 1000) {
    const minLength = Math.min(
      this.history.bid.length,
      this.history.ask.length,
      this.history.ratio.length
    );
    
    const start = Math.max(0, minLength - limit);
    
    return Array.from({ length: minLength - start }, (_, i) => {
      const idx = start + i;
      return {
        timestamp: this.history.bid[idx].timestamp,
        bid_entropy: this.history.bid[idx].entropy,
        ask_entropy: this.history.ask[idx].entropy,
        ratio: this.history.ratio[idx].ratio
      };
    });
  }
  
  /**
   * Reset histórico
   */
  reset() {
    this.history = {
      bid: [],
      ask: [],
      ratio: []
    };
    
    this.current = {
      bid_entropy: 0,
      ask_entropy: 0,
      ratio: 1,
      timestamp: null
    };
    
    this.bands = {
      bid: { mean: 0, upper: 0, lower: 0 },
      ask: { mean: 0, upper: 0, lower: 0 }
    };
    
    this.recentEvents = [];
    
    this.logger.info('EntropyCalculator reset');
  }
  
  /**
   * Obter stats
   * @returns {object}
   */
  getStats() {
    return {
      ...this.stats,
      history_size: {
        bid: this.history.bid.length,
        ask: this.history.ask.length,
        ratio: this.history.ratio.length
      },
      recent_events: this.recentEvents.length
    };
  }
}

module.exports = EntropyCalculator;
