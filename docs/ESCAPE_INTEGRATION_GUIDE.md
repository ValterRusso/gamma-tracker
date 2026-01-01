# EscapeTypeDetector - Integration Guide

## 🎯 Overview

This guide provides step-by-step instructions for integrating the **EscapeTypeDetector** into your Gamma Tracker backend.

The EscapeTypeDetector is the final piece of the Half Pipe Model, combining:
- **OrderBookAnalyzer** (sustained energy)
- **LiquidationTracker** (injected energy)
- **GEXCalculator** (potential)

To detect escape types:
- **H1 (Good Escape)**: Real breakout
- **H2 (False Escape)**: Reversal setup
- **H3 (Liquidity Collapse)**: Cascade

---

## 📋 Prerequisites

Before integrating, ensure you have:

✅ **OrderBookAnalyzer** integrated and working
✅ **LiquidationTracker** integrated and working
✅ **GEXCalculator** integrated and working
✅ **DataCollector** with getter methods for all three

Required getter methods in DataCollector:
```javascript
getOrderBookMetrics()     // Returns OrderBook metrics
getLiquidationMetrics()   // Returns Liquidation metrics
getGEX()                  // Returns GEX data
getCurrentPrice()         // Returns current BTC price
```

---

## 🔧 Step 1: Copy Files

Copy the EscapeTypeDetector class to your backend:

```bash
# From your gamma-tracker/backend/src/ directory
cp /path/to/EscapeTypeDetector.js ./EscapeTypeDetector.js
```

Verify the file is in place:
```bash
ls -la EscapeTypeDetector.js
# Should show: EscapeTypeDetector.js (850+ lines)
```

---

## 🔧 Step 2: Import in DataCollector

Open `DataCollector.js` and add the import at the top:

```javascript
const EscapeTypeDetector = require('./EscapeTypeDetector');
```

Add the property in the constructor:

```javascript
class DataCollector {
  constructor(config = {}) {
    // ... existing properties
    
    // EscapeTypeDetector
    this.escapeDetector = null;
    this.detectionInterval = null;
    
    // ... rest of constructor
  }
}
```

---

## 🔧 Step 3: Initialize in start() Method

In the `start()` method of DataCollector, add initialization:

```javascript
async start() {
  // ... existing initialization code
  
  // Initialize OrderBookAnalyzer
  this.orderBookAnalyzer = new OrderBookAnalyzer(this.config.symbol);
  await this.orderBookAnalyzer.connect();
  
  // Initialize LiquidationTracker
  this.liquidationTracker = new LiquidationTracker(this.config.symbol);
  await this.liquidationTracker.connect();
  
  // ... other initializations
  
  // ============================================
  // INITIALIZE ESCAPETYPEDETECTOR
  // ============================================
  console.log('[DataCollector] Initializing EscapeTypeDetector...');
  this.escapeDetector = new EscapeTypeDetector(this);
  
  // Run detection every second
  this.detectionInterval = setInterval(() => {
    try {
      this.escapeDetector.detect();
    } catch (error) {
      console.error('[DataCollector] Detection error:', error.message);
    }
  }, 1000);
  
  // Listen to detection events
  this.escapeDetector.on('detection', (detection) => {
    console.log(`[EscapeDetector] ${detection.type} detected (confidence: ${(detection.confidence * 100).toFixed(0)}%)`);
  });
  
  this.escapeDetector.on('h1_detected', (detection) => {
    console.log('🚀 [EscapeDetector] H1 (Good Escape) detected!');
    console.log(`   ${detection.interpretation}`);
  });
  
  this.escapeDetector.on('h2_detected', (detection) => {
    console.log('⚠️ [EscapeDetector] H2 (False Escape) detected!');
    console.log(`   ${detection.interpretation}`);
  });
  
  this.escapeDetector.on('h3_detected', (detection) => {
    console.log('💀 [EscapeDetector] H3 (Liquidity Collapse) detected!');
    console.log(`   ${detection.interpretation}`);
  });
  
  this.escapeDetector.on('alert', (alert) => {
    console.log(`🔔 [EscapeDetector] Alert: ${alert.message}`);
  });
  
  console.log('[DataCollector] EscapeTypeDetector initialized');
  
  // ... rest of start() method
}
```

---

## 🔧 Step 4: Add Cleanup in stop() Method

In the `stop()` method, add cleanup:

```javascript
async stop() {
  console.log('[DataCollector] Stopping...');
  
  // ... existing cleanup code
  
  // ============================================
  // CLEANUP ESCAPETYPEDETECTOR
  // ============================================
  if (this.detectionInterval) {
    clearInterval(this.detectionInterval);
    this.detectionInterval = null;
  }
  
  if (this.escapeDetector) {
    this.escapeDetector.removeAllListeners();
    this.escapeDetector = null;
  }
  
  // ... rest of cleanup
  
  console.log('[DataCollector] Stopped');
}
```

