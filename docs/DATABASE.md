# Database & Bot System Documentation

## Overview

The Gamma Tracker database layer provides **persistent storage** for historical market data, bot operations, and system logs. Built on **PostgreSQL** with **Sequelize ORM**, it enables time-series analysis, backtesting, and automated trading.

## Architecture

### Technology Stack

- **Database**: PostgreSQL 14+
- **ORM**: Sequelize 6+
- **Migrations**: Sequelize CLI
- **Connection Pool**: 20 connections max
- **Timezone**: UTC

### Database Structure

```
gamma_tracker_db
├── Market Data Tables
│   ├── gex_snapshots        (Time-series GEX data)
│   ├── market_snapshots     (Complete market state)
│   ├── options_history      (Historical options data)
│   └── anomalies_log        (Detected anomalies)
│
├── Trading Bot Tables
│   ├── bot_config           (Bot configuration)
│   ├── bot_signals          (Trading signals)
│   ├── bot_trades           (Executed trades)
│   └── bot_performance      (Performance metrics)
│
└── Reference Tables
    └── assets               (Supported assets)
```

---

## Database Models

### GEXSnapshot

**Purpose:** Stores time-series GEX data for heatmap visualization.

**Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `timestamp` | BIGINT | Unix timestamp (ms) |
| `strike` | DECIMAL(12,2) | Strike price |
| `totalGex` | DECIMAL(20,2) | Total GEX (calls + puts with sign) |
| `callGex` | DECIMAL(20,2) | Call GEX (positive) |
| `putGex` | DECIMAL(20,2) | Put GEX (negative) |
| `callOi` | INTEGER | Call open interest |
| `putOi` | INTEGER | Put open interest |
| `totalOi` | INTEGER | Total open interest |
| `callGamma` | DECIMAL(15,8) | Aggregate call gamma |
| `putGamma` | DECIMAL(15,8) | Aggregate put gamma |
| `spotPrice` | DECIMAL(12,2) | Spot price at snapshot |
| `assetSymbol` | STRING(20) | Asset symbol (default: 'BTCUSDT') |
| `created_at` | TIMESTAMP | Creation timestamp |

**Indexes:**
- `idx_timestamp` on `timestamp`
- `idx_strike` on `strike`
- `idx_timestamp_strike` on `(timestamp, strike)`
- `idx_asset_timestamp` on `(asset_symbol, timestamp)`

**Usage:**

```javascript
// Save GEX snapshot
await GEXSnapshot.create({
  timestamp: Date.now(),
  strike: 98000,
  totalGex: 200000000,
  callGex: 500000000,
  putGex: -300000000,
  callOi: 1500,
  putOi: 1200,
  totalOi: 2700,
  callGamma: 0.00015,
  putGamma: 0.00012,
  spotPrice: 98500,
  assetSymbol: 'BTCUSDT'
});

// Query GEX history
const snapshots = await GEXSnapshot.findAll({
  where: {
    timestamp: {
      [Op.gte]: Date.now() - 24 * 60 * 60 * 1000  // Last 24h
    },
    assetSymbol: 'BTCUSDT'
  },
  order: [['timestamp', 'ASC']]
});

// Get GEX heatmap data
const heatmap = await sequelize.query(`
  SELECT 
    strike,
    timestamp,
    total_gex
  FROM gex_snapshots
  WHERE asset_symbol = 'BTCUSDT'
    AND timestamp >= :startTime
    AND timestamp <= :endTime
  ORDER BY timestamp, strike
`, {
  replacements: { startTime, endTime },
  type: QueryTypes.SELECT
});
```

---

### MarketSnapshot

**Purpose:** Stores complete market state snapshots for comprehensive analysis.

**Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Primary key |
| `timestamp` | BIGINT | Unix timestamp (ms) |
| `spotPrice` | DECIMAL(12,2) | Spot price |
| `totalGex` | DECIMAL(20,2) | Total GEX |
| `gammaFlip` | DECIMAL(12,2) | Gamma flip level |
| `putWall` | DECIMAL(12,2) | Put wall strike |
| `callWall` | DECIMAL(12,2) | Call wall strike |
| `maxPain` | DECIMAL(12,2) | Max pain strike |
| `sentiment` | STRING(20) | Market sentiment (BULLISH/BEARISH/NEUTRAL) |
| `regime` | STRING(50) | Market regime |
| `atmIV` | DECIMAL(8,4) | ATM implied volatility |
| `putCallRatio` | DECIMAL(8,4) | Put/Call OI ratio |
| `liquidations24h` | INTEGER | Liquidations in last 24h |
| `orderBookImbalance` | DECIMAL(8,4) | Order book imbalance |
| `assetSymbol` | STRING(20) | Asset symbol |

**Usage:**

```javascript
// Save market snapshot
await MarketSnapshot.create({
  timestamp: Date.now(),
  spotPrice: 98500,
  totalGex: 200000000,
  gammaFlip: 95000,
  putWall: 93000,
  callWall: 100000,
  maxPain: 97000,
  sentiment: 'BULLISH',
  regime: 'POSITIVE_GAMMA_ABOVE_FLIP',
  atmIV: 65.5,
  putCallRatio: 0.85,
  liquidations24h: 156,
  orderBookImbalance: 0.15,
  assetSymbol: 'BTCUSDT'
});

// Get recent snapshots
const recent = await MarketSnapshot.findAll({
  where: {
    timestamp: {
      [Op.gte]: Date.now() - 3600000  // Last hour
    }
  },
  order: [['timestamp', 'DESC']],
  limit: 12
});
```

---

### OptionsHistory

**Purpose:** Historical options data for backtesting and analysis.

**Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Primary key |
| `timestamp` | BIGINT | Unix timestamp (ms) |
| `symbol` | STRING(50) | Option symbol |
| `strike` | DECIMAL(12,2) | Strike price |
| `expiry` | BIGINT | Expiry timestamp |
| `type` | STRING(10) | CALL or PUT |
| `markPrice` | DECIMAL(12,2) | Mark price |
| `delta` | DECIMAL(8,6) | Delta |
| `gamma` | DECIMAL(10,8) | Gamma |
| `vega` | DECIMAL(10,6) | Vega |
| `theta` | DECIMAL(10,6) | Theta |
| `impliedVolatility` | DECIMAL(8,4) | IV (%) |
| `openInterest` | INTEGER | Open interest |
| `volume24h` | DECIMAL(12,2) | 24h volume |
| `bidPrice` | DECIMAL(12,2) | Best bid |
| `askPrice` | DECIMAL(12,2) | Best ask |

**Usage:**

```javascript
// Save options data
await OptionsHistory.bulkCreate(optionsArray.map(opt => ({
  timestamp: Date.now(),
  symbol: opt.symbol,
  strike: opt.strike,
  expiry: opt.expiry,
  type: opt.type,
  markPrice: opt.markPrice,
  delta: opt.delta,
  gamma: opt.gamma,
  vega: opt.vega,
  theta: opt.theta,
  impliedVolatility: opt.impliedVolatility,
  openInterest: opt.openInterest,
  volume24h: opt.volume24h,
  bidPrice: opt.bidPrice,
  askPrice: opt.askPrice
})));

// Query historical IV
const ivHistory = await OptionsHistory.findAll({
  attributes: [
    'timestamp',
    [sequelize.fn('AVG', sequelize.col('implied_volatility')), 'avgIV']
  ],
  where: {
    strike: 98000,
    type: 'CALL',
    timestamp: {
      [Op.gte]: Date.now() - 7 * 24 * 60 * 60 * 1000  // Last 7 days
    }
  },
  group: ['timestamp'],
  order: [['timestamp', 'ASC']]
});
```

---

### AnomaliesLog

**Purpose:** Logs detected market anomalies for analysis.

**Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Primary key |
| `timestamp` | BIGINT | Unix timestamp (ms) |
| `type` | STRING(50) | Anomaly type |
| `severity` | STRING(20) | LOW/MEDIUM/HIGH/CRITICAL |
| `description` | TEXT | Detailed description |
| `metrics` | JSON | Related metrics |
| `resolved` | BOOLEAN | Resolution status |
| `resolvedAt` | BIGINT | Resolution timestamp |

