# Sentiment Analyzer Documentation

## Overview

The **Sentiment Analyzer** determines market sentiment by analyzing options positioning through **Put/Call Ratios**. It examines both Open Interest (OI) and Volume to identify whether traders are positioned bullishly, bearishly, or neutrally, and detects shifts in sentiment over time.

## What is Sentiment Analysis?

**Market Sentiment** reflects the collective positioning and expectations of options traders. It answers the question: **Are traders betting on upside or downside?**

### Key Metrics

1. **Put/Call OI Ratio**: Ratio of total Put Open Interest to total Call Open Interest
2. **Put/Call Volume Ratio**: Ratio of total Put Volume to total Call Volume
3. **Divergence**: Difference between OI and Volume ratios (indicates changing sentiment)

### Interpretation

| Put/Call Ratio | Interpretation |
|----------------|----------------|
| **< 1.0** | More calls than puts → **Bullish** |
| **= 1.0** | Equal calls and puts → **Neutral** |
| **> 1.0** | More puts than calls → **Bearish** |

---

## The Five Sentiment Levels

### 1. VERY_BULLISH (P/C < 0.7)

**Characteristics:**
- Strong positioning in calls
- Significantly more call OI than put OI
- Market expects strong upside

**Implications:**
- High confidence in rally
- Potential for squeeze if price moves up
- Risk of reversal if sentiment shifts

**Example:**
```
Call OI: 10,000 BTC
Put OI: 6,000 BTC
P/C Ratio: 0.60

→ VERY_BULLISH: Strong call positioning
```

---

### 2. BULLISH (0.7 ≤ P/C < 0.9)

**Characteristics:**
- More calls than puts
- Moderate bullish bias
- Market leans toward upside

**Implications:**
- Positive outlook
- Not extreme positioning
- Room for further upside

**Example:**
```
Call OI: 10,000 BTC
Put OI: 8,000 BTC
P/C Ratio: 0.80

→ BULLISH: Moderate call bias
```

---

### 3. NEUTRAL (0.9 ≤ P/C ≤ 1.1)

**Characteristics:**
- Balanced positioning
- Equal interest in calls and puts
- Market indecisive

**Implications:**
- No clear directional bias
- Waiting for catalyst
- Range-bound likely

**Example:**
```
Call OI: 10,000 BTC
Put OI: 10,000 BTC
P/C Ratio: 1.00

→ NEUTRAL: Balanced positioning
```

---

### 4. BEARISH (1.1 < P/C ≤ 1.3)

**Characteristics:**
- More puts than calls
- Moderate bearish bias
- Market leans toward downside

**Implications:**
- Negative outlook
- Hedging or directional bearish bets
- Potential support if puts are protective

**Example:**
```
Call OI: 10,000 BTC
Put OI: 12,000 BTC
P/C Ratio: 1.20

→ BEARISH: Moderate put bias
```

---

### 5. VERY_BEARISH (P/C > 1.3)

**Characteristics:**
- Strong positioning in puts
- Significantly more put OI than call OI
- Market expects strong downside

**Implications:**
- High fear or hedging
- Potential for squeeze if price moves down
- May indicate bottom if overly bearish

**Example:**
```
Call OI: 10,000 BTC
Put OI: 15,000 BTC
P/C Ratio: 1.50

→ VERY_BEARISH: Strong put positioning
```

---

## Sentiment Summary Table

| Sentiment | P/C Ratio | Call/Put Bias | Market Expectation | Confidence |
|-----------|-----------|---------------|-------------------|------------|
| **VERY_BULLISH** | < 0.7 | Strong Call | Strong upside | High |
| **BULLISH** | 0.7-0.9 | Moderate Call | Upside | Medium |
| **NEUTRAL** | 0.9-1.1 | Balanced | Indecisive | Low |
| **BEARISH** | 1.1-1.3 | Moderate Put | Downside | Medium |
| **VERY_BEARISH** | > 1.3 | Strong Put | Strong downside | High |

---

## Algorithm

### Step 1: Calculate OI Metrics

Sum Open Interest for calls and puts:

```javascript
totalCallOI = Σ (Call OI)
totalPutOI = Σ (Put OI)
pcOIRatio = totalPutOI / totalCallOI
```

### Step 2: Calculate Volume Metrics

Sum Volume for calls and puts:

