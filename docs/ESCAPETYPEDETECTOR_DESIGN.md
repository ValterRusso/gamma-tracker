# EscapeTypeDetector - Design Document

## 🎯 Overview

The **EscapeTypeDetector** is the brain of the Half Pipe Model. It combines data from three sources to detect the type of price escape from gamma walls:

- **H1 (Good Escape)**: Sustained energy + strong liquidity → Real breakout
- **H2 (False Escape)**: Initial energy but weak persistence → False breakout (reversal)
- **H3 (Liquidity Collapse)**: Energy spike + liquidity drain → Violent move (cascade)

---

## 🏗️ Architecture

### Data Sources

```javascript
// 1. OrderBook Analyzer (Sustained Energy)
const orderBook = {
  bookImbalance: -0.45,        // Strong sell pressure
  biPersistence: 0.82,         // Very sustained (82% of time)
  depthChange: -0.15,          // Liquidity slightly down
  spreadQuality: 0.85,         // Good execution quality
  energyScore: 0.68            // Medium-high energy
};

// 2. Liquidation Tracker (Injected Energy)
const liquidations = {
  recentVolume: 15000000,      // $15M in last 5min
  cascadeDetected: true,       // Cascade in progress
  dominantSide: 'LONG',        // Longs being liquidated
  energyScore: 0.75            // High energy
};

// 3. GEX Calculator (Potential)
const gex = {
  totalGEX: -250000000,        // -$250M (negative gamma)
  gammaFlip: 42500,            // Flip price
  currentPrice: 43200,         // Above flip (unstable)
  nearestWall: {
    type: 'put',
    strike: 42000,
    distance: 1200,            // $1200 away
    strength: 0.85             // Strong wall
  }
};
```

### Detection Logic Flow

```
┌─────────────────────────────────────────┐
│  1. COLLECT DATA                        │
│  - OrderBook metrics                    │
│  - Liquidation metrics                  │
│  - GEX metrics                          │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  2. CALCULATE COMBINED METRICS          │
│  - Total Energy (sustained + injected)  │
│  - Potential (GEX magnitude)            │
│  - P_escape = Energy / Potential        │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  3. EVALUATE CONDITIONS                 │
│  - Check H1 conditions                  │
│  - Check H2 conditions                  │
│  - Check H3 conditions                  │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  4. DETECT ESCAPE TYPE                  │
│  - Assign type (H1/H2/H3/NONE)          │
│  - Calculate confidence (0-1)           │
│  - Generate interpretation              │
└─────────────────────────────────────────┘
```

---

## 🎯 Detection Algorithms

### H1: Good Escape (Real Breakout)

**Conditions:**
```javascript
const H1_conditions = {
  // 1. High sustained energy
  biPersistence: > 0.7,              // Persistent flow
  orderBookEnergy: > 0.6,            // Strong book pressure
  
  // 2. Moderate injected energy
  liquidationEnergy: 0.4 - 0.7,      // Not too extreme
  cascadeDetected: false,            // No cascade
  
  // 3. Good liquidity
  depthChange: > -0.2,               // Liquidity stable or growing
  spreadQuality: > 0.7,              // Good execution
  
  // 4. Approaching wall
  wallDistance: < 5%,                // Near gamma wall
  P_escape: > 0.6                    // High escape probability
};
```

**Interpretation:**
- ✅ Sustained directional flow
- ✅ Healthy liquidity
- ✅ Moderate liquidations (fuel, not panic)
- ✅ High probability of breaking through wall
- 🎯 **Action**: Trend-following strategies

**Example Scenario:**
```
Price: $43,200
Gamma Flip: $42,500 (above flip = unstable)
Put Wall: $42,000 (2.8% below)

OrderBook:
- BI: -0.55 (sell pressure)
- BI Persistence: 0.78 (very sustained)
- Depth: Stable
- Spread: 0.02% (excellent)

Liquidations:
- Volume: $8M (moderate)
- No cascade
- Longs being liquidated

Detection: H1 (Good Escape)
Confidence: 0.82
Direction: DOWN (toward put wall)
Interpretation: "Strong sustained sell pressure with healthy 
liquidity. Moderate long liquidations providing fuel. High 
probability of breaking $42,000 put wall."
```

---

### H2: False Escape (Reversal Setup)

**Conditions:**
```javascript
const H2_conditions = {
  // 1. Initial energy but weak persistence
  biPersistence: < 0.4,              // Oscillating
  orderBookEnergy: 0.3 - 0.6,        // Medium energy
  
  // 2. Low injected energy
  liquidationEnergy: < 0.4,          // Weak liquidations
  cascadeDetected: false,            // No cascade
  
  // 3. Strong wall ahead
  wallDistance: < 3%,                // Very close to wall
  wallStrength: > 0.7,               // Strong resistance
  
  // 4. Low escape probability
  P_escape: < 0.4                    // Low probability
};
```

