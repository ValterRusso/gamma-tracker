const Logger = require('../../utils/logger');
const StrategyFactory = require('./strategies/StrategyFactory');
const RSICalculatorV2 = require('../../calculators/RSICalculatorV2');
const axios = require('axios');
const { config } = require('dotenv');

/**
 * Signal Generation Engine (Refactored)
 * Uses Strategy Pattern to generate trading signals
 * 
 * ARCHITECTURE:
 * SignalEngine (orchestrator)
 *   ↓
 * StrategyFactory (creates strategy)
 *   ↓
 * Strategy (generates signal)
 *   ↓
 * Utils (StrikeSelector, GreekAggregator, etc.)
 */
class SignalEngine {
  constructor(botId, config, database, optionsService) {
    this.botId = botId;
    this.config = config;
    this.db = database;
    this.optionsService = optionsService;
    this.logger = new Logger(`SignalEngine-${botId}`);

    // Price and RSI history for divergence detection
    this.priceHistory = []; // [{timestamp, value}]
    this.rsiHistory = [];   // [{timestamp, value}]
    this.maxHistoryLength = 50; // Keep last 50 candles

    // Wait signal statistics (to avoid DB spam)
    this.waitStats = {
      count: 0,
      lastSummaryTime: Date.now(),
      summaryInterval: 3600000 // 1 hour in milliseconds
    };

    this.logger.info(`[SignalEngine] Wait signal optimization enabled (summaries every 1h)`);

    // Create dedicated RSI calculator for this bot
    // Support both camelCase (entryRules) and snake_case (entry_rules)
    const entryRules = this.config.entryRules || this.config.entry_rules || {};
    const timeframe = entryRules.timeframe || '1h';
    
    // Safety check for symbol (should exist after migration)
    if (!this.config.symbol) {
      throw new Error('Config is missing required field: symbol. Please run database migration.');
    }
    
    const symbol = this.config.symbol.replace('-', ''); // BTC-USDT → BTCUSDT
    
    this.rsiCalculator = new RSICalculatorV2(this.logger, {
      symbol: symbol,
      interval: timeframe,
      period: 14,
      candleLimit: this.maxHistoryLength
    });
    
    this.logger.info(`[SignalEngine] RSI Calculator initialized for ${symbol} ${timeframe}`);

    // Warm-up state
    this.isWarmedUp = false;
    this.warmupPromise = null;

    // Create strategy instance
    try {
      // Merge entry_rules, exit_rules, risk_params into strategyParams
      // This allows flexible config storage in database JSON fields
      const strategyParams = {
        ...(this.config.entry_rules || {}),
        ...(this.config.exit_rules || {}),
        ...(this.config.risk_params || {}),
        ...(this.config.strategyParams || {}) // Backward compatibility
      };
      
      this.strategy = StrategyFactory.create(
        this.config.strategy,
        strategyParams
      );
      this.logger.info(`[SignalEngine] Loaded strategy: ${this.strategy.name}`);
    } catch (error) {
      this.logger.error(`[SignalEngine] Error loading strategy:`, error);
      throw error;
    }
  }

  /**
   * Analyze market and generate signal
   * @returns {Promise<Object>} Signal object
   */
  async analyzeMarket() {
    try {
      // Wait for warm-up to complete (if still in progress)
      if (!this.isWarmedUp && this.warmupPromise) {
        this.logger.info('[SignalEngine] Waiting for warm-up to complete...');
        await this.warmupPromise;
      }

      this.logger.info(`[SignalEngine] Analyzing market for strategy: ${this.strategy.name}`);
      
      // 1. Fetch current market data
      const marketData = await this.fetchMarketData();
      
      // 2. Calculate indicators
      const indicators = await this.calculateIndicators(marketData);
      
      // 3. Add regime to indicators
      indicators.regime = this.detectRegime(indicators);
      
      // 4. Generate signal using strategy
      const signal = await this.strategy.generateSignal(
        marketData,
        indicators,
        marketData.options
      );
      
      // 5. Save signal to database
      await this.saveSignal(signal, marketData);
      
      return signal;
    } catch (error) {
      this.logger.error('[SignalEngine] Error analyzing market:', error);
      return {
        signalType: 'error',
        strategy: this.strategy ? this.strategy.name : null,
        confidence: 0,
        reason: error.message
      };
    }
  }