---

## 🔧 Step 5: Add Getter Methods (if not already present)

Ensure DataCollector has these getter methods:

```javascript
/**
 * Get OrderBook metrics
 */
getOrderBookMetrics() {
  if (!this.orderBookAnalyzer) return null;
  return this.orderBookAnalyzer.getMetrics();
}

/**
 * Get Liquidation metrics
 */
getLiquidationMetrics() {
  if (!this.liquidationTracker) return null;
  return this.liquidationTracker.getMetrics();
}

/**
 * Get GEX data
 */
getGEX() {
  if (!this.gexCalculator) return null;
  return this.gexCalculator.getGEX();
}

/**
 * Get current price
 */
getCurrentPrice() {
  // Return from your price source
  // Example:
  return this.currentPrice || null;
}

/**
 * Get current escape detection
 */
getEscapeDetection() {
  if (!this.escapeDetector) return null;
  return this.escapeDetector.getCurrentDetection();
}

/**
 * Get escape detection history
 */
getEscapeHistory(minutes = 60) {
  if (!this.escapeDetector) return [];
  return this.escapeDetector.getHistory(minutes);
}

/**
 * Get escape alerts
 */
getEscapeAlerts() {
  if (!this.escapeDetector) return [];
  return this.escapeDetector.getAlerts();
}
```

---

## 🔧 Step 6: Add API Endpoints to server.js

Open `server.js` and add the escape endpoints after your existing endpoints:

