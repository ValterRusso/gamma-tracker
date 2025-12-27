# 📊 Gamma Tracker - Database Setup Guide

Guia completo para implementar persistência MySQL com Sequelize no Gamma Tracker.

---

## 🎯 Arquitetura

### **Estratégia de Retenção (Microscópio → Binóculos)**

| Tier | Tipo de Dado | Retenção | Frequência | Uso |
|------|--------------|----------|------------|-----|
| **Tier 1** | Snapshots detalhados | 7 dias | 5-15 min | Análise intraday, anomalias real-time |
| **Tier 2** | Snapshots agregados | 30 dias | 1 hora | Tendências diárias, comparação semanal |
| **Tier 3** | Snapshots diários | 1 ano | 1 dia | Backtesting, análise de longo prazo |
| **Tier 4** | Anomalias CRITICAL/HIGH | Permanente | - | Machine learning, padrões históricos |
| **Tier 4** | Anomalias MEDIUM/LOW | 90 dias | - | Análise de curto prazo |

### **Schema Multi-Asset**

```
assets (BTC, ETH, SOL)
  ↓
market_snapshots (timeline mestre)
  ├─→ options_history (todas as options)
  └─→ anomalies_log (anomalias detectadas)
```

---

## 📦 Instalação

### **1. Instalar Dependências**

```bash
cd gamma-tracker/backend
npm install sequelize mysql2 --save
```

### **2. Configurar MySQL**

**Criar banco de dados:**

```bash
mysql -u root -p < database-schema.sql
```

Ou manualmente:

```sql
CREATE DATABASE gamma_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### **3. Configurar Variáveis de Ambiente**

Adicione ao `.env`:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=gamma_tracker
DB_USER=root
DB_PASSWORD=sua_senha_aqui
```

---

## 🗂️ Estrutura de Arquivos

Copie os arquivos para o projeto:

```
gamma-tracker/backend/
├── src/
│   ├── database/
│   │   ├── Database.js                    ← sequelize-database.js
│   │   ├── models/
│   │   │   ├── Asset.js                   ← sequelize-models-Asset.js
│   │   │   ├── MarketSnapshot.js          ← sequelize-models-MarketSnapshot.js
│   │   │   ├── OptionsHistory.js          ← sequelize-models-OptionsHistory.js
│   │   │   └── AnomaliesLog.js            ← sequelize-models-AnomaliesLog.js
│   │   └── services/
│   │       ├── DataPersistenceService.js  ← DataPersistenceService.js
│   │       └── DataRetentionService.js    ← DataRetentionService.js
│   └── ...
└── database-schema.sql                    ← database-schema.sql
```

---

## 🚀 Integração no Backend

### **1. Inicializar Database no `index.js`**

```javascript
const Database = require('./database/Database');
const DataPersistenceService = require('./database/services/DataPersistenceService');
const DataRetentionService = require('./database/services/DataRetentionService');

async function main() {
  try {
    // 1. Conectar ao banco
    const database = new Database();
    await database.connect();
    
    // 2. Inicializar serviços
    const persistence = new DataPersistenceService(database);
    await persistence.initialize('BTC'); // Asset symbol
    
    const retention = new DataRetentionService(database);
    retention.startAutomatedCleanup(24); // Cleanup a cada 24h
    
    // 3. Inicializar collectors e calculators (existentes)
    const dataCollector = new DataCollector(config);
    const gexCalculator = new GEXCalculator();
    const volSurfaceCalculator = new VolatilitySurfaceCalculator();
    const anomalyDetector = new VolatilityAnomalyDetector(logger);
    
    // 4. Iniciar coleta de dados
    await dataCollector.start();
    
    // 5. Loop principal de coleta e persistência
    setInterval(async () => {
      try {
        // Coletar dados
        const options = dataCollector.getAllOptions();
        const spotPrice = dataCollector.getSpotPrice();
        
        // Calcular métricas
        const metrics = gexCalculator.calculate(options, spotPrice);
        
        // Detectar anomalias
        const surface = volSurfaceCalculator.buildSurface(options, spotPrice);
        const anomalies = anomalyDetector.detectAnomalies(surface, spotPrice);
        
        // Salvar no banco
        await persistence.saveSnapshot({
          options: options,
          spotPrice: spotPrice,
          metrics: metrics,
          anomalies: anomalies.anomalies
        });
        
        logger.info('Snapshot salvo no banco de dados');
      } catch (error) {
        logger.error('Erro ao salvar snapshot', error);
      }
    }, 10 * 60 * 1000); // A cada 10 minutos
    
    // 6. Iniciar API server
    const apiServer = new APIServer(dataCollector, gexCalculator, regimeAnalyzer);
    await apiServer.start();
    
    logger.info('Sistema iniciado com persistência ativada');
  } catch (error) {
    logger.error('Erro ao iniciar sistema', error);
    process.exit(1);
  }
}

main();
```

---

## 📊 Uso dos Serviços

### **DataPersistenceService**

**Salvar snapshot:**

```javascript
await persistence.saveSnapshot({
  options: options,        // Array de options
  spotPrice: spotPrice,    // Preço atual do BTC
  metrics: metrics,        // GEX e outras métricas
  anomalies: anomalies     // Array de anomalias detectadas
});
```

