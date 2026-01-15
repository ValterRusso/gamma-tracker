# Collectors Documentation

## Overview

The **Collectors** are specialized components responsible for gathering real-time and historical market data from various sources (Binance, Deribit, WebSocket streams, REST APIs). They form the **data ingestion layer** of the Gamma Tracker system.

## Architecture

### Data Flow

```
External APIs → Collectors → DataCollector (Orchestrator) → Calculators → API Routes → Frontend
```

### Collector Types

| Collector | Purpose | Source | Protocol | LOC |
|-----------|---------|--------|----------|-----|
| **SpotPriceCollector** | Spot price (BTC/ETH) | Binance Spot | WebSocket | 165 |
| **OpenInterestCollector** | Open Interest by expiry | Binance Options | REST | 173 |
| **VolumeCollector** | Trading volume | Binance Options | WebSocket/REST | 258 |
| **LiquidationTracker** | Liquidation events | Binance Futures | WebSocket | 487 |
| **OrderBookAnalyzer** | Order book metrics | Binance Futures | WebSocket | 729 |
| **DataCollector** | Orchestrator | All sources | Hybrid | 919 |

---

## SpotPriceCollector

### Purpose

Collects **real-time spot price** from Binance spot market via WebSocket.

### Features

- ✅ Real-time price updates
- ✅ Auto-reconnect on disconnect
- ✅ Price change tracking
- ✅ Event-driven architecture

### Configuration

```javascript
const spotCollector = new SpotPriceCollector({
  wsBaseUrl: 'wss://stream.binance.com:9443/ws',
  symbol: 'btcusdt',
  reconnectDelay: 5000  // ms
});
```

### API Methods

#### `start()`

Start collecting spot price.

```javascript
spotCollector.start();
```

#### `stop()`

Stop collecting.

```javascript
spotCollector.stop();
```

#### `getSpotPrice()`

Get current spot price.

```javascript
const price = spotCollector.getSpotPrice();
console.log('Spot Price:', price);
```

#### `isConnected()`

Check connection status.

```javascript
if (spotCollector.isConnected()) {
  console.log('Connected');
}
```

#### `getStats()`

Get statistics.

```javascript
const stats = spotCollector.getStats();
// {
//   symbol: 'BTCUSDT',
//   spotPrice: 98000,
//   connected: true,
//   lastUpdate: 1705334400000,
//   age: 123  // ms since last update
// }
```

### Events

#### `connected`

Emitted when WebSocket connects.

```javascript
spotCollector.on('connected', () => {
  console.log('Spot price collector connected');
});
```

#### `price-updated`

Emitted on every price update.

```javascript
spotCollector.on('price-updated', (data) => {
  console.log('Price:', data.price);
  console.log('Change:', data.change);
  console.log('Change %:', data.changePercent);
});
```

**Data structure:**
```javascript
{
  symbol: 'BTCUSDT',
  price: 98000,
  oldPrice: 97950,
  change: 50,
  changePercent: 0.051,
  timestamp: 1705334400000
}
```

#### `disconnected`

Emitted when WebSocket disconnects.

```javascript
spotCollector.on('disconnected', () => {
  console.log('Disconnected, will auto-reconnect');
});
```

#### `error`

Emitted on errors.

```javascript
spotCollector.on('error', (error) => {
  console.error('Error:', error);
});
```

### Usage Example

```javascript
const SpotPriceCollector = require('./collectors/SpotPriceCollector');

const collector = new SpotPriceCollector({
  symbol: 'btcusdt'
});

collector.on('connected', () => {
  console.log('✅ Connected to spot price stream');
});

collector.on('price-updated', (data) => {
  console.log(`Price: $${data.price.toFixed(2)} (${data.changePercent > 0 ? '+' : ''}${data.changePercent.toFixed(2)}%)`);
});

collector.start();
```

---

## OpenInterestCollector

### Purpose

Collects **Open Interest** for all options by expiry date via REST API.

### Features

- ✅ Fetches OI for multiple expiries
- ✅ Periodic updates (configurable interval)
- ✅ Caches OI data by symbol
- ✅ Detects OI changes

### Configuration

