# Max Pain Calculator Documentation

## Overview

The **Max Pain Calculator** identifies the **strike price where the maximum number of options contracts would expire Out of The Money (OTM)**. This is the point where market makers and option sellers would experience the least financial loss, and the underlying price tends to gravitate toward this level as expiration approaches.

## What is Max Pain?

**Max Pain** (also called **Max Pain Theory** or **Pinning**) is based on the observation that:

1. **Market makers sell options** and hedge their positions with the underlying asset
2. **Near expiration**, they adjust their hedges, creating directional pressure on the price
3. **The price tends to move** toward the strike with the highest total Open Interest (OI)
4. **At this strike**, the maximum number of options expire worthless, minimizing losses for option sellers

### Key Concept

> **Max Pain Strike** = The strike price where the sum of Call OI + Put OI is maximized.

At this strike:
- **Calls above** expire OTM (worthless)
- **Puts below** expire OTM (worthless)
- **Option sellers** (market makers) pay out the least
- **Option buyers** experience maximum collective loss

---

## Why Does Max Pain Work?

### Market Maker Hedging

Market makers are typically **net short options** (they sell more than they buy). To remain delta-neutral, they hedge by:

| Position | Hedge Action | Price Impact |
|----------|--------------|--------------|
| **Short Calls** | Buy underlying | Upward pressure |
| **Short Puts** | Sell underlying | Downward pressure |

### Dynamic Hedging Near Expiry

As expiration approaches:

1. **Options lose extrinsic value** rapidly (theta decay)
2. **Delta changes accelerate** (gamma increases)
3. **Market makers adjust hedges** more frequently
4. **Hedging activity creates price pressure** toward Max Pain

### Example Scenario

```
Current Price: $100,000
Max Pain Strike: $98,000

Scenario:
- Large OI at $98,000 strike (both calls and puts)
- As expiry approaches, price drifts toward $98,000
- At $98,000, maximum options expire worthless
- Market makers minimize payout obligations
```

---

## Algorithm

### Step 1: Group Open Interest by Strike

For each strike, sum:
- **Call OI**: Open interest of all calls at that strike
- **Put OI**: Open interest of all puts at that strike
- **Total OI**: Call OI + Put OI

```javascript
strikeOIMap = {
  95000: { callOI: 1200, putOI: 800, totalOI: 2000 },
  96000: { callOI: 1500, putOI: 1200, totalOI: 2700 },
  97000: { callOI: 2000, putOI: 1800, totalOI: 3800 },  // ← Max Pain
  98000: { callOI: 1100, putOI: 900, totalOI: 2000 },
  99000: { callOI: 600, putOI: 400, totalOI: 1000 }
}
```

### Step 2: Find Strike with Maximum Total OI

Sort strikes by `totalOI` (descending) and select the highest.

```javascript
Max Pain Strike = 97000 (totalOI = 3800)
```

### Step 3: Analyze Distance from Spot

Calculate:
- **Distance**: `Max Pain Strike - Spot Price`
- **Distance %**: `(Distance / Spot Price) × 100`

```javascript
Spot Price: 98000
Max Pain Strike: 97000
Distance: -1000 (1.02% below spot)
```

### Step 4: Interpret Direction

| Condition | Direction | Interpretation |
|-----------|-----------|----------------|
| `abs(distance%) < 1%` | **AT_SPOT** | High probability of pinning |
| `distance > 0` | **ABOVE_SPOT** | Upward pressure expected |
| `distance < 0` | **BELOW_SPOT** | Downward pressure expected |

---

## Implementation

### Constructor

```javascript
const MaxPainCalculator = require('./calculators/MaxPainCalculator');

const maxPainCalc = new MaxPainCalculator();
```

No configuration required - stateless calculator.

---

## API Methods

### `calculateMaxPain(options, spotPrice)`

Calculate Max Pain for a set of options.

**Parameters:**
- `options` (Array): Array of option objects
- `spotPrice` (Number, optional): Current spot price (will try to extract from options if not provided)

