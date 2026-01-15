# IV Comparator Documentation

## Overview

The **IV Comparator** analyzes **Implied Volatility (IV)** differences between **Binance** (retail market) and **Deribit** (institutional market) to detect divergences, arbitrage opportunities, and sentiment shifts. It calculates the **Retail Panic Index** to quantify retail fear and generates actionable trading insights.

## What is IV Comparison?

**IV Comparison** reveals the difference in risk pricing between retail and institutional traders. Key insights include:

1. **Retail vs Institutional Sentiment**: Who is more fearful?
2. **Arbitrage Opportunities**: Exploit pricing inefficiencies
3. **Liquidity Gaps**: Identify where to trade specific options
4. **Smart Money Positioning**: Follow institutional flow

### Why Compare Binance vs Deribit?

| Exchange | Trader Type | Characteristics |
|----------|-------------|-----------------|
| **Binance** | Retail | Emotional, reactive, less sophisticated |
| **Deribit** | Institutional | Professional, hedged, more efficient |

**Divergences** between the two reveal:
- **Retail panic** (Binance IV > Deribit IV)
- **Institutional hedging** (Deribit IV > Binance IV)
- **Arbitrage opportunities** (large spreads)

---

## Key Metrics

### 1. ATM Spread

**Definition:**  
Difference in At-The-Money Implied Volatility.

```
ATM Spread = Binance ATM IV - Deribit ATM IV
```

**Interpretation:**

| Spread | Meaning |
|--------|---------|
| **> +10pp** | Binance pricing more risk (retail fear) |
| **-10pp to +10pp** | Aligned pricing (normal) |
| **< -10pp** | Deribit pricing more risk (institutional hedging) |

---

### 2. Put Spread

**Definition:**  
Difference in Out-of-The-Money Put IV.

```
Put Spread = Binance OTM Put IV - Deribit OTM Put IV
```

**Interpretation:**

| Spread | Meaning |
|--------|---------|
| **> +15pp** | Retail panic - overpaying for protection |
| **0 to +15pp** | Normal retail premium |
| **< 0** | Institutional hedging (rare) |

**Most Important Metric:**  
Put spread is the most reliable indicator of retail sentiment.

---

### 3. Call Spread

**Definition:**  
Difference in Out-of-The-Money Call IV.

```
Call Spread = Binance OTM Call IV - Deribit OTM Call IV
```

**Interpretation:**

| Spread | Meaning |
|--------|---------|
| **> +10pp** | Retail FOMO - chasing upside |
| **-10pp to +10pp** | Normal |
| **< -10pp** | Institutional positioning (rare) |

---

### 4. Skew Spread

**Definition:**  
Difference in Put/Call IV Skew Ratio.

```
Skew Spread = Binance Skew Ratio - Deribit Skew Ratio
```

**Interpretation:**

| Spread | Meaning |
|--------|---------|
| **> +0.3** | Retail more bearish than institutions |
| **-0.3 to +0.3** | Aligned sentiment |
| **< -0.3** | Institutions more bearish than retail |

---

### 5. Retail Panic Index (RPI)

**Definition:**  
Ratio of Binance Put IV to Deribit Put IV, expressed as an index.

```
RPI = (Binance OTM Put IV / Deribit OTM Put IV) × 100
```

**Interpretation:**

| RPI | Level | Meaning | Action |
|-----|-------|---------|--------|
| **100** | Parity | Both pricing equal risk | Neutral |
| **100-120** | Slight premium | Normal retail fear | Monitor |
| **120-150** | Moderate panic | Retail overpaying | Consider fade |
| **> 150** | Extreme panic | Arbitrage opportunity | Sell Binance puts, buy Deribit puts |
| **< 100** | Unusual | Retail underpricing (rare) | Investigate |

**Example:**
```
Binance OTM Put IV: 75%
Deribit OTM Put IV: 60%
RPI = (75 / 60) × 100 = 125

→ Moderate retail panic
```

---

## Alert Types

### 1. ATM_DIVERGENCE

