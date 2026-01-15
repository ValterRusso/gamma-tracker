# 🎯 Entropy API Routes Integration Guide

## 📋 Overview

Este guia mostra como integrar os endpoints de entropia no `api/server.js` existente.

---

## 🔧 Passo 1: Adicionar imports no `api/server.js`

No início do arquivo `server.js`, adicionar:

```javascript
// Linha ~77 (depois dos outros imports)
const EntropyCalculator = require('../calculators/EntropyCalculator');
const RSICalculator = require('../calculators/RSICalculator');
```

---

## 🔧 Passo 2: Inicializar calculadoras no constructor

No constructor da classe `APIServer` (linha ~81):

```javascript
constructor(dataCollector, gexCalculator, regimeAnalyzer, database, config = {}) {
  // ... código existente ...
  
  this.anomalyDetector = new VolatilityAnomalyDetector(this.logger);
  
  // ← ADICIONAR AQUI:
  this.entropyCalculator = new EntropyCalculator(this.logger);
  this.rsiCalculator = new RSICalculator(this.logger);
  
  this.app = express();
  // ... resto do código ...
}
```

---

## 🔧 Passo 3: Conectar ao OrderBookAnalyzer

No método `start()` do `APIServer` (criar se não existir):

```javascript
/**
 * Iniciar servidor
 */
async start() {
  // Conectar ao OrderBookAnalyzer
  if (this.dataCollector.orderBookAnalyzer) {
    this.setupEntropyUpdates();
  }
  
  // Iniciar servidor Express
  return new Promise((resolve) => {
    this.server = this.app.listen(this.config.port, this.config.host, () => {
      this.logger.success(`API Server rodando em http://${this.config.host}:${this.config.port}`);
      resolve();
    });
  });
}

/**
 * Configurar updates de entropia
 */
setupEntropyUpdates() {
  const orderBook = this.dataCollector.orderBookAnalyzer;
  
  // Escutar updates do order book
  orderBook.on('update', (metrics) => {
    try {
      // Calcular entropia
      const entropyData = this.entropyCalculator.calculate(
        orderBook.bids,
        orderBook.asks
      );
      
      // Atualizar RSI com spot price
      if (orderBook.spotPrice > 0) {
        const rsiData = this.rsiCalculator.addPrice(orderBook.spotPrice);
        
        // Combinar com evento de entropia se houver
        if (entropyData && entropyData.event && rsiData) {
          this.rsiCalculator.combineWithEntropy(entropyData.event);
        }
      }
      
    } catch (error) {
      this.logger.error('Erro ao calcular entropia:', error);
    }
  });
  
  this.logger.success('✓ Entropy updates conectados ao OrderBookAnalyzer');
}
```

---

## 🔧 Passo 4: Adicionar rotas no `setupRoutes()`

No método `setupRoutes()`, adicionar após as rotas existentes (linha ~600+):

```javascript
// ========================================
// ENTROPY - Shannon Entropy Analysis
// ========================================