**Returns:**
```javascript
{
  maxPainStrike: 97000,
  maxPainOI: 3800,
  maxPainCallOI: 2000,
  maxPainPutOI: 1800,
  strikeOIMap: {
    95000: { strike: 95000, callOI: 1200, putOI: 800, totalOI: 2000 },
    96000: { strike: 96000, callOI: 1500, putOI: 1200, totalOI: 2700 },
    // ... all strikes
  },
  analysis: {
    spotPrice: 98000,
    distance: -1000,
    distancePct: -1.02,
    direction: 'BELOW_SPOT',
    interpretation: 'Max Pain 1.02% abaixo - pressão de baixa esperada'
  }
}
```

**Example:**
```javascript
const options = [
  { strike: 95000, side: 'CALL', openInterest: 1200, underlyingPrice: 98000 },
  { strike: 95000, side: 'PUT', openInterest: 800, underlyingPrice: 98000 },
  { strike: 96000, side: 'CALL', openInterest: 1500, underlyingPrice: 98000 },
  { strike: 96000, side: 'PUT', openInterest: 1200, underlyingPrice: 98000 },
  // ... more options
];

const result = maxPainCalc.calculateMaxPain(options, 98000);

console.log('Max Pain Strike:', result.maxPainStrike);
console.log('Total OI:', result.maxPainOI);
console.log('Distance:', result.analysis.distancePct.toFixed(2) + '%');
console.log('Direction:', result.analysis.direction);
```

---

### `getTopOIStrikes(options, topN)`

Get top N strikes by total Open Interest.

**Parameters:**
- `options` (Array): Array of option objects
- `topN` (Number, default: 5): Number of strikes to return

**Returns:**
```javascript
[
  { strike: 97000, callOI: 2000, putOI: 1800, totalOI: 3800 },
  { strike: 96000, callOI: 1500, putOI: 1200, totalOI: 2700 },
  { strike: 95000, callOI: 1200, putOI: 800, totalOI: 2000 },
  { strike: 98000, callOI: 1100, putOI: 900, totalOI: 2000 },
  { strike: 99000, callOI: 600, putOI: 400, totalOI: 1000 }
]
```

**Example:**
```javascript
const topStrikes = maxPainCalc.getTopOIStrikes(options, 3);

console.log('Top 3 Strikes by OI:');
topStrikes.forEach((strike, i) => {
  console.log(`${i + 1}. $${strike.strike} - OI: ${strike.totalOI}`);
});
```

**Use Cases:**
- Identify key support/resistance levels
- Find strikes with highest liquidity
- Detect potential pinning zones

---

### `calculateOIDistribution(options, numBuckets)`

Calculate Open Interest distribution across strike ranges.

**Parameters:**
- `options` (Array): Array of option objects
- `numBuckets` (Number, default: 5): Number of ranges to divide strikes into

**Returns:**
```javascript
[
  {
    bucketMin: 90000,
    bucketMax: 92000,
    callOI: 500,
    putOI: 300,
    totalOI: 800,
    percentage: 8.5
  },
  {
    bucketMin: 92000,
    bucketMax: 94000,
    callOI: 1200,
    putOI: 900,
    totalOI: 2100,
    percentage: 22.3
  },
  // ... more buckets
]
```

**Example:**
```javascript
const distribution = maxPainCalc.calculateOIDistribution(options, 5);

console.log('OI Distribution:');
distribution.forEach(bucket => {
  console.log(`$${bucket.bucketMin}-$${bucket.bucketMax}: ${bucket.percentage.toFixed(1)}%`);
  console.log(`  Calls: ${bucket.callOI}, Puts: ${bucket.putOI}`);
});
```

**Use Cases:**
- Visualize OI concentration
- Identify support/resistance zones
- Detect skew in option positioning

---

## Usage Examples

### Basic Max Pain Calculation

