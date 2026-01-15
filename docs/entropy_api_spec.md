# 🔌 API de Entropia - Especificação Técnica

## 📡 **ENDPOINT PRINCIPAL**

### `GET /api/entropy/:symbol`

Retorna dados de entropia do order book em tempo real.

**Parâmetros:**
- `symbol` (path): Par de trading (ex: `BTCUSDT`, `UNIUSDT`)
- `depth` (query, opcional): Profundidade do book (padrão: 80 para altcoins, 40 para BTC/ETH)
- `window` (query, opcional): Janela para cálculo de delta (padrão: 5 minutos)

**Response:**
```json
{
  "success": true,
  "timestamp": "2026-01-04T12:00:00.000Z",
  "symbol": "UNIUSDT",
  "data": {
    "bid_entropy": 5.234,
    "ask_entropy": 5.187,
    "bid_delta_5m": -0.152,
    "ask_delta_5m": 0.083,
    "ratio": 1.009,
    "mid_price": 5.8245,
    "volume_1m": 12450.5,
    "signal": "NEUTRAL",
    "confidence": 0.65,
    "event": null
  },
  "analysis": {
    "bid_status": "NORMAL",
    "ask_status": "NORMAL",
    "interpretation": "Market in equilibrium, no significant concentration detected"
  }
}
```

**Possíveis valores de `signal`:**
- `"BUY"`: Colapso de entropia BID detectado
- `"SELL"`: Aumento de entropia ASK detectado
- `"NEUTRAL"`: Sem sinal claro

**Possíveis valores de `event`:**
- `"BID_COLLAPSE"`: Entropia BID caiu >15% em 5min
- `"ASK_SPIKE"`: Entropia ASK subiu >15% em 5min
- `"BOTH"`: Ambos os eventos simultaneamente
- `null`: Sem evento

---

## 📊 **ENDPOINT DE HISTÓRICO**

### `GET /api/entropy/:symbol/history`

Retorna histórico de entropia para análise e backtesting.

**Parâmetros:**
- `symbol` (path): Par de trading
- `from` (query): Timestamp inicial (ISO 8601)
- `to` (query): Timestamp final (ISO 8601)
- `interval` (query, opcional): Intervalo de agregação (`30s`, `1m`, `5m`, padrão: `30s`)
- `limit` (query, opcional): Número máximo de pontos (padrão: 1000)

**Response:**
```json
{
  "success": true,
  "symbol": "UNIUSDT",
  "interval": "30s",
  "count": 120,
  "data": [
    {
      "timestamp": "2026-01-04T12:00:00.000Z",
      "bid_entropy": 5.234,
      "ask_entropy": 5.187,
      "mid_price": 5.8245,
      "volume_1m": 12450.5,
      "signal": "NEUTRAL",
      "event": null
    },
    // ... mais pontos
  ]
}
```

---

## 🎯 **ENDPOINT DE EVENTOS**

### `GET /api/entropy/events`

Retorna eventos recentes de colapso/spike de entropia.

**Parâmetros:**
- `symbols` (query, opcional): Lista de símbolos separados por vírgula (padrão: todos)
- `type` (query, opcional): Tipo de evento (`BID_COLLAPSE`, `ASK_SPIKE`, `BOTH`)
- `since` (query, opcional): Timestamp mínimo (padrão: últimas 24h)
- `limit` (query, opcional): Número máximo de eventos (padrão: 50)

**Response:**
```json
{
  "success": true,
  "count": 3,
  "events": [
    {
      "id": "evt_1234567890",
      "timestamp": "2026-01-04T11:30:25.000Z",
      "symbol": "UNIUSDT",
      "type": "BID_COLLAPSE",
      "bid_entropy_before": 5.32,
      "bid_entropy_after": 4.28,
      "delta_percent": -19.5,
      "mid_price_at_event": 5.78,
      "volume_spike": 18234.5,
      "outcome": {
        "price_change_5m": +0.35,
        "price_change_15m": +0.52,
        "reversal_confirmed": true
      }
    },
    // ... mais eventos
  ]
}
```

---

## 🔔 **WEBSOCKET**

### `ws://localhost:3300/ws/entropy/:symbol`

Stream em tempo real de dados de entropia.

**Message format:**
```json
{
  "type": "entropy_update",
  "timestamp": "2026-01-04T12:00:00.000Z",
  "symbol": "UNIUSDT",
  "data": {
    "bid_entropy": 5.234,
    "ask_entropy": 5.187,
    "mid_price": 5.8245,
    "volume_1m": 12450.5,
    "signal": "NEUTRAL",
    "event": null
  }
}
```

**Event messages:**
```json
{
  "type": "entropy_event",
  "timestamp": "2026-01-04T11:30:25.000Z",
  "symbol": "UNIUSDT",
  "event": "BID_COLLAPSE",
  "data": {
    "bid_entropy_before": 5.32,
    "bid_entropy_after": 4.28,
    "delta_percent": -19.5,
    "mid_price": 5.78,
    "volume_spike": 18234.5,
    "confidence": 0.92
  },
  "alert": {
    "severity": "HIGH",
    "message": "Strong BID collapse detected! Potential reversal imminent.",
    "suggested_action": "BUY"
  }
}
```