```javascript
const oiCollector = new OpenInterestCollector({
  restBaseUrl: 'https://eapi.binance.com',
  underlying: 'BTC',
  updateInterval: 60000  // 1 minute
});
```

### API Methods

#### `start(expiries)`

Start collecting OI for given expiries.

```javascript
const expiries = [1705334400000, 1706544000000]; // timestamps
await oiCollector.start(expiries);
```

#### `stop()`

Stop collecting.

```javascript
oiCollector.stop();
```

#### `getOI(symbol)`

Get OI for a specific symbol.

```javascript
const oi = oiCollector.getOI('BTC-250115-98000-C');
console.log('Open Interest:', oi);
```

#### `getAllOI()`

Get all OI data.

```javascript
const allOI = oiCollector.getAllOI();
// Map: symbol -> openInterest
```

#### `getStats()`

Get statistics.

```javascript
const stats = oiCollector.getStats();
// {
//   symbolsTracked: 150,
//   totalOI: 25000,
//   lastUpdate: 1705334400000,
//   updateCount: 42
// }
```

### Events

#### `updated`

Emitted after OI update.

```javascript
oiCollector.on('updated', (count) => {
  console.log(`OI updated for ${count} symbols`);
});
```

#### `error`

Emitted on errors.

```javascript
oiCollector.on('error', (error) => {
  console.error('OI collection error:', error);
});
```

### Usage Example

```javascript
const OpenInterestCollector = require('./collectors/OpenInterestCollector');

const collector = new OpenInterestCollector({
  underlying: 'BTC',
  updateInterval: 60000  // 1 minute
});

collector.on('updated', (count) => {
  console.log(`✅ OI updated for ${count} symbols`);
  
  const stats = collector.getStats();
  console.log(`Total OI: ${stats.totalOI} BTC`);
});

// Get expiries from options data
const expiries = [1705334400000, 1706544000000];
await collector.start(expiries);
```

---

## VolumeCollector

### Purpose

Collects **trading volume** for options from WebSocket and REST API.

### Features

- ✅ Real-time volume updates via WebSocket
- ✅ Fallback to REST polling
- ✅ Volume aggregation by symbol
- ✅ Volume change detection

### Configuration

```javascript
const volumeCollector = new VolumeCollector({
  wsBaseUrl: 'wss://nbstream.binance.com/eoptions/stream',
  restBaseUrl: 'https://eapi.binance.com',
  underlying: 'BTC',
  updateInterval: 30000  // 30 seconds
});
```

### API Methods

#### `start()`

Start collecting volume.

```javascript
await volumeCollector.start();
```

#### `stop()`

Stop collecting.

```javascript
volumeCollector.stop();
```

#### `getVolume(symbol)`

Get volume for a symbol.

```javascript
const volume = volumeCollector.getVolume('BTC-250115-98000-C');
console.log('Volume:', volume);
```

#### `getAllVolumes()`

Get all volumes.

```javascript
const volumes = volumeCollector.getAllVolumes();
// Map: symbol -> volume
```

#### `getTopVolumeSymbols(n)`

Get top N symbols by volume.

```javascript
const top10 = volumeCollector.getTopVolumeSymbols(10);
// [
//   { symbol: 'BTC-250115-98000-C', volume: 1234 },
//   { symbol: 'BTC-250115-96000-P', volume: 987 },
//   ...
// ]
```

### Events

#### `volume-updated`

Emitted on volume update.

```javascript
volumeCollector.on('volume-updated', (data) => {
  console.log(`${data.symbol}: ${data.volume} (${data.change > 0 ? '+' : ''}${data.change})`);
});
```

#### `high-volume-alert`

Emitted when volume exceeds threshold.

```javascript
volumeCollector.on('high-volume-alert', (data) => {
  console.log(`🚨 High volume: ${data.symbol} (${data.volume})`);
});
```

### Usage Example

```javascript
const VolumeCollector = require('./collectors/VolumeCollector');

const collector = new VolumeCollector({
  underlying: 'BTC'
});

collector.on('volume-updated', (data) => {
  if (data.change > 100) {
    console.log(`📈 Volume spike: ${data.symbol} (+${data.change})`);
  }
});

collector.on('high-volume-alert', (data) => {
  console.log(`🚨 HIGH VOLUME: ${data.symbol} (${data.volume})`);
});

await collector.start();
```