**Trigger:** `|ATM Spread| > 10pp`

**Severity:**
- **HIGH**: Spread > 15pp
- **MEDIUM**: Spread 10-15pp

**Example:**
```
Binance ATM IV: 65%
Deribit ATM IV: 50%
Spread: +15pp

→ Alert: HIGH severity ATM divergence
→ Retail pricing 15pp more risk
```

---

### 2. PUT_DIVERGENCE

**Trigger:** `|Put Spread| > 15pp`

**Severity:**
- **HIGH**: Spread > 25pp
- **MEDIUM**: Spread 15-25pp

**Example:**
```
Binance OTM Put IV: 80%
Deribit OTM Put IV: 55%
Spread: +25pp

→ Alert: HIGH severity put divergence
→ Retail panic detected
```

**Most Important Alert:**  
Put divergence is the strongest signal of retail sentiment.

---

### 3. CALL_DIVERGENCE

**Trigger:** `|Call Spread| > 10pp`

**Severity:** **LOW** (less reliable)

**Example:**
```
Binance OTM Call IV: 60%
Deribit OTM Call IV: 48%
Spread: +12pp

→ Alert: LOW severity call divergence
→ Retail FOMO detected
```

---

### 4. RETAIL_PANIC

**Trigger:** `RPI > 120`

**Severity:**
- **HIGH**: RPI > 150
- **MEDIUM**: RPI 120-150

**Example:**
```
RPI: 145

→ Alert: MEDIUM severity retail panic
→ Retail overpaying for protection
→ Consider arbitrage or fading
```

---

### 5. LIQUIDITY_GAP

**Trigger:** Binance missing OTM options data

**Severity:** **LOW**

**Example:**
```
Binance: No OTM calls available
Deribit: 15 OTM call strikes available

→ Alert: Liquidity gap
→ Use Deribit for OTM call hedging
```

---

### 6. SKEW_DIVERGENCE

**Trigger:** `|Skew Spread| > 0.3`

**Severity:** **MEDIUM**

**Example:**
```
Binance Skew: 1.35
Deribit Skew: 1.05
Spread: +0.30

→ Alert: Skew divergence
→ Retail more bearish than institutions
```

---

## Insight Types

### 1. ARBITRAGE_OPPORTUNITY

**Trigger:** `Put Spread > 20pp`

**Action:** Sell Binance puts, buy Deribit puts

**Example:**
```
Put Spread: +22pp

→ Insight: Arbitrage opportunity
→ Sell Binance puts at 75% IV
→ Buy Deribit puts at 53% IV
→ Capture 22pp spread
```

**Risk:** **MEDIUM** (execution risk, liquidity)

---

### 2. RETAIL_OVERREACTION

**Trigger:** `RPI > 130`

**Action:** Fade retail sentiment

**Example:**
```
RPI: 140

→ Insight: Retail overreaction
→ Retail panic likely overdone
→ Consider contrarian positions
```

**Risk:** **HIGH** (retail can stay irrational)

---

### 3. SMART_MONEY_POSITIONING

**Trigger:** `ATM Spread < -5pp`

**Action:** Follow institutional flow

**Example:**
```
ATM Spread: -8pp

→ Insight: Smart money positioning
→ Institutions pricing 8pp more risk
→ Watch for move, follow institutions
```

**Risk:** **LOW** (institutions usually right)

---

### 4. LIQUIDITY_RECOMMENDATION

**Trigger:** Binance missing OTM data

**Action:** Use Deribit for OTM hedging

**Example:**
```
Binance: 0 OTM call strikes
Deribit: 15 OTM call strikes

→ Insight: Liquidity recommendation
→ Use Deribit for OTM call hedging
```

**Risk:** **LOW**

---

### 5. MARKET_CONVERGENCE

**Trigger:** `|ATM Spread| < 5pp` AND `RPI < 110`

**Action:** No arbitrage, normal conditions

