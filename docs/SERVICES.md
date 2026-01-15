# Services Documentation

## Overview

**Services** form the **business logic layer** between API routes and data collectors/calculators. They provide a clean interface for accessing and manipulating market data, implementing validation, formatting, and aggregation logic.

## Architecture

### Layered Architecture

```
┌─────────────────────────────────────┐
│         API Routes                  │  ← Express routes
│         (REST endpoints)            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         Services Layer              │  ← Business logic
│      (Validation, Formatting)       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│       DataCollector                 │  ← Data orchestration
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Collectors & Calculators          │  ← Data processing
└─────────────────────────────────────┘
```

### Service Pattern

All services follow a consistent pattern:

```javascript
class ServiceName {
  constructor(dataCollector) {
    this.dataCollector = dataCollector;
  }
  
  async getData() {
    // 1. Get data from DataCollector
    const rawData = this.dataCollector.getSomeData();
    
    // 2. Validate
    if (!rawData) {
      throw new Error('Data not available');
    }
    
    // 3. Format/Transform
    const formattedData = this.formatData(rawData);
    
    // 4. Return
    return {
      data: formattedData,
      timestamp: Date.now()
    };
  }
}
```

**Key Characteristics:**
- ✅ **Stateless**: No internal state
- ✅ **Dependency Injection**: Receives DataCollector
- ✅ **Thin Layer**: Minimal logic, delegates to DataCollector
- ✅ **Consistent API**: All methods return structured responses

---

## Services Catalog

### Core Services (13)

| Service | Purpose | Key Methods |
|---------|---------|-------------|
| **OptionsService** | Options data access | `getAllOptions()`, `getOptionsByStrike()`, `getStrikes()`, `getExpiries()` |
| **MetricsService** | GEX and market metrics | `getGEXMetrics()`, `getRegimeAnalysis()`, `getMaxPain()` |
| **SentimentService** | Market sentiment analysis | `getSentiment()`, `getSentimentByExpiry()`, `detectShift()` |
| **VolatilityService** | IV and volatility metrics | `getIVMetrics()`, `getIVComparison()`, `getVolatilitySurface()` |
| **LiquidationService** | Liquidation tracking | `getRecentLiquidations()`, `getCascades()`, `getStats()` |
| **OrderbookService** | Order book analysis | `getOrderBookMetrics()`, `getImbalance()`, `getWalls()` |
| **EntropyService** | Shannon entropy calculation | `getEntropy()`, `getEntropyHistory()`, `getDivergences()` |
| **EscapeService** | Escape type detection | `getCurrentEscape()`, `getEscapeHistory()`, `getAlerts()` |
| **HistoryService** | Historical data access | `getPriceHistory()`, `getGEXHistory()`, `getMetricsHistory()` |
| **StrategyService** | Trading strategy recommendations | `getRecommendations()`, `analyzeSetup()`, `getSignals()` |
| **MarketanalysisService** | Comprehensive market analysis | `getMarketOverview()`, `getKeyLevels()`, `getRiskMetrics()` |
| **IvcomparisonService** | Binance vs Deribit IV comparison | `compareIV()`, `getRetailPanicIndex()`, `getArbitrageOpportunities()` |
| **TradingBotService** | Trading bot management | `getBotStatus()`, `getPositions()`, `getPerformance()` |

### Database Services (6)

| Service | Purpose | Key Methods |
|---------|---------|-------------|
| **DataPersistenceService** | Save snapshots to database | `saveGEXSnapshot()`, `saveEntropySnapshot()`, `saveMetricsSnapshot()` |
| **DataRetentionService** | Manage data lifecycle | `cleanOldData()`, `archiveData()`, `getRetentionStats()` |
| **GEXSnapshotService** | GEX snapshot management | `getLatestSnapshot()`, `getSnapshotsByTimeRange()`, `compareSnapshots()` |
| **DEXSnapshotService** | DEX snapshot management | `getLatestSnapshot()`, `getSnapshotsByTimeRange()` |
| **DVOLService** | DVOL (Deribit Volatility Index) | `getDVOL()`, `getDVOLHistory()` |
| **PositionCalculatorService** | Position sizing and risk | `calculatePositionSize()`, `calculateRisk()`, `getOptimalLeverage()` |

