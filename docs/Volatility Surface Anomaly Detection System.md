# Volatility Surface Anomaly Detection System

## 📋 Visão Geral

Sistema de detecção de anomalias estatísticas na superfície de volatilidade implícita, identificando strikes com pricing fora do padrão esperado. Útil para detectar oportunidades de arbitragem, erros de pricing, e comportamentos anômalos do mercado.

---

## 🎯 Funcionalidades Implementadas

### 1. **Detecção de IV Outliers**
Identifica strikes com volatilidade implícita significativamente diferente do padrão da curva de skew.

**Metodologia:**
- Calcula Z-score de cada ponto em relação à média do vencimento
- Interpola IV esperado baseado em vizinhos (interpolação linear ponderada)
- Distingue entre wings naturais (extremos da curva) e anomalias reais
- Pondera severidade por volume e open interest

**Exemplo de anomalia detectada:**
- Strike 95000 (ATM) com IV de 85% enquanto vizinhos têm 62%
- Desvio: +23% (36.7% acima do esperado)
- Z-score: 3.45 → **Severity: HIGH**

### 2. **Detecção de Skew Anômalo**
Identifica strikes onde o spread Put-Call está fora do padrão normal.

**Metodologia:**
- Calcula Put IV - Call IV para cada strike
- Compara com spread médio do vencimento
- Detecta assimetrias anormais (put premium ou call premium excessivo)

**Exemplo de anomalia detectada:**
- Strike 88000 com Put IV de 78% e Call IV de 52%
- Spread: +26% (49% acima da call)
- Spread esperado: +8%
- Z-score: 2.89 → **Severity: MEDIUM, Type: PUT_PREMIUM**

### 3. **Classificação de Severidade**
Sistema de 4 níveis baseado em Z-score e relevância (volume/OI):

| Severidade | Critérios | Ação Sugerida |
|------------|-----------|---------------|
| **CRITICAL** | Z-score > 3.0 + Relevance > 30 | Investigar imediatamente, possível oportunidade |
| **HIGH** | Z-score > 3.0 | Monitorar de perto, validar com outras fontes |
| **MEDIUM** | Z-score > 2.5 ou (Z-score > 2.0 + Relevance > 20) | Atenção, pode indicar movimento de mercado |
| **LOW** | Z-score > 2.0 ou wings naturais | Informativo, monitoramento passivo |

### 4. **Score de Relevância**
Pondera anomalias por liquidez (0-100):

```javascript
relevanceScore = log10(1 + volume) * 10 * 0.3 + log10(1 + OI) * 10 * 0.7
```

**Interpretação:**
- **0-20**: Baixa liquidez, anomalia pode ser ruído
- **20-50**: Liquidez moderada, anomalia tem significância
- **50+**: Alta liquidez, anomalia muito relevante

---

## 🔧 Instalação

### Passo 1: Adicionar o arquivo do detector

Copie `VolatilityAnomalyDetector.js` para:
```
gamma-tracker/backend/src/calculators/VolatilityAnomalyDetector.js
```

### Passo 2: Integrar no server.js

**No topo do arquivo (imports):**
```javascript
const VolatilityAnomalyDetector = require('./calculators/VolatilityAnomalyDetector');
```

**No construtor da classe Server:**
```javascript
constructor() {
  // ... código existente ...
  this.anomalyDetector = new VolatilityAnomalyDetector(this.logger);
}
```

**Adicionar endpoint** (copie o código de `anomaly-endpoint-integration.js`)

### Passo 3: Testar

```bash
# Reiniciar o backend
npm start

# Testar endpoint
curl http://localhost:3300/api/vol-anomalies
```

---

## 📡 API Reference

### Endpoint: `GET /api/vol-anomalies`

**Query Parameters:**

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `threshold` | number | 2.0 | Z-score mínimo para considerar anomalia |
| `limit` | number | 50 | Máximo de anomalias retornadas (max: 200) |
| `severity` | string | ALL | Filtrar por severidade (CRITICAL, HIGH, MEDIUM, LOW) |
| `type` | string | ALL | Filtrar por tipo (IV_OUTLIER, SKEW_ANOMALY) |

**Exemplos de Uso:**

