const axios = require('axios');

/**
 * Position Calculator Service
 * 
 * Calculates P&L and Greeks for multi-leg options positions
 * Uses real market data from /api/options (Binance)
 */
class PositionCalculatorService {
  constructor() {
    this.optionsCache = null;
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 30000; // 30 seconds
  }

  /**
   * Fetch current options data from internal API
   */
  async fetchOptionsData() {
    const now = Date.now();
    
    // Return cached data if still fresh
    if (this.optionsCache && this.cacheTimestamp && (now - this.cacheTimestamp < this.CACHE_DURATION)) {
      return this.optionsCache;
    }

    try {
      const response = await axios.get('http://localhost:3300/api/options');
      
      if (response.data && response.data.success) {
        this.optionsCache = response.data.data;
        this.cacheTimestamp = now;
        return this.optionsCache;
      }
      
      throw new Error('Failed to fetch options data');
    } catch (error) {
      console.error('Error fetching options data:', error.message);
      throw error;
    }
  }

  /**
   * Find option by symbol
   */
  async findOptionBySymbol(symbol) {
    const options = await this.fetchOptionsData();
    return options.find(opt => opt.symbol === symbol);
  }

  /**
   * Calculate intrinsic value of an option
   */
  calculateIntrinsicValue(strike, spotPrice, side, action) {
    let intrinsic = 0;
    
    if (side === 'CALL') {
      intrinsic = Math.max(0, spotPrice - strike);
    } else if (side === 'PUT') {
      intrinsic = Math.max(0, strike - spotPrice);
    }
    
    // If selling, intrinsic value is negative for us
    return action === 'sell' ? -intrinsic : intrinsic;
  }

  /**
   * Estimate option price at different spot prices
   * Simplified model: intrinsic + (current extrinsic * decay factor)
   */
  estimateOptionPrice(option, newSpotPrice, daysToExpiry) {
    const { strike, side, markPrice } = option;
    const currentSpot = parseFloat(option.underlying === 'BTC' ? 100000 : 3500); // Approximate current spot
    
    // Calculate current intrinsic and extrinsic
    const currentIntrinsic = side === 'CALL' 
      ? Math.max(0, currentSpot - strike)
      : Math.max(0, strike - currentSpot);
    
    const currentExtrinsic = Math.max(0, markPrice - currentIntrinsic);
    
    // Calculate new intrinsic
    const newIntrinsic = side === 'CALL'
      ? Math.max(0, newSpotPrice - strike)
      : Math.max(0, strike - newSpotPrice);
    
    // Time decay factor (simplified)
    const originalDTE = (option.expiryDate - Date.now()) / (1000 * 60 * 60 * 24);
    const timeDecayFactor = daysToExpiry / originalDTE;
    
    // Estimate new extrinsic (decays with time)
    const newExtrinsic = currentExtrinsic * timeDecayFactor;
    
    return newIntrinsic + newExtrinsic;
  }

  /**
   * Calculate P&L for a single leg at a specific spot price
   */
  calculateLegPnL(leg, spotPrice, daysToExpiry = null) {
    const { entryPrice, quantity, action } = leg;
    
    // If daysToExpiry not specified, use current time
    const dte = daysToExpiry !== null ? daysToExpiry : 
      (leg.expiryDate - Date.now()) / (1000 * 60 * 60 * 24);
    
    // Estimate option price at new spot
    const estimatedPrice = this.estimateOptionPrice(leg, spotPrice, dte);
    
    // Calculate P&L
    let pnl = 0;
    if (action === 'buy') {
      pnl = (estimatedPrice - entryPrice) * quantity;
    } else if (action === 'sell') {
      pnl = (entryPrice - estimatedPrice) * quantity;
    }
    
    return pnl;
  }

  /**
   * Calculate total position P&L across multiple spot prices
   */
  async calculatePositionPnL(legs, spotPrices, daysToExpiry = null) {
    const pnlCurve = [];
    
    for (const spotPrice of spotPrices) {
      let totalPnL = 0;
      
      for (const leg of legs) {
        const legPnL = this.calculateLegPnL(leg, spotPrice, daysToExpiry);
        totalPnL += legPnL;
      }
      
      pnlCurve.push({
        price: spotPrice,
        pnl: totalPnL
      });
    }
    
    return pnlCurve;
  }

