# RSI Calculator Documentation

## Overview

The **RSI Calculator** computes the **Relative Strength Index (RSI)**, a momentum oscillator that measures the speed and magnitude of price changes. Unlike traditional implementations that use order book data, this calculator uses **actual candle data from Binance** for more accurate and reliable RSI values.

## What is RSI?

**RSI (Relative Strength Index)** is a technical indicator developed by J. Welles Wilder Jr. in 1978. It oscillates between 0 and 100 and is primarily used to identify:

- **Overbought conditions** (RSI ≥ 70)
- **Oversold conditions** (RSI ≤ 30)
- **Momentum strength**
- **Potential reversals** (via divergences)

### Key Characteristics

| Feature | Value |
|---------|-------|
| **Range** | 0 - 100 |
| **Overbought** | ≥ 70 |
| **Oversold** | ≤ 30 |
| **Neutral** | 30 - 70 |
| **Default Period** | 14 |
| **Calculation Method** | Wilder's Smoothing |

---

## Implementation Details

### Data Source

**Binance Klines API:**
```
GET https://api.binance.com/api/v3/klines
```

**Parameters:**
- `symbol`: BTCUSDT (configurable)
- `interval`: 15m (configurable)
- `limit`: 100 candles (configurable)

**Why Candles vs Order Book?**

| Aspect | Candles (Our Approach) | Order Book |
|--------|------------------------|------------|
| **Accuracy** | ✅ Actual traded prices | ❌ Bid/ask quotes |
| **Stability** | ✅ Stable (closed candles) | ❌ Volatile (real-time) |
| **Standard** | ✅ Industry standard | ❌ Non-standard |
| **Comparability** | ✅ Matches TradingView, etc. | ❌ Unique to implementation |
| **Historical** | ✅ Full history available | ❌ Limited history |

---

## Core Algorithm

### 1. Wilder's Smoothing Method

**Step 1: Calculate Initial Averages**

For the first `period` (default 14) candles:

```javascript
Average Gain = Sum of Gains / Period
Average Loss = Sum of Losses / Period
```

**Step 2: Smooth Subsequent Values**

For each subsequent candle:

```javascript
Average Gain = (Previous Avg Gain × (Period - 1) + Current Gain) / Period
Average Loss = (Previous Avg Loss × (Period - 1) + Current Loss) / Period
```

**Step 3: Calculate RS and RSI**

```javascript
RS = Average Gain / Average Loss
RSI = 100 - (100 / (1 + RS))
```

### 2. Edge Cases

| Condition | RSI Value | Rationale |
|-----------|-----------|-----------|
| `avgLoss === 0 && avgGain === 0` | 50 | No movement = neutral |
| `avgLoss === 0 && avgGain > 0` | 100 | Only gains = maximum overbought |
| `avgGain === 0 && avgLoss > 0` | 0 | Only losses = maximum oversold |

---

## Configuration

### Constructor Options

```javascript
const rsiCalc = new RSICalculator(logger, {
  symbol: 'BTCUSDT',              // Trading pair
  interval: '15m',                // Candle interval
  period: 14,                     // RSI period
  candleLimit: 100,               // Number of candles to fetch
  updateInterval: 900000,         // Auto-update interval (ms)
  overboughtThreshold: 70,        // Overbought level
  oversoldThreshold: 30           // Oversold level
});
```

### Supported Intervals

| Interval | Description | Update Frequency |
|----------|-------------|------------------|
| `1m` | 1 minute | Every 1 minute |
| `5m` | 5 minutes | Every 5 minutes |
| `15m` | 15 minutes (default) | Every 15 minutes |
| `1h` | 1 hour | Every 1 hour |
| `4h` | 4 hours | Every 4 hours |
| `1d` | 1 day | Every 1 day |

### Recommended Periods

| Period | Use Case | Sensitivity |
|--------|----------|-------------|
| **9** | Short-term trading | High (more signals) |
| **14** | Standard (default) | Medium (balanced) |
| **21** | Swing trading | Low (fewer signals) |
| **25** | Long-term | Very low (rare signals) |

---

## API Methods

### Lifecycle Methods

#### `start()`

Start auto-updating RSI at configured interval.