**Consultar snapshots recentes:**

```javascript
const recent = await persistence.getRecentSnapshots(10);
console.log(recent);
```

**Consultar snapshot específico com options e anomalias:**

```javascript
const snapshot = await persistence.getSnapshotById(123);
console.log(snapshot.options);      // Options daquele momento
console.log(snapshot.anomalies);    // Anomalias detectadas
```

**Consultar anomalias por período:**

```javascript
const startTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 dias atrás
const endTime = Date.now();

const anomalies = await persistence.getAnomaliesByTimeRange(
  startTime, 
  endTime, 
  'HIGH'  // Filtrar por severity (opcional)
);
```

### **DataRetentionService**

**Limpeza automática (já configurada no `main()`):**

```javascript
retention.startAutomatedCleanup(24); // A cada 24 horas
```

**Limpeza manual:**

```javascript
// Limpar dados com mais de X dias
await retention.cleanDataOlderThan(30);

// Obter estatísticas de retenção
const stats = await retention.getRetentionStats();
console.log(stats);
```

**Parar limpeza automática:**

```javascript
retention.stopAutomatedCleanup();
```

---

## 🔍 Queries Úteis

### **Ver estatísticas de retenção:**

```sql
SELECT * FROM v_data_retention_status;
```

### **Contar snapshots por dia:**

```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as snapshots
FROM market_snapshots
WHERE asset_id = 1
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;
```

### **Anomalias CRITICAL dos últimos 7 dias:**

```sql
SELECT 
  a.*,
  s.spot_price,
  s.timestamp
FROM anomalies_log a
JOIN market_snapshots s ON a.snapshot_id = s.id
WHERE 
  a.severity = 'CRITICAL'
  AND a.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY a.z_score DESC;
```

### **Options com maior volume em um período:**

```sql
SELECT 
  symbol,
  strike,
  dte,
  side,
  AVG(volume) as avg_volume,
  MAX(volume) as max_volume,
  COUNT(*) as snapshots
FROM options_history
WHERE 
  asset_id = 1
  AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
GROUP BY symbol, strike, dte, side
ORDER BY avg_volume DESC
LIMIT 20;
```

---

## 🎯 Próximos Passos

### **Fase 2: Agregação de Dados (Tier 2 e 3)**

Implementar:
- **Hourly Aggregator** - Agregar snapshots de 1 hora
- **Daily Aggregator** - Agregar snapshots diários
- Novas tabelas: `market_snapshots_hourly`, `market_snapshots_daily`

### **Fase 3: Análise Histórica**

Implementar:
- **Historical Comparison API** - Comparar IV atual vs histórico
- **Anomaly Persistence Tracking** - Rastrear anomalias que persistem
- **Volatility Regime Changes** - Detectar mudanças de regime

### **Fase 4: Machine Learning**

Implementar:
- **Anomaly Prediction** - Prever anomalias futuras
- **Pattern Recognition** - Reconhecer padrões de skew
- **Backtesting Engine** - Testar estratégias com dados históricos

---

## 🐛 Troubleshooting

### **Erro: "Access denied for user"**

Verificar credenciais no `.env` e permissões do usuário MySQL:

```sql
GRANT ALL PRIVILEGES ON gamma_tracker.* TO 'root'@'localhost';
FLUSH PRIVILEGES;
```

### **Erro: "Table doesn't exist"**

Executar o schema SQL:

```bash
mysql -u root -p gamma_tracker < database-schema.sql
```

### **Performance lenta em queries**

Verificar índices:

```sql
SHOW INDEX FROM options_history;
```

Analisar query plan:

```sql
EXPLAIN SELECT * FROM options_history WHERE asset_id = 1 AND strike = 95000;
```

### **Banco de dados crescendo muito**

Verificar política de retenção e executar limpeza manual:

```javascript
await retention.cleanDataOlderThan(7);
```

---

## 📈 Estimativas de Volume

**Cenário típico:**
- 500 options por snapshot
- Coleta a cada 10 min = 144 snapshots/dia
- 7 dias de retenção detalhada

**Volume estimado:**
- Snapshots: ~1,000 registros (7 dias)
- Options: ~500,000 registros (500 × 144 × 7)
- Anomalies: ~5,000 registros (assumindo ~5 anomalias/snapshot)

**Tamanho no disco:** ~100-200 MB (com índices)

**Performance esperada:** Queries < 50ms com índices adequados

---

## ✅ Checklist de Implementação

- [ ] Instalar `sequelize` e `mysql2`
- [ ] Criar banco de dados MySQL
- [ ] Executar `database-schema.sql`
- [ ] Copiar arquivos de models e services
- [ ] Configurar variáveis de ambiente (`.env`)
- [ ] Integrar Database no `index.js`
- [ ] Integrar DataPersistenceService no loop de coleta
- [ ] Configurar DataRetentionService com cleanup automático
- [ ] Testar salvamento de snapshots
- [ ] Verificar limpeza automática após 24h
- [ ] Monitorar estatísticas de retenção

---

**Pronto para implementar! 🚀**

Qualquer dúvida, consulte os comentários nos arquivos de código ou execute queries de debug no MySQL.
