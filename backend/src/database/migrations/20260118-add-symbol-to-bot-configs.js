/**
 * Migration: Add symbol column to bot_configs table
 * Date: 2026-01-18
 * 
 * PROBLEM:
 * - BotConfig model was missing 'symbol' field
 * - SignalEngine constructor tried to access config.symbol
 * - Result: TypeError during bot auto-restart
 * 
 * SOLUTION:
 * - Add 'symbol' column to bot_configs table
 * - Set NOT NULL with default value for existing rows
 * - Update existing rows to have proper symbol values
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add symbol column (allow NULL temporarily for existing rows)
    await queryInterface.addColumn('bot_configs', 'symbol', {
      type: Sequelize.STRING(20),
      allowNull: true,  // Temporarily allow NULL
      comment: 'Trading pair symbol (e.g., BTC-USDT, ETH-USDT)'
    });
    
    // Update existing rows to have a default symbol
    // (You may need to adjust this based on your actual data)
    await queryInterface.sequelize.query(`
      UPDATE bot_configs 
      SET symbol = 'BTC-USDT' 
      WHERE symbol IS NULL
    `);
    
    // Now make it NOT NULL
    await queryInterface.changeColumn('bot_configs', 'symbol', {
      type: Sequelize.STRING(20),
      allowNull: false,
      comment: 'Trading pair symbol (e.g., BTC-USDT, ETH-USDT)'
    });
    
    // Add index for symbol lookups
    await queryInterface.addIndex('bot_configs', ['symbol'], {
      name: 'idx_bot_configs_symbol'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove index
    await queryInterface.removeIndex('bot_configs', 'idx_bot_configs_symbol');
    
    // Remove column
    await queryInterface.removeColumn('bot_configs', 'symbol');
  }
};