---

## LiquidationTracker

### Purpose

Tracks **liquidation events** on Binance Futures in real-time via WebSocket.

### Features

- ✅ Real-time liquidation tracking
- ✅ Liquidation cascade detection
- ✅ Volume and side analysis
- ✅ Historical liquidation storage

### Configuration

```javascript
const liquidationTracker = new LiquidationTracker(
  'btcusdt',  // symbol
  logger      // logger instance
);
```

### API Methods

#### `connect()`

Connect to liquidation stream.

```javascript
liquidationTracker.connect();
```

#### `disconnect()`

Disconnect from stream.

```javascript
liquidationTracker.disconnect();
```

#### `getRecentLiquidations(count)`

Get recent liquidations.

```javascript
const recent = liquidationTracker.getRecentLiquidations(10);
// [
//   {
//     symbol: 'BTCUSDT',
//     side: 'SELL',  // Liquidated long
//     price: 98000,
//     quantity: 1.5,
//     time: 1705334400000
//   },
//   ...
// ]
```

#### `getStats()`

Get liquidation statistics.

```javascript
const stats = liquidationTracker.getStats();
// {
//   totalLiquidations: 156,
//   totalVolume: 234.5,
//   longLiquidations: 89,
//   shortLiquidations: 67,
//   cascadeCount: 3,
//   lastLiquidation: 1705334400000
// }
```

#### `getCascadeHistory()`

Get cascade events.

```javascript
const cascades = liquidationTracker.getCascadeHistory();
// [
//   {
//     timestamp: 1705334400000,
//     count: 15,
//     volume: 45.2,
//     duration: 5000,  // ms
//     avgPrice: 98000
//   },
//   ...
// ]
```

### Events

#### `connected`

Emitted when connected.

```javascript
liquidationTracker.on('connected', () => {
  console.log('✅ Liquidation tracker connected');
});
```

#### `liquidation`

Emitted on each liquidation.

```javascript
liquidationTracker.on('liquidation', (liq) => {
  console.log(`💀 Liquidation: ${liq.side} ${liq.quantity} @ $${liq.price}`);
});
```

**Data structure:**
```javascript
{
  symbol: 'BTCUSDT',
  side: 'SELL',  // SELL = long liquidated, BUY = short liquidated
  price: 98000,
  quantity: 1.5,
  time: 1705334400000
}
```

#### `cascade`

Emitted when liquidation cascade detected.

```javascript
liquidationTracker.on('cascade', (stats) => {
  console.log('🚨 LIQUIDATION CASCADE!');
  console.log(`  Count: ${stats.count}`);
  console.log(`  Volume: ${stats.volume} BTC`);
  console.log(`  Duration: ${stats.duration}ms`);
});
```

**Cascade detection criteria:**
- 10+ liquidations within 5 seconds
- Total volume > 10 BTC

#### `error`

Emitted on errors.

```javascript
liquidationTracker.on('error', (error) => {
  console.error('Liquidation tracker error:', error);
});
```

### Usage Example

```javascript
const LiquidationTracker = require('./collectors/LiquidationTracker');
const Logger = require('./utils/logger');

const logger = new Logger('App');
const tracker = new LiquidationTracker('btcusdt', logger);

tracker.on('connected', () => {
  console.log('✅ Tracking liquidations...');
});

tracker.on('liquidation', (liq) => {
  const side = liq.side === 'SELL' ? 'LONG' : 'SHORT';
  console.log(`💀 ${side} liquidated: ${liq.quantity} BTC @ $${liq.price.toFixed(2)}`);
});

tracker.on('cascade', (stats) => {
  console.log('🚨 LIQUIDATION CASCADE DETECTED!');
  console.log(`  ${stats.count} liquidations in ${(stats.duration / 1000).toFixed(1)}s`);
  console.log(`  Total volume: ${stats.volume.toFixed(2)} BTC`);
  console.log(`  Avg price: $${stats.avgPrice.toFixed(2)}`);
});

tracker.connect();
```

