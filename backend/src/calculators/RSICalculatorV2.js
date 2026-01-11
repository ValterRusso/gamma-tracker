/**
 * ============================================================================
 * RSI CALCULATOR V2 - WITH VOLUME ANALYSIS
 * ============================================================================
 * 
 * NOVAS FEATURES V2:
 * - ✅ Volume trend detection (INCREASING/DECREASING/STABLE)
 * - ✅ Volume spike detection
 * - ✅ RSI + Volume divergence detection
 * - ✅ Combined analysis (RSI + Volume = Signal)
 * - ✅ Volume profile analysis
 * 
 * INSIGHTS:
 * - RSI overbought + Volume fading = BEARISH divergence
 * - RSI oversold + Volume surging = BULLISH reversal
 * - Volume spike = High conviction move
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 2.0
 * @date 2026-01-06
 * ============================================================================
 */

const EventEmitter = require('events');
const axios = require('axios');

class RSICalculatorV2 extends EventEmitter {
  /**
   * @param {Object} logger
   * @param {Object} config
   */
  constructor(logger, config = {}) {
    super();
    
    this.logger = logger;
    
    // Configuração
    this.config = {
      symbol: (config.symbol || 'BTCUSDT').toUpperCase(),
      interval: config.interval || '1m',
      period: config.period || 14,
      candleLimit: config.candleLimit || 100,
      updateInterval: config.updateInterval || 60000, // 15min
      overboughtThreshold: config.overboughtThreshold || 70,
      oversoldThreshold: config.oversoldThreshold || 30,
      binanceApiUrl: 'https://api.binance.com/api/v3/klines',
      
      // 🆕 Volume thresholds
      volumeSpikeMultiplier: 2.0,    // 2x average = spike
      volumeTrendWindow: 20,          // 20 candles for trend
      volumeTrendThreshold: 0.1       // 10% change = trend
    };
    
    // Estado atual
    this.current = {
      rsi: null,
      status: 'NEUTRAL',
      timestamp: null,
      ready: false,
      lastCandle: null
    };
    
    // Histórico de candles
    this.candles = [];
    
    // Histórico de RSI
    this.rsiHistory = [];
    this.maxHistorySize = 100;
    
    // 🆕 Volume metrics
    this.volumeMetrics = {
      current: 0,
      average: 0,
      average5: 0,
      trend: 'STABLE',
      strength: 'WEAK',
      spike: false
    };
    
    // Stats
    this.stats = {
      calculations: 0,
      overbought_count: 0,
      oversold_count: 0,
      neutral_count: 0,
      last_fetch: null,
      fetch_errors: 0,
      volume_spikes: 0,           // 🆕
      divergences_detected: 0     // 🆕
    };
    
    // Timer
    this.updateTimer = null;
    
    this.logger.info('[RSICalculatorV2] Initialized', {
      symbol: this.config.symbol,
      interval: this.config.interval,
      period: this.config.period
    });
    
    // ❌ REMOVED: this.initialize() - now called manually in index.js
  }
  
  /**
   * Initialize with first data fetch
   */
  async initialize() {
    this.logger.info('[RSICalculatorV2] Fetching initial candle data...');
    try {
      await this.update();
      this.logger.success('[RSICalculatorV2] Initial data loaded successfully');
    } catch (error) {
      this.logger.error('[RSICalculatorV2] Failed to fetch initial data:', error.message);
      // Don't throw - let it retry on next update cycle
    }
  }
  
  /**
   * ========================================================================
   * FETCH DE CANDLES (ORIGINAL)
   * ========================================================================
   */
  