**Example:**
```
ATM Spread: +3pp
RPI: 105

→ Insight: Market convergence
→ Binance and Deribit aligned
→ No significant opportunities
```

**Risk:** **LOW**

---

## Implementation

### Constructor

```javascript
const IVComparator = require('./calculators/IVComparator');

const comparator = new IVComparator(binanceAPI, deribitAPI, logger);
```

**Parameters:**
- `binanceAPI`: Binance API instance
- `deribitAPI`: Deribit API instance
- `logger`: Logger instance (optional)

**Configuration:**
```javascript
comparator.thresholds = {
  atmSpread: 10,        // pp
  putSpread: 15,        // pp
  callSpread: 10,       // pp
  skewSpread: 0.3,      // ratio
  retailPanicIndex: 120 // index value
};
```

---

## API Methods

### `compare(dte)`

Compare IV metrics for a specific DTE.

**Parameters:**
- `dte` (Number): Days to expiry (default: 1)

**Returns:**
```javascript
{
  success: true,
  dte: 1,
  timestamp: 1705334400000,
  binance: {
    atmIV: 65,
    otmPutIV: 75,
    otmCallIV: 58,
    skewRatio: 1.29,
    pcSpread: 17
  },
  deribit: {
    atmIV: 60,
    otmPutIV: 62,
    otmCallIV: 55,
    skewRatio: 1.13,
    pcSpread: 7
  },
  spreads: {
    atmSpread: 5,
    putSpread: 13,
    callSpread: 3,
    skewSpread: 0.16,
    pcSpread: 10
  },
  retailPanicIndex: 121,
  alerts: [
    {
      type: 'RETAIL_PANIC',
      severity: 'MEDIUM',
      message: 'Retail Panic Index at 121.0 - Retail overpaying for protection',
      value: 121,
      timestamp: 1705334400000
    }
  ],
  insights: [
    {
      type: 'RETAIL_OVERREACTION',
      message: 'Retail panic index at 121.0 suggests overreaction - Consider fading retail sentiment',
      confidence: 'MEDIUM',
      risk: 'HIGH'
    }
  ]
}
```

**Example:**
```javascript
const comparison = await comparator.compare(1); // 1 DTE

console.log('Retail Panic Index:', comparison.retailPanicIndex.toFixed(1));
console.log('Put Spread:', comparison.spreads.putSpread.toFixed(1) + 'pp');
console.log('Alerts:', comparison.alerts.length);
console.log('Insights:', comparison.insights.length);
```

---

### `compareMultipleDTE(dtes)`

Compare multiple DTEs at once.

**Parameters:**
- `dtes` (Array): Array of DTEs to compare (default: [1, 2, 3, 7, 30])

**Returns:**
```javascript
{
  1: { success: true, dte: 1, ... },
  2: { success: true, dte: 2, ... },
  3: { success: true, dte: 3, ... },
  7: { success: true, dte: 7, ... },
  30: { success: true, dte: 30, ... }
}
```

**Example:**
```javascript
const comparisons = await comparator.compareMultipleDTE([1, 7, 30]);

Object.entries(comparisons).forEach(([dte, comp]) => {
  console.log(`${dte} DTE: RPI=${comp.retailPanicIndex?.toFixed(1) || 'N/A'}, Alerts=${comp.alerts?.length || 0}`);
});
```

---

### `getSpreadHistory(dte, hours)`

Get historical spread data.

**Parameters:**
- `dte` (Number, optional): Filter by DTE
- `hours` (Number, default: 24): Hours of history

**Returns:**
```javascript
[
  {
    dte: 1,
    timestamp: 1705334100000,
    spreads: { atmSpread: 5, putSpread: 13, ... },
    retailPanicIndex: 121,
    alertCount: 1
  },
  // ... more history
]
```

**Example:**
```javascript
const history = comparator.getSpreadHistory(1, 24); // Last 24 hours for 1 DTE

console.log('=== SPREAD HISTORY (24H) ===');
history.forEach(h => {
  const time = new Date(h.timestamp).toLocaleTimeString();
  console.log(`${time}: RPI=${h.retailPanicIndex?.toFixed(1) || 'N/A'}, Put Spread=${h.spreads.putSpread?.toFixed(1) || 'N/A'}pp`);
});
```