**Interpretation:**
- ⚠️ Energy not sustained
- ⚠️ Book imbalance oscillating
- ⚠️ Strong wall acting as resistance
- ⚠️ Low probability of breakthrough
- 🎯 **Action**: Fade the move (reversal strategies)

**Example Scenario:**
```
Price: $43,800
Gamma Flip: $42,500
Call Wall: $44,000 (0.5% above)

OrderBook:
- BI: +0.35 (buy pressure)
- BI Persistence: 0.28 (oscillating)
- Depth: Stable
- Spread: 0.03% (good)

Liquidations:
- Volume: $2M (low)
- No cascade
- Shorts being liquidated

Detection: H2 (False Escape)
Confidence: 0.75
Direction: UP (toward call wall)
Interpretation: "Initial buy pressure but weak persistence. 
Strong call wall at $44,000 acting as resistance. Low 
liquidation volume. High probability of reversal."
```

---

### H3: Liquidity Collapse (Violent Move)

**Conditions:**
```javascript
const H3_conditions = {
  // 1. Extreme injected energy
  liquidationEnergy: > 0.7,          // Very high
  cascadeDetected: true,             // Cascade in progress
  
  // 2. Liquidity draining
  depthChange: < -0.3,               // Significant drain
  spreadQuality: < 0.5,              // Poor execution
  
  // 3. High volatility
  spreadPulse: > 2.0,                // Spread spiking
  
  // 4. Very high escape probability
  P_escape: > 0.8                    // Very high
};
```

**Interpretation:**
- 💀 Liquidation cascade in progress
- 💀 Liquidity evaporating
- 💀 Spreads widening (poor execution)
- 💀 Very high probability of violent move
- 🎯 **Action**: Stay out or use wide stops

**Example Scenario:**
```
Price: $43,500
Gamma Flip: $42,500
Put Wall: $42,000 (3.4% below)

OrderBook:
- BI: -0.72 (extreme sell pressure)
- BI Persistence: 0.65 (sustained)
- Depth: -45% (collapsing!)
- Spread: 0.15% (poor, was 0.02%)

Liquidations:
- Volume: $35M (extreme!)
- CASCADE DETECTED
- Longs being liquidated

Detection: H3 (Liquidity Collapse)
Confidence: 0.91
Direction: DOWN
Interpretation: "DANGER! Liquidation cascade in progress 
with $35M in 5min. Liquidity down 45%, spreads widening. 
Expect violent move through $42,000 put wall."
```

---

## 📊 Scoring System

### Energy Score (0-1)

```javascript
// Sustained Energy (from OrderBook)
const sustainedEnergy = (
  Math.abs(bookImbalance) * 0.4 +      // 40%: Magnitude
  biPersistence * 0.3 +                // 30%: Persistence
  spreadQuality * 0.2 +                // 20%: Quality
  depthComponent * 0.1                 // 10%: Depth
);

// Injected Energy (from Liquidations)
const injectedEnergy = liquidationEnergyScore;

// Total Energy
const totalEnergy = (
  sustainedEnergy * 0.5 +              // 50%: Sustained
  injectedEnergy * 0.5                 // 50%: Injected
);
```

### Potential Score (0-1)

```javascript
// Based on GEX magnitude and wall proximity
const potential = Math.min(1.0, (
  (Math.abs(totalGEX) / 1e9) * 0.6 +   // 60%: GEX magnitude
  wallStrength * 0.3 +                 // 30%: Wall strength
  (1 - wallDistance) * 0.1             // 10%: Wall proximity
));
```

### Escape Probability (0-1)

```javascript
const P_escape = Math.min(1.0, totalEnergy / Math.max(0.1, potential));

// Classification:
// P_escape > 0.7  → HIGH (likely escape)
// P_escape 0.4-0.7 → MEDIUM
// P_escape < 0.4  → LOW (likely rejection)
```

### Confidence Score (0-1)

```javascript
// How confident are we in the detection?
const confidence = (
  dataQuality * 0.3 +        // 30%: Data quality (all sources available?)
  signalStrength * 0.4 +     // 40%: How clear are the signals?
  consistency * 0.3          // 30%: Are signals consistent?
);
```

---

## 🔧 Implementation Details

### Class Structure