```javascript
totalCallVol = Σ (Call Volume)
totalPutVol = Σ (Put Volume)
pcVolRatio = totalPutVol / totalCallVol
```

### Step 3: Determine Sentiment

Based on P/C OI Ratio:

```javascript
if (pcRatio < 0.7) {
  sentiment = 'VERY_BULLISH';
} else if (pcRatio < 0.9) {
  sentiment = 'BULLISH';
} else if (pcRatio < 1.1) {
  sentiment = 'NEUTRAL';
} else if (pcRatio < 1.3) {
  sentiment = 'BEARISH';
} else {
  sentiment = 'VERY_BEARISH';
}
```

### Step 4: Detect Divergence

Check if Volume ratio differs significantly from OI ratio:

```javascript
divergence = abs(pcVolRatio - pcOIRatio)

if (divergence > 0.3) {
  // Sentiment may be shifting
  if (pcVolRatio > pcOIRatio) {
    alert('Put volume increasing - bearish shift');
  } else {
    alert('Call volume increasing - bullish shift');
  }
}
```

---

## Implementation

### Constructor

```javascript
const SentimentAnalyzer = require('./calculators/SentimentAnalyzer');

const sentimentAnalyzer = new SentimentAnalyzer();
```

No configuration required - stateless analyzer.

---

## API Methods

### `analyzeSentiment(options)`

Analyze overall market sentiment.

**Parameters:**
- `options` (Array): Array of option objects

**Returns:**
```javascript
{
  sentiment: 'BULLISH',
  putCallOIRatio: 0.85,
  putCallVolRatio: 0.92,
  totalCallOI: 10000,
  totalPutOI: 8500,
  totalCallVolume: 2500,
  totalPutVolume: 2300,
  interpretation: 'Sentimento BULLISH: P/C OI Ratio 0.85 indica mais calls que puts. Viés de alta.'
}
```

**Example:**
```javascript
const options = await fetchOptionsData();
const sentiment = sentimentAnalyzer.analyzeSentiment(options);

console.log('Sentiment:', sentiment.sentiment);
console.log('P/C OI Ratio:', sentiment.putCallOIRatio.toFixed(2));
console.log('P/C Vol Ratio:', sentiment.putCallVolRatio.toFixed(2));
console.log('Interpretation:', sentiment.interpretation);
```

---

### `analyzeSentimentByExpiry(options)`

Analyze sentiment for each expiry date (term structure).

**Parameters:**
- `options` (Array): Array of option objects

**Returns:**
```javascript
[
  {
    expiryDate: 1705334400000,
    dte: 7,  // Days to expiry
    sentiment: 'BULLISH',
    pcOIRatio: 0.80,
    pcVolRatio: 0.85
  },
  {
    expiryDate: 1706544000000,
    dte: 21,
    sentiment: 'NEUTRAL',
    pcOIRatio: 1.05,
    pcVolRatio: 1.02
  },
  // ... more expiries
]
```

**Example:**
```javascript
const sentimentByExpiry = sentimentAnalyzer.analyzeSentimentByExpiry(options);

console.log('=== SENTIMENT TERM STRUCTURE ===');
sentimentByExpiry.forEach(exp => {
  console.log(`${exp.dte} DTE: ${exp.sentiment} (P/C: ${exp.pcOIRatio.toFixed(2)})`);
});
```

**Use Cases:**
- Identify near-term vs long-term sentiment
- Detect sentiment divergence across expiries
- Understand term structure of positioning

---

### `detectSentimentShift(currentPCRatio, historicalPCRatios)`

Detect sentiment shift by comparing current ratio to historical average.

**Parameters:**
- `currentPCRatio` (Number): Current P/C ratio
- `historicalPCRatios` (Array): Array of historical P/C ratios

**Returns:**
```javascript
{
  shift: 'BULLISH_SHIFT',
  magnitude: 15.3,  // % deviation
  currentPCRatio: 0.85,
  historicalAvg: 1.00,
  deviation: -0.15,
  deviationPct: -15.0,
  interpretation: 'Mudança BULLISH detectada: P/C Ratio 15.0% abaixo da média histórica'
}
```

**Shift Types:**
- `NO_SHIFT`: < 10% deviation
- `BULLISH_SHIFT`: P/C significantly below average
- `BEARISH_SHIFT`: P/C significantly above average
- `INSUFFICIENT_DATA`: Not enough historical data

