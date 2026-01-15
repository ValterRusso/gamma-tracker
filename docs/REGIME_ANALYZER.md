# Regime Analyzer Documentation

## Overview

The **Regime Analyzer** classifies the current **market regime** based on Gamma Exposure (GEX) metrics and the price's position relative to the **Gamma Flip Point**. It identifies four distinct regimes, each with unique volatility characteristics and trading implications.

## What is Market Regime Analysis?

**Market Regime** refers to the underlying structural conditions that determine how the market responds to price movements. In options-driven markets, the regime is primarily determined by:

1. **Net Gamma Exposure** (positive or negative)
2. **Price position relative to Gamma Flip** (above or below)

These two factors create **four distinct regimes**, each with predictable behavior patterns.

---

## The Four Market Regimes

### Regime 1: Positive Gamma Above Flip

**Conditions:**
- Net GEX > 0 (dealers are long gamma)
- Spot price > Gamma Flip Point

**Dealer Behavior:**
- **Buy on rallies** (to maintain delta hedge)
- **Sell on dips** (to maintain delta hedge)

**Market Characteristics:**
- ✅ **Stabilizing hedging** - Dealers act as shock absorbers
- ✅ **Mean-reverting** - Price tends to revert to equilibrium
- ✅ **Low volatility** - Realized vol < Implied vol
- ✅ **Resistance at Call Wall** - Hard to break through high Call OI strikes

**Trading Implications:**
- Range-bound trading strategies work well
- Sell options (collect premium in low-vol environment)
- Fade breakouts (likely to fail)
- Use Call Wall as resistance

**Example:**
```
Net GEX: +$500M
Gamma Flip: $95,000
Spot Price: $98,000 (above flip)

→ Regime: POSITIVE_GAMMA_ABOVE_FLIP
→ Expect: Low volatility, range-bound, resistance at $100K Call Wall
```

---

### Regime 2: Positive Gamma Below Flip

**Conditions:**
- Net GEX > 0 (dealers are long gamma)
- Spot price < Gamma Flip Point

**Dealer Behavior:**
- Still **stabilizing**, but **transitional** state

**Market Characteristics:**
- ⚠️ **Unstable regime** - Transitioning between states
- ⚠️ **Directional bias** - Likely moving toward Gamma Flip
- ⚠️ **Support at Put Wall** - Strong support from high Put OI
- ⚠️ **Medium volatility** - Can spike if flip is breached

**Trading Implications:**
- Watch for move toward Gamma Flip
- Use Put Wall as support
- Volatility can increase if price breaks below flip
- Consider long positions (bounce toward flip)

**Example:**
```
Net GEX: +$300M
Gamma Flip: $97,000
Spot Price: $95,000 (below flip)

→ Regime: POSITIVE_GAMMA_BELOW_FLIP
→ Expect: Bounce toward $97K, support at $93K Put Wall
```

---

### Regime 3: Negative Gamma Below Flip

**Conditions:**
- Net GEX < 0 (dealers are short gamma)
- Spot price < Gamma Flip Point

**Dealer Behavior:**
- **Sell on dips** (to maintain delta hedge)
- **Buy on rallies** (to maintain delta hedge)

**Market Characteristics:**
- 🔥 **Amplifying hedging** - Dealers add fuel to the fire
- 🔥 **Trend-following** - Moves accelerate
- 🔥 **High volatility** - Realized vol > Implied vol
- 🔥 **Gaps and fast moves** - Price can move violently

**Trading Implications:**
- Trend-following strategies work best
- Buy options (long volatility)
- Don't fade moves (they accelerate)
- Use tight stops (risk of gaps)

**Example:**
```
Net GEX: -$400M
Gamma Flip: $97,000
Spot Price: $94,000 (below flip)

→ Regime: NEGATIVE_GAMMA_BELOW_FLIP
→ Expect: High volatility, potential for rapid downside, gaps
```

---

### Regime 4: Negative Gamma Above Flip

**Conditions:**
- Net GEX < 0 (dealers are short gamma)
- Spot price > Gamma Flip Point

**Dealer Behavior:**
- **Unusual situation** - Theoretically unstable

**Market Characteristics:**
- ❓ **Rare regime** - May indicate data errors or special events
- ❓ **Unpredictable volatility**
- ❓ **Monitor closely** - Regime likely to shift

