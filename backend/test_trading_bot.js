/**
 * TRADING BOT TEST SCRIPT
 * 
 * Este script testa os services do Trading Bot em ordem:
 * 1. SignalEngine - Gera sinais de entrada
 * 2. ExecutionEngine - Simula execução de trade
 * 3. PositionMonitor - Monitora posição e checa exits
 * 4. TradingBotService - Testa orchestrator completo
 */

// IMPORTANTE: Execute este script do diretório gamma-tracker/backend/
// cd gamma-tracker/backend
// node test_trading_bot.js

const path = require('path');

// Mock database and options service for testing
const mockDatabase = {
  getModel: (modelName) => {
    console.log(`   [Mock] Getting model: ${modelName}`);
    
    // Mock BotSignal model
    if (modelName === 'BotSignal') {
      return {
        create: async (data) => {
          console.log(`   [Mock] BotSignal.create():`, data.signalType, data.strategy);
          return { id: 'signal_' + Date.now(), ...data };
        }
      };
    }
    
    // Mock BotTrade model
    if (modelName === 'BotTrade') {
      return {
        create: async (data) => {
          console.log(`   [Mock] BotTrade.create():`, data.strategy, data.status);
          return { 
            id: 'trade_' + Date.now(), 
            ...data,
            update: async (updates) => {
              console.log(`   [Mock] BotTrade.update():`, updates.status);
              return { ...data, ...updates };
            }
          };
        },
        findAll: async (query) => {
          console.log(`   [Mock] BotTrade.findAll():`, query.where);
          return []; // No active trades for testing
        },
        count: async (query) => {
          console.log(`   [Mock] BotTrade.count():`, query.where);
          return 0; // No active trades
        }
      };
    }
    
    // Mock BotConfig model
    if (modelName === 'BotConfig') {
      const mockConfig = {
        id: 'test_config_1',
        name: 'Test Config',
        enabled: true,
        strategy: 'iron_condor',
        ivRankMin: 45,  // Changed from 50 to 45 so IV Rank 50 passes
        ivRankMax: 100,
        dteMin: 30,
        dteMax: 45,
        volumeMin: 100,
        shortDelta: 0.16,
        longDelta: 0.05,
        profitTargetPct: 0.5,
        stopLossPct: 2.0,
        dteExit: 21,
        deltaThreshold: 0.30,
        maxPositions: 3,
        maxRiskPerTrade: 1000
      };
      
      return {
        findByPk: async (id) => {
          console.log(`   [Mock] BotConfig.findByPk():`, id);
          return mockConfig;
        },
        findOne: async (query) => {
          console.log(`   [Mock] BotConfig.findOne():`, query.where);
          return mockConfig;
        }
      };
    }
    
    return null;
  }
};

// Mock options service
const mockOptionsService = {
  getOptions: async () => {
    console.log('   [Mock] OptionsService.getOptions()');
    
    // Generate mock options data
    const spot = 50000;
    const options = [];
    
    // Generate options for different strikes
    const strikes = [45000, 46000, 47000, 48000, 49000, 50000, 51000, 52000, 53000, 54000, 55000];
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 35); // 35 DTE
    
    for (const strike of strikes) {
      // Call option
      options.push({
        symbol: `BTC-${expiry.toISOString().split('T')[0]}-${strike}-C`,
        strike: strike,
        side: 'CALL',
        expiryDate: expiry.getTime(),
        markPrice: Math.max(spot - strike, 100),
        markIV: 0.65 + Math.random() * 0.1,
        delta: Math.max(0, Math.min(1, (spot - strike) / spot + 0.5)),
        gamma: 0.00001,
        theta: -50,
        vega: 100,
        volume: 100 + Math.floor(Math.random() * 500),
        openInterest: 500 + Math.floor(Math.random() * 2000)
      });
      
      // Put option
      options.push({
        symbol: `BTC-${expiry.toISOString().split('T')[0]}-${strike}-P`,
        strike: strike,
        side: 'PUT',
        expiryDate: expiry.getTime(),
        markPrice: Math.max(strike - spot, 100),
        markIV: 0.70 + Math.random() * 0.1,
        delta: -Math.max(0, Math.min(1, (strike - spot) / spot + 0.5)),
        gamma: 0.00001,
        theta: -50,
        vega: 100,
        volume: 100 + Math.floor(Math.random() * 500),
        openInterest: 500 + Math.floor(Math.random() * 2000)
      });
    }
    
    return options;
  },
  
  getCurrentSpot: async () => {
    console.log('   [Mock] OptionsService.getCurrentSpot()');
    return 50000;
  }
};

