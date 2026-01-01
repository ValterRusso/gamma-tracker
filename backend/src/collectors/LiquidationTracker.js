/**
 * LiquidationTracker - Monitor Binance Forced Orders Stream
 * 
 * Rastreia liquidações forçadas em tempo real via WebSocket da Binance
 * e calcula métricas de "energia" para o modelo Half Pipe.
 * 
 * Features:
 * - Conexão WebSocket com auto-reconnect
 * - Histórico de liquidações (1h, 4h, 24h)
 * - Detecção de cascatas de liquidações
 * - Cálculo de energy score
 * - Análise de desequilíbrio long/short
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class LiquidationTracker extends EventEmitter {
  constructor(symbol = 'btcusdt', logger = console) {
    super();
    
    this.symbol = symbol.toLowerCase();
    this.logger = logger;
    this.ws = null;
    this.reconnectTimeout = null;
    this.reconnectDelay = 5000; // 5 segundos
    
    // Histórico de liquidações
    this.liquidations = {
      last1h: [],
      last4h: [],
      last24h: []
    };
    
    // Estatísticas calculadas
    this.stats = {
      totalValue1h: 0,
      totalValue4h: 0,
      totalValue24h: 0,
      longLiquidated1h: 0,
      shortLiquidated1h: 0,
      cascadeDetected: false,
      largestLiquidation: null,
      lastUpdate: null
    };
    
    // Configurações
    this.config = {
      cascadeThreshold: 10,        // Liquidações por minuto para considerar cascata
      largeSize: 50000,            // USD - Liquidação considerada "grande"
      massiveSize: 200000,         // USD - Liquidação considerada "massiva"
      cleanupInterval: 60000       // 1 minuto - Intervalo de limpeza de dados antigos
    };
    
    // Iniciar limpeza periódica
    this.startCleanupInterval();
  }
  
  /**
   * Conectar ao WebSocket da Binance
   */
  connect() {
    const url = `wss://fstream.binance.com/ws/${this.symbol}@forceOrder`;
    
    this.logger.info(`🔌 Conectando ao Binance Forced Orders: ${this.symbol}`);
    
    try {
      this.ws = new WebSocket(url);
      
      this.ws.on('open', () => {
        this.logger.info(`✅ Conectado ao Binance Forced Orders: ${this.symbol}`);
        this.emit('connected');
      });
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleLiquidation(message);
        } catch (error) {
          this.logger.error('❌ Erro ao parsear mensagem:', error);
        }
      });
      
      this.ws.on('error', (error) => {
        this.logger.error('❌ WebSocket error:', error.message);
        this.emit('error', error);
      });
      
      this.ws.on('close', (code, reason) => {
        this.logger.warn(`🔌 WebSocket fechado (code: ${code}, reason: ${reason})`);
        this.emit('disconnected');
        this.scheduleReconnect();
      });
      
    } catch (error) {
      this.logger.error('❌ Erro ao conectar WebSocket:', error);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Agendar reconexão
   */
  scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.logger.info(`🔄 Reconectando em ${this.reconnectDelay / 1000}s...`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }
  
  /**
   * Desconectar WebSocket
   */
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.logger.info('🔌 Desconectado do Binance Forced Orders');
  }
  
  /**
   * Processar liquidação recebida
   */
  handleLiquidation(message) {
    if (message.e !== 'forceOrder') return;
    
    const liquidation = {
      timestamp: message.E,
      symbol: message.o.s,
      side: message.o.S,  // SELL = long liquidado, BUY = short liquidado
      quantity: parseFloat(message.o.q),
      price: parseFloat(message.o.ap),
      value: parseFloat(message.o.q) * parseFloat(message.o.ap),
      status: message.o.X,
      raw: message.o
    };
    
    // Classificar tamanho
    liquidation.size = this.classifySize(liquidation.value);
    
    // Adicionar aos arrays históricos
    this.liquidations.last1h.push(liquidation);
    this.liquidations.last4h.push(liquidation);
    this.liquidations.last24h.push(liquidation);
    
    // Atualizar estatísticas
    this.updateStats();
    
    // Emitir evento
    this.emit('liquidation', liquidation);
    
    // Log
    const direction = liquidation.side === 'SELL' ? '📉 LONG' : '📈 SHORT';
    this.logger.info(
      `💥 Liquidation: ${direction} ${liquidation.quantity.toFixed(4)} @ $${liquidation.price.toFixed(2)} = $${liquidation.value.toFixed(2)} [${liquidation.size}]`
    );
    
    // Detectar cascata
    if (this.detectCascade()) {
      this.logger.warn('🚨 CASCATA DE LIQUIDAÇÕES DETECTADA!');
      this.emit('cascade', this.stats);
    }
  }
  
  /**
   * Classificar tamanho da liquidação
   */
  classifySize(value) {
    if (value >= this.config.massiveSize) return 'MASSIVE';
    if (value >= this.config.largeSize) return 'LARGE';
    if (value >= 10000) return 'MEDIUM';
    return 'SMALL';
  }
  
  /**
   * Limpar dados antigos
   */
  cleanOldData() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const fourHours = 4 * oneHour;
    const twentyFourHours = 24 * oneHour;
    
    this.liquidations.last1h = this.liquidations.last1h.filter(
      l => now - l.timestamp < oneHour
    );
    this.liquidations.last4h = this.liquidations.last4h.filter(
      l => now - l.timestamp < fourHours
    );
    this.liquidations.last24h = this.liquidations.last24h.filter(
      l => now - l.timestamp < twentyFourHours
    );
  }
  
  /**
   * Iniciar intervalo de limpeza
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanOldData();
    }, this.config.cleanupInterval);
  }
  
  /**
   * Atualizar estatísticas
   */
  updateStats() {
    // Total value liquidated
    this.stats.totalValue1h = this.liquidations.last1h.reduce((sum, l) => sum + l.value, 0);
    this.stats.totalValue4h = this.liquidations.last4h.reduce((sum, l) => sum + l.value, 0);
    this.stats.totalValue24h = this.liquidations.last24h.reduce((sum, l) => sum + l.value, 0);
    
    // Long vs Short liquidations (1h)
    this.stats.longLiquidated1h = this.liquidations.last1h
      .filter(l => l.side === 'SELL')
      .reduce((sum, l) => sum + l.value, 0);
      
    this.stats.shortLiquidated1h = this.liquidations.last1h
      .filter(l => l.side === 'BUY')
      .reduce((sum, l) => sum + l.value, 0);
    
    // Largest liquidation (24h)
    const largest = this.liquidations.last24h.reduce((max, l) => 
      l.value > (max?.value || 0) ? l : max, null
    );
    this.stats.largestLiquidation = largest;
    
    // Timestamp
    this.stats.lastUpdate = Date.now();
  }
  
  /**
   * Detectar cascata de liquidações
   */
  detectCascade() {
    const now = Date.now();
    const lastMinute = this.liquidations.last1h.filter(
      l => now - l.timestamp < 60 * 1000
    );
    
    this.stats.cascadeDetected = lastMinute.length >= this.config.cascadeThreshold;
    
    return this.stats.cascadeDetected;
  }
  
  /**
   * Obter estatísticas completas
   */
  getStats() {
    const total1h = this.stats.longLiquidated1h + this.stats.shortLiquidated1h;
    
    return {
      totalValue: {
        last1h: this.stats.totalValue1h,
        last4h: this.stats.totalValue4h,
        last24h: this.stats.totalValue24h
      },
      imbalance1h: {
        longLiquidated: this.stats.longLiquidated1h,
        shortLiquidated: this.stats.shortLiquidated1h,
        ratio: total1h > 0 ? this.stats.longLiquidated1h / total1h : 0.5,
        direction: this.getImbalanceDirection()
      },
      cascade: this.stats.cascadeDetected,
      largestLiquidation: this.stats.largestLiquidation,
      count: {
        last1h: this.liquidations.last1h.length,
        last4h: this.liquidations.last4h.length,
        last24h: this.liquidations.last24h.length
      },
      lastUpdate: this.stats.lastUpdate
    };
  }
  
  /**
   * Obter direção do desequilíbrio
   */
  getImbalanceDirection() {
    const ratio = this.stats.longLiquidated1h / (this.stats.longLiquidated1h + this.stats.shortLiquidated1h);
    
    if (ratio > 0.6) return 'BEARISH';  // Mais longs liquidados
    if (ratio < 0.4) return 'BULLISH';  // Mais shorts liquidados
    return 'NEUTRAL';
  }
  
  /**
   * Calcular Energy Score (para Half Pipe Model)
   */
  getEnergyScore() {
    const stats = this.getStats();
    
    // Componentes da energia:
    
    // 1. Valor total (normalizado para 0-1, max = $10M)
    const valueComponent = Math.min(stats.totalValue.last1h / 10000000, 1.0);
    
    // 2. Frequência (normalizado para 0-1, max = 50 liquidações)
    const frequencyComponent = Math.min(stats.count.last1h / 50, 1.0);
    
    // 3. Cascata (boost de 0.5 se detectada)
    const cascadeBoost = stats.cascade ? 0.5 : 0;
    
    // 4. Desequilíbrio (0 a 1, quanto mais desequilibrado, maior a energia direcional)
    const imbalanceComponent = Math.abs(stats.imbalance1h.ratio - 0.5) * 2;
    
    // Score final (0 a 2.0, mas normalizamos para 0-1)
    const rawScore = (
      valueComponent * 0.4 +
      frequencyComponent * 0.3 +
      cascadeBoost +
      imbalanceComponent * 0.3
    );
    
    const score = Math.min(rawScore, 1.0);
    
    // Classificar nível
    let level;
    if (score > 0.8) level = 'EXTREME';
    else if (score > 0.6) level = 'HIGH';
    else if (score > 0.4) level = 'MEDIUM';
    else if (score > 0.2) level = 'LOW';
    else level = 'VERY_LOW';
    
    return {
      score: score,
      level: level,
      direction: stats.imbalance1h.direction,
      components: {
        value: valueComponent,
        frequency: frequencyComponent,
        cascade: cascadeBoost,
        imbalance: imbalanceComponent
      },
      rawData: stats
    };
  }
  
  /**
   * Obter liquidações em um intervalo de tempo específico
   */
  getLiquidations(startTime = 0, endTime = Date.now()) {
    return this.liquidations.last24h.filter(
      l => l.timestamp >= startTime && l.timestamp < endTime
    );
  }
  
  /**
   * Obter valor total liquidado em um intervalo
   */
  getLiquidationValue(startTime = 0, endTime = Date.now()) {
    return this.getLiquidations(startTime, endTime)
      .reduce((sum, l) => sum + l.value, 0);
  }
  
  /**
   * Calcular liquidações "early" (primeiros X minutos)
   */
  getEarlyLiquidations(minutes = 2) {
    const now = Date.now();
    const cutoff = now - (minutes * 60 * 1000);
    
    const early = this.liquidations.last1h.filter(l => l.timestamp >= cutoff);
    const total = this.stats.totalValue1h;
    
    const earlyValue = early.reduce((sum, l) => sum + l.value, 0);
    
    return {
      value: earlyValue,
      count: early.length,
      percentage: total > 0 ? earlyValue / total : 0
    };
  }
  
  /**
   * Calcular taxa de crescimento das liquidações
   */
  getLiquidationGrowth() {
    const now = Date.now();
    
    // Dividir última hora em 3 buckets de 5 minutos
    const bucket1 = this.getLiquidationValue(now - 15 * 60 * 1000, now - 10 * 60 * 1000);
    const bucket2 = this.getLiquidationValue(now - 10 * 60 * 1000, now - 5 * 60 * 1000);
    const bucket3 = this.getLiquidationValue(now - 5 * 60 * 1000, now);
    
    if (bucket1 === 0) return 0;
    
    const growth = (bucket3 - bucket1) / bucket1;
    
    return {
      growth: growth,
      trend: growth > 0.5 ? 'INCREASING' : growth < -0.5 ? 'DECREASING' : 'STABLE',
      buckets: [bucket1, bucket2, bucket3]
    };
  }
  
  /**
   * Obter resumo para logging/debug
   */
  getSummary() {
    const stats = this.getStats();
    const energy = this.getEnergyScore();
    
    return {
      symbol: this.symbol,
      connected: this.ws && this.ws.readyState === WebSocket.OPEN,
      stats: stats,
      energy: energy,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Get metrics in format expected by EscapeTypeDetector
   * This is an adapter method that combines getStats() and getEnergyScore()
   */
  getMetrics() {
    const stats = this.getStats();
    const energy = this.getEnergyScore();
    
    // Calculate recent 5min metrics
    const now = Date.now();
    const fiveMinAgo = now - (5 * 60 * 1000);
    const recent5min = this.liquidations.last1h.filter(l => l.timestamp >= fiveMinAgo);
    
    const recent5minValue = recent5min.reduce((sum, l) => sum + l.value, 0);
    const recent5minLongs = recent5min.filter(l => l.side === 'BUY').reduce((sum, l) => sum + l.value, 0);
    const recent5minShorts = recent5min.filter(l => l.side === 'SELL').reduce((sum, l) => sum + l.value, 0);
    
    let dominantSide = 'NEUTRAL';
    if (recent5minLongs > recent5minShorts * 1.5) dominantSide = 'LONG';
    else if (recent5minShorts > recent5minLongs * 1.5) dominantSide = 'SHORT';
    
    return {
      // Energy score (0-1) for EscapeTypeDetector
      energy: {
        score: energy.score,
        level: energy.level,
        direction: energy.direction
      },
      
      // Recent 5min data
      recent5min: {
        totalVolume: recent5minValue,
        longVolume: recent5minLongs,
        shortVolume: recent5minShorts,
        dominantSide: dominantSide,
        count: recent5min.length
      },
      
      // Cascade detection
      cascade: {
        detected: stats.cascade,
        timestamp: stats.cascade ? stats.lastUpdate : null
      },
      
      // 1h statistics
      last1h: {
        totalValue: stats.totalValue.last1h,
        longLiquidated: stats.imbalance1h.longLiquidated,
        shortLiquidated: stats.imbalance1h.shortLiquidated,
        ratio: stats.imbalance1h.ratio,
        direction: stats.imbalance1h.direction,
        count: stats.count.last1h
      },
      
      // Largest liquidation
      largestLiquidation: stats.largestLiquidation,
      
      // Timestamp
      timestamp: stats.lastUpdate || new Date().toISOString()
    };
  }
}

module.exports = LiquidationTracker;
