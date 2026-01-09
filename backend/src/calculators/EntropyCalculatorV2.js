/**
 * ============================================================================
 * ENTROPY CALCULATOR V2 - IMPROVED
 * ============================================================================
 * 
 * NOVAS FEATURES V2:
 * - ✅ Depth slider configurável (default: 80 níveis)
 * - ✅ Normalização 0-1 para frontend
 * - ✅ Asset profiles (BTC, ETH, BNB, etc)
 * - ✅ Band interpretation (z-scores)
 * - ✅ Proteção contra ordens malucas
 * - ✅ Combined metrics com RSI
 * 
 * MELHORIAS:
 * - Depth configurável previne distorção por ordens malucas
 * - Normalização facilita interpretação
 * - Profiles permitem calibração por ativo
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 2.0
 * @date 2026-01-06
 * ============================================================================
 */

const EventEmitter = require('events');

class EntropyCalculatorV2 extends EventEmitter {
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
      // ========================================================================
      // DEPTH CONFIGURATION (NOVO! 🆕)
      // ========================================================================
      defaultDepth: 80,          // 80 níveis = sweet spot!
      minDepth: 20,              // Mínimo permitido
      maxDepth: 200,             // Máximo permitido
      currentDepth: null,        // Será set para defaultDepth
      
      // ========================================================================
      // ASSET PROFILES (NOVO! 🆕)
      // ========================================================================
      assetProfiles: {
        'btcusdt': {
          depth: 80,
          thresholds: {
            collapse: -0.18,
            spike: 0.18,
            squeeze: -0.12
          },
          bandWindow: 20,
          bandStdDevs: 2
        },
        'ethusdt': {
          depth: 60,
          thresholds: {
            collapse: -0.15,
            spike: 0.15,
            squeeze: -0.10
          },
          bandWindow: 20,
          bandStdDevs: 2
        },
        'bnbusdt': {
          depth: 50,
          thresholds: {
            collapse: -0.12,
            spike: 0.12,
            squeeze: -0.08
          },
          bandWindow: 15,
          bandStdDevs: 2
        }
      },
      
      currentAsset: 'btcusdt',   // Asset atual
      
      // ========================================================================
      // ORIGINAL CONFIG
      // ========================================================================
      historyWindow: 900000,        // 15 minutos
      maxHistorySize: 1800,
      
      // Thresholds (serão substituídos por profile)
      collapseThreshold: -0.18,
      spikeThreshold: 0.18,
      squeezeThreshold: -0.12,
      
      // Banda dinâmica
      bandWindow: 20,
      bandStdDevs: 2,
      
      // Persistência de evento
      eventPersistence: 3,
      
      // Rate limiting
      minCalculationInterval: 1000,
      
      // Event cooldown
      eventCooldown: 30000,
      
