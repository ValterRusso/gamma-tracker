# Gamma Tracker Architecture

## System Overview

**Gamma Tracker** is a real-time options analytics platform that combines **market data collection**, **gamma exposure analysis**, **sentiment tracking**, and **automated trading** into a unified system. Built for **Bitcoin and Ethereum options markets**, it provides institutional-grade insights for retail traders.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                    (React Dashboard)                             │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│   │   GEX    │  │ Sentiment│  │ Liquidity│  │  Trading │      │
│   │ Heatmap  │  │ Analysis │  │ Analysis │  │   Bot    │      │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────────────────────┘
                              ↕ REST API
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│                    (Node.js / Express)                           │
│                                                                   │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                   API ROUTES                             │  │
│   │  /api/options  /api/metrics  /api/sentiment  /api/bot   │  │
│   └─────────────────────────────────────────────────────────┘  │
│                              ↕                                   │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                   SERVICES LAYER                         │  │
│   │  OptionsService  MetricsService  SentimentService  ...   │  │
│   └─────────────────────────────────────────────────────────┘  │
│                              ↕                                   │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                 DATA COLLECTOR                           │  │
│   │            (Central Orchestrator)                        │  │
│   └─────────────────────────────────────────────────────────┘  │
│                              ↕                                   │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│   │  COLLECTORS  │  │ CALCULATORS  │  │   BOT SYSTEM │        │
│   │              │  │              │  │              │        │
│   │ • Spot Price │  │ • GEX Calc   │  │ • BotManager │        │
│   │ • Open Int   │  │ • RSI Calc   │  │ • SignalEng  │        │
│   │ • Liquidation│  │ • MaxPain    │  │ • ExecEngine │        │
│   │ • OrderBook  │  │ • Regime     │  │ • PosMon     │        │
│   │ • Volume     │  │ • Sentiment  │  │              │        │
│   └──────────────┘  └──────────────┘  └──────────────┘        │
│                              ↕                                   │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                   DATABASE (PostgreSQL)                  │  │
│   │  GEXSnapshots  MarketSnapshots  BotTrades  ...          │  │
│   └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL DATA SOURCES                         │
│                                                                   │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│   │   Binance    │  │   Deribit    │  │   Binance    │        │
│   │   Options    │  │   Options    │  │   Futures    │        │
│   │              │  │              │  │              │        │
│   │ • Mark Price │  │ • IV Metrics │  │ • Liquidation│        │
│   │ • Greeks     │  │ • OI Data    │  │ • Order Book │        │
│   │ • Volume     │  │ • DVOL Index │  │ • Spot Price │        │
│   └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                   │
│   WebSocket Streams + REST APIs                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Real-Time Data Flow

```
External APIs (Binance, Deribit)
        ↓
WebSocket Streams + REST Polling
        ↓
Collectors (SpotPrice, OI, Liquidation, OrderBook, Volume)
        ↓
DataCollector (Orchestrator)
        ↓
Calculators (GEX, RSI, MaxPain, Regime, Sentiment, IV)
        ↓
Services (OptionsService, MetricsService, etc.)
        ↓
API Routes (REST endpoints)
        ↓
Frontend (React Dashboard)
```

### Historical Data Flow

```
DataCollector
        ↓
DataPersistenceService
        ↓
Database (PostgreSQL)
        ↓
Database Services (GEXSnapshotService, etc.)
        ↓
API Routes
        ↓
Frontend (Charts, History)
```

### Trading Bot Flow

```
DataCollector (Market Data)
        ↓
SignalEngine (Generate Signals)
        ↓
BotSignal (Database)
        ↓
ExecutionEngine (Execute Trades)
        ↓
BotTrade (Database)
        ↓
PositionMonitor (Monitor Positions)
        ↓
BotPerformance (Database)
```

---

## Component Architecture

### 1. Data Collection Layer

**Purpose:** Ingest real-time and historical market data from multiple sources.

**Components:**

| Component | Protocol | Update Frequency | Purpose |
|-----------|----------|------------------|---------|
| **SpotPriceCollector** | WebSocket | Real-time | BTC/ETH spot price |
| **OpenInterestCollector** | REST | 1 minute | Options OI by expiry |
| **VolumeCollector** | WebSocket/REST | Real-time | Options trading volume |
| **LiquidationTracker** | WebSocket | Real-time | Futures liquidations |
| **OrderBookAnalyzer** | WebSocket | Real-time | Futures order book |
| **DataCollector** | Hybrid | Mixed | Central orchestrator |