  /**
   * Calculate total Greeks for a position
   */
  calculatePositionGreeks(legs) {
    let totalDelta = 0;
    let totalGamma = 0;
    let totalTheta = 0;
    let totalVega = 0;
    
    for (const leg of legs) {
      const { delta, gamma, theta, vega, quantity, action } = leg;
      
      // Multiply by quantity and adjust sign based on action
      const sign = action === 'buy' ? 1 : -1;
      
      totalDelta += (delta || 0) * quantity * sign;
      totalGamma += (gamma || 0) * quantity * sign;
      totalTheta += (theta || 0) * quantity * sign;
      totalVega += (vega || 0) * quantity * sign;
    }
    
    return {
      delta: totalDelta,
      gamma: totalGamma,
      theta: totalTheta,
      vega: totalVega
    };
  }

  /**
   * Calculate total cost of position
   */
  calculateTotalCost(legs) {
    let totalCost = 0;
    
    for (const leg of legs) {
      const { entryPrice, quantity, action } = leg;
      
      if (action === 'buy') {
        totalCost -= entryPrice * quantity; // Buying costs money (negative)
      } else if (action === 'sell') {
        totalCost += entryPrice * quantity; // Selling gives credit (positive)
      }
    }
    
    return totalCost;
  }

  /**
   * Find breakeven points for a position
   */
  async findBreakevens(legs, spotRange) {
    const pnlCurve = await this.calculatePositionPnL(legs, spotRange);
    const breakevens = [];
    
    for (let i = 1; i < pnlCurve.length; i++) {
      const prev = pnlCurve[i - 1];
      const curr = pnlCurve[i];
      
      // Check if P&L crosses zero
      if ((prev.pnl < 0 && curr.pnl >= 0) || (prev.pnl > 0 && curr.pnl <= 0)) {
        // Linear interpolation to find exact breakeven
        const ratio = Math.abs(prev.pnl) / (Math.abs(prev.pnl) + Math.abs(curr.pnl));
        const breakeven = prev.price + (curr.price - prev.price) * ratio;
        breakevens.push(breakeven);
      }
    }
    
    return breakevens;
  }

  /**
   * Calculate max profit and max loss for a position
   */
  async calculateMaxProfitLoss(legs, spotRange) {
    const pnlCurve = await this.calculatePositionPnL(legs, spotRange);
    
    let maxProfit = -Infinity;
    let maxLoss = Infinity;
    
    for (const point of pnlCurve) {
      maxProfit = Math.max(maxProfit, point.pnl);
      maxLoss = Math.min(maxLoss, point.pnl);
    }
    
    // Check if max profit is unlimited (e.g., long call)
    const hasLongCall = legs.some(leg => leg.side === 'CALL' && leg.action === 'buy');
    const hasLongPut = legs.some(leg => leg.side === 'PUT' && leg.action === 'buy');
    
    // Simplified check: if we have uncovered long options, profit is unlimited
    const isUnlimitedProfit = (hasLongCall || hasLongPut) && legs.length === 1;
    
    return {
      maxProfit: isUnlimitedProfit ? Infinity : maxProfit,
      maxLoss: maxLoss
    };
  }

  /**
   * Main calculation function - returns complete position analysis
   */
  async calculatePosition(legs, config = {}) {
    const {
      spotPrices = this.generateSpotRange(legs),
      daysToExpiry = null
    } = config;
    
    // Calculate P&L curve
    const pnlCurve = await this.calculatePositionPnL(legs, spotPrices, daysToExpiry);
    
    // Calculate Greeks
    const greeks = this.calculatePositionGreeks(legs);
    
    // Calculate total cost
    const totalCost = this.calculateTotalCost(legs);
    
    // Find breakevens
    const breakevens = await this.findBreakevens(legs, spotPrices);
    
    // Calculate max profit/loss
    const { maxProfit, maxLoss } = await this.calculateMaxProfitLoss(legs, spotPrices);
    
    return {
      pnlCurve,
      greeks,
      totalCost,
      breakevens,
      maxProfit,
      maxLoss
    };
  }

  /**
   * Generate spot price range for P&L calculation
   */
  generateSpotRange(legs) {
    // Find min and max strikes
    const strikes = legs.map(leg => leg.strike);
    const minStrike = Math.min(...strikes);
    const maxStrike = Math.max(...strikes);
    
    // Generate range ±20% around strikes
    const center = (minStrike + maxStrike) / 2;
    const range = maxStrike - minStrike;
    const padding = Math.max(range * 0.5, center * 0.2);
    
    const start = Math.floor(center - padding);
    const end = Math.ceil(center + padding);
    const step = (end - start) / 100; // 100 points
    
    const spotPrices = [];
    for (let price = start; price <= end; price += step) {
      spotPrices.push(Math.round(price));
    }
    
    return spotPrices;
  }
}

module.exports = new PositionCalculatorService();
