const BaseStrategy = require('../BaseStrategy');
const StrikeSelector = require('../../utils/StrikeSelector');
const GreekAggregator = require('../../utils/GreekAggregator');
const RiskManager = require('../../utils/RiskManager');

/**
 * Iron Condor Strategy
 * 
 * STRUCTURE:
 * - Sell OTM Call (short call, delta ~-0.16)
 * - Buy further OTM Call (long call, wingWidth away)
 * - Sell OTM Put (short put, delta ~0.16)
 * - Buy further OTM Put (long put, wingWidth away)
 * 
 * CHARACTERISTICS:
 * - Delta-neutral (delta ~0)
 * - Positive theta (time decay profit)
 * - Negative gamma (risk on big moves)
 * - Negative vega (benefits from IV decrease)
 * 
 * BEST CONDITIONS:
 * - High IV Rank (>60)
 * - Expected range-bound market
 * - DTE: 30-45 days
 * - Close at 50% max profit or 21 DTE
 * 
 * RISK:
 * - Max Loss = Wing Width - Premium Received
 * - Max Profit = Premium Received
 * - Break-even = Short Strikes ± Premium
 */
class IronCondor extends BaseStrategy {
  constructor(config = {}) {
    super(config);
    
    this.name = 'Iron Condor';
    this.type = 'volatility-selling';

    // Iron Condor specific defaults
    this.defaults = {
      ...this.defaults,
      minIVRank: 60,          // Only enter when IV is high
      maxIVRank: 100,
      minDTE: 30,             // 30-45 days optimal
      maxDTE: 45,
      shortDelta: 0.16,       // Target delta for short strikes
      deltaTolerance: 0.02,   // Delta tolerance
      wingWidth: 5000,        // $5000 wing width (for BTC)
      maxDeltaTotal: 0.1,     // Max total delta
      minTheta: 10,           // Minimum positive theta
      profitTarget: 0.5,      // Close at 50% max profit
      stopLoss: 2.0,          // Stop at 2x max profit loss
      dteExit: 21,            // Close if DTE < 21
      deltaBreach: 0.25       // Close if delta > 0.25
    };

    this.params = { ...this.defaults, ...config };
  }

  /**
   * Check if entry conditions are met
   * @param {Object} marketData - Current market data
   * @param {Object} indicators - Calculated indicators
   * @returns {Promise<boolean>} - True if entry conditions met
   */
  async checkEntry(marketData, indicators) {
    // 1. Check IV Rank
    if (indicators.ivRank < this.params.minIVRank) {
      this.log('info', `IV Rank too low: ${indicators.ivRank.toFixed(1)} < ${this.params.minIVRank}`);
      return false;
    }

    // 2. Check volume
    if (indicators.totalVolume < this.params.minVolume) {
      this.log('info', `Volume too low: ${indicators.totalVolume}`);
      return false;
    }

    // 3. Check ATM options availability
    if (!indicators.atmOptions || indicators.atmOptions.length < 4) {
      this.log('info', 'Insufficient ATM options');
      return false;
    }

    // 4. Check market regime (optional - prefer positive gamma above flip)
    // This is optional but ideal for Iron Condor
    if (indicators.regime && indicators.regime !== 'POSITIVE_GAMMA_ABOVE_FLIP') {
      this.log('info', `Non-ideal regime: ${indicators.regime}`);
      // Don't reject, just note
    }

    this.log('info', 'Entry conditions met', {
      ivRank: indicators.ivRank,
      volume: indicators.totalVolume,
      regime: indicators.regime
    });

    return true;
  }

  /**
   * Select strikes for Iron Condor
   * @param {Object} marketData - Current market data
   * @param {Array} optionsData - Available options
   * @returns {Promise<Object>} - Selected legs and Greeks
   */
  async selectStrikes(marketData, optionsData) {
    try {
      const { spot } = marketData;

      // 1. Filter options by DTE and liquidity
      const validOptions = this.filterOptions(optionsData);

      if (validOptions.length === 0) {
        this.log('warn', 'No valid options after filtering');
        return null;
      }

      // 2. Get best expiry
      const bestExpiry = this.getBestExpiry(validOptions);

      if (!bestExpiry) {
        this.log('warn', 'Could not find suitable expiry');
        return null;
      }

      // 3. Filter by expiry
      const expiryOptions = validOptions.filter(opt => opt.expiry === bestExpiry);

      // 4. Separate calls and puts
      const { calls, puts } = this.separateCallsPuts(expiryOptions);

      if (calls.length === 0 || puts.length === 0) {
        this.log('warn', 'Insufficient calls or puts');
        return null;
      }

      // 5. Find short call (delta ~-0.16)
      const shortCall = StrikeSelector.findByDelta(
        calls,
        -this.params.shortDelta,
        this.params.deltaTolerance
      );

      if (!shortCall) {
        this.log('warn', 'Could not find short call');
        return null;
      }

      // 6. Find long call (wingWidth away)
      const longCall = StrikeSelector.findWing(
        calls,
        shortCall.strike,
        this.params.wingWidth,
        'above'
      );

      if (!longCall) {
        this.log('warn', 'Could not find long call');
        return null;
      }

      // 7. Find short put (delta ~0.16)
      const shortPut = StrikeSelector.findByDelta(
        puts,
        this.params.shortDelta,
        this.params.deltaTolerance
      );

      if (!shortPut) {
        this.log('warn', 'Could not find short put');
        return null;
      }

      // 8. Find long put (wingWidth away)
      const longPut = StrikeSelector.findWing(
        puts,
        shortPut.strike,
        this.params.wingWidth,
        'below'
      );

      if (!longPut) {
        this.log('warn', 'Could not find long put');
        return null;
      }

      // 9. Construct legs
      const legs = [
        { action: 'SELL', option: shortCall, quantity: 1 },
        { action: 'BUY', option: longCall, quantity: 1 },
        { action: 'SELL', option: shortPut, quantity: 1 },
        { action: 'BUY', option: longPut, quantity: 1 }
      ];

      // 10. Calculate Greeks
      const greeks = GreekAggregator.sum(legs);

      // 11. Validate Greeks
      if (Math.abs(greeks.delta) > this.params.maxDeltaTotal) {
        this.log('warn', `Delta too high: ${greeks.delta.toFixed(4)}`);
        return null;
      }

      if (greeks.theta < this.params.minTheta) {
        this.log('warn', `Theta too low: ${greeks.theta.toFixed(2)}`);
        return null;
      }

      // 12. Calculate max profit/loss
      const maxProfit = RiskManager.calculateMaxProfit(legs);
      const maxLoss = RiskManager.calculateMaxLoss(legs);

      // 13. Calculate break-even
      const breakEven = RiskManager.calculateBreakEven(legs, spot);

      this.log('success', 'Iron Condor strikes selected', {
        shortCall: shortCall.strike,
        longCall: longCall.strike,
        shortPut: shortPut.strike,
        longPut: longPut.strike,
        greeks: GreekAggregator.format(greeks),
        maxProfit: maxProfit.toFixed(2),
        maxLoss: maxLoss.toFixed(2),
        breakEven: {
          lower: breakEven.lower.toFixed(2),
          upper: breakEven.upper.toFixed(2)
        }
      });

      return {
        legs,
        greeks,
        maxProfit,
        maxLoss,
        breakEven,
        expiry: bestExpiry
      };

    } catch (error) {
      this.log('error', 'Error selecting strikes', error);
      return null;
    }
  }