---

### `getStats()`

Get statistics for recent comparisons.

**Returns:**
```javascript
{
  comparisons: 12,
  avgRetailPanicIndex: 118.5,
  avgAtmSpread: 4.2,
  avgPutSpread: 11.8,
  totalAlerts: 5
}
```

**Example:**
```javascript
const stats = comparator.getStats();

console.log('=== COMPARATOR STATS (Last Hour) ===');
console.log('Comparisons:', stats.comparisons);
console.log('Avg RPI:', stats.avgRetailPanicIndex?.toFixed(1) || 'N/A');
console.log('Avg ATM Spread:', stats.avgAtmSpread?.toFixed(1) || 'N/A' + 'pp');
console.log('Avg Put Spread:', stats.avgPutSpread?.toFixed(1) || 'N/A' + 'pp');
console.log('Total Alerts:', stats.totalAlerts);
```

---

## Usage Examples

### Basic Comparison

```javascript
const IVComparator = require('./calculators/IVComparator');

const comparator = new IVComparator(binanceAPI, deribitAPI, logger);

// Compare 1 DTE
const comparison = await comparator.compare(1);

if (comparison.success) {
  console.log('=== IV COMPARISON (1 DTE) ===');
  console.log('Retail Panic Index:', comparison.retailPanicIndex.toFixed(1));
  console.log('ATM Spread:', comparison.spreads.atmSpread.toFixed(1) + 'pp');
  console.log('Put Spread:', comparison.spreads.putSpread.toFixed(1) + 'pp');
  console.log('');
  console.log('Alerts:', comparison.alerts.length);
  comparison.alerts.forEach(alert => {
    console.log(`  [${alert.severity}] ${alert.type}: ${alert.message}`);
  });
  console.log('');
  console.log('Insights:', comparison.insights.length);
  comparison.insights.forEach(insight => {
    console.log(`  [${insight.confidence}] ${insight.type}: ${insight.message}`);
  });
}
```

---

### Arbitrage Detection

```javascript
const comparison = await comparator.compare(1);

if (comparison.success) {
  const putSpread = comparison.spreads.putSpread;
  const rpi = comparison.retailPanicIndex;
  
  console.log('=== ARBITRAGE ANALYSIS ===');
  console.log('Put Spread:', putSpread.toFixed(1) + 'pp');
  console.log('Retail Panic Index:', rpi.toFixed(1));
  
  if (putSpread > 20) {
    console.log('');
    console.log('🎯 ARBITRAGE OPPORTUNITY DETECTED!');
    console.log('Strategy:');
    console.log(`  1. Sell Binance ${comparison.binance.otmPutIV.toFixed(1)}% IV puts`);
    console.log(`  2. Buy Deribit ${comparison.deribit.otmPutIV.toFixed(1)}% IV puts`);
    console.log(`  3. Capture ${putSpread.toFixed(1)}pp spread`);
    console.log('');
    console.log('Risk: Execution risk, liquidity constraints');
  } else {
    console.log('');
    console.log('✅ No significant arbitrage opportunity');
  }
}
```

---

### Retail Panic Monitoring

