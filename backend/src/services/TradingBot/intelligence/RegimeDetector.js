const Logger = require('../../../utils/logger');

/**
 * Regime Detector
 * Analyzes market conditions to determine the current regime
 * Uses: IV Rank, Entropy, Gamma Exposure, Realized vs Implied Vol
 * 
 * ARCHITECTURE:
 * - Layer 1: Volatility Regime (HIGH/LOW/NEUTRAL)
 * - Layer 2: Stability Regime (STABLE/CHAOTIC/TRANSITIONING)
 * - Layer 3: Gamma Regime (DEALER_LONG/DEALER_SHORT/NEUTRAL)
 * - Layer 4: Mispricing Detection (IV_OVERPRICED/IV_UNDERPRICED/FAIR)
 * - Output: Composite regime classification
 */
class RegimeDetector {
  constructor() {
    this.logger = new Logger('RegimeDetector');
    
    // Thresholds (can be tuned based on backtesting)
    this.thresholds = {
      // Volatility thresholds
      ivRankHigh: 60,
      ivRankVeryHigh: 80,
      ivRankLow: 30,
      ivRankVeryLow: 20,
      
      // Stability thresholds (entropy)
      entropyStable: 0.3,      // Below = stable
      entropyChaotic: 0.6,     // Above = chaotic
      
      // Gamma thresholds
      gammaNeutralThreshold: 1000,  // Absolute gamma exposure
      
      // Mispricing thresholds
      volSpreadOverpriced: 5,   // IV - RV > 5 percentage points
      volSpreadUnderpriced: -5  // IV - RV < -5 percentage points
    };
  }

  /**
   * Main analysis method
   * @param {Object} marketData - Market indicators
   * @returns {Object} - Regime classification
   */
  analyze(marketData) {
    try {
      const {
        ivRank,
        entropy,
        gammaExposure,
        realizedVol,
        impliedVol,
        totalVolume,
        spot
      } = marketData;

      // Layer 1: Volatility Regime
      const volatility = this.classifyVolatility(ivRank, realizedVol, impliedVol);

      // Layer 2: Stability Regime (uses entropy from Gamma Tracker)
      const stability = this.classifyStability(entropy);

      // Layer 3: Gamma Regime (uses gamma exposure from Gamma Tracker)
      const gamma = this.classifyGamma(gammaExposure);

      // Layer 4: Mispricing
      const mispricing = this.detectMispricing(realizedVol, impliedVol);

      // Composite classification
      const overall = this.summarizeRegime(volatility, stability, gamma, mispricing);

      const regime = {
        volatility,
        stability,
        gamma,
        mispricing,
        overall,
        confidence: this.calculateConfidence(marketData),
        timestamp: new Date()
      };

      this.logger.info('[RegimeDetector] Regime detected:', {
        overall: regime.overall,
        vol: regime.volatility,
        stability: regime.stability,
        gamma: regime.gamma,
        confidence: regime.confidence.toFixed(2)
      });

      return regime;

    } catch (error) {
      this.logger.error('[RegimeDetector] Error analyzing regime:', error);
      return this.getDefaultRegime();
    }
  }

  /**
   * Classify volatility regime
   * @param {number} ivRank - IV Rank (0-100)
   * @param {number} realizedVol - Realized volatility (optional)
   * @param {number} impliedVol - Implied volatility (optional)
   * @returns {string} - Volatility classification
   */
  classifyVolatility(ivRank, realizedVol = null, impliedVol = null) {
    if (ivRank >= this.thresholds.ivRankVeryHigh) {
      return 'VERY_HIGH';
    } else if (ivRank >= this.thresholds.ivRankHigh) {
      return 'HIGH';
    } else if (ivRank <= this.thresholds.ivRankVeryLow) {
      return 'VERY_LOW';
    } else if (ivRank <= this.thresholds.ivRankLow) {
      return 'LOW';
    } else {
      return 'NEUTRAL';
    }
  }

