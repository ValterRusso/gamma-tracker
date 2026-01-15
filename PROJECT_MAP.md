# 🗺️ Gamma Tracker - Project Map

> **Complete architectural overview and component inventory**
> 
> Last updated: 2026-01-15

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Components Inventory](#components-inventory)
- [Data Flow](#data-flow)
- [Technology Stack](#technology-stack)
- [Documentation Status](#documentation-status)
- [Metrics](#metrics)

---

## 🎯 Project Overview

**Gamma Tracker** is an institutional-grade options market analysis platform that provides real-time market microstructure analytics, automated trading capabilities, and advanced risk management tools for cryptocurrency options (primarily BTC and ETH on Binance).

### Key Capabilities

- **12 Advanced Market Indicators** - Institutional-level analytics
- **Multi-Bot Trading System** - Automated strategy execution
- **Real-time Data Collection** - WebSocket + REST hybrid
- **Gamma Exposure Tracking** - SpotGamma-style analysis
- **Shannon Entropy Analysis** - Market chaos measurement
- **Iceberg Order Detection** - Hidden institutional flow
- **Escape Detection** - Breakout pattern recognition
- **Liquidation Tracking** - Market stress indicators
- **Volatility Surface Analysis** - 3D IV visualization
- **Strategy Recommendation** - AI-powered strategy selection

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                    (React + TypeScript)                     │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Dashboard  │  │   Charts    │  │   Trading   │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ REST API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     API SERVER (Express)                    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              20 REST API Endpoints                   │  │
│  │  /options  /gex  /entropy  /escape  /liquidations   │  │
│  │  /orderbook  /volatility  /bot/*  /strategies  ...  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  COLLECTORS  │  │ CALCULATORS  │  │   SERVICES   │
│              │  │              │  │              │
│ • Data       │  │ • GEX        │  │ • Options    │
│ • Spot Price │  │ • Entropy    │  │ • Trading Bot│
│ • OI         │  │ • Escape     │  │ • Entropy    │
│ • Volume     │  │ • Iceberg    │  │ • Liquidation│
│ • Liquidation│  │ • Anomaly    │  │ • Orderbook  │
│ • OrderBook  │  │ • MaxPain    │  │ • Volatility │
│              │  │ • Regime     │  │ • Sentiment  │
│              │  │ • Sentiment  │  │ • Strategy   │
│              │  │ • IV Compare │  │ • Metrics    │
│              │  │ • VolSurface │  │ • History    │
│              │  │ • RSI        │  │              │
│              │  │ • Combined   │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                           ▼
                  ┌──────────────┐
                  │   DATABASE   │
                  │   (MySQL)    │
                  │              │
                  │ • Options    │
                  │ • GEX        │
                  │ • Trades     │
                  │ • Signals    │
                  │ • Snapshots  │
                  │ • Anomalies  │
                  └──────────────┘
                           │
                           ▼
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   BINANCE    │  │   DERIBIT    │  │  WEBSOCKETS  │
│   Options    │  │   DVOL API   │  │              │
│   REST API   │  │              │  │ • Mark Price │
│              │  │              │  │ • Ticker     │
│              │  │              │  │ • Trades     │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 📦 Components Inventory

### 1. Data Collectors (6 components)

| Component | File | LOC | Status | Purpose |
|-----------|------|-----|--------|---------|
| **DataCollector** | `collectors/DataCollector.js` | ~800 | ✅ Active | Main data orchestrator (WebSocket + REST hybrid) |
| **SpotPriceCollector** | `collectors/SpotPriceCollector.js` | ~400 | ✅ Active | Real-time spot price tracking |
| **OpenInterestCollector** | `collectors/OpenInterestCollector.js` | ~350 | ✅ Active | Open interest data collection |
| **VolumeCollector** | `collectors/VolumeCollector.js` | ~300 | ✅ Active | Volume data aggregation |
| **LiquidationTracker** | `collectors/LiquidationTracker.js` | ~500 | ✅ Active | Liquidation events tracking |
| **OrderBookAnalyzer** | `collectors/OrderBookAnalyzer.js` | ~420 | ✅ Active | Order book depth analysis |

**Total:** 2,770 LOC

### 2. Calculators (15 components)

| Component | File | LOC | Documented | Purpose |
|-----------|------|-----|------------|---------|
| **GEXCalculator** | `calculators/GEXCalculator.js` | ~600 | ⚠️ Partial | Gamma exposure calculation |
| **EscapeTypeDetector** | `calculators/EscapeTypeDetector.js` | ~800 | ✅ Yes | Breakout pattern detection (Half Pipe Model) |
| **EntropyCalculatorV2** | `calculators/EntropyCalculatorV2.js` | ~500 | ❌ No | Shannon entropy (order book chaos) |
| **IcebergDetector** | `calculators/IcebergDetector.js` | ~400 | ❌ No | Hidden order detection |
| **VolatilityAnomalyDetector** | `calculators/VolatilityAnomalyDetector.js` | ~700 | ✅ Yes | Statistical IV outliers |
| **MaxPainCalculator** | `calculators/MaxPainCalculator.js` | ~350 | ❌ No | Max pain price calculation |
| **RegimeAnalyzer** | `calculators/RegimeAnalyzer.js` | ~450 | ❌ No | Market regime classification |
| **SentimentAnalyzer** | `calculators/SentimentAnalyzer.js` | ~400 | ❌ No | Put/Call ratio sentiment |
| **IVComparator** | `calculators/IVComparator.js` | ~500 | ❌ No | Binance vs Deribit IV comparison |
| **VolatilitySurfaceCalculator** | `calculators/VolatilitySurfaceCalculator.js` | ~600 | ⚠️ Partial | 3D IV surface generation |
| **RSICalculatorV2** | `calculators/RSICalculatorV2.js` | ~300 | ❌ No | RSI indicator calculation |
| **CombinedMarketAnalyzer** | `calculators/CombinedMarketAnalyzer.js` | ~450 | ❌ No | Multi-indicator aggregation |
| **EntropyCalculator** (V1) | `calculators/EntropyCalculator.js` | ~400 | ❌ No | Legacy entropy calculator |
| **RSICalculator** (V1) | `calculators/RSICalculator.js` | ~250 | ❌ No | Legacy RSI calculator |
| **iceMock** | `calculators/iceMock.js` | ~56 | ❌ No | Mock data for testing |

**Total:** 7,356 LOC

### 3. Services (12+ services)

| Service | File | LOC | Purpose |
|---------|------|-----|---------|
| **OptionsService** | `services/OptionsService.js` | ~500 | Options data aggregation & API |
| **TradingBotService** | `services/TradingBot/TradingBotService.js` | ~600 | Multi-bot orchestration |
| **EntropyService** | `services/EntropyService.js` | ~300 | Entropy API service |
| **EscapeService** | `services/EscapeService.js` | ~350 | Escape detection API |
| **LiquidationService** | `services/LiquidationService.js` | ~280 | Liquidation data API |
| **OrderbookService** | `services/OrderbookService.js` | ~320 | Order book API |
| **VolatilityService** | `services/VolatilityService.js` | ~400 | Volatility metrics API |
| **MetricsService** | `services/MetricsService.js` | ~250 | System metrics |
| **HistoryService** | `services/HistoryService.js` | ~300 | Historical data access |
| **StrategyService** | `services/StrategyService.js` | ~350 | Strategy recommendation API |
| **SentimentService** | `services/SentimentService.js` | ~200 | Sentiment analysis API |
| **MarketanalysisService** | `services/MarketanalysisService.js` | ~280 | Market analysis API |
| **IvcomparisonService** | `services/IvcomparisonService.js` | ~346 | IV comparison API |

**Total:** 4,476 LOC

### 4. Trading Bot System (4 components)

| Component | File | LOC | Documented | Purpose |
|-----------|------|-----|------------|---------|
| **BotManager** | `services/TradingBot/BotManager.js` | ~400 | ✅ Refactoring | Multi-bot lifecycle management |
| **SignalEngine** | `services/TradingBot/SignalEngine.js` | ~350 | ⚠️ Partial | Entry signal generation |
| **ExecutionEngine** | `services/TradingBot/ExecutionEngine.js` | ~450 | ⚠️ Partial | Trade execution & order management |
| **PositionMonitor** | `services/TradingBot/PositionMonitor.js` | ~400 | ⚠️ Partial | Position monitoring & exit logic |

**Total:** ~1,600 LOC (included in Services total)

**Documentation:**
- ✅ MULTI_BOT_REFACTORING_PLAN.md
- ✅ MULTI_BOT_REFACTORING_SUMMARY.md
- ✅ MULTI_BOT_TESTING_GUIDE.md

### 5. Database Layer (7 models + 5 services)

#### Models

| Model | File | Purpose |
|-------|------|---------|
| **Asset** | `database/models/Asset.js` | Underlying assets (BTC, ETH) |
| **BotConfig** | `database/models/BotConfig.js` | Bot configuration storage |
| **BotTrade** | `database/models/BotTrade.js` | Trade records |
| **BotSignal** | `database/models/BotSignal.js` | Signal history |
| **BotPerformance** | `database/models/BotPerformance.js` | Performance metrics |
| **GEXSnapshot** | `database/models/GEXSnapshot.js` | GEX historical snapshots |
| **MarketSnapshot** | `database/models/MarketSnapshot.js` | Market state snapshots |
| **OptionsHistory** | `database/models/OptionsHistory.js` | Options data history |
| **AnomaliesLog** | `database/models/AnomaliesLog.js` | Volatility anomalies log |

#### Services

| Service | File | Purpose |
|---------|------|---------|
| **DataPersistenceService** | `database/services/DataPersistenceService.js` | Data persistence orchestration |
| **DataRetentionService** | `database/services/DataRetentionService.js` | Data cleanup & retention |
| **GEXSnapshotService** | `database/services/GEXSnapshotService.js` | GEX snapshot management |
| **DEXSnapshotService** | `database/services/DEXSnapshotService.js` | DEX snapshot management |
| **PositionCalculatorService** | `database/services/PositionCalculatorService.js` | Position P&L calculation |
| **DVOLService** | `database/services/DVOLService.js` | DVOL data management |

**Total:** 3,010 LOC

### 6. Integrations (2 adapters)

| Integration | File | LOC | Purpose |
|-------------|------|-----|---------|
| **BinanceAdapter** | `integrations/BinanceAdapter.js` | ~400 | Binance Options API wrapper |
| **DeribitAPI** | `integrations/DeribitAPI.js` | ~224 | Deribit DVOL API client |

**Total:** 624 LOC

### 7. Strategy Recommender (3 components)

| Component | File | LOC | Documented | Purpose |
|-----------|------|-----|------------|---------|
| **MarketStateAnalyzer** | `recommender/MarketStateAnalyzer.js` | ~400 | ✅ Yes | Market state classification |
| **StrategyRecommender** | `recommender/StrategyRecommender.js` | ~500 | ✅ Yes | Strategy selection engine |
| **strategies.js** | `recommender/strategies.js` | ~300 | ✅ Yes | Strategy definitions |

**Documentation:** STRATEGY_RECOMMENDER_JOURNEY.md (22K)

### 8. API Routes (20 endpoints)

| Route | File | Purpose |
|-------|------|---------|
| `/api/options` | `api/routes/options.routes.js` | Options chain data |
| `/api/gex-heatmap` | `api/routes/gex-heatmap.routes.js` | GEX heatmap visualization |
| `/api/entropy` | `api/routes/entropy.routes.js` | Shannon entropy metrics |
| `/api/escape` | `api/routes/escape.routes.js` | Escape detection data |
| `/api/liquidations` | `api/routes/liquidations.routes.js` | Liquidation tracking |
| `/api/orderbook` | `api/routes/orderbook.routes.js` | Order book analysis |
| `/api/volatility` | `api/routes/volatility.routes.js` | Volatility metrics |
| `/api/iv-comparison` | `api/routes/iv-comparison.routes.js` | IV comparison (Binance vs Deribit) |
| `/api/dvol` | `api/routes/dvol.routes.js` | DVOL index data |
| `/api/sentiment` | `api/routes/sentiment.routes.js` | Market sentiment |
| `/api/market-analysis` | `api/routes/market-analysis.routes.js` | Combined market analysis |
| `/api/metrics` | `api/routes/metrics.routes.js` | System metrics |
| `/api/history` | `api/routes/history.routes.js` | Historical data |
| `/api/positions` | `api/routes/positions.routes.js` | Position management |
| `/api/strategies` | `api/routes/strategies.routes.js` | Strategy recommendations |
| `/api/system` | `api/routes/system.routes.js` | System status |
| `/api/bot/configs` | `api/routes/bot.routes.js` | Bot configurations |
| `/api/bot/status` | `api/routes/bot.routes.js` | Bot status |
| `/api/bot/trades` | `api/routes/bot.routes.js` | Bot trades |
| `/api/bot/signals` | `api/routes/bot.routes.js` | Bot signals |
| `/api/bot/performance` | `api/routes/bot.routes.js` | Bot performance |
| `/api/dex-heatmap` | `api/routes/dex-heatmap.routes.js` | DEX heatmap |

---

## 🔄 Data Flow

### 1. Real-time Data Collection Flow

```
Binance WebSocket → DataCollector → Option Model → Database
                                   ↓
                              Calculators → Services → API → Frontend
```

### 2. Trading Bot Flow

```
SignalEngine (analyze market)
      ↓
   Signal Generated
      ↓
ExecutionEngine (execute trade)
      ↓
   Trade Opened
      ↓
PositionMonitor (monitor P&L)
      ↓
   Exit Condition Met
      ↓
ExecutionEngine (close trade)
      ↓
   Trade Closed
```

### 3. API Request Flow

```
Frontend → Express Router → Service Layer → Calculator/Collector → Database/Cache → Response
```

---

## 🛠️ Technology Stack

### Backend
- **Runtime:** Node.js (CommonJS)
- **Framework:** Express 5.2.1
- **Database:** MySQL 2 (via Sequelize 6.37.7)
- **WebSocket:** ws 8.18.3
- **HTTP Client:** axios 1.13.2
- **Binance SDK:** @binance/connector 3.6.1

### Frontend
- **Framework:** React + TypeScript
- **Build Tool:** Vite
- **UI Components:** Custom + Chart libraries

### Infrastructure
- **API Port:** 3300 (default)
- **Database:** MySQL
- **Persistence:** 10-minute intervals
- **Data Retention:** Configurable

---

## 📊 Metrics

### Code Statistics

| Category | Lines of Code | Files | Avg LOC/File |
|----------|---------------|-------|--------------|
| **Calculators** | 7,356 | 15 | 490 |
| **Collectors** | 2,770 | 6 | 462 |
| **Services** | 4,476 | 12+ | 373 |
| **Database** | 3,010 | 12 | 251 |
| **Integrations** | 624 | 2 | 312 |
| **TOTAL Backend** | ~18,236 | 47+ | 388 |

### Documentation Statistics

| Category | Files | Total Size | Status |
|----------|-------|------------|--------|
| **Escape System** | 4 | 75K | ✅ Complete |
| **Strategy Recommender** | 1 | 22K | ✅ Complete |
| **Liquidation Tracker** | 1 | 13K | ✅ Complete |
| **Trading Bot** | 3 | 28K | ✅ Refactoring docs |
| **GEX & Features** | 4 | 45K | ⚠️ Partial |
| **Volatility Anomalies** | 1 | 11K | ✅ Complete |
| **Database** | 1 | 10K | ✅ Complete |
| **API Reference** | 1 | 0.6K | ❌ Minimal |
| **TOTAL** | 19 | 204K | ⚠️ Incomplete |

### API Endpoints

- **Total Routes:** 20+
- **Bot Management:** 5 endpoints
- **Market Data:** 10 endpoints
- **Analytics:** 5 endpoints

### Features

- **Market Indicators:** 12
- **Trading Strategies:** 2 (Iron Condor, Iron Butterfly)
- **Data Sources:** 2 (Binance, Deribit)
- **Database Models:** 9
- **Real-time Streams:** 3 (Mark Price, Ticker, Trades)

---

## 📚 Documentation Status

### ✅ Well Documented (6 components)

1. **Escape System** (4 docs, 75K)
   - ESCAPETYPEDETECTOR_DESIGN.md
   - ESCAPETYPEDETECTOR_README.md
   - ESCAPE_INTEGRATION_GUIDE.md
   - ESCAPE_SYSTEM_VISUAL_GUIDE.md

2. **Strategy Recommender** (1 doc, 22K)
   - STRATEGY_RECOMMENDER_JOURNEY.md

3. **Liquidation Tracker** (1 doc, 13K)
   - LIQUIDATION_TRACKER_INTEGRATION.md

4. **Volatility Anomalies** (1 doc, 11K)
   - Volatility Surface Anomaly Detection System.md

5. **Trading Bot** (3 docs, 28K)
   - MULTI_BOT_REFACTORING_PLAN.md
   - MULTI_BOT_REFACTORING_SUMMARY.md
   - MULTI_BOT_TESTING_GUIDE.md

6. **Database** (1 doc, 10K)
   - 📊 Gamma Tracker - Database Setup Guide.md

### ⚠️ Partially Documented (4 components)

1. **GEX Calculator** - Only summary available
2. **Features Implementation** - Implementation notes, not full docs
3. **API Endpoints** - Only list, no detailed reference
4. **Deployment** - Scattered across multiple docs

### ❌ Not Documented (8 critical components)

1. **Shannon Entropy (EntropyCalculatorV2)** - Complex algorithm, no docs
2. **Iceberg Detector** - Unique feature, no docs
3. **Order Book Analyzer** - Core component, no docs
4. **RSI Calculator** - No docs
5. **Max Pain Calculator** - No docs
6. **Regime Analyzer** - No docs
7. **Sentiment Analyzer** - No docs
8. **IV Comparator** - No docs

### ❌ Missing Critical Documentation

1. **README.md** - No project overview
2. **ARCHITECTURE.md** - No system architecture doc
3. **API_REFERENCE.md** - No complete API documentation
4. **DEPLOYMENT.md** - No deployment guide
5. **DEVELOPMENT.md** - No developer guide
6. **CONTRIBUTING.md** - No contribution guidelines

---

## 🎯 Priority Documentation Needs

### Critical (Must Have)

1. ✅ **PROJECT_MAP.md** - This document
2. ❌ **README.md** - Project overview & quick start
3. ❌ **ARCHITECTURE.md** - System architecture
4. ❌ **DEPLOYMENT.md** - Installation & deployment
5. ❌ **API_REFERENCE.md** - Complete API documentation

### High Priority (Core Features)

6. ❌ **docs/calculators/ENTROPY.md** - Shannon Entropy documentation
7. ❌ **docs/calculators/ICEBERG.md** - Iceberg Detector documentation
8. ❌ **docs/calculators/GEX.md** - Complete GEX documentation
9. ❌ **docs/calculators/ORDERBOOK.md** - Order Book Analyzer documentation
10. ❌ **docs/trading-bot/COMPLETE_GUIDE.md** - Trading bot complete guide

### Medium Priority (Supporting Features)

11. ❌ **docs/calculators/RSI.md**
12. ❌ **docs/calculators/MAX_PAIN.md**
13. ❌ **docs/calculators/REGIME.md**
14. ❌ **docs/calculators/SENTIMENT.md**
15. ❌ **docs/calculators/IV_COMPARATOR.md**

### Low Priority (Nice to Have)

16. ❌ **CONTRIBUTING.md** - Contribution guidelines
17. ❌ **CHANGELOG.md** - Version history
18. ❌ **ROADMAP.md** - Future plans
19. ❌ **FAQ.md** - Frequently asked questions
20. ❌ **TROUBLESHOOTING.md** - Common issues & solutions

---

## 📝 Next Steps

1. ✅ Create PROJECT_MAP.md (this document)
2. ⏳ Create README.md
3. ⏳ Create ARCHITECTURE.md
4. ⏳ Document critical calculators (Entropy, Iceberg, GEX, OrderBook)
5. ⏳ Create complete API reference
6. ⏳ Create deployment guide
7. ⏳ Review and consolidate existing docs
8. ⏳ Identify and document gaps/bugs
9. ⏳ Create improvement roadmap

---

## 🔗 Related Documents

- [MULTI_BOT_REFACTORING_SUMMARY.md](./MULTI_BOT_REFACTORING_SUMMARY.md) - Trading bot refactoring
- [ESCAPE_SYSTEM_VISUAL_GUIDE.md](./docs/ESCAPE_SYSTEM_VISUAL_GUIDE.md) - Escape system documentation
- [STRATEGY_RECOMMENDER_JOURNEY.md](./docs/STRATEGY_RECOMMENDER_JOURNEY.md) - Strategy recommender
- [📊 Gamma Tracker - Database Setup Guide.md](./docs/📊%20Gamma%20Tracker%20-%20Database%20Setup%20Guide.md) - Database setup

---

**Generated by:** Manus AI  
**Date:** 2026-01-15  
**Version:** 1.0  
**Status:** 🟢 Active