```javascript
class RetailPanicMonitor {
  constructor() {
    this.comparator = new IVComparator(binanceAPI, deribitAPI, logger);
  }
  
  async monitor() {
    const comparison = await this.comparator.compare(1);
    
    if (!comparison.success) return;
    
    const rpi = comparison.retailPanicIndex;
    
    console.log(`[${new Date().toLocaleTimeString()}] RPI: ${rpi.toFixed(1)}`);
    
    if (rpi > 150) {
      console.log('🚨 EXTREME RETAIL PANIC!');
      console.log('→ Retail massively overpaying for protection');
      console.log('→ Strong arbitrage opportunity');
      console.log('→ Consider contrarian long positions');
      this.onExtremePanic(comparison);
      
    } else if (rpi > 120) {
      console.log('⚠️ MODERATE RETAIL PANIC');
      console.log('→ Retail overpaying for protection');
      console.log('→ Monitor for arbitrage');
      this.onModeratePanic(comparison);
      
    } else if (rpi < 100) {
      console.log('❓ UNUSUAL: Retail underpricing risk');
      console.log('→ Investigate data quality');
      
    } else {
      console.log('✅ Normal conditions');
    }
  }
  
  onExtremePanic(comparison) {
    // Execute arbitrage
    console.log('Executing arbitrage strategy...');
  }
  
  onModeratePanic(comparison) {
    // Monitor closely
    console.log('Monitoring for entry...');
  }
}

// Usage
const monitor = new RetailPanicMonitor();
setInterval(() => monitor.monitor(), 300000); // Every 5 minutes
```

---

### Multi-DTE Analysis

```javascript
const comparisons = await comparator.compareMultipleDTE([1, 2, 3, 7, 30]);

console.log('=== MULTI-DTE ANALYSIS ===');

Object.entries(comparisons).forEach(([dte, comp]) => {
  if (!comp.success) {
    console.log(`${dte} DTE: Data unavailable`);
    return;
  }
  
  console.log(`\n${dte} DTE:`);
  console.log(`  RPI: ${comp.retailPanicIndex?.toFixed(1) || 'N/A'}`);
  console.log(`  ATM Spread: ${comp.spreads.atmSpread?.toFixed(1) || 'N/A'}pp`);
  console.log(`  Put Spread: ${comp.spreads.putSpread?.toFixed(1) || 'N/A'}pp`);
  console.log(`  Alerts: ${comp.alerts.length}`);
});

// Detect term structure
const rpis = Object.values(comparisons)
  .filter(c => c.success && c.retailPanicIndex)
  .map(c => ({ dte: c.dte, rpi: c.retailPanicIndex }));

if (rpis.length > 1) {
  console.log('\n=== TERM STRUCTURE ===');
  const nearTerm = rpis.find(r => r.dte <= 3);
  const longTerm = rpis.find(r => r.dte >= 30);
  
  if (nearTerm && longTerm) {
    if (nearTerm.rpi > longTerm.rpi + 10) {
      console.log('→ Near-term panic higher than long-term');
      console.log('→ Short-term fear, long-term calm');
    } else if (longTerm.rpi > nearTerm.rpi + 10) {
      console.log('→ Long-term panic higher than near-term');
      console.log('→ Structural bearish positioning');
    } else {
      console.log('→ Consistent panic across terms');
    }
  }
}
```

---

### Trading Bot Integration

```javascript
class IVArbitrageBot {
  constructor() {
    this.comparator = new IVComparator(binanceAPI, deribitAPI, logger);
  }
  
  async run() {
    const comparison = await this.comparator.compare(1);
    
    if (!comparison.success) {
      console.log('Comparison failed, skipping...');
      return;
    }
    
    // Check for arbitrage
    const arbitrageInsights = comparison.insights.filter(
      i => i.type === 'ARBITRAGE_OPPORTUNITY'
    );
    
    if (arbitrageInsights.length > 0) {
      console.log('🎯 Arbitrage detected!');
      await this.executeArbitrage(comparison);
      return;
    }
    
    // Check for retail overreaction
    const overreactionInsights = comparison.insights.filter(
      i => i.type === 'RETAIL_OVERREACTION'
    );
    
    if (overreactionInsights.length > 0) {
      console.log('📉 Retail overreaction detected!');
      await this.fadeRetail(comparison);
      return;
    }
    
    // Check for smart money positioning
    const smartMoneyInsights = comparison.insights.filter(
      i => i.type === 'SMART_MONEY_POSITIONING'
    );
    
    if (smartMoneyInsights.length > 0) {
      console.log('💼 Smart money positioning detected!');
      await this.followInstitutions(comparison);
      return;
    }
    
    console.log('✅ No trading opportunities');
  }
  
  async executeArbitrage(comparison) {
    const putSpread = comparison.spreads.putSpread;
    
    console.log(`Executing arbitrage: ${putSpread.toFixed(1)}pp spread`);
    console.log('1. Sell Binance puts');
    console.log('2. Buy Deribit puts');
    
    // Execute trades
    // ...
  }
  
  async fadeRetail(comparison) {
    const rpi = comparison.retailPanicIndex;
    
    console.log(`Fading retail: RPI=${rpi.toFixed(1)}`);
    console.log('→ Retail overpaying, take contrarian position');
    
    // Execute trades
    // ...
  }
  
  async followInstitutions(comparison) {
    const atmSpread = comparison.spreads.atmSpread;
    
    console.log(`Following institutions: ATM spread=${atmSpread.toFixed(1)}pp`);
    console.log('→ Institutions pricing more risk, follow their lead');
    
    // Execute trades
    // ...
  }
}
```