```javascript
const MaxPainCalculator = require('./calculators/MaxPainCalculator');

const maxPainCalc = new MaxPainCalculator();

// Fetch options from database or API
const options = await fetchOptionsData('BTCUSDT');

// Calculate Max Pain
const result = maxPainCalc.calculateMaxPain(options, 98000);

if (result) {
  console.log('=== MAX PAIN ANALYSIS ===');
  console.log('Max Pain Strike:', result.maxPainStrike);
  console.log('Total OI:', result.maxPainOI);
  console.log('Call OI:', result.maxPainCallOI);
  console.log('Put OI:', result.maxPainPutOI);
  console.log('');
  console.log('Current Spot:', result.analysis.spotPrice);
  console.log('Distance:', result.analysis.distance);
  console.log('Distance %:', result.analysis.distancePct.toFixed(2) + '%');
  console.log('Direction:', result.analysis.direction);
  console.log('Interpretation:', result.analysis.interpretation);
}
```

**Output:**
```
=== MAX PAIN ANALYSIS ===
Max Pain Strike: 97000
Total OI: 3800
Call OI: 2000
Put OI: 1800

Current Spot: 98000
Distance: -1000
Distance %: -1.02%
Direction: BELOW_SPOT
Interpretation: Max Pain 1.02% abaixo - pressão de baixa esperada
```

---

### Integration with Trading Bot

```javascript
class MaxPainBot {
  constructor() {
    this.maxPainCalc = new MaxPainCalculator();
  }
  
  async analyzeExpiry(options, spotPrice) {
    const result = this.maxPainCalc.calculateMaxPain(options, spotPrice);
    
    if (!result) {
      console.log('No Max Pain data available');
      return;
    }
    
    const { maxPainStrike, analysis } = result;
    const { direction, distancePct } = analysis;
    
    // Trading logic based on Max Pain
    if (Math.abs(distancePct) < 0.5) {
      console.log('⚠️ PINNING ALERT: Price very close to Max Pain');
      console.log('→ Expect low volatility, range-bound trading');
      this.setStrategy('RANGE');
      
    } else if (direction === 'BELOW_SPOT' && Math.abs(distancePct) > 2) {
      console.log('📉 BEARISH PRESSURE: Max Pain significantly below spot');
      console.log('→ Consider short positions or protective puts');
      this.setStrategy('BEARISH');
      
    } else if (direction === 'ABOVE_SPOT' && Math.abs(distancePct) > 2) {
      console.log('📈 BULLISH PRESSURE: Max Pain significantly above spot');
      console.log('→ Consider long positions or protective calls');
      this.setStrategy('BULLISH');
      
    } else {
      console.log('➡️ NEUTRAL: Max Pain within normal range');
      this.setStrategy('NEUTRAL');
    }
  }
  
  setStrategy(strategy) {
    console.log(`Strategy set to: ${strategy}`);
    // Implement strategy logic
  }
}
```

---

### Top Strikes Analysis

```javascript
// Get top 5 strikes by OI
const topStrikes = maxPainCalc.getTopOIStrikes(options, 5);

console.log('=== TOP 5 STRIKES BY OPEN INTEREST ===');
topStrikes.forEach((strike, i) => {
  const callPutRatio = (strike.callOI / strike.putOI).toFixed(2);
  const isMaxPain = strike.strike === result.maxPainStrike;
  
  console.log(`${i + 1}. $${strike.strike} ${isMaxPain ? '← MAX PAIN' : ''}`);
  console.log(`   Total OI: ${strike.totalOI}`);
  console.log(`   Call OI: ${strike.callOI}`);
  console.log(`   Put OI: ${strike.putOI}`);
  console.log(`   Call/Put Ratio: ${callPutRatio}`);
  console.log('');
});
```

**Output:**
```
=== TOP 5 STRIKES BY OPEN INTEREST ===
1. $97000 ← MAX PAIN
   Total OI: 3800
   Call OI: 2000
   Put OI: 1800
   Call/Put Ratio: 1.11

2. $96000
   Total OI: 2700
   Call OI: 1500
   Put OI: 1200
   Call/Put Ratio: 1.25

3. $95000
   Total OI: 2000
   Call OI: 1200
   Put OI: 800
   Call/Put Ratio: 1.50
...
```

---

### OI Distribution Visualization

