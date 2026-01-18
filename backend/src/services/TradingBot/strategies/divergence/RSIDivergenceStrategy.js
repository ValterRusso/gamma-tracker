const BaseStrategy = require('../BaseStrategy');
const StrikeSelector = require('../../utils/StrikeSelector');
const GreekAggregator = require('../../utils/GreekAggregator');
const RiskManager = require('../../utils/RiskManager');
const DivergenceDetector = require('../../utils/DivergenceDetector');

/**
 * RSI Divergence Strategy
 * 
 * CONCEPT:
 * Uses RSI divergences to identify potential reversals and trend continuations
 * 
 * DIVERGENCE TYPES:
 * 
 * 1. Classic Bearish (Reversal Down):
 *    - Price: Higher High
 *    - RSI: Lower High (< 70)
 *    → Trade: Bear Put Spread or Bear Call Spread
 * 
 * 2. Classic Bullish (Reversal Up):
 *    - Price: Lower Low
 *    - RSI: Higher Low (> 30)
 *    → Trade: Bull Call Spread or Bull Put Spread
 * 
 * 3. Hidden Bearish (Downtrend Continuation):
 *    - Price: Lower High
 *    - RSI: Higher High
 *    → Trade: Bear spreads (continuation)
 * 
 * 4. Hidden Bullish (Uptrend Continuation):
 *    - Price: Higher Low
 *    - RSI: Lower Low
 *    → Trade: Bull spreads (continuation)
 * 
 * BEST CONDITIONS:
 * - Clear divergence pattern (confidence > 0.7)
 * - RSI in extreme zones (>70 or <30 for classic)
 * - Sufficient price history (20+ candles)
 * - Good options liquidity
 * 
 * RISK MANAGEMENT:
 * - Max Loss = Debit Paid (for debit spreads)
 * - Profit Target = 50% of max profit
 * - Stop Loss = 75% of max loss
 * - DTE: 20-60 days
 */
class RSIDivergenceStrategy extends BaseStrategy {
  constructor(config = {}) {
    super(config);
    
    this.name = 'RSI Divergence';
    this.type = 'divergence-based';

    // RSI Divergence specific defaults
    this.defaults = {
      ...this.defaults,
      
      // Divergence detection
      lookback: 20,              // Candles to analyze
      rsiOverbought: 70,         // RSI overbought threshold
      rsiOversold: 30,           // RSI oversold threshold
      minConfidence: 0.7,        // Minimum confidence (0-1)
      minPeakDistance: 5,        // Minimum distance between peaks
      
      // Options selection
      longDelta: 0.60,           // Long leg delta
      shortDelta: 0.40,          // Short leg delta
      deltaTolerance: 0.10,      // Delta tolerance
      minDTE: 20,                // 20-60 days optimal
      maxDTE: 60,
      minSpreadWidth: 1000,      // Minimum $1000 spread
      maxSpreadWidth: 15000,     // Maximum $15000 spread
      
      // Risk management
      profitTarget: 0.5,         // Close at 50% max profit
      stopLoss: 0.75,            // Stop at 75% max loss
      dteExit: 14,               // Close if DTE < 14
      
      // Strategy preferences
      preferDebitSpreads: true,  // Use debit spreads (buy premium)
      allowHiddenDiv: true       // Allow hidden divergences
    };

    this.params = { ...this.defaults, ...config };
    
    // Initialize divergence detector
    this.divergenceDetector = new DivergenceDetector(this.logger);
  }

  /**
   * Check if entry conditions are met
   * @param {Object} marketData - Current market data
   * @param {Object} indicators - Calculated indicators
   * @returns {Promise<boolean>} - True if entry conditions met
   */
  async checkEntry(marketData, indicators) {
    // 1. Check if we have price and RSI history
    if (!indicators.priceHistory || indicators.priceHistory.length < this.params.lookback) {
      this.log('info', `Insufficient price history: ${indicators.priceHistory?.length || 0}`);
      return false;
    }

    if (!indicators.rsiHistory || indicators.rsiHistory.length < this.params.lookback) {
      this.log('info', `Insufficient RSI history: ${indicators.rsiHistory?.length || 0}`);
      return false;
    }

    // 2. Detect divergences
    const divergence = this.divergenceDetector.detect(
      indicators.priceHistory,
      indicators.rsiHistory,
      {
        lookback: this.params.lookback,
        rsiOverbought: this.params.rsiOverbought,
        rsiOversold: this.params.rsiOversold,
        minPeakDistance: this.params.minPeakDistance
      }
    );

    // Store divergence for later use
    this.currentDivergence = divergence;

    // 3. Check if divergence detected
    if (!divergence.detected) {
      this.log('info', 'No divergence detected');
      return false;
    }

    // 4. Check confidence
    if (divergence.confidence < this.params.minConfidence) {
      this.log('info', `Divergence confidence too low: ${divergence.confidence.toFixed(2)}`);
      return false;
    }

    // 5. Check if hidden divergences are allowed
    if (divergence.type === 'hidden' && !this.params.allowHiddenDiv) {
      this.log('info', 'Hidden divergences not allowed');
      return false;
    }

    // 6. Check volume
    if (indicators.totalVolume < this.params.minVolume) {
      this.log('info', `Volume too low: ${indicators.totalVolume}`);
      return false;
    }

    // 7. Check options availability
    if (!indicators.atmOptions || indicators.atmOptions.length < 2) {
      this.log('info', 'Insufficient options');
      return false;
    }

    this.log('info', `Entry conditions met: ${divergence.type} ${divergence.subtype} divergence`, {
      confidence: divergence.confidence.toFixed(2),
      direction: divergence.direction,
      ivRank: indicators.ivRank,
      volume: indicators.totalVolume
    });

    return true;
  }

