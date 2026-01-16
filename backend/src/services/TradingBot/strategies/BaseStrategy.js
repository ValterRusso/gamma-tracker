const StrikeSelector = require('../utils/StrikeSelector');
const GreekAggregator = require('../utils/GreekAggregator');
const PositionSizer = require('../utils/PositionSizer');
const RiskManager = require('../utils/RiskManager');
const Logger = require('../../../utils/logger');

/**
 * Base Strategy Class
 * Abstract class that all trading strategies must extend
 */
class BaseStrategy {
  constructor(config = {}) {
    this.name = 'BaseStrategy';
    this.type = 'unknown';  // 'volatility-selling', 'volatility-buying', 'greek-based'
    this.config = config;
    this.logger = new Logger(`Strategy-${this.name}`);

    // Default configuration
    this.defaults = {
      minIVRank: 0,
      maxIVRank: 100,
      minDTE: 21,
      maxDTE: 60,
      minVolume: 0.1,
      minOI: 1,
      maxSpread: 0.1,
      riskPercent: 2,
      profitTarget: 0.5,
      stopLoss: 2.0,
      dteExit: 21,
      deltaBreach: 0.25
    };

    // Merge with provided config
    this.params = { ...this.defaults, ...config };
  }

  /**
   * Check if entry conditions are met
   * MUST be implemented by child classes
   * @param {Object} marketData - Current market data
   * @param {Object} indicators - Calculated indicators
   * @returns {Promise<boolean>} - True if entry conditions met
   */
  async checkEntry(marketData, indicators) {
    throw new Error(`checkEntry() must be implemented by ${this.name}`);
  }

  /**
   * Select strikes for the strategy
   * MUST be implemented by child classes
   * @param {Object} marketData - Current market data
   * @param {Array} optionsData - Available options
   * @returns {Promise<Object>} - Selected legs and Greeks
   */
  async selectStrikes(marketData, optionsData) {
    throw new Error(`selectStrikes() must be implemented by ${this.name}`);
  }

  /**
   * Check if position should be exited
   * MUST be implemented by child classes
   * @param {Object} position - Current position
   * @param {Object} marketData - Current market data
   * @returns {Promise<Object>} - Exit decision
   */
  async checkExit(position, marketData) {
    throw new Error(`checkExit() must be implemented by ${this.name}`);
  }

  /**
   * Generate trading signal
   * Common method used by all strategies
   * @param {Object} marketData - Current market data
   * @param {Object} indicators - Calculated indicators
   * @param {Array} optionsData - Available options
   * @returns {Promise<Object>} - Trading signal
   */
  async generateSignal(marketData, indicators, optionsData) {
    try {
      // 1. Check entry conditions
      const entryOk = await this.checkEntry(marketData, indicators);

      if (!entryOk) {
        return {
          signalType: 'wait',
          strategy: this.name,
          confidence: 0,
          reason: 'Entry conditions not met',
          marketData: indicators
        };
      }

      // 2. Select strikes
      const selection = await this.selectStrikes(marketData, optionsData);

      if (!selection || !selection.legs || selection.legs.length === 0) {
        return {
          signalType: 'wait',
          strategy: this.name,
          confidence: 0,
          reason: 'Could not find suitable strikes',
          marketData: indicators
        };
      }

      // 3. Calculate Greeks
      const greeks = GreekAggregator.sum(selection.legs);

      // 4. Calculate max profit/loss
      const maxProfit = RiskManager.calculateMaxProfit(selection.legs);
      const maxLoss = RiskManager.calculateMaxLoss(selection.legs);
      const riskRewardRatio = RiskManager.calculateRiskReward(maxProfit, maxLoss);

      // 5. Calculate break-even
      const breakEven = RiskManager.calculateBreakEven(selection.legs, marketData.spot);

      // 6. Validate risk
      const position = {
        legs: selection.legs,
        greeks,
        maxProfit,
        maxLoss,
        riskRewardRatio,
        breakEven
      };

      const riskValidation = RiskManager.validate(position, this.params);

      if (!riskValidation.valid) {
        return {
          signalType: 'wait',
          strategy: this.name,
          confidence: 0,
          reason: `Risk validation failed: ${riskValidation.violations.join(', ')}`,
          marketData: indicators,
          position
        };
      }

      // 7. Calculate position size
      const accountBalance = this.params.accountBalance || 10000;
      const positionSize = PositionSizer.calculate({
        accountBalance,
        riskPercent: this.params.riskPercent,
        maxLoss,
        ivRank: indicators.ivRank,
        method: 'volatility'
      });

      // 8. Calculate confidence
      const confidence = this.calculateConfidence(indicators, greeks, riskRewardRatio);

      // 9. Generate signal
      return {
        signalType: 'entry',
        strategy: this.name,
        confidence,
        reason: this.getEntryReason(indicators, greeks),
        marketData: indicators,
        position: {
          ...position,
          contracts: positionSize.contracts,
          totalRisk: positionSize.totalRisk,
          riskPercent: positionSize.riskPercent
        },
        legs: selection.legs
      };

    } catch (error) {
      this.logger.error(`[${this.name}] Error generating signal:`, error);
      return {
        signalType: 'error',
        strategy: this.name,
        confidence: 0,
        reason: error.message,
        marketData: indicators
      };
    }
  }

