# Multi-Bot System Testing Guide

## 🎯 Overview

This guide will help you test the new multi-bot architecture. The system now supports running multiple trading bots simultaneously, each with independent configurations and data isolation.

---

## 📋 Pre-Testing Checklist

### 1. **Pull Latest Changes**
```bash
cd ~/gamma-tracker
git pull origin main
```

### 2. **Install Dependencies** (if needed)
```bash
cd backend
npm install
```

### 3. **Database Migration** (IMPORTANT!)
The database models have been updated with `botId` field. You need to:

**Option A: Drop and recreate tables** (if no important data)
```bash
# In MySQL
DROP TABLE bot_trades;
DROP TABLE bot_signals;
DROP TABLE bot_performances;

# Restart backend - tables will be recreated with new schema
npm start
```

**Option B: Add botId column manually** (if preserving data)
```sql
ALTER TABLE bot_trades ADD COLUMN bot_id VARCHAR(100);
ALTER TABLE bot_trades ADD INDEX idx_bot_id (bot_id);

ALTER TABLE bot_signals ADD COLUMN bot_id VARCHAR(100);
ALTER TABLE bot_signals ADD INDEX idx_bot_id (bot_id);

ALTER TABLE bot_performances ADD COLUMN bot_id VARCHAR(100);
ALTER TABLE bot_performances ADD INDEX idx_bot_id (bot_id);
```

### 4. **Start Backend**
```bash
cd ~/gamma-tracker/backend
npm start
```

---

## 🧪 Test Scenarios

### **Test 1: Start Multiple Bots**

#### 1.1 Create 3 Different Configurations

**Config 1: Aggressive Iron Condor**
```bash
curl -X POST http://localhost:3000/api/bot/configs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Aggressive Iron Condor",
    "strategy": "iron_condor",
    "symbol": "BTC-USDT",
    "entryRules": {
      "minGEX": 1000000,
      "maxGEX": 5000000,
      "deltaThreshold": 0.3
    },
    "exitRules": {
      "profitTarget": 0.5,
      "stopLoss": 0.8,
      "timeBasedExit": 24
    },
    "riskParams": {
      "maxPositionSize": 10,
      "maxDailyLoss": 1000
    }
  }'
```

**Config 2: Conservative Iron Butterfly**
```bash
curl -X POST http://localhost:3000/api/bot/configs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Conservative Iron Butterfly",
    "strategy": "iron_butterfly",
    "symbol": "BTC-USDT",
    "entryRules": {
      "minGEX": 2000000,
      "maxGEX": 8000000,
      "deltaThreshold": 0.2
    },
    "exitRules": {
      "profitTarget": 0.3,
      "stopLoss": 0.5,
      "timeBasedExit": 48
    },
    "riskParams": {
      "maxPositionSize": 5,
      "maxDailyLoss": 500
    }
  }'
```

**Config 3: Day Trade Iron Condor**
```bash
curl -X POST http://localhost:3000/api/bot/configs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Day Trade Iron Condor",
    "strategy": "iron_condor",
    "symbol": "BTC-USDT",
    "entryRules": {
      "minGEX": 500000,
      "maxGEX": 3000000,
      "deltaThreshold": 0.4
    },
    "exitRules": {
      "profitTarget": 0.2,
      "stopLoss": 0.3,
      "timeBasedExit": 4
    },
    "riskParams": {
      "maxPositionSize": 20,
      "maxDailyLoss": 2000
    }
  }'
```

#### 1.2 Get Config IDs
```bash
curl http://localhost:3000/api/bot/configs
```

Copy the `id` values from the response (e.g., `1`, `2`, `3`).

#### 1.3 Start All 3 Bots
```bash
# Start Bot 1
curl -X POST http://localhost:3000/api/bot/start \
  -H "Content-Type: application/json" \
  -d '{"configId": "1"}'

# Start Bot 2
curl -X POST http://localhost:3000/api/bot/start \
  -H "Content-Type: application/json" \
  -d '{"configId": "2"}'

# Start Bot 3
curl -X POST http://localhost:3000/api/bot/start \
  -H "Content-Type: application/json" \
  -d '{"configId": "3"}'
```

**Expected Response (each):**
```json
{
  "success": true,
  "botId": "iron_condor_1705267200_a3f9",
  "message": "Bot started successfully",
  "config": { ... }
}
```

**✅ SAVE THE botId VALUES!!!**

---

### **Test 2: Verify All Bots Running**

```bash
curl http://localhost:3000/api/bot/status
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "bots": [
      {
        "botId": "iron_condor_1705267200_a3f9",
        "isRunning": true,
        "config": { "name": "Aggressive Iron Condor", ... },
        "uptime": "2m 30s"
      },
      {
        "botId": "iron_butterfly_1705267260_b4k2",
        "isRunning": true,
        "config": { "name": "Conservative Iron Butterfly", ... },
        "uptime": "2m 15s"
      },
      {
        "botId": "iron_condor_1705267320_c5m8",
        "isRunning": true,
        "config": { "name": "Day Trade Iron Condor", ... },
        "uptime": "2m 00s"
      }
    ],
    "totalRunning": 3,
    "hasRunningBots": true
  }
}
```

**✅ Check:**
- All 3 bots show `isRunning: true`
- Each has unique `botId`
- `totalRunning` equals 3

---

### **Test 3: Check Individual Bot Status**

```bash
# Replace with actual botId
curl http://localhost:3000/api/bot/status/iron_condor_1705267200_a3f9
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "botId": "iron_condor_1705267200_a3f9",
    "isRunning": true,
    "config": {
      "name": "Aggressive Iron Condor",
      "strategy": "iron_condor",
      ...
    },
    "uptime": "5m 42s"
  }
}
```

