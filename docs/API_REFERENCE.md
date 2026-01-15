# 📡 Gamma Tracker - API Reference

> **Complete REST API documentation for all 99 endpoints**

**Base URL:** `http://localhost:3300`  
**API Version:** 3.0  
**Last Updated:** 2026-01-15

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Response Format](#response-format)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Endpoints by Category](#endpoints-by-category)
   - [Core & System](#core--system-2-endpoints)
   - [Metrics](#metrics-6-endpoints)
   - [Entropy & RSI](#entropy--rsi-12-endpoints)
   - [Market Analysis](#market-analysis-4-endpoints)
   - [Liquidations](#liquidations-7-endpoints)
   - [Strategies](#strategies-3-endpoints)
   - [Order Book](#order-book-7-endpoints)
   - [Sentiment](#sentiment-2-endpoints)
   - [Volatility](#volatility-3-endpoints)
   - [Escape Detection](#escape-detection-7-endpoints)
   - [History](#history-2-endpoints)
   - [IV Comparison](#iv-comparison-13-endpoints)
   - [Options](#options-4-endpoints)
   - [GEX Heatmap](#gex-heatmap-5-endpoints)
   - [DEX Heatmap](#dex-heatmap-4-endpoints)
   - [DVOL](#dvol-4-endpoints)
   - [Positions](#positions-4-endpoints)
   - [Trading Bot](#trading-bot-12-endpoints)

---

## Overview

The Gamma Tracker API provides real-time access to:

- **Options market data** (Binance Options)
- **Gamma exposure (GEX)** calculations
- **Shannon entropy** order book analysis
- **Liquidation tracking** and cascade detection
- **Escape detection** (Half Pipe Model)
- **Iceberg order** detection
- **Volatility surface** analysis
- **Trading bot** management and monitoring

### Key Features

- ✅ **99 REST endpoints**
- ✅ **Real-time data** via WebSocket collectors
- ✅ **Modular architecture** with service layer
- ✅ **Comprehensive error handling**
- ✅ **Request validation** middleware
- ✅ **CORS enabled** for frontend integration

---

## Authentication

Currently, the API does not require authentication for local development.

**Future versions may include:**
- API key authentication
- JWT tokens
- Rate limiting per API key

---

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| **200** | OK | Request successful |
| **400** | Bad Request | Invalid parameters or validation error |
| **404** | Not Found | Endpoint or resource not found |
| **500** | Internal Server Error | Server-side error |
| **503** | Service Unavailable | Service not ready (e.g., data not collected yet) |

### Common Errors

```json
{
  "success": false,
  "error": "Validation error",
  "details": {
    "field": "depth",
    "message": "Must be between 5 and 200"
  }
}
```

---

## Rate Limiting

Currently, there are no rate limits for local development.

**Recommended best practices:**
- Cache responses when possible
- Use WebSocket streams for real-time data
- Batch requests when fetching multiple resources

---

## Endpoints by Category

---

## Core & System (2 endpoints)

### 1. Health Check

**GET** `/health`

Check if the API server is running.

**Response:**
```json
{
  "status": "OK",
  "timestamp": 1705334400000,
  "uptime": 3600.5
}
```

**Example:**
```bash
curl http://localhost:3300/health
```

---

### 2. System Status

**GET** `/api/status`

Get detailed system status including all services.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "running",
    "services": {
      "dataCollector": "active",
      "entropyCalc": "active",
      "liquidationTracker": "active",
      "tradingBot": "active"
    },
    "uptime": 3600.5,
    "timestamp": 1705334400000
  }
}
```

---

## Metrics (6 endpoints)

### 1. Get All Metrics

**GET** `/api/metrics`

Get comprehensive market metrics including GEX, entropy, liquidations, and more.

**Response:**
```json
{
  "success": true,
  "data": {
    "spot": 96205.01,
    "gex": {
      "total": -1680000,
      "gammaFlip": 96895.35,
      "putWall": 96000.00,
      "callWall": 100000.00
    },
    "entropy": {
      "bid": 1.23,
      "ask": 2.97,
      "avg": 1.39,
      "ratio": 0.41
    },
    "liquidations": {
      "energy": 59.4,
      "direction": "bearish",
      "cascadeRisk": 0.4
    },
    "escape": {
      "type": "none",
      "probability": 180.0,
      "energy": 54.0
    },
    "timestamp": 1705334400000
  }
}
```

---

### 2. Get Insights

**GET** `/api/insights`

Get AI-generated market insights and recommendations.

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": "Market showing neutral conditions with low volatility",
    "signals": [
      {
        "type": "warning",
        "message": "IV Rank at historical lows (1.2%)"
      },
      {
        "type": "info",
        "message": "Price trapped between gamma walls"
      }
    ],
    "recommendations": [
      "Wait for IV Rank > 50 before selling volatility",
      "Consider long volatility strategies"
    ]
  }
}
```

---

## Entropy & RSI (12 endpoints)

### 1. Get Current Entropy + RSI

**GET** `/api/entropy-rsi`

Get current Shannon entropy and RSI values.

**Query Parameters:**
- `depth` (optional): Order book depth (5-200, default: current setting)

**Response:**
```json
{
  "success": true,
  "data": {
    "entropy": {
      "bid": 1.23,
      "ask": 2.97,
      "avg": 1.39,
      "ratio": 0.41,
      "normalized": {
        "bid": 19.4,
        "ask": 47.9,
        "avg": 22.5
      }
    },
    "rsi": {
      "value": 45.2,
      "signal": "neutral",
      "overbought": false,
      "oversold": false
    },
    "volume": {
      "current": 1234.56,
      "avg": 1100.00,
      "trend": "increasing"
    },
    "spot": 96205.01,
    "timestamp": 1705334400000
  }
}
```

**Example:**
```bash
curl "http://localhost:3300/api/entropy-rsi?depth=20"
```

---

### 2. Get Entropy Statistics

**GET** `/api/entropy/stats`

Get statistical analysis of entropy values.

**Response:**
```json
{
  "success": true,
  "data": {
    "current": {
      "bid": 1.23,
      "ask": 2.97,
      "avg": 1.39
    },
    "stats": {
      "mean": 1.85,
      "median": 1.75,
      "std": 0.45,
      "min": 0.5,
      "max": 4.2
    },
    "percentiles": {
      "p25": 1.2,
      "p50": 1.75,
      "p75": 2.3,
      "p90": 3.1,
      "p95": 3.6
    }
  }
}
```

---

### 3. Get Entropy Events

**GET** `/api/entropy/events`

Get recent entropy events (spikes, drops, divergences).

**Query Parameters:**
- `limit` (optional): Number of events (1-100, default: 5)
- `type` (optional): Event type filter

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "evt_123",
      "type": "spike",
      "side": "ask",
      "value": 4.2,
      "threshold": 3.5,
      "timestamp": 1705334400000,
      "duration": 120
    }
  ]
}
```

---

### 4. Get Entropy History

**GET** `/api/entropy/history`

Get historical entropy data.

**Query Parameters:**
- `limit` (optional): Number of data points (1-1000, default: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "bid": 1.23,
      "ask": 2.97,
      "avg": 1.39,
      "spot": 96205.01,
      "timestamp": 1705334400000
    }
  ]
}
```

---

### 5. Get Entropy Divergence

**GET** `/api/entropy/divergence`

Get bid vs ask entropy divergence analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "current": {
      "bid": 1.23,
      "ask": 2.97,
      "diff": 1.74,
      "ratio": 0.41
    },
    "interpretation": "High ask entropy suggests selling pressure",
    "signal": "bearish",
    "strength": "moderate"
  }
}
```

---

### 6. Set Entropy Depth

**POST** `/api/entropy/depth`

Change order book depth for entropy calculation.

**Body:**
```json
{
  "depth": 20
}
```

**Response:**
```json
{
  "success": true,
  "depth": 20,
  "message": "Depth successfully changed to 20 levels"
}
```

---

### 7. Get Current Depth

**GET** `/api/entropy/depth`

Get current order book depth setting.

**Response:**
```json
{
  "success": true,
  "data": {
    "current": 20,
    "available": [5, 10, 20, 25, 30, 50, 80, 100],
    "recommended": 20
  }
}
```

---

### 8. Get Multi-Depth Entropy

**GET** `/api/entropy/multi-depth`

Calculate entropy at multiple depths in a single request.

**Query Parameters:**
- `depths` (optional): Comma-separated depths (e.g., "5,10,20,50")

**Response:**
```json
{
  "success": true,
  "data": {
    "depths": [
      {
        "depth": 5,
        "bid": 0.8,
        "ask": 1.2,
        "avg": 1.0
      },
      {
        "depth": 20,
        "bid": 1.23,
        "ask": 2.97,
        "avg": 1.39
      }
    ]
  }
}
```

---

### 9. Get Available Assets

**GET** `/api/entropy/assets`

List all available assets for entropy calculation.

**Response:**
```json
{
  "success": true,
  "data": {
    "current": "BTCUSDT",
    "available": ["BTCUSDT", "ETHUSDT"],
    "supported": ["BTCUSDT", "ETHUSDT"]
  }
}
```

---

### 10. Get RSI + Volume

**GET** `/api/rsi`

Get RSI indicator with volume analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "rsi": {
      "value": 45.2,
      "signal": "neutral",
      "overbought": false,
      "oversold": false
    },
    "volume": {
      "current": 1234.56,
      "avg": 1100.00,
      "trend": "increasing",
      "percentile": 65.5
    },
    "timestamp": 1705334400000
  }
}
```

---

### 11. Get Volume Trend

**GET** `/api/volume`

Get volume trend analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "current": 1234.56,
    "avg": 1100.00,
    "trend": "increasing",
    "change": "+12.2%",
    "percentile": 65.5
  }
}
```

---

### 12. Get All Divergences

**GET** `/api/divergences`

Get all types of divergences (entropy, RSI, volume).

**Response:**
```json
{
  "success": true,
  "data": {
    "entropy": {
      "detected": true,
      "type": "bid_ask_divergence",
      "strength": "moderate"
    },
    "rsi": {
      "detected": false
    },
    "volume": {
      "detected": true,
      "type": "decreasing_volume_on_rally"
    }
  }
}
```

---

## Market Analysis (4 endpoints)

### 1. Get Complete Market Analysis

**GET** `/api/market-analysis`

Get comprehensive market analysis including regime, sentiment, and recommendations.

**Response:**
```json
{
  "success": true,
  "data": {
    "regime": {
      "current": "neutral",
      "volatility": "low",
      "trend": "ranging"
    },
    "sentiment": {
      "overall": "neutral",
      "putCallRatio": 1.12,
      "fearGreedIndex": 50
    },
    "recommendations": [
      {
        "strategy": "iron_condor",
        "score": 0.75,
        "reasoning": "Low volatility, neutral regime"
      }
    ],
    "timestamp": 1705334400000
  }
}
```

---

### 2. Get Analysis History

**GET** `/api/market-analysis/history`

Get historical market analysis snapshots.

**Query Parameters:**
- `limit` (optional): Number of snapshots (default: 2)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "regime": "neutral",
      "sentiment": "neutral",
      "timestamp": 1705334400000
    }
  ]
}
```

---

### 3. Get Analysis Stats

**GET** `/api/market-analysis/stats`

Get statistical analysis of market conditions.

**Response:**
```json
{
  "success": true,
  "data": {
    "regimes": {
      "trending": 0.3,
      "ranging": 0.5,
      "volatile": 0.2
    },
    "avgVolatility": 45.2,
    "avgSentiment": 52.1
  }
}
```

---

### 4. Get Pattern Analysis

**GET** `/api/patterns/:pattern`

Get specific pattern analysis (e.g., squeeze, breakout).

**Path Parameters:**
- `pattern`: Pattern name (squeeze, breakout, etc.)

**Response:**
```json
{
  "success": true,
  "data": {
    "pattern": "squeeze",
    "detected": true,
    "confidence": 0.85,
    "details": {
      "duration": 120,
      "compression": 0.75
    }
  }
}
```

---

## Liquidations (7 endpoints)

### 1. Get Liquidations Summary

**GET** `/api/liquidations/summary`

Get liquidation summary with energy score.

**Response:**
```json
{
  "success": true,
  "data": {
    "energy": 59.4,
    "direction": "bearish",
    "imbalanceRatio": 0.96,
    "totalValue": 3.79,
    "cascadeRisk": 0.4,
    "frequency": 1.0,
    "imbalance": 0.93,
    "recentLiquidations": {
      "1h": {
        "volume": 379000,
        "count": 67,
        "largest": 634000
      }
    }
  }
}
```

---

### 2. Get Liquidation Stats

**GET** `/api/liquidations/stats`

Get detailed liquidation statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": {
      "volume": 379000,
      "count": 67
    },
    "longs": {
      "volume": 365000,
      "count": 64
    },
    "shorts": {
      "volume": 14000,
      "count": 3
    },
    "largest": 634000,
    "average": 5656
  }
}
```

---

### 3. Get Liquidation Energy

**GET** `/api/liquidations/energy`

Get liquidation energy score and components.

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 59.4,
    "level": "medium",
    "components": {
      "value": 3.79,
      "frequency": 1.0,
      "imbalance": 0.93,
      "cascade": 0.4
    }
  }
}
```

---

### 4. Get Recent Liquidations

**GET** `/api/liquidations/recent`

Get recent liquidation events.

**Query Parameters:**
- `limit` (optional): Number of events (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "BTCUSDT",
      "side": "long",
      "price": 96000,
      "quantity": 2.5,
      "value": 240000,
      "timestamp": 1705334400000
    }
  ]
}
```

---

### 5. Get Early Liquidations

**GET** `/api/liquidations/early`

Get early warning signals for potential liquidation cascades.

**Response:**
```json
{
  "success": true,
  "data": {
    "warning": true,
    "risk": "medium",
    "levels": [
      {
        "price": 95000,
        "exposure": 15000000,
        "probability": 0.35
      }
    ]
  }
}
```

---

### 6. Get Liquidation Growth

**GET** `/api/liquidations/growth`

Get liquidation growth rate analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "rate": 0.15,
    "trend": "increasing",
    "acceleration": 0.05
  }
}
```

---

### 7. Get Cascade Risk

**GET** `/api/liquidations/cascade`

Get liquidation cascade risk assessment.

**Response:**
```json
{
  "success": true,
  "data": {
    "risk": 0.4,
    "level": "medium",
    "trigger_price": 95000,
    "potential_volume": 25000000
  }
}
```

---

## Strategies (3 endpoints)

### 1. Get Strategy Recommendations

**GET** `/api/strategies/recommend`

Get AI-powered strategy recommendations based on current market conditions.

**Query Parameters:**
- `topN` (optional): Number of recommendations (default: 5)
- `minScore` (optional): Minimum score threshold (0-1, default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "name": "Iron Condor",
        "score": 0.85,
        "reasoning": "Low volatility, neutral regime, high IV Rank",
        "parameters": {
          "dte": 30,
          "wingWidth": 500,
          "profitTarget": 50,
          "stopLoss": 50
        }
      }
    ],
    "marketState": {
      "regime": "neutral",
      "ivRank": 65.2,
      "trend": "ranging"
    }
  }
}
```

**Example:**
```bash
curl "http://localhost:3300/api/strategies/recommend?topN=3&minScore=0.5"
```

---

### 2. Get All Strategies

**GET** `/api/strategies/all`

Get list of all available trading strategies.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "Iron Condor",
      "type": "credit_spread",
      "complexity": "intermediate",
      "idealConditions": ["low_volatility", "neutral_market"],
      "maxProfit": "limited",
      "maxLoss": "limited"
    },
    {
      "name": "Iron Butterfly",
      "type": "credit_spread",
      "complexity": "intermediate",
      "idealConditions": ["low_volatility", "neutral_market"],
      "maxProfit": "limited",
      "maxLoss": "limited"
    }
  ]
}
```

---

### 3. Get Strategy Details

**GET** `/api/strategies/:strategy`

Get detailed information about a specific strategy.

**Path Parameters:**
- `strategy`: Strategy name (e.g., "iron_condor")

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "Iron Condor",
    "description": "Sell OTM put spread and OTM call spread simultaneously",
    "type": "credit_spread",
    "legs": 4,
    "idealConditions": {
      "ivRank": "> 50",
      "regime": "neutral",
      "volatility": "low"
    },
    "profitLoss": {
      "maxProfit": "Net credit received",
      "maxLoss": "Wing width - net credit",
      "breakevens": 2
    },
    "greeks": {
      "delta": "near zero",
      "theta": "positive",
      "vega": "negative"
    }
  }
}
```

---

## Order Book (7 endpoints)

### 1. Get Order Book Metrics

**GET** `/api/orderbook/metrics`

Get comprehensive order book metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "imbalance": -6.0,
    "imbalanceNormalized": -112,
    "strength": "weak",
    "persistence": 0,
    "delta60s": -0.59,
    "interpretation": "Neutral / Balanced",
    "confidence": "low",
    "warning": "Low persistence - direction may reverse quickly",
    "bidWall": {
      "price": 95865.5,
      "size": 46.452,
      "ratioVsAvg": 132.8
    },
    "askWall": {
      "price": 96300.0,
      "size": 88.447,
      "ratioVsAvg": 223.7
    },
    "spread": {
      "absolute": 0.63,
      "relative": 0.0007
    }
  }
}
```