  /**
   * Select strikes based on divergence direction
   * @param {Object} marketData - Current market data
   * @param {Array} optionsData - Available options
   * @returns {Promise<Object>} - Selected legs and Greeks
   */
  async selectStrikes(marketData, optionsData) {
    try {
      const { spot } = marketData;
      const divergence = this.currentDivergence;

      if (!divergence || !divergence.detected) {
        this.log('warn', 'No divergence available for strike selection');
        return null;
      }

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

      // 4. Select strategy based on divergence direction
      let legs;
      
      if (divergence.direction === 'up') {
        // Bullish divergence → Bull Call Spread
        legs = await this.selectBullCallSpread(expiryOptions, spot);
      } else if (divergence.direction === 'down') {
        // Bearish divergence → Bear Put Spread
        legs = await this.selectBearPutSpread(expiryOptions, spot);
      } else {
        this.log('warn', `Unknown divergence direction: ${divergence.direction}`);
        return null;
      }

      if (!legs || legs.length === 0) {
        return null;
      }

      // 5. Calculate Greeks
      const greeks = GreekAggregator.sum(legs);

      // 6. Calculate max profit/loss
      const debitPaid = legs[0].option.mark_price - legs[1].option.mark_price;
      const spreadWidth = Math.abs(legs[1].option.strike - legs[0].option.strike);
      const maxProfit = spreadWidth - debitPaid;
      const maxLoss = debitPaid;

      // 7. Validate risk/reward
      if (maxProfit <= 0) {
        this.log('warn', `Max profit not positive: ${maxProfit.toFixed(2)}`);
        return null;
      }

      const riskReward = maxProfit / maxLoss;
      
      if (riskReward < 0.5) {
        this.log('warn', `Risk/reward too low: ${riskReward.toFixed(2)}`);
        return null;
      }

      this.log('info', 'Strikes selected successfully', {
        strategy: divergence.direction === 'up' ? 'Bull Call Spread' : 'Bear Put Spread',
        spreadWidth: spreadWidth.toFixed(2),
        debit: debitPaid.toFixed(2),
        maxProfit: maxProfit.toFixed(2),
        maxLoss: maxLoss.toFixed(2),
        riskReward: riskReward.toFixed(2)
      });

      return {
        legs,
        greeks,
        maxProfit,
        maxLoss,
        riskReward,
        spreadWidth,
        debitPaid,
        divergence: {
          type: divergence.type,
          subtype: divergence.subtype,
          confidence: divergence.confidence,
          reason: divergence.classic[divergence.subtype]?.reason || divergence.hidden[divergence.subtype]?.reason
        }
      };
    } catch (error) {
      this.log('error', 'Error selecting strikes:', error);
      return null;
    }
  }

  /**
   * Select Bull Call Spread (for bullish divergence)
   */
  async selectBullCallSpread(expiryOptions, spot) {
    // Get only calls
    const calls = expiryOptions.filter(opt => opt.side === 'CALL');

    if (calls.length < 2) {
      this.log('warn', 'Insufficient calls for Bull Call Spread');
      return null;
    }

    // Find long call (lower strike, delta ~0.60)
    const longCall = StrikeSelector.findByDelta(
      calls,
      this.params.longDelta,
      this.params.deltaTolerance
    );

    if (!longCall) {
      this.log('warn', `Could not find long call with delta ${this.params.longDelta}`);
      return null;
    }

    // Find short call (higher strike, delta ~0.40)
    const shortCallCandidates = calls.filter(opt => opt.strike > longCall.strike);
    
    const shortCall = StrikeSelector.findByDelta(
      shortCallCandidates,
      this.params.shortDelta,
      this.params.deltaTolerance
    );

    if (!shortCall) {
      this.log('warn', `Could not find short call with delta ${this.params.shortDelta}`);
      return null;
    }

    // Validate spread width
    const spreadWidth = shortCall.strike - longCall.strike;
    
    if (spreadWidth < this.params.minSpreadWidth || spreadWidth > this.params.maxSpreadWidth) {
      this.log('warn', `Spread width ${spreadWidth} outside range`);
      return null;
    }

    return [
      { action: 'BUY', option: longCall, quantity: 1 },
      { action: 'SELL', option: shortCall, quantity: 1 }
    ];
  }