**Key Features:**
- ✅ Auto-reconnect on disconnect
- ✅ Rate limit handling
- ✅ Error recovery
- ✅ Event-driven architecture

---

### 2. Calculation Layer

**Purpose:** Process raw data into actionable insights.

**Components:**

| Calculator | Input | Output | Complexity |
|------------|-------|--------|------------|
| **GEXCalculator** | Options data | GEX metrics, Gamma Flip, Walls | High |
| **RSICalculator** | Price history | RSI values, Divergences | Medium |
| **MaxPainCalculator** | OI data | Max Pain strike, Top strikes | Low |
| **RegimeAnalyzer** | GEX + Spot | Market regime, Volatility expectation | Medium |
| **SentimentAnalyzer** | OI + Volume | P/C ratios, Sentiment | Medium |
| **IVComparator** | Binance + Deribit | IV spreads, Retail Panic Index | Medium |
| **EscapeTypeDetector** | Multi-source | Escape types (H1/H2/H3) | High |

**Key Features:**
- ✅ Stateless design
- ✅ Efficient algorithms
- ✅ Configurable parameters
- ✅ Real-time updates

---

### 3. Service Layer

**Purpose:** Business logic and data transformation.

**Pattern:**

```javascript
class Service {
  constructor(dataCollector) {
    this.dataCollector = dataCollector;
  }
  
  async getData() {
    // 1. Get raw data
    const raw = this.dataCollector.getData();
    
    // 2. Validate
    if (!raw) throw new Error('Data unavailable');
    
    // 3. Transform
    const formatted = this.format(raw);
    
    // 4. Return
    return { data: formatted, timestamp: Date.now() };
  }
}
```

**Services:**
- OptionsService
- MetricsService
- SentimentService
- VolatilityService
- LiquidationService
- OrderbookService
- EntropyService
- EscapeService
- HistoryService
- StrategyService
- MarketanalysisService
- IvcomparisonService
- TradingBotService

**Key Features:**
- ✅ Stateless
- ✅ Dependency injection
- ✅ Consistent API
- ✅ Error handling

---

### 4. API Layer

**Purpose:** Expose data via REST endpoints.

**Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/options` | GET | Get all options |
| `/api/options/:symbol` | GET | Get specific option |
| `/api/metrics/gex` | GET | Get GEX metrics |
| `/api/metrics/regime` | GET | Get regime analysis |
| `/api/metrics/maxpain` | GET | Get max pain |
| `/api/sentiment` | GET | Get sentiment analysis |
| `/api/volatility/iv` | GET | Get IV metrics |
| `/api/volatility/compare` | GET | Compare Binance vs Deribit |
| `/api/liquidations` | GET | Get liquidation data |
| `/api/orderbook` | GET | Get order book metrics |
| `/api/entropy` | GET | Get entropy metrics |
| `/api/escape` | GET | Get escape detection |
| `/api/history/:metric` | GET | Get historical data |
| `/api/bot/status` | GET | Get bot status |
| `/api/bot/signals` | GET | Get trading signals |
| `/api/bot/trades` | GET | Get bot trades |
| `/api/bot/performance` | GET | Get bot performance |

**Response Format:**

```javascript
{
  success: true,
  data: { ... },
  timestamp: 1705334400000
}
```

**Error Format:**

```javascript
{
  success: false,
  error: "Error message",
  timestamp: 1705334400000
}
```

---

### 5. Database Layer

**Purpose:** Persistent storage for historical data and bot operations.

**Schema:**

```
Market Data Tables:
├── gex_snapshots (Time-series GEX)
├── market_snapshots (Complete market state)
├── options_history (Historical options)
└── anomalies_log (Detected anomalies)

Trading Bot Tables:
├── bot_config (Bot configuration)
├── bot_signals (Trading signals)
├── bot_trades (Executed trades)
└── bot_performance (Performance metrics)

Reference Tables:
└── assets (Supported assets)
```

**Key Features:**
- ✅ Time-series optimized
- ✅ Indexed for fast queries
- ✅ Automatic data retention
- ✅ Backup & recovery

---

### 6. Trading Bot System

**Architecture:**

```
BotManager (Orchestrator)
    ↓
SignalEngine (Generate Signals)
    ↓
ExecutionEngine (Execute Trades)
    ↓
