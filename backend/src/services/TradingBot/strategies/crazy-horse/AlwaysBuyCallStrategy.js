// /backend/src/services/TradingBot/strategies/AlwaysBuyCallStrategy.js

const BaseStrategy = require('../BaseStrategy');

/**
 * Always Buy Call Strategy (TEST ONLY)
 * Buys the first available ATM call option on every iteration
 * No filters, no conditions, just BUY
 * 
 * WARNING: FOR TESTING ONLY - Will lose money in production!
 */
class AlwaysBuyCallStrategy extends BaseStrategy {
  constructor(params = {}) {
    super(params);
    this.name = 'Always Buy Call';
  }

  /**
   * Generate signal - ALWAYS returns entry
   */
  async generateSignal(marketData, indicators, options) {
    const { spot } = marketData;
    
    this.logger.info(`[${this.name}] 🚨 TEST MODE: Forcing BUY signal`);

    // Find call options with sufficient DTE
    const MIN_DTE = 30;  // ← ADICION
    
    // Find first available call option near ATM
    const calls = options.filter(opt => opt.side === 'CALL');
    
    if (calls.length === 0) {
      console.log('❌ NO CALLS AVAILABLE - RETURNING WAIT');
      return {
        signalType: 'wait',
        strategy: this.name,
        confidence: 0,
        reason: 'No call options available'
      };
    }
    
    // Sort by distance from spot (closest to ATM first)
    calls.sort((a, b) => {
      const distA = Math.abs(a.strike - spot);
      const distB = Math.abs(b.strike - spot);
      return distA - distB;
    });
    
    const targetCall = calls[0];
    
    this.logger.info(
      `[${this.name}] 🎯 Selected: ${targetCall.symbol} ` +
      `(Strike: $${targetCall.strike}, Premium: $${targetCall.markPrice})`
    );
    
    return {
      signalType: 'entry',
      strategy: this.name,
      direction: 'bullish',
      confidence: 100, // Always 100% confident (it's a test!)
      reason: 'TEST MODE: Always buy call',
      legs: [
        {
          option: targetCall,
          action: 'buy', 
          quantity: 1     
         
        }
      ],       
      
      // Recommended position
      recommendedPosition: {
        type: 'long_call',
        legs: [
          {
            symbol: targetCall.symbol,
            strike: targetCall.strike,
            type: 'call',
            action: 'buy',
            contracts: 1, // Buy 1 contract
            premium: targetCall.markPrice,
            expiryDate: targetCall.expiryDate,
            dte: targetCall.dte
          }
        ],
        
        // Risk metrics (simplified)
        maxProfit: Infinity, // Long call = unlimited upside
        maxLoss: targetCall.markPrice, // Max loss = premium paid
        breakeven: targetCall.strike + targetCall.markPrice,
        
        // Greeks
        delta: targetCall.delta || 0.5,
        gamma: targetCall.gamma || 0,
        theta: targetCall.theta || 0,
        vega: targetCall.vega || 0
      }
    };
  }
}

module.exports = AlwaysBuyCallStrategy;