**Trading Implications:**
- Reduce position sizes
- Wait for regime clarification
- Check data quality
- Possible special event (large hedge, institutional flow)

**Example:**
```
Net GEX: -$200M
Gamma Flip: $95,000
Spot Price: $98,000 (above flip)

→ Regime: NEGATIVE_GAMMA_ABOVE_FLIP
→ Expect: Uncertain, monitor for regime shift
```

---

## Regime Summary Table

| Regime | Net GEX | Position | Volatility | Dealer Action | Market Behavior |
|--------|---------|----------|------------|---------------|-----------------|
| **1. Pos Above** | + | Above Flip | LOW | Stabilizing | Mean-reverting, range-bound |
| **2. Pos Below** | + | Below Flip | MEDIUM | Transitional | Moving toward flip |
| **3. Neg Below** | - | Below Flip | HIGH | Amplifying | Trend-following, volatile |
| **4. Neg Above** | - | Above Flip | UNCERTAIN | Unusual | Unpredictable |

---

## Algorithm

### Step 1: Extract Key Metrics

From GEX Calculator output:
- `totalGEX.total` → Net Gamma Exposure
- `gammaFlip.level` → Gamma Flip Point
- `spotPrice` → Current price

### Step 2: Determine Position

```javascript
isAboveGammaFlip = spotPrice > gammaFlip.level
```

### Step 3: Classify Regime

```javascript
if (netGamma > 0 && isAboveGammaFlip) {
  regime = 'POSITIVE_GAMMA_ABOVE_FLIP';
  volatilityExpectation = 'LOW';
}
else if (netGamma > 0 && !isAboveGammaFlip) {
  regime = 'POSITIVE_GAMMA_BELOW_FLIP';
  volatilityExpectation = 'MEDIUM';
}
else if (netGamma < 0 && !isAboveGammaFlip) {
  regime = 'NEGATIVE_GAMMA_BELOW_FLIP';
  volatilityExpectation = 'HIGH';
}
else if (netGamma < 0 && isAboveGammaFlip) {
  regime = 'NEGATIVE_GAMMA_ABOVE_FLIP';
  volatilityExpectation = 'UNCERTAIN';
}
```

### Step 4: Generate Implications

For each regime, provide:
- **Description** - What's happening
- **Implications** - How dealers behave
- **Volatility Expectation** - Expected vol level
- **Confidence** - Based on data quality

---

## Implementation

### Constructor

```javascript
const RegimeAnalyzer = require('./calculators/RegimeAnalyzer');

const regimeAnalyzer = new RegimeAnalyzer();
```

No configuration required - stateless analyzer.

---

## API Methods

### `analyzeRegime(metrics)`

Determine market regime based on GEX metrics.

**Parameters:**
- `metrics` (Object): Output from GEXCalculator

**Returns:**
```javascript
{
  regime: 'POSITIVE_GAMMA_ABOVE_FLIP',
  description: 'Dealers têm gamma positiva e o preço está acima do gamma flip',
  implications: [
    'Dealers compram na alta e vendem na baixa (hedging estabiliza o mercado)',
    'Movimentos de preço tendem a ser contidos',
    'Resistência em níveis de Call Wall',
    'Volatilidade realizada tende a ser menor que IV'
  ],
  volatilityExpectation: 'LOW',
  confidence: 'HIGH',
  metrics: {
    netGamma: 500000000,
    gammaFlipLevel: 95000,
    spotPrice: 98000,
    isAboveGammaFlip: true
  }
}
```

**Example:**
```javascript
const gexMetrics = gexCalc.calculateGEX(options, spotPrice);
const regime = regimeAnalyzer.analyzeRegime(gexMetrics);

console.log('Current Regime:', regime.regime);
console.log('Volatility Expectation:', regime.volatilityExpectation);
console.log('Implications:');
regime.implications.forEach(imp => console.log('  -', imp));
```

---

### `analyzeDistribution(gammaProfile, spotPrice)`

Analyze GEX distribution and identify concentrations.

**Parameters:**
- `gammaProfile` (Array): Gamma profile by strike from GEXCalculator
- `spotPrice` (Number): Current spot price