**Anomaly Types:**
- `LIQUIDATION_CASCADE`
- `GEX_FLIP`
- `EXTREME_IMBALANCE`
- `IV_SPIKE`
- `VOLUME_ANOMALY`
- `PRICE_DIVERGENCE`

**Usage:**

```javascript
// Log anomaly
await AnomaliesLog.create({
  timestamp: Date.now(),
  type: 'LIQUIDATION_CASCADE',
  severity: 'HIGH',
  description: '15 liquidations in 5 seconds, total volume 45.2 BTC',
  metrics: {
    count: 15,
    volume: 45.2,
    duration: 5000,
    avgPrice: 98000
  },
  resolved: false
});

// Get unresolved anomalies
const unresolved = await AnomaliesLog.findAll({
  where: {
    resolved: false,
    severity: {
      [Op.in]: ['HIGH', 'CRITICAL']
    }
  },
  order: [['timestamp', 'DESC']]
});

// Resolve anomaly
await anomaly.update({
  resolved: true,
  resolvedAt: Date.now()
});
```

---

## Trading Bot Models

### BotConfig

**Purpose:** Stores bot configuration and parameters.

**Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | STRING(100) | Bot name |
| `strategy` | STRING(50) | Strategy type |
| `enabled` | BOOLEAN | Bot enabled status |
| `assetSymbol` | STRING(20) | Trading asset |
| `maxPositions` | INTEGER | Max concurrent positions |
| `maxRiskPerTrade` | DECIMAL(8,4) | Max risk per trade (%) |
| `stopLoss` | DECIMAL(8,4) | Stop loss (%) |
| `takeProfit` | DECIMAL(8,4) | Take profit (%) |
| `parameters` | JSON | Strategy-specific parameters |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

**Strategy Types:**
- `RANGE_TRADING`
- `TREND_FOLLOWING`
- `MEAN_REVERSION`
- `GAMMA_SCALPING`
- `VOLATILITY_ARBITRAGE`

**Usage:**

```javascript
// Create bot config
await BotConfig.create({
  name: 'GEX Range Bot',
  strategy: 'RANGE_TRADING',
  enabled: true,
  assetSymbol: 'BTCUSDT',
  maxPositions: 3,
  maxRiskPerTrade: 2.0,  // 2%
  stopLoss: 5.0,         // 5%
  takeProfit: 10.0,      // 10%
  parameters: {
    gammaFlipRange: 0.02,  // 2% range around gamma flip
    minGEX: 100000000,     // $100M minimum GEX
    entryConditions: {
      regime: 'POSITIVE_GAMMA_ABOVE_FLIP',
      imbalance: { min: -0.1, max: 0.1 }
    }
  }
});

// Get active bots
const activeBots = await BotConfig.findAll({
  where: { enabled: true }
});
```

---

### BotSignal

**Purpose:** Stores trading signals generated by bot.

**Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Primary key |
| `botConfigId` | INTEGER | Foreign key to BotConfig |
| `timestamp` | BIGINT | Signal timestamp |
| `signalType` | STRING(20) | BUY/SELL/CLOSE |
| `symbol` | STRING(50) | Option symbol |
| `strike` | DECIMAL(12,2) | Strike price |
| `type` | STRING(10) | CALL/PUT |
| `confidence` | DECIMAL(8,4) | Signal confidence (0-1) |
| `reasoning` | TEXT | Signal reasoning |
| `metrics` | JSON | Market metrics at signal time |
| `executed` | BOOLEAN | Execution status |
| `executedAt` | BIGINT | Execution timestamp |

**Usage:**

```javascript
// Generate signal
await BotSignal.create({
  botConfigId: 1,
  timestamp: Date.now(),
  signalType: 'BUY',
  symbol: 'BTC-250115-98000-C',
  strike: 98000,
  type: 'CALL',
  confidence: 0.85,
  reasoning: 'Price near gamma flip, positive regime, low imbalance',
  metrics: {
    spotPrice: 98500,
    gammaFlip: 95000,
    totalGEX: 200000000,
    regime: 'POSITIVE_GAMMA_ABOVE_FLIP',
    imbalance: 0.05
  },
  executed: false
});

// Get pending signals
const pending = await BotSignal.findAll({
  where: {
    executed: false,
    confidence: {
      [Op.gte]: 0.7  // Min confidence 70%
    }
  },
  order: [['confidence', 'DESC']]
});
```

