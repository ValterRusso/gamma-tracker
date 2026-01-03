# 🎯 Half Pipe Escape System - Visual Architecture Guide

**Author:** Gamma Tracker Team  
**Date:** 2026-01-01  
**Version:** 1.0  

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Mind Map Explanation](#mind-map-explanation)
3. [Architecture Flow](#architecture-flow)
4. [Component Details](#component-details)
5. [Metrics Calculation](#metrics-calculation)
6. [Detection Logic](#detection-logic)
7. [TOZ (Time-Out-of-Zone)](#toz-time-out-of-zone)
8. [Alert System](#alert-system)
9. [API Endpoints](#api-endpoints)
10. [Future Enhancements](#future-enhancements)

---

## 🎯 Overview

The **Half Pipe Escape System** is a sophisticated real-time detection engine that identifies three types of price escape patterns from gamma walls in cryptocurrency futures markets:

- **H1 (Good Escape):** Real breakout with sustained energy
- **H2 (False Escape):** False breakout that reverses back
- **H3 (Liquidity Collapse):** Violent cascade-driven move

The system combines data from three independent sources (OrderBook, Liquidations, GEX) to calculate escape probability and detect market regime changes.

---

## 🗺️ Mind Map Explanation

### **Purpose**
The mind map (`escape-system-mindmap.png`) provides a **conceptual overview** of all system components and their relationships.

### **Structure**

#### **1. Data Sources (Blue)**
- **OrderBook Analyzer:** Real-time order book imbalance, persistence, depth, spread
- **Liquidation Tracker:** Liquidation events, cascades, energy score
- **GEX Calculator:** Gamma exposure, put/call walls, wall strength
- **Price Feed:** Current BTC price for calculations

#### **2. Metrics Engine (Orange/Red)**
- **Sustained Energy:** Calculated from order book stability
- **Injected Energy:** Calculated from liquidation activity
- **Potential:** Calculated from gamma walls (resistance)
- **P_escape:** Probability of escape = totalEnergy / potential
- **Direction:** Market direction (UP/DOWN/NEUTRAL)

#### **3. Detection Logic (Green/Yellow/Red)**
- **H1 Conditions:** High persistence, strong energy, moderate liquidations
- **H2 Conditions:** Low persistence, weak energy, strong wall ahead
- **H3 Conditions:** Cascade detected, liquidity draining, high energy

#### **4. Alert System (Purple)**
- **Alert Types:** H1_DETECTED, H2_DETECTED, H3_DETECTED, HIGH_P_ESCAPE, HIGH_REVERSAL_PROBABILITY
- **Alert Storage:** Max 50 alerts, FIFO queue

#### **5. TOZ (Time-Out-of-Zone) (Cyan - Future)**
- **Zone Definition:** Between put wall and call wall
- **Tracking:** Escape duration, confirmation levels
- **Integration:** Adjusts confidence for H1/H2

#### **6. Output (Gray)**
- **Detection Object:** Complete detection result with all metrics
- **History:** Rolling 60-minute buffer
- **Statistics:** Counts, averages, performance metrics

---

## 🏗️ Architecture Flow

### **Purpose**
The architecture diagram (`escape-system-architecture.png`) shows the **data flow** through the system from collection to output.

### **Layers**

#### **Layer 1: Data Collection**
```
OrderBook → DataCollector
Liquidations → DataCollector
GEX → DataCollector
Price → DataCollector
```

All data sources feed into the central `DataCollector` hub.

#### **Layer 2: Metrics Calculation**
```
DataCollector → Sustained Energy (from OrderBook)
DataCollector → Injected Energy (from Liquidations)
DataCollector → Potential (from GEX)
Sustained + Injected → Total Energy
Total Energy / Potential → P_escape
```

Metrics are calculated independently and then combined.

#### **Layer 3: Hypothesis Evaluation**
```
Metrics → H1 Check (Good Escape?)
Metrics → H2 Check (False Escape?)
Metrics → H3 Check (Liquidity Collapse?)
```

Each hypothesis is evaluated against its specific conditions.

#### **Layer 4: Detection Engine**
```
H1/H2/H3 Checks → Select Best Match (highest confidence)
Best Match → Generate Interpretation (human-readable)
```

The system selects the hypothesis with the highest confidence (if score > 0.6).

#### **Layer 5: Alert System**
```
Detection → Alert Generator
Alert Generator → H1_DETECTED, H2_DETECTED, H3_DETECTED, etc.
```

Alerts are generated based on detection type and thresholds.

#### **Layer 6: Output & Storage**
```
Detection → Detection Object
Detection → History Buffer (3600 detections)
Detection → Statistics (counts, averages)
```

Results are stored and made available via API endpoints.

#### **Layer 7: API Endpoints**
```
Detection Object → GET /api/escape/detect
Detection Object → GET /api/escape/probability
History → GET /api/escape/history
Alerts → GET /api/escape/alerts
Statistics → GET /api/escape/summary
```

Seven REST endpoints expose system data.

---

## 🔧 Component Details

### **OrderBook Analyzer**
- **Input:** Binance Futures WebSocket (wss://fstream.binance.com)
- **Update Rate:** 100ms
- **Metrics:**
  - `BI` (Book Imbalance): -1 to +1
  - `BI_persistence`: 0 to 1 (stability over time)
  - `depth`: Total bid/ask volume
  - `spread_pct`: Bid-ask spread percentage
  - `spreadQuality`: 0 to 1 (tighter = better)

### **Liquidation Tracker**
- **Input:** Liquidation event stream
- **Window:** 5-minute rolling window
- **Metrics:**
  - `recent5min.totalVolume`: USD volume liquidated
  - `cascade.detected`: Boolean (cascade in progress?)
  - `energy.score`: 0 to 1 (liquidation intensity)
  - `energy.direction`: BULLISH/BEARISH/NEUTRAL

### **GEX Calculator**
- **Input:** Options chain data (strikes, volumes, IVs)
- **Calculations:**
  - `totalGEX`: Net gamma exposure (positive/negative)
  - `gammaFlip`: Price where GEX crosses zero
  - `putWall`: Strongest put strike (support)
  - `callWall`: Strongest call strike (resistance)
  - `wallStrength`: Magnitude of gamma at wall

### **DataCollector**
- **Role:** Central hub that orchestrates all components
- **Methods:**
  - `getOrderBookMetrics()`: Returns current order book state
  - `getLiquidationMetrics()`: Returns liquidation state
  - `getGEX()`: Returns GEX state
  - `getCurrentPrice()`: Returns current BTC price

---

## 📊 Metrics Calculation

### **1. Sustained Energy (0-1)**
**Formula:**
```javascript
sustainedEnergy = (
  |BI| * 0.4 +
  BI_persistence * 0.3 +
  spreadQuality * 0.2 +
  depthComponent * 0.1
)
```

**Components:**
- `|BI|`: Absolute book imbalance (0-1)
- `BI_persistence`: How stable the imbalance is (0-1)
- `spreadQuality`: 1 - (spread_pct * 10000), capped at [0,1]
- `depthComponent`: (depthChange + 0.5) / 1.0, capped at [0,1]

**Interpretation:**
- High (>0.7): Strong, stable order book pressure
- Medium (0.4-0.7): Moderate pressure
- Low (<0.4): Weak or unstable pressure

---

### **2. Injected Energy (0-1)**
**Formula:**
```javascript
injectedEnergy = liquidations.energy.score
```

**Source:** Calculated by `LiquidationTracker` based on:
- Recent liquidation volume
- Cascade detection
- Liquidation rate (events/minute)

**Interpretation:**
- High (>0.7): Heavy liquidations, potential cascade
- Medium (0.4-0.7): Moderate liquidation activity
- Low (<0.4): Light or no liquidations

---

### **3. Potential (0-1)**
**Formula:**
```javascript
potential = (
  gexComponent * 0.6 +
  wallStrength * 0.3 +
  wallProximity * 0.1
)
```

**Components:**
- `gexComponent`: |totalGEX| / 1e9, capped at 0.5B
- `wallStrength`: max(putWallGEX, callWallGEX) / 1e9
- `wallProximity`: 1 - min(putDistance%, callDistance%)

**Interpretation:**
- High (>0.7): Strong gamma wall, high resistance
- Medium (0.4-0.7): Moderate resistance
- Low (<0.4): Weak wall, low resistance

---

### **4. P_escape (0-1)**
**Formula:**
```javascript
totalEnergy = (sustainedEnergy + injectedEnergy) / 2
P_escape = totalEnergy / potential
```

**Interpretation:**
- **For H1 and H3:** High P_escape (>0.6) = likely to escape
- **For H2:** High P_escape is INVERTED! High raw P_escape = low escape probability (reversal expected)

**Effective P for H2:**
```javascript
effectiveP = 1 - P_escape  // Inverted for interpretation
```

---

### **5. Direction (UP/DOWN/NEUTRAL)**
**Logic:**
```javascript
if (BI_direction === liq_direction && !== 'NEUTRAL') {
  return BI_direction === 'BULLISH' ? 'UP' : 'DOWN';
}
if (|BI| > 0.6) {
  return BI > 0 ? 'UP' : 'DOWN';
}
return 'NEUTRAL';
```

**Interpretation:**
- **UP:** Bullish pressure (buying > selling)
- **DOWN:** Bearish pressure (selling > buying)
- **NEUTRAL:** No clear direction

---

## 🔍 Detection Logic

### **H1: Good Escape (Real Breakout)**

**Conditions:**
| Condition | Threshold | Met When |
|-----------|-----------|----------|
| BI Persistence | > 0.7 | High stability |
| Sustained Energy | > 0.6 | Strong order book |
| Injected Energy | 0.4 - 0.7 | Moderate liquidations |
| Cascade | false | No cascade |
| Depth Change | > -0.2 | Liquidity stable |
| Spread Quality | > 0.7 | Tight spreads |
| Wall Distance | < 0.05 | Near wall |
| P_escape | > 0.6 | High escape probability |

**Confidence Weights:**
- BI Persistence: 20%
- Sustained Energy: 20%
- Injected Energy: 15%
- No Cascade: 10%
- Depth Change: 10%
- Spread Quality: 10%
- Wall Distance: 5%
- P_escape: 10%

**Interpretation:**
```
🚀 GOOD ESCAPE detected with 75% confidence.
High probability (85%) of sustained breakout.
```

**Trading Implication:**
- ✅ Real breakout likely
- ✅ Consider entering in direction of escape
- ✅ Set stops below/above wall

---

### **H2: False Escape (Reversal)**

**Conditions:**
| Condition | Threshold | Met When |
|-----------|-----------|----------|
| BI Persistence | < 0.4 | Low stability |
| Sustained Energy | 0.3 - 0.7 | Medium energy |
| Injected Energy | < 0.4 | Low liquidations |
| Cascade | false | No cascade |
| Wall Distance | < 0.03 | Very close to wall |
| Wall Strength | > 0.7 | Strong wall |
| P_escape | < 0.4 | LOW escape probability |

**Confidence Weights:**
- BI Persistence: 25%
- Sustained Energy: 15%
- Injected Energy: 15%
- No Cascade: 10%
- Wall Distance: 10%
- Wall Strength: 15%
- P_escape: 10%

**Interpretation:**
```
⚠️ FALSE ESCAPE detected with 75% confidence.
High probability (90%) of breakthrough - expect reversal back into the Half Pipe.
```

**Note:** P_escape is INVERTED for H2!
- Raw P_escape = 0.10 → effectiveP = 0.90 (90% reversal probability)

**Trading Implication:**
- ❌ Breakout likely to fail
- ❌ Avoid entering in direction of escape
- ✅ Consider fade trade (counter-trend)

---

### **H3: Liquidity Collapse (Cascade)**

**Conditions:**
| Condition | Threshold | Met When |
|-----------|-----------|----------|
| Injected Energy | > 0.7 | Very high liquidations |
| Cascade | true | CASCADE DETECTED! |
| Depth Change | < -0.3 | Liquidity draining fast |
| Spread Quality | < 0.5 | Spreads widening |
| Spread Pulse | > 2.0 | High volatility |
| P_escape | > 0.8 | Very high probability |

**Confidence Weights:**
- Injected Energy: 30%
- Cascade Detected: 30%
- Depth Change: 15%
- Spread Quality: 10%
- Spread Pulse: 10%
- P_escape: 5%

**Interpretation:**
```
💀 LIQUIDITY COLLAPSE detected with 85% confidence!
DANGER: Liquidation cascade in progress ($12.5M in 5min).
Liquidity draining (depth: -45%), spreads widening (quality: 35%).
Very high probability (92%) of violent down move.
Stay out or use wide stops!
```

**Trading Implication:**
- ⚠️ EXTREME RISK!
- ❌ Stay out of the market
- ❌ If in position, use very wide stops
- ⚠️ Expect violent, unpredictable moves

---

## ⏱️ TOZ (Time-Out-of-Zone)

### **Concept**
**Time-Out-of-Zone (TOZ)** measures how long the price stays OUTSIDE the Half Pipe zone after an escape attempt.

### **Why It Matters**
- **Confirmation:** Real escapes sustain for longer periods
- **Filter:** Reduces false positives from quick whipsaws
- **Strength Indicator:** Longer TOZ = stronger escape

### **Zone Definition**
```
Zone = [Put Wall Strike, Call Wall Strike]

Example:
Put Wall = $87,000
Call Wall = $88,000
Zone = [$87,000, $88,000]

Price = $88,200 → OUT OF ZONE (above call wall)
Price = $87,500 → IN ZONE
Price = $86,800 → OUT OF ZONE (below put wall)
```

### **Tracking Logic**
```javascript
// Escape starts
if (price > callWall || price < putWall) {
  escapeStartTime = now;
  isOutOfZone = true;
}

// Calculate TOZ
if (isOutOfZone) {
  currentTOZ = (now - escapeStartTime) / 1000; // seconds
}

// Return to zone
if (price >= putWall && price <= callWall) {
  returnedToZone = true;
  isOutOfZone = false;
  finalTOZ = currentTOZ;
}
```

### **Confirmation Levels**
| TOZ Duration | Level | Interpretation |
|--------------|-------|----------------|
| < 30s | UNCONFIRMED | Too early to tell |
| 30-60s | WEAK | Possible escape, watch closely |
| 60-120s | MODERATE | Likely real escape |
| 120-300s | STRONG | High confidence escape |
| > 300s | CONFIRMED | Escape confirmed |

### **Integration with H1/H2**

**H1 (Good Escape):**
```javascript
// Bonus for sustained TOZ
if (TOZ > 60s) confidence += 0.1;
if (TOZ > 120s) confidence += 0.1;

// Add condition
timeConfirmation: {
  value: currentTOZ,
  threshold: 60,
  met: currentTOZ > 60 && !returnedToZone
}
```

**H2 (False Escape):**
```javascript
// Penalty for long TOZ (contradicts H2)
if (TOZ > 120s) confidence -= 0.2;

// Add condition
quickReturn: {
  value: currentTOZ,
  threshold: 30,
  met: (currentTOZ < 30 && returnedToZone) ||
       (currentTOZ < 60 && !isOutOfZone)
}
```

### **Example Scenarios**

**Scenario 1: H1 Confirmed**
```
t=0s:   Price breaks $88,000 call wall
t=10s:  TOZ = 10s → UNCONFIRMED
t=40s:  TOZ = 40s → WEAK
t=70s:  TOZ = 70s → MODERATE, H1 confidence +10%
t=130s: TOZ = 130s → STRONG, H1 confidence +20%
t=310s: TOZ = 310s → CONFIRMED!
```

**Scenario 2: H2 Confirmed**
```
t=0s:   Price breaks $88,000 call wall
t=10s:  TOZ = 10s → UNCONFIRMED
t=25s:  Price returns to $87,800 (in zone)
        → returnedToZone = true, finalTOZ = 25s
        → H2 CONFIRMED! (quick return)
```

### **Future Implementation**
TOZ tracking is **conceptually designed** but not yet implemented. It will be added in Phase 2 (Calibration & Optimization).

---

## 🔔 Alert System

### **Alert Types**

#### **1. H1_DETECTED**
- **Trigger:** H1 detected with confidence > 70%
- **Severity:** HIGH
- **Message:** `Good Escape detected with 75% confidence`

#### **2. H2_DETECTED**
- **Trigger:** H2 detected with confidence > 70%
- **Severity:** MEDIUM
- **Message:** `False Escape detected with 75% confidence`

#### **3. H3_DETECTED**
- **Trigger:** H3 detected (any confidence)
- **Severity:** CRITICAL
- **Message:** `⚠️ LIQUIDITY COLLAPSE detected with 85% confidence!`

#### **4. HIGH_P_ESCAPE**
- **Trigger:** P_escape > 80% AND type !== 'H2'
- **Severity:** MEDIUM
- **Message:** `Escape probability increased to 85%`
- **Note:** Does NOT trigger for H2 (where high P_escape means reversal!)

#### **5. HIGH_REVERSAL_PROBABILITY**
- **Trigger:** type === 'H2' AND P_escape < 30%
- **Severity:** MEDIUM
- **Message:** `High reversal probability (90%) - expect price to return to Half Pipe`
- **Note:** Only for H2, uses inverted probability

### **Alert Storage**
- **Max Alerts:** 50
- **Queue Type:** FIFO (First In, First Out)
- **Persistence:** In-memory (cleared on restart)

### **Alert Object Structure**
```javascript
{
  id: "alert_1735736919474_h2",
  type: "H2_DETECTED",
  severity: "MEDIUM",
  timestamp: "2026-01-01T13:28:39.474Z",
  message: "False Escape detected with 75% confidence",
  details: { /* full detection object */ }
}
```

---

## 🌐 API Endpoints

### **1. GET /api/escape/detect**
**Description:** Get current detection result  
**Response:**
```json
{
  "type": "H2",
  "confidence": 0.75,
  "direction": "NEUTRAL",
  "timestamp": "2026-01-01T13:28:39.474Z",
  "interpretation": "⚠️ FALSE ESCAPE detected...",
  "metrics": {
    "sustainedEnergy": 0.45,
    "injectedEnergy": 0.02,
    "totalEnergy": 0.235,
    "potential": 0.10,
    "P_escape": 1.0,
    "direction": "NEUTRAL"
  },
  "conditions": { /* check results */ },
  "wallInfo": { /* nearest wall */ },
  "rawData": { /* source data */ }
}
```

### **2. GET /api/escape/probability**
**Description:** Get escape probability and energy metrics  
**Response:**
```json
{
  "P_escape": 1.0,
  "totalEnergy": 0.235,
  "sustainedEnergy": 0.45,
  "injectedEnergy": 0.02,
  "potential": 0.10,
  "direction": "NEUTRAL",
  "timestamp": "2026-01-01T13:28:39.474Z"
}
```

### **3. GET /api/escape/energy**
**Description:** Get detailed energy breakdown  
**Response:**
```json
{
  "sustained": {
    "total": 0.45,
    "components": {
      "biMagnitude": 0.18,
      "persistence": 0.09,
      "spreadQuality": 0.14,
      "depthComponent": 0.04
    }
  },
  "injected": {
    "total": 0.02,
    "liquidationVolume5min": 125000,
    "cascadeDetected": false
  },
  "total": 0.235
}
```

### **4. GET /api/escape/conditions**
**Description:** Get detailed condition checks for current detection  
**Response:**
```json
{
  "type": "H2",
  "confidence": 0.75,
  "conditions": {
    "biPersistence": { "value": 0.3, "threshold": 0.4, "met": true },
    "orderBookEnergy": { "value": 0.45, "threshold": 0.3, "met": true },
    "liquidationEnergy": { "value": 0.02, "threshold": 0.4, "met": true },
    "cascadeDetected": { "value": false, "expected": false, "met": true },
    "wallDistance": { "value": 0.02, "threshold": 0.03, "met": true },
    "wallStrength": { "value": 0.85, "threshold": 0.7, "met": true },
    "P_escape": { "value": 1.0, "threshold": 0.4, "met": false }
  },
  "score": 0.857,
  "metChecks": 6,
  "totalChecks": 7
}
```

### **5. GET /api/escape/history?minutes=60**
**Description:** Get detection history  
**Query Params:** `minutes` (default: 60)  
**Response:**
```json
{
  "history": [
    {
      "timestamp": "2026-01-01T13:28:39.474Z",
      "type": "H2",
      "confidence": 0.75,
      "P_escape": 1.0,
      "direction": "NEUTRAL"
    },
    // ... up to 3600 entries (60 minutes at 1/sec)
  ],
  "count": 3600,
  "timeRange": {
    "start": "2026-01-01T12:28:39.474Z",
    "end": "2026-01-01T13:28:39.474Z"
  }
}
```

### **6. GET /api/escape/alerts**
**Description:** Get active alerts  
**Response:**
```json
{
  "alerts": [
    {
      "id": "alert_1735736919474_h2",
      "type": "H2_DETECTED",
      "severity": "MEDIUM",
      "timestamp": "2026-01-01T13:28:39.474Z",
      "message": "False Escape detected with 75% confidence",
      "details": { /* full detection */ }
    },
    // ... up to 50 alerts
  ],
  "count": 2
}
```

### **7. GET /api/escape/summary**
**Description:** Get system statistics  
**Response:**
```json
{
  "stats": {
    "totalDetections": 15234,
    "h1Count": 342,
    "h2Count": 567,
    "h3Count": 12,
    "noneCount": 14313,
    "lastDetectionTime": "2026-01-01T13:28:39.474Z",
    "historySize": 3600,
    "averageConfidence": 0.68,
    "activeAlerts": 2
  },
  "currentDetection": { /* latest detection */ }
}
```

---

## 🚀 Future Enhancements

### **1. TOZ Implementation**
- [ ] Add `tozTracker` to EscapeTypeDetector
- [ ] Implement `updateTOZ()` method
- [ ] Integrate TOZ into H1/H2 conditions
- [ ] Add TOZ to API responses
- [ ] Create TOZ visualization in dashboard

### **2. Regime Detection**
- [ ] Detect bull/bear/sideways markets
- [ ] Adjust thresholds per regime
- [ ] Track regime transitions
- [ ] Add regime to detection output

### **3. Backtesting Framework**
- [ ] Historical data replay
- [ ] Accuracy measurement (precision, recall)
- [ ] Threshold optimization
- [ ] Performance metrics (Sharpe, win rate)

### **4. Machine Learning**
- [ ] Feature engineering from metrics
- [ ] Train classifier for H1/H2/H3
- [ ] Adaptive threshold learning
- [ ] Anomaly detection

### **5. Dashboard Enhancements**
- [ ] Real-time detection visualization
- [ ] TOZ timeline chart
- [ ] Alert history with filtering
- [ ] Performance analytics
- [ ] Backtest results viewer

### **6. Advanced Metrics**
- [ ] Escape Strength Score (ESS)
- [ ] Reversal Risk Score (RRS)
- [ ] Volatility-adjusted thresholds
- [ ] Multi-timeframe analysis

---

## 📚 References

### **Key Files**
- `EscapeTypeDetector.js`: Main detection engine (898 lines)
- `escape-endpoints.js`: API endpoints (7 endpoints)
- `OrderBookAnalyzer.js`: Order book metrics (650+ lines)
- `LiquidationTracker.js`: Liquidation tracking (450+ lines)

### **Documentation**
- `ESCAPE_INTEGRATION_GUIDE.md`: Integration guide
- `escapetypedetector-system.tar.gz`: Complete system package
- `escape-system-mindmap.png`: Mind map diagram
- `escape-system-architecture.png`: Architecture flow diagram

### **GitHub Repository**
- https://github.com/ValterRusso/gamma-tracker

---

## 🎯 Quick Reference

### **Metric Ranges**
| Metric | Range | High | Medium | Low |
|--------|-------|------|--------|-----|
| Sustained Energy | 0-1 | >0.7 | 0.4-0.7 | <0.4 |
| Injected Energy | 0-1 | >0.7 | 0.4-0.7 | <0.4 |
| Potential | 0-1 | >0.7 | 0.4-0.7 | <0.4 |
| P_escape | 0-1 | >0.7 | 0.4-0.7 | <0.4 |
| BI Persistence | 0-1 | >0.7 | 0.4-0.7 | <0.4 |

### **Detection Thresholds**
| Hypothesis | Min Score | Min Confidence | Key Condition |
|------------|-----------|----------------|---------------|
| H1 | 0.6 | 0.7 (for alert) | Persistence > 0.7 |
| H2 | 0.6 | 0.7 (for alert) | Persistence < 0.4 |
| H3 | 0.6 | Any (CRITICAL) | Cascade = true |

### **Alert Severities**
- **CRITICAL:** H3 (Liquidity Collapse)
- **HIGH:** H1 (Good Escape)
- **MEDIUM:** H2 (False Escape), High P_escape, High Reversal

---

**End of Visual Architecture Guide** 🎯

**SKÅL!** 🍺⚔️
