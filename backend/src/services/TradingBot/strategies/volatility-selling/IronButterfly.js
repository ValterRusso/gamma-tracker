const BaseStrategy = require('../BaseStrategy');
const StrikeSelector = require('../../utils/StrikeSelector');
const GreekAggregator = require('../../utils/GreekAggregator');
const RiskManager = require('../../utils/RiskManager');

/**
 * Iron Butterfly Strategy
 * 
 * STRUCTURE:
 * - Sell ATM Call (short call, delta ~-0.50)
 * - Buy OTM Call (long call, wingWidth away)
 * - Sell ATM Put (short put, delta ~0.50)
 * - Buy OTM Put (long put, wingWidth away)
 * 
 * CHARACTERISTICS:
 * - Delta-neutral (delta ~0)
 * - Positive theta (HIGHER than Iron Condor)
 * - Negative gamma (HIGHER risk than Iron Condor)
 * - Negative vega (benefits from IV decrease)
 * 
 * BEST CONDITIONS:
 * - High IV Rank (>70)
 * - Expected pinning at current price
 * - DTE: 21-35 days (shorter than Iron Condor)
 * - Close at 50% max profit or 14 DTE
 * 
 * RISK:
 * - Max Loss = Wing Width - Premium Received
 * - Max Profit = Premium Received (HIGHER than Iron Condor)
 * - Break-even = ATM Strike ± (Premium / 2)
 * - NARROWER profit zone than Iron Condor
 * 
 * COMPARISON WITH IRON CONDOR:
 * - Higher premium collected
 * - Narrower profit zone
 * - Higher theta decay
 * - More sensitive to price movement
 */