---

## Trading Strategies

### Strategy 1: IV Arbitrage

**Setup:**
- Put Spread > 20pp
- Sufficient liquidity on both exchanges

**Execution:**
1. Sell Binance puts (high IV)
2. Buy Deribit puts (low IV)
3. Capture spread

**Example:**
```javascript
if (putSpread > 20) {
  sellBinancePuts({ strike: 95000, iv: 75 });
  buyDeribitPuts({ strike: 95000, iv: 53 });
  // Capture 22pp spread
}
```

**Risk:** Execution risk, liquidity constraints

---

### Strategy 2: Fade Retail Panic

**Setup:**
- RPI > 130
- No fundamental reason for panic

**Execution:**
1. Sell Binance puts (overpriced)
2. Or buy spot/futures (contrarian long)

**Example:**
```javascript
if (rpi > 130 && noFundamentalNews()) {
  sellBinancePuts({ strike: 95000 });
  // Or
  buySpot({ size: 1.0 });
}
```

**Risk:** HIGH - retail can stay irrational

---

### Strategy 3: Follow Smart Money

**Setup:**
- ATM Spread < -5pp (Deribit pricing more risk)
- Institutional flow confirmed

**Execution:**
1. Follow Deribit positioning
2. Buy protection or reduce longs

**Example:**
```javascript
if (atmSpread < -5) {
  buyDeribitPuts({ strike: 95000 });
  // Institutions are hedging, follow them
}
```

**Risk:** LOW - institutions usually right

---

### Strategy 4: Liquidity Routing

**Setup:**
- Binance missing OTM options
- Need to hedge OTM

**Execution:**
1. Use Deribit for OTM hedging
2. Use Binance for ATM liquidity

**Example:**
```javascript
if (!binance.otmCallIV && deribit.otmCallIV) {
  buyDeribitCalls({ strike: 105000 }); // OTM
  buyBinanceCalls({ strike: 98000 });  // ATM
}
```

**Risk:** LOW - just routing to best liquidity

---

## Interpretation Guidelines

### Spread Magnitudes

| Spread | Magnitude | Action |
|--------|-----------|--------|
| **< 5pp** | Small | Normal, no action |
| **5-15pp** | Moderate | Monitor |
| **15-25pp** | Large | Consider arbitrage |
| **> 25pp** | Extreme | Strong arbitrage |

### RPI Levels

| RPI | Level | Confidence | Action |
|-----|-------|------------|--------|
| **< 100** | Unusual | LOW | Investigate |
| **100-110** | Normal | HIGH | No action |
| **110-120** | Slight panic | MEDIUM | Monitor |
| **120-150** | Moderate panic | HIGH | Consider fade |
| **> 150** | Extreme panic | VERY HIGH | Execute arbitrage |

### Alert Priorities