**Returns:**
```javascript
{
  status: 'OK',
  totalAbsGEX: 1500000000,
  avgGEX: 50000000,
  significantLevels: [
    {
      strike: 97000,
      gex: 250000000,
      distanceFromSpot: -1000,
      distancePercent: -1.02,
      type: 'POSITIVE'
    },
    {
      strike: 95000,
      gex: -180000000,
      distanceFromSpot: -3000,
      distancePercent: -3.06,
      type: 'NEGATIVE'
    },
    // ... up to 10 significant levels
  ],
  probableTradingRange: {
    upper: 100000,
    lower: 94000,
    spotPrice: 98000,
    upperDistance: 2.04,
    lowerDistance: -4.08
  }
}
```

**Example:**
```javascript
const distribution = regimeAnalyzer.analyzeDistribution(
  gexMetrics.gammaProfile,
  spotPrice
);

console.log('Significant Levels:');
distribution.significantLevels.forEach(level => {
  console.log(`  $${level.strike}: ${level.type} GEX (${level.distancePercent.toFixed(2)}%)`);
});

console.log('Probable Trading Range:');
console.log(`  Lower: $${distribution.probableTradingRange.lower}`);
console.log(`  Upper: $${distribution.probableTradingRange.upper}`);
```

**Use Cases:**
- Identify key support/resistance from GEX
- Find strikes with > 2x average GEX (significant)
- Estimate probable trading range
- Detect GEX concentrations

---

### `generateInsights(metrics)`

Generate comprehensive market insights combining regime and distribution analysis.

**Parameters:**
- `metrics` (Object): Complete GEX metrics from GEXCalculator

**Returns:**
```javascript
{
  regime: {
    regime: 'POSITIVE_GAMMA_ABOVE_FLIP',
    description: '...',
    implications: [...],
    volatilityExpectation: 'LOW',
    confidence: 'HIGH',
    metrics: { ... }
  },
  distribution: {
    status: 'OK',
    totalAbsGEX: 1500000000,
    avgGEX: 50000000,
    significantLevels: [...],
    probableTradingRange: { ... }
  },
  keyLevels: {
    gammaFlip: { level: 95000, confidence: 'HIGH', ... },
    putWall: { strike: 93000, gex: -200000000, ... },
    callWall: { strike: 100000, gex: 300000000, ... }
  },
  summary: [
    'GEX Total: $0.50B (POSITIVA)',
    'Regime: POSITIVE_GAMMA_ABOVE_FLIP',
    'Volatilidade Esperada: LOW',
    'Gamma Flip: $95000 (-3.06% do spot)',
    'Put Wall: $93000 (Suporte)',
    'Call Wall: $100000 (Resistência)',
    'Range Provável: $94000 - $100000'
  ],
  timestamp: 1705334400000
}
```

**Example:**
```javascript
const insights = regimeAnalyzer.generateInsights(gexMetrics);

console.log('=== MARKET INSIGHTS ===');
insights.summary.forEach(line => console.log(line));

console.log('\nKey Levels:');
console.log('  Gamma Flip:', insights.keyLevels.gammaFlip.level);
console.log('  Put Wall:', insights.keyLevels.putWall.strike);
console.log('  Call Wall:', insights.keyLevels.callWall.strike);

console.log('\nRegime:', insights.regime.regime);
console.log('Expected Volatility:', insights.regime.volatilityExpectation);
```

---

## Usage Examples

### Basic Regime Analysis

```javascript
const GEXCalculator = require('./calculators/GEXCalculator');
const RegimeAnalyzer = require('./calculators/RegimeAnalyzer');

const gexCalc = new GEXCalculator();
const regimeAnalyzer = new RegimeAnalyzer();

// Calculate GEX
const options = await fetchOptionsData();
const spotPrice = 98000;
const gexMetrics = gexCalc.calculateGEX(options, spotPrice);

// Analyze regime
const regime = regimeAnalyzer.analyzeRegime(gexMetrics);

console.log('=== REGIME ANALYSIS ===');
console.log('Regime:', regime.regime);
console.log('Description:', regime.description);
console.log('Volatility:', regime.volatilityExpectation);
console.log('\nImplications:');
regime.implications.forEach(imp => console.log('  -', imp));
```

**Output:**
```
=== REGIME ANALYSIS ===
Regime: POSITIVE_GAMMA_ABOVE_FLIP
Description: Dealers têm gamma positiva e o preço está acima do gamma flip
Volatility: LOW

Implications:
  - Dealers compram na alta e vendem na baixa (hedging estabiliza o mercado)
  - Movimentos de preço tendem a ser contidos
  - Resistência em níveis de Call Wall
  - Volatilidade realizada tende a ser menor que IV
```

