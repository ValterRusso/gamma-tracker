# 📊 OrderBookAnalyzer - Guia de Integração

## 🎯 Visão Geral

O **OrderBookAnalyzer** monitora o order book de futuros perpétuos da Binance em tempo real e calcula métricas de microestrutura de mercado para o **Half Pipe Model**.

---

## 📦 Arquivos do Pacote

```
orderbook-analyzer-system/
├── OrderBookAnalyzer.js              # Classe principal (650+ linhas)
├── orderbook-endpoints.js            # 7 endpoints de API
├── ORDERBOOK_INTEGRATION_GUIDE.md    # Este guia
└── DataCollector.js                  # Versão integrada (opcional)
```

---

## 🚀 Instalação Rápida

### **Passo 1: Copiar Arquivos**

```bash
cd C:\Users\vruss\nodejs-cryptos\gamma-tracker\backend\src

# Copiar classe principal
copy OrderBookAnalyzer.js .
```

### **Passo 2: Integrar no DataCollector**

Abra `DataCollector.js` e adicione:

#### **2.1. Import (linha ~15)**

```javascript
const LiquidationTracker = require('./LiquidationTracker');
const OrderBookAnalyzer = require('./OrderBookAnalyzer');  // ← ADICIONAR
```

#### **2.2. Propriedade no Constructor (linha ~52)**

```javascript
// Liquidation Tracker
this.liquidationTracker = null;

// Order Book Analyzer
this.orderBookAnalyzer = null;  // ← ADICIONAR
```

#### **2.3. Inicialização no start() (após LiquidationTracker, linha ~135)**

```javascript
// 10. Inicializar e conectar OrderBookAnalyzer
this.orderBookAnalyzer = new OrderBookAnalyzer(
  `${this.config.underlying.toLowerCase()}usdt`,
  this.logger
);

this.orderBookAnalyzer.on('connected', () => {
  this.logger.success('✅ OrderBookAnalyzer conectado');
  this.emit('orderbook-connected');
});

this.orderBookAnalyzer.on('update', (metrics) => {
  // Emitir evento para quem quiser processar cada update
  this.emit('orderbook-update', metrics);
});

this.orderBookAnalyzer.on('error', (error) => {
  this.logger.error('❌ OrderBookAnalyzer error:', error);
  this.emit('orderbook-error', error);
});

this.orderBookAnalyzer.connect();
this.logger.success('OrderBookAnalyzer iniciado');
```

#### **2.4. Cleanup no stop() (linha ~180)**

```javascript
// Desconectar LiquidationTracker
if (this.liquidationTracker) {
  this.liquidationTracker.disconnect();
  this.liquidationTracker = null;
}

// Desconectar OrderBookAnalyzer
if (this.orderBookAnalyzer) {  // ← ADICIONAR
  this.orderBookAnalyzer.disconnect();
  this.orderBookAnalyzer = null;
}
```

#### **2.5. Métodos Getters (final do arquivo, linha ~450)**

```javascript
/**
 * Obter métricas do OrderBookAnalyzer
 */
getOrderBookMetrics() {
  if (!this.orderBookAnalyzer) {
    throw new Error('OrderBookAnalyzer não inicializado');
  }
  return this.orderBookAnalyzer.getMetrics();
}

getOrderBookImbalance() {
  if (!this.orderBookAnalyzer) {
    throw new Error('OrderBookAnalyzer não inicializado');
  }
  return this.orderBookAnalyzer.getBookImbalance();
}

getOrderBookDepth() {
  if (!this.orderBookAnalyzer) {
    throw new Error('OrderBookAnalyzer não inicializado');
  }
  return this.orderBookAnalyzer.getDepth();
}

getOrderBookSpread() {
  if (!this.orderBookAnalyzer) {
    throw new Error('OrderBookAnalyzer não inicializado');
  }
  return this.orderBookAnalyzer.getSpreadQuality();
}

getOrderBookWalls() {
  if (!this.orderBookAnalyzer) {
    throw new Error('OrderBookAnalyzer não inicializado');
  }
  return this.orderBookAnalyzer.getWalls();
}

getOrderBookEnergy() {
  if (!this.orderBookAnalyzer) {
    throw new Error('OrderBookAnalyzer não inicializado');
  }
  return this.orderBookAnalyzer.getEnergyScore();
}

getOrderBookHistory() {
  if (!this.orderBookAnalyzer) {
    throw new Error('OrderBookAnalyzer não inicializado');
  }
  return this.orderBookAnalyzer.getHistory();
}
```