```javascript
class EscapeTypeDetector {
  constructor(dataCollector) {
    this.dataCollector = dataCollector;
    this.detectionHistory = [];      // Last 60 detections
    this.currentDetection = null;
    this.lastUpdate = null;
  }

  // Main detection method
  detect() {
    const data = this.collectData();
    const metrics = this.calculateMetrics(data);
    const detection = this.evaluateConditions(metrics);
    this.updateHistory(detection);
    return detection;
  }

  // Collect data from all sources
  collectData() {
    return {
      orderBook: this.dataCollector.getOrderBookMetrics(),
      liquidations: this.dataCollector.getLiquidationMetrics(),
      gex: this.dataCollector.getGEX()
    };
  }

  // Calculate combined metrics
  calculateMetrics(data) {
    return {
      sustainedEnergy: this.calculateSustainedEnergy(data.orderBook),
      injectedEnergy: this.calculateInjectedEnergy(data.liquidations),
      potential: this.calculatePotential(data.gex),
      P_escape: this.calculateEscapeProbability(...),
      // ... more metrics
    };
  }

  // Evaluate conditions for each hypothesis
  evaluateConditions(metrics) {
    const h1 = this.checkH1Conditions(metrics);
    const h2 = this.checkH2Conditions(metrics);
    const h3 = this.checkH3Conditions(metrics);
    
    return this.selectBestMatch(h1, h2, h3);
  }

  // Check H1 conditions
  checkH1Conditions(metrics) {
    const score = this.calculateH1Score(metrics);
    const confidence = this.calculateH1Confidence(metrics);
    return { type: 'H1', score, confidence, metrics };
  }

  // ... similar for H2 and H3

  // Select best match
  selectBestMatch(h1, h2, h3) {
    const candidates = [h1, h2, h3].filter(h => h.score > 0.5);
    if (candidates.length === 0) {
      return { type: 'NONE', confidence: 0, interpretation: 'No clear pattern' };
    }
    
    // Return highest confidence
    return candidates.reduce((best, curr) => 
      curr.confidence > best.confidence ? curr : best
    );
  }

  // Getters
  getCurrentDetection() { return this.currentDetection; }
  getHistory() { return this.detectionHistory; }
  getStats() { /* detection statistics */ }
}
```

### Event System

```javascript
// Emit events when detection changes
detector.on('detection', (detection) => {
  console.log(`Detected ${detection.type} with confidence ${detection.confidence}`);
});

detector.on('h1_detected', (detection) => {
  console.log('🚀 Good Escape detected!');
});

detector.on('h2_detected', (detection) => {
  console.log('⚠️ False Escape detected!');
});

detector.on('h3_detected', (detection) => {
  console.log('💀 Liquidity Collapse detected!');
});
```

---

## 🎯 API Endpoints (7 endpoints)

### 1. `/api/escape/detect` - Current Detection
```javascript
GET /api/escape/detect

Response:
{
  "success": true,
  "timestamp": "2025-12-30T22:30:00Z",
  "detection": {
    "type": "H1",                    // H1/H2/H3/NONE
    "confidence": 0.82,              // 0-1
    "direction": "DOWN",             // UP/DOWN/NEUTRAL
    "interpretation": "Strong sustained sell pressure...",
    "metrics": {
      "sustainedEnergy": 0.68,
      "injectedEnergy": 0.55,
      "totalEnergy": 0.615,
      "potential": 0.72,
      "P_escape": 0.85
    },
    "conditions": {
      "biPersistence": 0.78,
      "orderBookEnergy": 0.68,
      "liquidationEnergy": 0.55,
      "cascadeDetected": false,
      "depthChange": -0.08,
      "spreadQuality": 0.88,
      "wallDistance": 0.028,
      "wallStrength": 0.85
    }
  }
}
```

### 2. `/api/escape/probability` - Escape Probability
```javascript
GET /api/escape/probability

Response:
{
  "success": true,
  "timestamp": "2025-12-30T22:30:00Z",
  "probability": {
    "P_escape": 0.85,
    "classification": "HIGH",        // HIGH/MEDIUM/LOW
    "components": {
      "sustainedEnergy": 0.68,
      "injectedEnergy": 0.55,
      "totalEnergy": 0.615,
      "potential": 0.72
    },
    "interpretation": "High probability of escaping gamma wall"
  }
}
```

### 3. `/api/escape/energy` - Energy Breakdown
```javascript
GET /api/escape/energy

Response:
{
  "success": true,
  "timestamp": "2025-12-30T22:30:00Z",
  "energy": {
    "sustained": {
      "score": 0.68,
      "components": {
        "bookImbalance": 0.55,
        "biPersistence": 0.78,
        "spreadQuality": 0.88,
        "depthComponent": 0.52
      }
    },
    "injected": {
      "score": 0.55,
      "volume5min": 8500000,
      "cascadeDetected": false,
      "dominantSide": "LONG"
    },
    "total": 0.615,
    "classification": "MEDIUM-HIGH"
  }
}
```