  /**
   * Warm-up RSI calculator with historical candles
   * This prevents "insufficient points" errors on bot startup
   */
  async warmupRSICalculator() {
    try {
      const symbol = this.config.symbol.replace('-', '');
      const entryRules = this.config.entryRules || this.config.entry_rules || {};
      const timeframe = entryRules.timeframe || '1h';
      
      this.logger.info(
        `[SignalEngine] 🔥 Warming up: fetching ${this.maxHistoryLength} historical candles (${timeframe})...`
      );
      
      // Fetch historical candles from Binance
      const url = `https://api.binance.com/api/v3/klines`;
      const params = {
        symbol: symbol,
        interval: timeframe,
        limit: this.maxHistoryLength
      };
      
      const axios = require('axios');
      const response = await axios.get(url, { params, timeout: 10000 });
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response from Binance API');
      }
      
      const candles = response.data.map(k => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));
      
      this.logger.info(
        `[SignalEngine] ✅ Downloaded ${candles.length} candles from Binance`
      );
      
      // Populate price history
      for (const candle of candles) {
        this.priceHistory.push({
          timestamp: candle.timestamp,
          value: candle.close
        });
      }
      
      // Set candles directly in RSI calculator
      this.rsiCalculator.candles = candles;
      
      // Calculate RSI for each candle (rolling window)
      // This populates the full RSI history
      const period = 14;
      const closes = candles.map(c => c.close);
      
      // Need at least period+1 candles to calculate RSI
      if (closes.length >= period + 1) {
        // Calculate RSI for each point starting from period+1
        for (let i = period; i < closes.length; i++) {
          const window = closes.slice(0, i + 1);
          const rsi = this.rsiCalculator.calculateRSI(window, period);
          
          if (rsi !== null) {
            const timestamp = candles[i].timestamp;
            
            // Add to SignalEngine's rsiHistory
            this.rsiHistory.push({
              timestamp: timestamp,
              value: rsi
            });
            
            // Add to RSICalculator's rsiHistory
            this.rsiCalculator.rsiHistory.push({
              timestamp: timestamp,
              rsi: rsi
            });
          }
        }
      }
      
      this.isWarmedUp = true;
      
      this.logger.info(
        `[SignalEngine] 🎯 Warm-up complete! Price points: ${this.priceHistory.length}, RSI points: ${this.rsiHistory.length}`
      );
      
