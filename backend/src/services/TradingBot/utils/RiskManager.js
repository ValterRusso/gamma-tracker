/**
 * Risk Management Utility
 * Validates positions against risk limits and calculates risk metrics
 */
class RiskManager {
  /**
   * Validate position against risk limits
   * @param {Object} position - Position object with legs, greeks, maxLoss, etc.
   * @param {Object} config - Risk configuration
   * @returns {Object} - Validation result
   */
  static validate(position, config = {}) {
    const defaults = {
      maxDelta: 0.25,
      maxGamma: 0.001,
      minTheta: -100,
      maxVega: 500,
      maxLossPerTrade: 10000,
      minRiskReward: 0.3,
      maxDrawdown: 0.2,
      maxPortfolioRisk: 0.1
    };

    const cfg = { ...defaults, ...config };

    const checks = {
      deltaLimit: Math.abs(position.greeks.delta) <= cfg.maxDelta,
      gammaLimit: Math.abs(position.greeks.gamma) <= cfg.maxGamma,
      thetaLimit: position.greeks.theta >= cfg.minTheta,
      vegaLimit: Math.abs(position.greeks.vega) <= cfg.maxVega,
      maxLossLimit: position.maxLoss <= cfg.maxLossPerTrade,
      riskRewardOk: position.riskRewardRatio >= cfg.minRiskReward
    };

    const violations = Object.entries(checks)
      .filter(([_, passed]) => !passed)
      .map(([check]) => check);

    return {
      valid: Object.values(checks).every(v => v),
      checks,
      violations,
      position
    };
  }

  /**
   * Calculate risk-reward ratio
   * @param {number} maxProfit - Maximum profit
   * @param {number} maxLoss - Maximum loss
   * @returns {number} - Risk-reward ratio
   */
  static calculateRiskReward(maxProfit, maxLoss) {
    if (maxLoss === 0) return Infinity;
    return maxProfit / maxLoss;
  }

  /**
   * Calculate maximum loss for a position
   * @param {Array} legs - Array of leg objects
   * @returns {number} - Maximum loss
   */
  static calculateMaxLoss(legs) {
    // Calculate net premium
    const netPremium = legs.reduce((total, leg) => {
      const price = leg.option.mark_price || leg.option.bid_price;
      const multiplier = leg.action === 'BUY' ? -1 : 1;
      return total + (price * leg.quantity * multiplier);
    }, 0);

    // Get strikes
    const strikes = legs.map(leg => leg.option.strike).sort((a, b) => a - b);

    // For credit spreads (net premium > 0)
    if (netPremium > 0) {
      const width = strikes[strikes.length - 1] - strikes[0];
      return Math.max(0, width - netPremium);
    }

    // For debit spreads (net premium < 0)
    return Math.abs(netPremium);
  }

  /**
   * Calculate maximum profit for a position
   * @param {Array} legs - Array of leg objects
   * @returns {number} - Maximum profit
   */
  static calculateMaxProfit(legs) {
    // Calculate net premium
    const netPremium = legs.reduce((total, leg) => {
      const price = leg.option.mark_price || leg.option.bid_price;
      const multiplier = leg.action === 'BUY' ? -1 : 1;
      return total + (price * leg.quantity * multiplier);
    }, 0);

    // Get strikes
    const strikes = legs.map(leg => leg.option.strike).sort((a, b) => a - b);

    // For credit spreads (net premium > 0)
    if (netPremium > 0) {
      return netPremium;
    }

    // For debit spreads (net premium < 0)
    const width = strikes[strikes.length - 1] - strikes[0];
    return Math.max(0, width - Math.abs(netPremium));
  }

  /**
   * Calculate break-even points
   * @param {Array} legs - Array of leg objects
   * @param {number} spot - Current spot price
   * @returns {Object} - Break-even analysis
   */
  static calculateBreakEven(legs, spot) {
    const netPremium = legs.reduce((total, leg) => {
      const price = leg.option.mark_price || leg.option.bid_price;
      const multiplier = leg.action === 'BUY' ? -1 : 1;
      return total + (price * leg.quantity * multiplier);
    }, 0);

    const strikes = legs.map(leg => leg.option.strike).sort((a, b) => a - b);
    const minStrike = strikes[0];
    const maxStrike = strikes[strikes.length - 1];

    // For iron condor / iron butterfly
    const lowerBreakEven = minStrike + Math.abs(netPremium);
    const upperBreakEven = maxStrike - Math.abs(netPremium);

    return {
      lower: lowerBreakEven,
      upper: upperBreakEven,
      range: upperBreakEven - lowerBreakEven,
      distanceFromSpot: {
        lower: spot - lowerBreakEven,
        upper: upperBreakEven - spot
      },
      percentFromSpot: {
        lower: ((spot - lowerBreakEven) / spot) * 100,
        upper: ((upperBreakEven - spot) / spot) * 100
      }
    };
  }

