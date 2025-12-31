# 🎯 LiquidationTracker - Guia de Integração

## 📋 Visão Geral

O **LiquidationTracker** monitora liquidações forçadas em tempo real via WebSocket da Binance e calcula métricas de "energia" para o modelo Half Pipe.

---

## 🚀 Instalação

### Passo 1: Copiar Arquivo

```bash
cd C:\Users\vruss\nodejs-cryptos\gamma-tracker\backend\src

# Copiar LiquidationTracker.js para o diretório src
copy LiquidationTracker.js .
```

### Passo 2: Verificar Dependências

O `LiquidationTracker` usa apenas módulos nativos do Node.js:
- `ws` (WebSocket) - **já instalado** no projeto
- `events` (EventEmitter) - nativo

Não precisa instalar nada adicional! ✅

---

## 🔧 Integração no Projeto

### Opção 1: Integração no BinanceDataCollector (Recomendado)

Adicione o LiquidationTracker ao seu `BinanceDataCollector.js`:

```javascript
// No topo do arquivo
const LiquidationTracker = require('./LiquidationTracker');

class BinanceDataCollector {
  constructor(logger) {
    this.logger = logger;
    // ... código existente ...
    
    // ✅ ADICIONAR: Inicializar LiquidationTracker
    this.liquidationTracker = new LiquidationTracker('btcusdt', this.logger);
    
    // Eventos
    this.liquidationTracker.on('connected', () => {
      this.logger.info('✅ LiquidationTracker conectado');
    });
    
    this.liquidationTracker.on('liquidation', (liq) => {
      // Opcional: processar cada liquidação
      // this.logger.info(`💥 Liquidation: ${liq.side} $${liq.value.toFixed(2)}`);
    });
    
    this.liquidationTracker.on('cascade', (stats) => {
      this.logger.warn('🚨 CASCATA DE LIQUIDAÇÕES!', stats);
    });
    
    this.liquidationTracker.on('error', (error) => {
      this.logger.error('❌ LiquidationTracker error:', error);
    });
  }
  
  start() {
    // ... código existente ...
    
    // ✅ ADICIONAR: Conectar LiquidationTracker
    this.liquidationTracker.connect();
  }
  
  stop() {
    // ... código existente ...
    
    // ✅ ADICIONAR: Desconectar LiquidationTracker
    this.liquidationTracker.disconnect();
  }
  
  // ✅ ADICIONAR: Método para acessar stats
  getLiquidationStats() {
    return this.liquidationTracker.getStats();
  }
  
  // ✅ ADICIONAR: Método para acessar energy score
  getLiquidationEnergy() {
    return this.liquidationTracker.getEnergyScore();
  }
}
```

---

### Opção 2: Instância Standalone

Se preferir manter separado do `BinanceDataCollector`:

```javascript
// No server.js ou arquivo separado
const LiquidationTracker = require('./LiquidationTracker');

class APIServer {
  constructor() {
    // ... código existente ...
    
    // Criar instância standalone
    this.liquidationTracker = new LiquidationTracker('btcusdt', this.logger);
    
    // Conectar
    this.liquidationTracker.connect();
  }
}
```

---

## 📊 API Endpoints

### Endpoint 1: Estatísticas de Liquidações