---

## OrderBookAnalyzer

### Purpose

Analyzes **order book** from Binance Futures in real-time to detect imbalances, walls, and liquidity metrics.

### Features

- ✅ Real-time order book updates
- ✅ Bid/ask imbalance detection
- ✅ Order book wall detection
- ✅ Liquidity depth analysis
- ✅ Spread tracking

### Configuration

```javascript
const orderBookAnalyzer = new OrderBookAnalyzer(
  'btcusdt',  // symbol
  logger      // logger instance
);
```

### API Methods

#### `connect()`

Connect to order book stream.

```javascript
orderBookAnalyzer.connect();
```

#### `disconnect()`

Disconnect from stream.

```javascript
orderBookAnalyzer.disconnect();
```

#### `getMetrics()`

Get current order book metrics.

```javascript
const metrics = orderBookAnalyzer.getMetrics();
```

**Returns:**
```javascript
{
  // Imbalance
  imbalance: 0.15,  // Positive = more bids, negative = more asks
  imbalancePercent: 15,
  
  // Spread
  spread: 0.5,  // $
  spreadPercent: 0.0005,  // 0.05%
  
  // Liquidity
  bidLiquidity: 1234.5,  // BTC
  askLiquidity: 987.3,   // BTC
  totalLiquidity: 2221.8,
  
  // Walls
  bidWall: {
    price: 97500,
    size: 50.2,
    distance: -500,  // $ from mid
    distancePercent: -0.51
  },
  askWall: {
    price: 98500,
    size: 45.8,
    distance: 500,
    distancePercent: 0.51
  },
  
  // Depth
  depth: {
    bids: 150,  // Number of bid levels
    asks: 145   // Number of ask levels
  },
  
  timestamp: 1705334400000
}
```

#### `getOrderBook()`

Get raw order book.

```javascript
const orderBook = orderBookAnalyzer.getOrderBook();
// {
//   bids: [[98000, 1.5], [97999, 2.3], ...],
//   asks: [[98001, 1.2], [98002, 2.1], ...]
// }
```

#### `getStats()`

Get statistics.

```javascript
const stats = orderBookAnalyzer.getStats();
// {
//   updates: 1234,
//   avgImbalance: 0.05,
//   maxImbalance: 0.35,
//   wallsDetected: 12,
//   connected: true,
//   lastUpdate: 1705334400000
// }
```

### Events

#### `connected`

Emitted when connected.

```javascript
orderBookAnalyzer.on('connected', () => {
  console.log('✅ Order book analyzer connected');
});
```

#### `update`

Emitted on every order book update (throttled to 1s).

```javascript
orderBookAnalyzer.on('update', (metrics) => {
  console.log('Imbalance:', metrics.imbalancePercent.toFixed(1) + '%');
  console.log('Spread:', metrics.spreadPercent.toFixed(4) + '%');
});
```

#### `imbalance-alert`

Emitted when imbalance exceeds threshold (>20%).

```javascript
orderBookAnalyzer.on('imbalance-alert', (data) => {
  console.log(`🚨 IMBALANCE: ${data.imbalancePercent.toFixed(1)}%`);
  if (data.imbalance > 0) {
    console.log('→ More bids (bullish pressure)');
  } else {
    console.log('→ More asks (bearish pressure)');
  }
});
```

#### `wall-detected`

Emitted when order book wall detected.

```javascript
orderBookAnalyzer.on('wall-detected', (wall) => {
  console.log(`🧱 ${wall.side.toUpperCase()} WALL: ${wall.size} BTC @ $${wall.price}`);
  console.log(`   Distance: ${wall.distancePercent.toFixed(2)}%`);
});
```

**Wall detection criteria:**
- Size > 10 BTC
- Within 1% of mid price

#### `error`

Emitted on errors.

```javascript
orderBookAnalyzer.on('error', (error) => {
  console.error('Order book analyzer error:', error);
});
```

### Usage Example

