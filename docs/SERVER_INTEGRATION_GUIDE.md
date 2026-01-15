# 🚀 Guia de Integração - Liquidation Endpoints no server.js

## 📋 Visão Geral

Este guia mostra como adicionar os 7 endpoints de liquidação no seu `server.js` de forma organizada e documentada.

---

## 🎯 Passo 1: Adicionar Header Documentado

Adicione este header no **topo do arquivo** `server.js` (após os comentários existentes):

```javascript
/**
 * ============================================================================
 * GAMMA TRACKER - API SERVER
 * ============================================================================
 * 
 * Express API server para expor dados do Gamma Tracker em tempo real.
 * 
 * COMPONENTES PRINCIPAIS:
 * - DataCollector: Coleta dados de options da Binance
 * - GEXCalculator: Calcula Gamma Exposure
 * - RegimeAnalyzer: Analisa regime de mercado
 * - VolatilitySurfaceCalculator: Constrói superfície de volatilidade
 * - MaxPainCalculator: Calcula Max Pain
 * - SentimentAnalyzer: Analisa sentimento Put/Call
 * - StrategyRecommender: Recomenda estratégias de options
 * - LiquidationTracker: Rastreia liquidações forçadas (Binance Futures)
 * 
 * ENDPOINTS DISPONÍVEIS:
 * 
 * SISTEMA:
 * - GET /health                           - Health check
 * - GET /api/status                       - Status do coletor
 * 
 * MÉTRICAS:
 * - GET /api/metrics                      - Métricas completas (cached)
 * - GET /api/gamma-profile                - Perfil de gamma por strike
 * - GET /api/total-gex                    - GEX total
 * - GET /api/gamma-flip                   - Gamma flip level
 * - GET /api/walls                        - Put/Call walls
 * - GET /api/wall-zones                   - Zonas de suporte/resistência
 * 
 * VOLATILIDADE:
 * - GET /api/vol-surface                  - Superfície de volatilidade 3D
 * - GET /api/vol-skew                     - Volatility skew 2D
 * - GET /api/anomalies                    - Anomalias de volatilidade
 * 
 * MAX PAIN & SENTIMENT:
 * - GET /api/max-pain                     - Max Pain strike
 * - GET /api/sentiment                    - Análise de sentimento
 * 
 * ESTRATÉGIAS:
 * - GET /api/strategies/recommend         - Recomendações (top N)
 * - GET /api/strategies/all               - Todas as estratégias com scores
 * - GET /api/strategies/:id               - Estratégia específica
 * 
 * LIQUIDAÇÕES (NOVO):
 * - GET /api/liquidations/stats           - Estatísticas gerais
 * - GET /api/liquidations/energy          - Energy score (Half Pipe)
 * - GET /api/liquidations/summary         - Resumo completo
 * - GET /api/liquidations/recent          - Liquidações recentes
 * - GET /api/liquidations/early           - Early spike detection (H2)
 * - GET /api/liquidations/growth          - Taxa de crescimento (H1)
 * - GET /api/liquidations/cascade         - Detecção de cascata
 * 
 * HISTÓRICO (DATABASE):
 * - GET /api/market-history               - Histórico de snapshots
 * - GET /api/regime-history               - Histórico de regimes
 * 
 * PORTA: 3300 (padrão)
 * CORS: Habilitado
 * CACHE: Métricas com TTL de 5 segundos
 * 
 * ============================================================================
 */
```

---

## 🎯 Passo 2: Adicionar Comentários de Seção

Dentro do método `setupRoutes()`, adicione separadores visuais para organizar os endpoints:

### **Localizar a estrutura atual:**

