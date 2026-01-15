/**
 * Strike Selection Utility
 * Finds optimal strikes based on delta, liquidity, and other criteria
 */
class StrikeSelector {
  /**
   * Find option by target delta with tolerance
   * @param {Array} options - Array of option objects
   * @param {number} targetDelta - Target delta value
   * @param {number} tolerance - Delta tolerance (default: 0.02)
   * @returns {Object|null} - Best matching option
   */
  static findByDelta(options, targetDelta, tolerance = 0.02) {
    if (!options || options.length === 0) return null;

    // Filter options within delta range with liquidity
    const candidates = options.filter(opt => {
      const deltaMatch = Math.abs(opt.delta - targetDelta) <= tolerance;
      const hasLiquidity = opt.volume > 0 || opt.open_interest > 0;
      const hasBid = opt.bid_price > 0;
      
      return deltaMatch && hasLiquidity && hasBid;
    });

    if (candidates.length === 0) return null;

    // Sort by closest delta match, then by highest volume
    return candidates.sort((a, b) => {
      const deltaDiffA = Math.abs(a.delta - targetDelta);
      const deltaDiffB = Math.abs(b.delta - targetDelta);
      
      if (Math.abs(deltaDiffA - deltaDiffB) < 0.001) {
        // If deltas are very close, prefer higher volume
        return b.volume - a.volume;
      }
      
      return deltaDiffA - deltaDiffB;
    })[0];
  }

  /**
   * Find option by exact strike price
   * @param {Array} options - Array of option objects
   * @param {number} targetStrike - Target strike price
   * @returns {Object|null} - Option at that strike
   */
  static findByStrike(options, targetStrike) {
    if (!options || options.length === 0) return null;

    const candidates = options.filter(opt => 
      opt.strike === targetStrike &&
      opt.bid_price > 0
    );

    if (candidates.length === 0) return null;

    // Sort by highest volume
    return candidates.sort((a, b) => b.volume - a.volume)[0];
  }

  /**
   * Find ATM (At-The-Money) option
   * @param {Array} options - Array of option objects
   * @param {number} spot - Current spot price
   * @returns {Object|null} - ATM option
   */
  static findATM(options, spot) {
    if (!options || options.length === 0) return null;

    return options
      .filter(opt => opt.bid_price > 0)
      .sort((a, b) => {
        const distA = Math.abs(a.strike - spot);
        const distB = Math.abs(b.strike - spot);
        
        if (Math.abs(distA - distB) < 100) {
          // If strikes are very close to spot, prefer higher volume
          return b.volume - a.volume;
        }
        
        return distA - distB;
      })[0];
  }

  /**
   * Find option by strike distance from spot
   * @param {Array} options - Array of option objects
   * @param {number} spot - Current spot price
   * @param {number} percentDistance - Percentage distance from spot (e.g., 0.05 for 5%)
   * @param {string} direction - 'above' or 'below'
   * @returns {Object|null} - Option at target distance
   */
  static findByDistance(options, spot, percentDistance, direction = 'above') {
    if (!options || options.length === 0) return null;

    const targetStrike = direction === 'above' 
      ? spot * (1 + percentDistance)
      : spot * (1 - percentDistance);

    return this.findByStrike(options, this.roundToNearestStrike(targetStrike));
  }

  /**
   * Find multiple strikes by delta range
   * @param {Array} options - Array of option objects
   * @param {number} minDelta - Minimum delta
   * @param {number} maxDelta - Maximum delta
   * @param {number} limit - Maximum number of results
   * @returns {Array} - Array of options
   */
  static findByDeltaRange(options, minDelta, maxDelta, limit = 10) {
    if (!options || options.length === 0) return [];

    return options
      .filter(opt => 
        opt.delta >= minDelta &&
        opt.delta <= maxDelta &&
        opt.volume > 0 &&
        opt.bid_price > 0
      )
      .sort((a, b) => b.volume - a.volume)
      .slice(0, limit);
  }