```javascript
const OrderBookAnalyzer = require('./collectors/OrderBookAnalyzer');
const Logger = require('./utils/logger');

const logger = new Logger('App');
const analyzer = new OrderBookAnalyzer('btcusdt', logger);

analyzer.on('connected', () => {
  console.log('✅ Analyzing order book...');
});

analyzer.on('update', (metrics) => {
  console.log(`Imbalance: ${metrics.imbalancePercent.toFixed(1)}% | Spread: ${metrics.spreadPercent.toFixed(4)}%`);
});

analyzer.on('imbalance-alert', (data) => {
  console.log(`🚨 IMBALANCE ALERT: ${data.imbalancePercent.toFixed(1)}%`);
  if (data.imbalance > 0) {
    console.log('→ Bullish pressure (more bids)');
  } else {
    console.log('→ Bearish pressure (more asks)');
  }
});

analyzer.on('wall-detected', (wall) => {
  console.log(`🧱 ${wall.side.toUpperCase()} WALL DETECTED!`);
  console.log(`   Price: $${wall.price.toFixed(2)}`);
  console.log(`   Size: ${wall.size.toFixed(2)} BTC`);
  console.log(`   Distance: ${wall.distancePercent.toFixed(2)}%`);
});

analyzer.connect();
```

---

## DataCollector (Orchestrator)

### Purpose

**Central orchestrator** that coordinates all collectors and calculators. Manages data flow from external sources to internal components.

### Features

- ✅ Hybrid data collection (WebSocket + REST)
- ✅ Coordinates 6+ sub-collectors
- ✅ Integrates 3+ calculators
- ✅ Event-driven architecture
- ✅ Auto-reconnect and error handling
- ✅ Centralized state management

### Architecture

```
DataCollector (Orchestrator)
├── SpotPriceCollector (WebSocket)
├── OpenInterestCollector (REST)
├── VolumeCollector (WebSocket/REST)
├── LiquidationTracker (WebSocket)
├── OrderBookAnalyzer (WebSocket)
├── GEXCalculator
└── EscapeTypeDetector
```

### Data Sources

| Data Type | Source | Protocol | Update Frequency |
|-----------|--------|----------|------------------|
| **Mark Price** | Binance Options | WebSocket | Real-time |
| **Ticker** | Binance Options | WebSocket | Real-time |
| **Greeks** | Binance Options | REST | 5 seconds |
| **Spot Price** | Binance Spot | WebSocket | Real-time |
| **Open Interest** | Binance Options | REST | 1 minute |
| **Liquidations** | Binance Futures | WebSocket | Real-time |
| **Order Book** | Binance Futures | WebSocket | Real-time |
| **Trades** | Binance Options | WebSocket | Real-time |

### Configuration

```javascript
const dataCollector = new DataCollector({
  wsBaseUrl: 'wss://nbstream.binance.com/eoptions/stream',
  restBaseUrl: 'https://eapi.binance.com',
  underlying: 'BTC',
  greeksPollingInterval: 5000,  // 5 seconds
  reconnectDelay: 5000
});
```

### API Methods

#### `start()`

Start data collection.

```javascript
await dataCollector.start();
```

**Initialization sequence:**
1. Load exchange info (available options)
2. Fetch initial Greeks
3. Fetch initial ticker data
4. Start SpotPriceCollector
5. Connect Mark Price WebSocket
6. Connect Ticker WebSocket
7. Start Greeks polling (5s interval)
8. Start OpenInterestCollector
9. Start LiquidationTracker
10. Start OrderBookAnalyzer
11. Initialize GEXCalculator
12. Initialize EscapeTypeDetector

#### `stop()`

Stop data collection.

```javascript
dataCollector.stop();
```

#### `getOptions()`

Get all options data.

```javascript
const options = dataCollector.getOptions();
// Map: symbol -> Option
```

#### `getOption(symbol)`

Get specific option.

```javascript
const option = dataCollector.getOption('BTC-250115-98000-C');
```

#### `getSpotPrice()`

Get current spot price.

```javascript
const spotPrice = dataCollector.getSpotPrice();
console.log('Spot Price:', spotPrice);
```

#### `getGEXMetrics()`

Get GEX metrics.

