const Logger = require('../../utils/logger');

/**
 * Position Monitor
 * Monitors active positions and checks exit conditions
 */
class PositionMonitor {
  constructor(botId, config, database, optionsService, executionEngine) {
    this.botId = botId;
    this.config = config;
    this.db = database;
    this.optionsService = optionsService;
    this.executionEngine = executionEngine;
    this.logger = new Logger(`PositionMonitor-${botId}`);
  }

  /**
   * Monitor all active positions
   * @returns {Promise<Array>} Array of exit actions taken
   */
  async monitorPositions() {
    try {
      this.logger.info('[PositionMonitor] Checking active positions...');
      
      // 1. Get all active trades
      const activeTrades = await this.getActiveTrades();
      
      if (activeTrades.length === 0) {
        this.logger.info('[PositionMonitor] No active positions');
        return [];
      }
      
      this.logger.info(`[PositionMonitor] Found ${activeTrades.length} active position(s)`);
      
      // 2. Get current market data
      const marketData = await this.getCurrentMarketData();
      
      // 3. Check each position for exit conditions
      const exitActions = [];
      
      for (const trade of activeTrades) {
        // Calculate and update P&L in real-time
        await this.updatePositionPnL(trade, marketData);
        
        const exitSignal = await this.checkExitConditions(trade, marketData);
        
        if (exitSignal.shouldExit) {
          this.logger.info(`[PositionMonitor] Exit signal for trade ${trade.id}: ${exitSignal.reason}`);
          
          // Execute exit
          const closedTrade = await this.executionEngine.executeExit(
            trade,
            exitSignal.reason,
            marketData
          );
          
          exitActions.push({
            tradeId: trade.id,
            reason: exitSignal.reason,
            pnl: closedTrade.realizedPnl
          });
          
          // Save exit signal to database
          await this.saveExitSignal(trade, exitSignal, marketData);
        }
      }
      
      if (exitActions.length > 0) {
        this.logger.info(`[PositionMonitor] Closed ${exitActions.length} position(s)`);
      }
      
      return exitActions;
    } catch (error) {
      this.logger.error('[PositionMonitor] Error monitoring positions:', error);
      return [];
    }
  }

  /**
   * Get all active trades from database
   */
  async getActiveTrades() {
    const BotTrade = this.db.getModel('BotTrade');
    
    return await BotTrade.findAll({
      where: { 
        botId: this.botId,
        status: 'active' 
      },
      order: [['entryTime', 'ASC']]
    });
  }

  /**
   * Get current market data
   */
  async getCurrentMarketData() {
    const optionsData = await this.optionsService.getAllOptions();
    const options = optionsData.options;
    const spot = await this.optionsService.getCurrentSpot();
    
    // Calculate IV Rank (simplified)
    const atmIVs = options
      .filter(opt => Math.abs(opt.delta) > 0.4 && Math.abs(opt.delta) < 0.6)
      .map(opt => opt.markIV);
    
    const avgIV = atmIVs.length > 0
      ? atmIVs.reduce((sum, iv) => sum + iv, 0) / atmIVs.length
      : 0;
    
    // Simplified IV Rank
    const ivRank = Math.min(100, Math.max(0, avgIV * 100));
    
    return {
      spot,
      ivRank,
      options,
      timestamp: new Date()
    };
  }

  /**
   * Check exit conditions for a trade
   */
  async checkExitConditions(trade, marketData) {
    const { spot, options } = marketData;
    
    // Build exit rules from config
    const exitRules = {
      profitTarget: this.config.profitTargetPct || 12.0,
      stopLoss: this.config.stopLossPct || 3.0,
     //dteExit: this.config.dteExit || 21,
      deltaThreshold: this.config.deltaThreshold || 0.70,
      ivRankChange: this.config.ivRankChange || null
    };
    
    // 1. Calculate current P&L
    const currentPnL = await this.calculateCurrentPnL(trade, options);
    const pnlPercent = (currentPnL / Math.abs(trade.maxLoss)) * 100;
    
    // 2. Calculate current position Greeks
    const currentGreeks = await this.calculateCurrentGreeks(trade, options);
    
    // 3. Calculate DTE
    const dte = this.calculateDTE(trade.legs[0].expiryDate);
    
    // 4. Check profit target
    if (exitRules.profitTarget && pnlPercent >= exitRules.profitTarget) {
      return {
        shouldExit: true,
        reason: `profit_target (${pnlPercent.toFixed(1)}% >= ${exitRules.profitTarget}%)`,
        currentPnL,
        pnlPercent,
        currentGreeks
      };
    }
    
    // 5. Check stop loss
    if (exitRules.stopLoss && pnlPercent <= -exitRules.stopLoss) {
      return {
        shouldExit: true,
        reason: `stop_loss (${pnlPercent.toFixed(1)}% <= -${exitRules.stopLoss}%)`,
        currentPnL,
        pnlPercent,
        currentGreeks
      };
    }
    
    // 6. Check DTE exit
    if (exitRules.dteExit && dte <= exitRules.dteExit) {
      return {
        shouldExit: true,
        reason: `dte_exit (${dte} <= ${exitRules.dteExit})`,
        currentPnL,
        pnlPercent,
        currentGreeks
      };
    }
    
    // 7. Check delta threshold
    if (exitRules.deltaThreshold && Math.abs(currentGreeks.delta) >= exitRules.deltaThreshold) {
      return {
        shouldExit: true,
        reason: `delta_threshold (|${currentGreeks.delta.toFixed(3)}| >= ${exitRules.deltaThreshold})`,
        currentPnL,
        pnlPercent,
        currentGreeks
      };
    }
    
    // 8. Check IV Rank change (optional)
    if (exitRules.ivRankChange && trade.entryIvRank) {
      const ivRankDrop = trade.entryIvRank - marketData.ivRank;
      if (ivRankDrop >= exitRules.ivRankChange) {
        return {
          shouldExit: true,
          reason: `iv_rank_drop (${ivRankDrop.toFixed(1)} >= ${exitRules.ivRankChange})`,
          currentPnL,
          pnlPercent,
          currentGreeks
        };
      }
    }
    
    // No exit conditions met
    return {
      shouldExit: false,
      reason: null,
      currentPnL,
      pnlPercent,
      currentGreeks
    };
  }

