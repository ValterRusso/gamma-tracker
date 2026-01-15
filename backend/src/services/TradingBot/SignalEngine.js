const Logger = require('../../utils/logger');

/**
 * Signal Generation Engine
 * Analyzes market data and generates trading signals based on mathematical rules
 */
class SignalEngine {
  constructor(botId, config, database, optionsService) {
    this.botId = botId;
    this.config = config;
    this.db = database;
    this.optionsService = optionsService;
    this.logger = new Logger(`SignalEngine-${botId}`);
  }

  /**
   * Analyze market and generate signal
   * @returns {Promise<Object>} Signal object
   */
  async analyzeMarket() {
    try {
      this.logger.info(`[SignalEngine] Analyzing market for strategy: ${this.config.strategy}`);
      
      // 1. Fetch current market data
      const marketData = await this.fetchMarketData();
      
      // 2. Calculate indicators
      const indicators = await this.calculateIndicators(marketData);
      
      // 3. Detect market regime
      const regime = this.detectRegime(indicators);
      
      // 4. Check entry rules
      const signal = this.checkEntryRules(this.config, indicators, regime);
      
      // 5. Save signal to database
      await this.saveSignal(signal, marketData);
      
      return signal;
    } catch (error) {
      this.logger.error('[SignalEngine] Error analyzing market:', error);
      return {
        signalType: 'error',
        strategy: null,
        confidence: 0,
        reason: error.message
      };
    }
  }

  /**
   * Fetch current market data from options service
   */
  async fetchMarketData() {
    // Fetch from your existing /api/options endpoint
    const optionsData = await this.optionsService.getAllOptions();
    const spotPrice = await this.optionsService.getCurrentSpot();
    
    return {
      spot: spotPrice,
      options: optionsData.options,
      timestamp: new Date()
    };
  }

  /**
   * Calculate market indicators
   */
  async calculateIndicators(marketData) {
    const { spot, options } = marketData;
    
    // Calculate IV Rank (requires historical IV data)
    const ivRank = await this.calculateIVRank(options);
    
    // Calculate average IV
    const avgIV = this.calculateAverageIV(options);
    
    // Calculate Put/Call IV Skew
    const skew = this.calculateSkew(options);
    
    // Calculate total volume and OI
    const { totalVolume, totalOI } = this.calculateVolumeOI(options);
    
    // Get ATM options for liquidity check
    const atmOptions = this.getATMOptions(options, spot);
    
    return {
      spot,
      ivRank,
      avgIV,
      skew,
      totalVolume,
      totalOI,
      atmOptions,
      timestamp: marketData.timestamp
    };
  }

  /**
   * Calculate IV Rank (0-100)
   * IV Rank = (Current IV - Min IV) / (Max IV - Min IV) * 100
   */
  async calculateIVRank(options) {
    // Simplified: use average ATM IV as current IV
    // In production, you'd fetch historical IV data
    const atmIVs = options
      .filter(opt => Math.abs(opt.delta) > 0.4 && Math.abs(opt.delta) < 0.6)
      .map(opt => opt.markIV);
    
    if (atmIVs.length === 0) return 50; // Default to middle
    
    const currentIV = atmIVs.reduce((sum, iv) => sum + iv, 0) / atmIVs.length;
    
    // TODO: Fetch historical IV min/max from database
    // For now, use simplified calculation
    const minIV = currentIV * 0.5;  // Assume min is 50% of current
    const maxIV = currentIV * 1.5;  // Assume max is 150% of current
    
    const ivRank = ((currentIV - minIV) / (maxIV - minIV)) * 100;
    
    return Math.max(0, Math.min(100, ivRank)); // Clamp to 0-100
  }

  /**
   * Calculate average IV across all options
   */
  calculateAverageIV(options) {
    if (options.length === 0) return 0;
    const totalIV = options.reduce((sum, opt) => sum + opt.markIV, 0);
    return totalIV / options.length;
  }

  /**
   * Calculate Put/Call IV Skew
   * Positive skew = Puts more expensive (fear)
   */
  calculateSkew(options) {
    const puts = options.filter(opt => opt.side === 'PUT');
    const calls = options.filter(opt => opt.side === 'CALL');
    
    if (puts.length === 0 || calls.length === 0) return 0;
    
    const avgPutIV = puts.reduce((sum, opt) => sum + opt.markIV, 0) / puts.length;
    const avgCallIV = calls.reduce((sum, opt) => sum + opt.markIV, 0) / calls.length;
    
    return avgPutIV - avgCallIV;
  }

