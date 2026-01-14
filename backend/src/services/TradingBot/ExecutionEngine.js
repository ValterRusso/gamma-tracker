const Logger = require('../../utils/logger');

/**
 * Execution Engine
 * Simulates order execution with realistic slippage and fills
 */
class ExecutionEngine {
  constructor(database, optionsService) {
    this.db = database;
    this.optionsService = optionsService;
    this.logger = new Logger('ExecutionEngine');
  }

  /**
   * Execute strategy entry (simulated)
   * @param {Object} signal - Signal from SignalEngine
   * @param {Object} config - Bot configuration
   * @returns {Promise<Object>} Trade object
   */
  async executeEntry(signal, config) {
    try {
      this.logger.info(`[ExecutionEngine] Executing entry for ${signal.strategy}`);
      
      const { strategy, params, marketData } = signal;
      
      // 1. Build option legs based on strategy
      const legs = await this.buildStrategyLegs(strategy, params, marketData);
      
      if (!legs || legs.length === 0) {
        throw new Error('Failed to build strategy legs');
      }
      
      // 2. Simulate order execution with slippage
      const executedLegs = await this.simulateExecution(legs);
      
      // 3. Calculate position metrics
      const positionMetrics = this.calculatePositionMetrics(executedLegs, marketData.spot);
      
      // 4. Calculate position Greeks
      const positionGreeks = this.calculatePositionGreeks(executedLegs);
      
      // 5. Create trade record
      const trade = await this.createTradeRecord({
        strategy,
        legs: executedLegs,
        metrics: positionMetrics,
        greeks: positionGreeks,
        marketData,
        config
      });
      
      this.logger.info(`[ExecutionEngine] Trade created: ${trade.id}`);
      
      return trade;
    } catch (error) {
      this.logger.error('[ExecutionEngine] Error executing entry:', error);
      throw error;
    }
  }

  /**
   * Build option legs based on strategy
   */
  async buildStrategyLegs(strategy, params, marketData) {
    const { spot } = marketData;
    const options = await this.optionsService.getOptions();
    
    if (strategy === 'iron_condor') {
      return this.buildIronCondor(options, spot, params);
    }
    
    // Add more strategies here
    throw new Error(`Unknown strategy: ${strategy}`);
  }

  /**
   * Build Iron Condor legs
   * Short Call + Long Call (higher) + Short Put + Long Put (lower)
   */
  buildIronCondor(options, spot, params) {
    const { shortCallDelta, shortPutDelta, wingWidth, dte } = params;
    
    // Filter options by DTE
    const targetDTE = (dte.min + dte.max) / 2;
    const validOptions = options.filter(opt => {
      const optDTE = this.calculateDTE(opt.expiryDate);
      return optDTE >= dte.min && optDTE <= dte.max;
    });
    
    if (validOptions.length === 0) {
      this.logger.warn('[ExecutionEngine] No options found in DTE range');
      return null;
    }
    
    // Find short call (delta ~ -0.16)
    const shortCall = this.findOptionByDelta(
      validOptions.filter(opt => opt.side === 'CALL'),
      shortCallDelta,
      'closest'
    );
    
    // Find short put (delta ~ 0.16)
    const shortPut = this.findOptionByDelta(
      validOptions.filter(opt => opt.side === 'PUT'),
      shortPutDelta,
      'closest'
    );
    
    if (!shortCall || !shortPut) {
      this.logger.warn('[ExecutionEngine] Could not find short strikes');
      return null;
    }
    
    // Find long call (wingWidth higher)
    const longCall = this.findOptionByStrike(
      validOptions.filter(opt => opt.side === 'CALL'),
      shortCall.strike + wingWidth,
      'closest'
    );
    
    // Find long put (wingWidth lower)
    const longPut = this.findOptionByStrike(
      validOptions.filter(opt => opt.side === 'PUT'),
      shortPut.strike - wingWidth,
      'closest'
    );
    
    if (!longCall || !longPut) {
      this.logger.warn('[ExecutionEngine] Could not find long strikes');
      return null;
    }
    
    // Build legs array
    return [
      { ...shortCall, action: 'sell', quantity: 1 },
      { ...longCall, action: 'buy', quantity: 1 },
      { ...shortPut, action: 'sell', quantity: 1 },
      { ...longPut, action: 'buy', quantity: 1 }
    ];
  }