```javascript
// Calculate OI distribution across 5 ranges
const distribution = maxPainCalc.calculateOIDistribution(options, 5);

console.log('=== OPEN INTEREST DISTRIBUTION ===');
distribution.forEach(bucket => {
  const bar = '█'.repeat(Math.floor(bucket.percentage / 2));
  
  console.log(`$${bucket.bucketMin}-$${bucket.bucketMax}`);
  console.log(`  ${bar} ${bucket.percentage.toFixed(1)}%`);
  console.log(`  Total OI: ${bucket.totalOI}`);
  console.log(`  Calls: ${bucket.callOI} | Puts: ${bucket.putOI}`);
  console.log('');
});
```

**Output:**
```
=== OPEN INTEREST DISTRIBUTION ===
$90000-$92000
  ████ 8.5%
  Total OI: 800
  Calls: 500 | Puts: 300

$92000-$94000
  ███████████ 22.3%
  Total OI: 2100
  Calls: 1200 | Puts: 900

$94000-$96000
  ████████████████ 32.1%
  Total OI: 3000
  Calls: 1700 | Puts: 1300
...
```

---

### Time-to-Expiry Analysis

```javascript
class ExpiryTracker {
  constructor() {
    this.maxPainCalc = new MaxPainCalculator();
    this.history = [];
  }
  
  async trackMaxPain(options, spotPrice, daysToExpiry) {
    const result = this.maxPainCalc.calculateMaxPain(options, spotPrice);
    
    if (!result) return;
    
    // Store in history
    this.history.push({
      timestamp: Date.now(),
      daysToExpiry,
      maxPainStrike: result.maxPainStrike,
      spotPrice,
      distance: result.analysis.distance,
      distancePct: result.analysis.distancePct
    });
    
    console.log(`[${daysToExpiry} days to expiry]`);
    console.log(`Max Pain: $${result.maxPainStrike}`);
    console.log(`Spot: $${spotPrice}`);
    console.log(`Distance: ${result.analysis.distancePct.toFixed(2)}%`);
    console.log('---');
  }
  
  analyzeConvergence() {
    if (this.history.length < 2) return;
    
    const recent = this.history.slice(-5);
    const distances = recent.map(h => Math.abs(h.distancePct));
    
    const isConverging = distances.every((d, i) => 
      i === 0 || d <= distances[i - 1]
    );
    
    if (isConverging) {
      console.log('✅ CONVERGENCE DETECTED: Price moving toward Max Pain');
    } else {
      console.log('❌ DIVERGENCE: Price moving away from Max Pain');
    }
  }
}

// Usage
const tracker = new ExpiryTracker();

// Track daily as expiry approaches
await tracker.trackMaxPain(options, 98000, 7);  // 7 days to expiry
await tracker.trackMaxPain(options, 97800, 6);  // 6 days to expiry
await tracker.trackMaxPain(options, 97500, 5);  // 5 days to expiry
await tracker.trackMaxPain(options, 97200, 4);  // 4 days to expiry
await tracker.trackMaxPain(options, 97000, 3);  // 3 days to expiry

tracker.analyzeConvergence();
```

---

## Trading Strategies

### 1. Pre-Expiry Pinning

**Setup:**
- Monitor Max Pain 7 days before expiry
- Track distance from spot daily

**Rules:**

| Days to Expiry | Distance from Max Pain | Action |
|----------------|------------------------|--------|
| **7-5 days** | > 3% | No action (too early) |
| **4-3 days** | 2-3% | Watch for convergence |
| **2-1 days** | 1-2% | Enter mean reversion trade |
| **Expiry day** | < 1% | High probability of pinning |

**Example:**
```javascript
if (daysToExpiry <= 2 && Math.abs(distancePct) > 1 && Math.abs(distancePct) < 3) {
  if (spotPrice > maxPainStrike) {
    enterShort('Expect drift down to Max Pain');
  } else {
    enterLong('Expect drift up to Max Pain');
  }
}
```

---

### 2. Max Pain + GEX Combo

**Setup:**
- Calculate both Max Pain and GEX levels
- Look for alignment or divergence