```javascript
setupRoutes() {
  // ========================================
  // SISTEMA
  // ========================================
  
  // Health check
  this.app.get('/health', (req, res) => {
    // ...
  });
  
  // Status do coletor
  this.app.get('/api/status', (req, res) => {
    // ...
  });
  
  // ========================================
  // MÉTRICAS
  // ========================================
  
  // Métricas completas (com cache)
  this.app.get('/api/metrics', async (req, res) => {
    // ...
  });
  
  // ... outros endpoints de métricas ...
  
  // ========================================
  // VOLATILIDADE
  // ========================================
  
  // ... endpoints de volatilidade ...
  
  // ========================================
  // MAX PAIN & SENTIMENT
  // ========================================
  
  // ... endpoints de max pain e sentiment ...
  
  // ========================================
  // ESTRATÉGIAS
  // ========================================
  
  // ... endpoints de estratégias ...
  
  // ========================================
  // LIQUIDAÇÕES (NOVO!)
  // ========================================
  
  // [ADICIONAR AQUI O CONTEÚDO DE liquidation-endpoints-documented.js]
  
  // ========================================
  // HISTÓRICO (DATABASE)
  // ========================================
  
  // ... endpoints de histórico ...
  
} // fim de setupRoutes()
```

---

## 🎯 Passo 3: Adicionar Endpoints de Liquidação

### **Localização Exata:**

Procure no seu `server.js` pela seção de **estratégias** (endpoints `/api/strategies/*`).

Logo **APÓS** o último endpoint de estratégias e **ANTES** dos endpoints de histórico (database), adicione:

```javascript
    // ========================================
    // LIQUIDAÇÕES
    // ========================================
    
    // [COPIAR TODO O CONTEÚDO DE liquidation-endpoints-documented.js AQUI]
```

### **Exemplo Visual:**

```javascript
    // ... último endpoint de estratégias ...
    
    this.app.get('/api/strategies/:id', async (req, res) => {
      // ... código do endpoint ...
    });
    
    // ========================================
    // LIQUIDAÇÕES
    // ========================================
    
    // ENDPOINT 1: LIQUIDATION STATS
    this.app.get('/api/liquidations/stats', async (req, res) => {
      // ... código completo do endpoint ...
    });
    
    // ENDPOINT 2: LIQUIDATION ENERGY
    this.app.get('/api/liquidations/energy', async (req, res) => {
      // ... código completo do endpoint ...
    });
    
    // ... todos os 7 endpoints ...
    
    // ========================================
    // HISTÓRICO (DATABASE)
    // ========================================
    
    // ... endpoints de histórico ...
```

---

## 🎯 Passo 4: Verificar Dependências

Certifique-se de que o `LiquidationTracker` está integrado no `DataCollector`:

### **Checklist:**

- [ ] `LiquidationTracker.js` está em `/backend/src/`
- [ ] `DataCollector.js` foi atualizado com a versão integrada
- [ ] `DataCollector` tem os métodos:
  - `getLiquidationStats()`
  - `getLiquidationEnergy()`
  - `liquidationTracker` (propriedade pública)

### **Teste Rápido:**

Adicione este log temporário no `start()` do seu `server.js`:

```javascript
start() {
  // ... código existente ...
  
  // Teste de integração
  setTimeout(() => {
    const stats = this.dataCollector.getLiquidationStats();
    console.log('🧪 Teste LiquidationTracker:', stats ? '✅ OK' : '❌ FALHOU');
  }, 5000);
}
```

---

## 🎯 Passo 5: Reiniciar e Testar

### **1. Reiniciar Backend:**

```cmd
cd C:\Users\vruss\nodejs-cryptos\gamma-tracker\backend
node src/server.js
```

### **2. Verificar Console:**

Deve aparecer:
```
[DataCollector] ✅ LiquidationTracker conectado
[DataCollector] LiquidationTracker iniciado
[APIServer] Servidor iniciado na porta 3300
```

### **3. Testar Endpoints:**

```cmd
# Teste 1: Energy Score
curl http://localhost:3300/api/liquidations/energy

# Teste 2: Stats
curl http://localhost:3300/api/liquidations/stats

# Teste 3: Summary
curl http://localhost:3300/api/liquidations/summary

# Teste 4: Recent (últimos 10 min)
curl http://localhost:3300/api/liquidations/recent?minutes=10

# Teste 5: Early Spike
curl http://localhost:3300/api/liquidations/early?minutes=2

# Teste 6: Growth
curl http://localhost:3300/api/liquidations/growth

# Teste 7: Cascade
curl http://localhost:3300/api/liquidations/cascade
```