---

## 🔧 **IMPLEMENTAÇÃO BACKEND**

### **Estrutura de arquivos:**

```
backend/
├── services/
│   ├── entropyService.ts        # Cálculo de entropia
│   ├── orderBookService.ts      # Coleta de order book
│   └── eventDetectionService.ts # Detecção de eventos
├── routes/
│   └── entropy.ts               # Rotas da API
├── models/
│   ├── EntropyData.ts           # Modelo de dados
│   └── EntropyEvent.ts          # Modelo de eventos
├── utils/
│   ├── shannon.ts               # Fórmula de Shannon
│   └── statistics.ts            # Bandas, deltas, etc.
└── websockets/
    └── entropySocket.ts         # WebSocket handler
```

---

### **entropyService.ts (Core)**

```typescript
import { calculateShannon } from '../utils/shannon';

interface OrderBookLevel {
  price: number;
  volume: number;
}

interface EntropyResult {
  bid_entropy: number;
  ask_entropy: number;
  mid_price: number;
  timestamp: Date;
}

export class EntropyService {
  /**
   * Calcula entropia de Shannon para order book
   */
  calculateEntropy(levels: OrderBookLevel[]): number {
    const volumes = levels.map(l => l.volume);
    return calculateShannon(volumes);
  }

  /**
   * Processa snapshot do order book
   */
  async processOrderBook(
    symbol: string,
    depth: number = 80
  ): Promise<EntropyResult> {
    // 1. Buscar order book da exchange
    const orderBook = await this.fetchOrderBook(symbol, depth);

    // 2. Calcular entropias
    const bid_entropy = this.calculateEntropy(orderBook.bids);
    const ask_entropy = this.calculateEntropy(orderBook.asks);

    // 3. Calcular mid-price
    const best_bid = orderBook.bids[0].price;
    const best_ask = orderBook.asks[0].price;
    const mid_price = (best_bid + best_ask) / 2;

    return {
      bid_entropy,
      ask_entropy,
      mid_price,
      timestamp: new Date()
    };
  }

  /**
   * Detecta eventos (colapsos, spikes)
   */
  detectEvent(
    current: EntropyResult,
    history: EntropyResult[]
  ): EntropyEvent | null {
    if (history.length < 10) return null;

    // Pegar entropia de 5 minutos atrás
    const fiveMinAgo = history[history.length - 10]; // Assumindo 30s interval

    // Calcular deltas
    const bid_delta = (current.bid_entropy - fiveMinAgo.bid_entropy) / fiveMinAgo.bid_entropy;
    const ask_delta = (current.ask_entropy - fiveMinAgo.ask_entropy) / fiveMinAgo.ask_entropy;

    // Detectar colapso BID (reversão de fundo)
    if (bid_delta < -0.15) {
      return {
        type: 'BID_COLLAPSE',
        timestamp: current.timestamp,
        delta_percent: bid_delta * 100,
        confidence: Math.min(Math.abs(bid_delta) / 0.20, 1.0),
        signal: 'BUY'
      };
    }

    // Detectar spike ASK (reversão de topo)
    if (ask_delta > 0.15) {
      return {
        type: 'ASK_SPIKE',
        timestamp: current.timestamp,
        delta_percent: ask_delta * 100,
        confidence: Math.min(ask_delta / 0.20, 1.0),
        signal: 'SELL'
      };
    }

    return null;
  }
}
```

---

### **shannon.ts (Utility)**

```typescript
/**
 * Calcula entropia de Shannon
 * H = -Σ (p_i * log₂(p_i))
 */
export function calculateShannon(volumes: number[]): number {
  // Filtrar volumes válidos
  const validVolumes = volumes.filter(v => v > 0);
  if (validVolumes.length === 0) return 0;

  // Calcular total
  const total = validVolumes.reduce((sum, v) => sum + v, 0);
  if (total === 0) return 0;

  // Calcular probabilidades
  const probabilities = validVolumes.map(v => v / total);

  // Calcular entropia
  const entropy = -probabilities.reduce((sum, p) => {
    return sum + (p * Math.log2(p));
  }, 0);

  return entropy;
}

/**
 * Calcula banda dinâmica (Bollinger-style)
 */
export function calculateDynamicBand(
  values: number[],
  window: number = 20,
  stdDevs: number = 2
): { mean: number; upper: number; lower: number } {
  if (values.length < window) {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    return { mean, upper: mean, lower: mean };
  }

  // Últimos N valores
  const recent = values.slice(-window);

  // Média
  const mean = recent.reduce((sum, v) => sum + v, 0) / window;

  // Desvio padrão
  const variance = recent.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / window;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    upper: mean + (stdDevs * stdDev),
    lower: mean - (stdDevs * stdDev)
  };
}
```