```javascript
const gex = dataCollector.getGEXMetrics();
// {
//   totalGEX: { calls: 500M, puts: -300M, total: 200M },
//   gammaFlip: { level: 95000, confidence: 'HIGH' },
//   putWall: { strike: 93000, gex: -200M },
//   callWall: { strike: 100000, gex: 300M },
//   ...
// }
```

#### `getRecentTrades(count)`

Get recent trades.

```javascript
const trades = dataCollector.getRecentTrades(10);
// [
//   {
//     symbol: 'BTC-250115-98000-C',
//     price: 1500,
//     quantity: 0.5,
//     side: 'BUY',
//     timestamp: 1705334400000
//   },
//   ...
// ]
```

#### `getStats()`

Get comprehensive statistics.

```javascript
const stats = dataCollector.getStats();
// {
//   options: {
//     total: 150,
//     calls: 75,
//     puts: 75,
//     expiries: 5
//   },
//   collectors: {
//     spotPrice: { connected: true, price: 98000 },
//     openInterest: { symbolsTracked: 150, totalOI: 25000 },
//     liquidations: { totalLiquidations: 156, cascadeCount: 3 },
//     orderBook: { connected: true, imbalance: 0.15 }
//   },
//   calculators: {
//     gex: { totalGEX: 200000000, gammaFlip: 95000 },
//     escape: { lastDetection: 'H1', confidence: 0.85 }
//   }
// }
```

### Events

#### `ready`

Emitted when DataCollector is fully initialized.

```javascript
dataCollector.on('ready', () => {
  console.log('✅ DataCollector ready');
});
```

#### `spot-price-updated`

Emitted on spot price update.

```javascript
dataCollector.on('spot-price-updated', (data) => {
  console.log('Spot:', data.price);
});
```

#### `options-updated`

Emitted when options data updates.

```javascript
dataCollector.on('options-updated', (count) => {
  console.log(`Options updated: ${count}`);
});
```

#### `oi-updated`

Emitted when OI updates.

```javascript
dataCollector.on('oi-updated', (count) => {
  console.log(`OI updated for ${count} symbols`);
});
```

#### `liquidation`

Emitted on each liquidation.

```javascript
dataCollector.on('liquidation', (liq) => {
  console.log(`💀 Liquidation: ${liq.side} ${liq.quantity} @ $${liq.price}`);
});
```

#### `liquidation-cascade`

Emitted on liquidation cascade.

```javascript
dataCollector.on('liquidation-cascade', (stats) => {
  console.log('🚨 LIQUIDATION CASCADE!');
  console.log(`  Count: ${stats.count}`);
  console.log(`  Volume: ${stats.volume} BTC`);
});
```

#### `orderbook-analyzer-update`

Emitted on order book update.

```javascript
dataCollector.on('orderbook-analyzer-update', (metrics) => {
  console.log('Imbalance:', metrics.imbalancePercent.toFixed(1) + '%');
});
```

#### `gex-updated`

Emitted when GEX recalculates.

```javascript
dataCollector.on('gex-updated', (metrics) => {
  console.log('GEX:', (metrics.totalGEX.total / 1e9).toFixed(2) + 'B');
  console.log('Gamma Flip:', metrics.gammaFlip.level);
});
```

#### `escape-detected`

Emitted when escape type detected.

```javascript
dataCollector.on('escape-detected', (detection) => {
  console.log(`Escape: ${detection.type} (${(detection.confidence * 100).toFixed(0)}%)`);
});
```

### Usage Example

```javascript
const DataCollector = require('./collectors/DataCollector');

const dataCollector = new DataCollector({
  underlying: 'BTC',
  greeksPollingInterval: 5000
});

dataCollector.on('ready', () => {
  console.log('✅ DataCollector ready');
  
  const stats = dataCollector.getStats();
  console.log('Options tracked:', stats.options.total);
  console.log('Spot price:', stats.collectors.spotPrice.price);
});

dataCollector.on('spot-price-updated', (data) => {
  console.log(`Spot: $${data.price.toFixed(2)} (${data.changePercent > 0 ? '+' : ''}${data.changePercent.toFixed(2)}%)`);
});

dataCollector.on('liquidation-cascade', (stats) => {
  console.log('🚨 LIQUIDATION CASCADE!');
  console.log(`  ${stats.count} liquidations`);
  console.log(`  ${stats.volume.toFixed(2)} BTC`);
});

dataCollector.on('gex-updated', (metrics) => {
  console.log('=== GEX UPDATE ===');
  console.log('Total GEX:', (metrics.totalGEX.total / 1e9).toFixed(2) + 'B');
  console.log('Gamma Flip:', metrics.gammaFlip.level);
  console.log('Put Wall:', metrics.putWall.strike);
  console.log('Call Wall:', metrics.callWall.strike);
});

await dataCollector.start();
```