---

## Service Details

### OptionsService

**Purpose:** Provides access to options data with filtering and formatting.

**Methods:**

#### `getAllOptions()`

Get all options.

```javascript
const result = await optionsService.getAllOptions();
// {
//   options: [...],
//   count: 150
// }
```

#### `getOptionsByStrike(strike)`

Get options for a specific strike.

```javascript
const result = await optionsService.getOptionsByStrike(98000);
// {
//   options: [
//     { symbol: 'BTC-250115-98000-C', ... },
//     { symbol: 'BTC-250115-98000-P', ... }
//   ],
//   count: 2
// }
```

#### `getStrikes()`

Get all unique strikes.

```javascript
const result = await optionsService.getStrikes();
// {
//   strikes: [95000, 96000, 97000, ...],
//   count: 50
// }
```

#### `getExpiries()`

Get all unique expiry dates.

```javascript
const result = await optionsService.getExpiries();
// {
//   expiries: [1705334400000, 1706544000000, ...],
//   count: 5
// }
```

---

### MetricsService

**Purpose:** Aggregates GEX, regime, and max pain metrics.

**Methods:**

#### `getGEXMetrics()`

Get complete GEX metrics.

```javascript
const metrics = await metricsService.getGEXMetrics();
// {
//   totalGEX: { calls: 500M, puts: -300M, total: 200M },
//   gammaFlip: { level: 95000, confidence: 'HIGH' },
//   putWall: { strike: 93000, gex: -200M },
//   callWall: { strike: 100000, gex: 300M },
//   gammaProfile: [...],
//   timestamp: 1705334400000
// }
```

#### `getRegimeAnalysis()`

Get market regime analysis.

```javascript
const regime = await metricsService.getRegimeAnalysis();
// {
//   regime: 'POSITIVE_GAMMA_ABOVE_FLIP',
//   volatilityExpectation: 'LOW',
//   implications: [...],
//   distribution: {...},
//   timestamp: 1705334400000
// }
```

#### `getMaxPain()`

Get max pain analysis.

```javascript
const maxPain = await metricsService.getMaxPain();
// {
//   maxPainStrike: 97000,
//   maxPainOI: 3800,
//   analysis: {...},
//   topStrikes: [...],
//   timestamp: 1705334400000
// }
```

---

### SentimentService

**Purpose:** Analyzes market sentiment from options positioning.

**Methods:**

#### `getSentiment()`

Get current sentiment.

```javascript
const sentiment = await sentimentService.getSentiment();
// {
//   sentiment: 'BULLISH',
//   putCallOIRatio: 0.85,
//   putCallVolRatio: 0.92,
//   interpretation: '...',
//   timestamp: 1705334400000
// }
```

#### `getSentimentByExpiry()`

Get sentiment term structure.

```javascript
const termStructure = await sentimentService.getSentimentByExpiry();
// [
//   { dte: 7, sentiment: 'BULLISH', pcOIRatio: 0.80 },
//   { dte: 21, sentiment: 'NEUTRAL', pcOIRatio: 1.05 },
//   ...
// ]
```

#### `detectShift()`

Detect sentiment shifts.

```javascript
const shift = await sentimentService.detectShift();
// {
//   shift: 'BULLISH_SHIFT',
//   magnitude: 15.3,
//   interpretation: '...',
//   timestamp: 1705334400000
// }
```

---

### VolatilityService

**Purpose:** Provides IV metrics and comparisons.

**Methods:**

#### `getIVMetrics()`

Get IV metrics.

```javascript
const iv = await volatilityService.getIVMetrics();
// {
//   atmIV: 65,
//   otmPutIV: 75,
//   otmCallIV: 58,
//   skewRatio: 1.29,
//   timestamp: 1705334400000
// }
```

