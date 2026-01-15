/**
 * Test Script for Trading Strategies
 * Tests Iron Condor and Iron Butterfly with real market data
 */

const StrategyFactory = require('./src/services/TradingBot/strategies/StrategyFactory');
const OptionsService = require('./src/services/OptionsService');
const DataCollector = require('./src/collectors/DataCollector');

// Mock logger for testing
class TestLogger {
  info(...args) { console.log('[INFO]', ...args); }
  warn(...args) { console.warn('[WARN]', ...args); }
  error(...args) { console.error('[ERROR]', ...args); }
  success(...args) { console.log('[SUCCESS]', ...args); }
}

/**
 * Test Strategy
 */
async function testStrategy(strategyName, config = {}) {
  console.log('\n' + '='.repeat(80));
  console.log(`TESTING STRATEGY: ${strategyName.toUpperCase()}`);
  console.log('='.repeat(80) + '\n');

  try {
    // 1. Create strategy
    console.log('1. Creating strategy...');
    const strategy = StrategyFactory.create(strategyName, config);
    console.log(`✅ Strategy created: ${strategy.name}`);
    console.log(`   Type: ${strategy.type}`);
    console.log(`   Description: ${strategy.getDescription()}`);

    // 2. Validate config
    console.log('\n2. Validating configuration...');
    const validation = strategy.validateConfig();
    if (validation.valid) {
      console.log('✅ Configuration valid');
    } else {
      console.log('❌ Configuration invalid:', validation.checks);
      return;
    }

    // 3. Fetch market data
    console.log('\n3. Fetching market data...');
    const marketData = await fetchMarketData();
    console.log(`✅ Market data fetched`);
    console.log(`   Spot: $${marketData.spot.toFixed(2)}`);
    console.log(`   Options: ${marketData.options.length}`);

    // 4. Calculate indicators
    console.log('\n4. Calculating indicators...');
    const indicators = calculateIndicators(marketData);
    console.log(`✅ Indicators calculated`);
    console.log(`   IV Rank: ${indicators.ivRank.toFixed(1)}`);
    console.log(`   Avg IV: ${indicators.avgIV.toFixed(4)}`);
    console.log(`   Total Volume: ${indicators.totalVolume.toFixed(2)}`);
    console.log(`   Total OI: ${indicators.totalOI.toFixed(2)}`);
    console.log(`   ATM Options: ${indicators.atmOptions.length}`);

    // 5. Check entry conditions
    console.log('\n5. Checking entry conditions...');
    const entryOk = await strategy.checkEntry(marketData, indicators);
    if (entryOk) {
      console.log('✅ Entry conditions met');
    } else {
      console.log('❌ Entry conditions not met');
      return;
    }

    // 6. Select strikes
    console.log('\n6. Selecting strikes...');
    const selection = await strategy.selectStrikes(marketData, marketData.options);
    
    if (!selection) {
      console.log('❌ Could not find suitable strikes');
      return;
    }

    console.log('✅ Strikes selected:');
    selection.legs.forEach((leg, i) => {
      console.log(`   Leg ${i + 1}: ${leg.action} ${leg.option.side} @ $${leg.option.strike}`);
      console.log(`          Delta: ${leg.option.delta.toFixed(4)}, Price: $${(leg.option.mark_price || leg.option.bid_price).toFixed(2)}`);
    });

    console.log('\n   Greeks:');
    console.log(`   Delta: ${selection.greeks.delta.toFixed(4)}`);
    console.log(`   Gamma: ${selection.greeks.gamma.toFixed(6)}`);
    console.log(`   Theta: ${selection.greeks.theta.toFixed(2)}`);
    console.log(`   Vega: ${selection.greeks.vega.toFixed(2)}`);

    console.log('\n   Risk/Reward:');
    console.log(`   Max Profit: $${selection.maxProfit.toFixed(2)}`);
    console.log(`   Max Loss: $${selection.maxLoss.toFixed(2)}`);
    console.log(`   Risk/Reward: ${(selection.maxProfit / selection.maxLoss).toFixed(2)}`);

    console.log('\n   Break-Even:');
    console.log(`   Lower: $${selection.breakEven.lower.toFixed(2)} (${selection.breakEven.percentFromSpot.lower.toFixed(2)}% from spot)`);
    console.log(`   Upper: $${selection.breakEven.upper.toFixed(2)} (${selection.breakEven.percentFromSpot.upper.toFixed(2)}% from spot)`);
    console.log(`   Range: $${(selection.breakEven.upper - selection.breakEven.lower).toFixed(2)}`);

    // 7. Generate signal
    console.log('\n7. Generating signal...');
    const signal = await strategy.generateSignal(marketData, indicators, marketData.options);
    
    console.log(`✅ Signal generated: ${signal.signalType.toUpperCase()}`);
    console.log(`   Strategy: ${signal.strategy}`);
    console.log(`   Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
    console.log(`   Reason: ${signal.reason}`);

    if (signal.position) {
      console.log(`   Contracts: ${signal.position.contracts}`);
      console.log(`   Total Risk: $${signal.position.totalRisk.toFixed(2)}`);
      console.log(`   Risk %: ${signal.position.riskPercent.toFixed(2)}%`);
    }

    console.log('\n✅ TEST COMPLETED SUCCESSFULLY\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
  }
}

/**
 * Fetch market data (mock for now)
 */
async function fetchMarketData() {
  // TODO: Integrate with real DataCollector
  // For now, use mock data
  
  console.log('   [MOCK] Using mock market data');
  
  const spot = 95000; // BTC spot price
  
  // Generate mock options
  const options = [];
  const expiry = Date.now() + (35 * 24 * 60 * 60 * 1000); // 35 days
  
  // Generate strikes from 85k to 105k
  for (let strike = 85000; strike <= 105000; strike += 1000) {
    // Call
    const callDelta = calculateDelta(spot, strike, 'CALL');
    options.push({
      symbol: `BTC-${strike}-C`,
      strike,
      side: 'CALL',
      expiry,
      delta: callDelta,
      gamma: 0.00001,
      theta: -20,
      vega: 100,
      mark_price: calculatePrice(spot, strike, 'CALL'),
      bid_price: calculatePrice(spot, strike, 'CALL') * 0.98,
      ask_price: calculatePrice(spot, strike, 'CALL') * 1.02,
      volume: Math.random() * 10,
      open_interest: Math.random() * 100,
      impliedVolatility: 0.6 + Math.random() * 0.2
    });
    
    // Put
    const putDelta = calculateDelta(spot, strike, 'PUT');
    options.push({
      symbol: `BTC-${strike}-P`,
      strike,
      side: 'PUT',
      expiry,
      delta: putDelta,
      gamma: 0.00001,
      theta: -20,
      vega: 100,
      mark_price: calculatePrice(spot, strike, 'PUT'),
      bid_price: calculatePrice(spot, strike, 'PUT') * 0.98,
      ask_price: calculatePrice(spot, strike, 'PUT') * 1.02,
      volume: Math.random() * 10,
      open_interest: Math.random() * 100,
      impliedVolatility: 0.65 + Math.random() * 0.2
    });
  }
  
  return {
    spot,
    options,
    timestamp: new Date()
  };
}

/**
 * Calculate mock delta
 */
function calculateDelta(spot, strike, side) {
  const moneyness = spot / strike;
  
  if (side === 'CALL') {
    if (moneyness > 1.05) return 0.8;  // Deep ITM
    if (moneyness > 1.02) return 0.6;  // ITM
    if (moneyness > 0.98) return 0.5;  // ATM
    if (moneyness > 0.95) return 0.3;  // OTM
    if (moneyness > 0.90) return 0.16; // Further OTM
    return 0.05;                        // Deep OTM
  } else {
    if (moneyness < 0.95) return -0.8;  // Deep ITM
    if (moneyness < 0.98) return -0.6;  // ITM
    if (moneyness < 1.02) return -0.5;  // ATM
    if (moneyness < 1.05) return -0.3;  // OTM
    if (moneyness < 1.10) return -0.16; // Further OTM
    return -0.05;                        // Deep OTM
  }
}

/**
 * Calculate mock price
 */
function calculatePrice(spot, strike, side) {
  const intrinsic = side === 'CALL' 
    ? Math.max(0, spot - strike)
    : Math.max(0, strike - spot);
  
  const extrinsic = spot * 0.02; // 2% extrinsic value
  
  return intrinsic + extrinsic;
}

/**
 * Calculate indicators
 */
function calculateIndicators(marketData) {
  const { spot, options } = marketData;
  
  // IV Rank (mock: 75 for high IV)
  const ivRank = 75;
  
  // Average IV
  const avgIV = options.reduce((sum, opt) => sum + opt.impliedVolatility, 0) / options.length;
  
  // Total volume and OI
  const totalVolume = options.reduce((sum, opt) => sum + opt.volume, 0);
  const totalOI = options.reduce((sum, opt) => sum + opt.open_interest, 0);
  
  // ATM options
  const atmOptions = options.filter(opt => {
    const percentDiff = Math.abs(opt.strike - spot) / spot;
    return percentDiff < 0.05;
  });
  
  return {
    spot,
    ivRank,
    avgIV,
    totalVolume,
    totalOI,
    atmOptions,
    regime: 'POSITIVE_GAMMA_ABOVE_FLIP',
    timestamp: marketData.timestamp
  };
}

/**
 * Main test runner
 */
async function main() {
  console.log('\n' + '█'.repeat(80));
  console.log('TRADING STRATEGY TEST SUITE');
  console.log('█'.repeat(80));

  // Test Iron Condor
  await testStrategy('iron_condor', {
    accountBalance: 10000,
    riskPercent: 2,
    minIVRank: 60,
    maxIVRank: 100,
    minDTE: 30,
    maxDTE: 45
  });

  // Test Iron Butterfly
  await testStrategy('iron_butterfly', {
    accountBalance: 10000,
    riskPercent: 2,
    minIVRank: 70,
    maxIVRank: 100,
    minDTE: 21,
    maxDTE: 35
  });

  console.log('\n' + '█'.repeat(80));
  console.log('ALL TESTS COMPLETED');
  console.log('█'.repeat(80) + '\n');
}

// Run tests
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testStrategy, fetchMarketData, calculateIndicators };