  /**
   * Calculate probability of profit (simplified)
   * @param {Object} breakEven - Break-even object
   * @param {number} spot - Current spot price
   * @param {number} iv - Implied volatility (decimal)
   * @param {number} dte - Days to expiration
   * @returns {number} - Probability of profit (0-1)
   */
  static calculateProbabilityOfProfit(breakEven, spot, iv, dte) {
    // Simplified calculation using normal distribution
    // Real implementation would use more sophisticated models

    const { lower, upper } = breakEven;
    const range = upper - lower;

    // Expected move (1 standard deviation)
    const expectedMove = spot * iv * Math.sqrt(dte / 365);

    // Probability that spot stays within range
    const zLower = (spot - lower) / expectedMove;
    const zUpper = (upper - spot) / expectedMove;

    // Simplified: assume normal distribution
    const probLower = this.normalCDF(zLower);
    const probUpper = this.normalCDF(zUpper);

    return probLower + probUpper - 1;
  }

  /**
   * Normal cumulative distribution function (simplified)
   */
  static normalCDF(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - prob : prob;
  }

  /**
   * Check if position should be closed (exit rules)
   * @param {Object} position - Current position
   * @param {Object} marketData - Current market data
   * @param {Object} exitRules - Exit rules configuration
   * @returns {Object} - Exit decision
   */
  static checkExit(position, marketData, exitRules = {}) {
    const defaults = {
      profitTarget: 0.5,      // Close at 50% of max profit
      stopLoss: 2.0,          // Stop at 2x max profit loss
      dteExit: 21,            // Close if DTE < 21
      deltaBreach: 0.25,      // Close if delta > 0.25
      gammaSpike: 0.002,      // Close if gamma > 0.002
      ivExpansion: 1.5        // Close if IV increases 50%
    };

    const rules = { ...defaults, ...exitRules };

    // Calculate current P&L
    const currentValue = this.calculateCurrentValue(position.legs, marketData.options);
    const pnl = currentValue - position.entryValue;
    const pnlPercent = (pnl / position.maxProfit) * 100;

    // Check exit conditions
    const reasons = [];

    // Profit target hit
    if (pnl >= position.maxProfit * rules.profitTarget) {
      reasons.push({
        type: 'PROFIT_TARGET',
        message: `Profit target hit: ${pnlPercent.toFixed(1)}% of max profit`,
        priority: 'HIGH'
      });
    }

    // Stop loss hit
    if (pnl <= -position.maxProfit * rules.stopLoss) {
      reasons.push({
        type: 'STOP_LOSS',
        message: `Stop loss hit: ${pnlPercent.toFixed(1)}% loss`,
        priority: 'CRITICAL'
      });
    }

    // DTE exit
    const dte = this.calculateDTE(position.legs[0].option.expiry);
    if (dte < rules.dteExit) {
      reasons.push({
        type: 'DTE_EXIT',
        message: `DTE below threshold: ${dte} < ${rules.dteExit}`,
        priority: 'MEDIUM'
      });
    }

    // Delta breach
    const currentGreeks = this.calculateCurrentGreeks(position.legs, marketData.options);
    if (Math.abs(currentGreeks.delta) > rules.deltaBreach) {
      reasons.push({
        type: 'DELTA_BREACH',
        message: `Delta exceeded limit: ${currentGreeks.delta.toFixed(3)}`,
        priority: 'HIGH'
      });
    }

    // Gamma spike
    if (Math.abs(currentGreeks.gamma) > rules.gammaSpike) {
      reasons.push({
        type: 'GAMMA_SPIKE',
        message: `Gamma spike detected: ${currentGreeks.gamma.toFixed(6)}`,
        priority: 'HIGH'
      });
    }

    // IV expansion
    const currentIV = this.calculateAverageIV(marketData.options);
    if (currentIV > position.entryIV * rules.ivExpansion) {
      reasons.push({
        type: 'IV_EXPANSION',
        message: `IV expanded: ${((currentIV / position.entryIV - 1) * 100).toFixed(1)}%`,
        priority: 'MEDIUM'
      });
    }

    // Determine if should exit
    const criticalReasons = reasons.filter(r => r.priority === 'CRITICAL');
    const highReasons = reasons.filter(r => r.priority === 'HIGH');

    const shouldExit = criticalReasons.length > 0 || highReasons.length >= 2;

    return {
      shouldExit,
      reasons,
      currentValue,
      pnl,
      pnlPercent,
      currentGreeks,
      dte
    };
  }