---

### 2. Get Order Book Imbalance

**GET** `/api/orderbook/imbalance`

Get bid/ask imbalance analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "ratio": -6.0,
    "normalized": -112,
    "signal": "neutral",
    "strength": "weak"
  }
}
```

---

### 3. Get Order Book Depth

**GET** `/api/orderbook/depth`

Get order book depth analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "bids": {
      "total": 1234.56,
      "levels": 100,
      "avgSize": 12.35
    },
    "asks": {
      "total": 1456.78,
      "levels": 100,
      "avgSize": 14.57
    }
  }
}
```

---

### 4. Get Spread Analysis

**GET** `/api/orderbook/spread`

Get bid-ask spread analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "absolute": 0.63,
    "relative": 0.0007,
    "percentile": 45.2
  }
}
```

---

### 5. Get Order Book Walls

**GET** `/api/orderbook/walls`

Get significant bid/ask walls.

**Response:**
```json
{
  "success": true,
  "data": {
    "bidWall": {
      "price": 95865.5,
      "size": 46.452,
      "ratioVsAvg": 132.8,
      "distance": -0.28
    },
    "askWall": {
      "price": 96300.0,
      "size": 88.447,
      "ratioVsAvg": 223.7,
      "distance": 0.17
    },
    "trapped": true,
    "zoneWidth": 434.5
  }
}
```

---

### 6. Get Order Book Energy

**GET** `/api/orderbook/energy`

Get order book energy and momentum.

**Response:**
```json
{
  "success": true,
  "data": {
    "energy": 54.0,
    "momentum": "neutral",
    "acceleration": 0.05
  }
}
```

---

### 7. Get Order Book History

**GET** `/api/orderbook/history`

Get historical order book snapshots.

**Query Parameters:**
- `limit` (optional): Number of snapshots (default: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "imbalance": -6.0,
      "bidWallPrice": 95865.5,
      "askWallPrice": 96300.0,
      "timestamp": 1705334400000
    }
  ]
}
```