---

### Trading Bot Integration

```javascript
class RegimeAwareBot {
  constructor() {
    this.gexCalc = new GEXCalculator();
    this.regimeAnalyzer = new RegimeAnalyzer();
  }
  
  async analyzeAndTrade(options, spotPrice) {
    // Calculate GEX
    const gexMetrics = this.gexCalc.calculateGEX(options, spotPrice);
    
    // Analyze regime
    const regime = this.regimeAnalyzer.analyzeRegime(gexMetrics);
    
    // Adjust strategy based on regime
    switch (regime.regime) {
      case 'POSITIVE_GAMMA_ABOVE_FLIP':
        this.setStrategy('RANGE_TRADING');
        this.sellOptions(gexMetrics.callWall.strike);
        console.log('📊 Range trading mode: Selling options at Call Wall');
        break;
        
      case 'POSITIVE_GAMMA_BELOW_FLIP':
        this.setStrategy('MEAN_REVERSION');
        this.buyDip(gexMetrics.putWall.strike);
        console.log('📈 Mean reversion: Buying dip toward Gamma Flip');
        break;
        
      case 'NEGATIVE_GAMMA_BELOW_FLIP':
        this.setStrategy('TREND_FOLLOWING');
        this.buyVolatility();
        console.log('🔥 High volatility mode: Long volatility, trend following');
        break;
        
      case 'NEGATIVE_GAMMA_ABOVE_FLIP':
        this.setStrategy('DEFENSIVE');
        this.reducePositions();
        console.log('⚠️ Uncertain regime: Reducing positions');
        break;
    }
  }
  
  setStrategy(strategy) {
    this.currentStrategy = strategy;
    console.log(`Strategy set to: ${strategy}`);
  }
}
```

---

### Distribution Analysis

```javascript
// Analyze GEX distribution
const distribution = regimeAnalyzer.analyzeDistribution(
  gexMetrics.gammaProfile,
  spotPrice
);

console.log('=== GEX DISTRIBUTION ANALYSIS ===');
console.log('Total Absolute GEX:', (distribution.totalAbsGEX / 1e9).toFixed(2) + 'B');
console.log('Average GEX:', (distribution.avgGEX / 1e6).toFixed(2) + 'M');

console.log('\nSignificant Levels (> 2x average):');
distribution.significantLevels.forEach((level, i) => {
  const gexBillions = (Math.abs(level.gex) / 1e9).toFixed(2);
  const direction = level.type === 'POSITIVE' ? '🟢' : '🔴';
  
  console.log(`${i + 1}. ${direction} $${level.strike}`);
  console.log(`   GEX: $${gexBillions}B (${level.type})`);
  console.log(`   Distance: ${level.distancePercent.toFixed(2)}%`);
});

console.log('\nProbable Trading Range:');
console.log(`  Lower Bound: $${distribution.probableTradingRange.lower}`);
console.log(`  Current Spot: $${distribution.probableTradingRange.spotPrice}`);
console.log(`  Upper Bound: $${distribution.probableTradingRange.upper}`);
console.log(`  Range Width: ${(distribution.probableTradingRange.upperDistance - distribution.probableTradingRange.lowerDistance).toFixed(2)}%`);
```

---

### Comprehensive Insights

```javascript
// Generate full insights
const insights = regimeAnalyzer.generateInsights(gexMetrics);

console.log('=== MARKET INSIGHTS ===');
console.log(insights.summary.join('\n'));

console.log('\n=== KEY LEVELS ===');
console.log('Gamma Flip:', insights.keyLevels.gammaFlip.level);
console.log('Put Wall:', insights.keyLevels.putWall.strike, '(Support)');
console.log('Call Wall:', insights.keyLevels.callWall.strike, '(Resistance)');

console.log('\n=== REGIME DETAILS ===');
console.log('Regime:', insights.regime.regime);
console.log('Volatility:', insights.regime.volatilityExpectation);
console.log('Confidence:', insights.regime.confidence);

console.log('\n=== DISTRIBUTION ===');
console.log('Significant Levels:', insights.distribution.significantLevels.length);
console.log('Trading Range:', 
  `$${insights.distribution.probableTradingRange.lower} - ` +
  `$${insights.distribution.probableTradingRange.upper}`
);
```