```bash
# Todas as anomalias com threshold padrão
GET /api/vol-anomalies

# Apenas anomalias críticas
GET /api/vol-anomalies?severity=CRITICAL

# Anomalias de skew com threshold mais rigoroso
GET /api/vol-anomalies?type=SKEW_ANOMALY&threshold=2.5

# Top 20 anomalias mais severas
GET /api/vol-anomalies?limit=20&severity=HIGH

# Combinação de filtros
GET /api/vol-anomalies?threshold=2.0&severity=HIGH&type=IV_OUTLIER&limit=30
```

**Resposta (Success):**

```json
{
  "success": true,
  "data": {
    "anomalies": [
      {
        "type": "IV_OUTLIER",
        "strike": 95000,
        "dte": 7,
        "moneyness": 1.0842,
        "iv": 0.8523,
        "callIV": 0.8234,
        "putIV": 0.8812,
        "expectedIV": 0.6234,
        "deviation": 0.2289,
        "deviationPct": 36.72,
        "zScore": 3.45,
        "severity": "HIGH",
        "priceType": "OVERPRICED",
        "isWing": false,
        "relevanceScore": 45.23,
        "volume": 1250,
        "openInterest": 8900,
        "expiryDate": 1766736000000
      }
    ],
    "stats": {
      "total": 23,
      "byType": {
        "ivOutlier": 15,
        "skewAnomaly": 8
      },
      "bySeverity": {
        "critical": 2,
        "high": 7,
        "medium": 10,
        "low": 4
      },
      "byPriceType": {
        "overpriced": 14,
        "underpriced": 9
      },
      "avgRelevance": 32.45
    },
    "threshold": 2.0,
    "spotPrice": 87654.32,
    "filters": {
      "severity": "ALL",
      "type": "ALL",
      "limit": 50
    }
  }
}
```

---

## 🧮 Algoritmos Detalhados

### 1. Detecção de IV Outliers

```
Para cada vencimento (DTE):
  1. Ordenar strikes por moneyness
  2. Calcular média e desvio padrão de avgIV
  3. Para cada strike:
     a. Calcular Z-score: (IV - média) / desvio
     b. Se |Z-score| > threshold:
        - Calcular IV esperado (interpolação de vizinhos)
        - Calcular desvio absoluto e percentual
        - Calcular relevância (volume + OI)
        - Determinar severidade
        - Classificar como OVERPRICED ou UNDERPRICED
```

### 2. Detecção de Skew Anômalo

```
Para cada vencimento (DTE):
  1. Filtrar strikes que têm callIV E putIV
  2. Calcular spread: putIV - callIV
  3. Calcular média e desvio padrão dos spreads
  4. Para cada strike:
     a. Calcular Z-score do spread
     b. Se |Z-score| > threshold:
        - Calcular spread esperado (média)
        - Determinar severidade
        - Classificar como PUT_PREMIUM ou CALL_PREMIUM
```

### 3. Cálculo de IV Esperado (Interpolação)

```javascript
// Interpolação linear ponderada por distância de moneyness
function calculateExpectedIV(sortedPoints, index) {
  const point = sortedPoints[index];
  const prev = sortedPoints[index - 1];
  const next = sortedPoints[index + 1];
  
  const totalDist = next.moneyness - prev.moneyness;
  const distFromPrev = point.moneyness - prev.moneyness;
  const weight = distFromPrev / totalDist;
  
  return prev.avgIV + (next.avgIV - prev.avgIV) * weight;
}
```

---

## 💡 Casos de Uso

### 1. **Arbitragem de Volatilidade**
Identificar strikes com IV significativamente diferente de vizinhos → oportunidade de venda/compra.

**Exemplo:**
- Strike 95000 com IV de 85% (HIGH severity, OVERPRICED)
- Strikes vizinhos (94000 e 96000) com IV de 62%
- **Estratégia:** Vender volatilidade em 95000, comprar em 94000/96000

### 2. **Detecção de Erros de Pricing**
Anomalias CRITICAL com baixo volume podem indicar erros de marcação.

**Exemplo:**
- Strike com Z-score > 4.0 e volume < 10
- **Ação:** Validar com outras fontes antes de operar