PositionMonitor (Monitor Positions)
```

**Signal Generation Process:**

1. **Collect Market Data**
   - GEX metrics
   - Sentiment
   - Volatility
   - Order book
   - Liquidations

2. **Apply Strategy Rules**
   - Check entry conditions
   - Calculate confidence
   - Generate signal

3. **Validate Signal**
   - Check risk limits
   - Verify position limits
   - Confirm market conditions

4. **Save Signal**
   - Store in database
   - Emit event

**Execution Process:**

1. **Receive Signal**
2. **Validate Execution**
3. **Calculate Position Size**
4. **Place Order**
5. **Record Trade**
6. **Update Signal Status**

**Position Monitoring:**

1. **Track Open Positions**
2. **Check Exit Conditions**
   - Stop loss
   - Take profit
   - Time-based
   - Signal-based
3. **Execute Exit**
4. **Update Performance**

**Strategies:**
- Range Trading
- Trend Following
- Mean Reversion
- Gamma Scalping
- Volatility Arbitrage

---

## Technology Stack

### Backend

| Component | Technology | Version |
|-----------|------------|---------|
| **Runtime** | Node.js | 18+ |
| **Framework** | Express | 4.x |
| **ORM** | Sequelize | 6.x |
| **Database** | PostgreSQL | 14+ |
| **WebSocket** | ws | 8.x |
| **HTTP Client** | axios | 1.x |
| **Logging** | Custom Logger | - |

### Frontend

| Component | Technology | Version |
|-----------|------------|---------|
| **Framework** | React | 18+ |
| **State Management** | Context API | - |
| **Charts** | Recharts | 2.x |
| **HTTP Client** | axios | 1.x |
| **Styling** | Tailwind CSS | 3.x |

### Infrastructure

| Component | Technology |
|-----------|------------|
| **Hosting** | VPS / Cloud |
| **Reverse Proxy** | Nginx |
| **Process Manager** | PM2 |
| **Monitoring** | Custom + Logs |

---

## Design Patterns

### 1. Dependency Injection

**Used in:** Services, Calculators

```javascript
class Service {
  constructor(dataCollector) {
    this.dataCollector = dataCollector;  // Injected dependency
  }
}
```

**Benefits:**
- Testability
- Loose coupling
- Easy mocking

---

### 2. Event-Driven Architecture

**Used in:** Collectors, DataCollector

```javascript
class Collector extends EventEmitter {
  handleData(data) {
    this.emit('data-updated', data);
  }
}

collector.on('data-updated', (data) => {
  // React to event
});
```

**Benefits:**
- Decoupling
- Scalability
- Real-time updates

---

### 3. Strategy Pattern

**Used in:** Trading Bot

```javascript
class TradingStrategy {
  generateSignal(marketData) {
    // Strategy-specific logic
  }
}

class RangeTradingStrategy extends TradingStrategy { ... }
class TrendFollowingStrategy extends TradingStrategy { ... }
```

**Benefits:**
- Extensibility
- Maintainability
- Testability

---

### 4. Repository Pattern

**Used in:** Database Services

```javascript
class GEXSnapshotRepository {
  async save(snapshot) { ... }
  async findByTimeRange(start, end) { ... }
  async getLatest() { ... }
}
```

**Benefits:**
- Data access abstraction
- Testability
- Maintainability

---

### 5. Observer Pattern

**Used in:** DataCollector, Bot System

```javascript
dataCollector.on('gex-updated', (metrics) => {
  // Multiple observers can react
  botManager.onGEXUpdate(metrics);
  apiServer.broadcastUpdate(metrics);
  persistenceService.save(metrics);
});
```

**Benefits:**
- Loose coupling
- Multiple subscribers
- Real-time notifications

---

## Scalability Considerations

### Horizontal Scaling

**Current:** Single-instance architecture

**Future:**
- Multiple API servers behind load balancer
- Separate data collection instances
- Distributed database (read replicas)
- Redis for caching and pub/sub

### Vertical Scaling

**Current Limits:**
- CPU: 4-8 cores
- RAM: 8-16 GB
- Disk: 100 GB SSD

**Optimization:**
- Efficient algorithms (O(n log n) max)
- Connection pooling
- Bulk database operations
- WebSocket instead of polling

### Performance Metrics

| Metric | Current | Target |
|--------|---------|--------|
| **API Response Time** | < 100ms | < 50ms |
| **WebSocket Latency** | < 200ms | < 100ms |
| **Database Query Time** | < 50ms | < 20ms |
| **Memory Usage** | ~200MB | < 500MB |
| **CPU Usage** | ~30% | < 50% |

---

## Security

### API Security

- ✅ CORS configuration
- ✅ Rate limiting
- ✅ Input validation
- ✅ Error sanitization
- ⏳ API key authentication (planned)
- ⏳ JWT tokens (planned)

### Database Security

- ✅ Parameterized queries (SQL injection prevention)
- ✅ Connection encryption (SSL)
- ✅ Least privilege access
- ✅ Regular backups

### Bot Security

- ✅ API key encryption
- ✅ Position limits
- ✅ Risk management
- ✅ Emergency stop mechanism

---

## Monitoring & Logging

### Logging Levels

| Level | Usage |
|-------|-------|
| **DEBUG** | Detailed diagnostic info |
| **INFO** | General informational messages |
| **SUCCESS** | Successful operations |
| **WARN** | Warning messages |
| **ERROR** | Error messages |

### Log Format

```
[2026-01-15 12:34:56] [INFO] [DataCollector] Options updated: 150
[2026-01-15 12:34:57] [SUCCESS] [GEXCalculator] GEX calculated: $200M
[2026-01-15 12:34:58] [WARN] [LiquidationTracker] High liquidation volume: 45.2 BTC
[2026-01-15 12:34:59] [ERROR] [ExecutionEngine] Order failed: Insufficient balance
```

### Monitoring

**Metrics Tracked:**
- API request count
- API response times
- WebSocket connection count
- Database query times
- Memory usage
- CPU usage
- Error rates

**Alerting:**
- High error rate
- High latency
- Database connection failures
- WebSocket disconnects
- Bot execution failures

---

## Deployment

### Development

```bash
# Install dependencies
npm install