**Rules:**

| Max Pain | GEX Flip Point | Interpretation | Action |
|----------|----------------|----------------|--------|
| **Aligned** | Same strike | Strong pinning zone | Sell straddles/strangles |
| **Divergent** | Different strikes | Conflicting forces | Avoid trading |
| **Max Pain above GEX** | MP > GEX | Bullish pressure | Long positions |
| **Max Pain below GEX** | MP < GEX | Bearish pressure | Short positions |

**Example:**
```javascript
const maxPain = maxPainCalc.calculateMaxPain(options, spotPrice);
const gex = gexCalc.calculateGEX(options, spotPrice);

const maxPainStrike = maxPain.maxPainStrike;
const gexFlipPoint = gex.flipPoint;

if (Math.abs(maxPainStrike - gexFlipPoint) < 500) {
  console.log('🎯 STRONG PINNING ZONE: Max Pain and GEX aligned');
  console.log('→ Sell options at this strike (collect premium)');
  
} else if (maxPainStrike > gexFlipPoint + 1000) {
  console.log('📈 BULLISH SETUP: Max Pain above GEX');
  console.log('→ Consider long positions');
  
} else if (maxPainStrike < gexFlipPoint - 1000) {
  console.log('📉 BEARISH SETUP: Max Pain below GEX');
  console.log('→ Consider short positions');
}
```

---

### 3. Top Strikes Support/Resistance

**Setup:**
- Identify top 5 strikes by OI
- Use as support/resistance levels

**Rules:**

| Price Action | Interpretation | Action |
|--------------|----------------|--------|
| **Price approaches top strike from below** | Resistance | Consider short |
| **Price approaches top strike from above** | Support | Consider long |
| **Price breaks through top strike** | Breakout | Follow momentum |
| **Price consolidates at top strike** | Pinning | Range trade |

**Example:**
```javascript
const topStrikes = maxPainCalc.getTopOIStrikes(options, 5);
const nearestStrike = topStrikes.find(s => Math.abs(s.strike - spotPrice) < 1000);

if (nearestStrike) {
  console.log(`Nearest high-OI strike: $${nearestStrike.strike}`);
  
  if (spotPrice < nearestStrike.strike) {
    console.log('→ Approaching from below (resistance)');
    console.log('→ Watch for rejection or breakout');
  } else {
    console.log('→ Approaching from above (support)');
    console.log('→ Watch for bounce or breakdown');
  }
}
```

---

### 4. OI Distribution Skew

**Setup:**
- Calculate OI distribution
- Identify concentration zones

**Rules:**

| Distribution Pattern | Interpretation | Action |
|---------------------|----------------|--------|
| **Concentrated at one level** | Strong pinning | Sell volatility |
| **Evenly distributed** | No clear bias | Avoid directional trades |
| **Skewed to upside** | Bullish positioning | Long bias |
| **Skewed to downside** | Bearish positioning | Short bias |

**Example:**
```javascript
const distribution = maxPainCalc.calculateOIDistribution(options, 5);

// Find bucket with highest OI
const maxBucket = distribution.reduce((max, b) => 
  b.totalOI > max.totalOI ? b : max
);

const maxPct = maxBucket.percentage;

if (maxPct > 40) {
  console.log('🎯 CONCENTRATED OI: ' + maxPct.toFixed(1) + '%');
  console.log(`→ Range: $${maxBucket.bucketMin}-$${maxBucket.bucketMax}`);
  console.log('→ High probability of pinning in this range');
  
} else if (maxPct < 25) {
  console.log('📊 DISTRIBUTED OI: No clear concentration');
  console.log('→ Expect higher volatility, less predictable movement');
}
```

---

### 5. Max Pain Momentum

**Setup:**
- Track Max Pain over time
- Detect shifts in Max Pain strike

**Rules:**

| Max Pain Movement | Interpretation | Action |
|-------------------|----------------|--------|
| **Stable** (same strike 3+ days) | Strong consensus | High confidence in pinning |
| **Shifting up** | Bullish repositioning | Follow the shift |
| **Shifting down** | Bearish repositioning | Follow the shift |
| **Volatile** (changing daily) | Uncertain market | Reduce position sizes |

