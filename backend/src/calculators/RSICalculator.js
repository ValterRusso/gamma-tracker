/**
 * ============================================================================
 * RSI CALCULATOR v2 - USANDO CANDLES DA BINANCE
 * ============================================================================
 * 
 * Calcula RSI (Relative Strength Index) usando preços de FECHAMENTO de candles
 * da Binance, ao invés de preços do order book.
 * 
 * Baseado no algoritmo do usuário (index-rsi.js)
 * 
 * Features:
 * - Busca candles de 15m da Binance
 * - Usa preços de fechamento (k[4])
 * - Período configurável (padrão: 14)
 * - Auto-atualização a cada 15 minutos
 * - Algoritmo correto de RSI (Wilder's smoothing)
 * 
 * @author Valter Russo
 * @date 2026-01-05
 */

const EventEmitter = require('events');
const axios = require('axios');

class RSICalculator extends EventEmitter {
  /**
   * @param {Object} logger - Logger instance
   * @param {Object} config - Configuration
   * @param {string} config.symbol - Trading symbol (default: 'BTCUSDT')
   * @param {string} config.interval - Candle interval (default: '15m')
   * @param {number} config.period - RSI period (default: 14)
   * @param {number} config.candleLimit - Number of candles to fetch (default: 100)
   * @param {number} config.updateInterval - Update interval in ms (default: 900000 = 15min)
   * @param {number} config.overboughtThreshold - Overbought threshold (default: 70)
   * @param {number} config.oversoldThreshold - Oversold threshold (default: 30)
   */
  constructor(logger, config = {}) {
    super();
    
    this.logger = logger;
    
    // Configuração
    this.config = {
      symbol: config.symbol || 'btcusdt',
      interval: config.interval || '15m',
      period: config.period || 14,
      candleLimit: config.candleLimit || 100,
      updateInterval: config.updateInterval || 900000, // 15 minutos
      overboughtThreshold: config.overboughtThreshold || 70,
      oversoldThreshold: config.oversoldThreshold || 30,
      binanceApiUrl: 'https://api.binance.com/api/v3/klines'
    };
    
    // Estado atual
    this.current = {
      rsi: null,
      status: 'NEUTRAL',
      timestamp: null,
      ready: false
    };
    
    // Histórico de candles
    this.candles = [];
    
    // Histórico de RSI
    this.rsiHistory = [];
    this.maxHistorySize = 100;
    
    // Stats
    this.stats = {
      calculations: 0,
      overbought_count: 0,
      oversold_count: 0,
      neutral_count: 0,
      last_fetch: null,
      fetch_errors: 0
    };
    
    // Timer para auto-atualização
    this.updateTimer = null;
    
    this.logger.info('[RSICalculator] Initialized', {
      symbol: this.config.symbol,
      interval: this.config.interval,
      period: this.config.period
    });
  }
  
  /**
   * ========================================================================
   * FETCH DE CANDLES DA BINANCE
   * ========================================================================
   */
  