### **4. Resposta Esperada:**

Todos devem retornar JSON com `success: true`:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2025-12-31T10:00:00.000Z"
}
```

Se retornar `success: false` com erro `LiquidationTracker não está disponível`, significa que a integração no `DataCollector` não foi feita corretamente.

---

## 🎯 Passo 6: Documentar no README (Opcional)

Adicione uma seção no `README.md` do projeto:

```markdown
## 📊 Liquidation Endpoints

O Gamma Tracker agora rastreia liquidações forçadas da Binance Futures em tempo real.

### Endpoints Disponíveis:

| Endpoint | Descrição |
|----------|-----------|
| `/api/liquidations/stats` | Estatísticas gerais (1h/4h/24h) |
| `/api/liquidations/energy` | Energy score para Half Pipe Model |
| `/api/liquidations/summary` | Resumo completo (stats + energy) |
| `/api/liquidations/recent?minutes=X` | Liquidações recentes |
| `/api/liquidations/early?minutes=X` | Detecção de early spike (H2) |
| `/api/liquidations/growth` | Taxa de crescimento (H1) |
| `/api/liquidations/cascade` | Detecção de cascata |

### Exemplo de Uso:

```javascript
// Obter energy score
const response = await fetch('http://localhost:3300/api/liquidations/energy');
const { data } = await response.json();

console.log('Energy Score:', data.score);
console.log('Level:', data.level);
console.log('Direction:', data.direction);
```

### Interpretação do Energy Score:

- **0.0 - 0.2**: VERY_LOW - Mercado calmo
- **0.2 - 0.4**: LOW - Poucas liquidações
- **0.4 - 0.6**: MEDIUM - Movimento normal
- **0.6 - 0.8**: HIGH - Escape iminente
- **0.8 - 1.0**: EXTREME - Escape muito provável

### Half Pipe Model:

Os endpoints de liquidação são parte do **Half Pipe Model**, que combina:
- **Energia**: Liquidações (injetada) + Order Book (sustentada)
- **Potencial**: GEX + Gamma Walls
- **P_escape**: Probabilidade de escape = Energy / Potential

Ver documentação completa em `docs/HALF_PIPE_MODEL.md`.
```

---

## ✅ Checklist Final

- [ ] Header documentado adicionado no topo do `server.js`
- [ ] Separadores de seção adicionados em `setupRoutes()`
- [ ] 7 endpoints de liquidação copiados para `setupRoutes()`
- [ ] `LiquidationTracker` integrado no `DataCollector`
- [ ] Backend reiniciado
- [ ] Todos os 7 endpoints testados e funcionando
- [ ] Console mostra `✅ LiquidationTracker conectado`
- [ ] README atualizado (opcional)

---

## 🐛 Troubleshooting

### Problema: `LiquidationTracker não está disponível`

**Causa:** LiquidationTracker não foi integrado no DataCollector.

**Solução:**
1. Verificar se `LiquidationTracker.js` está em `/backend/src/`
2. Verificar se `DataCollector.js` foi substituído pela versão integrada
3. Reiniciar backend

### Problema: `Cannot read property 'getLiquidationStats' of undefined`

**Causa:** `dataCollector` não está inicializado.

**Solução:**
1. Verificar se `dataCollector` é passado no constructor do `APIServer`
2. Verificar se `dataCollector.start()` foi chamado antes de `apiServer.start()`

### Problema: Endpoints retornam dados vazios

**Causa:** Mercado calmo, poucas liquidações acontecendo.

**Solução:**
- Aguardar movimento de mercado
- Testar com `/api/liquidations/recent?minutes=60` (janela maior)
- Verificar se WebSocket está conectado: `/api/liquidations/summary`

---

## 📚 Documentação Adicional

- **LiquidationTracker:** `LIQUIDATION_TRACKER_INTEGRATION.md`
- **Half Pipe Model:** `HALF_PIPE_MODEL.md` (a ser criado)
- **Strategy Recommender:** `STRATEGY_RECOMMENDER_JOURNEY.md`

---

**Fim do Guia de Integração**
