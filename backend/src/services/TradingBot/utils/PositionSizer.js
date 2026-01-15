/**
 * Position Sizing Utility
 * Calculates optimal position size based on risk parameters
 */
class PositionSizer {
  /**
   * Calculate position size based on risk amount
   * @param {number} accountBalance - Total account balance
   * @param {number} riskPercent - Risk percentage per trade (e.g., 2 for 2%)
   * @param {number} maxLoss - Maximum loss per contract
   * @returns {number} - Number of contracts
   */
  static calculateByRisk(accountBalance, riskPercent, maxLoss) {
    if (maxLoss <= 0) return 0;

    const riskAmount = accountBalance * (riskPercent / 100);
    const contracts = Math.floor(riskAmount / maxLoss);

    return Math.max(1, contracts);
  }

  /**
   * Calculate position size based on Kelly Criterion
   * @param {number} accountBalance - Total account balance
   * @param {number} winRate - Historical win rate (0-1)
   * @param {number} avgWin - Average win amount
   * @param {number} avgLoss - Average loss amount
   * @param {number} maxLoss - Maximum loss per contract
   * @param {number} kellyFraction - Fraction of Kelly to use (default: 0.25 for quarter-Kelly)
   * @returns {number} - Number of contracts
   */
  static calculateByKelly(accountBalance, winRate, avgWin, avgLoss, maxLoss, kellyFraction = 0.25) {
    if (avgLoss <= 0 || maxLoss <= 0) return 1;

    // Kelly formula: f = (p * b - q) / b
    // where p = win rate, q = loss rate, b = win/loss ratio
    const lossRate = 1 - winRate;
    const winLossRatio = avgWin / avgLoss;

    const kellyPercent = (winRate * winLossRatio - lossRate) / winLossRatio;

    // Apply Kelly fraction for safety
    const adjustedKelly = Math.max(0, kellyPercent * kellyFraction);

    // Calculate contracts
    const riskAmount = accountBalance * adjustedKelly;
    const contracts = Math.floor(riskAmount / maxLoss);

    return Math.max(1, contracts);
  }

  /**
   * Calculate position size based on fixed fractional method
   * @param {number} accountBalance - Total account balance
   * @param {number} fraction - Fraction of account to risk (e.g., 0.02 for 2%)
   * @param {number} maxLoss - Maximum loss per contract
   * @returns {number} - Number of contracts
   */
  static calculateByFraction(accountBalance, fraction, maxLoss) {
    if (maxLoss <= 0) return 0;

    const riskAmount = accountBalance * fraction;
    const contracts = Math.floor(riskAmount / maxLoss);

    return Math.max(1, contracts);
  }

  /**
   * Calculate position size based on volatility
   * @param {number} accountBalance - Total account balance
   * @param {number} riskPercent - Risk percentage per trade
   * @param {number} maxLoss - Maximum loss per contract
   * @param {number} ivRank - IV Rank (0-100)
   * @returns {number} - Number of contracts (scaled by volatility)
   */
  static calculateByVolatility(accountBalance, riskPercent, maxLoss, ivRank) {
    // Base position size
    const baseContracts = this.calculateByRisk(accountBalance, riskPercent, maxLoss);

    // Scale by IV Rank
    // High IV (>70) = reduce size by 20%
    // Low IV (<30) = increase size by 20%
    let scaleFactor = 1.0;

    if (ivRank > 70) {
      scaleFactor = 0.8;  // Reduce size in high volatility
    } else if (ivRank < 30) {
      scaleFactor = 1.2;  // Increase size in low volatility
    }

    const scaledContracts = Math.floor(baseContracts * scaleFactor);

    return Math.max(1, scaledContracts);
  }

  /**
   * Calculate maximum position size based on portfolio limits
   * @param {number} accountBalance - Total account balance
   * @param {number} maxPortfolioRisk - Maximum portfolio risk percentage
   * @param {number} currentRisk - Current portfolio risk amount
   * @param {number} maxLoss - Maximum loss per contract
   * @returns {number} - Maximum contracts allowed
   */
  static calculateMaxPosition(accountBalance, maxPortfolioRisk, currentRisk, maxLoss) {
    if (maxLoss <= 0) return 0;

    const maxRiskAmount = accountBalance * (maxPortfolioRisk / 100);
    const availableRisk = maxRiskAmount - currentRisk;

    if (availableRisk <= 0) return 0;

    const maxContracts = Math.floor(availableRisk / maxLoss);

    return Math.max(0, maxContracts);
  }