---

## Sentiment (2 endpoints)

### 1. Get Market Sentiment

**GET** `/api/sentiment`

Get overall market sentiment analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "overall": "neutral",
    "score": 50,
    "putCallRatio": 1.12,
    "fearGreedIndex": 50,
    "components": {
      "options": "neutral",
      "liquidations": "bearish",
      "orderbook": "neutral"
    }
  }
}
```

---

### 2. Get Max Pain

**GET** `/api/max-pain`

Get max pain price for current expiration.

**Response:**
```json
{
  "success": true,
  "data": {
    "price": 100000.00,
    "distance": 4.71,
    "totalOI": 1122.93,
    "callOI": 971.65,
    "putOI": 151.28,
    "expiry": "2026-01-17"
  }
}
```

---

## Volatility (3 endpoints)

### 1. Get Volatility Surface

**GET** `/api/vol-surface`

Get complete implied volatility surface.

**Response:**
```json
{
  "success": true,
  "data": {
    "points": [
      {
        "strike": 90000,
        "dte": 7,
        "iv": 45.2,
        "moneyness": 0.94
      }
    ],
    "atmIV": 40.8,
    "ivRank": 1.2,
    "ivPercentile": 1.1
  }
}
```

---

### 2. Get Volatility Anomalies

**GET** `/api/anomalies`

Get volatility surface anomalies (statistical outliers).

**Query Parameters:**
- `threshold` (optional): Z-score threshold (default: 2.0)
- `limit` (optional): Max results (default: 50)
- `severity` (optional): Filter by severity (HIGH, MEDIUM, LOW)
- `type` (optional): Filter by type (IV_OUTLIER, SKEW, etc.)

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 27,
    "critical": 3,
    "high": 0,
    "medium": 2,
    "anomalies": [
      {
        "type": "skew",
        "strike": 160000,
        "dte": 15,
        "moneyness": 167.1,
        "details": "Put: 74.06% Call: 82.09% Spread: -8.03% (CALL_PREMIUM)",
        "zScore": -3.70,
        "severity": "HIGH",
        "volume": 0.25,
        "oi": 28.71
      }
    ]
  }
}
```