#### **2.6. Atualizar getStats() (linha ~400)**

```javascript
getStats() {
  return {
    // ... stats existentes ...
    
    // Stats do LiquidationTracker
    liquidationTracker: this.liquidationTracker 
      ? this.liquidationTracker.getStats() 
      : null,
    
    // Stats do OrderBookAnalyzer
    orderBookAnalyzer: this.orderBookAnalyzer  // ← ADICIONAR
      ? this.orderBookAnalyzer.getStats()
      : null
  };
}
```

---

### **Passo 3: Adicionar Endpoints no server.js**

Abra `server.js` e localize o final da seção de endpoints (após os endpoints de liquidações, linha ~900).

Adicione:

```javascript
// ============================================================================
// ORDER BOOK ENDPOINTS
// ============================================================================

// Endpoint 1: Todas as métricas
this.app.get('/api/orderbook/metrics', async (req, res) => {
  try {
    const metrics = this.dataCollector.getOrderBookMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date()
    });
  } catch (error) {
    this.logger.error('Erro ao obter orderbook metrics', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint 2: Book Imbalance
this.app.get('/api/orderbook/imbalance', async (req, res) => {
  try {
    const imbalance = this.dataCollector.getOrderBookImbalance();
    
    // Adicionar interpretação
    let interpretation = {
      message: '',
      confidence: 'LOW',
      recommendation: ''
    };
    
    if (Math.abs(imbalance.BI) > 0.6) {
      interpretation.message = `Pressão de ${imbalance.direction === 'BULLISH' ? 'compra' : 'venda'} FORTE`;
      interpretation.confidence = 'HIGH';
    } else if (Math.abs(imbalance.BI) > 0.3) {
      interpretation.message = `Pressão de ${imbalance.direction === 'BULLISH' ? 'compra' : 'venda'} MODERADA`;
      interpretation.confidence = 'MEDIUM';
    } else {
      interpretation.message = 'Mercado NEUTRO';
      interpretation.confidence = 'LOW';
    }
    
    if (imbalance.persistence > 0.8) {
      interpretation.recommendation = 'Fluxo direcional MUITO sustentado (H1)';
    } else if (imbalance.persistence > 0.5) {
      interpretation.recommendation = 'Fluxo direcional sustentado';
    } else if (imbalance.persistence < 0.3) {
      interpretation.recommendation = 'Fluxo oscilando - possível H2';
    } else {
      interpretation.recommendation = 'Fluxo moderado';
    }
    
    res.json({
      success: true,
      data: {
        ...imbalance,
        interpretation
      },
      timestamp: new Date()
    });
  } catch (error) {
    this.logger.error('Erro ao obter orderbook imbalance', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint 3: Depth
this.app.get('/api/orderbook/depth', async (req, res) => {
  try {
    const depth = this.dataCollector.getOrderBookDepth();
    
    // Adicionar interpretação
    let interpretation = {
      liquidityLevel: 'MEDIUM',
      message: '',
      risk: 'MEDIUM'
    };
    
    if (depth.change < -0.5) {
      interpretation.liquidityLevel = 'VERY_LOW';
      interpretation.message = `Liquidez MUITO baixa (${(depth.change * 100).toFixed(1)}% abaixo da média)`;
      interpretation.risk = 'VERY_HIGH';
    } else if (depth.change < -0.3) {
      interpretation.liquidityLevel = 'LOW';
      interpretation.message = `Liquidez secando (${(depth.change * 100).toFixed(1)}% abaixo da média) - possível H3`;
      interpretation.risk = 'HIGH';
    } else if (depth.change > 0.3) {
      interpretation.liquidityLevel = 'HIGH';
      interpretation.message = `Liquidez alta (${(depth.change * 100).toFixed(1)}% acima da média)`;
      interpretation.risk = 'LOW';
    } else if (depth.change > 0) {
      interpretation.liquidityLevel = 'MEDIUM';
      interpretation.message = `Liquidez acima da média (${(depth.change * 100).toFixed(1)}%)`;
      interpretation.risk = 'LOW';
    } else {
      interpretation.liquidityLevel = 'MEDIUM';
      interpretation.message = `Liquidez abaixo da média (${(depth.change * 100).toFixed(1)}%)`;
      interpretation.risk = 'MEDIUM';
    }
    
    res.json({
      success: true,
      data: {
        ...depth,
        interpretation
      },
      timestamp: new Date()
    });
  } catch (error) {
    this.logger.error('Erro ao obter orderbook depth', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint 4: Spread
this.app.get('/api/orderbook/spread', async (req, res) => {
  try {
    const spread = this.dataCollector.getOrderBookSpread();
    
    // Adicionar interpretação
    let interpretation = {
      quality: 'FAIR',
      message: '',
      volatility: 'MEDIUM'
    };
    
    const spread_bps = spread.spread_pct * 10000;
    
    if (spread_bps < 1) {
      interpretation.quality = 'EXCELLENT';
      interpretation.message = `Spread muito apertado (${spread_bps.toFixed(2)} bps)`;
    } else if (spread_bps < 5) {
      interpretation.quality = 'GOOD';
      interpretation.message = `Spread bom (${spread_bps.toFixed(2)} bps)`;
    } else if (spread_bps < 10) {
      interpretation.quality = 'FAIR';
      interpretation.message = `Spread razoável (${spread_bps.toFixed(2)} bps)`;
    } else {
      interpretation.quality = 'POOR';
      interpretation.message = `Spread largo (${spread_bps.toFixed(2)} bps) - baixa liquidez`;
    }
    
    if (spread.pulse < 0.00001) {
      interpretation.volatility = 'LOW';
    } else if (spread.pulse < 0.00005) {
      interpretation.volatility = 'MEDIUM';
    } else {
      interpretation.volatility = 'HIGH';
    }
    
    res.json({
      success: true,
      data: {
        ...spread,
        interpretation
      },
      timestamp: new Date()
    });
  } catch (error) {
    this.logger.error('Erro ao obter orderbook spread', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint 5: Walls
this.app.get('/api/orderbook/walls', async (req, res) => {
  try {
    const walls = this.dataCollector.getOrderBookWalls();
    
    // Adicionar interpretação
    let interpretation = {
      message: '',
      significance: 'LOW'
    };
    
    if (walls.bidWall && walls.askWall) {
      interpretation.message = `Walls em ambos os lados: suporte em ${walls.bidWall.price.toFixed(2)} e resistência em ${walls.askWall.price.toFixed(2)}`;
      interpretation.significance = 'VERY_HIGH';
    } else if (walls.bidWall) {
      const strength = walls.bidWall.ratio > 20 ? 'MUITO forte' : 'forte';
      interpretation.message = `Wall de suporte ${strength} em ${walls.bidWall.price.toFixed(2)} (${walls.bidWall.distance.toFixed(2)}% abaixo)`;
      interpretation.significance = walls.bidWall.ratio > 20 ? 'VERY_HIGH' : 'HIGH';
      
      walls.bidWall.type = 'SUPPORT';
      walls.bidWall.strength = walls.bidWall.ratio > 20 ? 'VERY_STRONG' : 'STRONG';
    } else if (walls.askWall) {
      const strength = walls.askWall.ratio > 20 ? 'MUITO forte' : 'forte';
      interpretation.message = `Wall de resistência ${strength} em ${walls.askWall.price.toFixed(2)} (${walls.askWall.distance.toFixed(2)}% acima)`;
      interpretation.significance = walls.askWall.ratio > 20 ? 'VERY_HIGH' : 'HIGH';
      
      walls.askWall.type = 'RESISTANCE';
      walls.askWall.strength = walls.askWall.ratio > 20 ? 'VERY_STRONG' : 'STRONG';
    } else {
      interpretation.message = 'Nenhuma wall significativa detectada';
      interpretation.significance = 'LOW';
    }
    
    res.json({
      success: true,
      data: {
        ...walls,
        interpretation
      },
      timestamp: new Date()
    });
  } catch (error) {
    this.logger.error('Erro ao obter orderbook walls', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint 6: Energy
this.app.get('/api/orderbook/energy', async (req, res) => {
  try {
    const energy = this.dataCollector.getOrderBookEnergy();
    
    // Adicionar interpretação
    let interpretation = {
      message: '',
      recommendation: ''
    };
    
    if (energy.level === 'HIGH') {
      interpretation.message = 'Energia sustentada ALTA';
      interpretation.recommendation = 'Fluxo forte e persistente - favorece H1';
    } else if (energy.level === 'MEDIUM') {
      interpretation.message = 'Energia sustentada MÉDIA';
      interpretation.recommendation = 'Fluxo presente mas não dominante';
    } else {
      interpretation.message = 'Energia sustentada BAIXA';
      interpretation.recommendation = 'Fluxo fraco - possível H2 ou mercado preso';
    }
    
    res.json({
      success: true,
      data: {
        ...energy,
        interpretation
      },
      timestamp: new Date()
    });
  } catch (error) {
    this.logger.error('Erro ao obter orderbook energy', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint 7: History
this.app.get('/api/orderbook/history', async (req, res) => {
  try {
    const window = Math.min(parseInt(req.query.window) || 60, 60);
    const history = this.dataCollector.getOrderBookHistory();
    
    const cutoff = Date.now() - (window * 1000);
    const filtered = {
      BI_history: history.BI_history.filter(h => h.time > cutoff),
      depth_history: history.depth_history.filter(h => h.time > cutoff),
      spread_history: history.spread_history.filter(h => h.time > cutoff)
    };
    
    const stats = {
      dataPoints: filtered.BI_history.length,
      window: window,
      avgBI: filtered.BI_history.length > 0 
        ? filtered.BI_history.reduce((sum, h) => sum + h.BI, 0) / filtered.BI_history.length 
        : 0,
      avgDepth: filtered.depth_history.length > 0
        ? filtered.depth_history.reduce((sum, h) => sum + h.totalDepth, 0) / filtered.depth_history.length
        : 0,
      avgSpread: filtered.spread_history.length > 0
        ? filtered.spread_history.reduce((sum, h) => sum + h.spread, 0) / filtered.spread_history.length
        : 0
    };
    
    res.json({
      success: true,
      data: {
        ...filtered,
        stats
      },
      timestamp: new Date()
    });
  } catch (error) {
    this.logger.error('Erro ao obter orderbook history', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

### **Passo 4: Reiniciar Backend**

```bash
cd C:\Users\vruss\nodejs-cryptos\gamma-tracker\backend
node server.js
```

**Verificar console:**
```
✅ OrderBookAnalyzer conectado
```

---

## 🧪 Testes

### **Teste 1: Verificar Conexão**

```bash
curl http://localhost:3300/api/orderbook/metrics
```

**Resultado esperado:**
```json
{
  "success": true,
  "data": {
    "BI": 0.45,
    "BI_direction": "BULLISH",
    "totalDepth": 2100.8,
    "energyScore": 0.68,
    ...
  }
}
```

### **Teste 2: Book Imbalance**

```bash
curl http://localhost:3300/api/orderbook/imbalance
```

### **Teste 3: Energy Score**

```bash
curl http://localhost:3300/api/orderbook/energy
```

### **Teste 4: Walls**

```bash
curl http://localhost:3300/api/orderbook/walls
```

---

## 📊 Endpoints Disponíveis

| Endpoint | Descrição | Uso Principal |
|----------|-----------|---------------|
| `/api/orderbook/metrics` | Todas as métricas | Dashboard geral |
| `/api/orderbook/imbalance` | Book Imbalance (BI) | Detectar pressão direcional |
| `/api/orderbook/depth` | Profundidade | Detectar H3 (colapso liquidez) |
| `/api/orderbook/spread` | Qualidade do spread | Avaliar execução |
| `/api/orderbook/walls` | Walls detectadas | Suporte/resistência |
| `/api/orderbook/energy` | Energy Score | Half Pipe Model |
| `/api/orderbook/history` | Histórico 60s | Gráficos temporais |

---

## 🎿 Half Pipe Model - Integração

### **Energia Sustentada (Order Book)**

```javascript
const orderBookEnergy = this.dataCollector.getOrderBookEnergy();
// orderBookEnergy.score = 0-1
```

### **Energia Injetada (Liquidations)**

```javascript
const liquidationEnergy = this.dataCollector.getLiquidationEnergy();
// liquidationEnergy.score = 0-1
```

### **Potencial (GEX)**

```javascript
const gex = this.dataCollector.getGEX();
const potential = Math.abs(gex.total) / 1e9;  // Normalizar
```

### **P_escape (Probabilidade de Escape)**

```javascript
const totalEnergy = (
  orderBookEnergy.score * 0.5 +      // Energia sustentada (50%)
  liquidationEnergy.score * 0.5      // Energia injetada (50%)
);