**Example:**
```javascript
const historicalPCRatios = [1.05, 1.02, 0.98, 1.01, 1.00];
const currentPCRatio = 0.85;

const shift = sentimentAnalyzer.detectSentimentShift(currentPCRatio, historicalPCRatios);

if (shift.shift !== 'NO_SHIFT') {
  console.log('🚨 SENTIMENT SHIFT DETECTED!');
  console.log('Type:', shift.shift);
  console.log('Magnitude:', shift.magnitude.toFixed(1) + '%');
  console.log('Interpretation:', shift.interpretation);
}
```

---

## Usage Examples

### Basic Sentiment Analysis

```javascript
const SentimentAnalyzer = require('./calculators/SentimentAnalyzer');

const sentimentAnalyzer = new SentimentAnalyzer();

// Fetch options
const options = await fetchOptionsData();

// Analyze sentiment
const sentiment = sentimentAnalyzer.analyzeSentiment(options);

console.log('=== MARKET SENTIMENT ===');
console.log('Sentiment:', sentiment.sentiment);
console.log('P/C OI Ratio:', sentiment.putCallOIRatio.toFixed(2));
console.log('P/C Vol Ratio:', sentiment.putCallVolRatio.toFixed(2));
console.log('');
console.log('Call OI:', sentiment.totalCallOI);
console.log('Put OI:', sentiment.totalPutOI);
console.log('');
console.log('Interpretation:', sentiment.interpretation);
```

**Output:**
```
=== MARKET SENTIMENT ===
Sentiment: BULLISH
P/C OI Ratio: 0.85
P/C Vol Ratio: 0.92

Call OI: 10000
Put OI: 8500

Interpretation: Sentimento BULLISH: P/C OI Ratio 0.85 indica mais calls que puts. Viés de alta.
```

---

### Divergence Detection

```javascript
const sentiment = sentimentAnalyzer.analyzeSentiment(options);

const pcOI = sentiment.putCallOIRatio;
const pcVol = sentiment.putCallVolRatio;
const divergence = Math.abs(pcVol - pcOI);

console.log('=== DIVERGENCE ANALYSIS ===');
console.log('P/C OI Ratio:', pcOI.toFixed(2));
console.log('P/C Vol Ratio:', pcVol.toFixed(2));
console.log('Divergence:', divergence.toFixed(2));

if (divergence > 0.3) {
  console.log('');
  console.log('⚠️ SIGNIFICANT DIVERGENCE DETECTED!');
  
  if (pcVol > pcOI) {
    console.log('→ Put volume increasing faster than OI');
    console.log('→ Possible bearish shift in progress');
  } else {
    console.log('→ Call volume increasing faster than OI');
    console.log('→ Possible bullish shift in progress');
  }
} else {
  console.log('');
  console.log('✅ OI and Volume aligned - stable sentiment');
}
```

---

### Term Structure Analysis

```javascript
const sentimentByExpiry = sentimentAnalyzer.analyzeSentimentByExpiry(options);

console.log('=== SENTIMENT TERM STRUCTURE ===');

sentimentByExpiry.forEach(exp => {
  const date = new Date(exp.expiryDate).toLocaleDateString();
  
  console.log(`\n${exp.dte} days to expiry (${date})`);
  console.log(`  Sentiment: ${exp.sentiment}`);
  console.log(`  P/C OI: ${exp.pcOIRatio.toFixed(2)}`);
  console.log(`  P/C Vol: ${exp.pcVolRatio.toFixed(2)}`);
});

// Detect term structure patterns
const nearTerm = sentimentByExpiry.filter(e => e.dte <= 7);
const longTerm = sentimentByExpiry.filter(e => e.dte > 30);

if (nearTerm.length > 0 && longTerm.length > 0) {
  const nearAvg = nearTerm.reduce((sum, e) => sum + e.pcOIRatio, 0) / nearTerm.length;
  const longAvg = longTerm.reduce((sum, e) => sum + e.pcOIRatio, 0) / longTerm.length;
  
  console.log('\n=== TERM STRUCTURE SUMMARY ===');
  console.log('Near-term avg P/C:', nearAvg.toFixed(2));
  console.log('Long-term avg P/C:', longAvg.toFixed(2));
  
  if (nearAvg < longAvg - 0.2) {
    console.log('→ Near-term more bullish than long-term');
  } else if (nearAvg > longAvg + 0.2) {
    console.log('→ Near-term more bearish than long-term');
  } else {
    console.log('→ Consistent sentiment across terms');
  }
}
```

