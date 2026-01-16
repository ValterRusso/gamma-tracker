/**
 * Test Script for Spread Strategies
 * Tests Bull Call Spread and Bear Put Spread with real market data
 * 
 * These are SIMPLE 2-leg strategies that should work reliably.
 * 
 * USAGE:
 * 1. Make sure backend is running on port 3300
 * 2. Run: node test-spreads.js
 * 
 * NO DEPENDENCIES ON DataCollector or OptionsService - Pure HTTP!
 */

const StrategyFactory = require('./src/services/TradingBot/strategies/StrategyFactory');
const axios = require('axios');

const API_BASE = 'http://localhost:3300/api';

/**
 * Fetch real market data from HTTP endpoints
 */
async function fetchRealMarketData() {
  try {
    console.log('📊 Fetching real market data from HTTP endpoints...\n');
    
    // 1. Get spot price from /api/binance/stats
    console.log('   Fetching spot price...');
    const statsResponse = await axios.get(`${API_BASE}/binance/stats`);
    
    if (!statsResponse.data.success) {
      throw new Error('Stats endpoint returned success=false');
    }
    
    const spot = statsResponse.data.data.spotPrice;
    console.log(`   ✅ Spot Price: $${spot.toFixed(2)}`);
    console.log(`   📈 Total Options: ${statsResponse.data.data.totalOptions}`);
    console.log(`   📅 Expiry Count: ${statsResponse.data.data.expiryCount}`);
    console.log(`   🔢 Valid IV Count: ${statsResponse.data.data.validIVCount}\n`);
    
    // 2. Get all options from /api/options
    console.log('   Fetching options data...');
    const optionsResponse = await axios.get(`${API_BASE}/options`);
    
    if (!optionsResponse.data.success) {
      throw new Error('Options endpoint returned success=false');
    }
    
    const options = optionsResponse.data.data;
    console.log(`   ✅ Options fetched: ${options.length}`);
    
    if (options.length === 0) {
      throw new Error('No options data available');
    }
    
    // 3. Show sample option
    const sampleOption = options[0];
    console.log(`\n   📋 Sample Option:`);
    console.log(`      Symbol: ${sampleOption.symbol}`);
    console.log(`      Strike: $${sampleOption.strike}`);
    console.log(`      Side: ${sampleOption.side}`);
    console.log(`      Delta: ${sampleOption.delta?.toFixed(4) || 'N/A'}`);
    console.log(`      Gamma: ${sampleOption.gamma?.toFixed(6) || 'N/A'}`);
    console.log(`      Theta: ${sampleOption.theta?.toFixed(2) || 'N/A'}`);
    console.log(`      Vega: ${sampleOption.vega?.toFixed(2) || 'N/A'}`);
    console.log(`      Mark Price: $${sampleOption.markPrice?.toFixed(2) || 'N/A'}`);
    console.log(`      Mark IV: ${sampleOption.markIV?.toFixed(4) || 'N/A'}`);
    console.log(`      Volume: ${sampleOption.volume?.toFixed(2) || 'N/A'}`);
    console.log(`      OI: ${sampleOption.openInterest?.toFixed(2) || 'N/A'}`);
    
    // 4. Normalize option data format
    const normalizedOptions = options.map(opt => ({
      symbol: opt.symbol,
      underlying: opt.underlying,
      strike: opt.strike,
      side: opt.side,
      expiry: opt.expiryDate,
      delta: opt.delta,
      gamma: opt.gamma,
      theta: opt.theta,
      vega: opt.vega,
      mark_price: opt.markPrice,
      bid_price: opt.markPrice * 0.98, // Approximate bid
      ask_price: opt.markPrice * 1.02, // Approximate ask
      impliedVolatility: opt.markIV,
      volume: opt.volume || 0,
      open_interest: opt.openInterest || 0,
      contractSize: opt.contractSize || 1
    }));
    
    return {
      spot,
      options: normalizedOptions,
      timestamp: new Date()
    };
    
  } catch (error) {
    console.error('\n❌ Error fetching market data:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   💡 Make sure backend is running on port 3300');
    }
    throw error;
  }
}

/**
 * Calculate indicators from real data
 */
