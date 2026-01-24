const Logger = require('../../utils/logger');
const StrategyFactory = require('./strategies/StrategyFactory');
const RSICalculatorV2 = require('../../calculators/RSICalculatorV2');
const RegimeDetector = require('./intelligence/RegimeDetector');
const StrategySelector = require('./intelligence/StrategySelector');
const TradeValidator = require('./intelligence/TradeValidator');
const axios = require('axios');

/**
 * Signal Generation Engine (INTEGRATED)
 * Now includes intelligent regime detection and dynamic strategy selection
 * 
 * NEW ARCHITECTURE:
 * SignalEngine (orchestrator)
 *   ↓
 * RegimeDetector (analyzes market conditions)
 *   ↓
 * StrategySelector (chooses best strategy for regime)
 *   ↓
 * Strategy (generates signal)
 *   ↓
 * TradeValidator (validates before execution)
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

    // ===== NEW: Intelligence Modules =====
    this.regimeDetector = new RegimeDetector();
    this.strategySelector = new StrategySelector();
    this.tradeValidator = new TradeValidator(optionsService);

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

    // Create initial strategy instance
    // This may be replaced dynamically based on regime
    try {
      const strategyParams = {
        ...(this.config.entry_rules || {}),
        ...(this.config.exit_rules || {}),
        ...(this.config.risk_params || {}),
        ...(this.config.strategyParams || {})
      };
      
      this.strategy = StrategyFactory.create(
        this.config.strategy,
        strategyParams
      );
      this.currentStrategyName = this.config.strategy;
      this.logger.info(`[SignalEngine] Loaded initial strategy: ${this.strategy.name}`);
    } catch (error) {
      this.logger.error(`[SignalEngine] Error loading strategy:`, error);
      throw error;
    }
  }

  /**
   * Analyze market and generate signal (INTEGRATED VERSION)
   * @returns {Promise<Object>} Signal object
   */
  async analyzeMarket() {
    try {
      // Wait for warm-up to complete (if still in progress)
      if (!this.isWarmedUp && this.warmupPromise) {
        this.logger.info('[SignalEngine] Waiting for warm-up to complete...');
        await this.warmupPromise;
      }

      this.logger.info(`[SignalEngine] 🔍 Analyzing market...`);
      
      // ===== STEP 1: Fetch current market data =====
      const marketData = await this.fetchMarketData();
      
      // ===== STEP 2: Calculate indicators =====
      const indicators = await this.calculateIndicators(marketData);
      
      // ===== STEP 3: REGIME DETECTION (NEW!) =====
      this.logger.info('[SignalEngine] 🎯 Detecting market regime...');
      const regime = this.regimeDetector.analyze({
        ivRank: indicators.ivRank,
        entropy: indicators.entropy,
        gammaExposure: indicators.gammaExposure,
        realizedVol: indicators.realizedVol || 60, // Fallback if not available
        impliedVol: indicators.atmIV || 70,
        totalVolume: indicators.totalVolume,
        spot: marketData.spot
      });
      
      indicators.regime = regime;
      
      this.logger.info(`[SignalEngine] 📊 Regime: ${regime.overall} (confidence: ${(regime.confidence * 100).toFixed(0)}%)`);
      
      // ===== STEP 4: STRATEGY SELECTION (NEW!) =====
      this.logger.info('[SignalEngine] 🎲 Selecting optimal strategy...');
      
      const availableStrategies = StrategyFactory.getAvailableStrategies();
      const selection = this.strategySelector.select(regime, this.config, availableStrategies);
      
      this.logger.info(`[SignalEngine] Strategy selection: ${selection.strategy || 'WAIT'} (${selection.mode} mode)`);
      
      // If should not trade, return wait signal
      if (!selection.shouldTrade || !selection.strategy) {
        this.logger.info(`[SignalEngine] ⏸️  ${selection.reason}`);
        return {
          signalType: 'wait',
          strategy: this.currentStrategyName,
          confidence: 0,
          reason: selection.reason,
          marketData: indicators,
          regime: regime.overall
        };
      }
      
      // ===== STEP 5: Switch strategy if needed (DYNAMIC MODE) =====
      if (selection.mode === 'DYNAMIC' && selection.strategy !== this.currentStrategyName) {
        this.logger.info(`[SignalEngine] 🔄 Switching strategy: ${this.currentStrategyName} → ${selection.strategy}`);
        
        const strategyParams = {
          ...(this.config.entry_rules || {}),
          ...(this.config.exit_rules || {}),
          ...(this.config.risk_params || {}),
        };
        
        this.strategy = StrategyFactory.create(selection.strategy, strategyParams);
        this.currentStrategyName = selection.strategy;
      }
      
      // ===== STEP 6: Generate signal using selected strategy =====
      this.logger.info(`[SignalEngine] 📈 Generating signal with strategy: ${this.strategy.name}`);
      
      const signal = await this.strategy.generateSignal(
        marketData,
        indicators,
        marketData.options
      );

      // Add regime and selection info to signal
      signal.regime = regime;
      signal.selection = selection;
      signal.marketData = marketData;
      
      // ===== STEP 7: VALIDATE SIGNAL (NEW!) =====
      if (signal.signalType === 'entry') {
        this.logger.info('[SignalEngine] ✅ Validating trade before execution...');
        
        const validation = await this.tradeValidator.validate(signal, {
          entropy: indicators.entropy,
          levels: indicators.gammaLevels,
          sweetSpots: indicators.sweetSpots
        });
        
        if (!validation.valid) {
          this.logger.warn('[SignalEngine] ❌ Trade validation FAILED:', validation.warnings);
          
          // Convert to wait signal
          return {
            signalType: 'wait',
            strategy: signal.strategy,
            confidence: 0,
            reason: `Validation failed: ${validation.warnings.join(', ')}`,
            marketData: indicators,
            regime: regime.overall,
            validation
          };
        }
        
        this.logger.info('[SignalEngine] ✅ Trade validation PASSED');
        signal.validation = validation;
      }
      
      // ===== STEP 8: Save signal to database =====
      await this.saveSignal(signal, marketData);
      
      return signal;
    } catch (error) {
      this.logger.error('[SignalEngine] Error analyzing market:', error);
      return {
        signalType: 'error',
        strategy: this.currentStrategyName,
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
      const period = 14;
      const closes = candles.map(c => c.close);
      
      if (closes.length >= period + 1) {
        for (let i = period; i < closes.length; i++) {
          const window = closes.slice(0, i + 1);
          const rsi = this.rsiCalculator.calculateRSI(window, period);
          
          if (rsi !== null) {
            const timestamp = candles[i].timestamp;
            
            this.rsiHistory.push({
              timestamp: timestamp,
              value: rsi
            });
            
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
      this.isWarmedUp = false;
      return false;
    }
  }

  /**
   * Fetch current market data from options service
   * @returns {Promise<Object>} Market data
   */
  async fetchMarketData() {
    const optionsData = await this.optionsService.getAllOptions();
    const options = optionsData.options;
    const spot = await this.optionsService.getCurrentSpot();
    
    // Fetch Gamma Tracker data
    const gammaData = await this.fetchGammaTrackerData();
    
    return {
      spot,
      options,
      timestamp: new Date(),
      ...gammaData
    };
  }

  /**
   * Fetch Gamma Tracker data
   */
  async fetchGammaTrackerData() {
    try {
      const apiPort = process.env.API_PORT || 3300;
      const baseUrl = `http://localhost:${apiPort}/api/gamma-tracker`;
      
      const [entropyRes, ivRankRes, levelsRes, sweetSpotsRes] = await Promise.all([
        axios.get(`${baseUrl}/entropy`, { timeout: 5000 }).catch(() => null),
        axios.get(`${baseUrl}/iv-rank`, { timeout: 5000 }).catch(() => null),
        axios.get(`${baseUrl}/levels`, { timeout: 5000 }).catch(() => null),
        axios.get(`${baseUrl}/sweet-spots`, { timeout: 5000 }).catch(() => null)
      ]);
      
      return {
        entropy: entropyRes?.data?.data?.entropy || null,
        ivRank: ivRankRes?.data?.data?.ivRank || null,
        gammaLevels: levelsRes?.data?.data?.levels || [],
        sweetSpots: sweetSpotsRes?.data?.data?.sweetSpots || [],
        gammaExposure: levelsRes?.data?.data?.netGamma || null
      };
    } catch (error) {
      this.logger.warn(`[SignalEngine] Could not fetch Gamma Tracker data: ${error.message}`);
      return {
        entropy: null,
        ivRank: null,
        gammaLevels: [],
        sweetSpots: [],
        gammaExposure: null
      };
    }
  }

  /**
   * Calculate indicators
   */
  async calculateIndicators(marketData) {
    const { spot, options, entropy, ivRank, gammaLevels, sweetSpots, gammaExposure } = marketData;
    
    // ATM IV
    const atmIV = this.calculateATMIV(options, spot);
    
    // Skew
    const skew = this.calculateSkew(options);
    
    // Volume & OI
    const { totalVolume, totalOI } = this.calculateVolumeOI(options);
    
    // ATM options
    const atmOptions = this.getATMOptions(options, spot);
    
    // RSI (from RSI calculator)
    const rsi = await this.calculateRSI(spot);
    
    return {
      spot,
      atmIV,
      ivRank: ivRank || this.calculateIVRank(atmIV), // Use from Gamma Tracker or fallback
      skew,
      totalVolume,
      totalOI,
      atmOptions,
      rsi,
      entropy: entropy || 0.5, // Fallback if not available
      gammaExposure: gammaExposure || 0,
      gammaLevels: gammaLevels || [],
      sweetSpots: sweetSpots || []
    };
  }

  // ... (keep all existing helper methods)
  
  calculateATMIV(options, spot) {
    const atmOptions = options.filter(opt => {
      const percentDiff = Math.abs(opt.strike - spot) / spot;
      return percentDiff < 0.05;
    });
    
    if (atmOptions.length === 0) return 0;
    
    const avgIV = atmOptions.reduce((sum, opt) => {
      const iv = opt.impliedVolatility || opt.markIV || 0;
      return sum + iv;
    }, 0) / atmOptions.length;
    
    return avgIV * 100;
  }

  calculateIVRank(currentIV) {
    // Simplified IV Rank calculation
    // In production, you'd compare against 52-week high/low
    return Math.min(100, Math.max(0, currentIV));
  }

  calculateSkew(options) {
    const puts = options.filter(opt => opt.side === 'PUT');
    const calls = options.filter(opt => opt.side === 'CALL');
    
    if (puts.length === 0 || calls.length === 0) return 0;
    
    const avgPutIV = puts.reduce((sum, opt) => sum + (opt.impliedVolatility || opt.markIV || 0), 0) / puts.length;
    const avgCallIV = calls.reduce((sum, opt) => sum + (opt.impliedVolatility || opt.markIV || 0), 0) / calls.length;
    
    return avgPutIV - avgCallIV;
  }

  calculateVolumeOI(options) {
    const totalVolume = options.reduce((sum, opt) => sum + (opt.volume || 0), 0);
    const totalOI = options.reduce((sum, opt) => sum + (opt.openInterest || opt.open_interest || 0), 0);
    
    return { totalVolume, totalOI };
  }

  getATMOptions(options, spot) {
    return options.filter(opt => {
      const percentDiff = Math.abs(opt.strike - spot) / spot;
      return percentDiff < 0.05;
    });
  }

  async calculateRSI(spot) {
    try {
      const candles = await this.rsiCalculator.fetchCandles();
      
      if (!candles || candles.length === 0) {
        this.logger.warn('[SignalEngine] No candles fetched');
        return null;
      }
      
      const closes = candles.map(c => c.close);
      const rsi = this.rsiCalculator.calculateRSI(closes);
      
      if (rsi !== null) {
        const timestamp = Date.now();
        this.rsiHistory.push({ timestamp, value: rsi });
        
        if (this.rsiHistory.length > this.maxHistoryLength) {
          this.rsiHistory.shift();
        }
        
        this.priceHistory = candles.map(c => ({
          timestamp: c.timestamp,
          value: c.close
        }));
        
        this.logger.debug(`[SignalEngine] RSI calculated: ${rsi.toFixed(2)}`);
      }
      
      return rsi;
    } catch (error) {
      this.logger.warn(`[SignalEngine] RSI calculation failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Save signal to database
   */
  async saveSignal(signal, marketData) {
    try {
      const BotSignal = this.db.getModel('BotSignal');
      
      // Optimization: Don't save individual wait signals
      if (signal.signalType === 'wait') {
        this.waitStats.count++;

        const now = Date.now();
        const elapsed = now - this.waitStats.lastSummaryTime;

        if (elapsed >= this.waitStats.summaryInterval) {
          const hours = (elapsed / (1000 * 60 * 60)).toFixed(2);

          this.logger.info(
            `[${this.config.name}] Wait summary: ${this.waitStats.count} checks with no entry over ${hours}h`
          );

          await BotSignal.create({
            botId: this.botId,
            configId: this.config.id,
            timestamp: new Date(),
            signalType: 'wait_summary',
            strategy: this.currentStrategyName,
            confidence: 0,
            marketData: {
              spotPrice: marketData?.spot || null,
              checksPerformed: this.waitStats.count,
              periodHours: parseFloat(hours),
              regime: signal.regime
            },
            position: null,
            legs: null,
            actionTaken: false,
            reason: signal.reason || `No entry conditions met in ${this.waitStats.count} checks`
          });
          
          this.waitStats.count = 0;
          this.waitStats.lastSummaryTime = now;
        }
        
        return null;
      }
      
      // Save actionable signals
      await BotSignal.create({
        botId: this.botId,
        configId: this.config.id,
        timestamp: new Date(),
        signalType: signal.signalType,
        strategy: signal.strategy,
        confidence: signal.confidence,
        marketData: {
          ...signal.marketData,
          regime: signal.regime?.overall
        },
        position: signal.position || null,
        legs: signal.legs || null,
        actionTaken: false,
        reason: signal.reason
      });
      
      this.logger.info(`[SignalEngine] Signal saved: ${signal.signalType} (${signal.strategy})`);
    } catch (error) {
      this.logger.error('[SignalEngine] Error saving signal:', error);
    }
  }

  /**
   * Get strategy info
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
   */
  changeStrategy(strategyName, config = {}) {
    try {
      this.strategy = StrategyFactory.create(strategyName, config);
      this.currentStrategyName = strategyName;
      this.logger.info(`[SignalEngine] Strategy changed to: ${this.strategy.name}`);
    } catch (error) {
      this.logger.error(`[SignalEngine] Error changing strategy:`, error);
      throw error;
    }
  }
}

module.exports = SignalEngine;
