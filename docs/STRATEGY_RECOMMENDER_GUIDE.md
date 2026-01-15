# 🎯 Strategy Recommender - Guia de Integração

Sistema de recomendação de estratégias de opções baseado no estado atual do mercado.

---

## 📦 Arquivos Criados

### **Backend:**
1. `strategies.js` - Biblioteca de 7 estratégias de opções
2. `MarketStateAnalyzer.js` - Analisa estado do mercado
3. `StrategyRecommender.js` - Motor de recomendação com scoring
4. `server-strategy-endpoint.js` - Endpoints REST

### **Frontend:**
1. `RecommendedStrategiesCard.tsx` - Componente React

---

## 🚀 Instalação Backend

### **Passo 1: Copiar arquivos para o backend**

```cmd
cd C:\Users\vruss\nodejs-cryptos\gamma-tracker\backend\src

copy strategies.js .
copy MarketStateAnalyzer.js .
copy StrategyRecommender.js .
```

### **Passo 2: Integrar endpoints no server.js**

Abra `server.js` e adicione no final do arquivo (antes do `app.listen`):

```javascript
// ============================================================================
// STRATEGY RECOMMENDATION SYSTEM
// ============================================================================

const { STRATEGIES } = require('./strategies');
const MarketStateAnalyzer = require('./MarketStateAnalyzer');
const StrategyRecommender = require('./StrategyRecommender');

// Endpoint: Recomendações (Top 3-5)
app.get('/api/strategies/recommend', async (req, res) => {
  try {
    const latestSnapshot = await MarketSnapshot.findOne({
      order: [['timestamp', 'DESC']]
    });
    
    if (!latestSnapshot) {
      return res.status(404).json({
        success: false,
        error: 'No market data available'
      });
    }
    
    // Buscar dados de volatilidade (adaptar conforme sua implementação)
    const volData = latestSnapshot.vol_surface_data 
      ? JSON.parse(latestSnapshot.vol_surface_data) 
      : [];
    
    // Buscar anomalias recentes (última 1h)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAnomalies = await AnomaliesLog.findAll({
      where: {
        timestamp: {
          [Op.gte]: oneHourAgo
        }
      },
      order: [['timestamp', 'DESC']],
      limit: 10
    });
    
    // Analisar estado do mercado
    const analyzer = new MarketStateAnalyzer(
      latestSnapshot.toJSON(),
      volData,
      recentAnomalies.map(a => a.toJSON())
    );
    const marketState = analyzer.analyze();
    
    // Recomendar estratégias
    const recommender = new StrategyRecommender(STRATEGIES, marketState);
    const topN = parseInt(req.query.topN) || 5;
    const minScore = parseInt(req.query.minScore) || 50;
    
    const recommendations = recommender.recommend({ topN, minScore });
    
    res.json({
      success: true,
      data: recommendations,
      marketState: marketState,
      timestamp: new Date(),
      meta: {
        totalStrategies: STRATEGIES.length,
        recommendedCount: recommendations.length,
        spotPrice: latestSnapshot.spot_price,
        regime: latestSnapshot.regime
      }
    });
    
  } catch (error) {
    console.error('Error recommending strategies:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint: Todas as estratégias com scores
app.get('/api/strategies/all', async (req, res) => {
  try {
    const latestSnapshot = await MarketSnapshot.findOne({
      order: [['timestamp', 'DESC']]
    });
    
    if (!latestSnapshot) {
      return res.status(404).json({
        success: false,
        error: 'No market data available'
      });
    }
    
    const volData = latestSnapshot.vol_surface_data 
      ? JSON.parse(latestSnapshot.vol_surface_data) 
      : [];
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAnomalies = await AnomaliesLog.findAll({
      where: {
        timestamp: {
          [Op.gte]: oneHourAgo
        }
      }
    });
    
    const analyzer = new MarketStateAnalyzer(
      latestSnapshot.toJSON(),
      volData,
      recentAnomalies.map(a => a.toJSON())
    );
    const marketState = analyzer.analyze();
    
    const recommender = new StrategyRecommender(STRATEGIES, marketState);
    const allStrategies = recommender.getAllWithScores();
    
    res.json({
      success: true,
      data: allStrategies,
      marketState: marketState,
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('Error fetching all strategies:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint: Detalhes de uma estratégia específica
app.get('/api/strategies/:id', async (req, res) => {
  try {
    const strategyId = req.params.id;
    const strategy = STRATEGIES.find(s => s.id === strategyId);
    
    if (!strategy) {
      return res.status(404).json({
        success: false,
        error: `Strategy '${strategyId}' not found`
      });
    }
    
    res.json({
      success: true,
      data: strategy,
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('Error fetching strategy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

### **Passo 3: Reiniciar o backend**

```cmd
cd C:\Users\vruss\nodejs-cryptos\gamma-tracker\backend\src
node index.js
```

### **Passo 4: Testar endpoints**

```bash
# Testar recomendações (Top 3)
curl http://localhost:3300/api/strategies/recommend?topN=3

