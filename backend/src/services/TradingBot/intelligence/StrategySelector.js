const Logger = require('../../../utils/logger');

/**
 * Strategy Selector
 * Dynamically selects the best strategy based on market regime
 * Works in conjunction with RegimeDetector
 * 
 * MODES:
 * - FIXED: Always use the same strategy (respects user config)
 * - DYNAMIC: Changes strategy based on regime
 * - HYBRID: Uses fixed strategy but skips trades in unfavorable regimes
 */
class StrategySelector {
  constructor() {
    this.logger = new Logger('StrategySelector');
    
    // Strategy mappings by regime
    this.regimeStrategyMap = {
      // === VOLATILITY SELLING REGIMES ===
      'SELL_PREMIUM_IDEAL': {
        primary: 'iron_condor',
        alternatives: ['short_strangle', 'iron_butterfly'],
        confidence: 0.9
      },
      'SELL_PREMIUM_GOOD': {
        primary: 'iron_condor',
        alternatives: ['bull_put_spread', 'bear_call_spread'],
        confidence: 0.75
      },
      'SELL_PREMIUM_AGGRESSIVE': {
        primary: 'iron_butterfly',
        alternatives: ['short_straddle', 'iron_condor'],
        confidence: 0.85
      },
      
      // === VOLATILITY BUYING REGIMES ===
      'BUY_VOL_IDEAL': {
        primary: 'long_strangle',
        alternatives: ['long_straddle'],
        confidence: 0.9
      },
      'BUY_VOL_GOOD': {
        primary: 'long_strangle',
        alternatives: ['calendar_spread'],
        confidence: 0.75
      },
      'BUY_VOL_AGGRESSIVE': {
        primary: 'long_straddle',
        alternatives: ['backspread'],
        confidence: 0.85
      },
      
      // === NEUTRAL REGIMES ===
      'RANGE_BOUND': {
        primary: 'iron_condor',
        alternatives: ['iron_butterfly'],
        confidence: 0.8
      },
      
      // === DANGEROUS REGIMES ===
      'UNCERTAIN_DANGEROUS': {
        primary: null,
        alternatives: [],
        confidence: 0.0
      },
      'NEUTRAL_WAIT': {
        primary: null,
        alternatives: [],
        confidence: 0.0
      }
    };
  }

  /**
   * Select best strategy for current regime
   * @param {Object} regime - Regime object from RegimeDetector
   * @param {Object} config - Bot configuration
   * @param {Array} availableStrategies - List of implemented strategies
   * @returns {Object} - Selection result
   */
  select(regime, config = {}, availableStrategies = []) {
    try {
      const mode = this.determineMode(config);
      
      this.logger.info(`[StrategySelector] Mode: ${mode}, Regime: ${regime.overall}`);

      // FIXED MODE: Always use configured strategy
      if (mode === 'FIXED') {
        return this.selectFixed(config, regime);
      }

      // DYNAMIC MODE: Change strategy based on regime
      if (mode === 'DYNAMIC') {
        return this.selectDynamic(regime, availableStrategies);
      }

      // HYBRID MODE: Use fixed strategy but validate regime
      if (mode === 'HYBRID') {
        return this.selectHybrid(config, regime);
      }

      // Default to fixed
      return this.selectFixed(config, regime);

    } catch (error) {
      this.logger.error('[StrategySelector] Error selecting strategy:', error);
      return {
        strategy: config.strategy || null,
        mode: 'FIXED',
        confidence: 0.0,
        reason: `Error: ${error.message}`,
        shouldTrade: false
      };
    }
  }

  /**
   * Determine selection mode from config
   * @param {Object} config - Bot configuration
   * @returns {string} - Mode ('FIXED', 'DYNAMIC', 'HYBRID')
   */
  determineMode(config) {
    if (config.strategySelectionMode) {
      return config.strategySelectionMode.toUpperCase();
    }

    // Default behavior based on config
    if (config.dynamicStrategySelection === true) {
      return 'DYNAMIC';
    }

    if (config.validateRegime === true) {
      return 'HYBRID';
    }

    return 'FIXED';
  }

  /**
   * FIXED MODE: Always use configured strategy
   * @param {Object} config - Bot configuration
   * @param {Object} regime - Current regime
   * @returns {Object} - Selection result
   */
  selectFixed(config, regime) {
    const strategy = config.strategy;

    if (!strategy) {
      return {
        strategy: null,
        mode: 'FIXED',
        confidence: 0.0,
        reason: 'No strategy configured',
        shouldTrade: false
      };
    }

    return {
      strategy,
      mode: 'FIXED',
      confidence: 1.0,
      reason: `Using configured strategy: ${strategy}`,
      shouldTrade: true,
      regime: regime.overall
    };
  }