---

### BotTrade

**Purpose:** Records executed trades.

**Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Primary key |
| `botConfigId` | INTEGER | Foreign key to BotConfig |
| `signalId` | INTEGER | Foreign key to BotSignal |
| `timestamp` | BIGINT | Trade timestamp |
| `side` | STRING(10) | BUY/SELL |
| `symbol` | STRING(50) | Option symbol |
| `strike` | DECIMAL(12,2) | Strike price |
| `type` | STRING(10) | CALL/PUT |
| `quantity` | DECIMAL(12,6) | Trade quantity |
| `entryPrice` | DECIMAL(12,2) | Entry price |
| `exitPrice` | DECIMAL(12,2) | Exit price (if closed) |
| `pnl` | DECIMAL(12,2) | Profit/Loss |
| `pnlPercent` | DECIMAL(8,4) | P&L percentage |
| `fees` | DECIMAL(12,2) | Trading fees |
| `status` | STRING(20) | OPEN/CLOSED/STOPPED |
| `closedAt` | BIGINT | Close timestamp |
| `closeReason` | STRING(50) | Close reason |

**Usage:**

```javascript
// Record trade
const trade = await BotTrade.create({
  botConfigId: 1,
  signalId: 123,
  timestamp: Date.now(),
  side: 'BUY',
  symbol: 'BTC-250115-98000-C',
  strike: 98000,
  type: 'CALL',
  quantity: 0.5,
  entryPrice: 1500,
  fees: 1.5,
  status: 'OPEN'
});

// Close trade
await trade.update({
  exitPrice: 1650,
  pnl: (1650 - 1500) * 0.5 - 1.5,  // 73.5
  pnlPercent: ((1650 - 1500) / 1500) * 100,  // 10%
  status: 'CLOSED',
  closedAt: Date.now(),
  closeReason: 'TAKE_PROFIT'
});

// Get bot performance
const trades = await BotTrade.findAll({
  where: {
    botConfigId: 1,
    status: 'CLOSED'
  }
});

const totalPnL = trades.reduce((sum, t) => sum + parseFloat(t.pnl), 0);
const winRate = trades.filter(t => t.pnl > 0).length / trades.length;
```

---

### BotPerformance

**Purpose:** Aggregated bot performance metrics.

**Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Primary key |
| `botConfigId` | INTEGER | Foreign key to BotConfig |
| `timestamp` | BIGINT | Snapshot timestamp |
| `totalTrades` | INTEGER | Total trades executed |
| `winningTrades` | INTEGER | Winning trades |
| `losingTrades` | INTEGER | Losing trades |
| `winRate` | DECIMAL(8,4) | Win rate (%) |
| `totalPnL` | DECIMAL(12,2) | Total P&L |
| `avgPnL` | DECIMAL(12,2) | Average P&L per trade |
| `maxDrawdown` | DECIMAL(12,2) | Max drawdown |
| `sharpeRatio` | DECIMAL(8,4) | Sharpe ratio |
| `profitFactor` | DECIMAL(8,4) | Profit factor |

**Usage:**

```javascript
// Calculate and save performance
const performance = await calculateBotPerformance(botConfigId);

await BotPerformance.create({
  botConfigId,
  timestamp: Date.now(),
  totalTrades: performance.totalTrades,
  winningTrades: performance.winningTrades,
  losingTrades: performance.losingTrades,
  winRate: performance.winRate,
  totalPnL: performance.totalPnL,
  avgPnL: performance.avgPnL,
  maxDrawdown: performance.maxDrawdown,
  sharpeRatio: performance.sharpeRatio,
  profitFactor: performance.profitFactor
});

// Get performance history
const history = await BotPerformance.findAll({
  where: {
    botConfigId: 1,
    timestamp: {
      [Op.gte]: Date.now() - 30 * 24 * 60 * 60 * 1000  // Last 30 days
    }
  },
  order: [['timestamp', 'ASC']]
});
```

---

### Asset