### 3. **Identificação de Eventos**
Skew anômalo pode indicar expectativa de evento direcional.

**Exemplo:**
- PUT_PREMIUM excessivo (spread > 30%)
- **Interpretação:** Mercado precificando proteção contra queda

### 4. **Monitoramento de Liquidez**
Anomalias com alto relevanceScore são mais confiáveis.

**Exemplo:**
- Anomalia com relevanceScore > 50 e OI > 5000
- **Confiança:** Alta, muitos participantes concordam com o pricing

---

## 🎨 Próximos Passos (Frontend)

### Página de Anomalias (`/anomalies`)

**Componentes sugeridos:**

1. **Stats Cards**
   - Total Anomalies
   - Critical / High / Medium / Low
   - Overpriced / Underpriced
   - Avg Relevance Score

2. **Filtros**
   - Threshold slider (1.5 - 4.0)
   - Severity checkboxes
   - Type selector (IV Outlier / Skew Anomaly)
   - DTE range selector

3. **Tabela de Anomalias**
   - Colunas: Strike, DTE, Type, IV, Expected, Deviation, Z-score, Severity
   - Ordenável por qualquer coluna
   - Click → destaca ponto no gráfico 3D

4. **Integração com 3D Surface**
   - Marcar pontos anômalos com cor diferente
   - Tooltip mostrando detalhes da anomalia
   - Link para navegar entre Anomalies ↔ 3D Surface

---

## 📊 Melhorias Futuras

1. **Comparação Temporal**
   - Salvar snapshots de anomalias
   - Detectar anomalias persistentes vs transitórias
   - Alertar quando anomalia desaparece (oportunidade executada)

2. **Machine Learning**
   - Treinar modelo para prever probabilidade de reversão
   - Classificar anomalias por tipo de causa (evento, liquidez, erro)

3. **Alertas em Tempo Real**
   - WebSocket para notificar novas anomalias CRITICAL
   - Email/Telegram quando anomalia com alta relevância aparece

4. **Backtesting**
   - Simular estratégias de arbitragem baseadas em anomalias históricas
   - Calcular P&L teórico de explorar cada anomalia

---

## 🐛 Troubleshooting

### Problema: Nenhuma anomalia detectada

**Causas possíveis:**
- Threshold muito alto → reduzir para 1.5-2.0
- Poucos dados (< 5 strikes por DTE) → aguardar mais coleta
- Mercado muito eficiente → normal em períodos de baixa volatilidade

### Problema: Muitas anomalias LOW severity

**Solução:**
- Aumentar threshold para 2.5
- Filtrar por `severity=HIGH` ou `severity=CRITICAL`
- Considerar apenas anomalias com `relevanceScore > 30`

### Problema: Anomalias em wings sempre aparecem

**Explicação:**
- Wings naturalmente têm IV alto (proteção contra tail risk)
- Sistema já identifica com `isWing: true`
- Severidade é reduzida automaticamente para wings

**Solução frontend:**
- Adicionar filtro "Hide Wings" na UI
- Mostrar badge "WING" nas anomalias com `isWing: true`

---

## 📝 Notas Técnicas

### Performance
- Complexidade: O(n log n) por DTE (ordenação)
- Típico: 200-500 strikes → ~5-10ms de processamento
- Cache não necessário (cálculo é rápido)

### Precisão Estatística
- Z-score assume distribuição normal de IV
- Em mercados com skew acentuado, usar threshold > 2.5
- Wings podem ter Z-score alto naturalmente (não é bug)

### Limitações
- Não detecta anomalias temporais (term structure)
- Não considera correlação entre strikes
- Não valida contra outras exchanges (single source)

---

## 📚 Referências

- **Z-score**: Medida estatística de quantos desvios padrão um valor está da média
- **Volatility Smile**: Padrão de IV mais alto em extremos (OTM puts e calls)
- **Skew**: Assimetria entre put IV e call IV (geralmente puts > calls)
- **Open Interest**: Total de contratos em aberto (proxy de liquidez)

---

**Desenvolvido para Gamma Tracker Dashboard**  
*Sistema de análise avançada de options para trading profissional*