---

### 3. Get IV Skew Analysis

**GET** `/api/iv-skew`

Get put/call IV skew analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "atmSkew": -2.5,
    "otmSkew": 5.2,
    "interpretation": "Put premium (fear)",
    "percentile": 75.5
  }
}
```

---

## Escape Detection (7 endpoints)

### 1. Detect Escape

**GET** `/api/escape/detect`

Detect current escape pattern using Half Pipe Model.

**Response:**
```json
{
  "success": true,
  "data": {
    "escapeType": "none",
    "confidence": 0.5,
    "reasoning": "No clear escape pattern detected",
    "metrics": {
      "p_escape": 180.0,
      "energy": 54.0,
      "barrier": 30.0
    }
  }
}
```

---

### 2. Get Escape Probability

**GET** `/api/escape/probability`

Get escape probability calculation.

**Response:**
```json
{
  "success": true,
  "data": {
    "probability": 180.0,
    "level": "high",
    "interpretation": "High probability of breakout"
  }
}
```

---

### 3. Get Escape Conditions

**GET** `/api/escape/conditions`

Get current market conditions for escape analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "energy": {
      "sustained": 8.0,
      "injected": 100.0,
      "total": 0.342
    },
    "barrier": {
      "gex": 8.1,
      "iceberg": 40.0,
      "liquidity": 0.0
    },
    "regime": "OPTIONS_ACTIVE"
  }
}
```

