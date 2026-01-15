# Gamma Tracker Documentation Index

## 📚 **Complete Documentation Guide**

Welcome to the Gamma Tracker documentation! This index provides a structured overview of all available documentation.

---

## 🚀 **Quick Start**

| Document | Description | Audience |
|----------|-------------|----------|
| [README.md](../README.md) | Project overview and quick start | Everyone |
| [PROJECT_MAP.md](../PROJECT_MAP.md) | Project structure and file organization | Developers |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture and design patterns | Architects, Developers |

---

## 📖 **Core Documentation**

### System Architecture

| Document | Description | Size |
|----------|-------------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Complete system architecture, data flow, design patterns | ~30K |
| [PROJECT_MAP.md](../PROJECT_MAP.md) | File structure and component organization | ~15K |

### API Documentation

| Document | Description | Size |
|----------|-------------|------|
| [API_REFERENCE.md](./API_REFERENCE.md) | Complete REST API reference with examples | ~25K |

---

## 🔢 **Calculators**

Detailed documentation for all calculation engines.

| Calculator | Description | Size | Complexity |
|------------|-------------|------|------------|
| [GEX_CALCULATOR.md](./GEX_CALCULATOR.md) | Gamma Exposure calculation, Gamma Flip, Put/Call Walls | ~30K | High |
| [RSI_CALCULATOR.md](./RSI_CALCULATOR.md) | Relative Strength Index with Wilder's smoothing | ~20K | Medium |
| [MAX_PAIN_CALCULATOR.md](./MAX_PAIN_CALCULATOR.md) | Max Pain calculation and OI distribution | ~25K | Low |
| [REGIME_ANALYZER.md](./REGIME_ANALYZER.md) | Market regime classification (4 regimes) | ~30K | Medium |
| [SENTIMENT_ANALYZER.md](./SENTIMENT_ANALYZER.md) | Put/Call ratios and sentiment analysis | ~25K | Medium |
| [IV_COMPARATOR.md](./IV_COMPARATOR.md) | Binance vs Deribit IV comparison, Retail Panic Index | ~28K | Medium |

**Total Calculator Documentation:** ~158K

---

## 📦 **Components**

### Data Collection

| Document | Description | Size |
|----------|-------------|------|
| [COLLECTORS.md](./COLLECTORS.md) | All data collectors (Spot, OI, Liquidation, OrderBook, Volume, DataCollector) | ~40K |

**Collectors Covered:**
- SpotPriceCollector
- OpenInterestCollector
- VolumeCollector
- LiquidationTracker
- OrderBookAnalyzer
- DataCollector (Orchestrator)

### Business Logic

| Document | Description | Size |
|----------|-------------|------|
| [SERVICES.md](./SERVICES.md) | Service layer architecture and all 19 services | ~25K |

**Services Covered:**
- Core Services (13): Options, Metrics, Sentiment, Volatility, Liquidation, Orderbook, Entropy, Escape, History, Strategy, MarketAnalysis, IVComparison, TradingBot
- Database Services (6): DataPersistence, DataRetention, GEXSnapshot, DEXSnapshot, DVOL, PositionCalculator

### Database & Bot System

| Document | Description | Size |
|----------|-------------|------|
| [DATABASE.md](./DATABASE.md) | Database schema, models, trading bot system | ~35K |

**Database Models Covered:**
- Market Data: GEXSnapshot, MarketSnapshot, OptionsHistory, AnomaliesLog
- Trading Bot: BotConfig, BotSignal, BotTrade, BotPerformance
- Reference: Asset

**Bot System Covered:**
- BotManager
- SignalEngine
- ExecutionEngine
- PositionMonitor

---

## 🎯 **By Use Case**

### For Developers

**Getting Started:**
1. [README.md](../README.md) - Project overview
2. [PROJECT_MAP.md](../PROJECT_MAP.md) - File structure
3. [ARCHITECTURE.md](./ARCHITECTURE.md) - System design

