const IronCondor = require('./volatility-selling/IronCondor');
const IronButterfly = require('./volatility-selling/IronButterfly');
const BullCallSpread = require('./debit-spreads/BullCallSpread');
const BearPutSpread = require('./debit-spreads/BearPutSpread');
const RSIDivergenceStrategy = require('./divergence/RSIDivergenceStrategy');
const Logger = require('../../../utils/logger');

/**
 * Strategy Factory
 * Creates strategy instances based on configuration
 */
class StrategyFactory {
  constructor() {
    this.logger = new Logger('StrategyFactory');
    
    // Registry of available strategies
    this.strategies = {
      // Volatility Selling (4 legs)
      'iron_condor': IronCondor,
      'iron_butterfly': IronButterfly,
      
      // Debit Spreads (2 legs)
      'bull_call_spread': BullCallSpread,
      'bear_put_spread': BearPutSpread,
      
      // Divergence-Based Strategies
      'rsi_divergence': RSIDivergenceStrategy
      
      // TODO: Add more strategies as they are implemented
      // 'credit_spreads': CreditSpreads,
      // 'short_strangle': ShortStrangle,
      // 'long_straddle': LongStraddle,
      // 'long_strangle': LongStrangle,
      // 'gamma_scalping': GammaScalping,
      // 'vega_play': VegaPlay,
      // 'theta_harvesting': ThetaHarvesting
    };
  }

  /**
   * Create strategy instance
   * @param {string} strategyName - Strategy name (e.g., 'iron_condor')
   * @param {Object} config - Strategy configuration
   * @returns {BaseStrategy} - Strategy instance
   */
  create(strategyName, config = {}) {
    const StrategyClass = this.strategies[strategyName];

    if (!StrategyClass) {
      const available = Object.keys(this.strategies).join(', ');
      throw new Error(
        `Unknown strategy: ${strategyName}. Available strategies: ${available}`
      );
    }

    try {
      const strategy = new StrategyClass(config);
      this.logger.info(`Created strategy: ${strategy.name}`);
      return strategy;
    } catch (error) {
      this.logger.error(`Error creating strategy ${strategyName}:`, error);
      throw error;
    }
  }

  /**
   * Get list of available strategies
   * @returns {Array} - Array of strategy names
   */
  getAvailableStrategies() {
    return Object.keys(this.strategies);
  }

  /**
   * Get strategy info
   * @param {string} strategyName - Strategy name
   * @returns {Object} - Strategy information
   */
  getStrategyInfo(strategyName) {
    const StrategyClass = this.strategies[strategyName];

    if (!StrategyClass) {
      return null;
    }

    // Create temporary instance to get info
    const tempStrategy = new StrategyClass();

    return {
      name: tempStrategy.name,
      type: tempStrategy.type,
      description: tempStrategy.getDescription(),
      parameters: tempStrategy.getParameters()
    };
  }

  /**
   * Get all strategies info
   * @returns {Array} - Array of strategy information
   */
  getAllStrategiesInfo() {
    return Object.keys(this.strategies).map(name => 
      this.getStrategyInfo(name)
    );
  }

  /**
   * Validate strategy configuration
   * @param {string} strategyName - Strategy name
   * @param {Object} config - Strategy configuration
   * @returns {Object} - Validation result
   */
  validateConfig(strategyName, config) {
    try {
      const strategy = this.create(strategyName, config);
      return strategy.validateConfig();
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get strategies by type
   * @param {string} type - Strategy type ('volatility-selling', 'volatility-buying', 'greek-based')
   * @returns {Array} - Array of strategy names
   */
  getStrategiesByType(type) {
    return Object.entries(this.strategies)
      .filter(([_, StrategyClass]) => {
        const tempStrategy = new StrategyClass();
        return tempStrategy.type === type;
      })
      .map(([name]) => name);
  }

  /**
   * Get recommended strategy based on market conditions
   * @param {Object} indicators - Market indicators
   * @returns {string} - Recommended strategy name
   */
  getRecommendedStrategy(indicators) {
    const { ivRank, regime, totalVolume } = indicators;

    // High IV Rank (>70) - Volatility Selling
    if (ivRank > 70) {
      // Very high IV + stable price - Iron Butterfly
      if (regime === 'POSITIVE_GAMMA_ABOVE_FLIP' && totalVolume > 1000) {
        return 'iron_butterfly';
      }
      // High IV + range-bound - Iron Condor
      return 'iron_condor';
    }

    // Medium IV Rank (40-70) - Neutral strategies
    if (ivRank > 40) {
      return 'iron_condor';
    }

    // Low IV Rank (<40) - Volatility Buying
    // (Not implemented yet)
    return null;
  }

  /**
   * Register custom strategy
   * @param {string} name - Strategy name
   * @param {Class} StrategyClass - Strategy class
   */
  register(name, StrategyClass) {
    if (this.strategies[name]) {
      this.logger.warn(`Strategy ${name} already exists, overwriting`);
    }

    this.strategies[name] = StrategyClass;
    this.logger.info(`Registered strategy: ${name}`);
  }

  /**
   * Unregister strategy
   * @param {string} name - Strategy name
   */
  unregister(name) {
    if (!this.strategies[name]) {
      this.logger.warn(`Strategy ${name} not found`);
      return false;
    }

    delete this.strategies[name];
    this.logger.info(`Unregistered strategy: ${name}`);
    return true;
  }
}

// Export singleton instance
module.exports = new StrategyFactory();