---

### 4. Get Escape Summary

**GET** `/api/escape/summary`

Get escape detection summary.

**Response:**
```json
{
  "success": true,
  "data": {
    "current": {
      "type": "none",
      "confidence": 0.5
    },
    "history": {
      "last24h": 3,
      "accuracy": 0.75
    }
  }
}
```

---

### 5. Get Escape Energy

**GET** `/api/escape/energy`

Get escape energy components.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 54.0,
    "sustained": 8.0,
    "injected": 100.0,
    "normalized": 0.342
  }
}
```

---

### 6. Get Escape History

**GET** `/api/escape/history`

Get historical escape detections.

**Query Parameters:**
- `limit` (optional): Number of records (default: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "good_escape",
      "confidence": 0.85,
      "p_escape": 113.9,
      "timestamp": 1705334400000
    }
  ]
}
```

---

### 7. Get Active Alerts

**GET** `/api/escape/alerts`

Get active escape alerts.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "warning",
      "message": "High escape probability detected",
      "confidence": 0.85,
      "timestamp": 1705334400000
    }
  ]
}
```

---

## History (2 endpoints)

### 1. Get Market History

**GET** `/api/market-history`

Get historical market snapshots.

**Query Parameters:**
- `limit` (optional): Number of snapshots

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "spot": 96205.01,
      "gex": -1680000,
      "entropy": 1.39,
      "timestamp": 1705334400000
    }
  ]
}
```

---

### 2. Get Regime History

**GET** `/api/regime-history`

Get historical regime classifications.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "regime": "neutral",
      "duration": 3600,
      "timestamp": 1705334400000
    }
  ]
}
```

---

## IV Comparison (13 endpoints)

### 1. Get IV Comparison

**GET** `/api/iv-comparison/:dte`

Compare implied volatility across strikes for a specific DTE.

**Path Parameters:**
- `dte`: Days to expiration

**Response:**
```json
{
  "success": true,
  "data": {
    "dte": 1,
    "atmIV": 36.6,
    "ivRank": 1.2,
    "strikes": [
      {
        "strike": 90000,
        "callIV": 35.2,
        "putIV": 37.8,
        "skew": -2.6
      }
    ]
  }
}
```

---

### 2. Get IV History

**GET** `/api/iv-compare/history`

Get historical IV data.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "atmIV": 36.6,
      "ivRank": 1.2,
      "timestamp": 1705334400000
    }
  ]
}
```

