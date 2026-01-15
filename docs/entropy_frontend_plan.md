# 🎨 Integração Frontend - Entropy Monitor

## 🎯 **VISÃO GERAL**

Adicionar visualização de entropia do order book ao **Half Pipe Command Center**, mantendo o estilo visual do seu script Streamlit.

---

## 📊 **COMPONENTES NECESSÁRIOS**

### **1. EntropyChart.tsx** (Componente principal)

Gráfico de 2 painéis (como o seu!):
- Painel superior: Entropia BID/ASK + Preço
- Painel inferior: Volume com destaques

```tsx
import { LineChart, BarChart, Line, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';

interface EntropyChartProps {
  data: EntropyDataPoint[];
  symbol: string;
}

interface EntropyDataPoint {
  timestamp: string;
  bid_entropy: number;
  ask_entropy: number;
  mid_price: number;
  volume_1m: number;
  event?: 'BID_COLLAPSE' | 'ASK_SPIKE' | 'BOTH' | null;
}

export function EntropyChart({ data, symbol }: EntropyChartProps) {
  // Identificar eventos para marcadores
  const bidEvents = data.filter(d => d.event === 'BID_COLLAPSE');
  const askEvents = data.filter(d => d.event === 'ASK_SPIKE');
  const bothEvents = data.filter(d => d.event === 'BOTH');

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold mb-4">
        📊 Entropy BID/ASK + Price + Volume – {symbol}
      </h3>

      {/* Painel Superior: Entropia + Preço */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          {/* Eixo X */}
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
          />

          {/* Eixo Y Esquerdo: Entropia */}
          <YAxis 
            yAxisId="entropy"
            label={{ value: 'Entropy', angle: -90, position: 'insideLeft' }}
            domain={[0, 'auto']}
          />

          {/* Eixo Y Direito: Preço */}
          <YAxis 
            yAxisId="price"
            orientation="right"
            label={{ value: `Price ${symbol}`, angle: 90, position: 'insideRight' }}
          />

          {/* Linhas de Entropia */}
          <Line 
            yAxisId="entropy"
            type="monotone"
            dataKey="bid_entropy"
            stroke="#00ff00"
            name="Entropy BID"
            strokeWidth={2}
            dot={{ r: 3 }}
          />

          <Line 
            yAxisId="entropy"
            type="monotone"
            dataKey="ask_entropy"
            stroke="#ff0000"
            name="Entropy ASK"
            strokeWidth={2}
            dot={{ r: 3 }}
          />

          {/* Linha de Preço (pontilhada) */}
          <Line 
            yAxisId="price"
            type="monotone"
            dataKey="mid_price"
            stroke="#ffaa00"
            strokeDasharray="5 5"
            name={`Price ${symbol}`}
            strokeWidth={2}
            dot={{ r: 2 }}
          />

          {/* Marcadores de Eventos (Estrelas) */}
          {bidEvents.map((event, i) => (
            <scatter
              key={`bid-${i}`}
              data={[event]}
              fill="#00ff00"
              shape="star"
              size={100}
            />
          ))}

          {askEvents.map((event, i) => (
            <scatter
              key={`ask-${i}`}
              data={[event]}
              fill="#ff0000"
              shape="star"
              size={100}
            />
          ))}

          <Tooltip 
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
            labelFormatter={(ts) => new Date(ts).toLocaleString()}
          />
          <Legend />
        </LineChart>
      </ResponsiveContainer>

      {/* Painel Inferior: Volume */}
      <ResponsiveContainer width="100%" height={150} className="mt-4">
        <BarChart data={data}>
          <XAxis 
            dataKey="timestamp"
            tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
          />
          <YAxis label={{ value: 'Volume (1m)', angle: -90, position: 'insideLeft' }} />

          {/* Barras de Volume */}
          <Bar 
            dataKey="volume_1m"
            fill="#00aaff"
            opacity={0.6}
            name="Volume (1m)"
          />

          {/* Destaque em eventos BID */}
          <Bar 
            dataKey={(d) => d.event === 'BID_COLLAPSE' ? d.volume_1m : 0}
            fill="#00ff00"
            opacity={0.9}
            name="Volume (BID Event)"
          />

          {/* Destaque em eventos ASK */}
          <Bar 
            dataKey={(d) => d.event === 'ASK_SPIKE' ? d.volume_1m : 0}
            fill="#ff0000"
            opacity={0.9}
            name="Volume (ASK Event)"
          />

          {/* Destaque em eventos BOTH */}
          <Bar 
            dataKey={(d) => d.event === 'BOTH' ? d.volume_1m : 0}
            fill="#ff00ff"
            opacity={0.95}
            name="Volume (BOTH Events)"
          />

          <Tooltip />
          <Legend />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
```

