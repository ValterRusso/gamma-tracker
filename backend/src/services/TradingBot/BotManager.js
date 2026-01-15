const Logger = require('../../utils/logger');
const TradingBotService = require('./TradingBotService');

/**
 * Bot Manager
 * Manages multiple concurrent trading bot instances
 * Inspired by Beholder's BRAIN architecture but adapted for independent bot loops
 */
class BotManager {
  constructor(database, optionsService) {
    this.db = database;
    this.optionsService = optionsService;
    this.logger = new Logger('BotManager');
    
    // Bot instances map: { botId: TradingBotService }
    this.BOTS = {};
    
    // Bot locks to prevent race conditions: { botId: boolean }
    this.BOT_LOCK = {};
    
    // Bot index for quick lookups: { symbol: [botIds] }
    this.BOT_INDEX = {};
    
    this.logger.info('[BotManager] Bot Manager initialized');
  }

  /**
   * Generate unique bot ID
   * Format: {strategy}_{timestamp}_{random}
   * Example: iron_condor_1705267200_a3f9
   */
  generateBotId(config) {
    const timestamp = Math.floor(Date.now() / 1000);
    const random = Math.random().toString(36).substr(2, 4);
    return `${config.strategy}_${timestamp}_${random}`;
  }

  /**
   * Set lock status for a bot
   */
  setLocked(botId, value) {
    this.BOT_LOCK[botId] = value;
  }

  /**
   * Check if bot is locked
   */
  isLocked(botId) {
    return this.BOT_LOCK[botId] === true;
  }

  /**
   * Update bot index (for quick lookups by symbol)
   */
  updateBotIndex(symbol, botId) {
    if (!this.BOT_INDEX[symbol]) {
      this.BOT_INDEX[symbol] = [];
    }
    if (!this.BOT_INDEX[symbol].includes(botId)) {
      this.BOT_INDEX[symbol].push(botId);
    }
  }

  /**
   * Delete bot from index
   */
  deleteBotIndex(symbol, botId) {
    if (this.BOT_INDEX[symbol]) {
      this.BOT_INDEX[symbol] = this.BOT_INDEX[symbol].filter(id => id !== botId);
      if (this.BOT_INDEX[symbol].length === 0) {
        delete this.BOT_INDEX[symbol];
      }
    }
  }

  /**
   * Start a new bot instance
   * @param {string} configId - Bot configuration ID
   * @returns {Object} { success, botId, config }
   */
  async startBot(configId) {
    try {
      // Load configuration
      const { BotConfig } = this.db;
      const config = await BotConfig.findByPk(configId);
      
      if (!config) {
        throw new Error(`Configuration not found: ${configId}`);
      }
      
      if (!config.enabled) {
        throw new Error(`Configuration is disabled: ${config.name}`);
      }
      
      // Generate unique bot ID
      const botId = this.generateBotId(config);
      
      // Check if bot with same config is already running
      const existingBot = Object.values(this.BOTS).find(
        bot => bot.config && bot.config.id === configId && bot.isRunning
      );
      
      if (existingBot) {
        this.logger.warn(`[BotManager] Bot with config ${config.name} is already running: ${existingBot.botId}`);
        return {
          success: false,
          message: `Bot with config "${config.name}" is already running`,
          botId: existingBot.botId
        };
      }
      
      this.logger.info(`[BotManager] Starting bot ${botId} with config: ${config.name}`);
      
      // Create bot instance
      const bot = new TradingBotService(botId, this.db, this.optionsService);
      
      // Set lock
      this.setLocked(botId, true);
      
      try {
        // Start bot
        const result = await bot.start(configId);
        
        if (result.success) {
          // Store bot instance
          this.BOTS[botId] = bot;
          
          // Update index
          this.updateBotIndex(config.symbol, botId);
          
          this.logger.info(`[BotManager] Bot ${botId} started successfully`);
          
          return {
            success: true,
            botId,
            message: `Bot started: ${config.name}`,
            config: result.config
          };
        } else {
          throw new Error(result.message || 'Failed to start bot');
        }
      } finally {
        this.setLocked(botId, false);
      }
    } catch (error) {
      this.logger.error('[BotManager] Error starting bot:', error);
      throw error;
    }
  }

