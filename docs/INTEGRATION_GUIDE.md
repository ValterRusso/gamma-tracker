# 🚀 Guia de Integração: Deribit API + IV Comparator

## 📦 Arquivos Criados

1. **DeribitAPI.js** - Cliente da API Deribit
2. **IVComparator.js** - Comparador Binance vs Deribit
3. **endpoints_integration.js** - Código dos endpoints para adicionar no server.js

---

## 🔧 Instalação

### 1. Copiar arquivos para o backend

```bash
# No seu projeto local (gamma-tracker/backend)
cd ~/gamma-tracker/backend/src

# Criar diretório integrations se não existir
mkdir -p integrations

# Copiar DeribitAPI.js
cp /caminho/para/DeribitAPI.js integrations/

# Copiar IVComparator.js para calculators
cp /caminho/para/IVComparator.js calculators/
```

### 2. Instalar dependências

O código usa apenas `axios`, que provavelmente você já tem instalado. Se não:

```bash
cd ~/gamma-tracker/backend
npm install axios
```

---

## 🔌 Integração no server.js

### Passo 1: Adicionar imports

No topo do seu `server.js`, adicione:

```javascript
const DeribitAPI = require('./integrations/DeribitAPI');
const IVComparator = require('./calculators/IVComparator');
```

### Passo 2: Inicializar no construtor

No construtor da sua classe (ou onde você inicializa os calculators):

```javascript
constructor() {
  // ... código existente (EntropyCalculator, RSICalculator, etc) ...
  
  // Inicializar Deribit API
  this.deribitAPI = new DeribitAPI(this.logger);
  
  // Inicializar IV Comparator
  // IMPORTANTE: Você precisa ter uma instância da Binance API
  // Ajuste conforme sua estrutura
  this.ivComparator = new IVComparator(
    this.binanceAPI,  // Sua instância existente
    this.deribitAPI,
    this.logger
  );
  
  this.logger.info('[Server] Deribit integration initialized');
}
```

### Passo 3: Adicionar endpoints

Copie os endpoints do arquivo `endpoints_integration.js` para o seu `server.js`.

**Endpoints disponíveis:**
- `GET /api/deribit/iv-surface` - IV surface completa da Deribit
- `GET /api/deribit/iv-metrics/:dte` - Métricas de um DTE específico
- `GET /api/iv-comparison/:dte` - Comparação Binance vs Deribit
- `GET /api/iv-comparison/multiple` - Comparação múltiplos DTEs
- `GET /api/iv-comparison/history` - Histórico de spreads
- `GET /api/iv-comparison/stats` - Estatísticas do comparador
- `GET /api/retail-panic-index` - Retail Panic Index simplificado

---

## 🧪 Testes

### 1. Testar Deribit API isoladamente

```bash
# IV Surface completa
curl http://localhost:3300/api/deribit/iv-surface | jq '.data.options | length'

# Métricas de 1 DTE
curl http://localhost:3300/api/deribit/iv-metrics/1 | jq '.data'
```

**Resultado esperado:**
```json
{
  "success": true,
  "data": {
    "dte": 1,
    "spotPrice": 93315,
    "atmStrike": 94000,
    "atmIV": 45.2,
    "otmPutIV": 68.5,
    "otmCallIV": 52.3,
    "skewRatio": 1.31,
    "pcSpread": 16.2,
    "totalOptions": 156,
    "source": "deribit"
  }
}
```

### 2. Testar comparação

```bash
# Comparação 1 DTE
curl http://localhost:3300/api/iv-comparison/1 | jq '.spreads'
```

**Resultado esperado:**
```json
{
  "atmSpread": -5.6,
  "putSpread": 13.3,
  "callSpread": null,
  "skewSpread": null,
  "pcSpread": null
}
```

### 3. Testar Retail Panic Index

```bash
curl http://localhost:3300/api/retail-panic-index | jq '.data.retailPanicIndex'
```

**Resultado esperado:**
```json
119.4
```

---

## 📊 Estrutura de Dados

### Comparação completa (`/api/iv-comparison/1`)