#### `getIVComparison(dte)`

Compare Binance vs Deribit IV.

```javascript
const comparison = await volatilityService.getIVComparison(1);
// {
//   binance: {...},
//   deribit: {...},
//   spreads: {...},
//   retailPanicIndex: 121,
//   alerts: [...],
//   insights: [...],
//   timestamp: 1705334400000
// }
```

---

### LiquidationService

**Purpose:** Tracks and analyzes liquidation events.

**Methods:**

#### `getRecentLiquidations(count)`

Get recent liquidations.

```javascript
const liq = await liquidationService.getRecentLiquidations(10);
// [
//   { symbol: 'BTCUSDT', side: 'SELL', price: 98000, quantity: 1.5, time: ... },
//   ...
// ]
```

#### `getCascades()`

Get liquidation cascades.

```javascript
const cascades = await liquidationService.getCascades();
// [
//   { timestamp: ..., count: 15, volume: 45.2, duration: 5000 },
//   ...
// ]
```

#### `getStats()`

Get liquidation statistics.

```javascript
const stats = await liquidationService.getStats();
// {
//   totalLiquidations: 156,
//   totalVolume: 234.5,
//   longLiquidations: 89,
//   shortLiquidations: 67,
//   cascadeCount: 3
// }
```

---

### OrderbookService

**Purpose:** Provides order book analysis.

**Methods:**

#### `getOrderBookMetrics()`

Get order book metrics.

```javascript
const metrics = await orderbookService.getOrderBookMetrics();
// {
//   imbalance: 0.15,
//   spread: 0.5,
//   bidLiquidity: 1234.5,
//   askLiquidity: 987.3,
//   bidWall: {...},
//   askWall: {...},
//   timestamp: 1705334400000
// }
```

---

### EntropyService

**Purpose:** Calculates and tracks Shannon entropy.

**Methods:**

#### `getEntropy()`

Get current entropy.

```javascript
const entropy = await entropyService.getEntropy();
// {
//   bidEntropy: 3.45,
//   askEntropy: 3.52,
//   avgEntropy: 3.485,
//   depth: 20,
//   timestamp: 1705334400000
// }
```

#### `getEntropyHistory(hours)`

Get entropy history.

```javascript
const history = await entropyService.getEntropyHistory(24);
// [
//   { timestamp: ..., bidEntropy: 3.45, askEntropy: 3.52 },
//   ...
// ]
```

#### `getDivergences()`

Get price-entropy divergences.

```javascript
const divergences = await entropyService.getDivergences();
// [
//   { type: 'BULLISH_DIVERGENCE', strength: 4, timestamp: ... },
//   ...
// ]
```

---

### EscapeService

**Purpose:** Detects and tracks escape types (H1/H2/H3).

**Methods:**

#### `getCurrentEscape()`

Get current escape detection.

```javascript
const escape = await escapeService.getCurrentEscape();
// {
//   type: 'H1',
//   confidence: 0.85,
//   interpretation: '...',
//   timestamp: 1705334400000
// }
```

#### `getEscapeHistory(hours)`

Get escape history.

```javascript
const history = await escapeService.getEscapeHistory(24);
// [
//   { type: 'H1', confidence: 0.85, timestamp: ... },
//   { type: 'H2', confidence: 0.72, timestamp: ... },
//   ...
// ]
```

---

### HistoryService

**Purpose:** Provides historical data access.

**Methods:**

#### `getPriceHistory(hours)`

Get price history.

```javascript
const history = await historyService.getPriceHistory(24);
// [
//   { timestamp: ..., price: 98000, change: 50 },
//   ...
// ]
```

#### `getGEXHistory(hours)`

Get GEX history.

```javascript
const history = await historyService.getGEXHistory(24);
// [
//   { timestamp: ..., totalGEX: 200M, gammaFlip: 95000 },
//   ...
// ]
```

---

### StrategyService

