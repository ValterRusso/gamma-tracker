/**
 * Greek Aggregation Utility
 * Sums Greeks across multiple option legs
 */
class GreekAggregator {
  /**
   * Sum Greeks from multiple legs
   * @param {Array} legs - Array of leg objects: { action: 'BUY'|'SELL', option: {...}, quantity: number }
   * @returns {Object} - Aggregated Greeks
   */
  static sum(legs) {
    if (!legs || legs.length === 0) {
      return { delta: 0, gamma: 0, theta: 0, vega: 0 };
    }

    return legs.reduce((total, leg) => {
      // Multiplier: BUY = +1, SELL = -1
      const multiplier = leg.action === 'BUY' ? 1 : -1;
      const qty = leg.quantity * multiplier;

      return {
        delta: total.delta + (leg.option.delta * qty),
        gamma: total.gamma + (leg.option.gamma * qty),
        theta: total.theta + (leg.option.theta * qty),
        vega: total.vega + (leg.option.vega * qty)
      };
    }, { delta: 0, gamma: 0, theta: 0, vega: 0 });
  }

  /**
   * Calculate position Greeks with scaling
   * @param {Array} legs - Array of leg objects
   * @param {number} contracts - Number of contracts (default: 1)
   * @returns {Object} - Scaled Greeks
   */
  static calculatePosition(legs, contracts = 1) {
    const baseGreeks = this.sum(legs);

    return {
      delta: baseGreeks.delta * contracts,
      gamma: baseGreeks.gamma * contracts,
      theta: baseGreeks.theta * contracts,
      vega: baseGreeks.vega * contracts
    };
  }

  /**
   * Check if position is delta-neutral
   * @param {Object} greeks - Greeks object
   * @param {number} threshold - Delta threshold (default: 0.1)
   * @returns {boolean} - True if delta-neutral
   */
  static isDeltaNeutral(greeks, threshold = 0.1) {
    return Math.abs(greeks.delta) <= threshold;
  }

  /**
   * Check if position is positive theta
   * @param {Object} greeks - Greeks object
   * @returns {boolean} - True if positive theta
   */
  static isPositiveTheta(greeks) {
    return greeks.theta > 0;
  }

  /**
   * Check if position is negative gamma
   * @param {Object} greeks - Greeks object
   * @returns {boolean} - True if negative gamma
   */
  static isNegativeGamma(greeks) {
    return greeks.gamma < 0;
  }

  /**
   * Calculate Greek exposure as percentage of underlying
   * @param {Object} greeks - Greeks object
   * @param {number} spot - Current spot price
   * @param {number} contracts - Number of contracts
   * @returns {Object} - Greek exposure percentages
   */
  static calculateExposure(greeks, spot, contracts = 1) {
    // Delta exposure: how many BTC equivalent
    const deltaExposure = greeks.delta * contracts;

    // Gamma exposure: delta change per 1% move
    const gammaExposure = greeks.gamma * contracts * (spot * 0.01);

    // Theta exposure: daily P&L
    const thetaExposure = greeks.theta * contracts;

    // Vega exposure: P&L per 1% IV change
    const vegaExposure = greeks.vega * contracts * 0.01;

    return {
      delta: deltaExposure,
      gamma: gammaExposure,
      theta: thetaExposure,
      vega: vegaExposure,
      spot
    };
  }

  /**
   * Validate Greeks against limits
   * @param {Object} greeks - Greeks object
   * @param {Object} limits - Greek limits
   * @returns {Object} - Validation result
   */
  static validate(greeks, limits = {}) {
    const defaults = {
      maxDelta: 0.25,
      maxGamma: 0.001,
      minTheta: -100,
      maxVega: 500
    };

    const lim = { ...defaults, ...limits };

    const checks = {
      deltaOk: Math.abs(greeks.delta) <= lim.maxDelta,
      gammaOk: Math.abs(greeks.gamma) <= lim.maxGamma,
      thetaOk: greeks.theta >= lim.minTheta,
      vegaOk: Math.abs(greeks.vega) <= lim.maxVega
    };

    return {
      valid: Object.values(checks).every(v => v),
      checks,
      greeks
    };
  }