```javascript
rsiCalc.start();
// First update: immediate
// Subsequent updates: every 15 minutes (default)
```

#### `stop()`

Stop auto-updating.

```javascript
rsiCalc.stop();
```

#### `update()`

Manually trigger RSI calculation.

```javascript
const current = await rsiCalc.update();
console.log('RSI:', current.rsi);
console.log('Status:', current.status);
```

**Returns:**
```javascript
{
  rsi: 45.23,
  status: 'NEUTRAL',  // 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL'
  timestamp: 1705334400000,
  ready: true,
  lastCandle: {
    timestamp: 1705334400000,
    open: 95800.00,
    high: 95850.00,
    low: 95750.00,
    close: 95804.43,
    volume: 123.45,
    closeTime: 1705335300000
  }
}
```

---

### Data Retrieval Methods

#### `getMetrics()`

Get complete RSI metrics including history and stats.

```javascript
const metrics = rsiCalc.getMetrics();
```

**Returns:**
```javascript
{
  current: 45.23,
  status: 'NEUTRAL',
  ready: true,
  timestamp: 1705334400000,
  lastCandle: { ... },
  history: [
    { timestamp: 1705333500000, rsi: 44.12 },
    { timestamp: 1705334400000, rsi: 45.23 },
    // ... last 20 values
  ],
  stats: {
    calculations: 156,
    overbought_count: 23,
    oversold_count: 18,
    neutral_count: 115,
    last_fetch: 1705334400000,
    fetch_errors: 0,
    overbought_pct: '14.7',
    oversold_pct: '11.5',
    neutral_pct: '73.7'
  },
  config: {
    symbol: 'BTCUSDT',
    interval: '15m',
    period: 14,
    overboughtThreshold: 70,
    oversoldThreshold: 30
  }
}
```

#### `getHistory()`

Get full RSI history (up to 100 values).

```javascript
const history = rsiCalc.getHistory();
// Returns: [{ timestamp, rsi }, ...]
```

#### `getCandles()`

Get current candle data.

```javascript
const candles = rsiCalc.getCandles();
// Returns: [{ timestamp, open, high, low, close, volume, closeTime }, ...]
```

#### `getStats()`

Get statistics (alias for `getMetrics()`).

```javascript
const stats = rsiCalc.getStats();
```

---

### Advanced Features

#### `detectDivergence(currentPrice, priceHistory)`

Detect bullish/bearish divergences between price and RSI.

**Bullish Divergence:**  
Price makes lower low, RSI makes higher low → Potential reversal up

**Bearish Divergence:**  
Price makes higher high, RSI makes lower high → Potential reversal down

```javascript
const divergence = rsiCalc.detectDivergence(95804.43);

if (divergence) {
  console.log('Type:', divergence.type);
  console.log('Message:', divergence.message);
  console.log('Confidence:', divergence.confidence);
}
```

**Returns (Bullish):**
```javascript
{
  type: 'BULLISH_DIVERGENCE',
  message: 'Price making lower low, RSI making higher low',
  confidence: 'MEDIUM',
  priceChange: '-2.34',  // %
  rsiChange: '+5.67',
  timestamp: 1705334400000
}
```

**Returns (Bearish):**
```javascript
{
  type: 'BEARISH_DIVERGENCE',
  message: 'Price making higher high, RSI making lower high',
  confidence: 'MEDIUM',
  priceChange: '+3.21',  // %
  rsiChange: '-4.89',
  timestamp: 1705334400000
}
```

**Returns (No Divergence):**
```javascript
null
```

---

## Events

The RSI Calculator extends `EventEmitter` and emits events on updates.

### `calculated`

Emitted after each RSI calculation.

```javascript
rsiCalc.on('calculated', (current) => {
  console.log('RSI updated:', current.rsi);
  console.log('Status:', current.status);
  
  if (current.status === 'OVERBOUGHT') {
    console.log('⚠️ Overbought condition!');
  }
  
  if (current.status === 'OVERSOLD') {
    console.log('⚠️ Oversold condition!');
  }
});
```

---

## Usage Examples

### Basic Usage

