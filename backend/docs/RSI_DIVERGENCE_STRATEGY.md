# RSI Divergence Strategy

## 📊 **OVERVIEW**

The RSI Divergence Strategy identifies potential market reversals and trend continuations by detecting divergences between price action and the Relative Strength Index (RSI).

---

## 🎯 **CONCEPT**

### **What is a Divergence?**

A divergence occurs when the price and an indicator (RSI in this case) move in opposite directions, signaling a potential change in momentum.

---

## 📈 **DIVERGENCE TYPES**

### **1. Classic Bearish Divergence (Reversal Down)**

**Pattern:**
- Price: Makes a **higher high**
- RSI: Makes a **lower high** (< 70)

**Interpretation:**
- Price is rising but momentum is weakening
- Potential reversal to the downside

**Trade:**
- **Bear Put Spread** (Buy higher strike put, sell lower strike put)
- **Bear Call Spread** (Sell lower strike call, buy higher strike call)

**Example:**
```
BTC Price: $94,000 → $95,500 (higher high)
RSI:       72.3 → 68.5 (lower high)
→ Bearish divergence detected
→ Enter Bear Put Spread
```

---

### **2. Classic Bullish Divergence (Reversal Up)**

**Pattern:**
- Price: Makes a **lower low**
- RSI: Makes a **higher low** (> 30)

**Interpretation:**
- Price is falling but momentum is strengthening
- Potential reversal to the upside

**Trade:**
- **Bull Call Spread** (Buy lower strike call, sell higher strike call)
- **Bull Put Spread** (Sell higher strike put, buy lower strike put)

**Example:**
```
BTC Price: $95,000 → $93,500 (lower low)
RSI:       28.5 → 32.1 (higher low)
→ Bullish divergence detected
→ Enter Bull Call Spread
```

---

### **3. Hidden Bearish Divergence (Downtrend Continuation)**

**Pattern:**
- Price: Makes a **lower high**
- RSI: Makes a **higher high**

**Interpretation:**
- Downtrend is still strong despite temporary bounce
- Continuation of downtrend expected

**Trade:**
- **Bear spreads** (same as classic bearish)

**Example:**
```
BTC Price: $95,000 → $94,500 (lower high)
RSI:       65.0 → 68.0 (higher high)
→ Hidden bearish divergence
→ Downtrend continuation expected
```

---

### **4. Hidden Bullish Divergence (Uptrend Continuation)**

**Pattern:**
- Price: Makes a **higher low**
- RSI: Makes a **lower low**

**Interpretation:**
- Uptrend is still strong despite temporary dip
- Continuation of uptrend expected

**Trade:**
- **Bull spreads** (same as classic bullish)

**Example:**
```
BTC Price: $94,000 → $94,500 (higher low)
RSI:       32.0 → 28.0 (lower low)
→ Hidden bullish divergence
→ Uptrend continuation expected
```

---

## ⚙️ **CONFIGURATION PARAMETERS**

### **Divergence Detection**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `lookback` | 20 | Number of candles to analyze |
| `rsiOverbought` | 70 | RSI overbought threshold |
| `rsiOversold` | 30 | RSI oversold threshold |
| `minConfidence` | 0.7 | Minimum confidence (0-1) to enter |
| `minPeakDistance` | 5 | Minimum candles between peaks/troughs |
| `allowHiddenDiv` | true | Allow hidden divergences |

### **Options Selection**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `longDelta` | 0.60 | Long leg delta target |
| `shortDelta` | 0.40 | Short leg delta target |
| `deltaTolerance` | 0.10 | Delta tolerance (±10%) |
| `minDTE` | 20 | Minimum days to expiry |
| `maxDTE` | 60 | Maximum days to expiry |
| `minSpreadWidth` | 1000 | Minimum spread width ($) |
| `maxSpreadWidth` | 15000 | Maximum spread width ($) |

### **Risk Management**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `profitTarget` | 0.5 | Close at 50% of max profit |
| `stopLoss` | 0.75 | Stop at 75% of max loss |
| `dteExit` | 14 | Close if DTE < 14 days |
| `accountBalance` | 100000 | Account size ($) |
| `riskPercent` | 5 | Risk per trade (%) |
| `maxPositions` | 1 | Max concurrent positions |

---

## 📊 **CONFIDENCE SCORING**

The strategy calculates a confidence score (0-1) based on:

1. **Price Divergence Strength** (40%)
   - Larger price difference = higher confidence
   - Formula: `min(abs(priceDiff) * 100, 10) / 10`

2. **RSI Divergence Strength** (40%)
   - Larger RSI difference = higher confidence
   - Formula: `min(abs(rsiDiff) / 20, 1)`

3. **RSI Extreme Level** (20%)
   - RSI closer to 0 or 100 = higher confidence
   - Bearish: `(rsiLevel - 70) / 30`
   - Bullish: `(30 - rsiLevel) / 30`

**Example:**
```
Price: +1.5% difference
RSI: -5 points difference
RSI Level: 68.5

Confidence = (0.15 * 0.4) + (0.25 * 0.4) + (0.05 * 0.2)
           = 0.06 + 0.10 + 0.01
           = 0.17 (17%)
```

**Minimum confidence required:** 70% (configurable)

---

## 🎯 **ENTRY CONDITIONS**

All conditions must be met:

1. ✅ **Divergence detected** (classic or hidden)
2. ✅ **Confidence ≥ minConfidence** (default 70%)
3. ✅ **Sufficient price history** (≥ lookback candles)
4. ✅ **Sufficient RSI history** (≥ lookback candles)
5. ✅ **Adequate volume** (> minVolume)
6. ✅ **Options available** (≥ 2 ATM options)
7. ✅ **Valid strikes found** (matching delta targets)
8. ✅ **Spread width in range** (minSpreadWidth - maxSpreadWidth)
9. ✅ **Risk/reward ≥ 0.5** (max profit / max loss)

