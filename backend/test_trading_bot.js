/**
 * TRADING BOT TEST SCRIPT
 * 
 * Este script testa os services do Trading Bot em ordem:
 * 1. SignalEngine - Gera sinais de entrada
 * 2. ExecutionEngine - Simula execução de trade
 * 3. PositionMonitor - Monitora posição e checa exits
 * 4. TradingBotService - Testa orchestrator completo
 */

// IMPORTANTE: Execute este script no diretório backend/
// node ../test-bot.js

// const path = require('path');

// Ajusta path para importar do backend
// process.chdir(path.join(__dirname, 'gamma-tracker', 'backend'));

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
    dteMin: 30,
    dteMax: 45,
    volumeMin: 100,
    openInterestMin: 500,
    shortDelta: 0.16,
    longDelta: 0.05,
    maxPositions: 3,
    maxRiskPerTrade: 1000
  };
  
  const engine = new SignalEngine(config);
  
  try {
    const signal = await engine.analyzeMarket();
    
    console.log('✅ Signal Generated:');
    console.log('   Type:', signal.type);
    console.log('   Confidence:', signal.confidence);
    console.log('   Reason:', signal.reason);
    
    if (signal.data) {
      console.log('\n📊 Market Data:');
      console.log('   IV Rank:', signal.data.ivRank);
      console.log('   Current IV:', signal.data.currentIV);
      console.log('   Spot Price:', signal.data.spotPrice);
      console.log('   Available Expirations:', signal.data.expirations?.length || 0);
    }
    
    if (signal.type === 'entry') {
      console.log('\n🎯 Entry Signal Details:');
      console.log('   Expiration:', signal.data.expiration);
      console.log('   DTE:', signal.data.dte);
      console.log('   Strategy:', signal.data.strategy);
    }
    
    return signal;
    
  } catch (error) {
    console.error('❌ SignalEngine Error:', error.message);
    throw error;
  }
}

// ============================================
// TEST 2: ExecutionEngine
// ============================================
async function testExecutionEngine(signal) {
  console.log('\n\n🎯 TEST 2: ExecutionEngine - Simulating trade execution...\n');
  
  if (signal.type !== 'entry') {
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
  
  const engine = new ExecutionEngine(config);
  
  try {
    const trade = await engine.executeEntry(signal);
    
    console.log('✅ Trade Executed:');
    console.log('   Trade ID:', trade.id);
    console.log('   Symbol:', trade.symbol);
    console.log('   Strategy:', trade.strategy);
    console.log('   Status:', trade.status);
    
    console.log('\n💰 Position Metrics:');
    console.log('   Entry Cost:', trade.entryCost.toFixed(2));
    console.log('   Max Profit:', trade.maxProfit.toFixed(2));
    console.log('   Max Loss:', trade.maxLoss.toFixed(2));
    console.log('   Profit Target:', trade.profitTarget.toFixed(2));
    console.log('   Stop Loss:', trade.stopLoss.toFixed(2));
    
    console.log('\n📊 Greeks:');
    console.log('   Delta:', trade.entryGreeks.delta.toFixed(4));
    console.log('   Gamma:', trade.entryGreeks.gamma.toFixed(4));
    console.log('   Theta:', trade.entryGreeks.theta.toFixed(4));
    console.log('   Vega:', trade.entryGreeks.vega.toFixed(4));
    
    console.log('\n🦵 Legs:');
    trade.legs.forEach((leg, i) => {
      console.log(`   Leg ${i + 1}: ${leg.type} ${leg.strike} ${leg.optionType.toUpperCase()} x${leg.quantity}`);
      console.log(`          Fill: ${leg.fillPrice.toFixed(2)} (slippage: ${leg.slippage.toFixed(2)}%)`);
    });
    
    return trade;
    
  } catch (error) {
    console.error('❌ ExecutionEngine Error:', error.message);
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
  
  const monitor = new PositionMonitor(config);
  
  try {
    const result = await monitor.checkPosition(trade);
    
    console.log('✅ Position Check Complete:');
    console.log('   Should Exit:', result.shouldExit);
    console.log('   Exit Reason:', result.reason);
    
    console.log('\n📈 Current Metrics:');
    console.log('   Current P&L:', result.currentPnL.toFixed(2));
    console.log('   P&L %:', result.pnlPercent.toFixed(2) + '%');
    console.log('   Days Held:', result.daysHeld);
    console.log('   DTE:', result.dte);
    
    console.log('\n📊 Current Greeks:');
    console.log('   Delta:', result.currentGreeks.delta.toFixed(4));
    console.log('   Gamma:', result.currentGreeks.gamma.toFixed(4));
    console.log('   Theta:', result.currentGreeks.theta.toFixed(4));
    console.log('   Vega:', result.currentGreeks.vega.toFixed(4));
    
    if (result.shouldExit) {
      console.log('\n🚪 EXIT TRIGGERED!');
      console.log('   Reason:', result.reason);
    } else {
      console.log('\n✋ HOLD POSITION');
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ PositionMonitor Error:', error.message);
    throw error;
  }
}

// ============================================
// TEST 4: TradingBotService (Full Integration)
// ============================================
async function testTradingBotService() {
  console.log('\n\n🤖 TEST 4: TradingBotService - Full integration test...\n');
  
  const config = {
    strategy: 'iron_condor',
    symbol: 'BTC',
    ivRankMin: 50,
    dteMin: 30,
    dteMax: 45,
    volumeMin: 100,
    openInterestMin: 500,
    shortDelta: 0.16,
    longDelta: 0.05,
    profitTargetPct: 0.5,
    stopLossPct: 2.0,
    dteExit: 21,
    deltaThreshold: 0.30,
    maxPositions: 3,
    maxRiskPerTrade: 1000,
    updateInterval: 60000
  };
  
  const bot = new TradingBotService(config);
  
  try {
    console.log('🚀 Starting bot...');
    await bot.start();
    
    console.log('✅ Bot started successfully!');
    console.log('   Status:', bot.isRunning ? 'RUNNING' : 'STOPPED');
    console.log('   Config:', bot.config.strategy);
    
    // Wait 5 seconds to see one iteration
    console.log('\n⏳ Waiting 5 seconds for first iteration...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Stop bot
    console.log('\n🛑 Stopping bot...');
    await bot.stop();
    
    console.log('✅ Bot stopped successfully!');
    
    // Get performance metrics
    const performance = await bot.getPerformance();
    console.log('\n📊 Performance Metrics:');
    console.log('   Total Trades:', performance.totalTrades);
    console.log('   Open Positions:', performance.openPositions);
    console.log('   Win Rate:', (performance.winRate * 100).toFixed(2) + '%');
    console.log('   Total P&L:', performance.totalPnL.toFixed(2));
    
  } catch (error) {
    console.error('❌ TradingBotService Error:', error.message);
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
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();