```javascript
const Logger = require('./utils/logger');
const RSICalculator = require('./calculators/RSICalculator');

const logger = new Logger('App');
const rsiCalc = new RSICalculator(logger);

// Start auto-updating
rsiCalc.start();

// Listen for updates
rsiCalc.on('calculated', (current) => {
  console.log(`RSI: ${current.rsi.toFixed(2)} (${current.status})`);
});
```

### Custom Configuration

```javascript
const rsiCalc = new RSICalculator(logger, {
  symbol: 'ETHUSDT',
  interval: '5m',
  period: 9,
  overboughtThreshold: 75,
  oversoldThreshold: 25,
  updateInterval: 300000  // 5 minutes
});

rsiCalc.start();
```

### Manual Updates

```javascript
const rsiCalc = new RSICalculator(logger);

// Don't auto-update
// rsiCalc.start();

// Update manually when needed
setInterval(async () => {
  const current = await rsiCalc.update();
  console.log('RSI:', current.rsi);
}, 60000);  // Every minute
```

### Divergence Detection

```javascript
rsiCalc.on('calculated', (current) => {
  // Check for divergences
  const divergence = rsiCalc.detectDivergence(current.lastCandle.close);
  
  if (divergence) {
    console.log('🚨 DIVERGENCE DETECTED!');
    console.log('Type:', divergence.type);
    console.log('Message:', divergence.message);
    console.log('Price Change:', divergence.priceChange + '%');
    console.log('RSI Change:', divergence.rsiChange);
    
    // Take action
    if (divergence.type === 'BULLISH_DIVERGENCE') {
      console.log('→ Consider LONG position');
    } else if (divergence.type === 'BEARISH_DIVERGENCE') {
      console.log('→ Consider SHORT position');
    }
  }
});
```

### Integration with Trading Bot

```javascript
class TradingBot {
  constructor() {
    this.rsiCalc = new RSICalculator(logger, {
      interval: '15m',
      period: 14
    });
    
    this.rsiCalc.on('calculated', this.onRSIUpdate.bind(this));
    this.rsiCalc.start();
  }
  
  onRSIUpdate(current) {
    const { rsi, status } = current;
    
    // Entry signals
    if (status === 'OVERSOLD' && rsi < 25) {
      this.considerLongEntry(rsi);
    }
    
    if (status === 'OVERBOUGHT' && rsi > 75) {
      this.considerShortEntry(rsi);
    }
    
    // Exit signals
    if (this.hasLongPosition && rsi > 70) {
      this.exitLong('RSI overbought');
    }
    
    if (this.hasShortPosition && rsi < 30) {
      this.exitShort('RSI oversold');
    }
  }
  
  considerLongEntry(rsi) {
    // Check divergence
    const divergence = this.rsiCalc.detectDivergence();
    
    if (divergence && divergence.type === 'BULLISH_DIVERGENCE') {
      console.log('Strong LONG signal: Oversold + Bullish Divergence');
      this.enterLong();
    }
  }
}
```

---

## Trading Strategies

### 1. Classic Overbought/Oversold

**Setup:**
- RSI period: 14
- Overbought: 70
- Oversold: 30

**Rules:**

| Condition | Signal | Action |
|-----------|--------|--------|
| RSI < 30 | Oversold | Consider LONG |
| RSI > 70 | Overbought | Consider SHORT |
| RSI crosses above 30 | Exit oversold | Close SHORT |
| RSI crosses below 70 | Exit overbought | Close LONG |

**Example:**
```javascript
if (rsi < 30 && !hasPosition) {
  enterLong('RSI oversold');
}

if (rsi > 70 && hasLongPosition) {
  exitLong('RSI overbought');
}
```

### 2. Extreme Levels

**Setup:**
- RSI period: 14
- Extreme oversold: 20
- Extreme overbought: 80

**Rules:**

| Condition | Signal | Confidence |
|-----------|--------|------------|
| RSI < 20 | Extreme oversold | HIGH |
| RSI > 80 | Extreme overbought | HIGH |
| RSI 20-30 | Oversold | MEDIUM |
| RSI 70-80 | Overbought | MEDIUM |

**Example:**
```javascript
if (rsi < 20) {
  enterLong('Extreme oversold', { confidence: 'HIGH', size: 1.5 });
} else if (rsi < 30) {
  enterLong('Oversold', { confidence: 'MEDIUM', size: 1.0 });
}
```