  /**
   * Classify stability regime using entropy
   * @param {number} entropy - Entropy value from Gamma Tracker (0-1)
   * @returns {string} - Stability classification
   */
  classifyStability(entropy) {
    if (entropy === null || entropy === undefined) {
      return 'UNKNOWN';
    }

    if (entropy < this.thresholds.entropyStable) {
      return 'STABLE';       // Low entropy = stable, orderly market
    } else if (entropy > this.thresholds.entropyChaotic) {
      return 'CHAOTIC';      // High entropy = chaotic, disorderly market
    } else {
      return 'TRANSITIONING'; // Medium entropy = transitioning
    }
  }

  /**
   * Classify gamma regime
   * @param {number} gammaExposure - Net gamma exposure from Gamma Tracker
   * @returns {string} - Gamma classification
   */
  classifyGamma(gammaExposure) {
    if (gammaExposure === null || gammaExposure === undefined) {
      return 'UNKNOWN';
    }

    if (Math.abs(gammaExposure) < this.thresholds.gammaNeutralThreshold) {
      return 'NEUTRAL';
    } else if (gammaExposure > 0) {
      // Dealers are long gamma = will dampen moves (sell into strength, buy dips)
      return 'DEALER_LONG_GAMMA';
    } else {
      // Dealers are short gamma = will amplify moves (buy strength, sell dips)
      return 'DEALER_SHORT_GAMMA';
    }
  }

  /**
   * Detect volatility mispricing
   * @param {number} realizedVol - Realized volatility
   * @param {number} impliedVol - Implied volatility
   * @returns {string} - Mispricing classification
   */
  detectMispricing(realizedVol, impliedVol) {
    if (!realizedVol || !impliedVol) {
      return 'UNKNOWN';
    }

    const spread = impliedVol - realizedVol;

    if (spread > this.thresholds.volSpreadOverpriced) {
      return 'IV_OVERPRICED';  // Sell volatility (premium inflated)
    } else if (spread < this.thresholds.volSpreadUnderpriced) {
      return 'IV_UNDERPRICED'; // Buy volatility (premium cheap)
    } else {
      return 'FAIR';           // Fairly priced
    }
  }

  /**
   * Summarize regime into actionable classification
   * @param {string} volatility - Volatility regime
   * @param {string} stability - Stability regime
   * @param {string} gamma - Gamma regime
   * @param {string} mispricing - Mispricing regime
   * @returns {string} - Overall regime
   */
  summarizeRegime(volatility, stability, gamma, mispricing) {
    // === VOLATILITY SELLING REGIMES ===
    
    // IDEAL: High IV + Stable + Overpriced
    if (volatility === 'HIGH' && stability === 'STABLE' && mispricing === 'IV_OVERPRICED') {
      return 'SELL_PREMIUM_IDEAL';
    }

    // GOOD: High IV + Stable
    if (volatility === 'HIGH' && stability === 'STABLE') {
      return 'SELL_PREMIUM_GOOD';
    }

    // VERY HIGH: Very High IV + Stable (Iron Butterfly territory)
    if (volatility === 'VERY_HIGH' && stability === 'STABLE') {
      return 'SELL_PREMIUM_AGGRESSIVE';
    }

    // === VOLATILITY BUYING REGIMES ===
    
    // IDEAL: Low IV + Chaotic + Underpriced
    if (volatility === 'LOW' && stability === 'CHAOTIC' && mispricing === 'IV_UNDERPRICED') {
      return 'BUY_VOL_IDEAL';
    }

    // GOOD: Low IV + Transitioning
    if (volatility === 'LOW' && stability === 'TRANSITIONING') {
      return 'BUY_VOL_GOOD';
    }

    // VERY LOW: Very low IV (compression extreme)
    if (volatility === 'VERY_LOW') {
      return 'BUY_VOL_AGGRESSIVE';
    }

    // === NEUTRAL REGIMES ===
    
    // RANGE BOUND: Neutral vol + Stable + Dealer Long Gamma
    if (volatility === 'NEUTRAL' && stability === 'STABLE' && gamma === 'DEALER_LONG_GAMMA') {
      return 'RANGE_BOUND';
    }

    // UNCERTAIN: High IV + Chaotic (dangerous!)
    if ((volatility === 'HIGH' || volatility === 'VERY_HIGH') && stability === 'CHAOTIC') {
      return 'UNCERTAIN_DANGEROUS';
    }

    // === DEFAULT ===
    return 'NEUTRAL_WAIT';
  }