---

### **2. EntropyMetricsCard.tsx** (Card de métricas)

Mostra valores atuais e deltas:

```tsx
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface EntropyMetricsProps {
  bidEntropy: number;
  askEntropy: number;
  bidDelta: number;
  askDelta: number;
  ratio: number;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
}

export function EntropyMetricsCard({
  bidEntropy,
  askEntropy,
  bidDelta,
  askDelta,
  ratio,
  signal,
  confidence
}: EntropyMetricsProps) {
  // Cores baseadas em delta
  const getBidColor = () => {
    if (bidDelta < -0.15) return 'text-green-400'; // Colapso = bullish
    if (bidDelta > 0.15) return 'text-yellow-400';
    return 'text-gray-400';
  };

  const getAskColor = () => {
    if (askDelta > 0.15) return 'text-red-400'; // Spike = bearish
    if (askDelta < -0.15) return 'text-yellow-400';
    return 'text-gray-400';
  };

  const getTrendIcon = (delta: number) => {
    if (delta < -0.05) return <TrendingDown className="w-4 h-4" />;
    if (delta > 0.05) return <TrendingUp className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold mb-4">📊 Entropy Metrics</h3>

      <div className="grid grid-cols-2 gap-6">
        {/* BID Entropy */}
        <div className="space-y-2">
          <div className="text-sm text-gray-400">BID Entropy</div>
          <div className={`text-3xl font-bold ${getBidColor()}`}>
            {bidEntropy.toFixed(3)}
          </div>
          <div className="flex items-center gap-2 text-sm">
            {getTrendIcon(bidDelta)}
            <span className={bidDelta < 0 ? 'text-red-400' : 'text-green-400'}>
              {bidDelta > 0 ? '+' : ''}{(bidDelta * 100).toFixed(1)}%
            </span>
            <span className="text-gray-500">5m</span>
          </div>
        </div>

        {/* ASK Entropy */}
        <div className="space-y-2">
          <div className="text-sm text-gray-400">ASK Entropy</div>
          <div className={`text-3xl font-bold ${getAskColor()}`}>
            {askEntropy.toFixed(3)}
          </div>
          <div className="flex items-center gap-2 text-sm">
            {getTrendIcon(askDelta)}
            <span className={askDelta > 0 ? 'text-green-400' : 'text-red-400'}>
              {askDelta > 0 ? '+' : ''}{(askDelta * 100).toFixed(1)}%
            </span>
            <span className="text-gray-500">5m</span>
          </div>
        </div>
      </div>

      {/* Ratio */}
      <div className="mt-6 pt-6 border-t border-gray-700">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">BID/ASK Ratio:</span>
          <span className="text-lg font-bold">{ratio.toFixed(3)}</span>
        </div>
      </div>

      {/* Signal */}
      {signal !== 'NEUTRAL' && (
        <div className={`mt-4 p-4 rounded-lg ${
          signal === 'BUY' ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'
        }`}>
          <div className="flex items-center justify-between">
            <span className="font-bold">
              {signal === 'BUY' ? '🟢 BUY SIGNAL' : '🔴 SELL SIGNAL'}
            </span>
            <span className="text-sm">
              {(confidence * 100).toFixed(0)}% confidence
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
```

---

### **3. EntropyEventAlert.tsx** (Alertas de eventos)

Banner de alerta quando evento é detectado:

```tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface EntropyEventAlertProps {
  event: {
    type: 'BID_COLLAPSE' | 'ASK_SPIKE' | 'BOTH';
    timestamp: string;
    delta_percent: number;
    confidence: number;
    message: string;
  } | null;
}

export function EntropyEventAlert({ event }: EntropyEventAlertProps) {
  if (!event) return null;

  const getVariant = () => {
    if (event.type === 'BID_COLLAPSE') return 'success';
    if (event.type === 'ASK_SPIKE') return 'destructive';
    return 'warning';
  };

  const getIcon = () => {
    if (event.type === 'BID_COLLAPSE') return <TrendingUp className="w-5 h-5" />;
    if (event.type === 'ASK_SPIKE') return <TrendingDown className="w-5 h-5" />;
    return <AlertTriangle className="w-5 h-5" />;
  };

  const getTitle = () => {
    if (event.type === 'BID_COLLAPSE') return '🟢 BID ENTROPY COLLAPSE DETECTED';
    if (event.type === 'ASK_SPIKE') return '🔴 ASK ENTROPY SPIKE DETECTED';
    return '⚠️ ENTROPY ANOMALY DETECTED';
  };

  return (
    <Alert variant={getVariant()} className="mb-6">
      {getIcon()}
      <AlertTitle className="text-lg font-bold">{getTitle()}</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-1">
          <p>{event.message}</p>
          <div className="flex gap-4 text-sm mt-2">
            <span>Delta: <strong>{event.delta_percent.toFixed(1)}%</strong></span>
            <span>Confidence: <strong>{(event.confidence * 100).toFixed(0)}%</strong></span>
            <span>Time: <strong>{new Date(event.timestamp).toLocaleTimeString()}</strong></span>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
```

---

### **4. useEntropyData.ts** (Hook customizado)

Gerencia fetching e WebSocket:

```tsx
import { useState, useEffect } from 'react';
import axios from 'axios';

interface EntropyData {
  bid_entropy: number;
  ask_entropy: number;
  bid_delta_5m: number;
  ask_delta_5m: number;
  ratio: number;
  mid_price: number;
  volume_1m: number;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  event: 'BID_COLLAPSE' | 'ASK_SPIKE' | 'BOTH' | null;
}

export function useEntropyData(symbol: string, autoRefresh: boolean = true) {
  const [data, setData] = useState<EntropyData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch inicial
  useEffect(() => {
    fetchEntropy();
  }, [symbol]);

  // Auto-refresh via polling
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchEntropy();
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [symbol, autoRefresh]);

  // WebSocket para eventos em tempo real
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3300/ws/entropy/${symbol}`);

    ws.onmessage = (msg) => {
      const payload = JSON.parse(msg.data);

      if (payload.type === 'entropy_update') {
        setData(payload.data);
        setHistory(prev => [...prev, {
          timestamp: payload.timestamp,
          ...payload.data
        }].slice(-1000)); // Manter últimos 1000 pontos
      }

      if (payload.type === 'entropy_event') {
        setEvent(payload);
        // Auto-limpar evento após 30 segundos
        setTimeout(() => setEvent(null), 30000);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    return () => ws.close();
  }, [symbol]);

  const fetchEntropy = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:3300/api/entropy/${symbol}`);
      setData(response.data.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    history,
    event,
    loading,
    error,
    refetch: fetchEntropy
  };
}
```

---

## 🎨 **INTEGRAÇÃO NO HALF PIPE**

### **Adicionar nova aba "Entropy":**

```tsx
// HalfPipe.tsx

import { EntropyChart } from '@/components/EntropyChart';
import { EntropyMetricsCard } from '@/components/EntropyMetricsCard';
import { EntropyEventAlert } from '@/components/EntropyEventAlert';
import { useEntropyData } from '@/hooks/useEntropyData';

export default function HalfPipe() {
  const { data, history, event, loading } = useEntropyData('BTCUSDT', true);

  return (
    <div className="min-h-screen bg-background p-6">
      {/* ... Header existente ... */}

      {/* Alerta de Evento */}
      {event && <EntropyEventAlert event={event} />}

      {/* Grid de Métricas + Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        {/* Métricas (25% width) */}
        <div className="lg:col-span-1">
          {data && (
            <EntropyMetricsCard
              bidEntropy={data.bid_entropy}
              askEntropy={data.ask_entropy}
              bidDelta={data.bid_delta_5m}
              askDelta={data.ask_delta_5m}
              ratio={data.ratio}
              signal={data.signal}
              confidence={data.confidence}
            />
          )}
        </div>

        {/* Gráfico (75% width) */}
        <div className="lg:col-span-3">
          <EntropyChart data={history} symbol="BTCUSDT" />
        </div>
      </div>

      {/* ... Resto do conteúdo ... */}
    </div>
  );
}
```