---

### Sentiment Shift Tracking

```javascript
class SentimentTracker {
  constructor() {
    this.sentimentAnalyzer = new SentimentAnalyzer();
    this.history = [];
  }
  
  async track(options) {
    const sentiment = this.sentimentAnalyzer.analyzeSentiment(options);
    
    // Store in history
    this.history.push({
      timestamp: Date.now(),
      pcRatio: sentiment.putCallOIRatio,
      sentiment: sentiment.sentiment
    });
    
    // Keep last 30 readings
    if (this.history.length > 30) {
      this.history.shift();
    }
    
    // Detect shift
    if (this.history.length >= 5) {
      const historicalPCRatios = this.history.slice(0, -1).map(h => h.pcRatio);
      const currentPCRatio = sentiment.putCallOIRatio;
      
      const shift = this.sentimentAnalyzer.detectSentimentShift(
        currentPCRatio,
        historicalPCRatios
      );
      
      if (shift.shift !== 'NO_SHIFT') {
        console.log('🚨 SENTIMENT SHIFT ALERT!');
        console.log('Type:', shift.shift);
        console.log('Magnitude:', shift.magnitude.toFixed(1) + '%');
        console.log('Current P/C:', shift.currentPCRatio.toFixed(2));
        console.log('Historical Avg:', shift.historicalAvg.toFixed(2));
        console.log('Interpretation:', shift.interpretation);
      }
    }
  }
}

// Usage
const tracker = new SentimentTracker();
setInterval(async () => {
  const options = await fetchOptionsData();
  await tracker.track(options);
}, 300000); // Every 5 minutes
```

---

### Integration with Trading Bot

```javascript
class SentimentAwareBot {
  constructor() {
    this.sentimentAnalyzer = new SentimentAnalyzer();
  }
  
  async analyzeAndTrade(options) {
    const sentiment = this.sentimentAnalyzer.analyzeSentiment(options);
    
    console.log('Current Sentiment:', sentiment.sentiment);
    console.log('P/C Ratio:', sentiment.putCallOIRatio.toFixed(2));
    
    // Trading logic based on sentiment
    switch (sentiment.sentiment) {
      case 'VERY_BULLISH':
        console.log('📈 VERY BULLISH - Strong call positioning');
        this.considerLong('Very bullish sentiment');
        this.avoidShorts();
        break;
        
      case 'BULLISH':
        console.log('📈 BULLISH - Moderate call bias');
        this.considerLong('Bullish sentiment');
        break;
        
      case 'NEUTRAL':
        console.log('➡️ NEUTRAL - Balanced positioning');
        this.rangeTrading();
        break;
        
      case 'BEARISH':
        console.log('📉 BEARISH - Moderate put bias');
        this.considerShort('Bearish sentiment');
        break;
        
      case 'VERY_BEARISH':
        console.log('📉 VERY BEARISH - Strong put positioning');
        this.considerShort('Very bearish sentiment');
        this.avoidLongs();
        break;
    }
    
    // Check for divergence
    const divergence = Math.abs(sentiment.putCallVolRatio - sentiment.putCallOIRatio);
    if (divergence > 0.3) {
      console.log('⚠️ Divergence detected - sentiment may be shifting');
      this.reducePositionSizes();
    }
  }
}
```

---

## Trading Strategies

### Strategy 1: Contrarian (Fade Extremes)

**Setup:**
- Identify extreme sentiment (VERY_BULLISH or VERY_BEARISH)
- Wait for confirmation (price action, other indicators)

**Rules:**

| Sentiment | P/C Ratio | Action |
|-----------|-----------|--------|
| **VERY_BULLISH** | < 0.7 | Consider SHORT (fade optimism) |
| **VERY_BEARISH** | > 1.3 | Consider LONG (fade pessimism) |

**Rationale:**  
Extreme sentiment often marks turning points.