  /**
   * Buscar candles da Binance
   * @returns {Promise<Array>} Array de candles
   */
  async fetchCandles() {
    try {
      const url = `${this.config.binanceApiUrl}?symbol=${this.config.symbol}&interval=${this.config.interval}&limit=${this.config.candleLimit}`;
      
      this.logger.debug('[RSICalculator] Fetching candles from Binance', { url });
      
      const response = await axios.get(url, { timeout: 5000 });
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response from Binance API');
      }
      
      // Mapear candles
      const candles = response.data.map(k => ({
        timestamp: k[0],                    // Open time
        open: parseFloat(k[1]),            // Open price
        high: parseFloat(k[2]),            // High price
        low: parseFloat(k[3]),             // Low price
        close: parseFloat(k[4]),           // Close price ← IMPORTANTE!
        volume: parseFloat(k[5]),          // Volume
        closeTime: k[6]                    // Close time
      }));
      
      this.logger.info('[RSICalculator] Candles fetched successfully', {
        count: candles.length,
        first: candles[0]?.timestamp,
        last: candles[candles.length - 1]?.timestamp
      });
      
      this.stats.last_fetch = Date.now();
      
      return candles;
      
    } catch (error) {
      this.stats.fetch_errors++;
      this.logger.error('[RSICalculator] Error fetching candles', {
        error: error.message,
        symbol: this.config.symbol,
        interval: this.config.interval
      });
      throw error;
    }
  }
  
  /**
   * ========================================================================
   * CÁLCULO DE RSI (ALGORITMO DO USUÁRIO)
   * ========================================================================
   */
  
  /**
   * Calcular médias de ganhos e perdas
   * @param {Array<number>} closes - Array de preços de fechamento
   * @param {number} period - Período
   * @param {number} startIndex - Índice inicial
   * @returns {Object} { avgGains, avgLosses }
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
    
    const avgGains = gains / period;
    const avgLosses = losses / period;
    
    return { avgGains, avgLosses };
  }
  
  /**
   * Calcular RSI
   * @param {Array<number>} closes - Array de preços de fechamento
   * @param {number} period - Período (default: 14)
   * @returns {number|null} RSI value (0-100) ou null se dados insuficientes
   */
  calculateRSI(closes, period = this.config.period) {
    // Verificar se tem dados suficientes
    if (closes.length < period + 1) {
      return null;
    }
    
    // Calcular médias iniciais
    let { avgGains, avgLosses } = this.averages(closes, period, 1);
    
    // Wilder's smoothing
    for (let i = 2; i < closes.length; i++) {
      const newAverages = this.averages(closes, period, i);
      avgGains = (avgGains * (period - 1) + newAverages.avgGains) / period;
      avgLosses = (avgLosses * (period - 1) + newAverages.avgLosses) / period;
    }
    
    // Casos especiais para evitar divisão por zero
    if (avgLosses === 0 && avgGains === 0) {
      return 50; // Sem movimento = neutro
    }
    
    if (avgLosses === 0) {
      return 100; // Apenas ganhos = overbought
    }
    
    if (avgGains === 0) {
      return 0; // Apenas perdas = oversold
    }
    
    // Cálculo normal
    const rs = avgGains / avgLosses;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  }
  
  /**
   * ========================================================================
   * ATUALIZAÇÃO E PROCESSAMENTO
   * ========================================================================
   */
  
  /**
   * Atualizar RSI com novos candles
   * @returns {Promise<Object>} Current RSI state
   */
  async update() {
    try {
      // Buscar candles
      const candles = await this.fetchCandles();
      
      if (!candles || candles.length === 0) {
        this.logger.warn('[RSICalculator] No candles received');
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
        
        // Limitar histórico
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
      
      // Log
      this.logger.info('[RSICalculator] RSI calculated', {
        rsi: rsi?.toFixed(2),
        status: this.current.status,
        ready: this.current.ready,
        candles: closes.length
      });
      
      // Emit event
      this.emit('calculated', this.current);
      
      return this.current;
      
    } catch (error) {
      this.logger.error('[RSICalculator] Error updating RSI', {
        error: error.message
      });
      return this.current;
    }
  }
  
  /**
   * Iniciar auto-atualização
   */
  start() {
    // Primeira atualização imediata
    this.update();
    
    // Agendar atualizações periódicas
    this.updateTimer = setInterval(() => {
      this.update();
    }, this.config.updateInterval);
    
    this.logger.info('[RSICalculator] Auto-update started', {
      interval: this.config.updateInterval,
      intervalMinutes: this.config.updateInterval / 60000
    });
  }
  
  /**
   * Parar auto-atualização
   */
  stop() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
      this.logger.info('[RSICalculator] Auto-update stopped');
    }
  }
  
  /**
   * ========================================================================
   * HELPERS
   * ========================================================================
   */
  
  /**
   * Determinar status do RSI
   * @param {number} rsi - RSI value
   * @returns {string} 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL'
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
   * Obter métricas completas
   * @returns {Object} Métricas de RSI
   */
  getMetrics() {
    return {
      current: this.current.rsi,
      status: this.current.status,
      ready: this.current.ready,
      timestamp: this.current.timestamp,
      lastCandle: this.current.lastCandle,
      history: this.rsiHistory.slice(-20), // Últimos 20
      stats: {
        ...this.stats,
        overbought_pct: this.stats.calculations > 0 
          ? (this.stats.overbought_count / this.stats.calculations * 100).toFixed(1)
          : 0,
        oversold_pct: this.stats.calculations > 0
          ? (this.stats.oversold_count / this.stats.calculations * 100).toFixed(1)
          : 0,
        neutral_pct: this.stats.calculations > 0
          ? (this.stats.neutral_count / this.stats.calculations * 100).toFixed(1)
          : 0
      },
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
   * Obter histórico completo de RSI
   * @returns {Array} Histórico de RSI
   */
  getHistory() {
    return this.rsiHistory;
  }
  
  /**
   * Obter candles atuais
   * @returns {Array} Candles
   */
  getCandles() {
    return this.candles;
  }
}

module.exports = RSICalculator;