# Setup database
npx sequelize-cli db:migrate

# Start development server
npm run dev
```

### Production

```bash
# Install dependencies
npm install --production

# Run migrations
npx sequelize-cli db:migrate

# Start with PM2
pm2 start ecosystem.config.js
```

### Environment Variables

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gamma_tracker_db
DB_USER=postgres
DB_PASSWORD=secret

# API
PORT=3000
NODE_ENV=production

# Binance
BINANCE_API_KEY=...
BINANCE_API_SECRET=...

# Deribit
DERIBIT_API_KEY=...
DERIBIT_API_SECRET=...
```

---

## Testing Strategy

### Unit Tests

**Coverage:**
- Calculators (GEX, RSI, etc.)
- Services (OptionsService, etc.)
- Utilities

**Framework:** Jest

```bash
npm test
```

### Integration Tests

**Coverage:**
- API endpoints
- Database operations
- Bot system

**Framework:** Jest + Supertest

```bash
npm run test:integration
```

### End-to-End Tests

**Coverage:**
- Complete workflows
- Bot trading cycles
- Data collection → API → Frontend

**Framework:** Playwright (planned)

---

## Future Enhancements

### Short-Term (3-6 months)

- [ ] Real-time WebSocket API for frontend
- [ ] Advanced bot strategies (ML-based)
- [ ] Multi-asset support (ETH, SOL)
- [ ] Mobile app (React Native)
- [ ] Performance dashboard

### Medium-Term (6-12 months)

- [ ] Machine learning for signal generation
- [ ] Backtesting framework
- [ ] Paper trading mode
- [ ] Social features (shared strategies)
- [ ] Premium subscription tiers

### Long-Term (12+ months)

- [ ] Multi-exchange support (OKX, Bybit)
- [ ] Decentralized options (Deribit, Lyra)
- [ ] Algorithmic market making
- [ ] Institutional API
- [ ] White-label solution

---

## Related Documentation

- [PROJECT_MAP.md](../PROJECT_MAP.md) - Project structure
- [API_REFERENCE.md](./API_REFERENCE.md) - API documentation
- [COLLECTORS.md](./COLLECTORS.md) - Data collectors
- [SERVICES.md](./SERVICES.md) - Service layer
- [DATABASE.md](./DATABASE.md) - Database schema
- [GEX_CALCULATOR.md](./GEX_CALCULATOR.md) - GEX calculation
- [ESCAPE_SYSTEM.md](./escape_system.md) - Escape detection

---

## Contributing

### Code Style

- **JavaScript:** ES6+, async/await
- **Naming:** camelCase for variables, PascalCase for classes
- **Comments:** JSDoc for public APIs
- **Formatting:** Prettier (2 spaces)

### Git Workflow

1. Create feature branch: `git checkout -b feature/new-feature`
2. Commit changes: `git commit -m "feat: Add new feature"`
3. Push to remote: `git push origin feature/new-feature`
4. Create pull request

### Commit Messages

**Format:** `<type>: <description>`

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

---

## Support

For questions or issues:
- Check documentation in `docs/`
- Review code in `backend/src/`
- Contact: Valter Russo / Gamma Tracker Team

---

**Last Updated:** January 15, 2026  
**Version:** 1.0.0  
**Author:** Valter Russo / Gamma Tracker Team