  /**
   * Check if position should be exited
   * @param {Object} position - Current position
   * @param {Object} marketData - Current market data
   * @returns {Promise<Object>} - Exit decision
   */
  async checkExit(position, marketData) {
    try {
      const exitRules = {
        profitTarget: this.params.profitTarget,
        stopLoss: this.params.stopLoss,
        dteExit: this.params.dteExit,
        deltaBreach: this.params.deltaBreach,
        gammaSpike: 0.002,
        ivExpansion: 1.5
      };

      const exitDecision = RiskManager.checkExit(position, marketData, exitRules);

      if (exitDecision.shouldExit) {
        this.log('info', 'Exit triggered', {
          reasons: exitDecision.reasons.map(r => r.type),
          pnl: exitDecision.pnl.toFixed(2),
          pnlPercent: exitDecision.pnlPercent.toFixed(1)
        });
      }

      return exitDecision;

    } catch (error) {
      this.log('error', 'Error checking exit', error);
      return {
        shouldExit: false,
        reasons: [],
        error: error.message
      };
    }
  }

  /**
   * Calculate confidence for Iron Condor
   * @param {Object} indicators - Market indicators
   * @param {Object} greeks - Position Greeks
   * @param {number} riskRewardRatio - Risk-reward ratio
   * @returns {number} - Confidence score
   */
  calculateConfidence(indicators, greeks, riskRewardRatio) {
    let confidence = 0.5;  // Base confidence

    // IV Rank factor (higher is better for Iron Condor)
    if (indicators.ivRank > 80) {
      confidence += 0.25;
    } else if (indicators.ivRank > 70) {
      confidence += 0.15;
    } else if (indicators.ivRank > 60) {
      confidence += 0.1;
    }

    // Volume factor
    if (indicators.totalVolume > 2000) {
      confidence += 0.1;
    } else if (indicators.totalVolume > 1000) {
      confidence += 0.05;
    }

    // Delta neutrality factor (very important for Iron Condor)
    const deltaNeutrality = 1 - Math.abs(greeks.delta) / 0.1;
    confidence += deltaNeutrality * 0.15;

    // Theta factor (positive theta is good)
    if (greeks.theta > 50) {
      confidence += 0.1;
    } else if (greeks.theta > 20) {
      confidence += 0.05;
    }

    // Regime factor (optional)
    if (indicators.regime === 'POSITIVE_GAMMA_ABOVE_FLIP') {
      confidence += 0.1;
    }

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Get entry reason text
   * @param {Object} indicators - Market indicators
   * @param {Object} greeks - Position Greeks
   * @returns {string} - Entry reason
   */
  getEntryReason(indicators, greeks) {
    const parts = [
      `Iron Condor entry`,
      `IV Rank: ${indicators.ivRank.toFixed(1)}`,
      `Delta: ${greeks.delta.toFixed(3)}`,
      `Theta: ${greeks.theta.toFixed(2)}`
    ];

    if (indicators.regime) {
      parts.push(`Regime: ${indicators.regime}`);
    }

    return parts.join(', ');
  }

  /**
   * Get strategy description
   * @returns {string} - Strategy description
   */
  getDescription() {
    return `Iron Condor: Delta-neutral volatility selling strategy. ` +
           `Profits from time decay and IV contraction. ` +
           `Best in high IV environments (IV Rank > 60). ` +
           `Max profit = premium received, max loss = wing width - premium.`;
  }

  /**
   * Adjust position (optional - for future implementation)
   * @param {Object} position - Current position
   * @param {Object} marketData - Current market data
   * @returns {Promise<Object>} - Adjustment recommendation
   */
  async suggestAdjustment(position, marketData) {
    // Future implementation:
    // - If price moves close to short strike, consider rolling
    // - If delta breaches threshold, consider adding opposite side
    // - If IV spikes, consider closing early
    
    return {
      shouldAdjust: false,
      reason: 'No adjustment needed',
      adjustment: null
    };
  }
}

module.exports = IronCondor;