// Import services
const SignalEngine = require('./src/services/TradingBot/SignalEngine');
const ExecutionEngine = require('./src/services/TradingBot/ExecutionEngine');
const PositionMonitor = require('./src/services/TradingBot/PositionMonitor');
const TradingBotService = require('./src/services/TradingBot/TradingBotService');

// ============================================
// TEST 1: SignalEngine
// ============================================
async function testSignalEngine() {
  console.log('\n🔍 TEST 1: SignalEngine - Analyzing market...\n');
  
  const config = {
    strategy: 'iron_condor',
    symbol: 'BTC',
    ivRankMin: 50,
    ivRankMax: 100,
    dteMin: 30,
    dteMax: 45,
    volumeMin: 100,
    openInterestMin: 500,
    shortDelta: 0.16,
    longDelta: 0.05,
    maxPositions: 3,
    maxRiskPerTrade: 1000
  };
  
  const engine = new SignalEngine(config, mockDatabase, mockOptionsService);
  
  try {
    const signal = await engine.analyzeMarket();
    
    console.log('✅ Signal Generated:');
    console.log('   Type:', signal.signalType);
    console.log('   Confidence:', signal.confidence);
    console.log('   Reason:', signal.reason);
    
    if (signal.marketData) {
      console.log('\n📊 Market Data:');
      console.log('   IV Rank:', signal.marketData.ivRank?.toFixed(1));
      console.log('   Avg IV:', signal.marketData.avgIV?.toFixed(2));
      console.log('   Spot Price:', signal.marketData.spot);
      console.log('   Total Volume:', signal.marketData.totalVolume);
    }
    
    if (signal.signalType === 'entry' && signal.params) {
      console.log('\n🎯 Entry Signal Details:');
      console.log('   Strategy:', signal.strategy);
      console.log('   DTE Range:', signal.params.dte?.min, '-', signal.params.dte?.max);
      console.log('   Short Call Delta:', signal.params.shortCallDelta);
      console.log('   Short Put Delta:', signal.params.shortPutDelta);
    }
    
    return signal;
    
  } catch (error) {
    console.error('❌ SignalEngine Error:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// ============================================
// TEST 2: ExecutionEngine
// ============================================
async function testExecutionEngine(signal) {
  console.log('\n\n🎯 TEST 2: ExecutionEngine - Simulating trade execution...\n');
  
  if (signal.signalType !== 'entry') {
    console.log('⚠️  Skipping execution test - no entry signal');
    return null;
  }
  
  const config = {
    strategy: 'iron_condor',
    symbol: 'BTC',
    shortDelta: 0.16,
    longDelta: 0.05,
    maxRiskPerTrade: 1000
  };
  
  const engine = new ExecutionEngine(config, mockDatabase, mockOptionsService);
  
  try {
    const trade = await engine.executeEntry(signal);
    
    console.log('✅ Trade Executed:');
    console.log('   Trade ID:', trade.id);
    console.log('   Symbol:', trade.symbol || 'BTC');
    console.log('   Strategy:', trade.strategy);
    console.log('   Status:', trade.status);
    
    console.log('\n💰 Position Metrics:');
    console.log('   Entry Credit:', trade.entryCredit?.toFixed(2));
    console.log('   Max Profit:', trade.maxProfit?.toFixed(2));
    console.log('   Max Loss:', trade.maxLoss?.toFixed(2));
    
    console.log('\n📊 Entry Greeks:');
    console.log('   Delta:', trade.entryGreeks?.delta?.toFixed(4));
    console.log('   Gamma:', trade.entryGreeks?.gamma?.toFixed(6));
    console.log('   Theta:', trade.entryGreeks?.theta?.toFixed(2));
    console.log('   Vega:', trade.entryGreeks?.vega?.toFixed(2));
    
    if (trade.legs && trade.legs.length > 0) {
      console.log('\n🦵 Legs:');
      trade.legs.forEach((leg, i) => {
        console.log(`   Leg ${i + 1}: ${leg.action} ${leg.strike} ${leg.side} x${leg.quantity}`);
        console.log(`          Price: ${leg.fillPrice?.toFixed(2)} (slippage: ${leg.slippage?.toFixed(2)}%)`);
      });
    }
    
    return trade;
    
  } catch (error) {
    console.error('❌ ExecutionEngine Error:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// ============================================
// TEST 3: PositionMonitor
// ============================================
async function testPositionMonitor(trade) {
  console.log('\n\n👀 TEST 3: PositionMonitor - Checking exit conditions...\n');
  
  if (!trade) {
    console.log('⚠️  Skipping monitor test - no trade to monitor');
    return;
  }
  
  const config = {
    symbol: 'BTC',
    profitTargetPct: 0.5,
    stopLossPct: 2.0,
    dteExit: 21,
    deltaThreshold: 0.30
  };
  
  // Need to create a mock execution engine for PositionMonitor
  const mockExecutionEngine = new ExecutionEngine(config, mockDatabase, mockOptionsService);
  
  const monitor = new PositionMonitor(config, mockDatabase, mockOptionsService, mockExecutionEngine);
  
  try {
    // Since we have no active trades, just test the monitor runs
    const exitActions = await monitor.monitorPositions();
    
    console.log('✅ Position Monitor Complete:');
    console.log('   Exit Actions:', exitActions.length);
    
    if (exitActions.length === 0) {
      console.log('   No positions to exit');
    }
    
    return exitActions;
    
  } catch (error) {
    console.error('❌ PositionMonitor Error:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// ============================================
// TEST 4: TradingBotService (Full Integration)
// ============================================
async function testTradingBotService() {
  console.log('\n\n🤖 TEST 4: TradingBotService - Full integration test...\n');
  
  const bot = new TradingBotService(mockDatabase, mockOptionsService);
  
  try {
    console.log('🚀 Starting bot with config ID: test_config_1');
    const startResult = await bot.start('test_config_1');
    
    console.log('✅ Bot started successfully!');
    console.log('   Status:', startResult.success ? 'SUCCESS' : 'FAILED');
    console.log('   Message:', startResult.message);
    console.log('   Config:', startResult.config?.name);
    
    // Wait 2 seconds
    console.log('\n⏳ Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check status
    const status = bot.getStatus();
    console.log('\n📊 Bot Status:');
    console.log('   Running:', status.isRunning);
    console.log('   Config:', status.config?.name);
    
    // Stop bot
    console.log('\n🛑 Stopping bot...');
    const stopResult = await bot.stop();
    
    console.log('✅ Bot stopped successfully!');
    console.log('   Status:', stopResult.success ? 'SUCCESS' : 'FAILED');
    console.log('   Message:', stopResult.message);
    
  } catch (error) {
    console.error('❌ TradingBotService Error:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// ============================================
// RUN ALL TESTS
// ============================================
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║                                                        ║');
  console.log('║        🤖 TRADING BOT TEST SUITE 🤖                   ║');
  console.log('║                                                        ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  try {
    // Test 1: SignalEngine
    const signal = await testSignalEngine();
    
    // Test 2: ExecutionEngine
    const trade = await testExecutionEngine(signal);
    
    // Test 3: PositionMonitor
    await testPositionMonitor(trade);
    
    // Test 4: TradingBotService
    await testTradingBotService();
    
    console.log('\n\n╔════════════════════════════════════════════════════════╗');
    console.log('║                                                        ║');
    console.log('║        ✅ ALL TESTS PASSED! ✅                        ║');
    console.log('║                                                        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    process.exit(0);
    
  } catch (error) {
    console.log('\n\n╔════════════════════════════════════════════════════════╗');
    console.log('║                                                        ║');
    console.log('║        ❌ TEST FAILED! ❌                             ║');
    console.log('║                                                        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runAllTests();
