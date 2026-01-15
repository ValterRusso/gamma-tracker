# 📊 Análise do Script de Entropia de Shannon

## 🎯 **VISÃO GERAL**

Script Streamlit que monitora **entropia do order book em tempo real** usando a API da Binance.

**Autor:** Valter (observação empírica de dias!)  
**Objetivo:** Detectar colapsos de entropia que precedem reversões de preço

---

## 🔬 **IMPLEMENTAÇÃO TÉCNICA**

### **1. Cálculo de Entropia (Linhas 11-18)**

```python
def calcular_entropia(volumes):
    volumes = np.array(volumes, dtype=float)
    total = np.sum(volumes)
    if total == 0:
        return 0.0
    p = volumes / total
    p = p[p > 0]  # Remove zeros para evitar log(0)
    return float(-np.sum(p * np.log2(p)))
```

**Fórmula de Shannon:**
```
H = -Σ (p_i * log₂(p_i))
```

**Onde:**
- `p_i` = proporção de volume no nível i
- `log₂` = logaritmo base 2 (bits de informação)
- Resultado em **bits** (0 a ~log₂(N) onde N = número de níveis)

**Exemplo prático:**
```
Order book com 80 níveis:
- Distribuição uniforme: H ≈ 6.32 bits (log₂(80))
- Concentração em 1 nível: H ≈ 0 bits
- Colapso observado: H cai de 5.3 para 4.3 (-18%)
```

---

### **2. Coleta de Dados (Linhas 20-53)**

**Fontes de dados:**

1. **Order Book (`/api/v3/depth`):**
   - Bids: volumes de compra
   - Asks: volumes de venda
   - Best bid/ask: mid-price

2. **Klines (`/api/v3/klines`):**
   - Volume do último minuto (1m)
   - Usado como confirmação

**Parâmetros:**
- `symbol`: Par de trading (ex: UNIUSDT)
- `limit`: Profundidade do book (20-100 níveis)
  - **Altcoins:** 80 níveis (padrão)
  - **BTC/ETH:** 40 níveis

**Output:**
```python
(timestamp, entropia_bid, entropia_ask, mid_price, volume)
```

---

### **3. Detecção de Eventos (Linhas 103-122)**

**Lógica de detecção:**

```python
# Máscara instantânea
mask_bid_raw = hist['entropia_bid'] < LIMIAR_ENTROPIA

# Persistência (N amostras consecutivas)
if persist_min > 1:
    roll_bid = mask_bid_raw.rolling(window=persist_min).apply(
        lambda x: 1.0 if np.all(x) else 0.0
    ) == 1.0
```

**Parâmetros de sinal:**
- `LIMIAR_ENTROPIA`: Threshold absoluto (padrão: 1.0)
- `persist_min`: Amostras consecutivas necessárias (padrão: 1)

**Tipos de evento:**
- **Evento BID:** Entropia BID < limiar (reversão de fundo)
- **Evento ASK:** Entropia ASK < limiar (reversão de topo)
- **Evento BOTH:** Ambos < limiar (squeeze extremo)

---

### **4. Visualização (Linhas 124-258)**

**Layout de 2 painéis:**

**Painel Superior (72% altura):**
- Eixo Y primário: Entropia BID/ASK (linhas)
- Eixo Y secundário: Preço (linha pontilhada)
- Marcadores: Estrelas em eventos detectados

**Painel Inferior (28% altura):**
- Volume de 1 minuto (barras)
- Destaque: Barras coloridas em eventos
  - BID-only: Uma cor
  - ASK-only: Outra cor
  - BOTH: Terceira cor

**Features:**
- `hovermode='x unified'`: Tooltip sincronizado
- `template='plotly_dark'`: Tema escuro
- `barmode='overlay'`: Sobreposição de barras

---

## 🎯 **PARÂMETROS CONFIGURÁVEIS**

| Parâmetro | Range | Padrão | Uso |
|-----------|-------|--------|-----|
| **Intervalo de coleta** | 5-60s | 30s | Balanço entre real-time e ruído |
| **Profundidade do book** | 5-100 | 80 | Altcoins: 80, BTC/ETH: 40 |
| **Pontos no gráfico** | 50-2000 | 1000 | Histórico visual |
| **Limiar de entropia** | 0.0+ | 1.0 | Threshold de alerta |
| **Persistência mínima** | 1+ | 1 | Anti-falso positivo |
| **Destacar volume** | bool | true | Visual de confirmação |

---

## 💡 **INSIGHTS DO CÓDIGO**

### **1. Approach empírico (não teórico):**
```python
# Sem thresholds fixos complexos
# Usa observação visual de "banda"
# Colapsos brutais são óbvios (-15% a -20%)
```

