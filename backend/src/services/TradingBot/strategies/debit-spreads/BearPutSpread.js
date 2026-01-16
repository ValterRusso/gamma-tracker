const BaseStrategy = require('../BaseStrategy');
const StrikeSelector = require('../../utils/StrikeSelector');
const GreekAggregator = require('../../utils/GreekAggregator');
const RiskManager = require('../../utils/RiskManager');

/**
 * Bear Put Spread Strategy (Vertical Debit Spread)
 * 
 * STRUCTURE:
 * - Buy Put (higher strike, delta ~-0.60) - LONG
 * - Sell Put (lower strike, delta ~-0.40) - SHORT
 * 
 * CHARACTERISTICS:
 * - Bearish directional strategy
 * - Limited risk (debit paid)
 * - Limited profit (spread width - debit)
 * - Negative delta (benefits from price decrease)
 * - Negative theta (loses value over time)
 * - Negative vega (benefits from IV decrease)
 * 
 * BEST CONDITIONS:
 * - Moderately bearish outlook
 * - Low to medium IV (cheaper entry)
 * - DTE: 30-60 days
 * - Close when profit target hit or near expiry
 * 
 * RISK:
 * - Max Loss = Debit Paid (premium paid)
 * - Max Profit = Spread Width - Debit Paid
 * - Break-even = Higher Strike - Debit Paid
 * 
 * EXAMPLE:
 * BTC @ $95,000
 * Buy 95k Put @ $5,000 (delta -0.60)
 * Sell 90k Put @ $2,500 (delta -0.40)
 * Debit: $2,500
 * Max Profit: $5,000 - $2,500 = $2,500
 * Max Loss: $2,500
 * Break-even: $92,500
 */
