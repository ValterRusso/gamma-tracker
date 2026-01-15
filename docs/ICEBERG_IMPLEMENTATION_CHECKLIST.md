# 🧊 IcebergDetector - Implementation Checklist

**Quick Start Guide for Integration**

---

## ✅ Phase 1: Installation (5 minutes)

### Step 1: Copy Files

```bash
# Navigate to your project
cd /path/to/gamma-tracker/backend/src

# Copy IcebergDetector
cp /path/to/IcebergDetector.js ./calculators/

# Verify
ls -l calculators/IcebergDetector.js
```

**Expected output:**
```
-rw-r--r-- 1 user user 25000 Jan 01 16:30 calculators/IcebergDetector.js
```

---

### Step 2: Test IcebergDetector Standalone

```bash
# Create test file
cat > test-iceberg.js << 'EOF'
const IcebergDetector = require('./calculators/IcebergDetector');

const detector = new IcebergDetector();

// Mock order book
const orderBook = {
  asks: [
    [88000, 2.0],
    [88050, 1.5],
    [88100, 2.0]
  ],
  bids: [
    [87950, 3.0],
    [87900, 2.5]
  ],
  depth: 45000000,
  spread_pct: 0.03,
  BI: 0.2
};

// Run detection 10 times (to build history)
for (let i = 0; i < 10; i++) {
  detector.detect(orderBook);
}

// Final detection
const result = detector.detect(orderBook);

console.log('✅ IcebergDetector Test:');
console.log('  Detected:', result.detected);
console.log('  Score:', result.score.toFixed(2));
console.log('  Confidence:', result.confidence);
console.log('  Signals:', Object.keys(result.signals).filter(k => result.signals[k].detected));
console.log('\n🎉 IcebergDetector is working!');
EOF

# Run test
node test-iceberg.js
```

**Expected output:**
```
✅ IcebergDetector Test:
  Detected: true
  Score: 0.30
  Confidence: MEDIUM
  Signals: [ 'refillingOrders' ]

🎉 IcebergDetector is working!
```

---

## ✅ Phase 2: Integration with EscapeTypeDetector (15 minutes)

### Step 1: Add Import

**File:** `calculators/EscapeTypeDetector.js`

**Location:** Top of file (after other requires)

```javascript
// Add this line
const IcebergDetector = require('./IcebergDetector');
```

---

### Step 2: Initialize in Constructor

**File:** `calculators/EscapeTypeDetector.js`

**Location:** Inside `constructor()`, after line ~50

```javascript
constructor(dataCollector, config = {}) {
  // ... existing code ...
  
  // ADD THIS:
  // Initialize IcebergDetector
  this.icebergDetector = new IcebergDetector({
    refillingMinOccurrences: 5,
    volumeAnomalyRatio: 2.0,
    rejectionMinCount: 3,
    regenMinDrop: 0.2,
    regenMinRecovery: 0.15,
    consistentSizeMinOccurrences: 5
  });
  
  // Iceberg detection state
  this.lastIcebergDetection = null;
  this.icebergHistory = [];
  
  // ... rest of constructor ...
}
```

---

### Step 3: Replace calculatePotential Method

**File:** `calculators/EscapeTypeDetector.js`

**Location:** Find `calculatePotential()` method (around line 248-301)

**Action:** Replace entire method with code from `EscapeTypeDetector_IcebergIntegration.js`

**Copy from:** Lines 30-200 in `EscapeTypeDetector_IcebergIntegration.js`

**Key changes:**
- New signature: `calculatePotential(gex, orderBook, currentPrice, recentTrades = null)`
- Returns object with `{ total, components, weights, regime, floor }`
- Includes iceberg detection
- Adaptive weights based on regime

---

### Step 4: Update detect() Method Call

**File:** `calculators/EscapeTypeDetector.js`

**Location:** Inside `detect()` method, around line 180-200

**Find:**
```javascript
const potential = this.calculatePotential(gex, currentPrice);
```

**Replace with:**
```javascript
const potential = this.calculatePotential(
  gex, 
  orderBook, 
  currentPrice, 
  data.recentTrades || null
);
```

---

### Step 5: Update Metrics Object

**File:** `calculators/EscapeTypeDetector.js`

**Location:** Inside `detect()` method, where metrics are assembled

**Find:**
```javascript
const metrics = {
  sustainedEnergy: sustainedEnergy,
  injectedEnergy: injectedEnergy,
  totalEnergy: totalEnergy,
  potential: potential,  // This is now a number
  P_escape: P_escape,
  direction: direction
};
```