  /**
   * Calculate DTE (Days To Expiration)
   */
  calculateDTE(expiryTimestamp) {
    const now = Date.now();
    const expiry = expiryTimestamp;
    const diffMs = expiry - now;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.floor(diffDays));
  }

  /**
   * Find option by delta (closest match)
   */
  findOptionByDelta(options, targetDelta, mode = 'closest') {
    if (options.length === 0) return null;
    
    let best = options[0];
    let bestDiff = Math.abs(options[0].delta - targetDelta);
    
    for (const opt of options) {
      const diff = Math.abs(opt.delta - targetDelta);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = opt;
      }
    }
    
    return best;
  }

  /**
   * Find option by strike (closest match)
   */
  findOptionByStrike(options, targetStrike, mode = 'closest') {
    if (options.length === 0) return null;
    
    let best = options[0];
    let bestDiff = Math.abs(options[0].strike - targetStrike);
    
    for (const opt of options) {
      const diff = Math.abs(opt.strike - targetStrike);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = opt;
      }
    }
    
    return best;
  }

  /**
   * Simulate order execution with slippage
   */
  async simulateExecution(legs) {
    const executedLegs = [];
    
    for (const leg of legs) {
      // Simulate slippage (0-2% of price)
      const slippagePercent = Math.random() * 0.02; // 0-2%
      const slippage = leg.markPrice * slippagePercent;
      
      // Buy orders get worse price (higher)
      // Sell orders get worse price (lower)
      const executionPrice = leg.action === 'buy'
        ? leg.markPrice + slippage
        : leg.markPrice - slippage;
      
      executedLegs.push({
        symbol: leg.symbol,
        underlying: leg.underlying,
        strike: leg.strike,
        expiryDate: leg.expiryDate,
        side: leg.side,
        action: leg.action,
        quantity: leg.quantity,
        entryPrice: executionPrice,
        markPrice: leg.markPrice,
        slippage: slippage,
        delta: leg.delta,
        gamma: leg.gamma,
        theta: leg.theta,
        vega: leg.vega,
        iv: leg.markIV
      });
    }
    
    return executedLegs;
  }

  /**
   * Calculate position metrics (max profit, max loss, breakevens)
   */
  calculatePositionMetrics(legs, spot) {
    // Calculate net credit/debit
    let netCredit = 0;
    for (const leg of legs) {
      if (leg.action === 'sell') {
        netCredit += leg.entryPrice * leg.quantity;
      } else {
        netCredit -= leg.entryPrice * leg.quantity;
      }
    }
    
    // For Iron Condor:
    // Max Profit = Net Credit
    // Max Loss = Wing Width - Net Credit
    
    // Find wing widths
    const calls = legs.filter(l => l.side === 'CALL').sort((a, b) => a.strike - b.strike);
    const puts = legs.filter(l => l.side === 'PUT').sort((a, b) => a.strike - b.strike);
    
    const callWingWidth = calls.length >= 2 ? calls[1].strike - calls[0].strike : 0;
    const putWingWidth = puts.length >= 2 ? puts[1].strike - puts[0].strike : 0;
    
    const maxWingWidth = Math.max(callWingWidth, putWingWidth);
    
    const maxProfit = netCredit;
    const maxLoss = maxWingWidth - netCredit;
    
    // Calculate breakevens (simplified)
    const shortCallStrike = calls.find(l => l.action === 'sell')?.strike || 0;
    const shortPutStrike = puts.find(l => l.action === 'sell')?.strike || 0;
    
    const breakevens = [
      shortPutStrike - netCredit,
      shortCallStrike + netCredit
    ].filter(be => be > 0);
    
    return {
      netCredit,
      maxProfit,
      maxLoss,
      breakevens,
      callWingWidth,
      putWingWidth
    };
  }

  /**
   * Calculate position Greeks (sum of all legs)
   */
  calculatePositionGreeks(legs) {
    let delta = 0;
    let gamma = 0;
    let theta = 0;
    let vega = 0;
    
    for (const leg of legs) {
      const multiplier = leg.action === 'buy' ? 1 : -1;
      delta += leg.delta * multiplier * leg.quantity;
      gamma += leg.gamma * multiplier * leg.quantity;
      theta += leg.theta * multiplier * leg.quantity;
      vega += leg.vega * multiplier * leg.quantity;
    }
    
    return { delta, gamma, theta, vega };
  }

  /**
   * Create trade record in database
   */
  async createTradeRecord({ strategy, legs, metrics, greeks, marketData, config }) {
    const BotTrade = this.db.getModel('BotTrade');
    
    const trade = await BotTrade.create({
      strategy,
      status: 'active',
      entryTime: new Date(),
      entrySpot: marketData.spot,
      entryIvRank: marketData.ivRank,
      maxProfit: metrics.maxProfit,
      maxLoss: metrics.maxLoss,
      entryCredit: metrics.netCredit,
      legs: legs,
      entryGreeks: greeks,
      notes: `Auto-entered by bot. Config: ${config.name}`
    });
    
    return trade;
  }

  /**
   * Execute strategy exit (simulated)
   */
  async executeExit(trade, reason, currentMarketData) {
    try {
      this.logger.info(`[ExecutionEngine] Executing exit for trade ${trade.id}: ${reason}`);
      
      // 1. Get current prices for all legs
      const currentLegs = await this.getCurrentLegPrices(trade.legs);
      
      // 2. Simulate closing orders
      const closedLegs = await this.simulateClosing(currentLegs);
      
      // 3. Calculate exit cost
      let exitCost = 0;
      for (const leg of closedLegs) {
        // Reverse the action (buy becomes sell, sell becomes buy)
        if (leg.action === 'sell') {
          exitCost -= leg.exitPrice * leg.quantity; // Pay to buy back
        } else {
          exitCost += leg.exitPrice * leg.quantity; // Receive from selling
        }
      }
      
      // 4. Calculate realized P&L
      const realizedPnl = trade.entryCredit - exitCost;
      const pnlPercent = (realizedPnl / Math.abs(trade.maxLoss)) * 100;
      
      // 5. Calculate exit Greeks
      const exitGreeks = this.calculatePositionGreeks(closedLegs);
      
      // 6. Update trade record
      await trade.update({
        status: 'closed',
        exitTime: new Date(),
        exitSpot: currentMarketData.spot,
        exitIvRank: currentMarketData.ivRank,
        exitCost,
        realizedPnl,
        pnlPercent,
        exitReason: reason,
        exitGreeks,
        legs: closedLegs // Update with exit prices
      });
      
      this.logger.info(`[ExecutionEngine] Trade closed: ${trade.id}, P&L: $${realizedPnl.toFixed(2)}`);
      
      return trade;
    } catch (error) {
      this.logger.error('[ExecutionEngine] Error executing exit:', error);
      throw error;
    }
  }

  /**
   * Get current prices for all legs
   */
  async getCurrentLegPrices(legs) {
    const options = await this.optionsService.getOptions();
    
    return legs.map(leg => {
      // Find matching option in current data
      const current = options.find(opt =>
        opt.symbol === leg.symbol &&
        opt.strike === leg.strike &&
        opt.side === leg.side
      );
      
      return {
        ...leg,
        currentPrice: current?.markPrice || leg.entryPrice,
        currentDelta: current?.delta || leg.delta,
        currentGamma: current?.gamma || leg.gamma,
        currentTheta: current?.theta || leg.theta,
        currentVega: current?.vega || leg.vega
      };
    });
  }

  /**
   * Simulate closing orders with slippage
   */
  async simulateClosing(legs) {
    return legs.map(leg => {
      // Simulate slippage (0-2% of price)
      const slippagePercent = Math.random() * 0.02;
      const slippage = leg.currentPrice * slippagePercent;
      
      // Reverse action: buy back shorts, sell longs
      // Buy orders get worse price (higher)
      // Sell orders get worse price (lower)
      const exitPrice = leg.action === 'sell'
        ? leg.currentPrice + slippage  // Buy back short (pay more)
        : leg.currentPrice - slippage; // Sell long (receive less)
      
      return {
        ...leg,
        exitPrice,
        exitSlippage: slippage,
        delta: leg.currentDelta,
        gamma: leg.currentGamma,
        theta: leg.currentTheta,
        vega: leg.currentVega
      };
    });
  }
}

module.exports = ExecutionEngine;