**Purpose:** Reference table for supported assets.

**Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Primary key |
| `symbol` | STRING(20) | Asset symbol (e.g., 'BTCUSDT') |
| `name` | STRING(100) | Asset name (e.g., 'Bitcoin') |
| `type` | STRING(20) | CRYPTO/STOCK/INDEX |
| `enabled` | BOOLEAN | Trading enabled |
| `minTradeSize` | DECIMAL(12,6) | Minimum trade size |
| `tickSize` | DECIMAL(12,6) | Tick size |

**Usage:**

```javascript
// Get enabled assets
const assets = await Asset.findAll({
  where: { enabled: true }
});
```

---

## Trading Bot System

### Architecture

```
┌─────────────────────────────────────┐
│         BotManager                  │  ← Orchestrates all bots
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│        SignalEngine                 │  ← Generates trading signals
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      ExecutionEngine                │  ← Executes trades
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      PositionMonitor                │  ← Monitors open positions
└─────────────────────────────────────┘
```

### Bot Components

#### BotManager

**Purpose:** Manages bot lifecycle and coordination.

**Responsibilities:**
- Start/stop bots
- Load bot configurations
- Coordinate signal generation and execution
- Monitor bot health

**Key Methods:**
```javascript
class BotManager {
  async start(botConfigId) { ... }
  async stop(botConfigId) { ... }
  async restart(botConfigId) { ... }
  async getStatus(botConfigId) { ... }
  async getAllBots() { ... }
}
```

---

#### SignalEngine

**Purpose:** Generates trading signals based on market conditions.

**Signal Generation Process:**

1. **Collect Market Data**
   - GEX metrics
   - Sentiment analysis
   - Volatility metrics
   - Order book imbalance
   - Liquidation data

2. **Apply Strategy Rules**
   - Check entry conditions
   - Calculate confidence score
   - Generate signal

3. **Validate Signal**
   - Check risk limits
   - Verify position limits
   - Confirm market conditions

4. **Save Signal**
   - Store in BotSignal table
   - Emit signal event

**Example Strategy (Range Trading):**

```javascript
class RangeTradingStrategy {
  generateSignal(marketData) {
    const { spotPrice, gammaFlip, totalGEX, regime, imbalance } = marketData;
    
    // Check regime
    if (regime !== 'POSITIVE_GAMMA_ABOVE_FLIP') {
      return null;  // Wrong regime
    }
    
    // Check if price is near gamma flip
    const distanceFromFlip = Math.abs(spotPrice - gammaFlip) / gammaFlip;
    
    if (distanceFromFlip > 0.02) {
      return null;  // Too far from gamma flip
    }
    
    // Check GEX magnitude
    if (Math.abs(totalGEX) < 100000000) {
      return null;  // GEX too small
    }
    
    // Check imbalance
    if (Math.abs(imbalance) > 0.1) {
      return null;  // Imbalance too high
    }
    
    // Generate BUY signal
    return {
      signalType: 'BUY',
      symbol: this.selectBestOption(marketData),
      confidence: this.calculateConfidence(marketData),
      reasoning: `Price near gamma flip (${distanceFromFlip.toFixed(4)}), positive regime, low imbalance`
    };
  }
  
  calculateConfidence(marketData) {
    // Confidence based on multiple factors
    let confidence = 0.5;  // Base confidence
    
    // Add confidence for strong GEX
    if (Math.abs(marketData.totalGEX) > 200000000) {
      confidence += 0.2;
    }
    
    // Add confidence for low imbalance
    if (Math.abs(marketData.imbalance) < 0.05) {
      confidence += 0.15;
    }
    
    // Add confidence for low volatility
    if (marketData.atmIV < 60) {
      confidence += 0.15;
    }
    
    return Math.min(confidence, 1.0);
  }
}
```

---

#### ExecutionEngine

**Purpose:** Executes trading signals.

**Execution Process:**

1. **Receive Signal**
   - From SignalEngine
   - From manual trigger

2. **Validate Execution**
   - Check account balance
   - Verify position limits
   - Confirm market liquidity

3. **Execute Trade**
   - Place order via exchange API
   - Handle order confirmation
   - Retry on failure

