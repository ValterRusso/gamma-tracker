# Multi-Bot Refactoring Plan

## Current Architecture (Singleton)

### Components:
1. **bot.routes.js**: Singleton `botServiceInstance`
2. **TradingBotService**: Single instance with state
3. **Database Models**: No botId field

### Limitations:
- Only 1 bot can run at a time
- Cannot test multiple strategies simultaneously
- Cannot run different DTE profiles in parallel

---

## Target Architecture (Multiple Instances)

### Goals:
1. Support multiple concurrent bot instances
2. Each bot runs independently with own config
3. Isolated state and loops per bot
4. Individual start/stop control
5. Consolidated monitoring and reporting

---

## Implementation Plan

### Phase 1: Database Schema Changes

#### Add `bot_id` to tables:
- `bot_trades` → Add `bot_id` VARCHAR(50)
- `bot_signals` → Add `bot_id` VARCHAR(50)
- `bot_performance` → Add `bot_id` VARCHAR(50)

#### Migration strategy:
- Add columns with `allowNull: true`
- Backfill existing records with `bot_id = 'legacy'`
- Later: make `allowNull: false`

---

### Phase 2: TradingBotService Refactoring

#### Add unique bot ID:
```javascript
class TradingBotService {
  constructor(botId, database, optionsService) {
    this.botId = botId;  // ← NEW!
    this.db = database;
    this.optionsService = optionsService;
    // ... rest
  }
}
```

#### Pass botId to engines:
- SignalEngine saves signals with botId
- ExecutionEngine saves trades with botId
- PositionMonitor filters by botId

---

### Phase 3: Bot Manager (New Component)

Create `BotManager.js` to manage multiple instances:

```javascript
class BotManager {
  constructor(database, optionsService) {
    this.bots = new Map();  // botId → TradingBotService
    this.db = database;
    this.optionsService = optionsService;
  }
  
  async startBot(configId) {
    const botId = generateBotId(configId);
    const bot = new TradingBotService(botId, this.db, this.optionsService);
    await bot.start(configId);
    this.bots.set(botId, bot);
    return { botId, bot };
  }
  
  async stopBot(botId) {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error('Bot not found');
    await bot.stop();
    this.bots.delete(botId);
  }
  
  async stopAll() {
    for (const [botId, bot] of this.bots) {
      await bot.stop();
    }
    this.bots.clear();
  }
  
  getBot(botId) {
    return this.bots.get(botId);
  }
  
  getAllBots() {
    return Array.from(this.bots.values());
  }
  
  getStatus() {
    return Array.from(this.bots.entries()).map(([botId, bot]) => ({
      botId,
      isRunning: bot.isRunning,
      config: bot.config,
      uptime: bot.getUptime()
    }));
  }
}
```

---

### Phase 4: API Routes Updates

#### New endpoints:
```javascript
POST /api/bot/start
  Body: { configId }
  Response: { success, botId, config }

POST /api/bot/stop/:botId
  Response: { success, message }

POST /api/bot/stop-all
  Response: { success, stoppedCount }

GET /api/bot/status
  Response: { success, bots: [...] }  // All bots

GET /api/bot/status/:botId
  Response: { success, bot: {...} }  // Single bot

GET /api/bot/trades?botId=xxx
  Filter trades by botId

GET /api/bot/signals?botId=xxx
  Filter signals by botId

GET /api/bot/performance?botId=xxx
  Calculate metrics per bot
```

---

### Phase 5: Bot ID Generation

#### Strategy:
```javascript
function generateBotId(configId) {
  // Format: {strategy}_{timestamp}_{random}
  // Example: iron_condor_1705267200_a3f9
  const config = await loadConfig(configId);
  const timestamp = Math.floor(Date.now() / 1000);
  const random = Math.random().toString(36).substr(2, 4);
  return `${config.strategy}_${timestamp}_${random}`;
}
```

#### Benefits:
- Human-readable
- Sortable by time
- Unique
- Shows strategy at a glance

---

## Migration Strategy

### Step 1: Add botId to models (backward compatible)
- Add columns with `allowNull: true`
- Existing code continues to work

### Step 2: Create BotManager
- New component, doesn't break existing

### Step 3: Update routes to use BotManager
- Replace singleton with BotManager
- Keep backward compatibility where possible

### Step 4: Update engines to use botId
- SignalEngine, ExecutionEngine, PositionMonitor
- Save botId in all database operations

### Step 5: Test with multiple bots
- Start 3 bots with different configs
- Verify isolation
- Check database records

### Step 6: Make botId required
- After testing, make `allowNull: false`
- Remove legacy fallbacks

---

## Testing Plan

### Test Cases:
1. ✅ Start single bot (backward compat)
2. ✅ Start 3 bots simultaneously
3. ✅ Stop 1 bot while others run
4. ✅ Stop all bots
5. ✅ Restart stopped bot
6. ✅ Verify trade isolation (each bot's trades separate)
7. ✅ Verify signal isolation
8. ✅ Verify performance metrics per bot
9. ✅ Check for resource leaks (memory, intervals)
10. ✅ Stress test: 10+ bots

---

## Rollback Plan

If issues arise:
1. Stop all bots via API
2. Revert to previous commit
3. Existing data preserved (botId nullable)
4. Can re-run migration later

---

## Timeline

- Phase 1 (Database): 30 min
- Phase 2 (TradingBotService): 30 min
- Phase 3 (BotManager): 45 min
- Phase 4 (API Routes): 45 min
- Phase 5 (Testing): 30 min

**Total: ~3 hours**

---

## Benefits

### Immediate:
- Test multiple strategies in parallel
- Faster data collection
- Real-world portfolio simulation

### Long-term:
- Scalable architecture
- Production-ready
- Easy to add features (pause, restart, etc.)
- Better monitoring and analytics

---

## Next Steps

1. Get approval from Valter ✅
2. Start with Phase 1 (Database)
3. Implement incrementally
4. Test after each phase
5. Commit when stable