# Testar todas as estratégias
curl http://localhost:3300/api/strategies/all

# Testar estratégia específica
curl http://localhost:3300/api/strategies/iron_condor
```

---

## 🎨 Instalação Frontend

### **Passo 1: Copiar componente**

```cmd
copy RecommendedStrategiesCard.tsx C:\Users\vruss\nodejs-cryptos\gamma-tracker\frontend\client\src\components\
```

### **Passo 2: Adicionar na Home.tsx**

Edite `frontend/client/src/pages/Home.tsx`:

#### **2.1. Adicionar import:**

```typescript
import RecommendedStrategiesCard from "@/components/RecommendedStrategiesCard";
```

#### **2.2. Adicionar componente após o grid de 6 cards:**

```tsx
{/* Grid de 6 Cards Principais */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* ... 6 cards existentes ... */}
</div>

{/* NOVO: Estratégias Recomendadas */}
<RecommendedStrategiesCard />

{/* Gamma Profile Chart - já existe */}
<Card className="p-6 bg-card border-border col-span-full">
  {/* ... gráfico existente ... */}
</Card>
```

### **Passo 3: Testar no frontend**

```cmd
cd C:\Users\vruss\nodejs-cryptos\gamma-tracker\frontend
npm run dev
```

Acesse `http://localhost:5173` e verifique o novo card de estratégias!

---

## 📊 Estratégias Implementadas

### **1. Bull Call Spread (Trava de Alta)**
- **Bias:** Bullish
- **Quando usar:** Expectativa de alta moderada, IV baixa/média
- **Estrutura:** Compra call ATM + Vende call OTM

### **2. Bear Put Spread (Trava de Baixa)**
- **Bias:** Bearish
- **Quando usar:** Expectativa de queda moderada, IV baixa/média
- **Estrutura:** Compra put ATM + Vende put OTM

### **3. Iron Condor (Condor de Ferro)**
- **Bias:** Neutral
- **Quando usar:** Mercado lateral, IV alta, spot próximo do Max Pain
- **Estrutura:** Vende put spread + Vende call spread OTM

### **4. Iron Butterfly (Borboleta de Ferro)**
- **Bias:** Neutral
- **Quando usar:** Mercado muito lateral, IV alta, spot muito próximo do Max Pain
- **Estrutura:** Vende straddle ATM + Compra strangle OTM

### **5. Long Straddle (Compra de Volatilidade ATM)**
- **Bias:** Neutral (espera movimento forte)
- **Quando usar:** IV baixa, expectativa de movimento forte, anomalias detectadas
- **Estrutura:** Compra call ATM + Compra put ATM

### **6. Long Strangle (Compra de Volatilidade OTM)**
- **Bias:** Neutral (espera movimento muito forte)
- **Quando usar:** IV baixa, expectativa de movimento muito forte
- **Estrutura:** Compra call OTM + Compra put OTM

### **7. Short Straddle (Venda de Volatilidade ATM)**
- **Bias:** Neutral (espera mercado lateral)
- **Quando usar:** IV muito alta, mercado muito lateral, GEX positivo
- **Estrutura:** Vende call ATM + Vende put ATM
- **⚠️ Risco ilimitado!**

---

## 🎯 Sistema de Scoring

Cada estratégia recebe um **score de 0-100** baseado em:

### **Fatores Analisados:**
1. **Regime** (25-30%): Bullish, Bearish, Neutral
2. **Volatilidade** (20-35%): Low, Medium, High (baseado em IV)
3. **Skew** (5-15%): Put Skew, Call Skew, Flat
4. **GEX** (10-20%): Positive (range-bound), Negative (volátil)
5. **Max Pain Distance** (5-20%): Distância % entre spot e max pain
6. **Sentiment** (0-15%): Put/Call Ratio, Divergência OI vs Volume
7. **Anomalias** (0-10%): OI spikes, Volume spikes

