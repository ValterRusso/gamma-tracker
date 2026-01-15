# 🔌 Integração com DataCollector

## 📦 Arquivos Necessários

1. **DeribitAPI.js** - Cliente API Deribit
2. **BinanceAdapter.js** - Adapter DataCollector → IVComparator ⭐ **NOVO**
3. **IVComparator.js** - Comparador Binance vs Deribit
4. **endpoints_integration_datacollector.js** - Endpoints adaptados ⭐ **NOVO**

---

## ⚡ Instalação (5 minutos)

### 1. Copiar arquivos

```bash
cd ~/gamma-tracker/backend/src

# Criar diretório integrations se não existir
mkdir -p integrations

# Copiar arquivos
cp /caminho/para/DeribitAPI.js integrations/
cp /caminho/para/BinanceAdapter.js integrations/
cp /caminho/para/IVComparator.js calculators/
```

### 2. Adicionar no server.js

**No topo (imports):**
```javascript
const DeribitAPI = require('./integrations/DeribitAPI');
const BinanceAdapter = require('./integrations/BinanceAdapter');
const IVComparator = require('./calculators/IVComparator');
```

**No construtor (DEPOIS de inicializar DataCollector):**
```javascript
constructor() {
  // ... código existente ...
  
  // Inicializar DataCollector (já existe)
  this.dataCollector = new DataCollector({ ... });
  await this.dataCollector.start();
  
  // ===== ADICIONAR AQUI =====
  
  // Inicializar Deribit API
  this.deribitAPI = new DeribitAPI(this.logger);
  
  // Criar adapter para converter dados do DataCollector
  this.binanceAdapter = new BinanceAdapter(this.dataCollector, this.logger);
  
  // Inicializar IV Comparator
  this.ivComparator = new IVComparator(
    this.binanceAdapter,  // Usa adapter em vez de binanceAPI direta
    this.deribitAPI,
    this.logger
  );
  
  this.logger.info('[Server] Deribit integration initialized');
  
  // ===== FIM =====
}
```

### 3. Adicionar endpoints

Copie os endpoints do arquivo `endpoints_integration_datacollector.js` para o seu `server.js`.

**Endpoints disponíveis:**
- `GET /api/binance/iv-surface` - IV surface da Binance (via adapter)
- `GET /api/binance/iv-metrics/:dte` - Métricas Binance por DTE
- `GET /api/deribit/iv-surface` - IV surface da Deribit
- `GET /api/deribit/iv-metrics/:dte` - Métricas Deribit por DTE
- `GET /api/iv-comparison/:dte` - **Comparação principal** ⭐
- `GET /api/iv-comparison/multiple` - Múltiplos DTEs
- `GET /api/iv-comparison/history` - Histórico de spreads
- `GET /api/iv-comparison/stats` - Estatísticas
- `GET /api/retail-panic-index` - RPI simplificado

---

## 🔄 Como Funciona

### **Fluxo de Dados:**

```
┌─────────────────┐
│  DataCollector  │
│  (Binance WS)   │
└────────┬────────┘
         │
         │ this.options (Map)
         │ this.spotPrice
         │
         ▼
┌─────────────────┐
│ BinanceAdapter  │ ← Converte para formato IVComparator
└────────┬────────┘
         │
         │ getIVMetricsByDTE()
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  IVComparator   │ ←→  │   DeribitAPI    │
│                 │     │  (Deribit REST) │
└────────┬────────┘     └─────────────────┘
         │
         │ compare()
         │
         ▼
┌─────────────────┐
│   Endpoints     │
│  (REST API)     │
└─────────────────┘
```

---

## 🧪 Testes

### 1. Testar adapter isoladamente

```bash
# No Node.js REPL ou script de teste
const adapter = new BinanceAdapter(dataCollector, logger);
const metrics = await adapter.getIVMetricsByDTE(1);
console.log(metrics);
```

**Resultado esperado:**
```json
{
  "dte": 1,
  "spotPrice": 93313,
  "atmStrike": 94000,
  "atmIV": 39.6,
  "otmPutIV": 81.8,
  "otmCallIV": null,
  "skewRatio": null,
  "pcSpread": null,
  "totalOptions": 45,
  "source": "binance"
}
```

### 2. Testar endpoints

```bash
# Reiniciar backend
npm start

# Testar Binance (via adapter)
curl http://localhost:3300/api/binance/iv-metrics/1 | jq

# Testar Deribit
curl http://localhost:3300/api/deribit/iv-metrics/1 | jq

# Testar comparação
curl http://localhost:3300/api/iv-comparison/1 | jq
```

---

## 📊 Exemplo de Resposta

```bash
curl "http://localhost:3300/api/iv-comparison/1" | jq
```