4. **Record Trade**
   - Save to BotTrade table
   - Update signal status
   - Emit trade event

**Example:**

```javascript
class ExecutionEngine {
  async executeSignal(signal) {
    try {
      // 1. Validate
      await this.validateExecution(signal);
      
      // 2. Calculate position size
      const quantity = this.calculatePositionSize(signal);
      
      // 3. Place order
      const order = await this.exchangeAPI.placeOrder({
        symbol: signal.symbol,
        side: signal.signalType,
        quantity,
        type: 'LIMIT',
        price: this.getBestPrice(signal)
      });
      
      // 4. Record trade
      const trade = await BotTrade.create({
        botConfigId: signal.botConfigId,
        signalId: signal.id,
        timestamp: Date.now(),
        side: signal.signalType,
        symbol: signal.symbol,
        strike: signal.strike,
        type: signal.type,
        quantity,
        entryPrice: order.price,
        fees: order.fees,
        status: 'OPEN'
      });
      
      // 5. Update signal
      await signal.update({
        executed: true,
        executedAt: Date.now()
      });
      
      return trade;
      
    } catch (error) {
      logger.error('Execution failed:', error);
      throw error;
    }
  }
  
  calculatePositionSize(signal) {
    const config = await BotConfig.findByPk(signal.botConfigId);
    const accountBalance = await this.getAccountBalance();
    
    // Risk-based position sizing
    const riskAmount = accountBalance * (config.maxRiskPerTrade / 100);
    const stopLossDistance = signal.entryPrice * (config.stopLoss / 100);
    
    const quantity = riskAmount / stopLossDistance;
    
    return Math.min(quantity, config.maxPositionSize);
  }
}
```

---

#### PositionMonitor

**Purpose:** Monitors open positions and manages exits.

**Monitoring Process:**

1. **Track Open Positions**
   - Query BotTrade for OPEN positions
   - Update current prices
   - Calculate P&L

2. **Check Exit Conditions**
   - Stop loss hit
   - Take profit hit
   - Time-based exit
   - Signal-based exit

3. **Execute Exit**
   - Place closing order
   - Update trade record
   - Calculate final P&L

4. **Update Performance**
   - Save to BotPerformance
   - Emit performance event

**Example:**

```javascript
class PositionMonitor {
  async monitorPositions() {
    const openTrades = await BotTrade.findAll({
      where: { status: 'OPEN' }
    });
    
    for (const trade of openTrades) {
      const config = await BotConfig.findByPk(trade.botConfigId);
      const currentPrice = await this.getCurrentPrice(trade.symbol);
      
      // Calculate P&L
      const pnl = (currentPrice - trade.entryPrice) * trade.quantity - trade.fees;
      const pnlPercent = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
      
      // Check stop loss
      if (pnlPercent <= -config.stopLoss) {
        await this.closePosition(trade, currentPrice, 'STOP_LOSS');
        continue;
      }
      
      // Check take profit
      if (pnlPercent >= config.takeProfit) {
        await this.closePosition(trade, currentPrice, 'TAKE_PROFIT');
        continue;
      }
      
      // Check time-based exit (e.g., close before expiry)
      const timeToExpiry = trade.expiry - Date.now();
      if (timeToExpiry < 3600000) {  // 1 hour before expiry
        await this.closePosition(trade, currentPrice, 'TIME_EXIT');
        continue;
      }
    }
  }
  
  async closePosition(trade, exitPrice, reason) {
    try {
      // 1. Place closing order
      await this.exchangeAPI.placeOrder({
        symbol: trade.symbol,
        side: trade.side === 'BUY' ? 'SELL' : 'BUY',
        quantity: trade.quantity,
        type: 'MARKET'
      });
      
      // 2. Update trade
      const pnl = (exitPrice - trade.entryPrice) * trade.quantity - trade.fees;
      const pnlPercent = ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
      
      await trade.update({
        exitPrice,
        pnl,
        pnlPercent,
        status: 'CLOSED',
        closedAt: Date.now(),
        closeReason: reason
      });
      
      logger.info(`Position closed: ${trade.symbol}, P&L: ${pnl.toFixed(2)}, Reason: ${reason}`);
      
    } catch (error) {
      logger.error('Failed to close position:', error);
    }
  }
}
```