  /**
   * Select Bear Put Spread (for bearish divergence)
   */
  async selectBearPutSpread(expiryOptions, spot) {
    // Get only puts
    const puts = expiryOptions.filter(opt => opt.side === 'PUT');

    if (puts.length < 2) {
      this.log('warn', 'Insufficient puts for Bear Put Spread');
      return null;
    }

    // Find long put (higher strike, delta ~-0.60)
    const longPut = StrikeSelector.findByDelta(
      puts,
      -this.params.longDelta,
      this.params.deltaTolerance
    );

    if (!longPut) {
      this.log('warn', `Could not find long put with delta ${-this.params.longDelta}`);
      return null;
    }

    // Find short put (lower strike, delta ~-0.40)
    const shortPutCandidates = puts.filter(opt => opt.strike < longPut.strike);
    
    const shortPut = StrikeSelector.findByDelta(
      shortPutCandidates,
      -this.params.shortDelta,
      this.params.deltaTolerance
    );

    if (!shortPut) {
      this.log('warn', `Could not find short put with delta ${-this.params.shortDelta}`);
      return null;
    }

    // Validate spread width
    const spreadWidth = longPut.strike - shortPut.strike;
    
    if (spreadWidth < this.params.minSpreadWidth || spreadWidth > this.params.maxSpreadWidth) {
      this.log('warn', `Spread width ${spreadWidth} outside range`);
      return null;
    }

    return [
      { action: 'BUY', option: longPut, quantity: 1 },
      { action: 'SELL', option: shortPut, quantity: 1 }
    ];
  }

  /**
   * Check if position should be exited
   * @param {Object} position - Current position
   * @param {Object} marketData - Current market data
   * @returns {Promise<Object>} - Exit decision
   */
  async checkExit(position, marketData) {
    const { pnl, maxProfit, maxLoss, daysToExpiry } = position;

    // 1. Profit target hit
    if (pnl >= maxProfit * this.params.profitTarget) {
      return {
        shouldExit: true,
        reason: `Profit target hit: ${(pnl / maxProfit * 100).toFixed(1)}%`,
        exitType: 'profit_target'
      };
    }

    // 2. Stop loss hit
    if (pnl <= -maxLoss * this.params.stopLoss) {
      return {
        shouldExit: true,
        reason: `Stop loss hit: ${(pnl / maxLoss * 100).toFixed(1)}%`,
        exitType: 'stop_loss'
      };
    }

    // 3. Close to expiry
    if (daysToExpiry <= this.params.dteExit) {
      return {
        shouldExit: true,
        reason: `Close to expiry: ${daysToExpiry} days left`,
        exitType: 'dte_exit'
      };
    }

    // 4. Reverse divergence detected (optional)
    // TODO: Implement reverse divergence detection

    return {
      shouldExit: false,
      reason: 'Hold position'
    };
  }

  /**
   * Get strategy description
   */
  getDescription() {
    return 'RSI Divergence strategy: Identifies reversals and continuations using RSI divergences';
  }

  /**
   * Get strategy parameters
   */
  getParameters() {
    return {
      lookback: { type: 'number', default: 20, description: 'Candles to analyze' },
      rsiOverbought: { type: 'number', default: 70, description: 'RSI overbought threshold' },
      rsiOversold: { type: 'number', default: 30, description: 'RSI oversold threshold' },
      minConfidence: { type: 'number', default: 0.7, description: 'Minimum confidence (0-1)' },
      longDelta: { type: 'number', default: 0.60, description: 'Long leg delta' },
      shortDelta: { type: 'number', default: 0.40, description: 'Short leg delta' },
      minDTE: { type: 'number', default: 20, description: 'Minimum days to expiry' },
      maxDTE: { type: 'number', default: 60, description: 'Maximum days to expiry' },
      profitTarget: { type: 'number', default: 0.5, description: 'Profit target (% of max)' },
      stopLoss: { type: 'number', default: 0.75, description: 'Stop loss (% of max)' },
      allowHiddenDiv: { type: 'boolean', default: true, description: 'Allow hidden divergences' }
    };
  }

  /**
   * Helper: Log with strategy context
   */
  log(level, message, data = {}) {
    this.logger[level](`[${this.name}] ${message}`, data);
  }
}

module.exports = RSIDivergenceStrategy;