---

### 3. Compare Multiple DTEs

**GET** `/api/iv-compare/multiple`

Compare IV across multiple expirations.

**Query Parameters:**
- `dtes` (optional): Comma-separated DTEs

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "dte": 1,
      "atmIV": 36.6,
      "ivRank": 1.2
    },
    {
      "dte": 7,
      "atmIV": 38.2,
      "ivRank": 5.5
    }
  ]
}
```

---

### 4. Get IV Stats

**GET** `/api/iv-compare/stats`

Get IV statistical analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "current": 36.6,
    "mean": 45.2,
    "median": 43.1,
    "std": 8.5,
    "percentile": 1.1
  }
}
```

---

### 5. Get Retail Panic Index

**GET** `/api/retail-panic-index`

Get retail panic index based on OTM put buying.

**Response:**
```json
{
  "success": true,
  "data": {
    "index": 35.2,
    "level": "low",
    "interpretation": "Low retail fear"
  }
}
```

---

### 6-13. Binance & Deribit IV Endpoints

**GET** `/api/binance/iv-surface` - Binance IV surface  
**GET** `/api/binance/iv-metrics/:dte` - Binance IV metrics by DTE  
**GET** `/api/binance/stats` - Binance adapter stats  
**GET** `/api/deribit/iv-surface` - Deribit IV surface  
**GET** `/api/deribit/iv-metrics/:dte` - Deribit IV metrics by DTE  

*(Similar response structures to main IV endpoints)*

---

## Options (4 endpoints)

### 1. List All Options

**GET** `/api/options`

Get all available options contracts.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "BTC-260117-90000-C",
      "strike": 90000,
      "expiry": "2026-01-17",
      "type": "call",
      "markPrice": 6205.01,
      "iv": 35.2,
      "delta": 0.85,
      "gamma": 0.0001,
      "theta": -15.2,
      "vega": 25.5,
      "volume": 125.5,
      "openInterest": 1250.0
    }
  ]
}
```

---

### 2. Get Options by Strike

**GET** `/api/options/strike/:strike`

Get all options for a specific strike.

**Path Parameters:**
- `strike`: Strike price

**Response:**
```json
{
  "success": true,
  "data": {
    "strike": 90000,
    "call": { /* option data */ },
    "put": { /* option data */ }
  }
}
```

---

### 3. Get Unique Strikes

**GET** `/api/strikes`

Get list of all available strike prices.

**Response:**
```json
{
  "success": true,
  "data": [85000, 90000, 95000, 100000, 105000]
}
```

---

### 4. Get Unique Expiries

**GET** `/api/expiries`

Get list of all available expiration dates.

**Response:**
```json
{
  "success": true,
  "data": ["2026-01-17", "2026-01-24", "2026-01-31"]
}
```

---

## GEX Heatmap (5 endpoints)

### 1. Get Gamma Profile

**GET** `/api/gamma-profile`

Get complete gamma exposure profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "strikes": [
      {
        "strike": 90000,
        "netGEX": -500000,
        "callGEX": 200000,
        "putGEX": -700000
      }
    ],
    "totalGEX": -1680000,
    "gammaFlip": 96895.35
  }
}
```

---

### 2. Get Total GEX

**GET** `/api/total-gex`

Get total gamma exposure.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": -1680000,
    "calls": 462800,
    "puts": -2142800,
    "interpretation": "Negative GEX - dealers short gamma"
  }
}
```

---

### 3. Get Gamma Flip

**GET** `/api/gamma-flip`

Get gamma flip price.

**Response:**
```json
{
  "success": true,
  "data": {
    "price": 96895.35,
    "distance": 0.72,
    "interpretation": "Above flip = long gamma, Below = short gamma"
  }
}
```

---

### 4. Get Gamma Walls

**GET** `/api/walls`

Get significant gamma walls (support/resistance).

**Response:**
```json
{
  "success": true,
  "data": {
    "putWall": {
      "price": 96000.00,
      "gex": -1400000,
      "distance": -0.21
    },
    "callWall": {
      "price": 100000.00,
      "gex": 500000,
      "distance": 3.95
    }
  }
}
```

---

### 5. Get Wall Zones

**GET** `/api/wall-zones`

Get gamma wall zones analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "trapped": true,
    "lowerBound": 96000.00,
    "upperBound": 100000.00,
    "width": 4000.00,
    "currentPosition": "middle"
  }
}
```

---

## DEX Heatmap (4 endpoints)

### 1. Get DEX Heatmap

**GET** `/api/dex-heatmap`

Get decentralized exchange heatmap data.

**Response:**
```json
{
  "success": true,
  "data": {
    "exchanges": ["Uniswap", "PancakeSwap"],
    "liquidity": 125000000,
    "volume24h": 5000000
  }
}
```

---

### 2-4. Additional DEX Endpoints