  /**
   * DYNAMIC MODE: Select strategy based on regime
   * @param {Object} regime - Current regime
   * @param {Array} availableStrategies - Implemented strategies
   * @returns {Object} - Selection result
   */
  selectDynamic(regime, availableStrategies = []) {
    const mapping = this.regimeStrategyMap[regime.overall];

    if (!mapping || !mapping.primary) {
      return {
        strategy: null,
        mode: 'DYNAMIC',
        confidence: 0.0,
        reason: `No suitable strategy for regime: ${regime.overall}`,
        shouldTrade: false,
        regime: regime.overall
      };
    }

    // Check if primary strategy is available
    const primaryAvailable = availableStrategies.length === 0 || 
                            availableStrategies.includes(mapping.primary);

    if (primaryAvailable) {
      return {
        strategy: mapping.primary,
        mode: 'DYNAMIC',
        confidence: mapping.confidence,
        reason: `Best strategy for ${regime.overall}: ${mapping.primary}`,
        shouldTrade: true,
        regime: regime.overall,
        alternatives: mapping.alternatives
      };
    }

    // Try alternatives
    for (const alt of mapping.alternatives) {
      if (availableStrategies.length === 0 || availableStrategies.includes(alt)) {
        return {
          strategy: alt,
          mode: 'DYNAMIC',
          confidence: mapping.confidence * 0.8, // Slightly lower confidence for alternative
          reason: `Alternative strategy for ${regime.overall}: ${alt}`,
          shouldTrade: true,
          regime: regime.overall,
          alternatives: mapping.alternatives
        };
      }
    }

    // No available strategies
    return {
      strategy: null,
      mode: 'DYNAMIC',
      confidence: 0.0,
      reason: `No available strategies for regime: ${regime.overall}`,
      shouldTrade: false,
      regime: regime.overall
    };
  }

  /**
   * HYBRID MODE: Use fixed strategy but validate regime
   * @param {Object} config - Bot configuration
   * @param {Object} regime - Current regime
   * @returns {Object} - Selection result
   */
  selectHybrid(config, regime) {
    const strategy = config.strategy;

    if (!strategy) {
      return {
        strategy: null,
        mode: 'HYBRID',
        confidence: 0.0,
        reason: 'No strategy configured',
        shouldTrade: false
      };
    }

    // Check if regime supports this strategy type
    const strategyType = this.getStrategyType(strategy);
    const regimeFavorable = this.isRegimeFavorable(regime, strategyType);

    if (regimeFavorable) {
      return {
        strategy,
        mode: 'HYBRID',
        confidence: 0.8,
        reason: `Regime ${regime.overall} supports ${strategy}`,
        shouldTrade: true,
        regime: regime.overall
      };
    } else {
      return {
        strategy,
        mode: 'HYBRID',
        confidence: 0.0,
        reason: `Regime ${regime.overall} does NOT favor ${strategy} - WAITING`,
        shouldTrade: false,
        regime: regime.overall
      };
    }
  }

  /**
   * Get strategy type from strategy name
   * @param {string} strategyName - Strategy name
   * @returns {string} - Strategy type
   */
  getStrategyType(strategyName) {
    const volatilitySelling = [
      'iron_condor',
      'iron_butterfly',
      'short_strangle',
      'short_straddle',
      'bear_call_spread',
      'bull_put_spread'
    ];

    const volatilityBuying = [
      'long_strangle',
      'long_straddle',
      'calendar_spread',
      'backspread'
    ];

    if (volatilitySelling.includes(strategyName)) {
      return 'volatility-selling';
    }

    if (volatilityBuying.includes(strategyName)) {
      return 'volatility-buying';
    }

    return 'unknown';
  }

  /**
   * Check if regime is favorable for strategy type
   * @param {Object} regime - Current regime
   * @param {string} strategyType - Strategy type
   * @returns {boolean} - True if favorable
   */
  isRegimeFavorable(regime, strategyType) {
    const { overall } = regime;

    if (strategyType === 'volatility-selling') {
      return overall.startsWith('SELL_PREMIUM') || overall === 'RANGE_BOUND';
    }

    if (strategyType === 'volatility-buying') {
      return overall.startsWith('BUY_VOL');
    }

    // Unknown strategy type - be conservative
    return false;
  }

  /**
   * Get confidence adjustment based on regime
   * @param {Object} regime - Current regime
   * @param {string} strategy - Strategy name
   * @returns {number} - Confidence multiplier (0-1)
   */
  getConfidenceAdjustment(regime, strategy) {
    const mapping = this.regimeStrategyMap[regime.overall];

    if (!mapping) {
      return 0.5; // Neutral adjustment
    }

    if (mapping.primary === strategy) {
      return 1.0; // Perfect match
    }

    if (mapping.alternatives.includes(strategy)) {
      return 0.8; // Good match
    }

    return 0.3; // Poor match
  }

  /**
   * Check if strategy change is recommended
   * @param {string} currentStrategy - Current strategy
   * @param {string} recommendedStrategy - Recommended strategy
   * @param {Object} regime - Current regime
   * @returns {boolean} - True if should change
   */
  shouldChangeStrategy(currentStrategy, recommendedStrategy, regime) {
    // Don't change if same
    if (currentStrategy === recommendedStrategy) {
      return false;
    }

    // Don't change if no recommendation
    if (!recommendedStrategy) {
      return false;
    }

    // Change if regime strongly favors new strategy
    const mapping = this.regimeStrategyMap[regime.overall];
    if (mapping && mapping.primary === recommendedStrategy && mapping.confidence > 0.8) {
      return true;
    }

    return false;
  }

  /**
   * Get explanation for strategy selection
   * @param {Object} selection - Selection result
   * @returns {string} - Human-readable explanation
   */
  explainSelection(selection) {
    if (!selection.shouldTrade) {
      return `NOT TRADING: ${selection.reason}`;
    }

    let explanation = `Trading ${selection.strategy} (${selection.mode} mode)
`;
    explanation += `Regime: ${selection.regime}
`;
    explanation += `Confidence: ${(selection.confidence * 100).toFixed(0)}%
`;
    explanation += `Reason: ${selection.reason}`;

    if (selection.alternatives && selection.alternatives.length > 0) {
      explanation += `
Alternatives: ${selection.alternatives.join(', ')}`;
    }

    return explanation;
  }
}

module.exports = StrategySelector;
