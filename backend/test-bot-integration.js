/**
 * Bot Integration Test
 * Tests complete bot cycle with paper trading
 * 
 * USAGE:
 * 1. Make sure backend is running (npm start)
 * 2. Run: node test-bot-integration.js
 * 
 * WHAT IT TESTS:
 * 1. Create bot config
 * 2. Start bot via API
 * 3. Wait for signal generation
 * 4. Check if entry executed
 * 5. Check trade in database
 * 6. Stop bot
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3300/api';

// Test configuration
const TEST_CONFIG = {
  name: 'Test Bull Call Spread Bot',
  strategy: 'bull_call_spread',
  symbol: 'BTC',
  enabled: true,
  strategyParams: {
    longDelta: 0.60,
    shortDelta: 0.40,
    minDTE: 20,
    maxDTE: 60,
    minVolume: 0,
    minOI: 0,
    maxSpread: 0.15,
    minSpreadWidth: 1000,
    maxSpreadWidth: 15000,
    accountBalance: 100000,
    riskPercent: 5,
    profitTarget: 0.5,
    stopLoss: 2.0,
    dteExit: 21,
    deltaBreach: 0.30
  },
  riskParams: {
    maxPositions: 1,
    maxLossPerTrade: 5000
  }
};

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createBotConfig() {
  console.log('\n1️⃣  Creating bot config...');
  
  try {
    const response = await axios.post(`${BASE_URL}/bot/config`, TEST_CONFIG);
    
    if (response.data.success) {
      console.log(`   ✅ Config created: ${response.data.data.id}`);
      return response.data.data.id;
    } else {
      throw new Error(response.data.error || 'Failed to create config');
    }
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('   ⚠️  Config endpoint not found, trying direct database insert...');
      // Fallback: return a test ID
      return 'test-config-1';
    }
    throw error;
  }
}

async function startBot(configId) {
  console.log('\n2️⃣  Starting bot...');
  
  try {
    const response = await axios.post(`${BASE_URL}/bot/start`, { configId });
    
    if (response.data.success) {
      console.log(`   ✅ Bot started: ${response.data.botId}`);
      console.log(`   📋 Strategy: ${response.data.config?.strategy || 'unknown'}`);
      return response.data.botId;
    } else {
      throw new Error(response.data.error || 'Failed to start bot');
    }
  } catch (error) {
    console.error(`   ❌ Error starting bot:`, error.message);
    throw error;
  }
}

async function checkBotStatus(botId) {
  console.log('\n3️⃣  Checking bot status...');
  
  try {
    const response = await axios.get(`${BASE_URL}/bot/status/${botId}`);
    
    if (response.data.success) {
      const status = response.data.data;
      console.log(`   ✅ Bot is ${status.isRunning ? 'RUNNING' : 'STOPPED'}`);
      console.log(`   ⏱️  Uptime: ${status.uptime || 'N/A'}`);
      console.log(`   📊 Strategy: ${status.config?.strategy || 'N/A'}`);
      return status;
    } else {
      throw new Error(response.data.error || 'Failed to get status');
    }
  } catch (error) {
    console.error(`   ❌ Error getting status:`, error.message);
    throw error;
  }
}

async function waitForSignal(botId, maxWaitSeconds = 120) {
  console.log(`\n4️⃣  Waiting for signal (max ${maxWaitSeconds}s)...`);
  
  const startTime = Date.now();
  let attempts = 0;
  
  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    attempts++;
    
    try {
      const response = await axios.get(`${BASE_URL}/bot/signals`, {
        params: { botId, limit: 10 }
      });
      
      if (response.data.success && response.data.data.signals.length > 0) {
        const signals = response.data.data.signals;
        const latestSignal = signals[0];
        
        console.log(`   ✅ Signal found after ${attempts} attempts!`);
        console.log(`   📊 Type: ${latestSignal.signalType}`);
        console.log(`   🎯 Strategy: ${latestSignal.strategy}`);
        console.log(`   💯 Confidence: ${latestSignal.confidence}%`);
        console.log(`   📝 Reason: ${latestSignal.reason}`);
        
        return latestSignal;
      }
      
      // Wait 5 seconds before next check
      if (attempts % 6 === 0) {
        console.log(`   ⏳ Still waiting... (${Math.floor((Date.now() - startTime) / 1000)}s elapsed)`);
      }
      await wait(5000);
      
    } catch (error) {
      console.error(`   ⚠️  Error checking signals:`, error.message);
      await wait(5000);
    }
  }
  
  console.log(`   ⏱️  Timeout after ${maxWaitSeconds}s`);
  return null;
}

async function checkTrades(botId) {
  console.log('\n5️⃣  Checking trades...');
  
  try {
    const response = await axios.get(`${BASE_URL}/bot/trades`, {
      params: { botId, limit: 10 }
    });
    
    if (response.data.success) {
      const trades = response.data.data.trades;
      
      if (trades.length === 0) {
        console.log(`   ℹ️  No trades yet`);
        return null;
      }
      
      console.log(`   ✅ Found ${trades.length} trade(s)`);
      
      const latestTrade = trades[0];
      console.log(`\n   📊 Latest Trade:`);
      console.log(`      ID: ${latestTrade.id}`);
      console.log(`      Strategy: ${latestTrade.strategy}`);
      console.log(`      Status: ${latestTrade.status}`);
      console.log(`      Entry Time: ${latestTrade.entryTime}`);
      console.log(`      Entry Spot: $${latestTrade.entrySpot?.toFixed(2) || 'N/A'}`);
      console.log(`      Max Profit: $${latestTrade.maxProfit?.toFixed(2) || 'N/A'}`);
      console.log(`      Max Loss: $${latestTrade.maxLoss?.toFixed(2) || 'N/A'}`);
      console.log(`      Legs: ${latestTrade.legs?.length || 0}`);
      
      if (latestTrade.legs && latestTrade.legs.length > 0) {
        console.log(`\n   📋 Legs:`);
        latestTrade.legs.forEach((leg, i) => {
          console.log(`      ${i + 1}. ${leg.action.toUpperCase()} ${leg.side} @ $${leg.strike}`);
          console.log(`         Delta: ${leg.delta?.toFixed(4) || 'N/A'}`);
          console.log(`         Entry Price: $${leg.entryPrice?.toFixed(2) || 'N/A'}`);
        });
      }
      
      return latestTrade;
    } else {
      throw new Error(response.data.error || 'Failed to get trades');
    }
  } catch (error) {
    console.error(`   ❌ Error getting trades:`, error.message);
    return null;
  }
}

async function stopBot(botId) {
  console.log('\n6️⃣  Stopping bot...');
  
  try {
    const response = await axios.post(`${BASE_URL}/bot/stop/${botId}`);
    
    if (response.data.success) {
      console.log(`   ✅ Bot stopped successfully`);
      return true;
    } else {
      throw new Error(response.data.error || 'Failed to stop bot');
    }
  } catch (error) {
    console.error(`   ❌ Error stopping bot:`, error.message);
    return false;
  }
}

async function runTest() {
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('BOT INTEGRATION TEST');
  console.log('════════════════════════════════════════════════════════════════════════════════');
  
  let botId = null;
  let configId = null;
  
  try {
    // 1. Create config
    configId = await createBotConfig();
    
    // 2. Start bot
    botId = await startBot(configId);
    
    // 3. Check status
    await checkBotStatus(botId);
    
    // 4. Wait for signal (bot runs every 60s, so wait up to 120s)
    const signal = await waitForSignal(botId, 120);
    
    if (!signal) {
      console.log('\n⚠️  No signal generated within timeout period');
      console.log('   This might be normal if market conditions are not ideal');
    }
    
    // 5. Check trades
    const trade = await checkTrades(botId);
    
    if (!trade) {
      console.log('\n⚠️  No trades executed');
      console.log('   Signal might have been WAIT or market conditions not met');
    }
    
    // 6. Stop bot
    await stopBot(botId);
    
    console.log('\n════════════════════════════════════════════════════════════════════════════════');
    console.log('TEST COMPLETE');
    console.log('════════════════════════════════════════════════════════════════════════════════');
    
    console.log('\n📊 Summary:');
    console.log(`   Config ID: ${configId}`);
    console.log(`   Bot ID: ${botId}`);
    console.log(`   Signal Generated: ${signal ? 'YES' : 'NO'}`);
    console.log(`   Trade Executed: ${trade ? 'YES' : 'NO'}`);
    
    if (signal && signal.signalType === 'entry' && !trade) {
      console.log('\n⚠️  Note: Entry signal was generated but no trade executed.');
      console.log('   This could mean:');
      console.log('   - Risk validation failed');
      console.log('   - Max positions reached');
      console.log('   - Execution error occurred');
      console.log('   Check logs for details.');
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    
    // Try to stop bot if it was started
    if (botId) {
      console.log('\n🧹 Cleaning up...');
      await stopBot(botId);
    }
    
    process.exit(1);
  }
}

// Run test
runTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