```json
{
  "success": true,
  "dte": 1,
  "timestamp": 1767637200000,
  "binance": {
    "dte": 1,
    "spotPrice": 93313,
    "atmStrike": 94000,
    "atmIV": 39.6,
    "otmPutIV": 81.8,
    "otmCallIV": null,
    "skewRatio": null,
    "pcSpread": null,
    "totalOptions": 45,
    "source": "binance"
  },
  "deribit": {
    "dte": 1,
    "spotPrice": 93315,
    "atmStrike": 94000,
    "atmIV": 40.2,
    "otmPutIV": 67.3,
    "otmCallIV": 52.1,
    "skewRatio": 1.29,
    "pcSpread": 15.2,
    "totalOptions": 26,
    "source": "deribit"
  },
  "spreads": {
    "atmSpread": -0.6,
    "putSpread": 14.5,
    "callSpread": null,
    "skewSpread": null,
    "pcSpread": null
  },
  "retailPanicIndex": 121.5,
  "alerts": [
    {
      "type": "PUT_DIVERGENCE",
      "severity": "MEDIUM",
      "message": "Binance Put IV 14.5pp above Deribit - Retail panic detected",
      "value": 14.5,
      "binanceValue": 81.8,
      "deribitValue": 67.3,
      "timestamp": 1767637200000
    },
    {
      "type": "RETAIL_PANIC",
      "severity": "MEDIUM",
      "message": "Retail Panic Index at 121.5 - Retail overpaying for protection",
      "value": 121.5,
      "timestamp": 1767637200000
    },
    {
      "type": "LIQUIDITY_GAP",
      "severity": "LOW",
      "message": "Binance missing OTM calls (1 DTE) - Use Deribit for OTM hedging",
      "timestamp": 1767637200000
    }
  ],
  "insights": [
    {
      "type": "RETAIL_OVERREACTION",
      "message": "Retail panic index at 121.5 suggests overreaction - Consider fading retail sentiment",
      "confidence": "MEDIUM",
      "risk": "HIGH"
    },
    {
      "type": "LIQUIDITY_RECOMMENDATION",
      "message": "Use Deribit for OTM call hedging (23 strikes available vs 0 on Binance)",
      "confidence": "HIGH",
      "risk": "LOW"
    }
  ]
}
```

---

## 🎯 Detalhes do BinanceAdapter

### **Conversões realizadas:**

| DataCollector | BinanceAdapter | Descrição |
|---------------|----------------|-----------|
| `opt.iv` | `opt.iv * 100` | Converte decimal → % |
| `opt.side` | `opt.side.toLowerCase()` | CALL → call |
| `opt.expiryDate` | `calculateDTE()` | Date → DTE (dias) |
| `opt.strike / spotPrice` | `moneyness` | Calcula moneyness |

### **Filtros aplicados:**

- ✅ Apenas options com IV válido (> 0)
- ✅ DTE target ± 0.5 dias de tolerância
- ✅ OTM Puts: moneyness < 97%
- ✅ OTM Calls: moneyness > 103%

---

## 🐛 Troubleshooting

### "No options available"

**Causa:** DataCollector ainda não carregou options

**Solução:**
```javascript
// Verificar se DataCollector está pronto
if (this.dataCollector.options.size === 0) {
  await this.dataCollector.start();
}
```

### "Invalid spot price"

**Causa:** SpotPriceCollector ainda não atualizou

**Solução:**
```javascript
// Aguardar evento 'ready' do DataCollector
this.dataCollector.on('ready', () => {
  // Agora pode usar ivComparator
});
```

### RPI sempre null

**Causa:** Binance não tem OTM Put IV para o DTE

**Solução:**
- Verificar se há options suficientes no DTE
- Ajustar threshold de moneyness (97% → 95%)
- Testar com DTE maior (2 ou 3 dias)

### Adapter retorna null

**Causa:** Filtros muito restritivos ou dados insuficientes

**Solução:**
```javascript
// Verificar estatísticas
const stats = adapter.getStats();
console.log(stats);
// { totalOptions: 150, validIVCount: 145, expiryCount: 8 }
```

---

## 📈 Métricas e Alertas

### **Retail Panic Index (RPI)**
```
RPI = (Binance OTM Put IV / Deribit OTM Put IV) × 100

100-120: Normal
120-150: Pânico moderado
> 150:   Pânico extremo (arbitragem!)
```

### **6 Tipos de Alertas:**
1. `ATM_DIVERGENCE` - Spread ATM IV > 10pp
2. `PUT_DIVERGENCE` - Spread Put IV > 15pp ⭐
3. `CALL_DIVERGENCE` - Spread Call IV > 10pp
4. `RETAIL_PANIC` - RPI > 120 ⭐
5. `LIQUIDITY_GAP` - Binance sem dados OTM ⭐
6. `SKEW_DIVERGENCE` - Spread Skew > 0.3

### **5 Tipos de Insights:**
1. `ARBITRAGE_OPPORTUNITY` - Spread > 20pp
2. `RETAIL_OVERREACTION` - RPI > 130
3. `SMART_MONEY_POSITIONING` - Deribit precificando mais risco
4. `LIQUIDITY_RECOMMENDATION` - Usar Deribit para OTM
5. `MARKET_CONVERGENCE` - Preços alinhados

---

## 🚀 Próximos Passos

### **Agora:**
1. ✅ Copiar arquivos (DeribitAPI, BinanceAdapter, IVComparator)
2. ✅ Adicionar imports e inicialização no server.js
3. ✅ Adicionar endpoints
4. ✅ Testar com curl

### **Depois:**
1. Frontend React (IVComparison.tsx)
2. Integração no Half Pipe Command Center
3. Alertas visuais de divergência
4. Gráficos de histórico de spreads

---

## 💡 Dicas

### **Performance:**
- Adapter é leve (apenas conversão de dados)
- Não faz requests adicionais
- Usa dados já carregados pelo DataCollector

### **Manutenção:**
- Se mudar estrutura do Option model, ajustar adapter
- Se mudar thresholds de moneyness, ajustar no adapter
- Logs ajudam a debugar conversões

### **Extensões:**
- Adicionar cache no adapter se necessário
- Adicionar métricas customizadas
- Integrar com outros calculators (GEX, etc)

---

**ESTÁ TUDO PRONTO!** 🎉

**Siga este guia e terá comparação Binance vs Deribit funcionando!**

**SKÅL!** 🍺⚔️