### **Classificação de Fit:**
- **EXCELLENT** (80-100%): Condições ideais
- **GOOD** (65-79%): Condições favoráveis
- **FAIR** (50-64%): Condições aceitáveis
- **POOR** (<50%): Não recomendado

---

## 🔧 Personalização

### **Adicionar Nova Estratégia:**

Edite `strategies.js` e adicione ao array `STRATEGIES`:

```javascript
{
  id: 'minha_estrategia',
  name: 'My Strategy',
  namePt: 'Minha Estratégia',
  description: 'Descrição da estratégia',
  category: 'DIRECTIONAL', // ou 'NEUTRAL', 'VOLATILITY'
  bias: 'BULLISH', // ou 'BEARISH', 'NEUTRAL'
  
  idealConditions: {
    regime: ['BULLISH'],
    volatility: ['LOW', 'MEDIUM'],
    skew: ['FLAT'],
    gex: ['POSITIVE'],
    maxPainDistance: { min: -5, max: 5 },
    sentiment: { putCallRatio: { max: 1.2 } }
  },
  
  legs: [
    { action: 'BUY', type: 'CALL', moneyness: 'ATM' },
    // ... mais legs
  ],
  
  risk: {
    maxLoss: 'LIMITED',
    maxProfit: 'LIMITED',
    breakeven: 'SINGLE',
    capitalRequired: 'LOW'
  },
  
  greeks: {
    delta: { target: 0.5, range: [0.3, 0.7] },
    theta: 'NEGATIVE',
    vega: 'POSITIVE',
    gamma: 'POSITIVE'
  },
  
  whenToUse: [
    'Condição 1',
    'Condição 2'
  ],
  
  whenToAvoid: [
    'Condição 1',
    'Condição 2'
  ],
  
  scoringWeights: {
    regime: 0.25,
    volatility: 0.20,
    skew: 0.15,
    gex: 0.10,
    maxPainDistance: 0.15,
    sentiment: 0.15
  }
}
```

### **Ajustar Pesos de Scoring:**

Edite os `scoringWeights` em cada estratégia para dar mais ou menos importância a cada fator.

---

## 📈 Próximos Passos Sugeridos

### **Fase 2: Enriquecimento**
1. ✅ Adicionar mais estratégias (Covered Call, Protective Put, etc.)
2. ✅ Calcular strikes otimizados para cada estratégia
3. ✅ Calcular Greeks (Delta, Gamma, Theta, Vega)
4. ✅ Calcular P&L esperado (max profit, max loss, breakeven)

### **Fase 3: Visualização**
1. ✅ Criar página detalhada `/strategies` com todas as estratégias
2. ✅ Payoff diagrams interativos (Recharts)
3. ✅ Comparação lado a lado de estratégias
4. ✅ Filtros por risco, capital, DTE

### **Fase 4: Machine Learning (Futuro)**
1. ⚠️ Treinar modelo para prever sucesso de estratégias
2. ⚠️ Backtesting de estratégias com dados históricos
3. ⚠️ Otimização de strikes via ML

---

## 🐛 Troubleshooting

### **Erro: "Cannot find module './strategies'"**

**Solução:** Verifique se os arquivos foram copiados para a pasta correta:
```cmd
dir C:\Users\vruss\nodejs-cryptos\gamma-tracker\backend\src\strategies.js
```

### **Erro: "No market data available"**

**Solução:** Certifique-se de que o backend está coletando dados:
```sql
SELECT * FROM market_snapshots ORDER BY timestamp DESC LIMIT 1;
```

### **Componente não aparece no frontend**

**Solução:**
1. Verifique se o import está correto
2. Verifique se o componente está dentro do JSX
3. Verifique o console do navegador (F12) para erros

---

## ✅ Checklist de Validação

- [ ] Arquivos backend copiados (strategies.js, MarketStateAnalyzer.js, StrategyRecommender.js)
- [ ] Endpoints adicionados ao server.js
- [ ] Backend reiniciado sem erros
- [ ] Endpoint `/api/strategies/recommend` retorna 200 OK
- [ ] Componente React copiado para frontend
- [ ] Import adicionado no Home.tsx
- [ ] Componente adicionado no JSX
- [ ] Frontend exibe card de estratégias
- [ ] Scores são calculados corretamente
- [ ] Reasoning é exibido

---

**Pronto!** 🎉 Seu Gamma Tracker agora tem um sistema inteligente de recomendação de estratégias de opções!