---

### Real-Time Regime Monitoring

```javascript
class RegimeMonitor {
  constructor() {
    this.gexCalc = new GEXCalculator();
    this.regimeAnalyzer = new RegimeAnalyzer();
    this.currentRegime = null;
  }
  
  async monitor(options, spotPrice) {
    const gexMetrics = this.gexCalc.calculateGEX(options, spotPrice);
    const regime = this.regimeAnalyzer.analyzeRegime(gexMetrics);
    
    // Detect regime change
    if (this.currentRegime && regime.regime !== this.currentRegime.regime) {
      console.log('🚨 REGIME CHANGE DETECTED!');
      console.log(`  From: ${this.currentRegime.regime}`);
      console.log(`  To: ${regime.regime}`);
      console.log(`  Volatility: ${this.currentRegime.volatilityExpectation} → ${regime.volatilityExpectation}`);
      
      this.onRegimeChange(this.currentRegime, regime);
    }
    
    this.currentRegime = regime;
  }
  
  onRegimeChange(oldRegime, newRegime) {
    // Handle regime transition
    if (newRegime.volatilityExpectation === 'HIGH') {
      console.log('⚠️ Entering high volatility regime');
      console.log('→ Reduce position sizes');
      console.log('→ Widen stops');
      console.log('→ Consider long volatility');
    }
    
    if (newRegime.volatilityExpectation === 'LOW') {
      console.log('✅ Entering low volatility regime');
      console.log('→ Increase position sizes');
      console.log('→ Tighten stops');
      console.log('→ Consider short volatility');
    }
  }
}

// Usage
const monitor = new RegimeMonitor();
setInterval(async () => {
  const options = await fetchOptionsData();
  const spotPrice = await fetchSpotPrice();
  await monitor.monitor(options, spotPrice);
}, 60000); // Check every minute
```

---

## Trading Strategies by Regime

### Strategy 1: Range Trading (Positive Gamma Above Flip)

**Conditions:**
- Regime: POSITIVE_GAMMA_ABOVE_FLIP
- Volatility: LOW

**Setup:**
- Identify Call Wall (resistance)
- Identify Put Wall (support)
- Confirm range width > 2%

**Rules:**

| Price Action | Action |
|--------------|--------|
| Price near Put Wall | Buy (expect bounce) |
| Price near Call Wall | Sell (expect rejection) |
| Price breaks Call Wall | Exit longs (false breakout likely) |
| Price breaks Put Wall | Exit shorts (false breakdown likely) |

**Example:**
```javascript
if (regime.regime === 'POSITIVE_GAMMA_ABOVE_FLIP') {
  const putWall = gexMetrics.putWall.strike;
  const callWall = gexMetrics.callWall.strike;
  const rangeWidth = ((callWall - putWall) / spotPrice) * 100;
  
  if (rangeWidth > 2) {
    console.log('Range trading setup:');
    console.log(`  Buy zone: $${putWall} (Put Wall)`);
    console.log(`  Sell zone: $${callWall} (Call Wall)`);
    
    if (spotPrice < putWall * 1.01) {
      enterLong('Near Put Wall');
    }
    
    if (spotPrice > callWall * 0.99) {
      enterShort('Near Call Wall');
    }
  }
}
```

---

### Strategy 2: Trend Following (Negative Gamma Below Flip)

**Conditions:**
- Regime: NEGATIVE_GAMMA_BELOW_FLIP
- Volatility: HIGH

**Setup:**
- Confirm negative GEX
- Price below Gamma Flip
- Identify trend direction

**Rules:**

| Condition | Action |
|-----------|--------|
| Downtrend confirmed | Short on rallies |
| Uptrend confirmed | Long on dips (risky) |
| Volatility spike | Buy options (long vol) |
| Approaching Put Wall | Partial profit taking |

**Example:**
```javascript
if (regime.regime === 'NEGATIVE_GAMMA_BELOW_FLIP') {
  console.log('🔥 High volatility regime - Trend following mode');
  
  const trend = detectTrend(priceHistory);
  
  if (trend === 'DOWN') {
    console.log('→ Short on rallies');
    console.log('→ Use tight stops (risk of gaps)');
    console.log('→ Consider buying puts');
    
    if (spotPrice > sma20) {
      enterShort('Rally in downtrend (high vol regime)');
    }
  }
  
  // Long volatility
  console.log('→ Buy straddles/strangles');
  buyOptions('ATM straddle', { strike: spotPrice });
}
```