### **2. Volume como confirmação:**
```python
# Destaca barras de volume em eventos
# Colapso + volume alto = sinal forte
# Colapso + volume baixo = possível falso
```

### **3. Persistência para filtrar ruído:**
```python
# persist_min = 1: Sensível (mais sinais)
# persist_min = 3: Conservador (menos falsos)
```

### **4. Mid-price ao invés de close:**
```python
mid_price = (best_bid + best_ask) / 2
# Mais preciso que kline close
# Reflete estado real do book
```

---

## 🔍 **PADRÕES OBSERVADOS**

### **Reversão de fundo:**
```
1. Preço caindo
2. Volume aumentando
3. Entropia BID colapsa (<-15%)
4. Entropia ASK estável
→ Whale absorvendo vendas
→ Reversão iminente
```

### **Reversão de topo:**
```
1. Preço subindo
2. Volume moderado
3. Entropia ASK aumenta (+10-15%)
4. Entropia BID estável ou caindo
→ Vendedores se posicionando
→ "Manguinhas de fora"
→ Topo iminente
```

### **Consolidação:**
```
1. Entropia BID/ASK convergem
2. Volume baixo
3. Preço lateral
→ Sem movimentação relevante
```

---

## 🚀 **PONTOS FORTES**

1. ✅ **Simplicidade:** Código limpo, fácil de entender
2. ✅ **Real-time:** Streamlit com loop contínuo
3. ✅ **Visual:** Gráfico intuitivo com 2 painéis
4. ✅ **Configurável:** Todos os parâmetros ajustáveis
5. ✅ **Robusto:** Tratamento de erros, timeout
6. ✅ **Empírico:** Baseado em observação real, não teoria

---

## ⚠️ **LIMITAÇÕES**

1. **Single symbol:** Monitora apenas 1 par por vez
2. **Binance only:** Hardcoded para Binance API
3. **No persistence:** Histórico perde ao fechar
4. **No alerts:** Apenas warning visual
5. **No backtesting:** Sem análise histórica
6. **Threshold fixo:** Não adapta à volatilidade

---

## 🔧 **MELHORIAS SUGERIDAS**

### **1. Banda dinâmica (Bollinger-style):**
```python
# Ao invés de threshold fixo
mean_bid = hist['entropia_bid'].rolling(20).mean()
std_bid = hist['entropia_bid'].rolling(20).std()
lower_band = mean_bid - 2 * std_bid

# Evento quando cruza banda
mask_bid = hist['entropia_bid'] < lower_band
```

### **2. Delta de entropia:**
```python
# Mudança percentual
delta_bid = (ebid - hist['entropia_bid'].iloc[-5]) / hist['entropia_bid'].iloc[-5]
if delta_bid < -0.15:  # -15%
    signal = "BUY"
```

### **3. Ratio BID/ASK:**
```python
ratio = ebid / eask
if ratio < 0.85:  # Compradores concentrados
    signal = "BULLISH"
elif ratio > 1.15:  # Vendedores concentrados
    signal = "BEARISH"
```

### **4. Integração com RSI:**
```python
if delta_bid < -0.15 and rsi < 30:
    signal = "STRONG_BUY"  # Oversold + colapso
```

---

## 📊 **DADOS PARA INTEGRAÇÃO**

### **Input necessário (Backend):**
```typescript
interface OrderBookSnapshot {
  symbol: string;
  timestamp: number;
  bids: [price: number, volume: number][];  // Top N níveis
  asks: [price: number, volume: number][];  // Top N níveis
  volume_1m: number;  // Volume do último minuto
}
```

### **Output desejado (API):**
```typescript
interface EntropyData {
  timestamp: number;
  symbol: string;
  bid_entropy: number;      // 0 a ~log₂(N)
  ask_entropy: number;
  bid_delta: number;        // % change vs 5min ago
  ask_delta: number;
  ratio: number;            // bid_entropy / ask_entropy
  mid_price: number;
  volume_1m: number;
  signal: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;       // 0 to 1
  event_type?: "BID_COLLAPSE" | "ASK_SPIKE" | "BOTH";
}
```

---

## 🎯 **PRÓXIMOS PASSOS**

1. ✅ Portar cálculo de entropia para TypeScript/Node.js
2. ✅ Criar endpoint `/api/entropy/:symbol`
3. ✅ Adicionar WebSocket para updates em tempo real
4. ✅ Integrar visualização no Half Pipe Command Center
5. ✅ Adicionar alertas automáticos
6. ✅ Implementar banda dinâmica
7. ✅ Adicionar suporte multi-symbol
8. ✅ Persistir histórico em banco de dados
9. ✅ Criar backtesting framework

---

**Código pronto para produção após ajustes!** 🚀
