/**
 * Migration Runner Script
 * Run this to apply the symbol column migration
 * 
 * Usage: node run-migration.js
 */

const Database = require('./src/database/Database');
const migration = require('./src/database/migrations/20260118-add-symbol-to-bot-configs');

async function runMigration() {
  console.log('🔧 Starting migration: Add symbol to bot_configs...');
  
  try {
    // Initialize database
    const database = new Database();
    await database.connect();  // ← FIXED: use connect() not initialize()
    
    console.log('✅ Database connected');
    
    // Get Sequelize instance
    const sequelize = database.sequelize;
    const queryInterface = sequelize.getQueryInterface();
    
    // Run migration
    console.log('📝 Running UP migration...');
    await migration.up(queryInterface, sequelize.Sequelize);
    
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log('  - Added "symbol" column to bot_configs table');
    console.log('  - Set default value "BTC-USDT" for existing rows');
    console.log('  - Added index on symbol column');
    console.log('');
    console.log('🚀 You can now restart the backend and bots will auto-restart correctly!');
    
    // Close connection
    await sequelize.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