  /**
   * Calculate current value of position
   */
  static calculateCurrentValue(legs, currentOptions) {
    return legs.reduce((total, leg) => {
      const currentOption = currentOptions.find(opt =>
        opt.symbol === leg.option.symbol
      );

      if (!currentOption) return total;

      const price = currentOption.mark_price || currentOption.bid_price;
      const multiplier = leg.action === 'BUY' ? 1 : -1;

      return total + (price * leg.quantity * multiplier);
    }, 0);
  }

  /**
   * Calculate current Greeks of position
   */
  static calculateCurrentGreeks(legs, currentOptions) {
    return legs.reduce((total, leg) => {
      const currentOption = currentOptions.find(opt =>
        opt.symbol === leg.option.symbol
      );

      if (!currentOption) return total;

      const multiplier = leg.action === 'BUY' ? 1 : -1;
      const qty = leg.quantity * multiplier;

      return {
        delta: total.delta + (currentOption.delta * qty),
        gamma: total.gamma + (currentOption.gamma * qty),
        theta: total.theta + (currentOption.theta * qty),
        vega: total.vega + (currentOption.vega * qty)
      };
    }, { delta: 0, gamma: 0, theta: 0, vega: 0 });
  }

  /**
   * Calculate average IV
   */
  static calculateAverageIV(options) {
    if (options.length === 0) return 0;
    const totalIV = options.reduce((sum, opt) => sum + opt.impliedVolatility, 0);
    return totalIV / options.length;
  }

  /**
   * Calculate DTE
   */
  static calculateDTE(expiryTimestamp) {
    const now = Date.now();
    const diff = expiryTimestamp - now;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate portfolio risk metrics
   * @param {Array} positions - Array of open positions
   * @param {number} accountBalance - Total account balance
   * @returns {Object} - Portfolio risk metrics
   */
  static calculatePortfolioRisk(positions, accountBalance) {
    const totalRisk = positions.reduce((sum, pos) => sum + pos.maxLoss, 0);
    const totalExposure = positions.reduce((sum, pos) => sum + Math.abs(pos.greeks.delta), 0);

    const aggregateGreeks = positions.reduce((total, pos) => ({
      delta: total.delta + pos.greeks.delta,
      gamma: total.gamma + pos.greeks.gamma,
      theta: total.theta + pos.greeks.theta,
      vega: total.vega + pos.greeks.vega
    }), { delta: 0, gamma: 0, theta: 0, vega: 0 });

    return {
      totalRisk,
      riskPercent: (totalRisk / accountBalance) * 100,
      totalExposure,
      exposurePercent: (totalExposure / accountBalance) * 100,
      aggregateGreeks,
      positionCount: positions.length
    };
  }

  /**
   * Check if new position would exceed portfolio limits
   * @param {Object} newPosition - New position to add
   * @param {Array} existingPositions - Existing positions
   * @param {number} accountBalance - Total account balance
   * @param {Object} limits - Portfolio limits
   * @returns {Object} - Validation result
   */
  static validateNewPosition(newPosition, existingPositions, accountBalance, limits = {}) {
    const defaults = {
      maxPortfolioRisk: 20,
      maxPositions: 10,
      maxDeltaExposure: 1.0,
      maxCorrelation: 0.7
    };

    const lim = { ...defaults, ...limits };

    // Calculate current portfolio risk
    const currentRisk = this.calculatePortfolioRisk(existingPositions, accountBalance);

    // Calculate risk after adding new position
    const newTotalRisk = currentRisk.totalRisk + newPosition.maxLoss;
    const newRiskPercent = (newTotalRisk / accountBalance) * 100;

    const newTotalDelta = currentRisk.aggregateGreeks.delta + newPosition.greeks.delta;

    const checks = {
      withinRiskLimit: newRiskPercent <= lim.maxPortfolioRisk,
      withinPositionLimit: existingPositions.length < lim.maxPositions,
      withinDeltaLimit: Math.abs(newTotalDelta) <= lim.maxDeltaExposure
    };

    return {
      valid: Object.values(checks).every(v => v),
      checks,
      currentRisk,
      newRiskPercent,
      newTotalDelta
    };
  }
}

module.exports = RiskManager;