**Replace with:**
```javascript
const metrics = {
  sustainedEnergy: sustainedEnergy,
  injectedEnergy: injectedEnergy,
  totalEnergy: totalEnergy,
  potential: potential,  // This is now an OBJECT
  P_escape: P_escape,
  direction: direction
};
```

**Important:** Update all references to `metrics.potential` to `metrics.potential.total`

**Find and replace:**
- `metrics.potential` → `metrics.potential.total` (in P_escape calculation)

---

### Step 6: Add Iceberg Logging

**File:** `calculators/EscapeTypeDetector.js`

**Location:** Inside `detect()` method, after calculating potential

**Add:**
```javascript
// Log iceberg detection
if (potential.components.iceberg?.detected) {
  const iceberg = potential.components.iceberg;
  console.log(`[IcebergDetector] 🧊 Iceberg detected!`);
  console.log(`  Confidence: ${iceberg.confidence}`);
  console.log(`  Score: ${(iceberg.score * 100).toFixed(0)}%`);
  console.log(`  Estimated hidden: ${iceberg.estimatedHiddenSize?.hidden?.toFixed(1)} BTC`);
  console.log(`  Active signals: ${Object.keys(iceberg.signals).filter(k => iceberg.signals[k].detected).join(', ')}`);
  console.log(`  Regime: ${potential.regime}`);
  console.log(`  Weights: GEX=${(potential.weights.gex*100).toFixed(0)}% Iceberg=${(potential.weights.iceberg*100).toFixed(0)}% Liquidity=${(potential.weights.liquidity*100).toFixed(0)}%`);
}
```

---

### Step 7: Add Helper Method

**File:** `calculators/EscapeTypeDetector.js`

**Location:** End of class (before `module.exports`)

**Add:**
```javascript
/**
 * Get iceberg detection statistics
 */
getIcebergStats() {
  return {
    detector: this.icebergDetector.getStats(),
    lastDetection: this.lastIcebergDetection,
    historySize: this.icebergHistory.length,
    recentDetections: this.icebergHistory.slice(-10)
  };
}
```

---

## ✅ Phase 3: Testing Integration (10 minutes)

### Step 1: Restart Backend

```bash
# Stop backend
pm2 stop gamma-backend

# Start backend
pm2 start gamma-backend

# Watch logs
pm2 logs gamma-backend --lines 100
```

---

### Step 2: Verify Logs

**Look for:**

```
[IcebergDetector] 🧊 Iceberg detected!
  Confidence: HIGH
  Score: 65%
  Estimated hidden: 110.5 BTC
  Active signals: refillingOrders, volumeAnomaly, priceRejection
  Regime: OPTIONS_INACTIVE
  Weights: GEX=10% Iceberg=60% Liquidity=30%
```

---

### Step 3: Test API Endpoint

```bash
# Test escape detection endpoint
curl http://localhost:3000/api/escape/detect | jq .

# Look for iceberg info in response
curl http://localhost:3000/api/escape/detect | jq '.metrics.potential.components.iceberg'
```

**Expected response:**
```json
{
  "value": 0.65,
  "detected": true,
  "confidence": "HIGH",
  "score": 0.65,
  "estimatedHiddenSize": {
    "visible": 20,
    "hidden": 110,
    "total": 130,
    "multiplier": 6.5
  },
  "signals": {
    "refillingOrders": { "detected": true, ... },
    "volumeAnomaly": { "detected": true, ... },
    ...
  }
}
```

---

## ✅ Phase 4: Verification (5 minutes)

### Checklist

- [ ] IcebergDetector.js copied to `calculators/`
- [ ] Import added to EscapeTypeDetector.js
- [ ] icebergDetector initialized in constructor
- [ ] calculatePotential() method replaced
- [ ] detect() method updated to pass orderBook and recentTrades
- [ ] metrics.potential references updated to metrics.potential.total
- [ ] Iceberg logging added
- [ ] getIcebergStats() method added
- [ ] Backend restarted successfully
- [ ] Logs show iceberg detections
- [ ] API returns iceberg data

---

## 🎯 Quick Verification Script