  /**
   * Calculate break-even points for a position
   * @param {Array} legs - Array of leg objects
   * @param {number} spot - Current spot price
   * @returns {Object} - Break-even analysis
   */
  static calculateBreakEven(legs, spot) {
    // Calculate net credit/debit
    const netPremium = legs.reduce((total, leg) => {
      const price = leg.option.mark_price || leg.option.bid_price;
      const multiplier = leg.action === 'BUY' ? -1 : 1;
      return total + (price * leg.quantity * multiplier);
    }, 0);

    // Find strikes
    const strikes = legs.map(leg => leg.option.strike).sort((a, b) => a - b);
    const minStrike = strikes[0];
    const maxStrike = strikes[strikes.length - 1];

    return {
      netPremium,
      isCredit: netPremium > 0,
      minStrike,
      maxStrike,
      spot
    };
  }

  /**
   * Estimate P&L for a given spot move
   * @param {Object} greeks - Greeks object
   * @param {number} spotMove - Spot price move (dollars)
   * @param {number} timeDecay - Days passed
   * @param {number} ivChange - IV change (percentage points)
   * @returns {number} - Estimated P&L
   */
  static estimatePnL(greeks, spotMove = 0, timeDecay = 0, ivChange = 0) {
    // Delta P&L
    const deltaPnL = greeks.delta * spotMove;

    // Gamma P&L (second-order effect)
    const gammaPnL = 0.5 * greeks.gamma * spotMove * spotMove;

    // Theta P&L
    const thetaPnL = greeks.theta * timeDecay;

    // Vega P&L
    const vegaPnL = greeks.vega * ivChange;

    return deltaPnL + gammaPnL + thetaPnL + vegaPnL;
  }

  /**
   * Calculate Greeks for adjustment scenarios
   * @param {Array} currentLegs - Current position legs
   * @param {Array} adjustmentLegs - Adjustment legs to add
   * @returns {Object} - Before/after Greeks comparison
   */
  static simulateAdjustment(currentLegs, adjustmentLegs) {
    const currentGreeks = this.sum(currentLegs);
    const adjustmentGreeks = this.sum(adjustmentLegs);
    const newGreeks = {
      delta: currentGreeks.delta + adjustmentGreeks.delta,
      gamma: currentGreeks.gamma + adjustmentGreeks.gamma,
      theta: currentGreeks.theta + adjustmentGreeks.theta,
      vega: currentGreeks.vega + adjustmentGreeks.vega
    };

    return {
      current: currentGreeks,
      adjustment: adjustmentGreeks,
      new: newGreeks,
      changes: {
        delta: newGreeks.delta - currentGreeks.delta,
        gamma: newGreeks.gamma - currentGreeks.gamma,
        theta: newGreeks.theta - currentGreeks.theta,
        vega: newGreeks.vega - currentGreeks.vega
      }
    };
  }

  /**
   * Format Greeks for display
   * @param {Object} greeks - Greeks object
   * @param {number} decimals - Decimal places
   * @returns {Object} - Formatted Greeks
   */
  static format(greeks, decimals = 4) {
    return {
      delta: greeks.delta.toFixed(decimals),
      gamma: greeks.gamma.toFixed(decimals + 4),
      theta: greeks.theta.toFixed(2),
      vega: greeks.vega.toFixed(2)
    };
  }

  /**
   * Get Greek risk rating
   * @param {Object} greeks - Greeks object
   * @returns {Object} - Risk ratings
   */
  static getRiskRating(greeks) {
    const ratings = {
      delta: this.getDeltaRisk(greeks.delta),
      gamma: this.getGammaRisk(greeks.gamma),
      theta: this.getThetaRisk(greeks.theta),
      vega: this.getVegaRisk(greeks.vega)
    };

    // Overall risk: highest individual risk
    const riskLevels = { LOW: 1, MEDIUM: 2, HIGH: 3 };
    const maxRisk = Math.max(...Object.values(ratings).map(r => riskLevels[r]));
    ratings.overall = Object.keys(riskLevels).find(k => riskLevels[k] === maxRisk);

    return ratings;
  }

  static getDeltaRisk(delta) {
    const abs = Math.abs(delta);
    if (abs <= 0.1) return 'LOW';
    if (abs <= 0.3) return 'MEDIUM';
    return 'HIGH';
  }

  static getGammaRisk(gamma) {
    const abs = Math.abs(gamma);
    if (abs <= 0.0001) return 'LOW';
    if (abs <= 0.0005) return 'MEDIUM';
    return 'HIGH';
  }

  static getThetaRisk(theta) {
    if (theta >= 0) return 'LOW';  // Positive theta is good
    if (theta >= -50) return 'MEDIUM';
    return 'HIGH';
  }

  static getVegaRisk(vega) {
    const abs = Math.abs(vega);
    if (abs <= 100) return 'LOW';
    if (abs <= 300) return 'MEDIUM';
    return 'HIGH';
  }
}

module.exports = GreekAggregator;