  async fetchCandles() {
    try {
      const url = `${this.config.binanceApiUrl}?symbol=${this.config.symbol}&interval=${this.config.interval}&limit=${this.config.candleLimit}`;
      
      this.logger.debug('[RSICalculatorV2] Fetching candles', { url });
      
      const response = await axios.get(url, { timeout: 5000 });
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response from Binance API');
      }
      
      const candles = response.data.map(k => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),    // ✅ Volume!
        closeTime: k[6]
      }));
      
      this.logger.info('[RSICalculatorV2] Candles fetched', {
        count: candles.length,
        first: candles[0]?.timestamp,
        last: candles[candles.length - 1]?.timestamp
      });
      
      this.stats.last_fetch = Date.now();
      
      return candles;
      
    } catch (error) {
      this.stats.fetch_errors++;
      this.logger.error('[RSICalculatorV2] Error fetching candles', {
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * ========================================================================
   * CÁLCULO DE RSI (ORIGINAL)
   * ========================================================================
   */
  
  averages(closes, period, startIndex) {
    let gains = 0;
    let losses = 0;
    
    for (let i = 0; i < period && (i + startIndex) < closes.length; i++) {
      const diff = closes[i + startIndex] - closes[i + startIndex - 1];
      
      if (diff >= 0) {
        gains += diff;
      } else {
        losses += Math.abs(diff);
      }
    }
    
    return {
      avgGains: gains / period,
      avgLosses: losses / period
    };
  }
  
  calculateRSI(closes, period = this.config.period) {
    if (closes.length < period + 1) {
      return null;
    }
    
    let { avgGains, avgLosses } = this.averages(closes, period, 1);
    
    // Wilder's smoothing
    for (let i = 2; i < closes.length; i++) {
      const newAverages = this.averages(closes, period, i);
      avgGains = (avgGains * (period - 1) + newAverages.avgGains) / period;
      avgLosses = (avgLosses * (period - 1) + newAverages.avgLosses) / period;
    }
    
    if (avgLosses === 0 && avgGains === 0) return 50;
    if (avgLosses === 0) return 100;
    if (avgGains === 0) return 0;
    
    const rs = avgGains / avgLosses;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  }
  
  /**
   * ========================================================================
   * VOLUME ANALYSIS (NOVO! 🆕)
   * ========================================================================
   */
  
  /**
   * Detectar tendência de volume
   * @returns {Object|null}
   */
  detectVolumeTrend() {
    if (this.candles.length < this.config.volumeTrendWindow) {
      return null;
    }
    
    const recent = this.candles.slice(-this.config.volumeTrendWindow);
    
    // Volume médio das últimas N velas
    const avgVolume = recent.reduce((sum, c) => sum + c.volume, 0) / recent.length;
    
    // Volume da última vela
    const lastVolume = recent[recent.length - 1].volume;
    
    // Volume médio das últimas 5 velas
    const last5 = recent.slice(-5);
    const avgVolume5 = last5.reduce((sum, c) => sum + c.volume, 0) / 5;
    
    // Calcular tendência (primeiras 10 vs últimas 10)
    const mid = Math.floor(recent.length / 2);
    const first = recent.slice(0, mid);
    const last = recent.slice(mid);
    
    const avgVolumeFirst = first.reduce((sum, c) => sum + c.volume, 0) / first.length;
    const avgVolumeLast = last.reduce((sum, c) => sum + c.volume, 0) / last.length;
    
    const volumeChange = (avgVolumeLast - avgVolumeFirst) / avgVolumeFirst;
    
    // Classificar tendência
    let trend, strength;
    
    if (volumeChange > 0.3) {
      trend = 'INCREASING';
      strength = 'STRONG';
    } else if (volumeChange > this.config.volumeTrendThreshold) {
      trend = 'INCREASING';
      strength = 'MODERATE';
    } else if (volumeChange < -0.3) {
      trend = 'DECREASING';
      strength = 'STRONG';
    } else if (volumeChange < -this.config.volumeTrendThreshold) {
      trend = 'DECREASING';
      strength = 'MODERATE';
    } else {
      trend = 'STABLE';
      strength = 'WEAK';
    }
    
    // Spike detection
    const volumeSpike = lastVolume > avgVolume * this.config.volumeSpikeMultiplier;
    
    if (volumeSpike) {
      this.stats.volume_spikes++;
    }
    
    const result = {
      current: lastVolume,
      average: avgVolume,
      average5: avgVolume5,
      trend,
      strength,
      change: volumeChange,
      changePct: volumeChange * 100,
      spike: volumeSpike,
      spikeRatio: lastVolume / avgVolume,
      interpretation: this._interpretVolumeTrend(trend, strength, volumeSpike),
      timestamp: Date.now()
    };
    
    // Update metrics
    this.volumeMetrics = result;
    
    return result;
  }
  
  /**
   * Interpretar volume trend
   * @private
   */
  _interpretVolumeTrend(trend, strength, spike) {
    if (spike) {
      return 'Volume spike detected! High conviction move.';
    }
    
    if (trend === 'INCREASING' && strength === 'STRONG') {
      return 'Volume strongly increasing - confirming trend';
    }
    
    if (trend === 'DECREASING' && strength === 'STRONG') {
      return 'Volume fading - trend losing momentum';
    }
    
    if (trend === 'STABLE') {
      return 'Volume stable - consolidation or indecision';
    }
    
    return 'Moderate volume activity';
  }
  
  /**
   * Detectar divergência RSI + Volume (NOVO! 🆕)
   * @returns {Object|null}
   */
  detectRSIVolumeDivergence() {
    const volumeTrend = this.detectVolumeTrend();
    
    if (!volumeTrend) return null;
    
    const rsi = this.current.rsi;
    
    if (rsi === null) return null;
    
    let divergence = null;
    
    // 1. RSI overbought + Volume fading = BEARISH divergence
    if (rsi > this.config.overboughtThreshold && 
        volumeTrend.trend === 'DECREASING') {
      
      divergence = {
        type: 'BEARISH_DIVERGENCE',
        signal: 'SELL',
        message: 'RSI overbought + Volume fading = Weakness at top',
        action: 'Consider SHORT or TAKE PROFIT',
        confidence: 'HIGH',
        rsi: rsi,
        volumeTrend: volumeTrend.trend,
        volumeChange: volumeTrend.changePct.toFixed(1) + '%',
        timestamp: Date.now()
      };
      
      this.stats.divergences_detected++;
    }
    
    // 2. RSI overbought + Volume increasing = BULLISH confirmation
    else if (rsi > this.config.overboughtThreshold && 
             volumeTrend.trend === 'INCREASING') {
      
      divergence = {
        type: 'BULLISH_CONFIRMATION',
        signal: 'HOLD',
        message: 'RSI overbought + Volume increasing = Strong uptrend',
        action: 'HOLD or BUY on pullback',
        confidence: 'HIGH',
        rsi: rsi,
        volumeTrend: volumeTrend.trend,
        volumeChange: volumeTrend.changePct.toFixed(1) + '%',
        timestamp: Date.now()
      };
    }
    
    // 3. RSI oversold + Volume increasing = BULLISH reversal
    else if (rsi < this.config.oversoldThreshold && 
             volumeTrend.trend === 'INCREASING') {
      
      divergence = {
        type: 'BULLISH_REVERSAL',
        signal: 'BUY',
        message: 'RSI oversold + Volume increasing = Buying climax',
        action: 'BUY on confirmation',
        confidence: 'HIGH',
        rsi: rsi,
        volumeTrend: volumeTrend.trend,
        volumeChange: volumeTrend.changePct.toFixed(1) + '%',
        timestamp: Date.now()
      };
      
      this.stats.divergences_detected++;
    }
    
    // 4. RSI oversold + Volume fading = BEARISH continuation
    else if (rsi < this.config.oversoldThreshold && 
             volumeTrend.trend === 'DECREASING') {
      
      divergence = {
        type: 'BEARISH_CONTINUATION',
        signal: 'WAIT',
        message: 'RSI oversold + Volume fading = No buying interest',
        action: 'Wait for volume confirmation before buying',
        confidence: 'MEDIUM',
        rsi: rsi,
        volumeTrend: volumeTrend.trend,
        volumeChange: volumeTrend.changePct.toFixed(1) + '%',
        timestamp: Date.now()
      };
    }
    
    if (divergence) {
      this.logger.info(`[RSICalculatorV2] 🎯 Divergence: ${divergence.type}`, {
        signal: divergence.signal,
        confidence: divergence.confidence
      });
      
      this.emit('divergence', divergence);
    }
    
    return divergence;
  }
  
  /**
   * ========================================================================
   * ATUALIZAÇÃO
   * ========================================================================
   */
  
  async update() {
    try {
      // Buscar candles
      const candles = await this.fetchCandles();
      
      if (!candles || candles.length === 0) {
        this.logger.warn('[RSICalculatorV2] No candles received');
        return this.current;
      }
      
      // Atualizar histórico de candles
      this.candles = candles;
      
      // Extrair preços de fechamento
      const closes = candles.map(c => c.close);
      
      // Calcular RSI
      const rsi = this.calculateRSI(closes);
      
      const timestamp = Date.now();
      
      // Atualizar current
      this.current = {
        rsi,
        status: rsi !== null ? this._getStatus(rsi) : 'NEUTRAL',
        timestamp,
        ready: rsi !== null,
        lastCandle: candles[candles.length - 1]
      };
      
      // Adicionar ao histórico de RSI
      if (rsi !== null) {
        this.rsiHistory.push({ timestamp, rsi });
        
        if (this.rsiHistory.length > this.maxHistorySize) {
          this.rsiHistory.shift();
        }
        
        // Stats
        this.stats.calculations++;
        
        if (this.current.status === 'OVERSOLD') {
          this.stats.oversold_count++;
        } else if (this.current.status === 'OVERBOUGHT') {
          this.stats.overbought_count++;
        } else {
          this.stats.neutral_count++;
        }
      }
      
      // 🆕 Detectar volume trend
      this.detectVolumeTrend();
      
      // 🆕 Detectar RSI+Volume divergence
      this.detectRSIVolumeDivergence();
      
      // Log
      this.logger.info('[RSICalculatorV2] Updated', {
        rsi: rsi?.toFixed(2),
        status: this.current.status,
        volumeTrend: this.volumeMetrics.trend,
        volumeSpike: this.volumeMetrics.spike
      });
      
      // Emit event
      this.emit('calculated', {
        rsi: this.current,
        volume: this.volumeMetrics
      });
      
      return this.current;
      
    } catch (error) {
      this.logger.error('[RSICalculatorV2] Error updating', {
        error: error.message
      });
      return this.current;
    }
  }
  
  /**
   * Iniciar auto-atualização
   */
  start() {
    this.update();
    
    this.updateTimer = setInterval(() => {
      this.update();
    }, this.config.updateInterval);
    
    this.logger.info('[RSICalculatorV2] Auto-update started', {
      interval: this.config.updateInterval
    });
  }
  
  /**
   * Parar auto-atualização
   */
  stop() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
      this.logger.info('[RSICalculatorV2] Auto-update stopped');
    }
  }
  
  /**
   * ========================================================================
   * HELPERS
   * ========================================================================
   */
  
  _getStatus(rsi) {
    if (rsi >= this.config.overboughtThreshold) {
      return 'OVERBOUGHT';
    } else if (rsi <= this.config.oversoldThreshold) {
      return 'OVERSOLD';
    } else {
      return 'NEUTRAL';
    }
  }
  
  /**
   * ========================================================================
   * GETTERS
   * ========================================================================
   */
  
  /**
   * Obter métricas completas (MELHORADO! 🔥)
   */
  getMetrics() {
    return {
      // RSI
      current: this.current.rsi,
      status: this.current.status,
      ready: this.current.ready,
      timestamp: this.current.timestamp,
      lastCandle: this.current.lastCandle,
      
      // 🆕 Volume metrics
      volume: this.volumeMetrics,
      
      // 🆕 Divergence (se houver)
      divergence: this.detectRSIVolumeDivergence(),
      
      // History
      history: this.rsiHistory.slice(-20),
      
      // Stats
      stats: {
        ...this.stats,
        overbought_pct: this.stats.calculations > 0 
          ? (this.stats.overbought_count / this.stats.calculations * 100).toFixed(1)
          : '0',
        oversold_pct: this.stats.calculations > 0
          ? (this.stats.oversold_count / this.stats.calculations * 100).toFixed(1)
          : '0',
        neutral_pct: this.stats.calculations > 0
          ? (this.stats.neutral_count / this.stats.calculations * 100).toFixed(1)
          : '0'
      },
      
      // Config
      config: {
        symbol: this.config.symbol,
        interval: this.config.interval,
        period: this.config.period,
        overboughtThreshold: this.config.overboughtThreshold,
        oversoldThreshold: this.config.oversoldThreshold
      }
    };
  }
  
  /**
   * Obter volume trend
   * @returns {Object}
   */
  getVolumeTrend() {
    return this.volumeMetrics;
  }
  
  getHistory() {
    return this.rsiHistory;
  }
  
  getCandles() {
    return this.candles;
  }
  
  getStats() {
    return {
      rsi: {
        current: this.current.rsi,
        status: this.current.status,
        ready: this.current.ready,
        timestamp: this.current.timestamp,
        history: this.rsiHistory
      },
      calculations: this.stats.calculations,
      overbought_count: this.stats.overbought_count,
      oversold_count: this.stats.oversold_count,
      neutral_count: this.stats.neutral_count,
      last_fetch: this.stats.last_fetch,
      fetch_errors: this.stats.fetch_errors,
      volume_spikes: this.stats.volume_spikes,
      divergences_detected: this.stats.divergences_detected
    };
  }
  
  /**
   * Detectar divergência RSI vs Price (ORIGINAL)
   */
  detectDivergence(currentPrice, priceHistory = null) {
    if (this.rsiHistory.length < 10) {
      return null;
    }
    
    const recentRSI = this.rsiHistory.slice(-10);
    const recentPrices = this.candles.slice(-10).map(c => c.close);
    
    if (recentPrices.length < 10) {
      return null;
    }
    
    const priceHigh = Math.max(...recentPrices);
    const priceLow = Math.min(...recentPrices);
    const priceHighIndex = recentPrices.indexOf(priceHigh);
    const priceLowIndex = recentPrices.indexOf(priceLow);
    
    const rsiValues = recentRSI.map(r => r.rsi);
    const rsiHigh = Math.max(...rsiValues);
    const rsiLow = Math.min(...rsiValues);
    const rsiHighIndex = rsiValues.indexOf(rsiHigh);
    const rsiLowIndex = rsiValues.indexOf(rsiLow);
    
    // Bullish divergence
    if (priceLowIndex < recentPrices.length - 1) {
      const currentPriceLow = recentPrices[recentPrices.length - 1];
      const previousPriceLow = priceLow;
      const currentRSILow = rsiValues[rsiValues.length - 1];
      const previousRSILow = rsiLow;
      
      if (currentPriceLow < previousPriceLow && currentRSILow > previousRSILow) {
        return {
          type: 'BULLISH_DIVERGENCE',
          message: 'Price making lower low, RSI making higher low',
          confidence: 'MEDIUM',
          priceChange: ((currentPriceLow - previousPriceLow) / previousPriceLow * 100).toFixed(2),
          rsiChange: (currentRSILow - previousRSILow).toFixed(2),
          timestamp: Date.now()
        };
      }
    }
    
    // Bearish divergence
    if (priceHighIndex < recentPrices.length - 1) {
      const currentPriceHigh = recentPrices[recentPrices.length - 1];
      const previousPriceHigh = priceHigh;
      const currentRSIHigh = rsiValues[rsiValues.length - 1];
      const previousRSIHigh = rsiHigh;
      
      if (currentPriceHigh > previousPriceHigh && currentRSIHigh < previousRSIHigh) {
        return {
          type: 'BEARISH_DIVERGENCE',
          message: 'Price making higher high, RSI making lower high',
          confidence: 'MEDIUM',
          priceChange: ((currentPriceHigh - previousPriceHigh) / previousPriceHigh * 100).toFixed(2),
          rsiChange: (currentRSIHigh - previousRSIHigh).toFixed(2),
          timestamp: Date.now()
        };
      }
    }
    
    return null;
  }
}

module.exports = RSICalculatorV2;