  /**
   * Calculate position size with multiple constraints
   * @param {Object} params - Position sizing parameters
   * @returns {Object} - Position size result with details
   */
  static calculate(params) {
    const {
      accountBalance,
      riskPercent = 2,
      maxLoss,
      ivRank = 50,
      maxPortfolioRisk = 10,
      currentRisk = 0,
      minContracts = 1,
      maxContracts = 10,
      method = 'risk'  // 'risk', 'kelly', 'fraction', 'volatility'
    } = params;

    // Calculate base size by method
    let baseSize;

    switch (method) {
      case 'kelly':
        const { winRate, avgWin, avgLoss, kellyFraction } = params;
        baseSize = this.calculateByKelly(
          accountBalance,
          winRate,
          avgWin,
          avgLoss,
          maxLoss,
          kellyFraction
        );
        break;

      case 'fraction':
        const { fraction } = params;
        baseSize = this.calculateByFraction(accountBalance, fraction, maxLoss);
        break;

      case 'volatility':
        baseSize = this.calculateByVolatility(
          accountBalance,
          riskPercent,
          maxLoss,
          ivRank
        );
        break;

      case 'risk':
      default:
        baseSize = this.calculateByRisk(accountBalance, riskPercent, maxLoss);
        break;
    }

    // Apply portfolio limit
    const maxAllowed = this.calculateMaxPosition(
      accountBalance,
      maxPortfolioRisk,
      currentRisk,
      maxLoss
    );

    // Apply min/max constraints
    let finalSize = Math.min(baseSize, maxAllowed, maxContracts);
    finalSize = Math.max(finalSize, minContracts);

    // Calculate risk metrics
    const totalRisk = finalSize * maxLoss;
    const riskPercentActual = (totalRisk / accountBalance) * 100;
    const portfolioRiskAfter = ((currentRisk + totalRisk) / accountBalance) * 100;

    return {
      contracts: finalSize,
      totalRisk,
      riskPercent: riskPercentActual,
      portfolioRiskAfter,
      constraints: {
        baseSize,
        maxAllowed,
        minContracts,
        maxContracts
      },
      method
    };
  }

  /**
   * Validate position size
   * @param {number} contracts - Number of contracts
   * @param {number} maxLoss - Maximum loss per contract
   * @param {number} accountBalance - Total account balance
   * @param {Object} limits - Risk limits
   * @returns {Object} - Validation result
   */
  static validate(contracts, maxLoss, accountBalance, limits = {}) {
    const defaults = {
      maxRiskPercent: 5,
      maxPortfolioRisk: 20,
      minContracts: 1,
      maxContracts: 100
    };

    const lim = { ...defaults, ...limits };

    const totalRisk = contracts * maxLoss;
    const riskPercent = (totalRisk / accountBalance) * 100;

    const checks = {
      withinMinMax: contracts >= lim.minContracts && contracts <= lim.maxContracts,
      withinRiskLimit: riskPercent <= lim.maxRiskPercent,
      withinPortfolioLimit: riskPercent <= lim.maxPortfolioRisk,
      hasBalance: totalRisk <= accountBalance
    };

    return {
      valid: Object.values(checks).every(v => v),
      checks,
      contracts,
      totalRisk,
      riskPercent
    };
  }

  /**
   * Calculate scaling for adjustments
   * @param {number} currentContracts - Current position size
   * @param {number} targetContracts - Target position size
   * @param {number} maxAdjustmentPercent - Max adjustment as percentage of current
   * @returns {Object} - Adjustment details
   */
  static calculateAdjustment(currentContracts, targetContracts, maxAdjustmentPercent = 50) {
    const difference = targetContracts - currentContracts;
    const maxAdjustment = Math.floor(currentContracts * (maxAdjustmentPercent / 100));

    let adjustment = difference;

    if (Math.abs(difference) > maxAdjustment) {
      adjustment = difference > 0 ? maxAdjustment : -maxAdjustment;
    }

    const newSize = currentContracts + adjustment;

    return {
      current: currentContracts,
      target: targetContracts,
      adjustment,
      new: newSize,
      percentChange: (adjustment / currentContracts) * 100
    };
  }

  /**
   * Calculate optimal size for multi-leg strategies
   * @param {Array} legs - Array of leg objects
   * @param {number} accountBalance - Total account balance
   * @param {number} riskPercent - Risk percentage per trade
   * @returns {number} - Number of contracts for the entire strategy
   */
  static calculateForStrategy(legs, accountBalance, riskPercent) {
    // Calculate max loss for the entire strategy
    const maxLoss = this.calculateStrategyMaxLoss(legs);

    if (maxLoss <= 0) return 1;

    return this.calculateByRisk(accountBalance, riskPercent, maxLoss);
  }

  /**
   * Calculate maximum loss for a multi-leg strategy
   * @param {Array} legs - Array of leg objects
   * @returns {number} - Maximum loss
   */
  static calculateStrategyMaxLoss(legs) {
    // For spreads, max loss is typically the width minus premium received
    const strikes = legs.map(leg => leg.option.strike).sort((a, b) => a - b);
    const premiums = legs.map(leg => {
      const price = leg.option.mark_price || leg.option.bid_price;
      const multiplier = leg.action === 'BUY' ? -1 : 1;
      return price * leg.quantity * multiplier;
    });

    const netPremium = premiums.reduce((sum, p) => sum + p, 0);

    // For credit spreads
    if (netPremium > 0) {
      const width = strikes[strikes.length - 1] - strikes[0];
      return Math.max(0, width - netPremium);
    }

    // For debit spreads
    return Math.abs(netPremium);
  }
}

module.exports = PositionSizer;