const P_escape = totalEnergy / potential;

if (P_escape > 0.7) {
  console.log('🚨 ESCAPE IMINENTE!');
}
```

---

## 🐛 Troubleshooting

### **Problema: "OrderBookAnalyzer não inicializado"**

**Causa:** DataCollector não foi iniciado ou OrderBookAnalyzer não foi integrado.

**Solução:**
1. Verificar se `DataCollector.start()` foi chamado
2. Verificar se OrderBookAnalyzer foi adicionado no constructor
3. Verificar console para erros de conexão

### **Problema: WebSocket desconecta constantemente**

**Causa:** Problema de rede ou rate limit da Binance.

**Solução:**
1. Verificar conexão com internet
2. Verificar se não há múltiplas instâncias rodando
3. Aumentar `reconnectDelay` no config

### **Problema: Métricas sempre em 0**

**Causa:** Order book não está sendo atualizado.

**Solução:**
1. Verificar se WebSocket está conectado (`isConnected: true`)
2. Verificar se há mensagens chegando (`stats.updates > 0`)
3. Verificar symbol (deve ser lowercase, ex: 'btcusdt')

---

## 📚 Documentação das Métricas

### **Book Imbalance (BI)**

```
BI = (Vbid - Vask) / (Vbid + Vask)

Interpretação:
- BI > 0.6: Pressão de compra FORTE
- BI > 0.3: Pressão de compra MODERADA
- BI ≈ 0: NEUTRO
- BI < -0.3: Pressão de venda MODERADA
- BI < -0.6: Pressão de venda FORTE
```

### **BI Persistence**

```
persistence = count(|BI| > 0.3 na mesma direção) / total_samples