**Example:**
```javascript
if (sentiment.sentiment === 'VERY_BEARISH' && sentiment.putCallOIRatio > 1.4) {
  console.log('🎯 CONTRARIAN SETUP: Extreme bearish sentiment');
  console.log('→ Consider LONG position (fade pessimism)');
  console.log('→ Wait for price confirmation (bullish candle, RSI oversold)');
}
```

---

### Strategy 2: Trend Following (Follow Sentiment)

**Setup:**
- Identify clear sentiment (BULLISH or BEARISH)
- Confirm with price trend

**Rules:**

| Sentiment | Trend | Action |
|-----------|-------|--------|
| **BULLISH** | Uptrend | LONG |
| **BEARISH** | Downtrend | SHORT |
| **Mismatch** | - | Wait |

**Example:**
```javascript
const trend = detectTrend(priceHistory);

if (sentiment.sentiment === 'BULLISH' && trend === 'UP') {
  console.log('✅ ALIGNED: Bullish sentiment + uptrend');
  enterLong('Sentiment and trend aligned');
}

if (sentiment.sentiment === 'BEARISH' && trend === 'DOWN') {
  console.log('✅ ALIGNED: Bearish sentiment + downtrend');
  enterShort('Sentiment and trend aligned');
}

if (sentiment.sentiment === 'BULLISH' && trend === 'DOWN') {
  console.log('⚠️ MISMATCH: Bullish sentiment but downtrend');
  console.log('→ Wait for trend to turn or sentiment to shift');
}
```

---

### Strategy 3: Divergence Trading

**Setup:**
- Detect significant divergence between OI and Volume ratios
- Divergence > 0.3 indicates shifting sentiment

**Rules:**

| Divergence Type | Interpretation | Action |
|-----------------|----------------|--------|
| **Vol > OI** (puts) | Bearish shift starting | Consider SHORT |
| **Vol > OI** (calls) | Bullish shift starting | Consider LONG |
| **Vol < OI** | Sentiment stable | No action |

**Example:**
```javascript
const pcOI = sentiment.putCallOIRatio;
const pcVol = sentiment.putCallVolRatio;
const divergence = pcVol - pcOI;

if (divergence > 0.3) {
  console.log('🚨 BEARISH DIVERGENCE: Put volume increasing');
  console.log('→ Sentiment shifting bearish');
  console.log('→ Consider SHORT position or exit longs');
  
} else if (divergence < -0.3) {
  console.log('🚨 BULLISH DIVERGENCE: Call volume increasing');
  console.log('→ Sentiment shifting bullish');
  console.log('→ Consider LONG position or exit shorts');
}
```

---

### Strategy 4: Term Structure Arbitrage

**Setup:**
- Analyze sentiment by expiry
- Identify divergence between near-term and long-term

**Rules:**

| Near-term | Long-term | Action |
|-----------|-----------|--------|
| **Bullish** | Bearish | Long near-term, short long-term |
| **Bearish** | Bullish | Short near-term, long long-term |
| **Aligned** | - | No arbitrage |

**Example:**
```javascript
const sentimentByExpiry = sentimentAnalyzer.analyzeSentimentByExpiry(options);

const nearTerm = sentimentByExpiry.find(e => e.dte <= 7);
const longTerm = sentimentByExpiry.find(e => e.dte >= 30);

if (nearTerm && longTerm) {
  if (nearTerm.pcOIRatio < 0.8 && longTerm.pcOIRatio > 1.2) {
    console.log('📊 TERM STRUCTURE DIVERGENCE');
    console.log('→ Near-term BULLISH, Long-term BEARISH');
    console.log('→ Consider calendar spread: Long near-term calls, Short long-term calls');
  }
}
```

---

## Interpretation Guidelines

### P/C Ratio Benchmarks

| Asset | Normal Range | Bullish | Bearish |
|-------|--------------|---------|---------|
| **BTC** | 0.8-1.2 | < 0.8 | > 1.2 |
| **ETH** | 0.7-1.1 | < 0.7 | > 1.1 |
| **Altcoins** | 0.6-1.0 | < 0.6 | > 1.0 |

### OI vs Volume

| Metric | Timeframe | Interpretation |
|--------|-----------|----------------|
| **OI** | Long-term | Established positioning |
| **Volume** | Short-term | Current activity |
| **Divergence** | Transition | Sentiment shifting |

### Confidence Levels