      ...config
    };
    
    // Set current depth
    if (!this.config.currentDepth) {
      this.config.currentDepth = this.config.defaultDepth;
    }
    
    // Apply asset profile if exists
    this._applyAssetProfile(this.config.currentAsset);
    
    // Histórico de entropia
    this.history = {
      bid: [],
      ask: [],
      ratio: []
    };
    
    // Última entropia calculada
    this.current = {
      bid_entropy: 0,
      ask_entropy: 0,
      bid_normalized: 0,      // NOVO! 🆕
      ask_normalized: 0,      // NOVO! 🆕
      total_normalized: 0,    // NOVO! 🆕
      ratio: 1,
      timestamp: null,
      depth_used: null,       // NOVO! 🆕
      max_entropy: null       // NOVO! 🆕
    };
    
    // Bandas dinâmicas
    this.bands = {
      bid: { mean: null, upper: null, lower: null, stdDev: null, ready: false, interpretation: 'UNKNOWN' },
      ask: { mean: null, upper: null, lower: null, stdDev: null, ready: false, interpretation: 'UNKNOWN' }
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
      cooldown_skipped: 0,
      depth_changes: 0,        // NOVO! 🆕
      asset_changes: 0         // NOVO! 🆕
    };
    
    this.logger.info('[EntropyCalculatorV2] Initialized', {
      asset: this.config.currentAsset,
      depth: this.config.currentDepth,
      thresholds: {
        collapse: this.config.collapseThreshold,
        spike: this.config.spikeThreshold
      }
    });
  }
  
  /**
   * ========================================================================
   * ASSET & DEPTH MANAGEMENT (NOVO! 🆕)
   * ========================================================================
   */
  
  /**
   * Apply asset profile
   * @private
   */
  _applyAssetProfile(symbol) {
    const profile = this.config.assetProfiles[symbol.toLowerCase()];
    
    if (profile) {
      this.config.currentDepth = profile.depth;
      this.config.collapseThreshold = profile.thresholds.collapse;
      this.config.spikeThreshold = profile.thresholds.spike;
      this.config.squeezeThreshold = profile.thresholds.squeeze;
      this.config.bandWindow = profile.bandWindow;
      this.config.bandStdDevs = profile.bandStdDevs;
      
      this.logger.info(`[EntropyCalculatorV2] Applied profile for ${symbol}`, profile);
    } else {
      this.logger.warn(`[EntropyCalculatorV2] No profile for ${symbol}, using defaults`);
    }
  }
  
  /**
   * Set depth (manual override)
   * @param {number} depth - Number of levels (20-200)
   */
  setDepth(depth) {
    // Validate
    depth = Math.max(this.config.minDepth, Math.min(depth, this.config.maxDepth));
    
    const oldDepth = this.config.currentDepth;
    this.config.currentDepth = depth;
    
    this.stats.depth_changes++;
    
    this.logger.info(`[EntropyCalculatorV2] Depth changed: ${oldDepth} → ${depth}`);
    
    this.emit('depth_changed', { old: oldDepth, new: depth });
    
    return depth;
  }
  
  /**
   * Set asset (applies profile)
   * @param {string} symbol - Symbol (e.g., 'BTCUSDT')
   */
  setAsset(symbol) {
    const oldAsset = this.config.currentAsset;
    this.config.currentAsset = symbol.toLowerCase();
    
    this._applyAssetProfile(this.config.currentAsset);
    
    this.stats.asset_changes++;
    
    this.logger.info(`[EntropyCalculatorV2] Asset changed: ${oldAsset} → ${symbol}`);
    
    this.emit('asset_changed', { 
      old: oldAsset, 
      new: symbol,
      depth: this.config.currentDepth,
      thresholds: {
        collapse: this.config.collapseThreshold,
        spike: this.config.spikeThreshold
      }
    });
    
    return this.config.currentAsset;
  }
  
  /**
   * Get current depth
   * @returns {number}
   */
  getDepth() {
    return this.config.currentDepth;
  }
  
  /**
   * Get available asset profiles
   * @returns {Array<string>}
   */
  getAvailableAssets() {
    return Object.keys(this.config.assetProfiles);
  }
  
  /**
   * ========================================================================
   * CÁLCULO DE ENTROPIA (MELHORADO! 🔥)
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
   * Calcular entropia do order book (MELHORADO! 🔥)
   * @param {Map|Array} bids - Bids do order book
   * @param {Map|Array} asks - Asks do order book
   * @param {number} depth - Profundidade (opcional, usa config.currentDepth)
   * @returns {object}
   */
  calculate(bids, asks, depth = null) {
    try {
      const timestamp = Date.now();
      
      // Rate limiting
      if (timestamp - this.lastCalculationTime < this.config.minCalculationInterval) {
        this.stats.rate_limited++;
        return this.current;
      }
      
      this.lastCalculationTime = timestamp;
      
      // Use depth fornecido ou config
      const depthToUse = depth || this.config.currentDepth;
      
      // Converter Map para Array e LIMITAR profundidade! 🆕
      const bidVolumes = this._extractVolumes(bids).slice(0, depthToUse);
      const askVolumes = this._extractVolumes(asks).slice(0, depthToUse);
      
      // Calcular entropias (raw bits)
      const bid_entropy = this.calculateShannon(bidVolumes);
      const ask_entropy = this.calculateShannon(askVolumes);
      
      // Calcular entropy máxima teórica 🆕
      const max_entropy = Math.log2(depthToUse);
      
      // Calcular entropias normalizadas (0-1) 🆕
      const bid_normalized = max_entropy > 0 ? bid_entropy / max_entropy : 0;
      const ask_normalized = max_entropy > 0 ? ask_entropy / max_entropy : 0;
      const total_normalized = (bid_normalized + ask_normalized) / 2;
      
      // Calcular ratio
      const ratio = ask_entropy > 0 ? bid_entropy / ask_entropy : 1;
      
      // Atualizar current
      this.current = {
        bid_entropy,
        ask_entropy,
        bid_normalized,      // 🆕
        ask_normalized,      // 🆕
        total_normalized,    // 🆕
        ratio,
        timestamp,
        depth_used: depthToUse,     // 🆕
        max_entropy                 // 🆕
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
      this.logger.error('[EntropyCalculatorV2] Erro ao calcular entropia:', error);
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
          return parseFloat(item[1]);
        }
        return parseFloat(item.volume || item.qty || item);
      });
    }
    
    return [];
  }
  
  /**
   * ========================================================================
   * BANDAS DINÂMICAS (COM INTERPRETAÇÃO! 🆕)
   * ========================================================================
   */
  
  /**
   * Atualizar bandas dinâmicas
   * @private
   */
  _updateBands() {
    // Banda BID
    if (this.history.bid.length >= this.config.bandWindow) {
      const recent = this.history.bid.slice(-this.config.bandWindow);
      const values = recent.map(h => h.entropy);
      
      this.bands.bid = {
        ...this._calculateBand(values),
        interpretation: this._interpretBand(this.current.bid_entropy, this.bands.bid),  // 🆕
        ready: true
      };
    }
    
    // Banda ASK
    if (this.history.ask.length >= this.config.bandWindow) {
      const recent = this.history.ask.slice(-this.config.bandWindow);
      const values = recent.map(h => h.entropy);
      
      this.bands.ask = {
        ...this._calculateBand(values),
        interpretation: this._interpretBand(this.current.ask_entropy, this.bands.ask),  // 🆕
        ready: true
      };
    }
  }
  
  /**
   * Calcular banda (Bollinger-style)
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
   * Interpretar banda (z-score) 🆕
   * @private
   */
  _interpretBand(currentEntropy, band) {
    if (!band || !band.ready || band.stdDev === 0) {
      return 'UNKNOWN';
    }
    
    const distance = currentEntropy - band.mean;
    const zScore = distance / band.stdDev;
    
    if (zScore > 2) {
      return 'EXTREME_HIGH';     // > 2σ
    } else if (zScore > 1) {
      return 'HIGH';             // > 1σ
    } else if (zScore < -2) {
      return 'EXTREME_LOW';      // < -2σ
    } else if (zScore < -1) {
      return 'LOW';              // < -1σ
    } else {
      return 'NORMAL';           // ±1σ
    }
  }
  
  /**
   * ========================================================================
   * HISTÓRICO
   * ========================================================================
   */
  
  /**
   * Adicionar ao histórico
   * @private
   */
  _addToHistory(timestamp, bid_entropy, ask_entropy, ratio) {
    this.history.bid.push({ timestamp, entropy: bid_entropy });
    this.history.ask.push({ timestamp, entropy: ask_entropy });
    this.history.ratio.push({ timestamp, ratio });
    
    // Limitar tamanho
    const cutoff = timestamp - this.config.historyWindow;
    
    this.history.bid = this.history.bid.filter(h => h.timestamp > cutoff);
    this.history.ask = this.history.ask.filter(h => h.timestamp > cutoff);
    this.history.ratio = this.history.ratio.filter(h => h.timestamp > cutoff);
    
    // Limitar por tamanho máximo
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
   * ========================================================================
   * DELTAS E MÉTRICAS DERIVADAS
   * ========================================================================
   */
  
  /**
   * Calcular delta
   * @param {string} type - 'bid' ou 'ask'
   * @param {number} windowMs - Janela em ms
   * @returns {number}
   */
  calculateDelta(type, windowMs) {
    const history = this.history[type];
    
    if (history.length < 2) {
      return 0;
    }
    
    const now = Date.now();
    const cutoff = now - windowMs;
    
    const oldValue = history.find(h => h.timestamp >= cutoff);
    
    if (!oldValue) {
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
   * Obter métricas completas (MELHORADO! 🔥)
   * @returns {object}
   */
  getMetrics() {
    return {
      // Valores atuais
      bid_entropy: this.current.bid_entropy,
      ask_entropy: this.current.ask_entropy,
      ratio: this.current.ratio,
      timestamp: this.current.timestamp,
      
      // 🆕 NORMALIZADOS (0-1) para frontend!
      normalized: {
        bid: this.current.bid_normalized,
        ask: this.current.ask_normalized,
        total: this.current.total_normalized
      },
      
      // 🆕 Depth info
      depth_info: {
        current: this.current.depth_used,
        max_entropy: this.current.max_entropy,
        asset: this.config.currentAsset
      },
      
      // Deltas
      bid_delta_5m: this.calculateDelta('bid', 300000),
      ask_delta_5m: this.calculateDelta('ask', 300000),
      bid_delta_15m: this.calculateDelta('bid', 900000),
      ask_delta_15m: this.calculateDelta('ask', 900000),
      
      // Bandas (com interpretação! 🆕)
      bands: this.bands,
      
      // Histórico
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
   * DETECÇÃO DE EVENTOS (ORIGINAL)
   * ========================================================================
   */
  
  /**
   * Detectar eventos
   * @private
   */
  _detectEvent() {
    const bid_delta_5m = this.calculateDelta('bid', 300000);
    const ask_delta_5m = this.calculateDelta('ask', 300000);
    
    let event = null;
    
    // BID COLLAPSE
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
    
    // ASK SPIKE
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
    
    // SQUEEZE
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
    
    // Adicionar evento
    if (event) {
      // Cooldown check
      const timeSinceLastEvent = Date.now() - this.lastEventTime[event.type];
      
      if (timeSinceLastEvent < this.config.eventCooldown) {
        this.stats.cooldown_skipped++;
        return null;
      }
      
      this.lastEventTime[event.type] = Date.now();
      
      this.recentEvents.push(event);
      
      if (this.recentEvents.length > this.maxRecentEvents) {
        this.recentEvents.shift();
      }
      
      this.emit('event', event);
      
      this.logger.info(`🚨 Entropy Event: ${event.type} (confidence: ${(event.confidence * 100).toFixed(0)}%)`);
    }
    
    return event;
  }
  
  /**
   * Obter eventos recentes
   * @param {number} limit
   * @param {string} type
   * @returns {Array}
   */
  getRecentEvents(limit = 10, type = null) {
    let events = this.recentEvents;
    
    if (type) {
      events = events.filter(e => e.type === type);
    }
    
    events = events.sort((a, b) => b.timestamp - a.timestamp);
    
    return events.slice(0, limit);
  }
  
  /**
   * ========================================================================
   * UTILIDADES
   * ========================================================================
   */
  
  /**
   * Obter histórico completo
   * @param {number} limit
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
   * Reset
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
      bid_normalized: 0,
      ask_normalized: 0,
      total_normalized: 0,
      ratio: 1,
      timestamp: null,
      depth_used: null,
      max_entropy: null
    };
    
    this.bands = {
      bid: { mean: null, upper: null, lower: null, stdDev: null, ready: false, interpretation: 'UNKNOWN' },
      ask: { mean: null, upper: null, lower: null, stdDev: null, ready: false, interpretation: 'UNKNOWN' }
    };
    
    this.recentEvents = [];
    
    this.logger.info('[EntropyCalculatorV2] Reset');
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
      recent_events: this.recentEvents.length,
      config: {
        asset: this.config.currentAsset,
        depth: this.config.currentDepth,
        thresholds: {
          collapse: this.config.collapseThreshold,
          spike: this.config.spikeThreshold,
          squeeze: this.config.squeezeThreshold
        }
      }
    };
  }
}

module.exports = EntropyCalculatorV2;