---

## 🔔 **NOTIFICAÇÕES**

### **Toast notifications para eventos:**

```tsx
import { toast } from 'sonner';

// No useEffect do WebSocket:
if (payload.type === 'entropy_event') {
  const { event, data, alert } = payload;

  toast(alert.message, {
    description: `${data.delta_percent.toFixed(1)}% change | ${(data.confidence * 100).toFixed(0)}% confidence`,
    icon: event === 'BID_COLLAPSE' ? '🟢' : '🔴',
    duration: 10000,
    action: {
      label: 'View',
      onClick: () => {
        // Scroll para o gráfico
        document.getElementById('entropy-chart')?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
}
```

---

## 🎯 **CONTROLES DE USUÁRIO**

### **Painel de configuração:**

```tsx
<Card className="p-6 mb-6">
  <h3 className="text-lg font-bold mb-4">⚙️ Entropy Settings</h3>

  <div className="grid grid-cols-3 gap-4">
    {/* Profundidade */}
    <div>
      <label className="text-sm text-gray-400">Order Book Depth</label>
      <select 
        value={depth}
        onChange={(e) => setDepth(parseInt(e.target.value))}
        className="w-full mt-1 p-2 bg-gray-800 rounded"
      >
        <option value={20}>20 levels</option>
        <option value={40}>40 levels (BTC/ETH)</option>
        <option value={80}>80 levels (Altcoins)</option>
        <option value={100}>100 levels</option>
      </select>
    </div>

    {/* Intervalo */}
    <div>
      <label className="text-sm text-gray-400">Update Interval</label>
      <select 
        value={interval}
        onChange={(e) => setInterval(parseInt(e.target.value))}
        className="w-full mt-1 p-2 bg-gray-800 rounded"
      >
        <option value={5}>5 seconds</option>
        <option value={15}>15 seconds</option>
        <option value={30}>30 seconds</option>
        <option value={60}>1 minute</option>
      </select>
    </div>

    {/* Threshold */}
    <div>
      <label className="text-sm text-gray-400">Event Threshold</label>
      <input 
        type="number"
        value={threshold}
        onChange={(e) => setThreshold(parseFloat(e.target.value))}
        step={0.05}
        min={0.10}
        max={0.30}
        className="w-full mt-1 p-2 bg-gray-800 rounded"
      />
      <span className="text-xs text-gray-500">Delta % for alerts</span>
    </div>
  </div>
</Card>
```

---

## 🚀 **ROADMAP DE IMPLEMENTAÇÃO**

### **Fase 1: MVP (1-2 dias)**
- ✅ Hook `useEntropyData`
- ✅ Componente `EntropyMetricsCard`
- ✅ Integração básica no Half Pipe

### **Fase 2: Visualização (2-3 dias)**
- ✅ Componente `EntropyChart` (2 painéis)
- ✅ Marcadores de eventos (estrelas)
- ✅ Destaque de volume

### **Fase 3: Alertas (1 dia)**
- ✅ Componente `EntropyEventAlert`
- ✅ Toast notifications
- ✅ WebSocket integration

### **Fase 4: Configuração (1 dia)**
- ✅ Painel de settings
- ✅ Persistência de preferências
- ✅ Multi-symbol support

### **Fase 5: Polimento (1-2 dias)**
- ✅ Animações e transições
- ✅ Responsive design
- ✅ Performance optimization
- ✅ Testes

---

**Total: 6-9 dias de desenvolvimento** 🚀

**Pronto para começar?** 🎯