  /**
   * Calculate total volume and open interest
   */
  calculateVolumeOI(options) {
    const totalVolume = options.reduce((sum, opt) => sum + (opt.volume || 0), 0);
    const totalOI = options.reduce((sum, opt) => sum + (opt.openInterest || 0), 0);
    
    return { totalVolume, totalOI };
  }

  /**
   * Get ATM options for liquidity check
   */
  getATMOptions(options, spot) {
    return options.filter(opt => {
      const percentDiff = Math.abs(opt.strike - spot) / spot;
      return percentDiff < 0.05; // Within 5% of spot
    });
  }

  /**
   * Detect market regime based on indicators
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
   * Check entry rules against indicators
   */
  checkEntryRules(config, indicators, regime) {
    const entryRules = {
      ivRank: { min: config.ivRankMin || 50, max: config.ivRankMax || 100 },
      minVolume: config.volumeMin || 0,
      strategy: config.strategy || 'iron_condor',
      dte: { min: config.dteMin || 30, max: config.dteMax || 45 },
      shortCallDelta: -Math.abs(config.shortDelta || 0.16),
      shortPutDelta: Math.abs(config.shortDelta || 0.16),
      wingWidth: config.wingWidth || 5000
    };
    const { ivRank, atmOptions, totalVolume } = indicators;
    
    // Check IV Rank requirement
    if (entryRules.ivRank) {
      const { min, max } = entryRules.ivRank;
      if (ivRank < min || ivRank > max) {
        return {
          signalType: 'wait',
          strategy: null,
          confidence: 0,
          reason: `IV Rank ${ivRank.toFixed(1)} outside range [${min}, ${max}]`,
          marketData: indicators
        };
      }
    }
    
    // Check minimum volume requirement
    if (entryRules.minVolume && totalVolume < entryRules.minVolume) {
      return {
        signalType: 'wait',
        strategy: null,
        confidence: 0,
        reason: `Volume ${totalVolume} below minimum ${entryRules.minVolume}`,
        marketData: indicators
      };
    }
    
    // Check liquidity (ATM options available)
    if (atmOptions.length < 4) {
      return {
        signalType: 'wait',
        strategy: null,
        confidence: 0,
        reason: `Insufficient ATM options (${atmOptions.length} < 4)`,
        marketData: indicators
      };
    }
    
    // All rules passed - generate entry signal
    const confidence = this.calculateConfidence(indicators, regime, entryRules);
    
    return {
      signalType: 'entry',
      strategy: entryRules.strategy || 'iron_condor',
      confidence,
      reason: `All entry conditions met. Regime: ${regime}, IV Rank: ${ivRank.toFixed(1)}`,
      marketData: indicators,
      params: this.generateStrategyParams(entryRules, indicators)
    };
  }

  /**
   * Calculate signal confidence (0-1)
   */
  calculateConfidence(indicators, regime, entryRules) {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence for ideal IV Rank
    const { ivRank } = indicators;
    if (ivRank > 70 && ivRank < 90) {
      confidence += 0.2;
    } else if (ivRank > 50 && ivRank < 70) {
      confidence += 0.1;
    }
    
    // Increase confidence for high volume
    if (indicators.totalVolume > 2000) {
      confidence += 0.1;
    }
    
    // Increase confidence for favorable regime
    if (regime === 'HIGH_IV_HIGH_VOLUME') {
      confidence += 0.2;
    }
    
    return Math.min(1.0, confidence);
  }

  /**
   * Generate strategy-specific parameters
   */
  generateStrategyParams(entryRules, indicators) {
    const { spot } = indicators;
    
    // For Iron Condor
    if (entryRules.strategy === 'iron_condor') {
      const { shortCallDelta, shortPutDelta, wingWidth } = entryRules;
      
      return {
        dte: entryRules.dte || { min: 30, max: 45 },
        shortCallDelta: shortCallDelta || -0.16,
        shortPutDelta: shortPutDelta || 0.16,
        wingWidth: wingWidth || 5000,
        spot
      };
    }
    
    return {};
  }

  /**
   * Save signal to database
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
        actionTaken: false,
        reason: signal.reason
      });
      
      this.logger.info(`[SignalEngine] Signal saved: ${signal.signalType} (${signal.strategy || 'none'})`);
    } catch (error) {
      this.logger.error('[SignalEngine] Error saving signal:', error);
    }
  }
}

module.exports = SignalEngine;