```bash
# Create verification script
cat > verify-iceberg.sh << 'EOF'
#!/bin/bash

echo "🔍 Verifying IcebergDetector Integration..."
echo ""

# Check file exists
if [ -f "calculators/IcebergDetector.js" ]; then
  echo "✅ IcebergDetector.js found"
else
  echo "❌ IcebergDetector.js NOT found"
  exit 1
fi

# Check import in EscapeTypeDetector
if grep -q "IcebergDetector" calculators/EscapeTypeDetector.js; then
  echo "✅ Import found in EscapeTypeDetector.js"
else
  echo "❌ Import NOT found in EscapeTypeDetector.js"
  exit 1
fi

# Check initialization
if grep -q "this.icebergDetector = new IcebergDetector" calculators/EscapeTypeDetector.js; then
  echo "✅ IcebergDetector initialized"
else
  echo "❌ IcebergDetector NOT initialized"
  exit 1
fi

# Check API response
if curl -s http://localhost:3000/api/escape/detect | grep -q "iceberg"; then
  echo "✅ API returns iceberg data"
else
  echo "⚠️  API may not be returning iceberg data (check if backend is running)"
fi

echo ""
echo "🎉 Verification complete!"
EOF

chmod +x verify-iceberg.sh
./verify-iceberg.sh
```

---

## 🔧 Troubleshooting

### Issue 1: "Cannot find module './IcebergDetector'"

**Solution:**
```bash
# Check file location
ls -l calculators/IcebergDetector.js

# If not found, copy again
cp /path/to/IcebergDetector.js calculators/
```

---

### Issue 2: "this.icebergDetector is not a function"

**Solution:**
- Check import: `const IcebergDetector = require('./IcebergDetector');`
- Check initialization: `this.icebergDetector = new IcebergDetector({...});`
- Restart backend: `pm2 restart gamma-backend`

---

### Issue 3: "metrics.potential.total is undefined"

**Solution:**
- Check that `calculatePotential()` returns object with `{ total, ... }`
- Update all `metrics.potential` to `metrics.potential.total` in P_escape calculation
- Search for: `metrics.potential` and replace with `metrics.potential.total` where used as number

---

### Issue 4: No iceberg detections in logs

**Solution:**
- Iceberg detection requires history (10+ snapshots)
- Wait 10-30 seconds after backend start
- Check if order book data is available
- Lower thresholds for testing (see aggressive config in guide)

---

## 📊 Expected Results

### Normal Regime (Options Active)

```
[EscapeTypeDetector] 🎯 Detection: H1 (Good Escape)
[EscapeTypeDetector]   Potential: 0.65
[EscapeTypeDetector]     GEX: 0.70 (weight: 60%)
[EscapeTypeDetector]     Iceberg: 0.40 (weight: 20%)
[EscapeTypeDetector]     Liquidity: 0.50 (weight: 20%)
[EscapeTypeDetector]   Regime: OPTIONS_ACTIVE
```

### Feriado Regime (Options Inactive)

```
[IcebergDetector] 🧊 Iceberg detected!
  Confidence: HIGH
  Score: 65%
  Estimated hidden: 110.5 BTC
  Active signals: refillingOrders, volumeAnomaly, priceRejection
  Regime: OPTIONS_INACTIVE
  Weights: GEX=10% Iceberg=60% Liquidity=30%

[EscapeTypeDetector] 🎯 Detection: H2 (False Escape)
[EscapeTypeDetector]   Potential: 0.55
[EscapeTypeDetector]     GEX: 0.10 (weight: 10%)
[EscapeTypeDetector]     Iceberg: 0.65 (weight: 60%)
[EscapeTypeDetector]     Liquidity: 0.50 (weight: 30%)
[EscapeTypeDetector]   Regime: OPTIONS_INACTIVE
```

---

## 🍺 Success Criteria

✅ **Integration Complete When:**

1. No errors on backend startup
2. Iceberg detections appear in logs
3. API returns iceberg data in `metrics.potential.components.iceberg`
4. Regime detection working (OPTIONS_ACTIVE vs OPTIONS_INACTIVE)
5. Adaptive weights applied (60/20/20 vs 10/60/30)
6. P_escape values realistic (not inflated to 1.0)

---

## 🎉 Completion

**When all checkboxes are checked:**

```
🎊 CONGRATULATIONS! 🎊

IcebergDetector is now integrated!

Next steps:
1. Monitor logs for 24 hours
2. Collect iceberg detection statistics
3. Calibrate thresholds if needed
4. Prepare for DOE optimization

SKÅL! 🍺⚔️
```

---

**Total Time:** ~35 minutes

**Difficulty:** Medium

**Impact:** HIGH (fixes Potential calculation in feriados!)