```javascript
// =============================================================================
// ESCAPE TYPE DETECTOR ENDPOINTS
// =============================================================================

/**
 * GET /api/escape/detect
 * Returns current escape type detection
 */
app.get('/api/escape/detect', (req, res) => {
  try {
    if (!dataCollector.escapeDetector) {
      return res.status(503).json({
        success: false,
        error: 'EscapeTypeDetector not initialized'
      });
    }
    
    const detection = dataCollector.escapeDetector.getCurrentDetection();
    
    if (!detection) {
      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        detection: {
          type: 'NONE',
          confidence: 0,
          direction: 'NEUTRAL',
          interpretation: 'No detection available yet. Waiting for data...'
        }
      });
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      detection
    });
    
  } catch (error) {
    console.error('[API] Error in /api/escape/detect:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/escape/probability
 * Returns escape probability (P_escape)
 */
app.get('/api/escape/probability', (req, res) => {
  try {
    if (!dataCollector.escapeDetector) {
      return res.status(503).json({
        success: false,
        error: 'EscapeTypeDetector not initialized'
      });
    }
    
    const detection = dataCollector.escapeDetector.getCurrentDetection();
    
    if (!detection || !detection.metrics) {
      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        probability: {
          P_escape: 0,
          classification: 'UNKNOWN',
          components: {},
          interpretation: 'No data available yet'
        }
      });
    }
    
    const P_escape = detection.metrics.P_escape;
    let classification = 'MEDIUM';
    if (P_escape > 0.7) classification = 'HIGH';
    else if (P_escape < 0.4) classification = 'LOW';
    
    const interpretation = 
      P_escape > 0.7 ? 
        `High probability of escaping gamma wall. Strong energy (${detection.metrics.totalEnergy.toFixed(2)}) relative to potential (${detection.metrics.potential.toFixed(2)}).` :
      P_escape < 0.4 ?
        `Low probability of escape. Weak energy (${detection.metrics.totalEnergy.toFixed(2)}) relative to potential (${detection.metrics.potential.toFixed(2)}). Expect rejection.` :
        `Medium probability. Energy (${detection.metrics.totalEnergy.toFixed(2)}) and potential (${detection.metrics.potential.toFixed(2)}) are balanced. Watch closely.`;
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      probability: {
        P_escape,
        classification,
        components: {
          sustainedEnergy: detection.metrics.sustainedEnergy,
          injectedEnergy: detection.metrics.injectedEnergy,
          totalEnergy: detection.metrics.totalEnergy,
          potential: detection.metrics.potential
        },
        interpretation
      }
    });
    
  } catch (error) {
    console.error('[API] Error in /api/escape/probability:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/escape/energy
 * Returns energy breakdown
 */
app.get('/api/escape/energy', (req, res) => {
  try {
    if (!dataCollector.escapeDetector) {
      return res.status(503).json({
        success: false,
        error: 'EscapeTypeDetector not initialized'
      });
    }
    
    const detection = dataCollector.escapeDetector.getCurrentDetection();
    
    if (!detection || !detection.metrics) {
      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        energy: {
          sustained: { score: 0, components: {} },
          injected: { score: 0 },
          total: 0,
          classification: 'UNKNOWN'
        }
      });
    }
    
    const orderBook = dataCollector.getOrderBookMetrics();
    const liquidations = dataCollector.getLiquidationMetrics();
    
    const sustainedComponents = orderBook ? {
      bookImbalance: Math.abs(orderBook.bookImbalance?.value || 0),
      biPersistence: orderBook.biPersistence?.value || 0,
      spreadQuality: orderBook.spreadQuality?.score || 0,
      depthComponent: Math.max(0, Math.min(1, ((orderBook.depth?.depthChange || 0) + 0.5) / 1.0))
    } : {};
    
    const total = detection.metrics.totalEnergy;
    let classification = 'MEDIUM';
    if (total > 0.8) classification = 'HIGH';
    else if (total > 0.6) classification = 'MEDIUM-HIGH';
    else if (total > 0.4) classification = 'MEDIUM';
    else if (total > 0.2) classification = 'MEDIUM-LOW';
    else classification = 'LOW';
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      energy: {
        sustained: {
          score: detection.metrics.sustainedEnergy,
          components: sustainedComponents
        },
        injected: {
          score: detection.metrics.injectedEnergy,
          volume5min: liquidations?.recent5min?.totalVolume || 0,
          cascadeDetected: liquidations?.cascade?.detected || false,
          dominantSide: liquidations?.recent5min?.dominantSide || 'NEUTRAL'
        },
        total,
        classification
      }
    });
    
  } catch (error) {
    console.error('[API] Error in /api/escape/energy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/escape/conditions
 * Returns condition checks for each hypothesis
 */
app.get('/api/escape/conditions', (req, res) => {
  try {
    if (!dataCollector.escapeDetector) {
      return res.status(503).json({
        success: false,
        error: 'EscapeTypeDetector not initialized'
      });
    }
    
    const detection = dataCollector.escapeDetector.getCurrentDetection();
    
    if (!detection || !detection.conditions) {
      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        conditions: {}
      });
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      conditions: detection.conditions,
      currentType: detection.type,
      currentConfidence: detection.confidence
    });
    
  } catch (error) {
    console.error('[API] Error in /api/escape/conditions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/escape/history
 * Returns detection history
 */
app.get('/api/escape/history', (req, res) => {
  try {
    if (!dataCollector.escapeDetector) {
      return res.status(503).json({
        success: false,
        error: 'EscapeTypeDetector not initialized'
      });
    }
    
    const minutes = Math.min(3600, Math.max(1, parseInt(req.query.minutes) || 60));
    const history = dataCollector.escapeDetector.getHistory(minutes);
    const stats = dataCollector.escapeDetector.getStats();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      minutes,
      history,
      stats
    });
    
  } catch (error) {
    console.error('[API] Error in /api/escape/history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/escape/summary
 * Returns complete summary
 */
app.get('/api/escape/summary', (req, res) => {
  try {
    if (!dataCollector.escapeDetector) {
      return res.status(503).json({
        success: false,
        error: 'EscapeTypeDetector not initialized'
      });
    }
    
    const detection = dataCollector.escapeDetector.getCurrentDetection();
    const history = dataCollector.escapeDetector.getHistory(10);
    const stats = dataCollector.escapeDetector.getStats();
    const alerts = dataCollector.escapeDetector.getAlerts();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        currentDetection: detection,
        recentHistory: history,
        stats,
        alerts
      }
    });
    
  } catch (error) {
    console.error('[API] Error in /api/escape/summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/escape/alerts
 * Returns active alerts
 */
app.get('/api/escape/alerts', (req, res) => {
  try {
    if (!dataCollector.escapeDetector) {
      return res.status(503).json({
        success: false,
        error: 'EscapeTypeDetector not initialized'
      });
    }
    
    const alerts = dataCollector.escapeDetector.getAlerts();
    
    const summary = {
      totalAlerts: alerts.length,
      criticalCount: alerts.filter(a => a.severity === 'CRITICAL').length,
      highCount: alerts.filter(a => a.severity === 'HIGH').length,
      mediumCount: alerts.filter(a => a.severity === 'MEDIUM').length,
      lowCount: alerts.filter(a => a.severity === 'LOW').length
    };
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      alerts,
      summary
    });
    
  } catch (error) {
    console.error('[API] Error in /api/escape/alerts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

## 🧪 Step 7: Test with Postman

Create a new Postman collection for Escape endpoints and test each one:

### Test 1: Current Detection
```
GET http://localhost:3000/api/escape/detect

Expected Response:
{
  "success": true,
  "timestamp": "2025-12-30T...",
  "detection": {
    "type": "H1" | "H2" | "H3" | "NONE",
    "confidence": 0.82,
    "direction": "UP" | "DOWN" | "NEUTRAL",
    "interpretation": "...",
    "metrics": { ... }
  }
}
```

### Test 2: Escape Probability
```
GET http://localhost:3000/api/escape/probability