**Building Features:**
1. [COLLECTORS.md](./COLLECTORS.md) - Data collection
2. [SERVICES.md](./SERVICES.md) - Business logic
3. [API_REFERENCE.md](./API_REFERENCE.md) - API endpoints

**Understanding Calculations:**
1. [GEX_CALCULATOR.md](./GEX_CALCULATOR.md) - Core GEX logic
2. [REGIME_ANALYZER.md](./REGIME_ANALYZER.md) - Market regimes
3. [SENTIMENT_ANALYZER.md](./SENTIMENT_ANALYZER.md) - Sentiment analysis

---

### For Traders

**Understanding Metrics:**
1. [GEX_CALCULATOR.md](./GEX_CALCULATOR.md) - What is GEX? How to use it?
2. [MAX_PAIN_CALCULATOR.md](./MAX_PAIN_CALCULATOR.md) - What is Max Pain?
3. [REGIME_ANALYZER.md](./REGIME_ANALYZER.md) - 4 market regimes explained

**Trading Strategies:**
1. [GEX_CALCULATOR.md](./GEX_CALCULATOR.md) - 6 GEX-based strategies
2. [RSI_CALCULATOR.md](./RSI_CALCULATOR.md) - 5 RSI strategies
3. [SENTIMENT_ANALYZER.md](./SENTIMENT_ANALYZER.md) - 4 sentiment strategies

**Advanced Analysis:**
1. [IV_COMPARATOR.md](./IV_COMPARATOR.md) - Retail vs Institutional IV
2. [ESCAPE_SYSTEM.md](./escape_system.md) - Escape type detection (H1/H2/H3)

---

### For Investors

**Project Overview:**
1. [README.md](../README.md) - What is Gamma Tracker?
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
3. [DATABASE.md](./DATABASE.md) - Trading bot system

**Technical Depth:**
1. [GEX_CALCULATOR.md](./GEX_CALCULATOR.md) - Core algorithm
2. [COLLECTORS.md](./COLLECTORS.md) - Data infrastructure
3. [SERVICES.md](./SERVICES.md) - Business logic

---

## 📊 **Documentation Statistics**

### By Category

| Category | Documents | Total Size | Avg Size |
|----------|-----------|------------|----------|
| **Architecture** | 2 | ~45K | ~22K |
| **Calculators** | 6 | ~158K | ~26K |
| **Components** | 3 | ~100K | ~33K |
| **API** | 1 | ~25K | ~25K |
| **Total** | **12** | **~328K** | **~27K** |

### By Complexity

| Complexity | Documents | Examples |
|------------|-----------|----------|
| **High** | 2 | GEX Calculator, Collectors |
| **Medium** | 7 | RSI, Regime, Sentiment, IV, Services, Database |
| **Low** | 3 | Max Pain, API Reference, Architecture |

### By Audience

| Audience | Recommended Docs | Count |
|----------|------------------|-------|
| **Developers** | All | 12 |
| **Traders** | Calculators, Escape System | 7 |
| **Investors** | Architecture, README, GEX | 4 |
| **Architects** | Architecture, Collectors, Services | 4 |

---

## 🔍 **Search by Topic**

### Gamma Exposure (GEX)

- [GEX_CALCULATOR.md](./GEX_CALCULATOR.md) - Complete GEX documentation
- [REGIME_ANALYZER.md](./REGIME_ANALYZER.md) - GEX-based regime classification
- [DATABASE.md](./DATABASE.md) - GEX snapshot storage

### Options Data

- [COLLECTORS.md](./COLLECTORS.md) - Options data collection
- [SERVICES.md](./SERVICES.md) - OptionsService
- [API_REFERENCE.md](./API_REFERENCE.md) - `/api/options` endpoints

### Market Sentiment

