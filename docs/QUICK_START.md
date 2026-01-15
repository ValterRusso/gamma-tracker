# 🚀 Quick Start: Integração Deribit

## 📦 Arquivos Incluídos

1. **DeribitAPI.js** (10KB) - Cliente API Deribit
2. **IVComparator.js** (11KB) - Comparador Binance vs Deribit  
3. **endpoints_integration.js** (8KB) - Código dos endpoints
4. **INTEGRATION_GUIDE.md** (12KB) - Guia completo
5. **test_deribit.js** (7KB) - Script de teste

**Total:** 48KB de código pronto para usar!

---

## ⚡ Instalação Rápida (5 minutos)

### 1. Copiar arquivos

```bash
# No seu projeto gamma-tracker/backend
cd ~/gamma-tracker/backend/src

# Criar diretório integrations
mkdir -p integrations

# Copiar arquivos
cp /caminho/para/DeribitAPI.js integrations/
cp /caminho/para/IVComparator.js calculators/
```

### 2. Adicionar no server.js

**No topo (imports):**
```javascript
const DeribitAPI = require('./integrations/DeribitAPI');
const IVComparator = require('./calculators/IVComparator');
```

**No construtor:**
```javascript
this.deribitAPI = new DeribitAPI(this.logger);
this.ivComparator = new IVComparator(this.binanceAPI, this.deribitAPI, this.logger);
```

**Adicionar endpoints** (copiar de `endpoints_integration.js`)

### 3. Testar

```bash
# Reiniciar backend
npm start

# Testar endpoint
curl http://localhost:3300/api/iv-comparison/1 | jq
```

---

## 📊 Endpoints Disponíveis

| Endpoint | Descrição |
|----------|-----------|
| `GET /api/deribit/iv-surface` | IV surface completa |
| `GET /api/deribit/iv-metrics/:dte` | Métricas por DTE |
| `GET /api/iv-comparison/:dte` | **Comparação principal** |
| `GET /api/iv-comparison/multiple` | Múltiplos DTEs |
| `GET /api/iv-comparison/history` | Histórico de spreads |
| `GET /api/iv-comparison/stats` | Estatísticas |
| `GET /api/retail-panic-index` | RPI simplificado |

---

## 🎯 Exemplo de Uso

```bash
# Comparação 1 DTE (principal)
curl "http://localhost:3300/api/iv-comparison/1" | jq

# Resultado:
{
  "success": true,
  "dte": 1,
  "binance": {
    "atmIV": 39.6,
    "otmPutIV": 81.8,
    "otmCallIV": null
  },
  "deribit": {
    "atmIV": 40.2,
    "otmPutIV": 67.3,
    "otmCallIV": 52.1
  },
  "spreads": {
    "atmSpread": -0.6,
    "putSpread": 14.5
  },
  "retailPanicIndex": 121.5,
  "alerts": [
    {
      "type": "PUT_DIVERGENCE",
      "severity": "MEDIUM",
      "message": "Binance Put IV 14.5pp above Deribit - Retail panic detected"
    },
    {
      "type": "RETAIL_PANIC",
      "severity": "MEDIUM",
      "message": "Retail Panic Index at 121.5 - Retail overpaying for protection"
    }
  ],
  "insights": [
    {
      "type": "RETAIL_OVERREACTION",
      "message": "Retail panic index at 121.5 suggests overreaction"
    }
  ]
}
```

---

## 🧪 Validação

**Teste isolado (sem server):**
```bash
cd ~/gamma-tracker/backend/src
node test_deribit.js
```

**Resultado esperado:**
```
✅ TODOS OS TESTES PASSARAM!
🎉 Integração Deribit está funcionando corretamente!
```

---

## 📈 Métricas Principais

### **Retail Panic Index (RPI)**
```
RPI = (Binance Put IV / Deribit Put IV) × 100

100-120: Normal
120-150: Pânico moderado
> 150:   Pânico extremo (arbitragem!)
```

### **Spreads**
```
Spread = Binance IV - Deribit IV

Positivo: Binance mais cara (retail pagando mais)
Negativo: Deribit mais cara (instituições hedging)
```

---

## 🎯 Casos de Uso

### 1. Detectar pânico no retail
```bash
curl "http://localhost:3300/api/retail-panic-index?dte=1"
# Se RPI > 120 → Retail em pânico
```

### 2. Encontrar arbitragem
```bash
curl "http://localhost:3300/api/iv-comparison/1" | jq '.spreads.putSpread'
# Se > 20pp → Oportunidade de arbitragem
```

### 3. Comparar múltiplos prazos
```bash
curl "http://localhost:3300/api/iv-comparison/multiple?dtes=1,2,3,7"
# Ver evolução do pânico por DTE
```

### 4. Monitorar histórico
```bash
curl "http://localhost:3300/api/iv-comparison/history?dte=1&hours=24"
# Ver evolução nas últimas 24h
```

---

## ⚠️ Observações Importantes

### **Binance 1 DTE:**
- Pode não ter calls OTM (falta de liquidez)
- Normal em options de curtíssimo prazo
- Usar Deribit para hedging OTM

### **Rate Limiting:**
- Deribit: 20 req/s (implementado: 10 req/s)
- Cache: 10s para book summary
- Recomendado: chamar a cada 30-60s

### **Dados:**
- Spot price pode diferir ligeiramente (Binance vs Deribit)
- IVs são calculados com modelos diferentes
- Spreads > 5pp são significativos

---

## 🐛 Troubleshooting

### "Failed to fetch Deribit IV surface"
```bash
# Testar API diretamente
curl "https://www.deribit.com/api/v2/public/get_index_price?index_name=btc_usd"
```

### "Binance metrics unavailable"
- Verificar se `binanceAPI.getIVMetricsByDTE()` existe
- Adaptar código para seu método

### RPI sempre null
- Verificar se ambos retornam `otmPutIV`
- Ajustar thresholds de moneyness

---

## 📞 Próximos Passos

Após integração:

1. ✅ Testar todos os endpoints
2. ✅ Validar com dados reais
3. ✅ Implementar frontend (depois)
4. ✅ Adicionar ao Half Pipe Command Center (depois)

---

**Dúvidas?** Consulte `INTEGRATION_GUIDE.md` para detalhes completos!

**SKÅL!** 🍺⚔️