```javascript
// No seu server.js, dentro de setupRoutes()

// GET /api/liquidations/stats
this.app.get('/api/liquidations/stats', async (req, res) => {
  try {
    const stats = this.dataCollector.getLiquidationStats();
    // Ou: const stats = this.liquidationTracker.getStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date()
    });
  } catch (error) {
    this.logger.error('Erro ao obter stats de liquidações', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

**Resposta Esperada:**

```json
{
  "success": true,
  "data": {
    "totalValue": {
      "last1h": 2500000,
      "last4h": 8750000,
      "last24h": 45000000
    },
    "imbalance1h": {
      "longLiquidated": 1800000,
      "shortLiquidated": 700000,
      "ratio": 0.72,
      "direction": "BEARISH"
    },
    "cascade": false,
    "largestLiquidation": {
      "timestamp": 1704047400000,
      "side": "SELL",
      "value": 250000,
      "size": "MASSIVE"
    },
    "count": {
      "last1h": 45,
      "last4h": 180,
      "last24h": 892
    },
    "lastUpdate": 1704050000000
  }
}
```

---

### Endpoint 2: Energy Score

```javascript
// GET /api/liquidations/energy
this.app.get('/api/liquidations/energy', async (req, res) => {
  try {
    const energy = this.dataCollector.getLiquidationEnergy();
    // Ou: const energy = this.liquidationTracker.getEnergyScore();
    
    res.json({
      success: true,
      data: energy,
      timestamp: new Date()
    });
  } catch (error) {
    this.logger.error('Erro ao obter energy score', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

**Resposta Esperada:**

```json
{
  "success": true,
  "data": {
    "score": 0.78,
    "level": "HIGH",
    "direction": "BEARISH",
    "components": {
      "value": 0.25,
      "frequency": 0.18,
      "cascade": 0,
      "imbalance": 0.44
    },
    "rawData": {
      "totalValue": { "last1h": 2500000, ... },
      "imbalance1h": { ... },
      ...
    }
  }
}
```

---

### Endpoint 3: Resumo Completo

```javascript
// GET /api/liquidations/summary
this.app.get('/api/liquidations/summary', async (req, res) => {
  try {
    const summary = this.liquidationTracker.getSummary();
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    this.logger.error('Erro ao obter summary', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

## 🎯 Uso Programático

### Obter Estatísticas

```javascript
const stats = liquidationTracker.getStats();

console.log('Total liquidado (1h):', stats.totalValue.last1h);
console.log('Direção:', stats.imbalance1h.direction);
console.log('Cascata detectada:', stats.cascade);
```

### Obter Energy Score

```javascript
const energy = liquidationTracker.getEnergyScore();

console.log('Energy Score:', energy.score);
console.log('Nível:', energy.level);
console.log('Direção:', energy.direction);

if (energy.level === 'EXTREME') {
  console.log('🚨 ENERGIA EXTREMA! Escape iminente!');
}
```

### Obter Liquidações em Intervalo Específico

```javascript
const now = Date.now();
const fiveMinutesAgo = now - (5 * 60 * 1000);

const recentLiquidations = liquidationTracker.getLiquidations(fiveMinutesAgo, now);

console.log(`Liquidações nos últimos 5 min: ${recentLiquidations.length}`);
```

### Detectar "Early Spike" (H2 - Falso Escape)

```javascript
const early = liquidationTracker.getEarlyLiquidations(2); // Primeiros 2 minutos

if (early.percentage > 0.7) {
  console.log('🚨 ALERTA: 70%+ das liquidações nos primeiros 2 min!');
  console.log('Possível falso escape (stop hunt)');
}
```

### Detectar Crescimento de Liquidações (H1 - Escape Bom)

```javascript
const growth = liquidationTracker.getLiquidationGrowth();

if (growth.trend === 'INCREASING') {
  console.log('✅ Liquidações crescendo gradualmente');
  console.log('Possível escape direcional por fluxo real');
}
```

---

## 🎨 Componente React (Frontend)

### LiquidationsCard.tsx

```typescript
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface LiquidationEnergy {
  score: number;
  level: string;
  direction: string;
  components: {
    value: number;
    frequency: number;
    cascade: number;
    imbalance: number;
  };
}

const LiquidationsCard: React.FC = () => {
  const [energy, setEnergy] = useState<LiquidationEnergy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:3300/api/liquidations/energy');
        const result = await response.json();
        if (result.success) {
          setEnergy(result.data);
        }
      } catch (error) {
        console.error('Error fetching liquidation energy:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Atualizar a cada 10s

    return () => clearInterval(interval);
  }, []);

  if (loading || !energy) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>⚡ Liquidation Energy</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'EXTREME': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getDirectionEmoji = (direction: string) => {
    switch (direction) {
      case 'BEARISH': return '📉';
      case 'BULLISH': return '📈';
      default: return '➡️';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>⚡ Liquidation Energy</span>
          <Badge className={getLevelColor(energy.level)}>
            {energy.level}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">Energy Score</span>
            <span className="text-2xl font-bold">{(energy.score * 100).toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${getLevelColor(energy.level)}`}
              style={{ width: `${energy.score * 100}%` }}
            />
          </div>
        </div>

        {/* Direction */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Direction</span>
          <span className="text-lg font-semibold">
            {getDirectionEmoji(energy.direction)} {energy.direction}
          </span>
        </div>

        {/* Components */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Components:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Value: {(energy.components.value * 100).toFixed(0)}%</div>
            <div>Frequency: {(energy.components.frequency * 100).toFixed(0)}%</div>
            <div>Cascade: {energy.components.cascade > 0 ? '🚨 YES' : 'No'}</div>
            <div>Imbalance: {(energy.components.imbalance * 100).toFixed(0)}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LiquidationsCard;
```

---

## 🧪 Testes

### Teste 1: Verificar Conexão

```javascript
const LiquidationTracker = require('./LiquidationTracker');

const tracker = new LiquidationTracker('btcusdt');

tracker.on('connected', () => {
  console.log('✅ Conectado com sucesso!');
});

tracker.on('liquidation', (liq) => {
  console.log('💥 Liquidation:', liq);
});

tracker.connect();

// Deixar rodando por 1 minuto
setTimeout(() => {
  const summary = tracker.getSummary();
  console.log('📊 Summary:', JSON.stringify(summary, null, 2));
  tracker.disconnect();
  process.exit(0);
}, 60000);
```

### Teste 2: Energy Score

```javascript
// Após algumas liquidações serem coletadas
setInterval(() => {
  const energy = tracker.getEnergyScore();
  console.log('⚡ Energy:', energy.score, '|', energy.level, '|', energy.direction);
}, 5000);
```

---

## 📋 Checklist de Integração

- [ ] Copiar `LiquidationTracker.js` para `/backend/src/`
- [ ] Integrar no `BinanceDataCollector.js` (ou criar instância standalone)
- [ ] Adicionar endpoints no `server.js`:
  - [ ] `/api/liquidations/stats`
  - [ ] `/api/liquidations/energy`
  - [ ] `/api/liquidations/summary`
- [ ] Testar conexão WebSocket
- [ ] Verificar se liquidações estão sendo coletadas
- [ ] Testar endpoints via Postman/curl
- [ ] Criar componente React `LiquidationsCard.tsx`
- [ ] Integrar card no dashboard

---

## 🐛 Troubleshooting

### Problema: WebSocket não conecta

**Solução:**
- Verificar firewall/proxy
- Testar URL manualmente: `wss://fstream.binance.com/ws/btcusdt@forceOrder`
- Verificar se `ws` está instalado: `npm list ws`

### Problema: Não recebe liquidações

**Possível causa:** Mercado calmo, poucas liquidações acontecendo.

**Solução:** Aguardar movimento de mercado ou testar com símbolo mais volátil.

### Problema: Stats sempre zerados

**Causa:** Dados sendo limpos muito rapidamente.

**Solução:** Verificar se `cleanupInterval` não está muito curto (padrão: 60s).

---

## 📚 Referências

- **Binance Futures WebSocket:** https://binance-docs.github.io/apidocs/futures/en/#liquidation-order-streams
- **WebSocket Node.js:** https://github.com/websockets/ws

---

**Fim do Guia de Integração**