---

## Integration Example

### Complete System Setup

```javascript
const DataCollector = require('./collectors/DataCollector');
const Logger = require('./utils/logger');

const logger = new Logger('App');

// Initialize DataCollector (orchestrates everything)
const dataCollector = new DataCollector({
  underlying: 'BTC',
  greeksPollingInterval: 5000
});

// Listen for all events
dataCollector.on('ready', () => {
  logger.success('✅ System ready');
  
  const stats = dataCollector.getStats();
  logger.info('Options:', stats.options.total);
  logger.info('Spot Price:', stats.collectors.spotPrice.price);
  logger.info('Total OI:', stats.collectors.openInterest.totalOI);
});

dataCollector.on('spot-price-updated', (data) => {
  logger.info(`Spot: $${data.price.toFixed(2)}`);
});

dataCollector.on('liquidation', (liq) => {
  const side = liq.side === 'SELL' ? 'LONG' : 'SHORT';
  logger.warn(`💀 ${side} liquidated: ${liq.quantity} BTC @ $${liq.price.toFixed(2)}`);
});

dataCollector.on('liquidation-cascade', (stats) => {
  logger.error('🚨 LIQUIDATION CASCADE!');
  logger.error(`  ${stats.count} liquidations in ${(stats.duration / 1000).toFixed(1)}s`);
  logger.error(`  Total volume: ${stats.volume.toFixed(2)} BTC`);
});

dataCollector.on('orderbook-analyzer-update', (metrics) => {
  if (Math.abs(metrics.imbalancePercent) > 20) {
    logger.warn(`⚠️ Order book imbalance: ${metrics.imbalancePercent.toFixed(1)}%`);
  }
});

dataCollector.on('gex-updated', (metrics) => {
  logger.info('=== GEX UPDATE ===');
  logger.info(`Total GEX: $${(metrics.totalGEX.total / 1e9).toFixed(2)}B`);
  logger.info(`Gamma Flip: $${metrics.gammaFlip.level.toFixed(0)}`);
  logger.info(`Put Wall: $${metrics.putWall.strike.toFixed(0)}`);
  logger.info(`Call Wall: $${metrics.callWall.strike.toFixed(0)}`);
});

dataCollector.on('escape-detected', (detection) => {
  logger.info(`Escape: ${detection.type} (${(detection.confidence * 100).toFixed(0)}%)`);
  logger.info(`  ${detection.interpretation}`);
});

// Start the system
await dataCollector.start();
```

---

## Performance Considerations

### WebSocket vs REST

| Protocol | Latency | Bandwidth | Use Case |
|----------|---------|-----------|----------|
| **WebSocket** | < 100ms | Low | Real-time data (price, liquidations, order book) |
| **REST** | 200-500ms | Medium | Periodic data (Greeks, OI) |

### Update Frequencies

| Data Type | Frequency | Rationale |
|-----------|-----------|-----------|
| **Mark Price** | Real-time | Critical for GEX calculation |
| **Ticker** | Real-time | Volume/bid/ask changes frequently |
| **Greeks** | 5 seconds | Changes slowly, avoid rate limits |
| **OI** | 1 minute | Changes slowly |
| **Spot Price** | Real-time | Critical for all calculations |
| **Liquidations** | Real-time | Time-sensitive |
| **Order Book** | Real-time | High-frequency data |

### Memory Usage

