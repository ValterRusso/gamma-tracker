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
   * Get current spot price for an underlying
   * Estimates from ATM options or uses reasonable default
   */
  async getCurrentSpotPrice(underlying) {
    try {
      const options = await this.fetchOptionsData();
      
      // Filter options for this underlying
      const underlyingOptions = options.filter(opt => opt.underlying === underlying);
      
      if (underlyingOptions.length === 0) {
        // Fallback defaults
        return underlying === 'BTC' ? 102000 : 3500;
      }
      
      // Find ATM options (closest to spot)
      // ATM options have delta closest to 0.5 for calls
      const atmCall = underlyingOptions
        .filter(opt => opt.side === 'CALL' && opt.delta)
        .sort((a, b) => Math.abs(a.delta - 0.5) - Math.abs(b.delta - 0.5))[0];
      
      if (atmCall) {
        // Spot is approximately the strike of ATM call
        return atmCall.strike;
      }
      
      // Fallback: use average of all strikes
      const avgStrike = underlyingOptions.reduce((sum, opt) => sum + opt.strike, 0) / underlyingOptions.length;
      return avgStrike;
    } catch (error) {
      console.error('Error getting spot price:', error);
      return underlying === 'BTC' ? 102000 : 3500;
    }
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
  async estimateOptionPrice(option, newSpotPrice, daysToExpiry, currentSpot) {
    const { strike, side, markPrice, entryPrice, underlying } = option;
    
    // Use entryPrice as fallback if markPrice is missing
    const optionPrice = markPrice || entryPrice || 0;
    
    // Use provided currentSpot or fetch it
    if (!currentSpot) {
      currentSpot = await this.getCurrentSpotPrice(underlying || 'BTC');
    }
    
    // Calculate current intrinsic and extrinsic
    const currentIntrinsic = side === 'CALL' 
      ? Math.max(0, currentSpot - strike)
      : Math.max(0, strike - currentSpot);
    
    const currentExtrinsic = Math.max(0, optionPrice - currentIntrinsic);
    
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
  async calculateLegPnL(leg, spotPrice, daysToExpiry = null, currentSpot = null) {
    const { entryPrice, quantity, action } = leg;
    
    // If daysToExpiry not specified, use current time
    const dte = daysToExpiry !== null ? daysToExpiry : 
      (leg.expiryDate - Date.now()) / (1000 * 60 * 60 * 24);
    
    // Estimate option price at new spot
    const estimatedPrice = await this.estimateOptionPrice(leg, spotPrice, dte, currentSpot);
    
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
    
    // Get current spot price once (all legs should have same underlying)
    const underlying = legs[0]?.underlying || 'BTC';
    const currentSpot = await this.getCurrentSpotPrice(underlying);
    
    for (const spotPrice of spotPrices) {
      let totalPnL = 0;
      
      for (const leg of legs) {
        const legPnL = await this.calculateLegPnL(leg, spotPrice, daysToExpiry, currentSpot);
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