---

## Database Operations

### Connection Management

```javascript
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000
    },
    timezone: '+00:00'  // UTC
  }
);

// Test connection
await sequelize.authenticate();
console.log('Database connected');
```

---

### Migrations

**Create migration:**

```bash
npx sequelize-cli migration:generate --name create-gex-snapshots
```

**Run migrations:**

```bash
npx sequelize-cli db:migrate
```

**Rollback:**

```bash
npx sequelize-cli db:migrate:undo
```

---

### Data Retention

**Automatic cleanup:**

```javascript
class DataRetentionService {
  async cleanOldData() {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;  // 90 days
    
    // Clean old GEX snapshots
    await GEXSnapshot.destroy({
      where: {
        timestamp: {
          [Op.lt]: cutoff
        }
      }
    });
    
    // Clean old options history
    await OptionsHistory.destroy({
      where: {
        timestamp: {
          [Op.lt]: cutoff
        }
      }
    });
    
    // Archive old trades
    await this.archiveTrades(cutoff);
    
    logger.info('Old data cleaned');
  }
  
  async archiveTrades(cutoff) {
    const oldTrades = await BotTrade.findAll({
      where: {
        timestamp: {
          [Op.lt]: cutoff
        },
        status: 'CLOSED'
      }
    });
    
    // Export to CSV or cold storage
    await this.exportToCSV(oldTrades, 'archived_trades.csv');
    
    // Delete from database
    await BotTrade.destroy({
      where: {
        id: {
          [Op.in]: oldTrades.map(t => t.id)
        }
      }
    });
  }
}
```

---

## Performance Optimization

### Indexing Strategy

1. **Time-based queries**: Index on `timestamp`
2. **Strike-based queries**: Index on `strike`
3. **Composite queries**: Index on `(timestamp, strike)` or `(asset_symbol, timestamp)`
4. **Foreign keys**: Index on all foreign keys

### Query Optimization

**Bad:**
```javascript
// N+1 query problem
const trades = await BotTrade.findAll();
for (const trade of trades) {
  const config = await BotConfig.findByPk(trade.botConfigId);
  // ...
}
```

**Good:**
```javascript
// Use eager loading
const trades = await BotTrade.findAll({
  include: [{ model: BotConfig }]
});
```

### Bulk Operations

**Bad:**
```javascript
for (const snapshot of snapshots) {
  await GEXSnapshot.create(snapshot);
}
```

**Good:**
```javascript
await GEXSnapshot.bulkCreate(snapshots);
```

---

## Backup & Recovery

### Backup Strategy

```bash
# Daily backup
pg_dump -h localhost -U postgres gamma_tracker_db > backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump -h localhost -U postgres gamma_tracker_db | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restore

```bash
psql -h localhost -U postgres gamma_tracker_db < backup_20260115.sql
```

---

## Related Components

- **DataCollector**: Provides data for persistence
- **Services**: Use database models for queries
- **API Routes**: Expose database data via REST
- **Calculators**: Generate metrics saved to database

---

## References

### Internal Documentation

- [COLLECTORS.md](./COLLECTORS.md)
- [SERVICES.md](./SERVICES.md)
- [API_REFERENCE.md](./API_REFERENCE.md)
- [PROJECT_MAP.md](../PROJECT_MAP.md)

### External Resources

- [Sequelize Documentation](https://sequelize.org/docs/v6/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## Changelog

### v1.0.0 (Current)
- Initial implementation
- 9 database models
- Trading bot system
- Data retention policies

### Planned Features

- [ ] Real-time database replication
- [ ] Time-series database (TimescaleDB)
- [ ] Advanced bot strategies
- [ ] Machine learning integration
- [ ] Multi-exchange support

---

## Support

For questions or issues:
- Check [PROJECT_MAP.md](../PROJECT_MAP.md)
- Review [SERVICES.md](./SERVICES.md)
- See code: `backend/src/database/`

---

**Last Updated:** January 15, 2026  
**Version:** 1.0.0  
**Author:** Valter Russo / Gamma Tracker Team