```javascript
{
  success: true,
  dte: 1,
  timestamp: 1767637200000,
  
  // Dados Binance
  binance: {
    dte: 1,
    spotPrice: 93313,
    atmStrike: 94000,
    atmIV: 39.6,
    otmPutIV: 81.8,
    otmCallIV: null,        // Pode ser null em 1 DTE
    skewRatio: null,
    pcSpread: null,
    source: "binance"
  },
  
  // Dados Deribit
  deribit: {
    dte: 1,
    spotPrice: 93315,
    atmStrike: 94000,
    atmIV: 45.2,
    otmPutIV: 68.5,
    otmCallIV: 52.3,        // Sempre disponível
    skewRatio: 1.31,
    pcSpread: 16.2,
    source: "deribit"
  },
  
  // Spreads (Binance - Deribit)
  spreads: {
    atmSpread: -5.6,        // Negativo = Deribit maior
    putSpread: 13.3,        // Positivo = Binance maior
    callSpread: null,       // Null se Binance não tem dados
    skewSpread: null,
    pcSpread: null
  },
  
  // Retail Panic Index
  retailPanicIndex: 119.4,  // > 100 = retail pagando mais
  
  // Alertas
  alerts: [
    {
      type: "PUT_DIVERGENCE",
      severity: "MEDIUM",
      message: "Binance Put IV 13.3pp above Deribit - Retail panic detected",
      value: 13.3,
      binanceValue: 81.8,
      deribitValue: 68.5,
      timestamp: 1767637200000
    },
    {
      type: "RETAIL_PANIC",
      severity: "MEDIUM",
      message: "Retail Panic Index at 119.4 - Retail overpaying for protection",
      value: 119.4,
      timestamp: 1767637200000
    }
  ],
  
  // Insights de trading
  insights: [
    {
      type: "RETAIL_OVERREACTION",
      message: "Retail panic index at 119.4 suggests overreaction - Consider fading retail sentiment",
      confidence: "MEDIUM",
      risk: "HIGH"
    },
    {
      type: "LIQUIDITY_RECOMMENDATION",
      message: "Use Deribit for OTM call hedging (23 strikes available vs 0 on Binance)",
      confidence: "HIGH",
      risk: "LOW"
    }
  ]
}
```

---

## 🎯 Tipos de Alertas

| Tipo | Severity | Descrição |
|------|----------|-----------|
| `ATM_DIVERGENCE` | MEDIUM/HIGH | Spread ATM IV > 10pp |
| `PUT_DIVERGENCE` | MEDIUM/HIGH | Spread Put IV > 15pp |
| `CALL_DIVERGENCE` | LOW | Spread Call IV > 10pp |
| `RETAIL_PANIC` | MEDIUM/HIGH | RPI > 120 |
| `LIQUIDITY_GAP` | LOW | Binance sem dados OTM |
| `SKEW_DIVERGENCE` | MEDIUM | Spread Skew > 0.3 |

---

## 🎯 Tipos de Insights

| Tipo | Descrição |
|------|-----------|
| `ARBITRAGE_OPPORTUNITY` | Spread > 20pp = oportunidade de arbitragem |
| `RETAIL_OVERREACTION` | RPI > 130 = retail em pânico |
| `SMART_MONEY_POSITIONING` | Deribit precificando mais risco |
| `LIQUIDITY_RECOMMENDATION` | Usar Deribit para OTM hedging |
| `MARKET_CONVERGENCE` | Preços alinhados, sem oportunidades |

---

## 📈 Retail Panic Index (RPI)

**Fórmula:**
```
RPI = (Binance OTM Put IV / Deribit OTM Put IV) × 100
```

**Interpretação:**
- **100**: Paridade (ambos precificam igual)
- **100-120**: Normal (pequena diferença)
- **120-150**: Pânico moderado (retail pagando prêmio)
- **> 150**: Pânico extremo (arbitragem!)
- **< 100**: Incomum (retail pagando menos que pros)

---

## 🔄 Rate Limiting

**Deribit API:**
- Limite: 20 requests/segundo
- Implementado: 10 requests/segundo (conservador)
- Cache: 10 segundos para book summary

**Recomendação:**
- Chamar `/api/iv-comparison/:dte` a cada 30-60 segundos
- Usar `/api/iv-comparison/multiple` para buscar vários DTEs de uma vez

---

## 🐛 Troubleshooting

### Erro: "Failed to fetch Deribit IV surface"

**Causa:** API Deribit indisponível ou rate limit excedido

**Solução:**
```bash
# Verificar se API está acessível
curl "https://www.deribit.com/api/v2/public/get_index?currency=BTC"

# Deve retornar:
{"jsonrpc":"2.0","result":{"btc":93315.0},"usIn":...}
```

### Erro: "Binance metrics unavailable"

**Causa:** Sua Binance API não está retornando dados

**Solução:**
- Verificar se `this.binanceAPI.getIVMetricsByDTE()` existe
- Adaptar IVComparator para usar seu método existente

### RPI sempre null

**Causa:** Binance ou Deribit sem dados de OTM Put IV

**Solução:**
- Verificar se ambos retornam `otmPutIV` válido
- Ajustar thresholds de moneyness (97% → 95%)

---

## 🚀 Próximos Passos

Após integração do backend:

1. ✅ Testar todos os endpoints
2. ✅ Validar dados com situação de mercado real
3. ✅ Ajustar thresholds se necessário
4. ✅ Implementar frontend (IVComparison.tsx)
5. ✅ Adicionar alertas no Half Pipe Command Center

---

## 📞 Suporte

Se tiver problemas:
1. Verificar logs do backend
2. Testar endpoints isoladamente
3. Validar estrutura de dados da Binance API
4. Me avisar para ajustar código!

**SKÅL!** 🍺⚔️