*(Similar structure to GEX endpoints but for DEX data)*

---

## DVOL (4 endpoints)

### 1. Get DVOL Index

**GET** `/api/dvol`

Get Deribit Volatility Index (similar to VIX).

**Response:**
```json
{
  "success": true,
  "data": {
    "btc": {
      "current": 40.8,
      "change24h": 0.04,
      "level": "calm",
      "ivRank": 1.2,
      "ivPercentile": 1.1
    },
    "eth": {
      "current": 56.6,
      "change24h": -0.14,
      "level": "normal",
      "ivRank": 0.0,
      "ivPercentile": 0.0
    }
  }
}
```

---

### 2. Get DVOL History

**GET** `/api/dvol/history`

Get historical DVOL data.

**Query Parameters:**
- `asset` (optional): BTC or ETH
- `period` (optional): 7d, 30d, 90d

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "btc": 40.8,
      "eth": 56.6,
      "timestamp": 1705334400000
    }
  ]
}
```

---

### 3. Get DVOL Stats

**GET** `/api/dvol/stats`

Get DVOL statistical analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "btc": {
      "current": 40.8,
      "mean": 55.2,
      "median": 52.1,
      "std": 12.5,
      "min": 25.0,
      "max": 120.0
    }
  }
}
```

---

### 4. Get DVOL Comparison

**GET** `/api/dvol/compare`

Compare BTC and ETH DVOL.

**Response:**
```json
{
  "success": true,
  "data": {
    "btc": 40.8,
    "eth": 56.6,
    "spread": -15.8,
    "ratio": 0.72
  }
}
```

---

## Positions (4 endpoints)

### 1. Get All Positions

**GET** `/api/positions`

Get all open positions.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pos_123",
      "strategy": "iron_condor",
      "legs": [
        {
          "type": "short_put",
          "strike": 90000,
          "quantity": 1,
          "entry": 500,
          "current": 250
        }
      ],
      "pnl": 250,
      "pnlPercent": 50.0,
      "openedAt": 1705334400000
    }
  ]
}
```

---

### 2. Get Position by ID

**GET** `/api/positions/:id`

Get specific position details.

**Path Parameters:**
- `id`: Position ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pos_123",
    "strategy": "iron_condor",
    "details": { /* full position data */ }
  }
}
```

---

### 3. Get Position P&L

**GET** `/api/positions/:id/pnl`

Get P&L tracking for a position.

**Response:**
```json
{
  "success": true,
  "data": {
    "current": 250,
    "percent": 50.0,
    "maxProfit": 500,
    "maxLoss": -1500,
    "breakevens": [88500, 101500]
  }
}
```

---

### 4. Get Position Greeks

**GET** `/api/positions/:id/greeks`

Get Greeks for a position.

**Response:**
```json
{
  "success": true,
  "data": {
    "delta": 0.05,
    "gamma": 0.0001,
    "theta": 15.2,
    "vega": -25.5
  }
}
```

---

## Trading Bot (12 endpoints)

### 1. Get Bot Configs

**GET** `/api/bot/configs`

Get all bot configurations.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "botId": "iron_butterfly_1768489451_6e21",
      "strategy": "iron_butterfly",
      "enabled": true,
      "entry": {
        "ivRankMin": 50,
        "ivRankMax": 100,
        "minDTE": 21,
        "maxDTE": 35,
        "minVolume": 100
      },
      "exit": {
        "profitTargetPct": 50,
        "stopLossPct": 2,
        "dteExit": 7,
        "deltaThreshold": 0.30
      }
    }
  ]
}
```

---

### 2. Get Bot Status

**GET** `/api/bot/status`

Get status of all running bots.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "botId": "iron_butterfly_1768489451_6e21",
      "status": "running",
      "activePositions": 1,
      "totalTrades": 5,
      "totalPnL": 1250.50,
      "lastIteration": 1705334400000
    }
  ]
}
```

---

### 3. Get Bot Trades

**GET** `/api/bot/trades`

Get all bot trades.

**Query Parameters:**
- `botId` (optional): Filter by bot ID
- `status` (optional): Filter by status (active, closed)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "trade_123",
      "botId": "iron_butterfly_1768489451_6e21",
      "strategy": "iron_butterfly",
      "status": "active",
      "entryTime": 1705334400000,
      "entryPrice": 96000,
      "currentPrice": 96205,
      "pnl": -31.3,
      "pnlPercent": -31.3,
      "legs": [
        {
          "type": "short_call",
          "strike": 96000,
          "quantity": 1
        }
      ]
    }
  ]
}
```

---

### 4. Get Bot Signals

**GET** `/api/bot/signals`

Get recent bot signals.

**Query Parameters:**
- `botId` (optional): Filter by bot ID
- `limit` (optional): Number of signals

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "signal_123",
      "botId": "iron_butterfly_1768489451_6e21",
      "type": "entry",
      "signal": "iron_butterfly",
      "confidence": 0.85,
      "reasoning": "IV Rank: 65.2, Regime: neutral",
      "timestamp": 1705334400000
    }
  ]
}
```

---

### 5. Get Bot Performance

**GET** `/api/bot/performance`