**Purpose:** Provides trading strategy recommendations.

**Methods:**

#### `getRecommendations()`

Get strategy recommendations.

```javascript
const recommendations = await strategyService.getRecommendations();
// [
//   {
//     strategy: 'RANGE_TRADING',
//     confidence: 'HIGH',
//     reasoning: '...',
//     entry: {...},
//     exit: {...}
//   },
//   ...
// ]
```

#### `analyzeSetup(setupType)`

Analyze specific setup.

```javascript
const analysis = await strategyService.analyzeSetup('IRON_CONDOR');
// {
//   viable: true,
//   confidence: 'MEDIUM',
//   strikes: {...},
//   expectedReturn: 5.2,
//   risk: 'MEDIUM'
// }
```

---

### MarketanalysisService

**Purpose:** Comprehensive market analysis.

**Methods:**

#### `getMarketOverview()`

Get complete market overview.

```javascript
const overview = await marketanalysisService.getMarketOverview();
// {
//   spotPrice: 98000,
//   sentiment: 'BULLISH',
//   regime: 'POSITIVE_GAMMA_ABOVE_FLIP',
//   gex: {...},
//   maxPain: {...},
//   liquidations: {...},
//   orderBook: {...},
//   recommendations: [...],
//   timestamp: 1705334400000
// }
```

#### `getKeyLevels()`

Get key price levels.

```javascript
const levels = await marketanalysisService.getKeyLevels();
// {
//   gammaFlip: 95000,
//   putWall: 93000,
//   callWall: 100000,
//   maxPain: 97000,
//   support: [93000, 95000],
//   resistance: [100000, 102000]
// }
```

---

### IvcomparisonService

**Purpose:** Compares IV between Binance and Deribit.

**Methods:**

#### `compareIV(dte)`

Compare IV for specific DTE.

```javascript
const comparison = await ivcomparisonService.compareIV(1);
// {
//   binance: {...},
//   deribit: {...},
//   spreads: {...},
//   retailPanicIndex: 121,
//   alerts: [...],
//   insights: [...]
// }
```

#### `getRetailPanicIndex()`

Get Retail Panic Index.

```javascript
const rpi = await ivcomparisonService.getRetailPanicIndex();
// {
//   value: 121,
//   level: 'MODERATE_PANIC',
//   interpretation: '...'
// }
```

---

### TradingBotService

**Purpose:** Manages trading bot operations.

**Methods:**

#### `getBotStatus()`

Get bot status.

```javascript
const status = await tradingBotService.getBotStatus();
// {
//   running: true,
//   strategy: 'RANGE_TRADING',
//   positions: 3,
//   pnl: 1234.56,
//   uptime: 3600000
// }
```

#### `getPositions()`

Get current positions.

```javascript
const positions = await tradingBotService.getPositions();
// [
//   {
//     symbol: 'BTC-250115-98000-C',
//     side: 'LONG',
//     quantity: 0.5,
//     entryPrice: 1500,
//     currentPrice: 1550,
//     pnl: 25
//   },
//   ...
// ]
```

---

## Database Services

### DataPersistenceService

**Purpose:** Saves snapshots to database for historical analysis.

**Methods:**

#### `saveGEXSnapshot(metrics)`

Save GEX snapshot.

```javascript
await dataPersistenceService.saveGEXSnapshot(gexMetrics);
```

#### `saveEntropySnapshot(entropy)`

Save entropy snapshot.

```javascript
await dataPersistenceService.saveEntropySnapshot(entropyData);
```

---

### DataRetentionService

**Purpose:** Manages data lifecycle and cleanup.

**Methods:**

#### `cleanOldData(days)`

Clean data older than N days.

```javascript
await dataRetentionService.cleanOldData(30);
```

#### `archiveData(startDate, endDate)`

Archive data to cold storage.

```javascript
await dataRetentionService.archiveData(startDate, endDate);
```

---

### GEXSnapshotService

**Purpose:** Query historical GEX snapshots.