### 3. Divergence Strategy

**Setup:**
- Monitor last 10 candles
- Compare price peaks/troughs with RSI peaks/troughs

**Rules:**

| Divergence Type | Price Action | RSI Action | Signal |
|----------------|--------------|------------|--------|
| **Bullish** | Lower low | Higher low | LONG |
| **Bearish** | Higher high | Lower high | SHORT |

**Example:**
```javascript
const divergence = rsiCalc.detectDivergence(currentPrice);

if (divergence && divergence.type === 'BULLISH_DIVERGENCE') {
  enterLong('Bullish divergence', {
    stopLoss: currentPrice * 0.98,
    takeProfit: currentPrice * 1.05
  });
}

if (divergence && divergence.type === 'BEARISH_DIVERGENCE') {
  enterShort('Bearish divergence', {
    stopLoss: currentPrice * 1.02,
    takeProfit: currentPrice * 0.95
  });
}
```

### 4. RSI + Trend Filter

**Setup:**
- RSI period: 14
- Trend filter: 200-period SMA (separate calculation)

**Rules:**

| Trend | RSI Condition | Action |
|-------|---------------|--------|
| **Uptrend** (Price > SMA200) | RSI < 40 | LONG (buy dip) |
| **Downtrend** (Price < SMA200) | RSI > 60 | SHORT (sell rally) |
| **Sideways** | RSI < 30 or > 70 | Range trade |

**Example:**
```javascript
const trend = price > sma200 ? 'UP' : 'DOWN';

if (trend === 'UP' && rsi < 40) {
  enterLong('Uptrend + RSI dip');
}

if (trend === 'DOWN' && rsi > 60) {
  enterShort('Downtrend + RSI rally');
}
```

### 5. Multi-Timeframe RSI

**Setup:**
- Fast RSI: 5m interval, period 9
- Slow RSI: 1h interval, period 14

**Rules:**

| Fast RSI | Slow RSI | Signal |
|----------|----------|--------|
| < 30 | < 40 | Strong LONG |
| > 70 | > 60 | Strong SHORT |
| < 30 | > 60 | Weak LONG (caution) |
| > 70 | < 40 | Weak SHORT (caution) |

**Example:**
```javascript
const fastRSI = await fastRSICalc.update();
const slowRSI = await slowRSICalc.update();

if (fastRSI.rsi < 30 && slowRSI.rsi < 40) {
  enterLong('Multi-timeframe oversold', { confidence: 'HIGH' });
}
```

---

## Interpretation Guidelines

### RSI Levels

| RSI Range | Interpretation | Action |
|-----------|----------------|--------|
| **0-20** | Extremely oversold | Strong buy signal |
| **20-30** | Oversold | Buy signal |
| **30-40** | Weak | Cautious buy |
| **40-60** | Neutral | No clear signal |
| **60-70** | Strong | Cautious sell |
| **70-80** | Overbought | Sell signal |
| **80-100** | Extremely overbought | Strong sell signal |

### Status Meanings

**OVERSOLD (RSI ≤ 30):**
- Price has fallen too far, too fast
- Potential for bounce/reversal
- **Not always bullish** - can stay oversold in strong downtrends

**OVERBOUGHT (RSI ≥ 70):**
- Price has risen too far, too fast
- Potential for pullback/reversal
- **Not always bearish** - can stay overbought in strong uptrends

**NEUTRAL (30 < RSI < 70):**
- Normal price action
- No extreme conditions
- Wait for clearer signals

### Common Patterns

**1. Failed Swing**

RSI fails to reach overbought/oversold before reversing.

```
Example:
- RSI reaches 65 (not overbought)
- Reverses and breaks below 30
- Strong bearish signal
```

**2. Positive/Negative Reversal**

RSI makes higher low while price makes lower low (bullish).  
RSI makes lower high while price makes higher high (bearish).

**3. Support/Resistance**

RSI can have support/resistance levels just like price.

```
Example:
- RSI repeatedly bounces at 40
- 40 becomes support level
- Break below 40 = bearish signal
```

---

## Performance Considerations