---

### **entropy.ts (Routes)**

```typescript
import express from 'express';
import { EntropyService } from '../services/entropyService';

const router = express.Router();
const entropyService = new EntropyService();

// GET /api/entropy/:symbol
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const depth = parseInt(req.query.depth as string) || 80;
    const window = parseInt(req.query.window as string) || 5;

    // Calcular entropia atual
    const current = await entropyService.processOrderBook(symbol, depth);

    // Buscar histórico
    const history = await entropyService.getHistory(symbol, window);

    // Detectar eventos
    const event = entropyService.detectEvent(current, history);

    // Calcular deltas
    const fiveMinAgo = history[history.length - 10];
    const bid_delta_5m = fiveMinAgo 
      ? (current.bid_entropy - fiveMinAgo.bid_entropy) / fiveMinAgo.bid_entropy
      : 0;
    const ask_delta_5m = fiveMinAgo
      ? (current.ask_entropy - fiveMinAgo.ask_entropy) / fiveMinAgo.ask_entropy
      : 0;

    // Calcular ratio
    const ratio = current.bid_entropy / current.ask_entropy;

    // Determinar sinal
    let signal = 'NEUTRAL';
    let confidence = 0.5;
    if (event) {
      signal = event.signal;
      confidence = event.confidence;
    }

    res.json({
      success: true,
      timestamp: current.timestamp,
      symbol,
      data: {
        bid_entropy: current.bid_entropy,
        ask_entropy: current.ask_entropy,
        bid_delta_5m,
        ask_delta_5m,
        ratio,
        mid_price: current.mid_price,
        volume_1m: current.volume_1m,
        signal,
        confidence,
        event: event?.type || null
      },
      analysis: {
        bid_status: bid_delta_5m < -0.15 ? 'COLLAPSE' : 'NORMAL',
        ask_status: ask_delta_5m > 0.15 ? 'SPIKE' : 'NORMAL',
        interpretation: event?.interpretation || 'Market in equilibrium'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
```

---

## 🎯 **INTEGRAÇÃO COM HALF PIPE**

### **Adicionar ao Half Pipe Command Center:**

1. **Novo card "Entropy Monitor":**
   ```tsx
   <Card className="p-6">
     <h3>📊 Entropy Monitor</h3>
     <div className="grid grid-cols-2 gap-4">
       <div>
         <span>BID Entropy:</span>
         <span className={bidEntropyClass}>{bidEntropy.toFixed(2)}</span>
         <span className="text-xs">{bidDelta > 0 ? '+' : ''}{(bidDelta * 100).toFixed(1)}%</span>
       </div>
       <div>
         <span>ASK Entropy:</span>
         <span className={askEntropyClass}>{askEntropy.toFixed(2)}</span>
         <span className="text-xs">{askDelta > 0 ? '+' : ''}{(askDelta * 100).toFixed(1)}%</span>
       </div>
     </div>
     {event && (
       <Alert variant="warning">
         <AlertTriangle className="w-4 h-4" />
         <span>{event.message}</span>
       </Alert>
     )}
   </Card>
   ```

2. **Gráfico de entropia (como o seu!):**
   ```tsx
   <Card className="p-6">
     <h3>Entropy History</h3>
     <ResponsiveContainer width="100%" height={400}>
       <LineChart data={entropyHistory}>
         <Line dataKey="bid_entropy" stroke="#00ff00" name="BID" />
         <Line dataKey="ask_entropy" stroke="#ff0000" name="ASK" />
         <Line dataKey="mid_price" stroke="#ffaa00" yAxisId="right" />
         <YAxis />
         <YAxis yAxisId="right" orientation="right" />
         <Tooltip />
         <Legend />
       </LineChart>
     </ResponsiveContainer>
   </Card>
   ```

3. **Alertas em tempo real:**
   ```tsx
   useEffect(() => {
     const ws = new WebSocket(`ws://localhost:3300/ws/entropy/BTCUSDT`);
     
     ws.onmessage = (event) => {
       const data = JSON.parse(event.data);
       
       if (data.type === 'entropy_event') {
         toast({
           title: data.event === 'BID_COLLAPSE' ? '🟢 Reversão Detectada!' : '🔴 Topo Detectado!',
           description: data.alert.message,
           variant: data.alert.severity === 'HIGH' ? 'destructive' : 'default'
         });
       }
     };
   }, []);
   ```

---

## 🚀 **PRÓXIMOS PASSOS**

1. ✅ Implementar `entropyService.ts`
2. ✅ Criar rotas `/api/entropy`
3. ✅ Adicionar WebSocket handler
4. ✅ Integrar no Half Pipe frontend
5. ✅ Adicionar persistência (PostgreSQL/Redis)
6. ✅ Criar dashboard dedicado
7. ✅ Implementar backtesting
8. ✅ Multi-symbol support

---

**API pronta para implementação!** 🎯