  /**
   * Calculate current P&L for a trade
   */
  async calculateCurrentPnL(trade, options) {
    let currentValue = 0;
    
    for (const leg of trade.legs) {
      // Find current price
      const current = options.find(opt =>
        opt.symbol === leg.symbol &&
        opt.strike === leg.strike &&
        opt.side === leg.side
      );
      
      const currentPrice = current?.markPrice || leg.entryPrice;
      
      // Calculate P&L for this leg
      if (leg.action === 'sell') {
        // Sold: profit if price goes down
        currentValue += (leg.entryPrice - currentPrice) * leg.quantity;
      } else {
        // Bought: profit if price goes up
        currentValue += (currentPrice - leg.entryPrice) * leg.quantity;
      }
    }
    
    return currentValue;
  }

  /**
   * Calculate current Greeks for a trade
   */
  async calculateCurrentGreeks(trade, options) {
    let delta = 0;
    let gamma = 0;
    let theta = 0;
    let vega = 0;
    
    for (const leg of trade.legs) {
      // Find current Greeks
      const current = options.find(opt =>
        opt.symbol === leg.symbol &&
        opt.strike === leg.strike &&
        opt.side === leg.side
      );
      
      const currentDelta = current?.delta || leg.delta;
      const currentGamma = current?.gamma || leg.gamma;
      const currentTheta = current?.theta || leg.theta;
      const currentVega = current?.vega || leg.vega;
      
      const multiplier = leg.action === 'buy' ? 1 : -1;
      delta += currentDelta * multiplier * leg.quantity;
      gamma += currentGamma * multiplier * leg.quantity;
      theta += currentTheta * multiplier * leg.quantity;
      vega += currentVega * multiplier * leg.quantity;
    }
    
    return { delta, gamma, theta, vega };
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
   * Update position P&L in real-time
   */
  async updatePositionPnL(trade, marketData) {
    try {
      const { options } = marketData;
      
      // Calculate current P&L
      const currentPnL = await this.calculateCurrentPnL(trade, options);
      
      // Validate values before toFixed
      if (currentPnL === null || currentPnL === undefined || isNaN(currentPnL)) {
        this.logger.warn(`[PositionMonitor] Invalid P&L for trade ${trade.id}, skipping update`);
        return;
      }
      
      const maxLoss = Math.abs(trade.maxLoss || 1); // Avoid division by zero
      const pnlPercent = (currentPnL / maxLoss) * 100;
      
      // Calculate current value (entry credit + current P&L)
      const entryCredit = parseFloat(trade.entryCredit) || 0;
      const currentValue = entryCredit + currentPnL;
      
      // Update database
      const BotTrade = this.db.getModel('BotTrade');
      await BotTrade.update({
        currentValue: currentValue.toFixed(2),
        unrealizedPnl: currentPnL.toFixed(2),
        currentPnlPercent: pnlPercent.toFixed(2)
      }, {
        where: { id: trade.id }
      });
      
      this.logger.debug(`[PositionMonitor] Updated P&L for trade ${trade.id}: $${currentPnL.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
    } catch (error) {
      this.logger.error('[PositionMonitor] Error updating position P&L:', error);
    }
  }

  /**
   * Save exit signal to database
   */
  async saveExitSignal(trade, exitSignal, marketData) {
    try {
      const BotSignal = this.db.getModel('BotSignal');
      
      await BotSignal.create({
        botId: this.botId,
        configId: this.config.id,
        timestamp: new Date(),
        signalType: 'exit',
        strategy: trade.strategy,
        confidence: 1.0,
        marketData: {
          spot: marketData.spot,
          ivRank: marketData.ivRank,
          currentPnL: exitSignal.currentPnL,
          pnlPercent: exitSignal.pnlPercent,
          currentGreeks: exitSignal.currentGreeks
        },
        actionTaken: true,
        tradeId: trade.id,
        reason: exitSignal.reason
      });
      
      this.logger.info(`[PositionMonitor] Exit signal saved for trade ${trade.id}`);
    } catch (error) {
      this.logger.error('[PositionMonitor] Error saving exit signal:', error);
    }
  }
}

module.exports = PositionMonitor;
