const Logger = require('../../utils/logger');
const StrategyFactory = require('./strategies/StrategyFactory');
const axios = require('axios');

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
        spotPrice = await this.optionsService.getCurrentSpot();
        this.logger.info(`[SignalEngine] Spot price from OptionsService: $${spotPrice.toFixed(2)}`);
      }
      
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
   * Calculate RSI (if available)
   * @param {number} spot - Current spot price
   * @returns {Promise<number|null>} RSI value
   */
  async calculateRSI(spot) {
    try {
      // TODO: Implement RSI calculation using historical price data
      // For now, return null
      return null;
    } catch (error) {
      this.logger.error('[SignalEngine] Error calculating RSI:', error);
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
      
      await BotSignal.create({
        botId: this.botId,
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