---

### Strategy 3: Mean Reversion (Positive Gamma Below Flip)

**Conditions:**
- Regime: POSITIVE_GAMMA_BELOW_FLIP
- Volatility: MEDIUM

**Setup:**
- Price below Gamma Flip
- Positive net GEX
- Identify distance to flip

**Rules:**

| Distance to Flip | Action |
|------------------|--------|
| > 3% | Wait (too far) |
| 1-3% | Enter long (expect move toward flip) |
| < 1% | Scale out (near target) |

**Example:**
```javascript
if (regime.regime === 'POSITIVE_GAMMA_BELOW_FLIP') {
  const flipLevel = gexMetrics.gammaFlip.level;
  const distancePct = ((flipLevel - spotPrice) / spotPrice) * 100;
  
  console.log(`Price ${distancePct.toFixed(2)}% below Gamma Flip`);
  
  if (distancePct > 1 && distancePct < 3) {
    console.log('→ Mean reversion setup: Long toward Gamma Flip');
    console.log(`→ Target: $${flipLevel}`);
    console.log(`→ Stop: Below Put Wall ($${gexMetrics.putWall.strike})`);
    
    enterLong('Mean reversion to Gamma Flip', {
      target: flipLevel,
      stop: gexMetrics.putWall.strike
    });
  }
}
```

---

### Strategy 4: Volatility Selling (Low Vol Regime)

**Conditions:**
- Regime: POSITIVE_GAMMA_ABOVE_FLIP
- Volatility: LOW
- IV > Historical Vol

**Setup:**
- Confirm low volatility expectation
- Check IV premium
- Identify range

**Rules:**

| Setup | Action |
|-------|--------|
| IV > HV by 20%+ | Sell straddles/strangles |
| Price near Put Wall | Sell puts |
| Price near Call Wall | Sell calls |
| Range width > 3% | Sell iron condor |

**Example:**
```javascript
if (regime.volatilityExpectation === 'LOW') {
  const iv = await getImpliedVolatility();
  const hv = await getHistoricalVolatility();
  const ivPremium = ((iv - hv) / hv) * 100;
  
  if (ivPremium > 20) {
    console.log(`IV Premium: ${ivPremium.toFixed(1)}% - Sell volatility`);
    
    const putWall = gexMetrics.putWall.strike;
    const callWall = gexMetrics.callWall.strike;
    
    console.log('Iron Condor Setup:');
    console.log(`  Sell Put: $${putWall}`);
    console.log(`  Sell Call: $${callWall}`);
    console.log(`  Collect premium in range-bound market`);
    
    sellIronCondor({
      putStrike: putWall,
      callStrike: callWall
    });
  }
}
```

---

## Interpretation Guidelines

### Volatility Expectations

| Expectation | Realized Vol | IV vs RV | Trading Style |
|-------------|--------------|----------|---------------|
| **LOW** | < 30% annualized | IV > RV | Range trading, sell vol |
| **MEDIUM** | 30-50% annualized | IV ≈ RV | Balanced, directional |
| **HIGH** | > 50% annualized | IV < RV | Trend following, buy vol |
| **UNCERTAIN** | Unpredictable | Variable | Defensive, reduce size |

### Confidence Levels

| Confidence | Interpretation | Action |
|------------|----------------|--------|
| **HIGH** | Clear regime, reliable data | Trade with full size |
| **MEDIUM** | Some uncertainty | Reduce size by 50% |
| **LOW** | Unclear regime | Reduce size by 75% |
| **NONE** | Insufficient data | Do not trade |

### Regime Transitions

| Transition | Interpretation | Action |
|------------|----------------|--------|
| **Low → High Vol** | Risk increasing | Reduce positions, widen stops |
| **High → Low Vol** | Risk decreasing | Increase positions, tighten stops |
| **Stable Regime** | Predictable behavior | Trade with confidence |
| **Frequent Changes** | Unstable market | Reduce activity |

---

## Limitations & Caveats

### 1. Dependent on GEX Accuracy

**Limitation:**  
Regime analysis is only as good as the underlying GEX data.

