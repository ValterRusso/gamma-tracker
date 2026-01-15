# 🧊 IcebergDetector - Complete Usage Guide

**Author:** Gamma Tracker Team  
**Date:** 2026-01-01  
**Version:** 1.0.0  

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [5 Detection Signals](#5-detection-signals)
4. [Usage Examples](#usage-examples)
5. [Integration with EscapeTypeDetector](#integration-with-escapeTypedetector)
6. [Configuration](#configuration)
7. [API Reference](#api-reference)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

**IcebergDetector** identifies hidden liquidity (iceberg orders) in the order book using 5 heuristic signals:

1. **Refilling Pattern** - Small orders that reappear constantly
2. **Volume Anomaly** - Executed volume >> Visible volume
3. **Price Rejection** - Price "bounces" off same level repeatedly
4. **Depth Regeneration** - Depth recovers quickly after execution
5. **Consistent Size** - Same order size appears repeatedly

### Why It Matters

```
Visible Order Book:
├─ $88,000: 2 BTC ask

Reality (with Iceberg):
├─ $88,000: 200 BTC ask (hidden!)
└─ Only shows 2 BTC at a time

Impact:
├─ Traders think: "Easy to break $88k"
├─ Reality: "Need $17.6M to break $88k"
└─ Result: Price REJECTS at $88k (H2!)
```

---

## 📦 Installation

### 1. Copy Files

```bash
# Copy IcebergDetector.js to your project
cp IcebergDetector.js /path/to/your/project/src/

# Copy integration code
cp EscapeTypeDetector_IcebergIntegration.js /path/to/your/project/src/
```

### 2. Install Dependencies

```bash
# No external dependencies required!
# IcebergDetector uses only Node.js built-ins
```

### 3. Import

```javascript
const IcebergDetector = require('./IcebergDetector');

// Create instance
const detector = new IcebergDetector({
  refillingMinOccurrences: 5,
  volumeAnomalyRatio: 2.0,
  rejectionMinCount: 3
});
```

---

## 🔍 5 Detection Signals

### Signal 1: Refilling Pattern

**What it detects:**
- Small orders (< 5 BTC) that appear repeatedly at same price

**How it works:**
```javascript
// Tracks order book snapshots over time
// Looks for patterns like:

t=0s:  $88,000: 2 BTC ask
t=5s:  $88,000: 2 BTC ask (same!)
t=10s: $88,000: 1.8 BTC ask (someone bought 0.2)
t=15s: $88,000: 2 BTC ask (refilled!)
t=20s: $88,000: 2 BTC ask
// ... repeats 10+ times

// Conclusion: Iceberg order at $88,000!
```

**Thresholds:**
- `refillingMinOccurrences`: 5 (appears 5+ times)
- `refillingMaxSize`: 5 BTC (small orders)
- `refillingMinLevels`: 3 (at least 3 price levels)

---

### Signal 2: Volume Anomaly

**What it detects:**
- Executed volume much larger than visible volume

**How it works:**
```javascript
// Compare executed vs visible

Last 5 minutes:
├─ Executed volume: 150 BTC (from trades)
├─ Visible volume: 50 BTC (top 10 levels in book)
└─ Ratio: 150 / 50 = 3.0 → ANOMALY!

// Where did the extra 100 BTC come from?
// Answer: Hidden iceberg orders!
```

**Thresholds:**
- `volumeAnomalyRatio`: 2.0 (executed > 2x visible)
- `volumeWindowMs`: 300000 (5 minutes)

---

### Signal 3: Price Rejection

**What it detects:**
- Price repeatedly "bounces" off same level

**How it works:**
```javascript
// Track price movements

Price history:
├─ $87,900 → $87,950 → $88,000 → $87,950 (rejected!)
├─ $87,950 → $87,980 → $88,000 → $87,970 (rejected!)
├─ $87,970 → $87,990 → $88,000 → $87,960 (rejected!)
└─ ... 5 times total

// Conclusion: Strong resistance at $88,000 (iceberg!)
```

**Thresholds:**
- `rejectionMinCount`: 3 (rejected 3+ times)
- `rejectionRoundTo`: 100 (round to $100 levels)

---

### Signal 4: Depth Regeneration

**What it detects:**
- Depth drops sharply but recovers quickly

**How it works:**
```javascript
// Track total depth over time

Depth history:
├─ t=0s:  $50M (normal)
├─ t=5s:  $35M (dropped 30%!) ← Large order executed
├─ t=10s: $48M (recovered 37%!) ← Iceberg refilled
└─ Pattern repeats 3+ times

// Conclusion: Iceberg orders refilling automatically!
```

**Thresholds:**
- `regenMinDrop`: 0.2 (20% drop)
- `regenMinRecovery`: 0.15 (15% recovery)
- `regenMinCount`: 2 (happens 2+ times)

---

### Signal 5: Consistent Size

**What it detects:**
- Same order size appears repeatedly (bot pattern)

**How it works:**
```javascript
// Group orders by size

Order book:
├─ $88,000: 2.0 BTC
├─ $88,050: 2.0 BTC
├─ $88,100: 2.0 BTC
├─ $88,150: 2.0 BTC
├─ $88,200: 2.0 BTC
└─ ... 8 orders of 2.0 BTC

// Conclusion: Bot placing iceberg orders!
```

**Thresholds:**
- `consistentSizeMinOccurrences`: 5 (appears 5+ times)
- `consistentSizeRounding`: 0.1 BTC (round to 0.1)

---

## 💻 Usage Examples

### Example 1: Basic Detection

```javascript
const IcebergDetector = require('./IcebergDetector');

// Create detector
const detector = new IcebergDetector();

// Prepare order book data
const orderBook = {
  asks: [
    [88000, 2.0],   // [price, size]
    [88050, 1.5],
    [88100, 2.0],
    // ...
  ],
  bids: [
    [87950, 3.0],
    [87900, 2.5],
    // ...
  ],
  depth: 45000000,  // $45M
  spread_pct: 0.03, // 0.03%
  BI: 0.2           // Book imbalance
};

// Recent trades (optional, for volume anomaly)
const recentTrades = [
  { timestamp: Date.now() - 60000, size: 5.0, price: 88000 },
  { timestamp: Date.now() - 120000, size: 3.5, price: 87980 },
  // ...
];

// Run detection
const result = detector.detect(orderBook, recentTrades);

console.log('Iceberg detected:', result.detected);
console.log('Confidence:', result.confidence);
console.log('Score:', result.score);
console.log('Estimated hidden size:', result.estimatedHiddenSize);
console.log('Active signals:', Object.keys(result.signals).filter(k => result.signals[k].detected));
```

**Output:**
```
Iceberg detected: true
Confidence: HIGH
Score: 0.65
Estimated hidden size: {
  visible: 20,
  hidden: 110,
  total: 130,
  multiplier: 6.5
}
Active signals: [ 'refillingOrders', 'volumeAnomaly', 'priceRejection' ]
```

---

### Example 2: Continuous Monitoring

```javascript
const detector = new IcebergDetector();

// Run detection every second
setInterval(async () => {
  // Fetch current order book
  const orderBook = await fetchOrderBook();
  const recentTrades = await fetchRecentTrades();
  
  // Detect icebergs
  const result = detector.detect(orderBook, recentTrades);
  
  if (result.detected && result.confidence === 'HIGH') {
    console.log(`🧊 ICEBERG ALERT!`);
    console.log(`  Score: ${(result.score * 100).toFixed(0)}%`);
    console.log(`  Hidden: ~${result.estimatedHiddenSize.hidden.toFixed(0)} BTC`);
    console.log(`  Signals: ${Object.keys(result.signals).filter(k => result.signals[k].detected).join(', ')}`);
    
    // Take action (e.g., adjust trading strategy)
    adjustStrategy(result);
  }
}, 1000);
```

---

### Example 3: Integration with EscapeTypeDetector

```javascript
const EscapeTypeDetector = require('./EscapeTypeDetector');
const IcebergDetector = require('./IcebergDetector');

// EscapeTypeDetector already includes IcebergDetector after integration
const escapeDetector = new EscapeTypeDetector(dataCollector);

// Run detection (iceberg detection happens automatically)
const detection = escapeDetector.detect();

console.log('Escape type:', detection.type);
console.log('Confidence:', detection.confidence);

// Access iceberg information
if (detection.metrics.potential?.components?.iceberg?.detected) {
  const iceberg = detection.metrics.potential.components.iceberg;
  console.log('🧊 Iceberg detected!');
  console.log('  Confidence:', iceberg.confidence);
  console.log('  Hidden size:', iceberg.estimatedHiddenSize.hidden);
  console.log('  Regime:', detection.metrics.potential.regime);
}

// Get iceberg statistics
const icebergStats = escapeDetector.getIcebergStats();
console.log('Total iceberg detections:', icebergStats.detector.totalDetections);
console.log('High confidence detections:', icebergStats.detector.highConfidenceDetections);
```

---

## ⚙️ Configuration

### Default Configuration

```javascript
const detector = new IcebergDetector({
  // Refilling Pattern
  refillingMinOccurrences: 5,    // Appears 5+ times
  refillingMaxSize: 5,            // Max 5 BTC
  refillingMinLevels: 3,          // At least 3 levels
  
  // Volume Anomaly
  volumeAnomalyRatio: 2.0,        // Executed > 2x visible
  volumeWindowMs: 300000,         // 5 minutes
  
  // Price Rejection
  rejectionMinCount: 3,           // Rejected 3+ times
  rejectionRoundTo: 100,          // Round to $100
  
  // Depth Regeneration
  regenMinDrop: 0.2,              // 20% drop
  regenMinRecovery: 0.15,         // 15% recovery
  regenMinCount: 2,               // Happens 2+ times
  
  // Consistent Size
  consistentSizeMinOccurrences: 5, // Appears 5+ times
  consistentSizeRounding: 0.1,    // Round to 0.1 BTC
  
  // Weights for scoring
  weights: {
    refillingOrders: 0.30,
    volumeAnomaly: 0.25,
    priceRejection: 0.20,
    depthRegeneration: 0.15,
    consistentSize: 0.10
  },
  
  // History buffer sizes
  maxSnapshotHistory: 100,
  maxTradeHistory: 1000,
  maxPriceHistory: 500,
  maxDepthHistory: 100
});
```

### Custom Configuration (Aggressive)

```javascript
// More sensitive detection (more false positives)
const aggressiveDetector = new IcebergDetector({
  refillingMinOccurrences: 3,     // Lower threshold
  volumeAnomalyRatio: 1.5,        // Lower threshold
  rejectionMinCount: 2,           // Lower threshold
  regenMinCount: 1,               // Lower threshold
  consistentSizeMinOccurrences: 3 // Lower threshold
});
```

### Custom Configuration (Conservative)

```javascript
// Less sensitive detection (fewer false positives)
const conservativeDetector = new IcebergDetector({
  refillingMinOccurrences: 8,     // Higher threshold
  volumeAnomalyRatio: 3.0,        // Higher threshold
  rejectionMinCount: 5,           // Higher threshold
  regenMinCount: 3,               // Higher threshold
  consistentSizeMinOccurrences: 8 // Higher threshold
});
```

---

## 📚 API Reference

### `IcebergDetector.detect(orderBook, recentTrades)`

**Parameters:**
- `orderBook` (Object): Current order book snapshot
  - `asks` (Array): Ask orders `[[price, size], ...]`
  - `bids` (Array): Bid orders `[[price, size], ...]`
  - `depth` (Number, optional): Total depth in USD
  - `spread_pct` (Number, optional): Spread percentage
  - `BI` (Number, optional): Book imbalance (-1 to 1)
  
- `recentTrades` (Array, optional): Recent trades for volume anomaly
  - `[{ timestamp, size, price }, ...]`

**Returns:**
```javascript
{
  detected: true,                    // Boolean
  score: 0.65,                       // 0-1
  confidence: 'HIGH',                // VERY_LOW, LOW, MEDIUM, HIGH, VERY_HIGH
  signals: {                         // Individual signals
    refillingOrders: { detected: true, score: 0.8, ... },
    volumeAnomaly: { detected: true, score: 0.6, ... },
    priceRejection: { detected: true, score: 0.7, ... },
    depthRegeneration: { detected: false, ... },
    consistentSize: { detected: false, ... }
  },
  estimatedHiddenSize: {             // Size estimation
    visible: 20,
    hidden: 110,
    total: 130,
    multiplier: 6.5
  },
  timestamp: '2026-01-01T...',
  details: { ... }
}
```

---

### `IcebergDetector.getStats()`

**Returns:**
```javascript
{
  totalDetections: 1523,
  highConfidenceDetections: 342,
  lastDetectionTime: '2026-01-01T...',
  averageScore: 0.45,
  historyBuffers: {
    snapshots: 100,
    trades: 856,
    prices: 500,
    depths: 100
  }
}
```

---

### `IcebergDetector.reset()`

Resets all internal state and history buffers.

```javascript
detector.reset();
```

---

## 🧪 Testing

### Test Script

```javascript
// test-iceberg-detector.js

const IcebergDetector = require('./IcebergDetector');

// Create detector
const detector = new IcebergDetector();

// Test Case 1: Refilling Pattern
console.log('=== Test 1: Refilling Pattern ===');

for (let i = 0; i < 10; i++) {
  const orderBook = {
    asks: [
      [88000, 2.0],  // Same size, same price
      [88050, 1.5],
      [88100, 2.0]
    ],
    bids: [[87950, 3.0]]
  };
  
  const result = detector.detect(orderBook);
  console.log(`Iteration ${i + 1}: Score = ${result.score.toFixed(2)}`);
}

// After 10 iterations, refilling pattern should be detected
const finalResult = detector.detect({
  asks: [[88000, 2.0], [88050, 1.5]],
  bids: [[87950, 3.0]]
});

console.log('Final result:', finalResult.signals.refillingOrders);
console.log('');

// Test Case 2: Volume Anomaly
console.log('=== Test 2: Volume Anomaly ===');

const orderBook2 = {
  asks: [[88000, 5.0], [88050, 3.0]],
  bids: [[87950, 4.0], [87900, 2.0]]
};

const recentTrades = [];
for (let i = 0; i < 50; i++) {
  recentTrades.push({
    timestamp: Date.now() - i * 1000,
    size: 2.0,
    price: 88000
  });
}

const result2 = detector.detect(orderBook2, recentTrades);
console.log('Volume anomaly detected:', result2.signals.volumeAnomaly.detected);
console.log('Ratio:', result2.signals.volumeAnomaly.ratio.toFixed(2));
console.log('');

// Test Case 3: Price Rejection
console.log('=== Test 3: Price Rejection ===');

// Simulate price bouncing off $88,000
const prices = [
  87900, 87950, 88000, 87950,  // Rejection 1
  87950, 87980, 88000, 87960,  // Rejection 2
  87960, 87990, 88000, 87970,  // Rejection 3
  87970, 87995, 88000, 87980   // Rejection 4
];

prices.forEach(price => {
  detector.priceHistory.push(price);
});

const result3 = detector.detect(orderBook2);
console.log('Price rejection detected:', result3.signals.priceRejection.detected);
console.log('Rejection levels:', result3.signals.priceRejection.rejectionLevels);
console.log('');

// Test Case 4: Overall Detection
console.log('=== Test 4: Overall Detection ===');
console.log('Overall score:', result3.score.toFixed(2));
console.log('Confidence:', result3.confidence);
console.log('Estimated hidden size:', result3.estimatedHiddenSize);
console.log('Active signals:', Object.keys(result3.signals).filter(k => result3.signals[k].detected));
```

**Run:**
```bash
node test-iceberg-detector.js
```

---

## 🔧 Troubleshooting

### Issue 1: Low Detection Rate

**Symptom:** Detector rarely detects icebergs

**Solutions:**
1. Lower thresholds (use aggressive config)
2. Increase history buffer sizes
3. Ensure order book updates are frequent (< 1s)
4. Check if `recentTrades` data is provided

---

### Issue 2: Too Many False Positives

**Symptom:** Detector triggers too often

**Solutions:**
1. Raise thresholds (use conservative config)
2. Increase `refillingMinOccurrences` to 8+
3. Increase `volumeAnomalyRatio` to 3.0+
4. Require more signals (check `score > 0.5` instead of `detected`)

---

### Issue 3: No Volume Anomaly Detection

**Symptom:** `volumeAnomaly` never triggers

**Solutions:**
1. Ensure `recentTrades` is passed to `detect()`
2. Check trade timestamps are recent (< 5 min)
3. Verify trade `size` field is populated
4. Lower `volumeAnomalyRatio` threshold

---

### Issue 4: Memory Usage Growing

**Symptom:** Memory increases over time

**Solutions:**
1. Reduce history buffer sizes in config
2. Call `detector.reset()` periodically (e.g., daily)
3. Limit `maxSnapshotHistory` to 50-100

---

## 🎯 Best Practices

### 1. Combine with Other Indicators

```javascript
// Don't rely on iceberg detection alone
if (icebergDetected && highOrderBookImbalance && nearGammaWall) {
  // High confidence resistance
  expectReversal();
}
```

### 2. Adjust for Market Regime

```javascript
// Use different thresholds for different regimes
const config = marketRegime === 'HIGH_VOLATILITY' 
  ? conservativeConfig 
  : aggressiveConfig;

const detector = new IcebergDetector(config);
```

### 3. Monitor Statistics

```javascript
// Track detection accuracy
setInterval(() => {
  const stats = detector.getStats();
  console.log(`Detections: ${stats.totalDetections}`);
  console.log(`High confidence: ${stats.highConfidenceDetections}`);
  console.log(`Average score: ${stats.averageScore.toFixed(2)}`);
}, 60000);
```

### 4. Log Detections for Analysis

```javascript
if (result.detected && result.confidence === 'HIGH') {
  fs.appendFileSync('iceberg-log.csv', 
    `${result.timestamp},${result.score},${result.confidence},${result.estimatedHiddenSize.hidden}\n`
  );
}
```

---

## 🍺 Conclusion

**IcebergDetector** reveals hidden liquidity using 5 powerful heuristics:

1. ✅ Refilling Pattern
2. ✅ Volume Anomaly
3. ✅ Price Rejection
4. ✅ Depth Regeneration
5. ✅ Consistent Size

**Integration with EscapeTypeDetector:**
- Adaptive Potential calculation
- Regime detection (OPTIONS_ACTIVE vs INACTIVE)
- Iceberg-aware resistance estimation

**SKÅL!** 🍺⚔️

**"Que as ordens ocultas sejam reveladas!"** 🧊