### Computational Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Fetch candles | O(1) | API call |
| Calculate RSI | O(n) | n = number of candles |
| Detect divergence | O(n) | n = history size (10) |
| Update | O(n) | Dominated by RSI calculation |

### Memory Usage

| Component | Size | Notes |
|-----------|------|-------|
| Candles | ~10KB | 100 candles |
| RSI history | ~2KB | 100 values |
| Stats | <1KB | Counters |
| **Total** | **~13KB** | Per instance |

### Optimization Tips

1. **Adjust update interval**: Longer intervals = less API calls
2. **Limit history size**: Default 100 is usually sufficient
3. **Cache candles**: Reuse candles for multiple calculations
4. **Batch updates**: Update multiple indicators together

---

## Limitations & Caveats

### 1. Lagging Indicator

**Limitation:**  
RSI is based on past prices, so it lags current price action.

**Mitigation:**
- Use shorter periods (9 instead of 14) for faster response
- Combine with leading indicators (volume, order flow)
- Use multiple timeframes

### 2. False Signals in Strong Trends

**Problem:**  
RSI can stay overbought/oversold for extended periods in strong trends.

**Mitigation:**
- Add trend filter (SMA, EMA)
- Use higher thresholds (80/20 instead of 70/30)
- Wait for RSI to exit extreme zone before entering

### 3. Whipsaws in Ranging Markets

**Problem:**  
Frequent overbought/oversold signals in sideways markets.

**Mitigation:**
- Use wider thresholds (75/25)
- Require confirmation (price action, volume)
- Avoid trading in low-volatility ranges

### 4. Divergence Reliability

**Challenge:**  
Divergences don't always lead to reversals.

**Mitigation:**
- Use divergences as **alerts**, not signals
- Require additional confirmation
- Set tight stop losses

### 5. Data Dependency

**Consideration:**  
Requires reliable candle data from Binance.

**Impact:**
- API downtime = no updates
- Delayed candles = delayed RSI
- Different exchanges = different RSI values

**Mitigation:**
- Monitor API errors (`stats.fetch_errors`)
- Implement fallback data sources
- Use `ready` flag before trading

---

## API Integration

### REST Endpoints

```
GET /api/entropy-rsi
GET /api/entropy-rsi/history
GET /api/entropy-rsi/metrics
GET /api/entropy-rsi/divergence
```

See [API_REFERENCE.md](./API_REFERENCE.md) for details.

### WebSocket Updates

```javascript
// Subscribe to RSI updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'rsi_updates'
}));

// Receive updates every 15 minutes
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('RSI:', data.rsi);
  console.log('Status:', data.status);
};
```

---

## Related Components

- **EntropyCalculatorV2**: Shannon entropy calculation
- **DataCollector**: Collects and caches RSI data
- **Entropy Routes**: API endpoints for RSI data
- **Frontend Visualization**: Renders RSI charts

---

## References

### Original Paper

**"New Concepts in Technical Trading Systems"**  
J. Welles Wilder Jr. (1978)

### Industry Resources

1. **Investopedia**: RSI definition and usage
2. **TradingView**: RSI indicator implementation
3. **Binance API**: Klines endpoint documentation

### Internal Documentation

- [entropy_analysis.md](./entropy_analysis.md)
- [entropy_api_spec.md](./entropy_api_spec.md)
- [API_REFERENCE.md](./API_REFERENCE.md)

---

## Changelog

### v2.0.0 (Current)
- Switched from order book to Binance candles
- Implemented Wilder's smoothing (correct algorithm)
- Added divergence detection
- Added event emitter for real-time updates
- Added comprehensive stats tracking

### v1.0.0
- Initial implementation using order book data
- Basic RSI calculation

### Planned Features

- [ ] Multiple symbol support
- [ ] Multi-timeframe aggregation
- [ ] RSI-based auto-trading signals
- [ ] Machine learning for divergence prediction
- [ ] RSI heatmap visualization

---

## Support

For questions or issues:
- Check [API_REFERENCE.md](./API_REFERENCE.md)
- Review [PROJECT_MAP.md](../PROJECT_MAP.md)
- See code: `backend/src/calculators/RSICalculator.js`

---

**Last Updated:** January 15, 2026  
**Version:** 2.0.0  
**Author:** Valter Russo / Gamma Tracker Team