**Methods:**

#### `getLatestSnapshot()`

Get latest GEX snapshot.

```javascript
const snapshot = await gexSnapshotService.getLatestSnapshot();
```

#### `getSnapshotsByTimeRange(start, end)`

Get snapshots in time range.

```javascript
const snapshots = await gexSnapshotService.getSnapshotsByTimeRange(start, end);
```

#### `compareSnapshots(timestamp1, timestamp2)`

Compare two snapshots.

```javascript
const comparison = await gexSnapshotService.compareSnapshots(ts1, ts2);
// {
//   gexChange: 50000000,
//   gammaFlipChange: 500,
//   putWallChange: -1000,
//   callWallChange: 2000
// }
```

---

## Usage Patterns

### Pattern 1: Service in API Route

```javascript
// routes/metrics.js
const express = require('express');
const router = express.Router();

module.exports = (dataCollector) => {
  const metricsService = new MetricsService(dataCollector);
  
  router.get('/gex', async (req, res) => {
    try {
      const metrics = await metricsService.getGEXMetrics();
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  return router;
};
```

### Pattern 2: Service Composition

```javascript
// Combine multiple services
class MarketAnalysisService {
  constructor(dataCollector) {
    this.metricsService = new MetricsService(dataCollector);
    this.sentimentService = new SentimentService(dataCollector);
    this.volatilityService = new VolatilityService(dataCollector);
  }
  
  async getMarketOverview() {
    const [gex, sentiment, iv] = await Promise.all([
      this.metricsService.getGEXMetrics(),
      this.sentimentService.getSentiment(),
      this.volatilityService.getIVMetrics()
    ]);
    
    return {
      gex,
      sentiment,
      iv,
      timestamp: Date.now()
    };
  }
}
```

### Pattern 3: Service with Caching

```javascript
class CachedMetricsService {
  constructor(dataCollector, cacheService) {
    this.metricsService = new MetricsService(dataCollector);
    this.cacheService = cacheService;
  }
  
  async getGEXMetrics() {
    const cacheKey = 'gex_metrics';
    const cached = await this.cacheService.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const metrics = await this.metricsService.getGEXMetrics();
    await this.cacheService.set(cacheKey, metrics, 5000); // 5s TTL
    
    return metrics;
  }
}
```

---

## Integration with API Routes

### Complete Example