Get bot performance metrics.

**Query Parameters:**
- `botId` (optional): Filter by bot ID

**Response:**
```json
{
  "success": true,
  "data": {
    "totalTrades": 25,
    "winRate": 0.72,
    "avgWin": 500,
    "avgLoss": -200,
    "totalPnL": 5250.50,
    "sharpeRatio": 1.85,
    "maxDrawdown": -1500
  }
}
```

---

### 6. Start Bot

**POST** `/api/bot/start`

Start a trading bot.

**Body:**
```json
{
  "botId": "iron_butterfly_1768489451_6e21"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bot started successfully",
  "botId": "iron_butterfly_1768489451_6e21"
}
```

---

### 7. Stop Bot

**POST** `/api/bot/stop`

Stop a trading bot.

**Body:**
```json
{
  "botId": "iron_butterfly_1768489451_6e21"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bot stopped successfully",
  "botId": "iron_butterfly_1768489451_6e21"
}
```

---

### 8. Update Bot Config

**PUT** `/api/bot/config`

Update bot configuration.

**Body:**
```json
{
  "botId": "iron_butterfly_1768489451_6e21",
  "config": {
    "entry": {
      "ivRankMin": 60
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Config updated successfully"
}
```

---

### 9. Close Position

**POST** `/api/bot/close`

Manually close a bot position.

**Body:**
```json
{
  "tradeId": "trade_123",
  "reason": "manual_close"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Position closed successfully",
  "pnl": -31.3
}
```

---

### 10. Get Bot Logs

**GET** `/api/bot/logs`

Get bot execution logs.

**Query Parameters:**
- `botId` (optional): Filter by bot ID
- `limit` (optional): Number of logs

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": 1705334400000,
      "botId": "iron_butterfly_1768489451_6e21",
      "level": "info",
      "message": "Running iteration",
      "details": {}
    }
  ]
}
```

---

### 11. Get Bot Analytics

**GET** `/api/bot/analytics`

Get detailed bot analytics.

**Response:**
```json
{
  "success": true,
  "data": {
    "performance": {
      "totalPnL": 5250.50,
      "winRate": 0.72
    },
    "trades": {
      "total": 25,
      "active": 3,
      "closed": 22
    },
    "strategies": {
      "iron_condor": 15,
      "iron_butterfly": 10
    }
  }
}
```

---

### 12. Reset Bot

**POST** `/api/bot/reset`

Reset bot state (close all positions, clear history).

**Body:**
```json
{
  "botId": "iron_butterfly_1768489451_6e21",
  "confirm": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bot reset successfully"
}
```

---

## Code Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:3300/api';

// Get current entropy + RSI
async function getEntropy() {
  const response = await axios.get(`${API_BASE}/entropy-rsi`);
  console.log(response.data);
}

// Get GEX profile
async function getGEX() {
  const response = await axios.get(`${API_BASE}/gamma-profile`);
  console.log(response.data);
}

// Get strategy recommendations
async function getStrategies() {
  const response = await axios.get(`${API_BASE}/strategies/recommend?topN=3`);
  console.log(response.data);
}
```

### Python

```python
import requests

API_BASE = 'http://localhost:3300/api'

# Get current entropy + RSI
def get_entropy():
    response = requests.get(f'{API_BASE}/entropy-rsi')
    return response.json()

# Get GEX profile
def get_gex():
    response = requests.get(f'{API_BASE}/gamma-profile')
    return response.json()

# Get strategy recommendations
def get_strategies():
    response = requests.get(f'{API_BASE}/strategies/recommend?topN=3')
    return response.json()
```

### cURL

```bash
# Get current entropy + RSI
curl http://localhost:3300/api/entropy-rsi

# Get GEX profile
curl http://localhost:3300/api/gamma-profile

# Get strategy recommendations
curl "http://localhost:3300/api/strategies/recommend?topN=3"

# Get bot status
curl http://localhost:3300/api/bot/status

# Start a bot
curl -X POST http://localhost:3300/api/bot/start \
  -H "Content-Type: application/json" \
  -d '{"botId": "iron_butterfly_1768489451_6e21"}'
```

---

## Changelog

### Version 3.0 (2026-01-15)
- Added 12 trading bot endpoints
- Added multi-depth entropy calculation
- Added DVOL endpoints
- Improved error handling
- Added request validation

### Version 2.0 (2026-01-10)
- Refactored to modular route architecture
- Added 30+ new endpoints
- Improved response schemas
- Added comprehensive documentation

### Version 1.0 (2025-12-01)
- Initial API release
- Core endpoints for GEX, entropy, liquidations

---

## Support

For questions, issues, or feature requests:

- **Documentation:** [docs/](../docs/)
- **GitHub Issues:** [github.com/yourusername/gamma-tracker/issues](https://github.com/yourusername/gamma-tracker/issues)
- **Email:** support@gammatracker.com

---

## License

MIT License - see [LICENSE](../LICENSE) for details.

---

<div align="center">

**📡 Gamma Tracker API Reference v3.0**

**Made with ❤️ by the Gamma Tracker Team**

</div>