**Mitigation:**
- Ensure GEX Calculator has complete options data
- Check confidence levels
- Validate with other indicators

### 2. Regime Can Change Quickly

**Limitation:**  
Regimes can shift rapidly due to:
- Large institutional flows
- News events
- Options expiry

**Mitigation:**
- Monitor regime in real-time
- Set alerts for regime changes
- Use adaptive position sizing

### 3. Not Predictive

**Limitation:**  
Regime analysis describes **current conditions**, not future outcomes.

**Mitigation:**
- Use regime as context, not signal
- Combine with other analysis
- Don't assume regime will persist

### 4. Regime 4 is Rare

**Limitation:**  
NEGATIVE_GAMMA_ABOVE_FLIP is theoretically unstable and rarely occurs.

**Impact:**
- May indicate data errors
- Could be special event (large hedge)
- Unpredictable behavior

**Mitigation:**
- Verify data quality
- Reduce positions
- Wait for regime clarification

---

## Performance Considerations

### Computational Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Analyze regime | O(1) | Simple comparisons |
| Analyze distribution | O(n) | n = gamma profile length |
| Generate insights | O(n) | Dominated by distribution |
| **Overall** | **O(n)** | Very fast |

### Memory Usage

| Component | Size | Notes |
|-----------|------|-------|
| Regime analysis | <1KB | Minimal |
| Distribution | ~5KB | Depends on profile size |
| Insights | ~10KB | Includes all data |
| **Total** | **~15KB** | Lightweight |

---

## API Integration

### REST Endpoints

```
GET /api/regime
GET /api/regime/distribution
GET /api/regime/insights
```

See [API_REFERENCE.md](./API_REFERENCE.md) for details.

### Example API Response

```json
{
  "success": true,
  "data": {
    "regime": "POSITIVE_GAMMA_ABOVE_FLIP",
    "description": "Dealers têm gamma positiva e o preço está acima do gamma flip",
    "volatilityExpectation": "LOW",
    "confidence": "HIGH",
    "implications": [
      "Dealers compram na alta e vendem na baixa (hedging estabiliza o mercado)",
      "Movimentos de preço tendem a ser contidos",
      "Resistência em níveis de Call Wall",
      "Volatilidade realizada tende a ser menor que IV"
    ],
    "metrics": {
      "netGamma": 500000000,
      "gammaFlipLevel": 95000,
      "spotPrice": 98000,
      "isAboveGammaFlip": true
    }
  },
  "timestamp": 1705334400000
}
```

---

## Related Components

- **GEXCalculator**: Provides GEX metrics for regime analysis
- **MaxPainCalculator**: Complementary pinning analysis
- **RSICalculator**: Momentum confirmation
- **DataCollector**: Caches regime data

---

## References

### Theory

1. **Dealer Gamma Hedging**: "Volatility Trading" by Euan Sinclair
2. **Market Regimes**: "Dynamic Hedging" by Nassim Taleb
3. **Gamma Flip**: SqueezeMetrics research papers

### Empirical Studies

1. **Dealer Hedging Impact**: Academic papers on market microstructure
2. **Volatility Regimes**: Studies on vol clustering
3. **Options Expiry Effects**: Research on pinning and gamma

### Internal Documentation

- [GEX_CALCULATOR.md](./GEX_CALCULATOR.md)
- [MAX_PAIN_CALCULATOR.md](./MAX_PAIN_CALCULATOR.md)
- [API_REFERENCE.md](./API_REFERENCE.md)
- [PROJECT_MAP.md](../PROJECT_MAP.md)

---

## Changelog

### v1.0.0 (Current)
- Initial implementation
- Four regime classification
- Distribution analysis
- Insights generation

### Planned Features

- [ ] Historical regime tracking
- [ ] Regime transition alerts
- [ ] Regime-based auto-trading signals
- [ ] Machine learning for regime prediction
- [ ] Multi-asset regime correlation

---

## Support

For questions or issues:
- Check [API_REFERENCE.md](./API_REFERENCE.md)
- Review [PROJECT_MAP.md](../PROJECT_MAP.md)
- See code: `backend/src/calculators/RegimeAnalyzer.js`

---

**Last Updated:** January 15, 2026  
**Version:** 1.0.0  
**Author:** Valter Russo / Gamma Tracker Team