**Example:**
```javascript
class MaxPainTracker {
  constructor() {
    this.history = [];
  }
  
  track(maxPainStrike) {
    this.history.push({
      timestamp: Date.now(),
      strike: maxPainStrike
    });
    
    if (this.history.length > 7) {
      this.history.shift();
    }
  }
  
  analyze() {
    if (this.history.length < 3) return;
    
    const strikes = this.history.map(h => h.strike);
    const uniqueStrikes = [...new Set(strikes)];
    
    if (uniqueStrikes.length === 1) {
      console.log('✅ STABLE MAX PAIN: High confidence');
      
    } else {
      const trend = strikes[strikes.length - 1] > strikes[0] ? 'UP' : 'DOWN';
      console.log(`📊 MAX PAIN SHIFTING ${trend}`);
      console.log('→ Market repositioning, follow the trend');
    }
  }
}
```

---

## Interpretation Guidelines

### Distance from Spot

| Distance | Interpretation | Confidence |
|----------|----------------|------------|
| **< 0.5%** | Very close - high pinning probability | HIGH |
| **0.5-1%** | Close - moderate pinning probability | MEDIUM |
| **1-2%** | Moderate distance - weak pinning | LOW |
| **2-3%** | Significant distance - trend may override | VERY LOW |
| **> 3%** | Far - pinning unlikely, other forces dominate | NONE |

### Time to Expiry

| Days to Expiry | Max Pain Influence | Notes |
|----------------|-------------------|-------|
| **> 7 days** | Low | Too early, other factors dominate |
| **5-7 days** | Moderate | Start monitoring |
| **3-4 days** | High | Pinning pressure builds |
| **1-2 days** | Very High | Strong pinning effect |
| **Expiry day** | Extreme | Maximum pinning probability |

### OI Magnitude

| Total OI at Max Pain | Interpretation |
|---------------------|----------------|
| **> 10,000 BTC** | Very strong pinning force |
| **5,000-10,000 BTC** | Strong pinning force |
| **1,000-5,000 BTC** | Moderate pinning force |
| **< 1,000 BTC** | Weak pinning force |

---

## Limitations & Caveats

### 1. Not a Standalone Signal

**Limitation:**  
Max Pain is **not predictive** - it's a gravitational force, not a guarantee.

**Mitigation:**
- Combine with other indicators (GEX, RSI, volume)
- Use as one input in a multi-factor model
- Don't trade Max Pain alone

### 2. Time Dependency

**Limitation:**  
Max Pain effect is **strongest near expiry** (1-3 days).

**Impact:**
- Weak or no effect > 7 days to expiry
- Can be overridden by news, trends, volatility

**Mitigation:**
- Only trade Max Pain within 3 days of expiry
- Reduce position size > 3 days out
- Monitor time decay of pinning effect

### 3. Strong Trends Override

**Limitation:**  
In **strong directional markets**, Max Pain is often ignored.

**Example:**
```
Max Pain: $95,000
Spot: $100,000
Strong bull trend: Price continues to $105,000 despite Max Pain
```

**Mitigation:**
- Check trend strength (ADX, moving averages)
- Don't fade strong trends based on Max Pain alone
- Use Max Pain for range-bound markets

### 4. OI Can Change

**Limitation:**  
Open Interest is **not static** - it changes as traders open/close positions.

**Impact:**
- Max Pain strike can shift
- Yesterday's Max Pain may not be today's

**Mitigation:**
- Recalculate Max Pain daily
- Track Max Pain movement over time
- Be aware of large OI changes

### 5. Multiple Expiries

**Limitation:**  
If analyzing multiple expiries, **near-term expiry dominates**.

**Example:**
```
Weekly expiry Max Pain: $97,000 (high OI)
Monthly expiry Max Pain: $100,000 (moderate OI)

Result: Price likely gravitates to $97,000 (weekly dominates)
```