// Métricas de entropia atuais
this.app.get('/api/entropy', (req, res) => {
  try {
    const metrics = this.entropyCalculator.getMetrics();
    const rsiMetrics = this.rsiCalculator.getMetrics();
    
    res.json({
      success: true,
      data: {
        entropy: metrics,
        rsi: rsiMetrics
      }
    });
  } catch (error) {
    this.logger.error('Erro ao obter entropia', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Histórico de entropia
this.app.get('/api/entropy/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 1000;
    const history = this.entropyCalculator.getHistory(limit);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    this.logger.error('Erro ao obter histórico de entropia', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Eventos de entropia recentes
this.app.get('/api/entropy/events', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const type = req.query.type || null;
    
    const events = this.entropyCalculator.getRecentEvents(limit, type);
    
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    this.logger.error('Erro ao obter eventos de entropia', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Divergências de RSI
this.app.get('/api/entropy/divergence', (req, res) => {
  try {
    const windowMs = parseInt(req.query.window) || 900000; // 15 min default
    const divergence = this.rsiCalculator.detectDivergence(windowMs);
    
    res.json({
      success: true,
      data: divergence
    });
  } catch (error) {
    this.logger.error('Erro ao detectar divergência', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stats de entropia
this.app.get('/api/entropy/stats', (req, res) => {
  try {
    const entropyStats = this.entropyCalculator.getStats();
    const rsiStats = this.rsiCalculator.getStats();
    
    res.json({
      success: true,
      data: {
        entropy: entropyStats,
        rsi: rsiStats
      }
    });
  } catch (error) {
    this.logger.error('Erro ao obter stats de entropia', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

## 🔧 Passo 5: Atualizar `index.js` para inicializar OrderBookAnalyzer

No arquivo `index.js`, adicionar OrderBookAnalyzer ao DataCollector:

```javascript
// Linha ~70 (no método initialize)

// 3. Inicializar coletor de dados
this.dataCollector = new DataCollector({
  underlying: this.config.underlying
});

// ← ADICIONAR: Inicializar OrderBookAnalyzer
const OrderBookAnalyzer = require('./collectors/OrderBookAnalyzer');
this.dataCollector.orderBookAnalyzer = new OrderBookAnalyzer(
  `${this.config.underlying}USDT`,
  this.logger
);
this.dataCollector.orderBookAnalyzer.connect();

// Configurar event listeners
this.setupEventListeners();
```

---

## 📊 Endpoints Disponíveis

Após a integração, os seguintes endpoints estarão disponíveis:

### **1. GET `/api/entropy`**
Retorna métricas atuais de entropia e RSI.

**Response:**
```json
{
  "success": true,
  "data": {
    "entropy": {
      "bid_entropy": 5.2,
      "ask_entropy": 5.1,
      "ratio": 1.02,
      "timestamp": 1704398400000,
      "bid_delta_5m": -0.05,
      "ask_delta_5m": 0.02,
      "bid_delta_15m": -0.08,
      "ask_delta_15m": 0.03,
      "bands": {
        "bid": { "mean": 5.3, "upper": 5.5, "lower": 5.1 },
        "ask": { "mean": 5.2, "upper": 5.4, "lower": 5.0 }
      }
    },
    "rsi": {
      "rsi": 45.2,
      "status": "NEUTRAL",
      "timestamp": 1704398400000
    }
  }
}
```

### **2. GET `/api/entropy/history?limit=1000`**
Retorna histórico de entropia.

**Query params:**
- `limit` (opcional): Número máximo de pontos (default: 1000)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": 1704398400000,
      "bid_entropy": 5.2,
      "ask_entropy": 5.1,
      "ratio": 1.02
    },
    ...
  ]
}
```

### **3. GET `/api/entropy/events?limit=10&type=BID_COLLAPSE`**
Retorna eventos recentes de entropia.

**Query params:**
- `limit` (opcional): Número máximo de eventos (default: 10)
- `type` (opcional): Filtrar por tipo (`BID_COLLAPSE`, `ASK_SPIKE`, `SQUEEZE`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "BID_COLLAPSE",
      "timestamp": 1704398400000,
      "bid_entropy": 4.3,
      "bid_delta": -0.18,
      "confidence": 0.85,
      "signal": "BUY",
      "interpretation": "Strong BID collapse detected! Whale absorbing sells..."
    },
    ...
  ]
}
```

### **4. GET `/api/entropy/divergence?window=900000`**
Detecta divergências entre RSI e preço.

**Query params:**
- `window` (opcional): Janela de tempo em ms (default: 900000 = 15min)

**Response:**
```json
{
  "success": true,
  "data": {
    "type": "BULLISH_DIVERGENCE",
    "timestamp": 1704398400000,
    "price_trend": "LOWER_LOW",
    "rsi_trend": "HIGHER_LOW",
    "confidence": 0.7,
    "interpretation": "Bullish divergence: Price making lower lows..."
  }
}
```

### **5. GET `/api/entropy/stats`**
Retorna estatísticas de entropia e RSI.

**Response:**
```json
{
  "success": true,
  "data": {
    "entropy": {
      "calculations": 1234,
      "events_detected": 15,
      "bid_collapses": 8,
      "ask_spikes": 5,
      "squeezes": 2,
      "history_size": {
        "bid": 1800,
        "ask": 1800,
        "ratio": 1800
      }
    },
    "rsi": {
      "calculations": 1234,
      "oversold_count": 45,
      "overbought_count": 32,
      "price_history_size": 1800,
      "rsi_history_size": 1800
    }
  }
}
```

---

## 🧪 Testes

### **Teste 1: Health check**
```bash
curl http://localhost:3300/health
```

### **Teste 2: Entropia atual**
```bash
curl http://localhost:3300/api/entropy
```

### **Teste 3: Eventos recentes**
```bash
curl http://localhost:3300/api/entropy/events?limit=5
```

### **Teste 4: Histórico**
```bash
curl http://localhost:3300/api/entropy/history?limit=100
```

---

## 🔍 Debug

Se houver problemas:

1. **Verificar logs:**
   ```bash
   tail -f backend/logs/gamma-tracker.log
   ```

2. **Verificar se OrderBookAnalyzer está conectado:**
   ```bash
   curl http://localhost:3300/api/status
   ```

3. **Testar cálculo manual:**
   ```javascript
   const EntropyCalculator = require('./calculators/EntropyCalculator');
   const Logger = require('./utils/logger');
   
   const logger = new Logger('Test');
   const calc = new EntropyCalculator(logger);
   
   const bids = [[90000, 1.5], [89900, 2.0], [89800, 1.2]];
   const asks = [[90100, 1.8], [90200, 1.5], [90300, 2.2]];
   
   const result = calc.calculate(bids, asks);
   console.log(result);
   ```

---

## ✅ Checklist de Integração

- [ ] Copiar `EntropyCalculator.js` para `backend/src/calculators/`
- [ ] Copiar `RSICalculator.js` para `backend/src/calculators/`
- [ ] Adicionar imports no `api/server.js`
- [ ] Inicializar calculadoras no constructor
- [ ] Adicionar método `setupEntropyUpdates()`
- [ ] Adicionar rotas no `setupRoutes()`
- [ ] Atualizar `index.js` para inicializar OrderBookAnalyzer
- [ ] Testar endpoints
- [ ] Verificar logs
- [ ] Integrar no frontend

---

## 🍺 Pronto!

Após seguir estes passos, os endpoints de entropia estarão funcionando e integrados ao seu backend existente!

**SKÅL!** 🍺⚔️