```javascript
// server.js
const express = require('express');
const DataCollector = require('./collectors/DataCollector');

// Services
const OptionsService = require('./services/OptionsService');
const MetricsService = require('./services/MetricsService');
const SentimentService = require('./services/SentimentService');

const app = express();

// Initialize DataCollector
const dataCollector = new DataCollector();
await dataCollector.start();

// Initialize Services
const optionsService = new OptionsService(dataCollector);
const metricsService = new MetricsService(dataCollector);
const sentimentService = new SentimentService(dataCollector);

// API Routes
app.get('/api/options', async (req, res) => {
  try {
    const result = await optionsService.getAllOptions();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/metrics/gex', async (req, res) => {
  try {
    const metrics = await metricsService.getGEXMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sentiment', async (req, res) => {
  try {
    const sentiment = await sentimentService.getSentiment();
    res.json({ success: true, data: sentiment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

## Best Practices

### 1. Always Inject DataCollector

**Don't:**
```javascript
class MyService {
  constructor() {
    this.dataCollector = new DataCollector(); // ❌ Creates new instance
  }
}
```

**Do:**
```javascript
class MyService {
  constructor(dataCollector) {
    this.dataCollector = dataCollector; // ✅ Uses shared instance
  }
}
```

### 2. Handle Errors Gracefully

**Don't:**
```javascript
async getData() {
  const data = this.dataCollector.getData();
  return data; // ❌ No error handling
}
```

**Do:**
```javascript
async getData() {
  try {
    const data = this.dataCollector.getData();
    
    if (!data) {
      throw new Error('Data not available');
    }
    
    return {
      data,
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Failed to get data: ${error.message}`);
  }
}
```

### 3. Return Consistent Structures

**Don't:**
```javascript
async getData() {
  return this.dataCollector.getData(); // ❌ Raw data
}
```

**Do:**
```javascript
async getData() {
  const data = this.dataCollector.getData();
  
  return {
    data,
    count: data.length,
    timestamp: Date.now()
  };
}
```

### 4. Use Async/Await

**Don't:**
```javascript
getData() {
  return this.dataCollector.getData()
    .then(data => ({ data }))
    .catch(error => { throw error }); // ❌ Promise chains
}
```

**Do:**
```javascript
async getData() {
  try {
    const data = await this.dataCollector.getData();
    return { data };
  } catch (error) {
    throw error;
  }
}
```

---

## Testing Services

### Unit Test Example

```javascript
const OptionsService = require('./services/OptionsService');

describe('OptionsService', () => {
  let service;
  let mockDataCollector;
  
  beforeEach(() => {
    mockDataCollector = {
      getAllOptions: jest.fn(),
      getOptionsByStrike: jest.fn()
    };
    
    service = new OptionsService(mockDataCollector);
  });
  
  test('getAllOptions returns formatted data', async () => {
    const mockOptions = [
      { symbol: 'BTC-250115-98000-C', toJSON: () => ({ symbol: 'BTC-250115-98000-C' }) }
    ];
    
    mockDataCollector.getAllOptions.mockReturnValue(mockOptions);
    
    const result = await service.getAllOptions();
    
    expect(result).toEqual({
      options: [{ symbol: 'BTC-250115-98000-C' }],
      count: 1
    });
  });
  
  test('getAllOptions throws when data unavailable', async () => {
    mockDataCollector.getAllOptions.mockReturnValue(null);
    
    await expect(service.getAllOptions()).rejects.toThrow('Options data not available');
  });
});
```

---

## Performance Considerations

### Service Layer Overhead

| Operation | Overhead | Notes |
|-----------|----------|-------|
| **Data validation** | < 1ms | Minimal |
| **JSON conversion** | 1-5ms | Depends on data size |
| **Formatting** | < 1ms | Simple transformations |
| **Total** | **< 10ms** | Negligible |

### Optimization Tips

1. **Cache expensive operations**:
   ```javascript
   const cached = await cacheService.get('key');
   if (cached) return cached;
   ```

2. **Batch operations**:
   ```javascript
   const [data1, data2] = await Promise.all([
     service1.getData(),
     service2.getData()
   ]);
   ```

3. **Lazy load**:
   ```javascript
   async getData(includeHistory = false) {
     const data = await this.getBasicData();
     
     if (includeHistory) {
       data.history = await this.getHistory();
     }
     
     return data;
   }
   ```

---

## Related Components

- **DataCollector**: Primary data source
- **Calculators**: GEXCalculator, SentimentAnalyzer, etc.
- **API Routes**: Express routes that use services
- **Database Models**: Sequelize models for persistence

---

## References

### Internal Documentation

- [COLLECTORS.md](./COLLECTORS.md)
- [GEX_CALCULATOR.md](./GEX_CALCULATOR.md)
- [API_REFERENCE.md](./API_REFERENCE.md)
- [PROJECT_MAP.md](../PROJECT_MAP.md)

---

## Changelog

### v1.0.0 (Current)
- Initial implementation
- 19 services documented
- Service pattern established
- Integration examples provided

### Planned Features

- [ ] Service middleware (logging, caching)
- [ ] Service health checks
- [ ] Service metrics (response times, error rates)
- [ ] Service versioning
- [ ] GraphQL service layer

---

## Support

For questions or issues:
- Check [API_REFERENCE.md](./API_REFERENCE.md)
- Review [PROJECT_MAP.md](../PROJECT_MAP.md)
- See code: `backend/src/services/`

---

**Last Updated:** January 15, 2026  
**Version:** 1.0.0  
**Author:** Valter Russo / Gamma Tracker Team