### 4. `/api/escape/conditions` - Current Conditions
```javascript
GET /api/escape/conditions

Response:
{
  "success": true,
  "timestamp": "2025-12-30T22:30:00Z",
  "conditions": {
    "h1": {
      "score": 0.82,
      "met": true,
      "checks": {
        "biPersistence": { value: 0.78, threshold: 0.7, met: true },
        "orderBookEnergy": { value: 0.68, threshold: 0.6, met: true },
        "liquidationEnergy": { value: 0.55, threshold: [0.4, 0.7], met: true },
        "cascadeDetected": { value: false, expected: false, met: true },
        "depthChange": { value: -0.08, threshold: -0.2, met: true },
        "spreadQuality": { value: 0.88, threshold: 0.7, met: true },
        "wallDistance": { value: 0.028, threshold: 0.05, met: true },
        "P_escape": { value: 0.85, threshold: 0.6, met: true }
      }
    },
    "h2": {
      "score": 0.35,
      "met": false,
      // ... similar structure
    },
    "h3": {
      "score": 0.22,
      "met": false,
      // ... similar structure
    }
  }
}
```

### 5. `/api/escape/history` - Detection History
```javascript
GET /api/escape/history?minutes=60

Response:
{
  "success": true,
  "timestamp": "2025-12-30T22:30:00Z",
  "history": [
    {
      "timestamp": "2025-12-30T22:30:00Z",
      "type": "H1",
      "confidence": 0.82,
      "P_escape": 0.85
    },
    // ... last 60 minutes
  ],
  "stats": {
    "totalDetections": 3600,
    "h1Count": 245,
    "h2Count": 180,
    "h3Count": 12,
    "noneCount": 3163,
    "averageConfidence": 0.68
  }
}
```

### 6. `/api/escape/summary` - Complete Summary
```javascript
GET /api/escape/summary

Response:
{
  "success": true,
  "timestamp": "2025-12-30T22:30:00Z",
  "summary": {
    "currentDetection": { /* from /detect */ },
    "probability": { /* from /probability */ },
    "energy": { /* from /energy */ },
    "recentHistory": [ /* last 10 detections */ ],
    "interpretation": "Comprehensive interpretation combining all data"
  }
}
```

### 7. `/api/escape/alerts` - Active Alerts
```javascript
GET /api/escape/alerts

Response:
{
  "success": true,
  "timestamp": "2025-12-30T22:30:00Z",
  "alerts": [
    {
      "id": "alert_001",
      "type": "H1_DETECTED",
      "severity": "HIGH",
      "timestamp": "2025-12-30T22:28:00Z",
      "message": "Good Escape detected with 82% confidence",
      "details": { /* full detection object */ }
    },
    {
      "id": "alert_002",
      "type": "HIGH_P_ESCAPE",
      "severity": "MEDIUM",
      "timestamp": "2025-12-30T22:25:00Z",
      "message": "Escape probability increased to 0.85",
      "details": { /* probability details */ }
    }
  ]
}
```

---

## 🧪 Testing Strategy

### Unit Tests
- Test each condition checker (H1/H2/H3)
- Test scoring calculations
- Test edge cases (missing data, extreme values)

### Integration Tests
- Test with real data from DataCollector
- Test event emission
- Test history tracking

### Validation Tests
- Compare detections with historical price movements
- Measure accuracy of predictions
- Optimize thresholds based on results

---

## 📈 Performance Considerations

- **Update Frequency**: 1 second (same as other components)
- **History Size**: 3600 detections (1 hour at 1/sec)
- **Memory Usage**: ~500KB for history
- **CPU Usage**: Minimal (simple calculations)

---

## 🎯 Success Metrics

After implementation, we'll measure:

1. **Detection Accuracy**: % of correct predictions
2. **False Positive Rate**: H1/H2 detections that failed
3. **H3 Detection Speed**: How early we detect cascades
4. **Confidence Calibration**: Does 80% confidence = 80% accuracy?

---

## 🚀 Next Steps

1. ✅ Design complete (this document)
2. ⏳ Implement EscapeTypeDetector class
3. ⏳ Create API endpoints
4. ⏳ Integrate into DataCollector
5. ⏳ Test with Postman
6. ⏳ Collect data and validate

---

**Ready to implement!** ⚔️🔥