---

### **Test 4: Monitor Backend Logs**

Watch the backend console for logs from all 3 bots:

**Expected Log Pattern:**
```
[TradingBot:iron_condor_1705267200_a3f9] Starting main loop...
[SignalEngine:iron_condor_1705267200_a3f9] Analyzing market...
[TradingBot:iron_butterfly_1705267260_b4k2] Starting main loop...
[SignalEngine:iron_butterfly_1705267260_b4k2] Analyzing market...
[TradingBot:iron_condor_1705267320_c5m8] Starting main loop...
[SignalEngine:iron_condor_1705267320_c5m8] Analyzing market...
```

**✅ Check:**
- Logs show all 3 botIds
- Each bot logs independently every 60s
- No interference between bots

---

### **Test 5: Wait for Trades (5-10 minutes)**

Let the bots run for 5-10 minutes to generate some trades.

---

### **Test 6: Verify Data Isolation**

#### 6.1 Get All Trades
```bash
curl http://localhost:3000/api/bot/trades
```

**✅ Check:**
- Trades from all 3 bots are present
- Each trade has a `botId` field

#### 6.2 Get Trades for Specific Bot
```bash
# Replace with actual botId
curl "http://localhost:3000/api/bot/trades?botId=iron_condor_1705267200_a3f9"
```

**✅ Check:**
- Only trades from that specific bot are returned
- No trades from other bots

#### 6.3 Repeat for Signals
```bash
# All signals
curl http://localhost:3000/api/bot/signals

# Specific bot
curl "http://localhost:3000/api/bot/signals?botId=iron_condor_1705267200_a3f9"
```

#### 6.4 Check Performance Metrics
```bash
# All bots combined
curl http://localhost:3000/api/bot/performance

# Specific bot
curl "http://localhost:3000/api/bot/performance?botId=iron_condor_1705267200_a3f9"
```

**✅ Check:**
- Performance metrics are correctly calculated per bot
- No cross-contamination of data

---

### **Test 7: Stop Individual Bot**

```bash
# Stop Bot 1 (replace with actual botId)
curl -X POST http://localhost:3000/api/bot/stop/iron_condor_1705267200_a3f9
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Bot stopped successfully",
  "botId": "iron_condor_1705267200_a3f9"
}
```

#### Verify Status
```bash
curl http://localhost:3000/api/bot/status
```

**✅ Check:**
- Bot 1 shows `isRunning: false`
- Bots 2 and 3 still show `isRunning: true`
- `totalRunning` equals 2

---

### **Test 8: Stop All Bots**

```bash
curl -X POST http://localhost:3000/api/bot/stop-all
```

**Expected Response:**
```json
{
  "success": true,
  "stoppedCount": 2,
  "message": "All bots stopped successfully"
}
```

#### Verify Status
```bash
curl http://localhost:3000/api/bot/status
```

**✅ Check:**
- All bots show `isRunning: false`
- `totalRunning` equals 0
- `hasRunningBots` equals false

---

## 🐛 Troubleshooting

### **Issue: "Bot already running with this config"**
**Solution:** Each config can only have one active bot. Stop the existing bot first or create a new config.

### **Issue: "Config not found"**
**Solution:** Check that the configId exists:
```bash
curl http://localhost:3000/api/bot/configs
```

### **Issue: "Cannot read property 'botId' of undefined"**
**Solution:** Database migration not applied. Follow Pre-Testing Checklist step 3.

### **Issue: Bots not generating trades**
**Solution:** 
- Check backend logs for errors
- Verify OptionsService is returning data
- Adjust entry rules to be less restrictive

### **Issue: "Bot not found" when stopping**
**Solution:** Bot may have crashed. Check backend logs for errors. Restart backend if needed.

---

## ✅ Success Criteria

The multi-bot system is working correctly if:

1. ✅ **3 bots start successfully** with unique botIds
2. ✅ **All bots show in status** endpoint
3. ✅ **Logs show all 3 bots** running independently
4. ✅ **Trades are isolated** by botId
5. ✅ **Signals are isolated** by botId
6. ✅ **Performance metrics** calculate correctly per bot
7. ✅ **Individual stop** works without affecting other bots
8. ✅ **Stop all** stops all bots
9. ✅ **No race conditions** or interference between bots
10. ✅ **No crashes** after 10+ minutes of operation

---

## 📊 Database Verification

After testing, verify data in MySQL:

```sql
-- Check trades by bot
SELECT bot_id, COUNT(*) as trade_count, status 
FROM bot_trades 
GROUP BY bot_id, status;

-- Check signals by bot
SELECT bot_id, COUNT(*) as signal_count, signal_type 
FROM bot_signals 
GROUP BY bot_id, signal_type;

-- Verify indexes exist
SHOW INDEXES FROM bot_trades WHERE Key_name = 'idx_bot_id';
SHOW INDEXES FROM bot_signals WHERE Key_name = 'idx_bot_id';
SHOW INDEXES FROM bot_performances WHERE Key_name = 'idx_bot_id';
```

---

## 🎯 Next Steps After Testing

If all tests pass:

1. ✅ **Celebrate!!!** 🎉 Multi-bot system is working!
2. 📝 **Document any issues** found during testing
3. 🔧 **Fine-tune configurations** based on test results
4. 🚀 **Plan next features:**
   - Bull Put Spread strategy
   - Bear Call Spread strategy
   - Advanced risk management
   - Performance dashboard

---

## 📞 Reporting Issues

If you encounter issues:

1. **Check backend logs** for error messages
2. **Note the botId** where the issue occurred
3. **Provide the API request** that caused the issue
4. **Include the error response** if any
5. **Share relevant database state** (trade counts, signal counts)

---

**Good luck with testing! 🚀**