  /**
   * Find wing (long option) for spread
   * @param {Array} options - Array of option objects
   * @param {number} shortStrike - Short strike price
   * @param {number} wingWidth - Distance from short strike
   * @param {string} direction - 'above' or 'below'
   * @returns {Object|null} - Wing option
   */
  static findWing(options, shortStrike, wingWidth, direction = 'above') {
    if (!options || options.length === 0) return null;

    const targetStrike = direction === 'above'
      ? shortStrike + wingWidth
      : shortStrike - wingWidth;

    return this.findByStrike(options, targetStrike);
  }

  /**
   * Round price to nearest strike increment
   * @param {number} price - Price to round
   * @param {number} increment - Strike increment (default: 1000 for BTC)
   * @returns {number} - Rounded strike
   */
  static roundToNearestStrike(price, increment = 1000) {
    return Math.round(price / increment) * increment;
  }

  /**
   * Check if option has sufficient liquidity
   * @param {Object} option - Option object
   * @param {Object} minRequirements - Minimum liquidity requirements
   * @returns {boolean} - True if liquid enough
   */
  static hasLiquidity(option, minRequirements = {}) {
    const defaults = {
      minVolume: 0.1,
      minOI: 1,
      minBid: 0.0001,
      maxSpread: 0.1  // Max 10% spread
    };

    const reqs = { ...defaults, ...minRequirements };

    const hasVolume = option.volume >= reqs.minVolume;
    const hasOI = option.open_interest >= reqs.minOI;
    const hasBid = option.bid_price >= reqs.minBid;
    
    const spread = option.ask_price > 0 
      ? (option.ask_price - option.bid_price) / option.bid_price
      : 1;
    const spreadOk = spread <= reqs.maxSpread;

    return hasVolume && hasOI && hasBid && spreadOk;
  }

  /**
   * Filter options by DTE range
   * @param {Array} options - Array of option objects
   * @param {number} minDTE - Minimum days to expiration
   * @param {number} maxDTE - Maximum days to expiration
   * @returns {Array} - Filtered options
   */
  static filterByDTE(options, minDTE, maxDTE) {
    if (!options || options.length === 0) return [];

    return options.filter(opt => {
      const dte = this.calculateDTE(opt.expiry);
      return dte >= minDTE && dte <= maxDTE;
    });
  }

  /**
   * Calculate days to expiration
   * @param {number} expiryTimestamp - Expiry timestamp in milliseconds
   * @returns {number} - Days to expiration
   */
  static calculateDTE(expiryTimestamp) {
    const now = Date.now();
    const diff = expiryTimestamp - now;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Get best expiration date for strategy
   * @param {Array} options - Array of option objects
   * @param {number} targetDTE - Target days to expiration
   * @param {number} tolerance - DTE tolerance in days
   * @returns {number|null} - Best expiry timestamp
   */
  static getBestExpiry(options, targetDTE, tolerance = 7) {
    if (!options || options.length === 0) return null;

    // Group options by expiry
    const expiryMap = {};
    options.forEach(opt => {
      const dte = this.calculateDTE(opt.expiry);
      if (Math.abs(dte - targetDTE) <= tolerance) {
        if (!expiryMap[opt.expiry]) {
          expiryMap[opt.expiry] = { expiry: opt.expiry, dte, count: 0, volume: 0 };
        }
        expiryMap[opt.expiry].count++;
        expiryMap[opt.expiry].volume += opt.volume;
      }
    });

    // Find expiry with most options and volume
    const expiries = Object.values(expiryMap);
    if (expiries.length === 0) return null;

    return expiries.sort((a, b) => {
      // Prefer closer to target DTE
      const dteDiffA = Math.abs(a.dte - targetDTE);
      const dteDiffB = Math.abs(b.dte - targetDTE);
      
      if (Math.abs(dteDiffA - dteDiffB) <= 3) {
        // If DTE is similar, prefer higher volume
        return b.volume - a.volume;
      }
      
      return dteDiffA - dteDiffB;
    })[0].expiry;
  }
}

module.exports = StrikeSelector;
