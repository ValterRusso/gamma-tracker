const Logger = require('../../utils/logger');
const SignalEngine = require('./SignalEngine');
const ExecutionEngine = require('./ExecutionEngine');
const PositionMonitor = require('./PositionMonitor');

/**
 * Trading Bot Service
 * Main orchestrator for automated trading system
 */
class TradingBotService {
  constructor(database, optionsService) {
    this.db = database;
    this.optionsService = optionsService;
    this.logger = new Logger('TradingBotService');
    
    // Initialize engines
    this.signalEngine = new SignalEngine(database, optionsService);
    this.executionEngine = new ExecutionEngine(database, optionsService);
    this.positionMonitor = new PositionMonitor(database, optionsService, this.executionEngine);
    
    // Bot state
    this.isRunning = false;
    this.intervalId = null;
    this.config = null;
  }

  /**
   * Start the trading bot
   * @param {string} configId - Bot configuration ID
   */
  async start(configId) {
    try {
      if (this.isRunning) {
        this.logger.warn('[TradingBot] Bot is already running');
        return { success: false, message: 'Bot is already running' };
      }
      
      // Load configuration
      this.config = await this.loadConfig(configId);
      
      if (!this.config) {
        throw new Error(`Configuration not found: ${configId}`);
      }
      
      if (!this.config.enabled) {
        throw new Error(`Configuration is disabled: ${this.config.name}`);
      }
      
      this.logger.info(`[TradingBot] Starting bot with config: ${this.config.name}`);
      
      // Set running state
      this.isRunning = true;
      
      // Run initial iteration
      await this.runIteration();
      
      // Start periodic loop (every 60 seconds)
      this.intervalId = setInterval(() => {
        this.runIteration().catch(error => {
          this.logger.error('[TradingBot] Error in iteration:', error);
        });
      }, 60000); // 60 seconds
      
      this.logger.info('[TradingBot] Bot started successfully');
      
      return {
        success: true,
        message: `Bot started with config: ${this.config.name}`,
        config: this.config
      };
    } catch (error) {
      this.logger.error('[TradingBot] Error starting bot:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the trading bot
   */
  async stop() {
    try {
      if (!this.isRunning) {
        this.logger.warn('[TradingBot] Bot is not running');
        return { success: false, message: 'Bot is not running' };
      }
      
      this.logger.info('[TradingBot] Stopping bot...');
      
      // Clear interval
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      
      // Set running state
      this.isRunning = false;
      this.config = null;
      
      this.logger.info('[TradingBot] Bot stopped successfully');
      
      return {
        success: true,
        message: 'Bot stopped successfully'
      };
    } catch (error) {
      this.logger.error('[TradingBot] Error stopping bot:', error);
      throw error;
    }
  }

  /**
   * Get bot status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config ? {
        id: this.config.id,
        name: this.config.name,
        strategy: this.config.strategy
      } : null,
      uptime: this.isRunning ? 'Running' : 'Stopped'
    };
  }

  /**
   * Run one iteration of the bot loop
   */
  async runIteration() {
    try {
      this.logger.info('[TradingBot] === Running iteration ===');
      
      // 1. Monitor existing positions (check exits first)
      const exitActions = await this.positionMonitor.monitorPositions(this.config);
      
      if (exitActions.length > 0) {
        this.logger.info(`[TradingBot] Closed ${exitActions.length} position(s)`);
      }
      
      // 2. Check if we can enter new positions
      const canEnter = await this.canEnterNewPosition();
      
      if (!canEnter) {
        this.logger.info('[TradingBot] Cannot enter new position (max positions reached or other constraint)');
        return;
      }
      
      // 3. Generate entry signal
      const signal = await this.signalEngine.analyzeMarket(this.config);
      
      this.logger.info(`[TradingBot] Signal: ${signal.signalType} (${signal.strategy || 'none'})`);
      
      // 4. Execute entry if signal is positive
      if (signal.signalType === 'entry' && signal.strategy) {
        this.logger.info(`[TradingBot] Executing entry for ${signal.strategy}...`);
        
        const trade = await this.executionEngine.executeEntry(signal, this.config);
        
        this.logger.info(`[TradingBot] Trade entered: ${trade.id}`);
        
        // Update signal record with trade ID
        await this.updateSignalWithTrade(signal, trade.id);
      }
      
      this.logger.info('[TradingBot] === Iteration complete ===');
    } catch (error) {
      this.logger.error('[TradingBot] Error in iteration:', error);
    }
  }

  /**
   * Check if bot can enter new position
   */
  async canEnterNewPosition() {
    const BotTrade = this.db.getModel('BotTrade');
    
    // Count active positions
    const activeCount = await BotTrade.count({
      where: { status: 'active' }
    });
    
    // Check against max positions limit
    const maxPositions = this.config.riskParams?.maxPositions || 1;
    
    return activeCount < maxPositions;
  }

  /**
   * Update signal record with trade ID
   */
  async updateSignalWithTrade(signal, tradeId) {
    try {
      const BotSignal = this.db.getModel('BotSignal');
      
      // Find the most recent entry signal
      const signalRecord = await BotSignal.findOne({
        where: {
          signalType: 'entry',
          actionTaken: false
        },
        order: [['timestamp', 'DESC']]
      });
      
      if (signalRecord) {
        await signalRecord.update({
          actionTaken: true,
          tradeId: tradeId
        });
        
        this.logger.info(`[TradingBot] Signal updated with trade ID: ${tradeId}`);
      }
    } catch (error) {
      this.logger.error('[TradingBot] Error updating signal:', error);
    }
  }

  /**
   * Load bot configuration from database
   */
  async loadConfig(configId) {
    const BotConfig = this.db.getModel('BotConfig');
    
    return await BotConfig.findOne({
      where: { id: configId }
    });
  }

  /**
   * Get all bot configurations
   */
  async getAllConfigs() {
    const BotConfig = this.db.getModel('BotConfig');
    
    return await BotConfig.findAll({
      order: [['createdAt', 'DESC']]
    });
  }

  /**
   * Get all trades (with filters)
   */
  async getTrades(filters = {}) {
    const BotTrade = this.db.getModel('BotTrade');
    
    const where = {};
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.strategy) {
      where.strategy = filters.strategy;
    }
    
    return await BotTrade.findAll({
      where,
      order: [['entryTime', 'DESC']],
      limit: filters.limit || 100
    });
  }

  /**
   * Get performance metrics
   */
  async getPerformance(period = 'all_time', strategy = null) {
    const BotTrade = this.db.getModel('BotTrade');
    
    const where = { status: 'closed' };
    
    if (strategy) {
      where.strategy = strategy;
    }
    
    // Add date filter for period
    if (period !== 'all_time') {
      const now = new Date();
      let startDate;
      
      if (period === 'daily') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === 'weekly') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      
      where.exitTime = { $gte: startDate };
    }
    
    // Fetch trades
    const trades = await BotTrade.findAll({ where });
    
    if (trades.length === 0) {
      return {
        period,
        strategy,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnl: 0,
        avgPnlPerTrade: 0
      };
    }
    
    // Calculate metrics
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.realizedPnl > 0).length;
    const losingTrades = trades.filter(t => t.realizedPnl < 0).length;
    const winRate = (winningTrades / totalTrades) * 100;
    
    const totalPnl = trades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const avgPnlPerTrade = totalPnl / totalTrades;
    
    const wins = trades.filter(t => t.realizedPnl > 0);
    const losses = trades.filter(t => t.realizedPnl < 0);
    
    const avgWinningTrade = wins.length > 0
      ? wins.reduce((sum, t) => sum + t.realizedPnl, 0) / wins.length
      : 0;
    
    const avgLosingTrade = losses.length > 0
      ? losses.reduce((sum, t) => sum + t.realizedPnl, 0) / losses.length
      : 0;
    
    const largestWin = wins.length > 0
      ? Math.max(...wins.map(t => t.realizedPnl))
      : 0;
    
    const largestLoss = losses.length > 0
      ? Math.min(...losses.map(t => t.realizedPnl))
      : 0;
    
    return {
      period,
      strategy,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalPnl,
      avgPnlPerTrade,
      avgWinningTrade,
      avgLosingTrade,
      largestWin,
      largestLoss
    };
  }
}

module.exports = TradingBotService;
