/**
 * Test Script for Trading Strategies (REAL DATA)
 * Tests Iron Condor and Iron Butterfly with REAL market data from DataCollector
 * 
 * USAGE:
 * 1. Make sure backend is running (DataCollector collecting data)
 * 2. Run: node test-strategies-real.js
 */

const StrategyFactory = require('./src/services/TradingBot/strategies/StrategyFactory');
const DataCollector = require('./src/collectors/DataCollector');
const OptionsService = require('./src/services/OptionsService');

/**
 * Initialize DataCollector and OptionsService
 */
async function initialize() {
  console.log('\n🔧 Initializing DataCollector...');
  
  // Create DataCollector instance
  const dataCollector = new DataCollector();
  
  // Wait for initial data collection (give it a few seconds)
  console.log('⏳ Waiting for data collection (5 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Create OptionsService
  const optionsService = new OptionsService(dataCollector);
  
  console.log('✅ Initialization complete\n');
  
  return { dataCollector, optionsService };
}

/**
 * Fetch real market data
 */
async function fetchRealMarketData(optionsService) {
  try {
    console.log('📊 Fetching real market data...');
    
    // Get spot price
    const spot = await optionsService.getCurrentSpot();
    console.log(`   Spot Price: $${spot.toFixed(2)}`);
    
    // Get all options
    const optionsResult = await optionsService.getAllOptions();
    const options = optionsResult.options;
    console.log(`   Options Count: ${options.length}`);
    
    if (options.length === 0) {
      throw new Error('No options data available. Make sure DataCollector is running and collecting data.');
    }
    
    // Show sample option
    const sampleOption = options[0];
    console.log(`   Sample Option:`, {
      symbol: sampleOption.symbol,
      strike: sampleOption.strike,
      side: sampleOption.side,
      delta: sampleOption.delta?.toFixed(4),
      gamma: sampleOption.gamma?.toFixed(6),
      theta: sampleOption.theta?.toFixed(2),
      vega: sampleOption.vega?.toFixed(2),
      mark_price: sampleOption.mark_price?.toFixed(2)
    });
    
    return {
      spot,
      options,
      timestamp: new Date()
    };
    
  } catch (error) {
    console.error('❌ Error fetching market data:', error.message);
    throw error;
  }
}

/**
 * Calculate indicators from real data
 */
function calculateIndicators(marketData) {
  const { spot, options } = marketData;
  
  console.log('\n📈 Calculating indicators...');
  
  // Calculate IV Rank (simplified - using current IV range)
  const ivs = options
    .filter(opt => opt.impliedVolatility || opt.markIV)
    .map(opt => opt.impliedVolatility || opt.markIV);
  
  if (ivs.length === 0) {
    console.warn('⚠️  No IV data available');
    return null;
  }
  
  const currentIV = ivs.reduce((sum, iv) => sum + iv, 0) / ivs.length;
  const minIV = Math.min(...ivs);
  const maxIV = Math.max(...ivs);
  const ivRank = ((currentIV - minIV) / (maxIV - minIV)) * 100;
  
  console.log(`   Current IV: ${currentIV.toFixed(4)}`);
  console.log(`   IV Range: ${minIV.toFixed(4)} - ${maxIV.toFixed(4)}`);
  console.log(`   IV Rank: ${ivRank.toFixed(1)}`);
  
  // Calculate total volume and OI
  const totalVolume = options.reduce((sum, opt) => sum + (opt.volume || 0), 0);
  const totalOI = options.reduce((sum, opt) => sum + (opt.open_interest || opt.openInterest || 0), 0);
  
  console.log(`   Total Volume: ${totalVolume.toFixed(2)}`);
  console.log(`   Total OI: ${totalOI.toFixed(2)}`);
  
  // Get ATM options
  const atmOptions = options.filter(opt => {
    const percentDiff = Math.abs(opt.strike - spot) / spot;
    return percentDiff < 0.05; // Within 5% of spot
  });
  
  console.log(`   ATM Options: ${atmOptions.length}`);
  
  // Calculate Put/Call skew
  const puts = options.filter(opt => opt.side === 'PUT');
  const calls = options.filter(opt => opt.side === 'CALL');
  
  const avgPutIV = puts.length > 0
    ? puts.reduce((sum, opt) => sum + (opt.impliedVolatility || opt.markIV || 0), 0) / puts.length
    : 0;
  
  const avgCallIV = calls.length > 0
    ? calls.reduce((sum, opt) => sum + (opt.impliedVolatility || opt.markIV || 0), 0) / calls.length
    : 0;
  
  const skew = avgPutIV - avgCallIV;
  console.log(`   Put/Call IV Skew: ${skew.toFixed(4)}`);
  
  // Detect regime
  let regime = 'NEUTRAL';
  if (ivRank > 60 && totalVolume > 1000) {
    regime = 'HIGH_IV_HIGH_VOLUME';
  } else if (ivRank > 60) {
    regime = 'HIGH_IV_LOW_VOLUME';
  } else if (ivRank < 40) {
    regime = 'LOW_IV';
  }
  console.log(`   Regime: ${regime}`);
  
  return {
    spot,
    ivRank,
    avgIV: currentIV,
    skew,
    totalVolume,
    totalOI,
    atmOptions,
    regime,
    timestamp: marketData.timestamp
  };
}

/**
 * Test Strategy with real data
 */
async function testStrategy(strategyName, config, marketData, indicators) {
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

    // 3. Check entry conditions
    console.log('\n3. Checking entry conditions...');
    const entryOk = await strategy.checkEntry(marketData, indicators);
    if (entryOk) {
      console.log('✅ Entry conditions met');
    } else {
      console.log('❌ Entry conditions not met');
      console.log('   (This is normal if market conditions are not ideal for this strategy)');
      return;
    }

    // 4. Select strikes
    console.log('\n4. Selecting strikes...');
    const selection = await strategy.selectStrikes(marketData, marketData.options);
    
    if (!selection) {
      console.log('❌ Could not find suitable strikes');
      console.log('   Possible reasons:');
      console.log('   - Not enough options with required delta');
      console.log('   - Insufficient liquidity');
      console.log('   - No suitable expiry dates');
      return;
    }

    console.log('✅ Strikes selected:');
    selection.legs.forEach((leg, i) => {
      const opt = leg.option;
      console.log(`   Leg ${i + 1}: ${leg.action} ${opt.side} @ $${opt.strike}`);
      console.log(`          Delta: ${opt.delta?.toFixed(4) || 'N/A'}, ` +
                  `Gamma: ${opt.gamma?.toFixed(6) || 'N/A'}, ` +
                  `Theta: ${opt.theta?.toFixed(2) || 'N/A'}`);
      console.log(`          Price: $${(opt.mark_price || opt.bid_price || 0).toFixed(2)}, ` +
                  `Volume: ${(opt.volume || 0).toFixed(2)}, ` +
                  `OI: ${(opt.open_interest || opt.openInterest || 0).toFixed(2)}`);
    });

    console.log('\n   Position Greeks:');
    console.log(`   Delta: ${selection.greeks.delta.toFixed(4)}`);
    console.log(`   Gamma: ${selection.greeks.gamma.toFixed(6)}`);
    console.log(`   Theta: ${selection.greeks.theta.toFixed(2)}`);
    console.log(`   Vega: ${selection.greeks.vega.toFixed(2)}`);

    console.log('\n   Risk/Reward:');
    console.log(`   Max Profit: $${selection.maxProfit.toFixed(2)}`);
    console.log(`   Max Loss: $${selection.maxLoss.toFixed(2)}`);
    console.log(`   Risk/Reward Ratio: ${(selection.maxProfit / selection.maxLoss).toFixed(2)}`);

    if (selection.breakEven) {
      console.log('\n   Break-Even Points:');
      console.log(`   Lower: $${selection.breakEven.lower.toFixed(2)} ` +
                  `(${((selection.breakEven.lower - marketData.spot) / marketData.spot * 100).toFixed(2)}% from spot)`);
      console.log(`   Upper: $${selection.breakEven.upper.toFixed(2)} ` +
                  `(${((selection.breakEven.upper - marketData.spot) / marketData.spot * 100).toFixed(2)}% from spot)`);
      console.log(`   Range: $${(selection.breakEven.upper - selection.breakEven.lower).toFixed(2)} ` +
                  `(${((selection.breakEven.upper - selection.breakEven.lower) / marketData.spot * 100).toFixed(2)}% of spot)`);
    }

    // 5. Generate signal
    console.log('\n5. Generating signal...');
    const signal = await strategy.generateSignal(marketData, indicators, marketData.options);
    
    console.log(`✅ Signal generated: ${signal.signalType.toUpperCase()}`);
    console.log(`   Strategy: ${signal.strategy}`);
    console.log(`   Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
    console.log(`   Reason: ${signal.reason}`);

    if (signal.position) {
      console.log(`   Position Size: ${signal.position.contracts} contracts`);
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
 * Main test runner
 */
async function main() {
  console.log('\n' + '█'.repeat(80));
  console.log('TRADING STRATEGY TEST SUITE (REAL DATA)');
  console.log('█'.repeat(80));

  try {
    // Initialize
    const { dataCollector, optionsService } = await initialize();
    
    // Fetch real market data
    const marketData = await fetchRealMarketData(optionsService);
    
    // Calculate indicators
    const indicators = calculateIndicators(marketData);
    
    if (!indicators) {
      console.error('\n❌ Could not calculate indicators. Exiting.');
      return;
    }
    
    // Test Iron Condor
    await testStrategy('iron_condor', {
      accountBalance: 10000,
      riskPercent: 2,
      minIVRank: 60,
      maxIVRank: 100,
      minDTE: 30,
      maxDTE: 45,
      minVolume: 0.1,
      minOI: 1
    }, marketData, indicators);

    // Test Iron Butterfly
    await testStrategy('iron_butterfly', {
      accountBalance: 10000,
      riskPercent: 2,
      minIVRank: 70,
      maxIVRank: 100,
      minDTE: 21,
      maxDTE: 35,
      minVolume: 0.1,
      minOI: 1
    }, marketData, indicators);

    console.log('\n' + '█'.repeat(80));
    console.log('ALL TESTS COMPLETED');
    console.log('█'.repeat(80) + '\n');
    
    // Exit process
    process.exit(0);

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { testStrategy, fetchRealMarketData, calculateIndicators };