| Collector | Memory | Notes |
|-----------|--------|-------|
| **SpotPriceCollector** | < 1MB | Minimal state |
| **OpenInterestCollector** | ~5MB | Caches OI for 150+ symbols |
| **VolumeCollector** | ~5MB | Caches volume data |
| **LiquidationTracker** | ~10MB | Stores last 100 liquidations |
| **OrderBookAnalyzer** | ~20MB | Stores full order book |
| **DataCollector** | ~50MB | Orchestrates all |
| **Total** | **~90MB** | Acceptable for production |

---

## Error Handling

### Auto-Reconnect

All WebSocket collectors implement auto-reconnect:

```javascript
ws.on('close', () => {
  setTimeout(() => {
    this.connectWebSocket();
  }, this.config.reconnectDelay);
});
```

### Rate Limit Handling

REST collectors implement exponential backoff:

```javascript
if (response.status === 429) {
  const retryAfter = response.headers['retry-after'] || 60;
  await sleep(retryAfter * 1000);
  return this.fetchData();
}
```

### Error Events

All collectors emit `error` events:

```javascript
collector.on('error', (error) => {
  logger.error('Collector error:', error);
  // Handle error (alert, restart, etc.)
});
```

---

## Best Practices

### 1. Always Use DataCollector

**Don't:**
```javascript
const spotCollector = new SpotPriceCollector();
const oiCollector = new OpenInterestCollector();
const liquidationTracker = new LiquidationTracker();
// ... manage each separately
```

**Do:**
```javascript
const dataCollector = new DataCollector();
await dataCollector.start();
// DataCollector manages all sub-collectors
```

### 2. Listen for `ready` Event

**Don't:**
```javascript
await dataCollector.start();
const options = dataCollector.getOptions(); // May be empty
```

**Do:**
```javascript
dataCollector.on('ready', () => {
  const options = dataCollector.getOptions(); // Guaranteed to have data
});
await dataCollector.start();
```

### 3. Handle Disconnects

**Don't:**
```javascript
// Assume connection is always stable
```

**Do:**
```javascript
dataCollector.on('disconnected', () => {
  logger.warn('Disconnected, will auto-reconnect');
  // Optionally: pause trading, alert user, etc.
});

dataCollector.on('connected', () => {
  logger.success('Reconnected');
  // Optionally: resume trading
});
```

### 4. Monitor Memory

```javascript
setInterval(() => {
  const stats = dataCollector.getStats();
  const memUsage = process.memoryUsage();
  
  logger.info('Memory:', (memUsage.heapUsed / 1024 / 1024).toFixed(2) + 'MB');
  logger.info('Options:', stats.options.total);
}, 60000); // Every minute
```

---

## Related Components

- **Calculators**: GEXCalculator, EscapeTypeDetector, RSICalculator, etc.
- **Services**: WebSocketManager, CacheService, AlertService
- **Models**: Option, Trade, Liquidation
- **API Routes**: All routes depend on DataCollector

---

## References

### Binance API Documentation

1. **Options API**: https://binance-docs.github.io/apidocs/voptions/en/
2. **Futures API**: https://binance-docs.github.io/apidocs/futures/en/
3. **Spot API**: https://binance-docs.github.io/apidocs/spot/en/
4. **WebSocket Streams**: https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams

### Internal Documentation

- [GEX_CALCULATOR.md](./GEX_CALCULATOR.md)
- [ESCAPE_SYSTEM.md](./escape_system.md)
- [API_REFERENCE.md](./API_REFERENCE.md)
- [PROJECT_MAP.md](../PROJECT_MAP.md)

---

## Changelog

### v1.0.0 (Current)
- Initial implementation
- 6 collectors documented
- DataCollector orchestration
- Event-driven architecture
- Auto-reconnect and error handling

### Planned Features

- [ ] Multi-exchange support (Deribit, OKX)
- [ ] Historical data backfill
- [ ] Data persistence (database)
- [ ] Performance monitoring dashboard
- [ ] Collector health checks

---

## Support

For questions or issues:
- Check [API_REFERENCE.md](./API_REFERENCE.md)
- Review [PROJECT_MAP.md](../PROJECT_MAP.md)
- See code: `backend/src/collectors/`

---

**Last Updated:** January 15, 2026  
**Version:** 1.0.0  
**Author:** Valter Russo / Gamma Tracker Team