  /**
   * Calculate signal confidence (0-1)
   * Can be overridden by child classes
   * @param {Object} indicators - Market indicators
   * @param {Object} greeks - Position Greeks
   * @param {number} riskRewardRatio - Risk-reward ratio
   * @returns {number} - Confidence score
   */
  calculateConfidence(indicators, greeks, riskRewardRatio) {
    let confidence = 0.5;  // Base confidence

    // IV Rank factor
    if (this.type === 'volatility-selling') {
      // Higher confidence for higher IV Rank
      if (indicators.ivRank > 70) confidence += 0.2;
      else if (indicators.ivRank > 60) confidence += 0.1;
    } else if (this.type === 'volatility-buying') {
      // Higher confidence for lower IV Rank
      if (indicators.ivRank < 30) confidence += 0.2;
      else if (indicators.ivRank < 40) confidence += 0.1;
    }

    // Volume factor
    if (indicators.totalVolume > 2000) {
      confidence += 0.1;
    }

    // Risk-reward factor
    if (riskRewardRatio > 0.5) {
      confidence += 0.1;
    }

    // Delta neutrality factor
    if (Math.abs(greeks.delta) < 0.05) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Get entry reason text
   * Can be overridden by child classes
   * @param {Object} indicators - Market indicators
   * @param {Object} greeks - Position Greeks
   * @returns {string} - Entry reason
   */
  getEntryReason(indicators, greeks) {
    return `${this.name} entry: IV Rank ${indicators.ivRank.toFixed(1)}, Delta ${greeks.delta.toFixed(3)}`;
  }

  /**
   * Filter options by DTE and liquidity
   * Common utility method
   * @param {Array} options - All available options
   * @returns {Array} - Filtered options
   */
  filterOptions(options) {
    return options.filter(opt => {
      // DTE check
      const dte = StrikeSelector.calculateDTE(opt.expiry);
      if (dte < this.params.minDTE || dte > this.params.maxDTE) {
        return false;
      }

      // Liquidity check
      const hasLiquidity = StrikeSelector.hasLiquidity(opt, {
        minVolume: this.params.minVolume,
        minOI: this.params.minOI,
        minBid: 0.0001,
        maxSpread: this.params.maxSpread
      });

      return hasLiquidity;
    });
  }

  /**
   * Separate options into calls and puts
   * Common utility method
   * @param {Array} options - Filtered options
   * @returns {Object} - { calls, puts }
   */
  separateCallsPuts(options) {
    return {
      calls: options.filter(opt => opt.side === 'CALL'),
      puts: options.filter(opt => opt.side === 'PUT')
    };
  }

  /**
   * Get best expiry for strategy
   * Common utility method
   * @param {Array} options - All available options
   * @returns {number} - Best expiry timestamp
   */
  getBestExpiry(options) {
    const targetDTE = (this.params.minDTE + this.params.maxDTE) / 2;
    return StrikeSelector.getBestExpiry(options, targetDTE);
  }

  /**
   * Format legs for execution
   * Common utility method
   * @param {Array} legs - Strategy legs
   * @returns {Array} - Formatted legs
   */
  formatLegs(legs) {
    return legs.map(leg => ({
      action: leg.action,
      symbol: leg.option.symbol,
      strike: leg.option.strike,
      side: leg.option.side,
      expiry: leg.option.expiry,
      quantity: leg.quantity,
      price: leg.option.mark_price || leg.option.bid_price,
      delta: leg.option.delta,
      gamma: leg.option.gamma,
      theta: leg.option.theta,
      vega: leg.option.vega
    }));
  }

  /**
   * Get strategy description
   * Can be overridden by child classes
   * @returns {string} - Strategy description
   */
  getDescription() {
    return `${this.name} strategy`;
  }

  /**
   * Get strategy parameters
   * @returns {Object} - Strategy parameters
   */
  getParameters() {
    return {
      name: this.name,
      type: this.type,
      params: this.params
    };
  }

  /**
   * Validate strategy configuration
   * @returns {Object} - Validation result
   */
  validateConfig() {
    const checks = {
      ivRankValid: this.params.minIVRank >= 0 && this.params.maxIVRank <= 100,
      dteValid: this.params.minDTE > 0 && this.params.maxDTE > this.params.minDTE,
      riskValid: this.params.riskPercent > 0 && this.params.riskPercent <= 50,
      profitTargetValid: this.params.profitTarget > 0 && this.params.profitTarget <= 1,
      stopLossValid: this.params.stopLoss > 0
    };

    return {
      valid: Object.values(checks).every(v => v),
      checks
    };
  }

  /**
   * Log strategy action
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  log(level, message, data = {}) {
    this.logger[level](`[${this.name}] ${message}`, data);
  }
}

module.exports = BaseStrategy;