- [SENTIMENT_ANALYZER.md](./SENTIMENT_ANALYZER.md) - Complete sentiment analysis
- [IV_COMPARATOR.md](./IV_COMPARATOR.md) - Retail vs Institutional sentiment
- [API_REFERENCE.md](./API_REFERENCE.md) - `/api/sentiment` endpoints

### Volatility

- [IV_COMPARATOR.md](./IV_COMPARATOR.md) - IV comparison and Retail Panic Index
- [SERVICES.md](./SERVICES.md) - VolatilityService
- [API_REFERENCE.md](./API_REFERENCE.md) - `/api/volatility` endpoints

### Liquidations

- [COLLECTORS.md](./COLLECTORS.md) - LiquidationTracker
- [SERVICES.md](./SERVICES.md) - LiquidationService
- [API_REFERENCE.md](./API_REFERENCE.md) - `/api/liquidations` endpoints

### Order Book

- [COLLECTORS.md](./COLLECTORS.md) - OrderBookAnalyzer
- [SERVICES.md](./SERVICES.md) - OrderbookService
- [API_REFERENCE.md](./API_REFERENCE.md) - `/api/orderbook` endpoints

### Trading Bot

- [DATABASE.md](./DATABASE.md) - Complete bot system documentation
- [SERVICES.md](./SERVICES.md) - TradingBotService
- [API_REFERENCE.md](./API_REFERENCE.md) - `/api/bot` endpoints

### Escape System

- [ESCAPE_SYSTEM.md](./escape_system.md) - H1/H2/H3 escape types
- [SERVICES.md](./SERVICES.md) - EscapeService
- [API_REFERENCE.md](./API_REFERENCE.md) - `/api/escape` endpoints

---

## 📝 **Document Templates**

### Calculator Documentation Template

```markdown
# Calculator Name Documentation

## Overview
## What is [Metric]?
## Algorithm
## Implementation
## API Methods
## Usage Examples
## Trading Strategies
## Interpretation Guidelines
## Limitations & Caveats
## Performance Considerations
## API Integration
## Related Components
## References
```

### Component Documentation Template

```markdown
# Component Name Documentation

## Overview
## Purpose
## Features
## Configuration
## API Methods
## Events
## Usage Examples
## Integration
## Performance
## Best Practices
## Related Components
```

---

## 🔗 **External Resources**

### Binance Documentation

- [Options API](https://binance-docs.github.io/apidocs/voptions/en/)
- [Futures API](https://binance-docs.github.io/apidocs/futures/en/)
- [Spot API](https://binance-docs.github.io/apidocs/spot/en/)
- [WebSocket Streams](https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams)

### Deribit Documentation

- [Options API](https://docs.deribit.com/)
- [Market Data](https://docs.deribit.com/#market-data)

### Academic References

- "Options, Futures, and Other Derivatives" by John Hull
- "Dynamic Hedging" by Nassim Taleb
- "Volatility Trading" by Euan Sinclair

---

## 🛠️ **Maintenance**

### Documentation Standards

**Format:** Markdown (GitHub-flavored)

**Structure:**
1. Overview
2. Detailed sections
3. Examples
4. References

**Style:**
- Use tables for structured data
- Use code blocks for examples
- Use headings for navigation
- Include cross-references

### Update Frequency

| Document Type | Update Frequency |
|---------------|------------------|
| **API Reference** | On API changes |
| **Calculators** | On algorithm changes |
| **Components** | On architecture changes |
| **Architecture** | On major refactors |

### Version History

| Version | Date | Changes |
|---------|------|---------|
| **1.0.0** | 2026-01-15 | Initial comprehensive documentation |

---

## 📧 **Support**

For questions or issues:
- Check relevant documentation first
- Review code in `backend/src/`
- Contact: Valter Russo / Gamma Tracker Team

---

## 📄 **License**

Documentation is part of the Gamma Tracker project.

---

**Last Updated:** January 15, 2026  
**Version:** 1.0.0  
**Author:** Valter Russo / Gamma Tracker Team