| Alert Type | Priority | Action Required |
|------------|----------|-----------------|
| **PUT_DIVERGENCE** | HIGH | Immediate review |
| **RETAIL_PANIC** | HIGH | Immediate review |
| **ATM_DIVERGENCE** | MEDIUM | Review within 1 hour |
| **SKEW_DIVERGENCE** | MEDIUM | Review within 1 hour |
| **CALL_DIVERGENCE** | LOW | Review when convenient |
| **LIQUIDITY_GAP** | LOW | Note for future |

---

## Limitations & Caveats

### 1. Execution Risk

**Challenge:**  
Spreads can disappear before execution.

**Mitigation:**
- Use limit orders
- Execute quickly
- Account for slippage

### 2. Liquidity Constraints

**Challenge:**  
May not be able to execute large size.

**Mitigation:**
- Check order book depth
- Scale into positions
- Use multiple strikes

### 3. Retail Can Stay Irrational

**Challenge:**  
RPI can stay elevated for extended periods.

**Mitigation:**
- Use stop losses
- Don't over-leverage
- Wait for confirmation

### 4. Data Quality

**Challenge:**  
APIs may have stale or missing data.

**Mitigation:**
- Check timestamps
- Validate with multiple sources
- Use confidence levels

### 5. Market Maker Risk

**Challenge:**  
Market makers may not be hedging as expected.

**Mitigation:**
- Combine with GEX analysis
- Check volume
- Monitor for changes

---

## Performance Considerations

### Computational Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Compare single DTE | O(1) | API calls |
| Compare multiple DTEs | O(n) | n = number of DTEs |
| Calculate spreads | O(1) | Simple math |
| Detect divergences | O(1) | Threshold checks |
| **Overall** | **O(n)** | Fast |

### Memory Usage

| Component | Size | Notes |
|-----------|------|-------|
| Single comparison | ~5KB | Minimal |
| History (24h) | ~1.5MB | 288 comparisons |
| **Total** | **~1.5MB** | Lightweight |

---

## API Integration

### REST Endpoints

```
GET /api/iv-compare?dte=1
GET /api/iv-compare/multi?dtes=1,7,30
GET /api/iv-compare/history?dte=1&hours=24
GET /api/iv-compare/stats
```

See [API_REFERENCE.md](./API_REFERENCE.md) for details.

---

## Related Components

- **Binance API**: Retail options data source
- **Deribit API**: Institutional options data source
- **SentimentAnalyzer**: Complementary sentiment analysis
- **GEXCalculator**: Gamma exposure analysis

---

## References

### Theory

1. **Implied Volatility**: "Options, Futures, and Other Derivatives" by John Hull
2. **Retail vs Institutional**: Academic papers on market microstructure
3. **Arbitrage**: "Dynamic Hedging" by Nassim Taleb

### Empirical Studies

1. **IV Spreads**: Studies on exchange pricing differences
2. **Retail Sentiment**: Research on retail panic indicators
3. **Arbitrage Opportunities**: Analysis of cross-exchange inefficiencies

### Internal Documentation

- [SENTIMENT_ANALYZER.md](./SENTIMENT_ANALYZER.md)
- [GEX_CALCULATOR.md](./GEX_CALCULATOR.md)
- [API_REFERENCE.md](./API_REFERENCE.md)
- [PROJECT_MAP.md](../PROJECT_MAP.md)

---

## Changelog

### v1.0.0 (Current)
- Initial implementation
- Binance vs Deribit comparison
- Retail Panic Index
- 6 alert types
- 5 insight types
- Multi-DTE support
- Historical tracking

### Planned Features

- [ ] Real-time WebSocket updates
- [ ] Automated arbitrage execution
- [ ] Machine learning for panic prediction
- [ ] Multi-asset support (ETH, SOL)
- [ ] Integration with trading bots

---

## Support

For questions or issues:
- Check [API_REFERENCE.md](./API_REFERENCE.md)
- Review [PROJECT_MAP.md](../PROJECT_MAP.md)
- See code: `backend/src/calculators/IVComparator.js`

---

**Last Updated:** January 15, 2026  
**Version:** 1.0.0  
**Author:** Valter Russo / Gamma Tracker Team
