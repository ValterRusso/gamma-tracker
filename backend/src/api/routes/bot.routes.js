const express = require('express');
const BotManager = require('../../services/TradingBot/BotManager');

/**
 * Bot Routes
 * API endpoints for managing trading bot instances
 */
module.exports = (dependencies) => {
  const router = express.Router();
  const { database, optionsService } = dependencies;
  
  // Initialize Bot Manager (singleton)
  const botManager = new BotManager(database, optionsService);
  
  // ============================================================================
  // BOT CONTROL ENDPOINTS
  // ============================================================================
  
  /**
   * Start a new bot instance
   * POST /api/bot/start
   * Body: { configId: string }
   * Returns: { success, botId, message, config }
   */
  router.post('/bot/start', async (req, res) => {
    try {
      const { configId } = req.body;
      
      if (!configId) {
        return res.status(400).json({
          success: false,
          error: 'configId is required'
        });
      }
      
      const result = await botManager.startBot(configId);
      
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('[BotRoutes] Error starting bot:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * Stop a specific bot instance
   * POST /api/bot/stop/:botId
   * Returns: { success, message, botId }
   */
  router.post('/bot/stop/:botId', async (req, res) => {
    try {
      const { botId } = req.params;
      
      const result = await botManager.stopBot(botId);
      
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('[BotRoutes] Error stopping bot:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * Stop all running bots
   * POST /api/bot/stop-all
   * Returns: { success, stoppedCount, message }
   */
  router.post('/bot/stop-all', async (req, res) => {
    try {
      const result = await botManager.stopAll();
      return res.json(result);
    } catch (error) {
      console.error('[BotRoutes] Error stopping all bots:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // ============================================================================
  // BOT STATUS ENDPOINTS
  // ============================================================================
  
  /**
   * Get status of all bots
   * GET /api/bot/status
   * Returns: { success, data: { bots: [...], totalRunning: number } }
   */
  router.get('/bot/status', async (req, res) => {
    try {
      const bots = botManager.getStatus();
      const totalRunning = botManager.getRunningCount();
      
      return res.json({
        success: true,
        data: {
          bots,
          totalRunning,
          hasRunningBots: botManager.hasRunningBots()
        }
      });
    } catch (error) {
      console.error('[BotRoutes] Error getting status:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * Get status of a specific bot
   * GET /api/bot/status/:botId
   * Returns: { success, data: { botId, isRunning, config, uptime } }
   */
  router.get('/bot/status/:botId', async (req, res) => {
    try {
      const { botId } = req.params;
      const status = botManager.getBotStatus(botId);
      
      if (!status) {
        return res.status(404).json({
          success: false,
          error: `Bot not found: ${botId}`
        });
      }
      
      return res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('[BotRoutes] Error getting bot status:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // ============================================================================
  // BOT DATA ENDPOINTS
  // ============================================================================
  
  /**
   * Get trades (with optional filters)
   * GET /api/bot/trades?botId=xxx&status=active&page=1&limit=50
   * Returns: { success, data: { trades: [...], pagination: {...} } }
   */
  router.get('/bot/trades', async (req, res) => {
    try {
      const { botId, status, page = 1, limit = 50 } = req.query;
      const BotTrade = database.getModel('BotTrade');
      
      const where = {};
      if (botId) where.botId = botId;
      if (status) where.status = status;
      
      const offset = (page - 1) * limit;
      
      const { count, rows } = await BotTrade.findAndCountAll({
        where,
        order: [['entry_time', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      return res.json({
        success: true,
        data: {
          trades: rows,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      console.error('[BotRoutes] Error getting trades:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * Get a specific trade
   * GET /api/bot/trades/:id
   * Returns: { success, data: { trade } }
   */
  router.get('/bot/trades/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const BotTrade = database.getModel('BotTrade');
      
      const trade = await BotTrade.findByPk(id);
      
      if (!trade) {
        return res.status(404).json({
          success: false,
          error: 'Trade not found'
        });
      }
      
      return res.json({
        success: true,
        data: trade
      });
    } catch (error) {
      console.error('[BotRoutes] Error getting trade:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * Get signals (with optional filters)
   * GET /api/bot/signals?botId=xxx&signalType=entry&page=1&limit=50
   * Returns: { success, data: { signals: [...], pagination: {...} } }
   */
  router.get('/bot/signals', async (req, res) => {
    try {
      const { botId, signalType, page = 1, limit = 50 } = req.query;
      const BotSignal = database.getModel('BotSignal');
      
      const where = {};
      if (botId) where.botId = botId;
      if (signalType) where.signalType = signalType;
      
      const offset = (page - 1) * limit;
      
      const { count, rows } = await BotSignal.findAndCountAll({
        where,
        order: [['timestamp', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      return res.json({
        success: true,
        data: {
          signals: rows,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      console.error('[BotRoutes] Error getting signals:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * Get performance metrics
   * GET /api/bot/performance?botId=xxx&period=all_time
   * Returns: { success, data: { metrics } }
   */
  router.get('/bot/performance', async (req, res) => {
    try {
      const { botId, period = 'all_time' } = req.query;
      const BotTrade = database.getModel('BotTrade');
      
      const where = { status: 'closed' };
      if (botId) where.botId = botId;
      
      const trades = await BotTrade.findAll({ where });
      
      if (trades.length === 0) {
        return res.json({
          success: true,
          data: {
            totalTrades: 0,
            winRate: '0.00%',
            totalPnl: '0.00',
            avgPnlPerTrade: '0.00',
            avgWinningTrade: '0.00',
            avgLosingTrade: '0.00',
            largestWin: '0.00',
            largestLoss: '0.00',
            maxDrawdown: '0.00',
            profitFactor: '0.00',
            sharpeRatio: '0.00',
            avgDaysInTrade: '0.00'
          }
        });
      }
      
      // Calculate metrics
      const totalTrades = trades.length;
      const winningTrades = trades.filter(t => t.realizedPnl > 0);
      const losingTrades = trades.filter(t => t.realizedPnl <= 0);
      
      const winRate = (winningTrades.length / totalTrades) * 100;
      const totalPnl = trades.reduce((sum, t) => sum + parseFloat(t.realizedPnl || 0), 0);
      const avgPnlPerTrade = totalPnl / totalTrades;
      
      const avgWinningTrade = winningTrades.length > 0
        ? winningTrades.reduce((sum, t) => sum + parseFloat(t.realizedPnl), 0) / winningTrades.length
        : 0;
      
      const avgLosingTrade = losingTrades.length > 0
        ? losingTrades.reduce((sum, t) => sum + parseFloat(t.realizedPnl), 0) / losingTrades.length
        : 0;
      
      const largestWin = winningTrades.length > 0
        ? Math.max(...winningTrades.map(t => parseFloat(t.realizedPnl)))
        : 0;
      
      const largestLoss = losingTrades.length > 0
        ? Math.min(...losingTrades.map(t => parseFloat(t.realizedPnl)))
        : 0;
      
      // Calculate profit factor
      const grossProfit = winningTrades.reduce((sum, t) => sum + parseFloat(t.realizedPnl), 0);
      const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + parseFloat(t.realizedPnl), 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
      
      // Calculate Sharpe ratio (simplified)
      const returns = trades.map(t => parseFloat(t.realizedPnl || 0));
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const stdDev = Math.sqrt(
        returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      );
      const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
      
      // Calculate avg days in trade
      const daysInTrade = trades
        .filter(t => t.entryTime && t.exitTime)
        .map(t => {
          const entry = new Date(t.entryTime);
          const exit = new Date(t.exitTime);
          return (exit - entry) / (1000 * 60 * 60 * 24);
        });
      
      const avgDaysInTrade = daysInTrade.length > 0
        ? daysInTrade.reduce((sum, d) => sum + d, 0) / daysInTrade.length
        : 0;
      
      // Calculate max drawdown (simplified)
      let peak = 0;
      let maxDrawdown = 0;
      let cumPnl = 0;
      
      for (const trade of trades) {
        cumPnl += parseFloat(trade.realizedPnl || 0);
        if (cumPnl > peak) {
          peak = cumPnl;
        }
        const drawdown = peak - cumPnl;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
      
      return res.json({
        success: true,
        data: {
          totalTrades,
          winningTrades: winningTrades.length,
          losingTrades: losingTrades.length,
          winRate: winRate.toFixed(2) + '%',
          totalPnl: totalPnl.toFixed(2),
          avgPnlPerTrade: avgPnlPerTrade.toFixed(2),
          avgWinningTrade: avgWinningTrade.toFixed(2),
          avgLosingTrade: avgLosingTrade.toFixed(2),
          largestWin: largestWin.toFixed(2),
          largestLoss: largestLoss.toFixed(2),
          maxDrawdown: maxDrawdown.toFixed(2),
          profitFactor: profitFactor.toFixed(2),
          sharpeRatio: sharpeRatio.toFixed(2),
          avgDaysInTrade: avgDaysInTrade.toFixed(2)
        }
      });
    } catch (error) {
      console.error('[BotRoutes] Error getting performance:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // ============================================================================
  // BOT CONFIG ENDPOINTS
  // ============================================================================
  
  /**
   * Get all bot configurations
   * GET /api/bot/configs
   * Returns: { success, data: [...] }
   */
  router.get('/bot/configs', async (req, res) => {
    try {
      const BotConfig = database.getModel('BotConfig');
      
      const configs = await BotConfig.findAll({
        order: [['created_at', 'DESC']]
      });
      
      return res.json({
        success: true,
        data: configs
      });
    } catch (error) {
      console.error('[BotRoutes] Error getting configs:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * Get a specific bot configuration
   * GET /api/bot/configs/:id
   * Returns: { success, data: {...} }
   */
  router.get('/bot/configs/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const BotConfig = database.getModel('BotConfig');
      
      const config = await BotConfig.findByPk(id);
      
      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'Configuration not found'
        });
      }
      
      return res.json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('[BotRoutes] Error getting config:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * Create a new bot configuration
   * POST /api/bot/configs
   * Body: { name, strategy, symbol, entryRules, exitRules, riskParams }
   * Returns: { success, data: {...} }
   */
  router.post('/bot/configs', async (req, res) => {
    try {
      const { name, strategy, symbol, entryRules, exitRules, riskParams } = req.body;
      
      if (!name || !strategy || !symbol) {
        return res.status(400).json({
          success: false,
          error: 'name, strategy, and symbol are required'
        });
      }
      
      const BotConfig = database.getModel('BotConfig');
      
      const config = await BotConfig.create({
        name,
        strategy,
        symbol,
        enabled: false, // Start disabled by default
        entryRules: entryRules || {},
        exitRules: exitRules || {},
        riskParams: riskParams || {}
      });
      
      return res.status(201).json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('[BotRoutes] Error creating config:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * Update a bot configuration
   * PUT /api/bot/configs/:id
   * Body: { name?, strategy?, symbol?, entryRules?, exitRules?, riskParams?, enabled? }
   * Returns: { success, data: {...} }
   */
  router.put('/bot/configs/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const BotConfig = database.getModel('BotConfig');
      const config = await BotConfig.findByPk(id);
      
      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'Configuration not found'
        });
      }
      
      // Check if config is in use by any running bot
      const bots = botManager.getAllBots();
      const inUse = bots.some(bot => bot.config && bot.config.id === id && bot.isRunning);
      
      if (inUse) {
        return res.status(400).json({
          success: false,
          error: 'Cannot update configuration while it is in use by a running bot'
        });
      }
      
      await config.update(updates);
      
      return res.json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('[BotRoutes] Error updating config:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * Delete a bot configuration
   * DELETE /api/bot/configs/:id
   * Returns: { success, message }
   */
  router.delete('/bot/configs/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const BotConfig = database.getModel('BotConfig');
      const config = await BotConfig.findByPk(id);
      
      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'Configuration not found'
        });
      }
      
      // Check if config is in use by any running bot
      const bots = botManager.getAllBots();
      const inUse = bots.some(bot => bot.config && bot.config.id === id && bot.isRunning);
      
      if (inUse) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete configuration while it is in use by a running bot'
        });
      }
      
      await config.destroy();
      
      return res.json({
        success: true,
        message: 'Configuration deleted successfully'
      });
    } catch (error) {
      console.error('[BotRoutes] Error deleting config:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  return router;
};