      return true;
    } catch (error) {
      this.logger.error('[SignalEngine] ⚠️ Warm-up failed:', error.message);
      this.logger.warn('[SignalEngine] Bot will accumulate data gradually (may take 50 iterations)');
      // Don't throw - bot can still work, just needs time to accumulate
      this.isWarmedUp = false;
      return false;
    }
  }

  /**
   * Fetch current market data from options service
   * @returns {Promise<Object>} Market data
   */
  async fetchMarketData() {
    try {
      // 1. Fetch options data
      const optionsData = await this.optionsService.getAllOptions();
      
      // 2. Fetch spot price from API endpoint (more reliable than DataCollector)
      let spotPrice;
      try {
        const apiPort = process.env.API_PORT || 3300;
        const statsResponse = await axios.get(`http://localhost:${apiPort}/api/binance/stats`);
        
        if (statsResponse.data.success && statsResponse.data.data.spotPrice) {
          spotPrice = statsResponse.data.data.spotPrice;
          this.logger.info(`[SignalEngine] Spot price from API: $${spotPrice.toFixed(2)}`);
        } else {
          throw new Error('Invalid response from /api/binance/stats');
        }
      } catch (apiError) {
        // Fallback: try OptionsService (may fail if DataCollector not ready)
        this.logger.warn(`[SignalEngine] API endpoint failed, trying OptionsService fallback: ${apiError.message}`);
        try {
          spotPrice = await this.optionsService.getCurrentSpot();
          this.logger.info(`[SignalEngine] Spot price from OptionsService: $${spotPrice}`);
        } catch (fallbackError) {
          this.logger.error(`[SignalEngine] Both API and OptionsService failed to get spot price: ${fallbackError.message}`);
          throw new Error('Unable to fetch spot price from any source');
        }
      }     
      
      // TESTING MODE: Add synthetic options if assumeInfiniteLiquidity is enabled
      if (this.config.assumeInfiniteLiquidity) {
        this.logger.info(`[SignalEngine] TESTING MODE: Generating synthetic options with infinite liquidity`);
        const syntheticOptions = this.generateSyntheticOptions(spotPrice);

        // Merge real and synthetic options
        const realOptions = optionsData.options || optionsData || [];
        const allOptions = [...realOptions, ...syntheticOptions];

        optionsData.options = allOptions;
        this.logger.info(`[SignalEngine] Added ${syntheticOptions.length} synthetic options (total: ${allOptions.length})`);

      } 
      // Note: Price history is now updated in calculateRSI() from candles
      // This ensures price history matches RSI timeframe
      
      return {
        spot: spotPrice,
        options: optionsData.options || optionsData,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('[SignalEngine] Error fetching market data:', error);
      throw error;
    }
  }

  /**
   * Generate synthetic options for testing mode
   * Creates theoretical options at multiple strikes with calculated Greeks
   * @param {number} spotPrice - Current spot price
   * @returns {Array} Array of synthetic option objects
   */
  generateSyntheticOptions(spotPrice) {
  const syntheticOptions = [];
  const currentDate = new Date();

  // Generate options at multiple strikes around spot
  // Strikes: 90%, 95%, 100% (ATM), 105%, 110% of spot
  const strikeMultipliers = [0.9, 0.95, 1.0, 1.05, 1.1];

  // Generate for multiple expiries (7, 14, 30, 60 days)
  const expiriesDays = [7, 14, 30, 60]; // in days

  strikeMultipliers.forEach(multiplier => {
    const strike = Math.round(spotPrice * multiplier * 100) / 100; // Round to nearest 100

    expiriesDays.forEach(dte => {
      const expiryDate = new Date(currentDate);
      expiryDate.setDate(expiryDate.getDate() + dte);

      // Estimate IV based on moneyness and DTE
      const moneyness = strike / spotPrice;
      const baseIV = 0.6; // 60% base IV
      const ivAdjustment = Math.abs(moneyness - 1) * 0.2; // Higher IV for OTM
      const iv = baseIV + ivAdjustment;

      // Generate CALL
      const isCallITM = strike < spotPrice;
      const callIntrinsic = isCallITM ? spotPrice - strike : 0;
      const callExtrinsic = spotPrice * 0.02 * iv * Math.sqrt(dte / 365);
      const callPremium = callIntrinsic + callExtrinsic;

      // Simple Greeks approximations
      const callDelta = isCallITM ? 0.5 + (moneyness - 1) * 0.5 : 0.5 - (1 - moneyness) * 0.5;
      const gamma = 0.01 * (1 - Math.abs(moneyness - 1));
      const theta = -callPremium / dte;
      const vega = spotPrice * 0.01 * Math.sqrt(dte / 365);

      syntheticOptions.push({
        symbol: `BTC-${expiryDate.toISOString().split('T')[0]}-${strike}-C`,
        strike: strike,
        type: 'call',
        expiryDate: expiryDate.toISOString(),
        dte: dte,
        markPrice: callPremium,
        bidPrice: callPremium * 0.98,
        askPrice: callPremium * 1.02,
        lastPrice: callPremium,
        volume: 999999, // Infinite liquidity
        openInterest: 999999,
        impliedVolatility: iv,
        delta: callDelta,
        gamma: gamma,
        theta: theta,
        vega: vega,
        synthetic: true, // Flag to identify testing mode
        timestamp: currentDate.toISOString()
      });

      // Generate PUT
      const isPutITM = strike > spotPrice;
      const putIntrinsic = isPutITM ? strike - spotPrice : 0;
      const putExtrinsic = spotPrice * 0.02 * iv * Math.sqrt(dte / 365);
      const putPremium = putIntrinsic + putExtrinsic;
      const putDelta = isPutITM ? -0.5 - (1 - moneyness) * 0.5 : -0.5 + (moneyness - 1) * 0.5;

      syntheticOptions.push({
        symbol: `BTC-${expiryDate.toISOString().split('T')[0]}-${strike}-P`,
        strike: strike,
        type: 'put',
        expiryDate: expiryDate.toISOString(),
        dte: dte,
        markPrice: putPremium,
        bidPrice: putPremium * 0.98,
        askPrice: putPremium * 1.02,
        lastPrice: putPremium,
        volume: 999999, // Infinite liquidity
        openInterest: 999999,
        impliedVolatility: iv,
        delta: putDelta,
        gamma: gamma,
        theta: theta,
        vega: vega,
        synthetic: true, // Flag to identify testing mode
        timestamp: currentDate.toISOString()
      });
    });
  });
  
  return syntheticOptions;
}
  


  /**
   * Calculate market indicators
   * @param {Object} marketData - Raw market data
   * @returns {Promise<Object>} Calculated indicators
   */
  async calculateIndicators(marketData) {
    const { spot, options } = marketData;
    
    try {
      // Calculate IV Rank
      const ivRank = await this.calculateIVRank(options);
      
      // Calculate average IV
      const avgIV = this.calculateAverageIV(options);
      
      // Calculate Put/Call IV Skew
      const skew = this.calculateSkew(options);
      
      // Calculate total volume and OI
      const { totalVolume, totalOI } = this.calculateVolumeOI(options);
      
      // Get ATM options for liquidity check
      const atmOptions = this.getATMOptions(options, spot);

      // Calculate RSI (if available)
      const rsi = await this.calculateRSI(spot);
      
      return {
        spot,
        ivRank,
        avgIV,
        skew,
        totalVolume,
        totalOI,
        atmOptions,
        rsi,
        priceHistory: [...this.priceHistory], // Copy for strategy
        rsiHistory: [...this.rsiHistory],     // Copy for strategy
        timestamp: marketData.timestamp
      };
    } catch (error) {
      this.logger.error('[SignalEngine] Error calculating indicators:', error);
      throw error;
    }
  }

  /**
   * Calculate IV Rank (0-100)
   * IV Rank = (Current IV - Min IV) / (Max IV - Min IV) * 100
   * @param {Array} options - Options data
   * @returns {Promise<number>} IV Rank
   */
  async calculateIVRank(options) {
    try {
      // Get ATM IVs
      const atmIVs = options
        .filter(opt => Math.abs(opt.delta) > 0.4 && Math.abs(opt.delta) < 0.6)
        .map(opt => opt.impliedVolatility || opt.markIV);
      
      if (atmIVs.length === 0) return 50; // Default to middle
      
      const currentIV = atmIVs.reduce((sum, iv) => sum + iv, 0) / atmIVs.length;
      
      // TODO: Fetch historical IV min/max from database
      // For now, use simplified calculation based on current IV
      const minIV = currentIV * 0.5;  // Assume min is 50% of current
      const maxIV = currentIV * 1.5;  // Assume max is 150% of current
      
      const ivRank = ((currentIV - minIV) / (maxIV - minIV)) * 100;
      
      return Math.max(0, Math.min(100, ivRank)); // Clamp to 0-100
    } catch (error) {
      this.logger.error('[SignalEngine] Error calculating IV Rank:', error);
      return 50; // Default
    }
  }

  /**
   * Calculate average IV across all options
   * @param {Array} options - Options data
   * @returns {number} Average IV
   */
  calculateAverageIV(options) {
    if (options.length === 0) return 0;
    
    const totalIV = options.reduce((sum, opt) => {
      const iv = opt.impliedVolatility || opt.markIV || 0;
      return sum + iv;
    }, 0);
    
    return totalIV / options.length;
  }

  /**
   * Calculate Put/Call IV Skew
   * Positive skew = Puts more expensive (fear)
   * @param {Array} options - Options data
   * @returns {number} IV Skew
   */
  calculateSkew(options) {
    const puts = options.filter(opt => opt.side === 'PUT');
    const calls = options.filter(opt => opt.side === 'CALL');
    
    if (puts.length === 0 || calls.length === 0) return 0;
    
    const avgPutIV = puts.reduce((sum, opt) => {
      const iv = opt.impliedVolatility || opt.markIV || 0;
      return sum + iv;
    }, 0) / puts.length;
    
    const avgCallIV = calls.reduce((sum, opt) => {
      const iv = opt.impliedVolatility || opt.markIV || 0;
      return sum + iv;
    }, 0) / calls.length;
    
    return avgPutIV - avgCallIV;
  }

  /**
   * Calculate total volume and open interest
   * @param {Array} options - Options data
   * @returns {Object} Volume and OI
   */
  calculateVolumeOI(options) {
    const totalVolume = options.reduce((sum, opt) => sum + (opt.volume || 0), 0);
    const totalOI = options.reduce((sum, opt) => sum + (opt.openInterest || opt.open_interest || 0), 0);
    
    return { totalVolume, totalOI };
  }

  /**
   * Get ATM options for liquidity check
   * @param {Array} options - Options data
   * @param {number} spot - Spot price
   * @returns {Array} ATM options
   */
  getATMOptions(options, spot) {
    return options.filter(opt => {
      const percentDiff = Math.abs(opt.strike - spot) / spot;
      return percentDiff < 0.05; // Within 5% of spot
    });
  }

  /**
   * Calculate RSI using dedicated RSICalculatorV2 instance
   * Also updates price history from candles
   * @param {number} spot - Current spot price (not used, kept for compatibility)
   * @returns {Promise<number|null>} RSI value
   */
  async calculateRSI(spot) {
    try {
      // Fetch candles in bot's configured timeframe
      const candles = await this.rsiCalculator.fetchCandles();
      
      if (!candles || candles.length === 0) {
        this.logger.warn('[SignalEngine] No candles fetched');
        return null;
      }
      
      // Extract close prices for RSI calculation
      const closes = candles.map(c => c.close);
      
      // Calculate RSI
      const rsi = this.rsiCalculator.calculateRSI(closes);
      
      if (rsi !== null) {
        // Store RSI in history
        const timestamp = Date.now();
        this.rsiHistory.push({ timestamp, value: rsi });
        
        // Keep only last N candles
        if (this.rsiHistory.length > this.maxHistoryLength) {
          this.rsiHistory.shift();
        }
        
        // Update price history from candles (more accurate than spot snapshots)
        this.priceHistory = candles.map(c => ({
          timestamp: c.timestamp,
          value: c.close
        }));
        
        this.logger.debug(`[SignalEngine] RSI calculated: ${rsi.toFixed(2)} from ${candles.length} candles`);
      }
      
      return rsi;
    } catch (error) {
      this.logger.warn(`[SignalEngine] RSI calculation failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Detect market regime based on indicators
   * @param {Object} indicators - Market indicators
   * @returns {string} Market regime
   */
  detectRegime(indicators) {
    const { ivRank, skew, totalVolume } = indicators;
    
    // High IV + High Volume = High volatility regime
    if (ivRank > 60 && totalVolume > 1000) {
      return 'HIGH_IV_HIGH_VOLUME';
    }
    
    // High IV + Low Volume = Uncertain regime
    if (ivRank > 60 && totalVolume < 500) {
      return 'HIGH_IV_LOW_VOLUME';
    }
    
    // Low IV = Low volatility regime
    if (ivRank < 40) {
      return 'LOW_IV';
    }
    
    // Medium IV = Neutral regime
    return 'NEUTRAL';
  }

  /**
   * Save signal to database
   * @param {Object} signal - Generated signal
   * @param {Object} marketData - Market data
   */
  async saveSignal(signal, marketData) {
    try {
      const BotSignal = this.db.getModel('BotSignal');
      
      // DEBUG: Log every signal received
      this.logger.debug(`[SignalEngine] saveSignal called: type=${signal.signalType}, strategy=${signal.strategy}`);
      
      // ========================================
      // OPTIMIZATION: Don't save individual "wait" signals
      // ========================================
      if (signal.signalType === 'wait') {
        this.logger.debug(`[SignalEngine] Processing wait signal (count: ${this.waitStats.count + 1})`);
        this.waitStats.count++;

        // Log summary every hour
        const now = Date.now();
        const elapsed = now - this.waitStats.lastSummaryTime;

        if (elapsed >= this.waitStats.summaryInterval) {
          const hours = (elapsed / (1000 * 60 * 60)).toFixed(2);

          this.logger.info(
            `[${this.config.name}] Wait summary: ${this.waitStats.count} checks with no entry conditions over ${hours}h`
          );
          
          this.logger.debug(`[SignalEngine] Attempting to save wait summary to DB...`);

        // Save hourly summary to DB
          await BotSignal.create({
            botId: this.botId,
            configId: this.config.id,
            timestamp: new Date(),
            signalType: 'wait_summary',
            strategy: this.config.strategy,
            confidence: 0,
            marketData: {
              spotPrice: marketData?.spotPrice || null,
              checksPerformed: this.waitStats.count,
              periodHours: parseFloat(hours)
            },
            position: null,
            legs: null,
            actionTaken: false,
            reason: `No entry conditions met in ${this.waitStats.count} checks over ${hours} hours`
          });
          // Reset stats
          this.waitStats.count = 0;
          this.waitStats.lastSummaryTime = now;

          this.logger.info(`[SignalEngine] ✅ Wait summary saved to DB successfully`);
          } else {
            // Just log debug message, don't save to DB
            this.logger.debug(
              `[SignalEngine] Wait signal #${this.waitStats.count} (not saved, next summary in ${((this.waitStats.summaryInterval - elapsed) / 60000).toFixed(0)}min)`
            );
          }
        return null; // Skip saving individual wait signal
          
      } 
        
      // ========================================
      // Save actionable signals (entry, exit, error)
      // ========================================       
      await BotSignal.create({
        botId: this.botId,
        configId: this.config.id,
        timestamp: new Date(),
        signalType: signal.signalType,
        strategy: signal.strategy,
        confidence: signal.confidence,
        marketData: signal.marketData,
        position: signal.position || null,
        legs: signal.legs || null,
        actionTaken: false,
        reason: signal.reason
      });
      
      this.logger.info(`[SignalEngine] Signal saved: ${signal.signalType} (${signal.strategy || 'none'})`);
    } catch (error) {
      this.logger.error('[SignalEngine] Error saving signal:', error);
    }
  }

  /**
   * Get strategy info
   * @returns {Object} Strategy information
   */
  getStrategyInfo() {
    return {
      name: this.strategy.name,
      type: this.strategy.type,
      description: this.strategy.getDescription(),
      parameters: this.strategy.getParameters()
    };
  }

  /**
   * Change strategy (hot-swap)
   * @param {string} strategyName - New strategy name
   * @param {Object} config - Strategy configuration
   */
  changeStrategy(strategyName, config = {}) {
    try {
      this.strategy = StrategyFactory.create(strategyName, config);
      this.config.strategy = strategyName;
      this.config.strategyParams = config;
      this.logger.info(`[SignalEngine] Strategy changed to: ${this.strategy.name}`);
    } catch (error) {
      this.logger.error(`[SignalEngine] Error changing strategy:`, error);
      throw error;
    }
  }
}

module.exports = SignalEngine;
