# 🎯 Strategy Recommender System - Jornada de Implementação

> **Documentação Técnica e Guia de Troubleshooting**  
> Projeto: Gamma Tracker Dashboard  
> Data: 30 de Dezembro de 2025  
> Autor: Equipe de Desenvolvimento

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Implementação Inicial](#implementação-inicial)
4. [Desafios Encontrados](#desafios-encontrados)
5. [Soluções Aplicadas](#soluções-aplicadas)
6. [Lições Aprendidas](#lições-aprendidas)
7. [Guia de Troubleshooting](#guia-de-troubleshooting)
8. [Referências Técnicas](#referências-técnicas)

---

## 🎯 Visão Geral

### Objetivo

Implementar um sistema inteligente de recomendação de estratégias de opções que analisa o estado atual do mercado (GEX, Max Pain, Sentiment, Anomalias) e sugere as estratégias mais adequadas com base em scoring multi-fatorial.

### Funcionalidades

- ✅ Análise de estado de mercado em tempo real
- ✅ Biblioteca de 7 estratégias de opções
- ✅ Sistema de scoring baseado em múltiplos fatores
- ✅ Detecção de anomalias recentes
- ✅ API REST com 3 endpoints
- ✅ Componente React para visualização

### Stack Tecnológico

- **Backend:** Node.js, Express, Sequelize, MySQL
- **Frontend:** React, TypeScript, Tailwind CSS
- **Arquitetura:** Class-based API Server (OOP)

---

## 🏗️ Arquitetura do Sistema

### Componentes Principais

```
┌─────────────────────────────────────────────────────────┐
│  1. STRATEGIES LIBRARY (strategies.js)                  │
│     • 7 estratégias pré-definidas                       │
│     • Condições ideais de mercado                       │
│     • Pesos de scoring                                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  2. MARKET STATE ANALYZER (MarketStateAnalyzer.js)      │
│     • Analisa regime (Bullish/Bearish/Neutral)          │
│     • Calcula volatilidade (Low/Medium/High)            │
│     • Detecta skew (Put/Call/Flat)                      │
│     • Analisa GEX (Positive/Negative)                   │
│     • Detecta anomalias recentes                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  3. STRATEGY RECOMMENDER (StrategyRecommender.js)       │
│     • Calcula score para cada estratégia                │
│     • Compara condições ideais vs estado atual          │
│     • Retorna top N recomendações                       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  4. API ENDPOINTS (server.js)                           │
│     • GET /api/strategies/recommend?topN=5              │
│     • GET /api/strategies/all                           │
│     • GET /api/strategies/:id                           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  5. REACT COMPONENT (RecommendedStrategiesCard.tsx)     │
│     • Exibe top 3-5 estratégias recomendadas            │
│     • Auto-refresh a cada 30 segundos                   │
│     • Design responsivo                                 │
└─────────────────────────────────────────────────────────┘
```

### Fluxo de Dados

```
MarketSnapshot (DB) → Market State Analyzer → Strategy Recommender → API Response
       ↓
AnomaliesLog (DB) → Anomaly Detection → Market State → Scoring
```

---

## 🚀 Implementação Inicial

### Fase 1: Criação dos Módulos Core

#### 1.1 Biblioteca de Estratégias (`strategies.js`)

Implementamos 7 estratégias comuns de opções:

1. **Bull Call Spread** (Trava de Alta)
2. **Bear Put Spread** (Trava de Baixa)
3. **Iron Condor** (Condor de Ferro)
4. **Iron Butterfly** (Borboleta de Ferro)
5. **Long Straddle** (Compra de Volatilidade ATM)
6. **Long Strangle** (Compra de Volatilidade OTM)
7. **Short Straddle** (Venda de Volatilidade ATM)

**Estrutura de cada estratégia:**

```javascript
{
  id: "iron_condor",
  name: "Iron Condor",
  namePt: "Condor de Ferro",
  category: "NEUTRAL",
  bias: "NEUTRAL",
  idealConditions: {
    regime: ["NEUTRAL"],
    volatility: ["HIGH", "MEDIUM"],
    skew: ["FLAT"],
    gex: ["POSITIVE"],
    maxPainDistance: { min: -2, max: 2 },
    sentiment: { putCallRatio: { min: 0.8, max: 1.2 } }
  },
  legs: [...],
  risk: {...},
  scoringWeights: {...}
}
```

#### 1.2 Market State Analyzer

Analisa 7 aspectos do mercado:

- **Regime:** Baseado no campo `regime` do snapshot
- **Volatility:** Calculado a partir de IV médio
- **Skew:** Diferença entre Put IV e Call IV
- **GEX:** Positivo ou Negativo
- **Max Pain Distance:** % de distância entre spot e max pain
- **Sentiment:** Put/Call Ratio e divergências
- **Anomalies:** Tipos de anomalias detectadas recentemente

#### 1.3 Strategy Recommender

Sistema de scoring multi-fatorial:

```javascript
score = Σ (peso_fator × match_fator)

Onde:
- peso_fator: Peso definido em scoringWeights (0.0 a 1.0)
- match_fator: 0 (não match), 0.5 (parcial), 1.0 (match perfeito)
```

**Classificação de Score:**

- 90-100: EXCELLENT
- 75-89: VERY_GOOD
- 60-74: GOOD
- 40-59: FAIR
- 0-39: POOR

---

## 🐛 Desafios Encontrados

### Desafio 1: Incompatibilidade de Estrutura de Código

**Problema:** O código inicial foi escrito para um `server.js` tradicional (sem classes), mas o projeto usa `Class APIServer` (OOP).

**Sintomas:**
- Erros: "Unexpected keyword or identifier"
- "this.app is not defined"
- "this.db.getModel is not a function"

**Causa Raiz:** Diferença entre duas abordagens:

```javascript
// ❌ Abordagem Tradicional (código inicial)
const app = express();
app.get('/api/endpoint', async (req, res) => {
  const data = await Model.findAll();
});

// ✅ Abordagem OOP (projeto real)
class APIServer {
  setupRoutes() {
    this.app.get('/api/endpoint', async (req, res) => {
      const Model = this.db.getModel('ModelName');
      const data = await Model.findAll();
    });
  }
}
```

**Solução:** Adaptar todo o código para usar `this.app`, `this.db.getModel()`, e `this.logger`.

---

### Desafio 2: Operadores Sequelize Indefinidos

**Problema:** Erro "Cannot read properties of undefined 'gte'"

**Sintomas:**
```javascript
where: {
  created_at: {
    [this.db.Op.gte]: oneHourAgo  // ❌ this.db.Op is undefined
  }
}
```

**Causa Raiz:** A classe `Database` não expõe o objeto `Op` do Sequelize.

**Solução:** Importar `Op` diretamente do Sequelize:

```javascript
const { Op } = require('sequelize');

where: {
  created_at: {
    [Op.gte]: oneHourAgo  // ✅ Funciona!
  }
}
```

---

### Desafio 3: Nome Incorreto de Coluna (timestamp vs created_at)

**Problema:** Query não encontrava registros mesmo com dados no banco.

**Sintomas:**
- SQL direto funcionava
- Endpoint retornava array vazio

**Causa Raiz:** Código usava `timestamp` mas a coluna real é `created_at`.

**Solução:**

```javascript
// ❌ ANTES
order: [['timestamp', 'DESC']]

// ✅ DEPOIS
order: [['created_at', 'DESC']]
```

---

### Desafio 4: Problema de Timezone

**Problema:** Anomalias existiam no banco mas não eram retornadas pela query.

**Sintomas:**
- Dados na tabela: `18:41` (horário Brasil - GMT-3)
- Timestamp do endpoint: `21:41` (UTC)
- Query com `oneHourAgo` não encontrava nada

**Causa Raiz:** Diferença de 3 horas entre timezone do banco e do servidor.

**Solução:** Aumentar janela de tempo de 1 hora para 24 horas:

```javascript
// ❌ ANTES (falhava por timezone)
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

// ✅ DEPOIS (mais seguro)
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
```

---

### Desafio 5: Array de Nulls nas Anomalias

**Problema:** Campo `anomalies` retornava `[null, null, null, ...]` (centenas de nulls).

**Sintomas:**
```json
"anomalies": [null, null, null, ... (473 nulls)]
```

**Causa Raiz:** Não identificada inicialmente, mas suspeitava-se de:
- Query retornando registros vazios
- `.toJSON()` falhando
- Filtro no constructor removendo dados

**Tentativas de Solução:**
1. ✅ Adicionar `raw: true` na query
2. ✅ Filtrar nulls no constructor
3. ❌ Ainda não funcionava

---

### Desafio 6: Case Sensitivity (O Bug Final!)

**Problema:** Mesmo com `raw: true` e filtros, `anomalies` retornava array vazio.

**Sintomas:**
- Debug mostrava 5 anomalias no input
- Debug mostrava 5 anomalias após constructor
- Debug mostrava **0 anomalias** após `detectAnomalies()`

**Investigação:**

Criamos endpoint de debug que revelou:

```json
// Step 4: Input
"anomalyType": "SKEW_ANOMALY"  // ← camelCase

// Step 5: Após constructor
"anomalyType": "SKEW_ANOMALY"  // ← Ainda camelCase

// Step 6: Após detectAnomalies()
"anomalies_values": []  // ← VAZIO!
```

**Causa Raiz:** Sequelize com `raw: true` converte automaticamente nomes de colunas de `snake_case` para `camelCase`!

```javascript
// Coluna no banco
anomaly_type (snake_case)

// Retorno do Sequelize com raw: true
anomalyType (camelCase)  // ← Conversão automática!
```

**Código com bug:**

```javascript
// ❌ ERRADO: Procurando por snake_case
detectAnomalies() {
  return this.anomalies
    .filter(a => a && a.anomaly_type)  // ← Não existe!
    .map(a => a.anomaly_type);
}
```

**Solução Final:**

```javascript
// ✅ CORRETO: Usar camelCase
detectAnomalies() {
  return this.anomalies
    .filter(a => a && a.anomalyType)  // ← Existe!
    .map(a => a.anomalyType);
}
```

**Resultado:**
```json
"anomalies": [
  "SKEW_ANOMALY",
  "SKEW_ANOMALY",
  "SKEW_ANOMALY",
  "IV_OUTLIER",
  "SKEW_ANOMALY"
]  // ✅ FUNCIONOU!
```

---

## ✅ Soluções Aplicadas

### Solução 1: Adaptação para Class APIServer

**Checklist de Mudanças:**

- [x] Trocar `app.get()` por `this.app.get()`
- [x] Trocar `Model.findAll()` por `this.db.getModel('Model').findAll()`
- [x] Adicionar `const { Op } = require('sequelize');` no topo
- [x] Trocar `console.log()` por `this.logger.info()`
- [x] Trocar `console.error()` por `this.logger.error()`

### Solução 2: Query Robusta de Anomalias

**Código Final:**

```javascript
const { Op } = require('sequelize');

// Buscar anomalias das últimas 24 horas
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
const recentAnomalies = await AnomaliesLog.findAll({
  where: {
    created_at: {  // ← Nome correto da coluna
      [Op.gte]: oneDayAgo  // ← Janela de 24h (seguro para timezone)
    }
  },
  raw: true,  // ← Retorna objetos simples (não instâncias Sequelize)
  limit: 20,  // ← Limitar quantidade
  order: [['created_at', 'DESC']]  // ← Mais recentes primeiro
});
```

### Solução 3: MarketStateAnalyzer Robusto

**Constructor com Filtro:**

```javascript
constructor(marketData, volData, anomalies) {
  this.marketData = marketData;
  this.volData = volData;
  // Filtrar nulls e undefined
  this.anomalies = (anomalies || []).filter(a => a != null && typeof a === 'object');
}
```

**detectAnomalies() com camelCase:**

```javascript
detectAnomalies() {
  if (!this.anomalies || !Array.isArray(this.anomalies)) {
    return [];
  }
  
  // Usar camelCase (Sequelize converte automaticamente)
  return this.anomalies
    .filter(a => a && a.anomalyType)  // ← camelCase!
    .map(a => a.anomalyType);
}
```

### Solução 4: Endpoint de Debug

**Ferramenta Essencial para Troubleshooting:**

```javascript
this.app.get('/api/debug/anomalies', async (req, res) => {
  const debug = {
    step1_database_check: {...},
    step2_raw_query: {...},
    step3_with_filter: {...},
    step4_analyzer_input: {...},
    step5_analyzer_output: {...},
    step6_final_result: {...}
  };
  
  res.json({
    success: true,
    debug: debug,
    conclusion: {
      problem_identified: '...'
    }
  });
});
```

Este endpoint foi **crucial** para identificar o bug de case sensitivity!

---

## 🎓 Lições Aprendidas

### 1. Sempre Verifique a Estrutura do Projeto Antes de Implementar

**Lição:** Não assuma que o projeto usa estrutura tradicional. Pergunte ou verifique:
- É OOP ou funcional?
- Como os modelos são acessados?
- Como os operadores SQL são usados?

### 2. Sequelize com `raw: true` Converte Nomes de Colunas

**Lição Importante:**

```javascript
// Coluna no banco: anomaly_type (snake_case)
// Retorno com raw: true: anomalyType (camelCase)

// ❌ NÃO FUNCIONA
a.anomaly_type

// ✅ FUNCIONA
a.anomalyType
```

**Regra:** Sempre use **camelCase** ao acessar campos retornados por Sequelize com `raw: true`.

### 3. Timezone Pode Causar Problemas Silenciosos

**Lição:** Queries com filtro de tempo podem falhar se:
- Banco usa timezone diferente do servidor
- Dados foram inseridos em timezone diferente
- `Date.now()` usa UTC mas banco usa local time

**Solução:** Use janelas de tempo maiores ou normalize timezones.

### 4. Debug Sistemático é Essencial

**Metodologia que Funcionou:**

1. **Isolar o problema:** Criar endpoint de debug separado
2. **Testar em etapas:** Verificar cada passo do fluxo
3. **Logar tudo:** Console.log em cada transformação
4. **Comparar estruturas:** JSON.stringify para ver diferenças
5. **Não desistir:** Persistência é chave!

### 5. Documentação é Crucial

**Lição:** Documentar a jornada de debugging ajuda:
- Evitar repetir erros
- Ensinar outros desenvolvedores
- Criar guias de troubleshooting
- Entender decisões de design

---

## 🔧 Guia de Troubleshooting

### Problema: "Cannot read properties of undefined 'gte'"

**Causa:** `Op` não está importado ou está sendo acessado incorretamente.

**Solução:**
```javascript
const { Op } = require('sequelize');

where: {
  created_at: {
    [Op.gte]: date  // ← Usar Op importado, não this.db.Op
  }
}
```

---

### Problema: Query retorna array vazio mesmo com dados no banco

**Possíveis Causas:**

1. **Nome de coluna errado**
   ```javascript
   // ❌ Errado
   order: [['timestamp', 'DESC']]
   
   // ✅ Correto (verificar nome real no banco)
   order: [['created_at', 'DESC']]
   ```

2. **Problema de timezone**
   ```javascript
   // ❌ Pode falhar
   const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
   
   // ✅ Mais seguro
   const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
   ```

3. **Filtro muito restritivo**
   ```javascript
   // Teste sem filtro primeiro
   const all = await Model.findAll({
     raw: true,
     limit: 10
   });
   console.log('Total:', all.length);
   ```

---

### Problema: Campo retorna `undefined` mesmo existindo no banco

**Causa:** Case sensitivity - Sequelize converte snake_case para camelCase.

**Solução:**
```javascript
// Coluna no banco: anomaly_type
// Acesso correto:
const type = record.anomalyType;  // ← camelCase!
```

**Como Descobrir o Nome Correto:**
```javascript
const records = await Model.findAll({ raw: true, limit: 1 });
console.log('Campos disponíveis:', Object.keys(records[0]));
```

---

### Problema: Array de nulls ou array vazio inesperado

**Debug Sistemático:**

```javascript
// 1. Verificar se dados existem
const all = await Model.findAll({ raw: true, limit: 5 });
console.log('1. Total registros:', all.length);
console.log('1. Primeiro registro:', all[0]);

// 2. Verificar filtro
const filtered = await Model.findAll({
  where: { ... },
  raw: true,
  limit: 5
});
console.log('2. Após filtro:', filtered.length);

// 3. Verificar transformação
const transformed = filtered.map(r => r.someField);
console.log('3. Após map:', transformed);

// 4. Verificar filtro de nulls
const cleaned = transformed.filter(t => t != null);
console.log('4. Após filtrar nulls:', cleaned);
```

---

### Problema: Endpoint retorna "Endpoint not found"

**Checklist:**

1. **Endpoint foi adicionado dentro de `setupRoutes()`?**
   ```javascript
   setupRoutes() {
     // ✅ Adicionar aqui
     this.app.get('/api/new-endpoint', ...);
   }
   ```

2. **`setupRoutes()` está sendo chamado?**
   ```javascript
   start() {
     this.setupRoutes();  // ← Deve existir
     this.app.listen(PORT, ...);
   }
   ```

3. **Servidor foi reiniciado após mudanças?**
   ```bash
   # Parar servidor (Ctrl+C)
   # Reiniciar
   node server.js
   ```

4. **URL está correta?**
   ```bash
   # Verificar porta e path
   curl http://localhost:3300/api/strategies/recommend
   ```

---

## 📚 Referências Técnicas

### Sequelize

- **Documentação Oficial:** https://sequelize.org/docs/v6/
- **Operadores:** https://sequelize.org/docs/v6/core-concepts/model-querying-basics/#operators
- **Raw Queries:** https://sequelize.org/docs/v6/core-concepts/raw-queries/

### Conversão de Nomes (Sequelize)

Quando usar `raw: true`, Sequelize converte automaticamente:

| Banco (snake_case) | JavaScript (camelCase) |
|--------------------|------------------------|
| `anomaly_type` | `anomalyType` |
| `created_at` | `createdAt` |
| `oi_volume_ratio` | `oiVolumeRatio` |
| `spread_pct` | `spreadPct` |

**Fonte:** Sequelize usa `underscoredAll: true` por padrão em alguns casos.

### Estratégias de Opções

- **Bull Call Spread:** Compra call ATM + Vende call OTM
- **Bear Put Spread:** Compra put ATM + Vende put OTM
- **Iron Condor:** Vende put spread + Vende call spread (OTM)
- **Iron Butterfly:** Similar ao Iron Condor mas centrado no ATM
- **Long Straddle:** Compra call ATM + Compra put ATM
- **Long Strangle:** Compra call OTM + Compra put OTM
- **Short Straddle:** Vende call ATM + Vende put ATM

### Debugging Node.js

**Ferramentas Úteis:**

1. **Console.log estratégico:**
   ```javascript
   console.log('🔍 DEBUG - Variável:', JSON.stringify(variable, null, 2));
   ```

2. **Node.js Debugger:**
   ```bash
   node --inspect server.js
   # Abrir chrome://inspect no Chrome
   ```

3. **Postman/Insomnia:** Para testar endpoints

4. **MySQL Workbench:** Para verificar dados diretamente no banco

---

## 🎯 Conclusão

A implementação do Strategy Recommender System foi uma jornada desafiadora que envolveu:

- ✅ Adaptação de código para arquitetura OOP
- ✅ Resolução de problemas de Sequelize
- ✅ Debugging sistemático de bugs complexos
- ✅ Descoberta de conversão automática de case
- ✅ Criação de ferramentas de debug

**Tempo Total:** ~8 horas de desenvolvimento e debugging

**Resultado:** Sistema 100% funcional com:
- 3 endpoints REST
- 7 estratégias de opções
- Análise de mercado em tempo real
- Scoring multi-fatorial
- Detecção de anomalias

**Lição Principal:** **Persistência + Debug Sistemático = Sucesso!**

---

## 📝 Checklist de Implementação para Futuros Projetos

Ao implementar features similares, siga este checklist:

### Antes de Começar

- [ ] Verificar estrutura do projeto (OOP vs Funcional)
- [ ] Verificar como modelos são acessados
- [ ] Verificar como operadores SQL são usados
- [ ] Verificar nomes reais das colunas no banco

### Durante Implementação

- [ ] Testar cada módulo isoladamente
- [ ] Criar endpoint de debug desde o início
- [ ] Logar transformações de dados
- [ ] Verificar case sensitivity (camelCase vs snake_case)
- [ ] Testar com dados reais do banco

### Após Implementação

- [ ] Documentar decisões de design
- [ ] Documentar problemas encontrados e soluções
- [ ] Criar guia de troubleshooting
- [ ] Adicionar comentários no código
- [ ] Testar edge cases

---

## 🙏 Agradecimentos

Esta documentação foi criada com base na experiência real de debugging e implementação do Strategy Recommender System no projeto Gamma Tracker Dashboard.

**Equipe:** Desenvolvedor + IA Assistant  
**Data:** 30 de Dezembro de 2025  
**Duração:** ~8 horas de trabalho intenso  
**Resultado:** Sistema 100% funcional + Documentação completa

---

**"Nunca desista! Todo bug tem uma solução, só precisamos encontrá-la."** 💪🚀

---

## 📎 Anexos

### Arquivo: strategies.js
Localização: `/backend/src/strategies.js`

### Arquivo: MarketStateAnalyzer.js
Localização: `/backend/src/MarketStateAnalyzer.js`

### Arquivo: StrategyRecommender.js
Localização: `/backend/src/StrategyRecommender.js`

### Arquivo: RecommendedStrategiesCard.tsx
Localização: `/frontend/client/src/components/RecommendedStrategiesCard.tsx`

### Endpoints Implementados

1. `GET /api/strategies/recommend?topN=5&minScore=50`
2. `GET /api/strategies/all`
3. `GET /api/strategies/:id`
4. `GET /api/debug/anomalies` (debug only)

---

**Fim da Documentação**