function calculateIndicators(marketData) {
  const { spot, options } = marketData;
  
  console.log('\n📈 Calculating indicators...\n');
  
  // Calculate IV statistics
  const ivs = options
    .filter(opt => opt.impliedVolatility && opt.impliedVolatility > 0)
    .map(opt => opt.impliedVolatility);
  
  if (ivs.length === 0) {
    console.error('❌ No IV data available');
    return null;
  }
  
  const currentIV = ivs.reduce((sum, iv) => sum + iv, 0) / ivs.length;
  const minIV = Math.min(...ivs);
  const maxIV = Math.max(...ivs);
  const ivRank = ((currentIV - minIV) / (maxIV - minIV)) * 100;
  
  console.log(`   Current IV: ${currentIV.toFixed(4)}`);
  console.log(`   IV Range: ${minIV.toFixed(4)} - ${maxIV.toFixed(4)}`);
  console.log(`   📊 IV Rank: ${ivRank.toFixed(1)}`);
  
  // Calculate total volume and OI
  const totalVolume = options.reduce((sum, opt) => sum + (opt.volume || 0), 0);
  const totalOI = options.reduce((sum, opt) => sum + (opt.open_interest || 0), 0);
  
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
    ? puts.reduce((sum, opt) => sum + (opt.impliedVolatility || 0), 0) / puts.length
    : 0;
  
  const avgCallIV = calls.length > 0
    ? calls.reduce((sum, opt) => sum + (opt.impliedVolatility || 0), 0) / calls.length
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
  console.log(`   🎯 Regime: ${regime}`);
  
  // Calculate average Greeks
  const avgDelta = options.reduce((sum, opt) => sum + Math.abs(opt.delta || 0), 0) / options.length;
  const avgGamma = options.reduce((sum, opt) => sum + (opt.gamma || 0), 0) / options.length;
  const avgTheta = options.reduce((sum, opt) => sum + (opt.theta || 0), 0) / options.length;
  const avgVega = options.reduce((sum, opt) => sum + (opt.vega || 0), 0) / options.length;
  
  console.log(`\n   📊 Average Greeks:`);
  console.log(`      Delta: ${avgDelta.toFixed(4)}`);
  console.log(`      Gamma: ${avgGamma.toFixed(6)}`);
  console.log(`      Theta: ${avgTheta.toFixed(2)}`);
  console.log(`      Vega: ${avgVega.toFixed(2)}`);
  
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
      console.log('   💡 This is normal if market conditions are not ideal for this strategy');
      console.log(`   📊 Current IV Rank: ${indicators.ivRank.toFixed(1)} (strategy requires > ${config.minIVRank})`);
      return;
    }

    // 4. Select strikes
    console.log('\n4. Selecting strikes...');
    const selection = await strategy.selectStrikes(marketData, marketData.options);
    
    if (!selection) {
      console.log('❌ Could not find suitable strikes');
      console.log('   💡 Possible reasons:');
      console.log('      - Not enough options with required delta');
      console.log('      - Insufficient liquidity');
      console.log('      - No suitable expiry dates');
      console.log('      - Greeks validation failed');
      return;
    }

    console.log('✅ Strikes selected successfully!\n');
    console.log('   📋 Position Legs:');
    selection.legs.forEach((leg, i) => {
      const opt = leg.option;
      console.log(`\n   Leg ${i + 1}: ${leg.action} ${opt.side} @ $${opt.strike}`);
      console.log(`      Delta: ${opt.delta?.toFixed(4) || 'N/A'}`);
      console.log(`      Gamma: ${opt.gamma?.toFixed(6) || 'N/A'}`);
      console.log(`      Theta: ${opt.theta?.toFixed(2) || 'N/A'}`);
      console.log(`      Vega: ${opt.vega?.toFixed(2) || 'N/A'}`);
      console.log(`      Price: $${(opt.mark_price || 0).toFixed(2)}`);
      console.log(`      Volume: ${(opt.volume || 0).toFixed(2)}`);
      console.log(`      OI: ${(opt.open_interest || 0).toFixed(2)}`);
    });

    console.log('\n   🎯 Position Greeks (Net):');
    console.log(`      Delta: ${selection.greeks.delta.toFixed(4)}`);
    console.log(`      Gamma: ${selection.greeks.gamma.toFixed(6)}`);
    console.log(`      Theta: ${selection.greeks.theta.toFixed(2)}`);
    console.log(`      Vega: ${selection.greeks.vega.toFixed(2)}`);

    console.log('\n   💰 Risk/Reward:');
    console.log(`      Max Profit: $${selection.maxProfit.toFixed(2)}`);
    console.log(`      Max Loss: $${selection.maxLoss.toFixed(2)}`);
    console.log(`      Risk/Reward Ratio: ${(selection.maxProfit / selection.maxLoss).toFixed(2)}`);

    if (selection.breakEven) {
      const lowerPct = ((selection.breakEven.lower - marketData.spot) / marketData.spot * 100);
      const upperPct = ((selection.breakEven.upper - marketData.spot) / marketData.spot * 100);
      const rangePct = ((selection.breakEven.upper - selection.breakEven.lower) / marketData.spot * 100);
      
      console.log('\n   📍 Break-Even Points:');
      console.log(`      Lower: $${selection.breakEven.lower.toFixed(2)} (${lowerPct.toFixed(2)}% from spot)`);
      console.log(`      Upper: $${selection.breakEven.upper.toFixed(2)} (${upperPct.toFixed(2)}% from spot)`);
      console.log(`      Range: $${(selection.breakEven.upper - selection.breakEven.lower).toFixed(2)} (${rangePct.toFixed(2)}% of spot)`);
    }

    // 5. Generate signal
    console.log('\n5. Generating signal...');
    const signal = await strategy.generateSignal(marketData, indicators, marketData.options);
    
    console.log(`\n✅ Signal generated: ${signal.signalType.toUpperCase()}`);
    console.log(`   Strategy: ${signal.strategy}`);
    console.log(`   Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
    console.log(`   Reason: ${signal.reason}`);

    if (signal.position) {
      console.log(`\n   📦 Position Details:`);
      if (signal.position.contracts !== undefined) {
        console.log(`      Contracts: ${signal.position.contracts}`);
      }
      if (signal.position.totalRisk !== undefined) {
        console.log(`      Total Risk: $${signal.position.totalRisk.toFixed(2)}`);
      }
      if (signal.position.riskPercent !== undefined) {
        console.log(`      Risk %: ${signal.position.riskPercent.toFixed(2)}%`);
      }
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
  console.log('SPREAD STRATEGIES TEST SUITE');
  console.log('Testing Bull Call Spread and Bear Put Spread (2-leg strategies)');
  console.log('█'.repeat(80) + '\n');

  try {
    // Fetch real market data from HTTP endpoints
    const marketData = await fetchRealMarketData();
    
    // Calculate indicators
    const indicators = calculateIndicators(marketData);
    
    if (!indicators) {
      console.error('\n❌ Could not calculate indicators. Exiting.');
      process.exit(1);
    }
    
    // Test Bull Call Spread
    console.log('\n📈 Testing Bull Call Spread (Bullish 2-leg strategy)...\n');
    await testStrategy('bull_call_spread', {
      accountBalance: 1000000,
      riskPercent: 35,
      minIVRank: 0,
      maxIVRank: 100,
      minDTE: 5,
      maxDTE: 30,
      longDelta: 0.55,
      shortDelta: 0.35,
      deltaTolerance: 0.15,
      minSpreadWidth: 3000,
      maxSpreadWidth: 8000,
      minVolume: 0,
      minOI: 0,
      profitTarget: 0.5,
      stopLoss: 5
    }, marketData, indicators);

    // Test Bear Put Spread
    console.log('\n📉 Testing Bear Put Spread (Bearish 2-leg strategy)...\n');
    await testStrategy('bear_put_spread', {
      accountBalance: 10000,
      riskPercent: 35,
      minIVRank: 0,
      maxIVRank: 100,
      minDTE: 5,
      maxDTE: 30,
      longDelta: -0.55,
      shortDelta: -0.35,
      deltaTolerance: 0.15,
      minSpreadWidth: 3000,
      maxSpreadWidth: 8000,
      minVolume: 0,
      minOI: 0,
      profitTarget: 0.5,
      stopLoss: 5
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