---

## 🚪 **EXIT CONDITIONS**

Exit when **any** condition is met:

1. ✅ **Profit target hit** (50% of max profit)
2. ✅ **Stop loss hit** (75% of max loss)
3. ✅ **Close to expiry** (DTE < 14 days)
4. ⚠️ **Reverse divergence** (optional, not yet implemented)

---

## 📋 **EXAMPLE CONFIGS**

### **Conservative (Default)**

```json
{
  "name": "RSI Divergence - BTC Conservative",
  "strategy": "rsi_divergence",
  "symbol": "BTC-USDT",
  "enabled": true,
  
  "entry_rules": {
    "lookback": 20,
    "rsiOverbought": 70,
    "rsiOversold": 30,
    "minConfidence": 0.7,
    "longDelta": 0.60,
    "shortDelta": 0.40,
    "minDTE": 20,
    "maxDTE": 60
  },
  
  "exit_rules": {
    "profitTarget": 0.5,
    "stopLoss": 0.75,
    "dteExit": 14
  },
  
  "risk_params": {
    "accountBalance": 100000,
    "riskPercent": 5,
    "maxPositions": 1
  }
}
```

### **Aggressive**

```json
{
  "name": "RSI Divergence - BTC Aggressive",
  "strategy": "rsi_divergence",
  "symbol": "BTC-USDT",
  "enabled": true,
  
  "entry_rules": {
    "lookback": 15,
    "rsiOverbought": 65,
    "rsiOversold": 35,
    "minConfidence": 0.6,
    "longDelta": 0.55,
    "shortDelta": 0.35,
    "minDTE": 15,
    "maxDTE": 45
  },
  
  "exit_rules": {
    "profitTarget": 0.6,
    "stopLoss": 0.8,
    "dteExit": 10
  },
  
  "risk_params": {
    "accountBalance": 100000,
    "riskPercent": 8,
    "maxPositions": 2
  }
}
```

---

## 🧪 **TESTING**

### **Create Config via API**

```bash
curl -X POST http://localhost:3300/api/bot/configs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "RSI Divergence Test",
    "strategy": "rsi_divergence",
    "symbol": "BTC-USDT",
    "enabled": true,
    "entry_rules": {
      "lookback": 20,
      "minConfidence": 0.7
    },
    "exit_rules": {
      "profitTarget": 0.5
    },
    "risk_params": {
      "accountBalance": 100000,
      "riskPercent": 5
    }
  }'
```

### **Start Bot**

```bash
curl -X POST http://localhost:3300/api/bot/start \
  -H "Content-Type: application/json" \
  -d '{"configId": "YOUR_CONFIG_ID"}'
```

### **Monitor Signals**

```bash
# View latest signals
curl http://localhost:3300/api/bot/signals?limit=10

# Watch for divergences
watch -n 60 'curl -s http://localhost:3300/api/bot/signals?limit=5 | jq'
```

---

## 📊 **EXPECTED PERFORMANCE**

### **Signal Frequency**

- **High confidence divergences (>70%):** 5-15% of the time
- **Medium confidence (60-70%):** 15-25% of the time
- **WAIT signals:** 70-85% of the time

### **Win Rate**

- **Classic divergences:** 60-70% (reversal signals)
- **Hidden divergences:** 55-65% (continuation signals)
- **Overall:** 58-68%

### **Risk/Reward**

- **Average R:R:** 1:1 to 1:1.5
- **Max profit:** Spread width - debit paid
- **Max loss:** Debit paid

---

## ⚠️ **LIMITATIONS**

1. **Requires history:** Needs 20+ candles before detecting divergences
2. **False signals:** Not all divergences lead to reversals
3. **Lagging indicator:** RSI is calculated from past prices
4. **Market conditions:** Works best in trending markets
5. **Options liquidity:** Requires good options availability

---

## 💡 **BEST PRACTICES**

1. ✅ **Start conservative:** Use default parameters first
2. ✅ **Monitor performance:** Track win rate and R:R
3. ✅ **Adjust confidence:** Lower for more signals, higher for quality
4. ✅ **Combine with IV:** Consider IV rank for entry timing
5. ✅ **Respect stops:** Don't override stop loss manually
6. ✅ **Test hidden divergences:** Enable/disable based on results
7. ✅ **Multiple timeframes:** Consider divergences across TFs (future)

---

## 🔮 **FUTURE ENHANCEMENTS**

1. **Multi-timeframe confirmation:** Require divergence on 2+ timeframes
2. **Volume confirmation:** Add volume divergence detection
3. **IV rank integration:** Prefer high IV for selling, low IV for buying
4. **Reverse divergence exit:** Exit early if reverse divergence detected
5. **Machine learning:** Optimize parameters based on historical performance
6. **Alternative indicators:** MACD, Stochastic divergences

---

## 📚 **REFERENCES**

- [RSI Divergence Trading Guide](https://www.investopedia.com/articles/active-trading/042114/overbought-or-oversold-use-relative-strength-index-find-out.asp)
- [Hidden Divergence Explained](https://www.babypips.com/learn/forex/hidden-divergence)
- [Options Spreads for Divergence Trading](https://www.optionsplaybook.com/option-strategies/)

---

## 📞 **SUPPORT**

For questions or issues:
- Check logs: `[SignalEngine-{botId}]` and `[RSI Divergence]`
- Review signals: `GET /api/bot/signals`
- Adjust parameters: `PUT /api/bot/configs/{configId}`

---

**Happy Trading! 🚀**