Expected Response:
{
  "success": true,
  "probability": {
    "P_escape": 0.85,
    "classification": "HIGH" | "MEDIUM" | "LOW",
    "components": { ... }
  }
}
```

### Test 3: Energy Breakdown
```
GET http://localhost:3000/api/escape/energy

Expected Response:
{
  "success": true,
  "energy": {
    "sustained": { score: 0.68, components: {...} },
    "injected": { score: 0.55, ... },
    "total": 0.615,
    "classification": "MEDIUM-HIGH"
  }
}
```

### Test 4: Conditions
```
GET http://localhost:3000/api/escape/conditions

Expected Response:
{
  "success": true,
  "conditions": { ... },
  "currentType": "H1",
  "currentConfidence": 0.82
}
```

### Test 5: History
```
GET http://localhost:3000/api/escape/history?minutes=60

Expected Response:
{
  "success": true,
  "history": [ ... ],
  "stats": { ... }
}
```

### Test 6: Summary
```
GET http://localhost:3000/api/escape/summary

Expected Response:
{
  "success": true,
  "summary": {
    "currentDetection": { ... },
    "recentHistory": [ ... ],
    "stats": { ... },
    "alerts": [ ... ]
  }
}
```

### Test 7: Alerts
```
GET http://localhost:3000/api/escape/alerts

Expected Response:
{
  "success": true,
  "alerts": [ ... ],
  "summary": { ... }
}
```

---

## ✅ Verification Checklist

After integration, verify:

- [ ] EscapeTypeDetector.js copied to backend/src/
- [ ] Import added to DataCollector.js
- [ ] Property added to constructor
- [ ] Initialization in start() method
- [ ] Cleanup in stop() method
- [ ] Getter methods added
- [ ] 7 endpoints added to server.js
- [ ] Server starts without errors
- [ ] Console shows detection logs
- [ ] All 7 endpoints return valid JSON
- [ ] Postman tests pass
- [ ] Detection type changes based on market conditions
- [ ] Alerts are generated when appropriate

---

## 🐛 Troubleshooting

### Issue: "EscapeTypeDetector not initialized"

**Cause:** Detector not created or start() not called

**Solution:**
```javascript
// Verify in DataCollector.start():
this.escapeDetector = new EscapeTypeDetector(this);
```

### Issue: "Cannot read properties of null"

**Cause:** Missing getter methods or data not available

**Solution:**
```javascript
// Add null checks in getters:
getOrderBookMetrics() {
  if (!this.orderBookAnalyzer) return null;
  return this.orderBookAnalyzer.getMetrics();
}
```

### Issue: Detection always returns "NONE"

**Cause:** Data sources not providing data

**Solution:**
1. Verify OrderBookAnalyzer is connected
2. Verify LiquidationTracker is connected
3. Verify GEXCalculator has data
4. Check console logs for errors

### Issue: No console logs from detector

**Cause:** Event listeners not set up

**Solution:**
```javascript
// Add in start() method:
this.escapeDetector.on('detection', (d) => {
  console.log(`Detection: ${d.type}`);
});
```

---

## 📊 Expected Console Output

When running correctly, you should see:

```
[DataCollector] Starting...
[DataCollector] Initializing EscapeTypeDetector...
[DataCollector] EscapeTypeDetector initialized
[EscapeDetector] NONE detected (confidence: 0%)
[EscapeDetector] NONE detected (confidence: 0%)
[EscapeDetector] H1 detected (confidence: 65%)
[EscapeDetector] H1 detected (confidence: 72%)
🚀 [EscapeDetector] H1 (Good Escape) detected!
   Strong sustained down pressure (BI persistence: 78%)...
[EscapeDetector] H1 detected (confidence: 82%)
🔔 [EscapeDetector] Alert: Good Escape detected with 82% confidence
```

---

## 🎯 Next Steps

After successful integration:

1. **Collect Data**: Let system run for a few hours to collect detection history
2. **Validate**: Compare detections with actual price movements
3. **Tune Thresholds**: Adjust thresholds in EscapeTypeDetector based on results
4. **Frontend**: Create visualization components for detections
5. **Alerts**: Implement push notifications for H1/H2/H3 detections
6. **Backtesting**: Analyze historical accuracy

---

## 🎊 Success!

If all tests pass, congratulations! 🎉

The **Half Pipe Model** is now **95% complete**!

Remaining:
- Frontend visualization (optional)
- HalfPipeAnalyzer wrapper (optional)
- Historical validation
- Threshold optimization

**The core detection system is fully operational!** ⚔️🔥
