const express = require('express');
const Logger = require('../../utils/logger');
const logger = new Logger('BotRoutes');

// Import TradingBotService
const TradingBotService = require('../../services/TradingBot/TradingBotService');

// Bot service instance (singleton)
let botServiceInstance = null;

/**
 * Initialize bot service instance
 */
function getBotService(database, optionsService) {
  if (!botServiceInstance) {
    botServiceInstance = new TradingBotService(database, optionsService);
  }
  return botServiceInstance;
}

module.exports = (dependencies) => {
  const router = express.Router();
  const { database, optionsService } = dependencies;
  
  // Helper to get bot service
  const getBot = () => getBotService(database, optionsService);

  // ============================================
  // BOT CONTROL ROUTES
  // ============================================

  /**
   * POST /api/bot/start
   * Start the trading bot with a specific configuration
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
      
      const botService = getBot();
      const result = await botService.start(configId);
      
      logger.info(`[BotRoutes] Bot start requested: ${configId}`);
      
      res.json(result);
    } catch (error) {
      logger.error('[BotRoutes] Error starting bot:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/bot/stop
   * Stop the trading bot
   */
  router.post('/bot/stop', async (req, res) => {
    try {
      const botService = getBot();
      const result = await botService.stop();
      
      logger.info('[BotRoutes] Bot stop requested');
      
      res.json(result);
    } catch (error) {
      logger.error('[BotRoutes] Error stopping bot:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/bot/status
   * Get current bot status
   */
  router.get('/bot/status', async (req, res) => {
    try {
      const botService = getBot();
      const status = botService.getStatus();
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('[BotRoutes] Error getting bot status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ============================================
  // BOT DATA ROUTES
  // ============================================

  /**
   * GET /api/bot/trades
   * Get trades with optional filters
   */
  router.get('/bot/trades', async (req, res) => {
    try {
      const {
        status = 'all',
        limit = 50,
        offset = 0,
        sortBy = 'entryTime',
        sortOrder = 'DESC'
      } = req.query;
      
      const BotTrade = database.getModel('BotTrade');
      
      // Build query
      const where = {};
      if (status !== 'all') {
        where.status = status;
      }
      
      const trades = await BotTrade.findAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [[sortBy, sortOrder]]
      });
      
      // Get total count
      const totalCount = await BotTrade.count({ where });
      
      res.json({
        success: true,
        data: {
          trades,
          pagination: {
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: totalCount > parseInt(offset) + parseInt(limit)
          }
        }
      });
    } catch (error) {
      logger.error('[BotRoutes] Error getting trades:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/bot/trades/:id
   * Get trade details by ID
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
      
      res.json({
        success: true,
        data: trade
      });
    } catch (error) {
      logger.error('[BotRoutes] Error getting trade:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/bot/signals
   * Get signal history
   */
  router.get('/bot/signals', async (req, res) => {
    try {
      const {
        signalType = 'all',
        limit = 100,
        offset = 0
      } = req.query;
      
      const BotSignal = database.getModel('BotSignal');
      
      // Build query
      const where = {};
      if (signalType !== 'all') {
        where.signalType = signalType;
      }
      
      const signals = await BotSignal.findAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['timestamp', 'DESC']]
      });
      
      const totalCount = await BotSignal.count({ where });
      
      res.json({
        success: true,
        data: {
          signals,
          pagination: {
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: totalCount > parseInt(offset) + parseInt(limit)
          }
        }
      });
    } catch (error) {
      logger.error('[BotRoutes] Error getting signals:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/bot/performance
   * Get bot performance metrics
   */
  router.get('/bot/performance', async (req, res) => {
    try {
      const { period = 'all' } = req.query;
      
      const BotTrade = database.getModel('BotTrade');
      
      // Calculate date filter
      let dateFilter = {};
      if (period !== 'all') {
        const now = new Date();
        const startDate = new Date();
        
        switch (period) {
          case 'day':
            startDate.setDate(now.getDate() - 1);
            break;
          case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
        }
        
        dateFilter = {
          entryTime: {
            [require('sequelize').Op.gte]: startDate
          }
        };
      }
      
      // Get all closed trades in period
      const closedTrades = await BotTrade.findAll({
        where: {
          status: 'closed',
          ...dateFilter
        }
      });
      
      // Get active trades
      const activeTrades = await BotTrade.findAll({
        where: { status: 'active' }
      });
      
      // Calculate metrics
      const totalTrades = closedTrades.length;
      const winningTrades = closedTrades.filter(t => t.realizedPnl > 0).length;
      const losingTrades = closedTrades.filter(t => t.realizedPnl < 0).length;
      const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;
      
      const totalPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
      const avgPnl = totalTrades > 0 ? totalPnl / totalTrades : 0;
      
      const avgWin = winningTrades > 0
        ? closedTrades.filter(t => t.realizedPnl > 0).reduce((sum, t) => sum + t.realizedPnl, 0) / winningTrades
        : 0;
      
      const avgLoss = losingTrades > 0
        ? closedTrades.filter(t => t.realizedPnl < 0).reduce((sum, t) => sum + t.realizedPnl, 0) / losingTrades
        : 0;
      
      const profitFactor = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : 0;
      
      // Calculate max drawdown
      let runningPnl = 0;
      let peak = 0;
      let maxDrawdown = 0;
      
      for (const trade of closedTrades) {
        runningPnl += trade.realizedPnl || 0;
        if (runningPnl > peak) {
          peak = runningPnl;
        }
        const drawdown = peak - runningPnl;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
      
      // Calculate Sharpe ratio (simplified)
      const returns = closedTrades.map(t => t.pnlPercent || 0);
      const avgReturn = returns.length > 0
        ? returns.reduce((sum, r) => sum + r, 0) / returns.length
        : 0;
      
      const variance = returns.length > 0
        ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
        : 0;
      
      const stdDev = Math.sqrt(variance);
      const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
      
      res.json({
        success: true,
        data: {
          period,
          totalTrades,
          activeTrades: activeTrades.length,
          closedTrades: closedTrades.length,
          winningTrades,
          losingTrades,
          winRate: (winRate * 100).toFixed(2) + '%',
          totalPnl: totalPnl.toFixed(2),
          avgPnl: avgPnl.toFixed(2),
          avgWin: avgWin.toFixed(2),
          avgLoss: avgLoss.toFixed(2),
          profitFactor: profitFactor.toFixed(2),
          maxDrawdown: maxDrawdown.toFixed(2),
          sharpeRatio: sharpeRatio.toFixed(2)
        }
      });
    } catch (error) {
      logger.error('[BotRoutes] Error getting performance:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ============================================
  // BOT CONFIG ROUTES
  // ============================================

  /**
   * GET /api/bot/configs
   * Get all bot configurations
   */
  router.get('/bot/configs', async (req, res) => {
    try {
      const BotConfig = database.getModel('BotConfig');
      
      const configs = await BotConfig.findAll({
        order: [['createdAt', 'DESC']]
      });
      
      res.json({
        success: true,
        data: configs
      });
    } catch (error) {
      logger.error('[BotRoutes] Error getting configs:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/bot/configs/:id
   * Get config by ID
   */
  router.get('/bot/configs/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const BotConfig = database.getModel('BotConfig');
      
      const config = await BotConfig.findByPk(id);
      
      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'Config not found'
        });
      }
      
      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('[BotRoutes] Error getting config:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/bot/configs
   * Create new bot configuration
   */
  router.post('/bot/configs', async (req, res) => {
    try {
      const configData = req.body;
      
      // Validate required fields
      const requiredFields = ['name', 'strategy'];
      for (const field of requiredFields) {
        if (!configData[field]) {
          return res.status(400).json({
            success: false,
            error: `${field} is required`
          });
        }
      }
      
      const BotConfig = database.getModel('BotConfig');
      
      const config = await BotConfig.create(configData);
      
      logger.info(`[BotRoutes] Config created: ${config.id}`);
      
      res.status(201).json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('[BotRoutes] Error creating config:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /api/bot/configs/:id
   * Update bot configuration
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
          error: 'Config not found'
        });
      }
      
      await config.update(updates);
      
      logger.info(`[BotRoutes] Config updated: ${id}`);
      
      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('[BotRoutes] Error updating config:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/bot/configs/:id
   * Delete bot configuration
   */
  router.delete('/bot/configs/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const BotConfig = database.getModel('BotConfig');
      
      const config = await BotConfig.findByPk(id);
      
      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'Config not found'
        });
      }
      
      // Check if config is currently in use
      const botService = getBot();
      const status = botService.getStatus();
      
      if (status.isRunning && status.config?.id === id) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete config that is currently in use. Stop the bot first.'
        });
      }
      
      await config.destroy();
      
      logger.info(`[BotRoutes] Config deleted: ${id}`);
      
      res.json({
        success: true,
        message: 'Config deleted successfully'
      });
    } catch (error) {
      logger.error('[BotRoutes] Error deleting config:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
};