**Mitigation:**
- Focus on nearest expiry
- Weight by OI and time to expiry
- Separate analysis for each expiry

### 6. Market Maker Sophistication

**Consideration:**  
Modern market makers use **complex hedging strategies** beyond simple delta hedging.

**Impact:**
- Max Pain effect may be weaker than in the past
- Other factors (gamma, vanna, charm) also matter

**Mitigation:**
- Combine Max Pain with GEX analysis
- Consider higher-order Greeks
- Don't assume perfect pinning

---

## Performance Considerations

### Computational Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Group OI by strike | O(n) | n = number of options |
| Find Max Pain | O(m log m) | m = number of strikes |
| Calculate distribution | O(n + m) | Linear in options + strikes |
| **Overall** | **O(n + m log m)** | Fast for typical datasets |

### Memory Usage

| Component | Size | Notes |
|-----------|------|-------|
| Strike OI map | ~1KB per 100 strikes | Lightweight |
| Distribution | <1KB | Small array |
| **Total** | **~2KB** | Minimal memory footprint |

### Optimization Tips

1. **Cache OI grouping**: Reuse `strikeOIMap` for multiple calculations
2. **Filter by expiry**: Only include options for target expiry
3. **Batch calculations**: Calculate Max Pain for multiple expiries at once
4. **Pre-filter options**: Remove options with zero OI before calculation

---

## API Integration

### REST Endpoints

```
GET /api/max-pain
GET /api/max-pain/top-strikes
GET /api/max-pain/distribution
```

See [API_REFERENCE.md](./API_REFERENCE.md) for details.

### Example API Response

```json
{
  "success": true,
  "data": {
    "maxPainStrike": 97000,
    "maxPainOI": 3800,
    "maxPainCallOI": 2000,
    "maxPainPutOI": 1800,
    "analysis": {
      "spotPrice": 98000,
      "distance": -1000,
      "distancePct": -1.02,
      "direction": "BELOW_SPOT",
      "interpretation": "Max Pain 1.02% abaixo - pressão de baixa esperada"
    },
    "topStrikes": [
      { "strike": 97000, "totalOI": 3800 },
      { "strike": 96000, "totalOI": 2700 },
      { "strike": 95000, "totalOI": 2000 }
    ]
  },
  "timestamp": 1705334400000
}
```

---

## Related Components

- **GEXCalculator**: Gamma Exposure analysis (complementary)
- **OptionsCollector**: Collects options data with OI
- **DataCollector**: Caches Max Pain calculations
- **Max Pain Routes**: API endpoints for Max Pain data

---

## References

### Theory

1. **Max Pain Theory**: Investopedia, Options Industry Council
2. **Option Pinning**: Academic papers on expiry effects
3. **Market Maker Hedging**: "Dynamic Hedging" by Nassim Taleb

### Empirical Studies

1. **Pinning Effect**: Studies showing price clustering at high-OI strikes
2. **Time to Expiry**: Research on pinning strength vs. expiry date
3. **Market Maker Behavior**: Analysis of dealer hedging patterns

### Internal Documentation

- [GEX_CALCULATOR.md](./GEX_CALCULATOR.md)
- [API_REFERENCE.md](./API_REFERENCE.md)
- [PROJECT_MAP.md](../PROJECT_MAP.md)

---

## Changelog

### v1.0.0 (Current)
- Initial implementation
- Basic Max Pain calculation
- Top strikes analysis
- OI distribution
- Distance analysis and interpretation

### Planned Features

- [ ] Multi-expiry Max Pain aggregation
- [ ] Historical Max Pain tracking
- [ ] Max Pain accuracy backtesting
- [ ] Integration with GEX for combined signals
- [ ] Real-time Max Pain updates via WebSocket

---

## Support

For questions or issues:
- Check [API_REFERENCE.md](./API_REFERENCE.md)
- Review [PROJECT_MAP.md](../PROJECT_MAP.md)
- See code: `backend/src/calculators/MaxPainCalculator.js`

---

**Last Updated:** January 15, 2026  
**Version:** 1.0.0  
**Author:** Valter Russo / Gamma Tracker Team