  /**
   * Stop a bot instance
   * @param {string} botId - Bot instance ID
   * @returns {Object} { success, message }
   */
  async stopBot(botId) {
    try {
      const bot = this.BOTS[botId];
      
      if (!bot) {
        this.logger.warn(`[BotManager] Bot not found: ${botId}`);
        return {
          success: false,
          message: `Bot not found: ${botId}`
        };
      }
      
      if (!bot.isRunning) {
        this.logger.warn(`[BotManager] Bot is not running: ${botId}`);
        return {
          success: false,
          message: `Bot is not running: ${botId}`
        };
      }
      
      this.logger.info(`[BotManager] Stopping bot ${botId}`);
      
      // Set lock
      this.setLocked(botId, true);
      
      try {
        // Stop bot
        const result = await bot.stop();
        
        // Remove from index
        if (bot.config) {
          this.deleteBotIndex(bot.config.symbol, botId);
        }
        
        // Remove from bots map
        delete this.BOTS[botId];
        
        // Remove lock
        delete this.BOT_LOCK[botId];
        
        this.logger.info(`[BotManager] Bot ${botId} stopped successfully`);
        
        return {
          success: true,
          message: `Bot stopped: ${botId}`,
          botId
        };
      } catch (error) {
        this.setLocked(botId, false);
        throw error;
      }
    } catch (error) {
      this.logger.error('[BotManager] Error stopping bot:', error);
      throw error;
    }
  }

  /**
   * Stop all running bots
   * @returns {Object} { success, stoppedCount }
   */
  async stopAll() {
    try {
      this.logger.info('[BotManager] Stopping all bots...');
      
      const botIds = Object.keys(this.BOTS);
      let stoppedCount = 0;
      
      for (const botId of botIds) {
        try {
          const result = await this.stopBot(botId);
          if (result.success) {
            stoppedCount++;
          }
        } catch (error) {
          this.logger.error(`[BotManager] Error stopping bot ${botId}:`, error);
        }
      }
      
      this.logger.info(`[BotManager] Stopped ${stoppedCount} bots`);
      
      return {
        success: true,
        stoppedCount,
        message: `Stopped ${stoppedCount} bot(s)`
      };
    } catch (error) {
      this.logger.error('[BotManager] Error stopping all bots:', error);
      throw error;
    }
  }

  /**
   * Get a specific bot instance
   * @param {string} botId - Bot instance ID
   * @returns {TradingBotService|null}
   */
  getBot(botId) {
    return this.BOTS[botId] || null;
  }

  /**
   * Get all bot instances
   * @returns {Array<TradingBotService>}
   */
  getAllBots() {
    return Object.values(this.BOTS);
  }

  /**
   * Get bots by symbol
   * @param {string} symbol - Trading symbol
   * @returns {Array<TradingBotService>}
   */
  getBotsBySymbol(symbol) {
    const botIds = this.BOT_INDEX[symbol] || [];
    return botIds.map(id => this.BOTS[id]).filter(bot => bot);
  }

  /**
   * Get status of all bots
   * @returns {Array<Object>}
   */
  getStatus() {
    return Object.entries(this.BOTS).map(([botId, bot]) => ({
      botId,
      isRunning: bot.isRunning,
      config: bot.config ? {
        id: bot.config.id,
        name: bot.config.name,
        strategy: bot.config.strategy,
        symbol: bot.config.symbol
      } : null,
      uptime: bot.getUptime(),
      startTime: bot.startTime
    }));
  }

  /**
   * Get status of a specific bot
   * @param {string} botId - Bot instance ID
   * @returns {Object|null}
   */
  getBotStatus(botId) {
    const bot = this.BOTS[botId];
    if (!bot) return null;
    
    return {
      botId,
      isRunning: bot.isRunning,
      config: bot.config ? {
        id: bot.config.id,
        name: bot.config.name,
        strategy: bot.config.strategy,
        symbol: bot.config.symbol,
        entryRules: bot.config.entryRules,
        exitRules: bot.config.exitRules,
        riskParams: bot.config.riskParams
      } : null,
      uptime: bot.getUptime(),
      startTime: bot.startTime
    };
  }

  /**
   * Get count of running bots
   * @returns {number}
   */
  getRunningCount() {
    return Object.values(this.BOTS).filter(bot => bot.isRunning).length;
  }

  /**
   * Check if any bot is running
   * @returns {boolean}
   */
  hasRunningBots() {
    return this.getRunningCount() > 0;
  }
}

module.exports = BotManager;