| Sentiment | Confidence | Action |
|-----------|------------|--------|
| **VERY_BULLISH/BEARISH** | High | Strong signal |
| **BULLISH/BEARISH** | Medium | Moderate signal |
| **NEUTRAL** | Low | No clear signal |

---

## Limitations & Caveats

### 1. Not Predictive

**Limitation:**  
Sentiment reflects **current positioning**, not future price movement.

**Mitigation:**
- Use as context, not signal
- Combine with price action
- Consider contrarian interpretation at extremes

### 2. Hedging vs Directional

**Challenge:**  
High put OI could be:
- **Directional bearish** bets
- **Protective hedges** (actually bullish)

**Mitigation:**
- Analyze with GEX (hedging creates positive gamma)
- Check volume (new hedges show up in volume)
- Consider market context

### 3. Time Decay

**Consideration:**  
OI can change as options expire or are closed.

**Mitigation:**
- Track sentiment over time
- Focus on near-term expiries for current sentiment
- Use term structure analysis

### 4. Market Maker Activity

**Limitation:**  
Market makers may distort P/C ratios with hedging activity.

**Mitigation:**
- Filter by volume (exclude low-volume options)
- Focus on retail-heavy strikes
- Combine with other indicators

---

## Performance Considerations

### Computational Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Analyze sentiment | O(n) | n = number of options |
| Sentiment by expiry | O(n) | Linear scan |
| Detect shift | O(m) | m = history size |
| **Overall** | **O(n)** | Very fast |

### Memory Usage

| Component | Size | Notes |
|-----------|------|-------|
| Sentiment analysis | <1KB | Minimal |
| Term structure | ~5KB | Depends on expiries |
| History tracking | ~10KB | 30 readings |
| **Total** | **~15KB** | Lightweight |

---

## API Integration

### REST Endpoints

```
GET /api/sentiment
GET /api/sentiment/by-expiry
GET /api/sentiment/shift
```

See [API_REFERENCE.md](./API_REFERENCE.md) for details.

### Example API Response

```json
{
  "success": true,
  "data": {
    "sentiment": "BULLISH",
    "putCallOIRatio": 0.85,
    "putCallVolRatio": 0.92,
    "totalCallOI": 10000,
    "totalPutOI": 8500,
    "totalCallVolume": 2500,
    "totalPutVolume": 2300,
    "interpretation": "Sentimento BULLISH: P/C OI Ratio 0.85 indica mais calls que puts. Viés de alta."
  },
  "timestamp": 1705334400000
}
```

---

## Related Components

- **GEXCalculator**: Gamma exposure analysis
- **RegimeAnalyzer**: Market regime classification
- **MaxPainCalculator**: Options pinning analysis
- **DataCollector**: Caches sentiment data

---

## References

### Theory

1. **Put/Call Ratio**: CBOE methodology
2. **Sentiment Analysis**: "Options as a Strategic Investment" by Lawrence McMillan
3. **Contrarian Indicators**: Academic papers on sentiment extremes

### Empirical Studies

1. **P/C Ratio Predictive Power**: Studies on sentiment as contrarian indicator
2. **OI vs Volume**: Research on positioning vs activity
3. **Term Structure**: Analysis of sentiment across expiries

### Internal Documentation

- [GEX_CALCULATOR.md](./GEX_CALCULATOR.md)
- [REGIME_ANALYZER.md](./REGIME_ANALYZER.md)
- [API_REFERENCE.md](./API_REFERENCE.md)
- [PROJECT_MAP.md](../PROJECT_MAP.md)

---

## Changelog

### v1.0.0 (Current)
- Initial implementation
- P/C OI and Volume ratios
- Five sentiment levels
- Divergence detection
- Term structure analysis
- Sentiment shift detection

### Planned Features

- [ ] Historical sentiment tracking
- [ ] Sentiment heatmap by strike
- [ ] Machine learning sentiment prediction
- [ ] Integration with social sentiment (Twitter, Reddit)
- [ ] Sentiment-based auto-trading signals

---

## Support

For questions or issues:
- Check [API_REFERENCE.md](./API_REFERENCE.md)
- Review [PROJECT_MAP.md](../PROJECT_MAP.md)
- See code: `backend/src/calculators/SentimentAnalyzer.js`

---

**Last Updated:** January 15, 2026  
**Version:** 1.0.0  
**Author:** Valter Russo / Gamma Tracker Team