class IronButterfly extends BaseStrategy {
  constructor(config = {}) {
    super(config);
    
    this.name = 'Iron Butterfly';
    this.type = 'volatility-selling';

    // Iron Butterfly specific defaults
    this.defaults = {
      ...this.defaults,
      minIVRank: 70,          // Only enter when IV is very high
      maxIVRank: 100,
      minDTE: 21,             // 21-35 days optimal (shorter than IC)
      maxDTE: 35,
      atmTolerance: 0.05,     // 5% tolerance for ATM selection
      wingWidth: 5000,        // $5000 wing width (for BTC)
      maxDeltaTotal: 0.1,     // Max total delta
      minTheta: 15,           // Minimum positive theta (higher than IC)
      profitTarget: 0.5,      // Close at 50% max profit
      stopLoss: 2.0,          // Stop at 2x max profit loss
      dteExit: 14,            // Close if DTE < 14 (earlier than IC)
      deltaBreach: 0.3        // Close if delta > 0.3 (more lenient)
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
    // 1. Check IV Rank (higher threshold than Iron Condor)
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

    // 4. Check market regime (prefer positive gamma above flip)
    if (indicators.regime && indicators.regime !== 'POSITIVE_GAMMA_ABOVE_FLIP') {
      this.log('warn', `Non-ideal regime for Iron Butterfly: ${indicators.regime}`);
      // More strict than Iron Condor - consider rejecting
      if (indicators.regime === 'NEGATIVE_GAMMA_BELOW_FLIP') {
        this.log('info', 'Rejecting due to high volatility regime');
        return false;
      }
    }

    // 5. Check for recent price stability (optional)
    // Iron Butterfly works best when price is expected to stay near current level
    if (indicators.rsi) {
      // Prefer RSI near 50 (neutral)
      if (Math.abs(indicators.rsi - 50) > 30) {
        this.log('info', `RSI too extreme for Iron Butterfly: ${indicators.rsi.toFixed(1)}`);
        // Don't reject, just note
      }
    }

    this.log('info', 'Entry conditions met', {
      ivRank: indicators.ivRank,
      volume: indicators.totalVolume,
      regime: indicators.regime
    });

    return true;
  }

  /**
   * Select strikes for Iron Butterfly
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

      // 5. Find ATM call (delta ~-0.50)
      const atmCall = StrikeSelector.findATM(calls, spot);

      if (!atmCall) {
        this.log('warn', 'Could not find ATM call');
        return null;
      }

      // Verify it's truly ATM
      const atmCallDistance = Math.abs(atmCall.strike - spot) / spot;
      if (atmCallDistance > this.params.atmTolerance) {
        this.log('warn', `ATM call too far from spot: ${(atmCallDistance * 100).toFixed(2)}%`);
        return null;
      }

      // 6. Find long call (wingWidth away)
      const longCall = StrikeSelector.findWing(
        calls,
        atmCall.strike,
        this.params.wingWidth,
        'above'
      );

      if (!longCall) {
        this.log('warn', 'Could not find long call');
        return null;
      }

      // 7. Find ATM put (delta ~0.50)
      // For Iron Butterfly, both shorts should be at same strike
      const atmPut = puts.find(opt => opt.strike === atmCall.strike);

      if (!atmPut) {
        this.log('warn', 'Could not find ATM put at same strike as call');
        return null;
      }

      // 8. Find long put (wingWidth away)
      const longPut = StrikeSelector.findWing(
        puts,
        atmPut.strike,
        this.params.wingWidth,
        'below'
      );

      if (!longPut) {
        this.log('warn', 'Could not find long put');
        return null;
      }

      // 9. Construct legs
      const legs = [
        { action: 'SELL', option: atmCall, quantity: 1 },
        { action: 'BUY', option: longCall, quantity: 1 },
        { action: 'SELL', option: atmPut, quantity: 1 },
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

      // 14. Verify break-even range is reasonable
      const breakEvenRange = breakEven.upper - breakEven.lower;
      const breakEvenRangePercent = (breakEvenRange / spot) * 100;

      if (breakEvenRangePercent < 2) {
        this.log('warn', `Break-even range too narrow: ${breakEvenRangePercent.toFixed(2)}%`);
        // Don't reject, just note
      }

      this.log('success', 'Iron Butterfly strikes selected', {
        atmStrike: atmCall.strike,
        longCall: longCall.strike,
        longPut: longPut.strike,
        spot: spot.toFixed(2),
        greeks: GreekAggregator.format(greeks),
        maxProfit: maxProfit.toFixed(2),
        maxLoss: maxLoss.toFixed(2),
        breakEven: {
          lower: breakEven.lower.toFixed(2),
          upper: breakEven.upper.toFixed(2),
          range: breakEvenRange.toFixed(2),
          rangePercent: breakEvenRangePercent.toFixed(2)
        }
      });

      return {
        legs,
        greeks,
        maxProfit,
        maxLoss,
        breakEven,
        expiry: bestExpiry,
        atmStrike: atmCall.strike
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
        gammaSpike: 0.003,      // Higher threshold than IC
        ivExpansion: 1.5
      };

      const exitDecision = RiskManager.checkExit(position, marketData, exitRules);

      // Additional Iron Butterfly specific exit logic
      if (!exitDecision.shouldExit && position.atmStrike) {
        const { spot } = marketData;
        const distanceFromATM = Math.abs(spot - position.atmStrike);
        const distancePercent = (distanceFromATM / position.atmStrike) * 100;

        // If price moves too far from ATM, consider exiting
        if (distancePercent > 3) {
          exitDecision.reasons.push({
            type: 'PRICE_DRIFT',
            message: `Price drifted ${distancePercent.toFixed(2)}% from ATM strike`,
            priority: 'MEDIUM'
          });

          // Re-evaluate shouldExit
          const highPriorityReasons = exitDecision.reasons.filter(
            r => r.priority === 'HIGH' || r.priority === 'CRITICAL'
          );
          exitDecision.shouldExit = highPriorityReasons.length > 0;
        }
      }

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
   * Calculate confidence for Iron Butterfly
   * @param {Object} indicators - Market indicators
   * @param {Object} greeks - Position Greeks
   * @param {number} riskRewardRatio - Risk-reward ratio
   * @returns {number} - Confidence score
   */
  calculateConfidence(indicators, greeks, riskRewardRatio) {
    let confidence = 0.5;  // Base confidence

    // IV Rank factor (even higher threshold than Iron Condor)
    if (indicators.ivRank > 85) {
      confidence += 0.3;
    } else if (indicators.ivRank > 75) {
      confidence += 0.2;
    } else if (indicators.ivRank > 70) {
      confidence += 0.1;
    }

    // Volume factor
    if (indicators.totalVolume > 2000) {
      confidence += 0.1;
    } else if (indicators.totalVolume > 1000) {
      confidence += 0.05;
    }

    // Delta neutrality factor (very important)
    const deltaNeutrality = 1 - Math.abs(greeks.delta) / 0.1;
    confidence += deltaNeutrality * 0.15;

    // Theta factor (higher theta is better for Iron Butterfly)
    if (greeks.theta > 80) {
      confidence += 0.15;
    } else if (greeks.theta > 50) {
      confidence += 0.1;
    } else if (greeks.theta > 20) {
      confidence += 0.05;
    }

    // Regime factor (more important for Iron Butterfly)
    if (indicators.regime === 'POSITIVE_GAMMA_ABOVE_FLIP') {
      confidence += 0.15;
    } else if (indicators.regime === 'NEGATIVE_GAMMA_BELOW_FLIP') {
      confidence -= 0.2;  // Penalize high volatility regime
    }

    // RSI neutrality factor (prefer RSI near 50)
    if (indicators.rsi) {
      const rsiNeutrality = 1 - Math.abs(indicators.rsi - 50) / 50;
      confidence += rsiNeutrality * 0.1;
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
      `Iron Butterfly entry`,
      `IV Rank: ${indicators.ivRank.toFixed(1)}`,
      `Delta: ${greeks.delta.toFixed(3)}`,
      `Theta: ${greeks.theta.toFixed(2)}`
    ];

    if (indicators.regime) {
      parts.push(`Regime: ${indicators.regime}`);
    }

    if (indicators.rsi) {
      parts.push(`RSI: ${indicators.rsi.toFixed(1)}`);
    }

    return parts.join(', ');
  }

  /**
   * Get strategy description
   * @returns {string} - Strategy description
   */
  getDescription() {
    return `Iron Butterfly: Delta-neutral volatility selling strategy with ATM shorts. ` +
           `Higher premium and theta than Iron Condor, but narrower profit zone. ` +
           `Best in very high IV environments (IV Rank > 70) with expected price stability. ` +
           `Max profit = premium received, max loss = wing width - premium.`;
  }

  /**
   * Compare with Iron Condor
   * @returns {Object} - Comparison details
   */
  compareWithIronCondor() {
    return {
      advantages: [
        'Higher premium collected',
        'Higher theta decay',
        'Simpler strike selection (ATM)',
        'Better for pinning scenarios'
      ],
      disadvantages: [
        'Narrower profit zone',
        'Higher gamma risk',
        'More sensitive to price movement',
        'Requires very high IV'
      ],
      whenToUse: [
        'IV Rank > 70',
        'Expect price to stay near current level',
        'Strong support/resistance at current price',
        'Positive gamma regime'
      ]
    };
  }
}

module.exports = IronButterfly;