Interpretação:
- persistence > 0.8: Fluxo MUITO sustentado (H1)
- persistence > 0.5: Fluxo sustentado
- persistence < 0.3: Oscilando (H2)
```

### **Depth Change**

```
depthChange = (current - avg) / avg

Interpretação:
- change < -0.3: Liquidez secando (H3)
- change > 0.3: Liquidez aumentando
```

### **Energy Score**

```
energyScore = (
  |BI| * 0.4 +
  persistence * 0.3 +
  spread_quality * 0.2 +
  depth_component * 0.1
)

Interpretação:
- score > 0.7 (HIGH): Energia forte
- score > 0.4 (MEDIUM): Energia moderada
- score < 0.4 (LOW): Energia fraca
```

---

## ✅ Checklist de Integração

- [ ] `OrderBookAnalyzer.js` copiado para `/backend/src/`
- [ ] Import adicionado no `DataCollector.js`
- [ ] Propriedade adicionada no constructor
- [ ] Inicialização adicionada no `start()`
- [ ] Cleanup adicionado no `stop()`
- [ ] Métodos getters adicionados
- [ ] `getStats()` atualizado
- [ ] 7 endpoints adicionados no `server.js`
- [ ] Backend reiniciado
- [ ] Teste: `curl /api/orderbook/metrics` funcionando
- [ ] Teste: `curl /api/orderbook/energy` funcionando
- [ ] Console mostra: `✅ OrderBookAnalyzer conectado`

---

## 🎊 Próximos Passos

Após integrar o OrderBookAnalyzer:

1. ✅ **Testar todos os endpoints**
2. ✅ **Criar EscapeTypeDetector** (H1/H2/H3)
3. ✅ **Criar HalfPipeAnalyzer** (combinar tudo)
4. ✅ **Criar frontend components**
5. ✅ **Backtesting**

---

**Documentação completa! Sistema pronto para uso!** 🚀