  /**
   * Calculate confidence in regime detection
   * @param {Object} marketData - Market indicators
   * @returns {number} - Confidence score (0-1)
   */
  calculateConfidence(marketData) {
    let confidence = 0.5; // Base confidence

    const { ivRank, entropy, gammaExposure, totalVolume } = marketData;

    // Data availability increases confidence
    if (ivRank !== null && ivRank !== undefined) {
      confidence += 0.15;
    }

    if (entropy !== null && entropy !== undefined) {
      confidence += 0.15;
    }

    if (gammaExposure !== null && gammaExposure !== undefined) {
      confidence += 0.1;
    }

    // Volume increases confidence
    if (totalVolume > 1000) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Get default regime when analysis fails
   * @returns {Object} - Default regime
   */
  getDefaultRegime() {
    return {
      volatility: 'UNKNOWN',
      stability: 'UNKNOWN',
      gamma: 'UNKNOWN',
      mispricing: 'UNKNOWN',
      overall: 'NEUTRAL_WAIT',
      confidence: 0.0,
      timestamp: new Date()
    };
  }

  /**
   * Get regime description for logging/display
   * @param {string} regimeCode - Regime code
   * @returns {string} - Human-readable description
   */
  getRegimeDescription(regimeCode) {
    const descriptions = {
      'SELL_PREMIUM_IDEAL': 'Ideal conditions for selling premium (high IV, stable, overpriced)',
      'SELL_PREMIUM_GOOD': 'Good conditions for selling premium (high IV, stable)',
      'SELL_PREMIUM_AGGRESSIVE': 'Very high IV - aggressive premium selling (Iron Butterfly)',
      'BUY_VOL_IDEAL': 'Ideal conditions for buying volatility (low IV, chaotic, underpriced)',
      'BUY_VOL_GOOD': 'Good conditions for buying volatility (low IV, transitioning)',
      'BUY_VOL_AGGRESSIVE': 'Very low IV - aggressive vol buying (Long Straddle/Strangle)',
      'RANGE_BOUND': 'Range-bound market (neutral vol, stable, dealer long gamma)',
      'UNCERTAIN_DANGEROUS': 'Uncertain and dangerous (high IV + chaotic) - AVOID',
      'NEUTRAL_WAIT': 'Neutral regime - wait for better conditions'
    };

    return descriptions[regimeCode] || 'Unknown regime';
  }

  /**
   * Check if regime supports a specific strategy type
   * @param {Object} regime - Regime object
   * @param {string} strategyType - Strategy type ('volatility-selling', 'volatility-buying')
   * @returns {boolean} - True if regime supports strategy
   */
  supportsStrategy(regime, strategyType) {
    if (strategyType === 'volatility-selling') {
      return regime.overall.startsWith('SELL_PREMIUM') || regime.overall === 'RANGE_BOUND';
    }

    if (strategyType === 'volatility-buying') {
      return regime.overall.startsWith('BUY_VOL');
    }

    return false;
  }

  /**
   * Get recommended strategies for regime
   * @param {Object} regime - Regime object
   * @returns {Array} - Array of recommended strategy names
   */
  getRecommendedStrategies(regime) {
    const recommendations = {
      'SELL_PREMIUM_IDEAL': ['iron_condor', 'short_strangle', 'iron_butterfly'],
      'SELL_PREMIUM_GOOD': ['iron_condor', 'bull_put_spread', 'bear_call_spread'],
      'SELL_PREMIUM_AGGRESSIVE': ['iron_butterfly', 'short_straddle'],
      'BUY_VOL_IDEAL': ['long_strangle', 'long_straddle'],
      'BUY_VOL_GOOD': ['long_strangle', 'calendar_spread'],
      'BUY_VOL_AGGRESSIVE': ['long_straddle', 'backspread'],
      'RANGE_BOUND': ['iron_condor', 'iron_butterfly'],
      'UNCERTAIN_DANGEROUS': [], // No recommendations
      'NEUTRAL_WAIT': []         // No recommendations
    };

    return recommendations[regime.overall] || [];
  }
}

module.exports = RegimeDetector;