class BearPutSpread extends BaseStrategy {
  constructor(config = {}) {
    super(config);
    
    this.name = 'Bear Put Spread';
    this.type = 'debit-spreads';

    // Bear Put Spread specific defaults
    this.defaults = {
      ...this.defaults,
      minIVRank: 0,           // Can enter in any IV
      maxIVRank: 60,          // Prefer lower IV (cheaper)
      minDTE: 30,             // 30-60 days optimal
      maxDTE: 60,
      longDelta: -0.60,       // Buy put delta (negative)
      shortDelta: -0.40,      // Sell put delta (negative)
      deltaTolerance: 0.10,   // +/- 10% delta tolerance
      minSpreadWidth: 1000,   // Minimum $1000 spread
      maxSpreadWidth: 10000,  // Maximum $10000 spread
      profitTarget: 0.5,      // Close at 50% max profit
      stopLoss: 0.75,         // Stop at 75% max loss
      dteExit: 14             // Close if DTE < 14
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
    // 1. Check volume
    if (indicators.totalVolume < this.params.minVolume) {
      this.log('info', `Volume too low: ${indicators.totalVolume}`);
      return false;
    }

    // 2. Check options availability
    if (!indicators.atmOptions || indicators.atmOptions.length < 2) {
      this.log('info', 'Insufficient options');
      return false;
    }

    // 3. Bear Put Spread works in any market, but prefer:
    // - Low IV (cheaper entry)
    // - Bearish signals (optional, not required for validation)
    
    this.log('info', 'Entry conditions met', {
      ivRank: indicators.ivRank,
      volume: indicators.totalVolume,
      regime: indicators.regime
    });

    return true;
  }

  /**
   * Select strikes for Bear Put Spread
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

      // 4. Get only puts
      const puts = expiryOptions.filter(opt => opt.side === 'PUT');

      if (puts.length < 2) {
        this.log('warn', 'Insufficient puts');
        return null;
      }

      // 5. Find long put (higher strike, delta ~-0.60)
      const longPut = StrikeSelector.findByDelta(
        puts,
        this.params.longDelta,
        this.params.deltaTolerance
      );

      if (!longPut) {
        this.log('warn', `Could not find long put with delta ${this.params.longDelta}`);
        return null;
      }

      // 6. Find short put (lower strike, delta ~-0.40)
      // Must be below long put strike
      const shortPutCandidates = puts.filter(opt => opt.strike < longPut.strike);
      
      const shortPut = StrikeSelector.findByDelta(
        shortPutCandidates,
        this.params.shortDelta,
        this.params.deltaTolerance
      );

      if (!shortPut) {
        this.log('warn', `Could not find short put with delta ${this.params.shortDelta}`);
        return null;
      }

      // 7. Validate spread width
      const spreadWidth = longPut.strike - shortPut.strike;
      
      if (spreadWidth < this.params.minSpreadWidth || spreadWidth > this.params.maxSpreadWidth) {
        this.log('warn', `Spread width ${spreadWidth} outside range [${this.params.minSpreadWidth}, ${this.params.maxSpreadWidth}]`);
        return null;
      }

      // 8. Construct legs
      const legs = [
        { action: 'BUY', option: longPut, quantity: 1 },
        { action: 'SELL', option: shortPut, quantity: 1 }
      ];

      // 9. Calculate Greeks
      const greeks = GreekAggregator.sum(legs);

      // 10. Validate Greeks (should be negative delta for bearish)
      if (greeks.delta >= 0) {
        this.log('warn', `Delta not negative: ${greeks.delta.toFixed(4)}`);
        return null;
      }

      // 11. Calculate max profit/loss
      const debitPaid = longPut.mark_price - shortPut.mark_price;
      const maxProfit = spreadWidth - debitPaid;
      const maxLoss = debitPaid;

      // 12. Validate risk/reward
      if (maxProfit <= 0) {
        this.log('warn', `Max profit not positive: ${maxProfit.toFixed(2)}`);
        return null;
      }

      const riskReward = maxProfit / maxLoss;
      
      if (riskReward < 0.5) {
        this.log('warn', `Risk/reward too low: ${riskReward.toFixed(2)}`);
        return null;
      }

      // 13. Calculate break-even
      const breakEven = {
        lower: longPut.strike - debitPaid,
        upper: longPut.strike - debitPaid // Same for spread
      };

      this.log('success', 'Bear Put Spread strikes selected', {
        longPut: longPut.strike,
        shortPut: shortPut.strike,
        spreadWidth: spreadWidth.toFixed(2),
        spot: spot.toFixed(2),
        greeks: GreekAggregator.format(greeks),
        debitPaid: debitPaid.toFixed(2),
        maxProfit: maxProfit.toFixed(2),
        maxLoss: maxLoss.toFixed(2),
        riskReward: riskReward.toFixed(2),
        breakEven: breakEven.lower.toFixed(2)
      });

      return {
        legs,
        greeks,
        maxProfit,
        maxLoss,
        breakEven,
        expiry: bestExpiry,
        spreadWidth,
        debitPaid
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
        dteExit: this.params.dteExit
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
   * Calculate confidence for Bear Put Spread
   * @param {Object} indicators - Market indicators
   * @param {Object} greeks - Position Greeks
   * @param {number} riskRewardRatio - Risk-reward ratio
   * @returns {number} - Confidence score
   */
  calculateConfidence(indicators, greeks, riskRewardRatio) {
    let confidence = 0.5;  // Base confidence

    // IV Rank factor (prefer lower IV)
    if (indicators.ivRank < 30) {
      confidence += 0.2;
    } else if (indicators.ivRank < 50) {
      confidence += 0.1;
    }

    // Volume factor
    if (indicators.totalVolume > 2000) {
      confidence += 0.1;
    } else if (indicators.totalVolume > 1000) {
      confidence += 0.05;
    }

    // Delta factor (should be negative)
    if (greeks.delta < -0.15) {
      confidence += 0.1;
    } else if (greeks.delta < -0.10) {
      confidence += 0.05;
    }

    // Risk/Reward factor
    if (riskRewardRatio > 1.5) {
      confidence += 0.15;
    } else if (riskRewardRatio > 1.0) {
      confidence += 0.1;
    } else if (riskRewardRatio > 0.5) {
      confidence += 0.05;
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
      `Bear Put Spread entry`,
      `Delta: ${greeks.delta.toFixed(3)}`,
      `IV Rank: ${indicators.ivRank.toFixed(1)}`
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
    return `Bear Put Spread: Bearish directional strategy with limited risk and limited profit. ` +
           `Buy higher strike put, sell lower strike put. ` +
           `Best in low to medium IV environments. ` +
           `Max profit = spread width - debit, max loss = debit paid.`;
  }
}

module.exports = BearPutSpread;
