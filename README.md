# 🎯 Gamma Tracker

> **Institutional-grade options market analysis platform with real-time market microstructure analytics and automated trading**

[![Status](https://img.shields.io/badge/status-production-success)](https://github.com)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Documentation](https://img.shields.io/badge/docs-complete-orange)](./docs/)

**Gamma Tracker** is a professional-grade cryptocurrency options analysis platform that provides SpotGamma-style market microstructure analytics, real-time gamma exposure tracking, Shannon entropy analysis, and automated multi-bot trading capabilities for Binance Options.

---

## ✨ Key Features

### 📊 **12 Advanced Market Indicators**

| Indicator | Description | Status |
|-----------|-------------|--------|
| **Gamma Exposure (GEX)** | Real-time gamma walls, flip points, and dealer positioning | ✅ Production |
| **Escape Detector** | Breakout pattern recognition using Half Pipe Model | ✅ Production |
| **Shannon Entropy** | Order book chaos measurement and market regime detection | ✅ Production |
| **Iceberg Orders** | Hidden institutional order flow detection | ✅ Production |
| **Liquidation Tracker** | Real-time liquidation cascades and market stress | ✅ Production |
| **Order Book Analysis** | Bid/Ask imbalance, depth, and pressure metrics | ✅ Production |
| **Volatility Anomalies** | Statistical outlier detection in IV surface | ✅ Production |
| **DVOL Index** | 30-day implied volatility (similar to VIX) | ✅ Production |
| **Max Pain** | Options max pain calculation and tracking | ✅ Production |
| **IV Surface 3D** | Complete implied volatility surface visualization | ✅ Production |
| **Volatility Skew** | Put/Call IV spread analysis across strikes | ✅ Production |
| **Market Regime** | Automated regime classification (trending, ranging, volatile) | ✅ Production |

### 🤖 **Multi-Bot Trading System**

- **Independent Bot Configs** - Each bot runs with isolated configuration
- **Position Isolation** - Trades separated by botId for clean P&L tracking
- **Real-time P&L** - Live position monitoring with Greeks tracking
- **Automatic Entry** - Signal-based entry with IV Rank, volume, and regime filters
- **Automatic Exit** - Stop loss, profit target, DTE, and delta-based exits
- **Strategy Support** - Iron Condor, Iron Butterfly (more coming soon)
- **Database Persistence** - All trades, signals, and performance metrics saved

### 📈 **Real-time Data Collection**

- **Hybrid WebSocket + REST** - Optimized to avoid API rate limits
- **Mark Price Stream** - Real-time option pricing
- **Ticker Stream** - Volume, bid/ask, and Greeks updates
- **Spot Price Tracking** - Underlying asset price monitoring
- **Open Interest** - OI tracking across all strikes and expirations
- **Liquidation Events** - Real-time liquidation detection and analysis

### 🎯 **Strategy Recommendation**

- **AI-Powered Selection** - Automated strategy recommendation based on market state
- **10+ Strategies** - Iron Condor, Iron Butterfly, Straddle, Strangle, Spreads, and more
- **Market State Analysis** - Regime, volatility, and trend classification
- **Risk-Adjusted** - Recommendations consider IV Rank, liquidity, and market conditions

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                    (React + TypeScript)                     │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Dashboard  │  │   Charts    │  │   Trading   │       │
│  │  • GEX      │  │  • Entropy  │  │  • Bots     │       │
│  │  • Escape   │  │  • IV Surf  │  │  • Signals  │       │
│  │  • Liqs     │  │  • Heatmaps │  │  • P&L      │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ REST API (20+ endpoints)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (Node.js + Express)               │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  COLLECTORS  │  │ CALCULATORS  │  │   SERVICES   │    │
│  │              │  │              │  │              │    │
│  │ • Data       │  │ • GEX        │  │ • Options    │    │
│  │ • Spot       │  │ • Entropy    │  │ • Trading Bot│    │
│  │ • OI         │  │ • Escape     │  │ • Liquidation│    │
│  │ • Volume     │  │ • Iceberg    │  │ • Orderbook  │    │
│  │ • Liquidation│  │ • Anomaly    │  │ • Volatility │    │
│  │ • OrderBook  │  │ • MaxPain    │  │ • Strategy   │    │
│  │              │  │ • Regime     │  │ • Metrics    │    │
│  │              │  │ • Sentiment  │  │              │    │
│  │              │  │ • IV Compare │  │              │    │
│  │              │  │ • VolSurface │  │              │    │
│  │              │  │ • RSI        │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           TRADING BOT SYSTEM                         │  │
│  │                                                      │  │
│  │  SignalEngine → ExecutionEngine → PositionMonitor  │  │
│  │       ↓               ↓                  ↓          │  │
│  │   Analyze         Execute            Monitor        │  │
│  │   Market          Trades             P&L            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
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

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 16.0.0
- **MySQL** >= 8.0
- **npm** or **yarn**

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/gamma-tracker.git
cd gamma-tracker

# Install backend dependencies
cd backend
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your database credentials and API keys

# Setup database
mysql -u root -p < SQL/setup.sql

# Start backend
npm start
```

### Frontend Setup

```bash
# Install frontend dependencies
cd frontend
npm install

# Start development server
npm run dev
```

### Verify Installation

```bash
# Check backend health
curl http://localhost:3300/api/system/health

# Check options data
curl http://localhost:3300/api/options

# Check GEX data
curl http://localhost:3300/api/gex-heatmap
```

---

## 📚 Documentation

### Core Documentation

- **[PROJECT_MAP.md](./PROJECT_MAP.md)** - Complete project overview and component inventory
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System architecture and design patterns *(coming soon)*
- **[API_REFERENCE.md](./docs/API_REFERENCE.md)** - Complete API documentation *(coming soon)*
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Deployment and production setup *(coming soon)*

### Feature Documentation

- **[Escape System](./docs/ESCAPE_SYSTEM_VISUAL_GUIDE.md)** - Half Pipe Model and breakout detection
- **[Strategy Recommender](./docs/STRATEGY_RECOMMENDER_JOURNEY.md)** - AI-powered strategy selection
- **[Liquidation Tracker](./docs/LIQUIDATION_TRACKER_INTEGRATION.md)** - Liquidation cascade detection
- **[Volatility Anomalies](./docs/Volatility%20Surface%20Anomaly%20Detection%20System.md)** - IV outlier detection
- **[Trading Bot](./MULTI_BOT_REFACTORING_SUMMARY.md)** - Multi-bot trading system
- **[Database Setup](./docs/📊%20Gamma%20Tracker%20-%20Database%20Setup%20Guide.md)** - Database configuration

### Calculator Documentation *(coming soon)*

- **[GEX Calculator](./docs/calculators/GEX.md)** - Gamma exposure calculation
- **[Shannon Entropy](./docs/calculators/ENTROPY.md)** - Order book entropy analysis
- **[Iceberg Detector](./docs/calculators/ICEBERG.md)** - Hidden order detection
- **[Order Book Analyzer](./docs/calculators/ORDERBOOK.md)** - Bid/Ask analysis

---

## 🛠️ Tech Stack

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | >= 16.0.0 | Runtime |
| **Express** | 5.2.1 | Web framework |
| **MySQL** | 8.0+ | Database |
| **Sequelize** | 6.37.7 | ORM |
| **WebSocket (ws)** | 8.18.3 | Real-time data |
| **Axios** | 1.13.2 | HTTP client |
| **@binance/connector** | 3.6.1 | Binance API SDK |

### Frontend

| Technology | Purpose |
|------------|---------|
| **React** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool |
| **Chart.js / Recharts** | Data visualization |

---

## 📊 Project Statistics

| Metric | Value |
|--------|-------|
| **Total Lines of Code** | ~18,236 |
| **Components** | 68+ |
| **API Endpoints** | 20+ |
| **Calculators** | 15 |
| **Data Collectors** | 6 |
| **Services** | 12+ |
| **Database Models** | 9 |
| **Documentation Files** | 19 |
| **Supported Strategies** | 2 (more coming) |
| **Market Indicators** | 12 |

---

## 🎯 Use Cases

### For Traders

- **Options Flow Analysis** - Track institutional order flow via iceberg detection
- **Gamma Positioning** - Understand dealer hedging and price magnets
- **Breakout Timing** - Use escape detector for entry/exit timing
- **Volatility Trading** - Identify IV anomalies and mispricings
- **Automated Trading** - Deploy multi-bot strategies with risk management

### For Quants

- **Market Microstructure** - Deep order book and liquidation analysis
- **Entropy Measurement** - Quantify market chaos and regime changes
- **Statistical Arbitrage** - Detect volatility surface anomalies
- **Backtesting** - Historical data for strategy development
- **Risk Management** - Real-time Greeks and P&L tracking

### For Developers

- **REST API** - 20+ endpoints for market data and analytics
- **WebSocket Streams** - Real-time data feeds
- **Modular Architecture** - Easy to extend and customize
- **Database Access** - Historical data for analysis
- **Open Source** - Fully customizable codebase

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) *(coming soon)* for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- **Backend:** CommonJS, ESLint
- **Frontend:** TypeScript, Prettier
- **Commits:** Conventional Commits

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 👥 Authors

- **Valter Russo** - *Creator & Lead Developer* - [@ValterRusso](https://github.com/ValterRusso)

---

## 🙏 Acknowledgments

- **SpotGamma** - Inspiration for gamma exposure analysis
- **Binance** - Options data and API
- **Deribit** - DVOL index data
- **Options Trading Community** - Feedback and feature requests

---

## 📞 Support

- **Documentation:** [docs/](./docs/)
- **Issues:** [GitHub Issues](https://github.com/yourusername/gamma-tracker/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/gamma-tracker/discussions)
- **Email:** support@gammatracker.com *(if applicable)*

---

## 🗺️ Roadmap

### ✅ Completed

- [x] Real-time options data collection
- [x] GEX calculation and visualization
- [x] Escape detection (Half Pipe Model)
- [x] Shannon entropy analysis
- [x] Iceberg order detection
- [x] Liquidation tracking
- [x] Multi-bot trading system
- [x] Iron Condor & Iron Butterfly strategies
- [x] Strategy recommender
- [x] Volatility anomaly detection
- [x] DVOL index integration

### 🚧 In Progress

- [ ] Complete documentation (calculators, API reference)
- [ ] Trading bot optimization (entry/exit rules)
- [ ] Performance analytics dashboard
- [ ] Backtesting framework

### 📅 Planned

- [ ] More trading strategies (Straddle, Strangle, Spreads)
- [ ] Machine learning signal generation
- [ ] Portfolio management & risk limits
- [ ] Mobile app (React Native)
- [ ] Multi-exchange support (Deribit, OKX)
- [ ] On-chain data integration
- [ ] Social sentiment analysis
- [ ] Telegram/Discord bot integration

---

## ⚠️ Disclaimer

**This software is for educational and research purposes only. Trading cryptocurrency options involves substantial risk of loss. Past performance is not indicative of future results. Always do your own research and never risk more than you can afford to lose.**

**The authors and contributors are not responsible for any financial losses incurred through the use of this software.**

---

## 📈 Status

- **Version:** 3.0
- **Status:** 🟢 Production Ready
- **Last Updated:** 2026-01-15
- **Maintainer:** Active

---

<div align="center">

**⭐ Star this repo if you find it useful! ⭐**

**Made with ❤️ by the Gamma Tracker Team**

</div>
