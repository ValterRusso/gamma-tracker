/**
 * ============================================================================
 * ORDERBOOK SERVICE
 * ============================================================================
 * 
 * Business logic para análise do Order Book
 * Inclui interpretação automática e recomendações
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

class OrderBookService {
  constructor(dataCollector, orderBookAnalyzer) {
    this.dataCollector = dataCollector;
    this.analyzer = orderBookAnalyzer || dataCollector?.orderBookAnalyzer;
  }

  /**
   * Get all metrics
   */
  async getMetrics() {
    const metrics = this.dataCollector.getOrderBookMetrics();
    
    if (!metrics) {
      throw new Error('OrderBook metrics não disponíveis');
    }
    
    return metrics;
  }

  /**
   * Get Book Imbalance with interpretation
   */
  async getImbalance() {
    const imbalance = this.dataCollector.getOrderBookImbalance();
    
    if (!imbalance) {
      throw new Error('OrderBook imbalance não disponível');
    }
    
    // Add interpretation
    const interpretation = this._interpretImbalance(imbalance);
    
    return {
      ...imbalance,
      interpretation
    };
  }

  /**
   * Interpret Book Imbalance
   * @private
   */
  _interpretImbalance(imbalance) {
    const interpretation = {
      message: '',
      confidence: 'LOW',
      recommendation: ''
    };
    
    // Interpret BI magnitude
    const absBI = Math.abs(imbalance.BI);
    const direction = imbalance.direction === 'BULLISH' ? 'compra' : 'venda';
    
    if (absBI > 0.6) {
      interpretation.message = `Pressão de ${direction} FORTE`;
      interpretation.confidence = 'HIGH';
    } else if (absBI > 0.3) {
      interpretation.message = `Pressão de ${direction} MODERADA`;
      interpretation.confidence = 'MEDIUM';
    } else {
      interpretation.message = 'Mercado NEUTRO';
      interpretation.confidence = 'LOW';
    }
    
    // Add persistence info
    if (imbalance.persistence > 0.8) {
      interpretation.message += ' sustentada';
      interpretation.recommendation = 'Fluxo direcional MUITO sustentado (H1)';
    } else if (imbalance.persistence > 0.5) {
      interpretation.message += ' sustentada';
      interpretation.recommendation = 'Fluxo direcional sustentado';
    } else if (imbalance.persistence < 0.3) {
      interpretation.recommendation = 'Fluxo oscilando - possível H2';
    } else {
      interpretation.recommendation = 'Fluxo moderado';
    }
    
    return interpretation;
  }

  /**
   * Get depth analysis
   */
  async getDepth() {
    const depth = this.dataCollector.getOrderBookDepth();
    
    if (!depth) {
      throw new Error('OrderBook depth não disponível');
    }
    
    // Add interpretation
    const interpretation = this._interpretDepth(depth);
    
    return {
      ...depth,
      interpretation
    };
  }

  /**
   * Interpret depth
   * @private
   */
  _interpretDepth(depth) {
    const interpretation = {
      liquidityLevel: 'MEDIUM',
      message: '',
      risk: 'MEDIUM'
    };
    
    const changePercent = (depth.change * 100).toFixed(1);
    
    if (depth.change < -0.5) {
      interpretation.liquidityLevel = 'VERY_LOW';
      interpretation.message = `Liquidez MUITO baixa (${changePercent}% abaixo da média)`;
      interpretation.risk = 'VERY_HIGH';
    } else if (depth.change < -0.3) {
      interpretation.liquidityLevel = 'LOW';
      interpretation.message = `Liquidez secando (${changePercent}% abaixo da média) - possível H3`;
      interpretation.risk = 'HIGH';
    } else if (depth.change > 0.3) {
      interpretation.liquidityLevel = 'HIGH';
      interpretation.message = `Liquidez alta (${changePercent}% acima da média)`;
      interpretation.risk = 'LOW';
    } else if (depth.change > 0) {
      interpretation.liquidityLevel = 'MEDIUM';
      interpretation.message = `Liquidez ${changePercent}% acima da média`;
      interpretation.risk = 'MEDIUM';
    } else {
      interpretation.liquidityLevel = 'MEDIUM';
      interpretation.message = `Liquidez ${Math.abs(changePercent)}% abaixo da média`;
      interpretation.risk = 'MEDIUM';
    }
    
    // Add ratio info
    if (depth.ratio > 1.5) {
      interpretation.message += ' - Muito mais bids (suporte forte)';
    } else if (depth.ratio < 0.67) {
      interpretation.message += ' - Muito mais asks (resistência forte)';
    }
    
    return interpretation;
  }

  /**
   * Get spread analysis
   */
  async getSpread() {
    const spread = this.dataCollector.getOrderBookSpread();
    
    if (!spread) {
      throw new Error('OrderBook spread não disponível');
    }
    
    // Add interpretation
    const interpretation = this._interpretSpread(spread);
    
    return {
      ...spread,
      interpretation
    };
  }

  /**
   * Interpret spread
   * @private
   */
  _interpretSpread(spread) {
    const interpretation = {
      quality: 'MEDIUM',
      message: '',
      warning: null
    };
    
    const spreadBps = (spread.spread_pct * 10000).toFixed(2);
    
    if (spread.spread_pct < 0.0001) {
      interpretation.quality = 'EXCELLENT';
      interpretation.message = `Spread excelente (${spreadBps} bps)`;
    } else if (spread.spread_pct < 0.0002) {
      interpretation.quality = 'GOOD';
      interpretation.message = `Spread bom (${spreadBps} bps)`;
    } else if (spread.spread_pct < 0.0005) {
      interpretation.quality = 'FAIR';
      interpretation.message = `Spread aceitável (${spreadBps} bps)`;
    } else {
      interpretation.quality = 'POOR';
      interpretation.message = `Spread alto (${spreadBps} bps)`;
      interpretation.warning = 'Liquidez baixa ou volatilidade alta';
    }
    
    // Check spread pulse (volatility)
    if (spread.spread_pulse && spread.spread_pulse > spread.spread_pct * 0.5) {
      interpretation.warning = 'Spread oscilando rapidamente - volatilidade alta';
    }
    
    return interpretation;
  }

  /**
   * Get walls detection
   */
  async getWalls() {
    const walls = this.dataCollector.getOrderBookWalls();
    
    if (!walls) {
      throw new Error('OrderBook walls não disponíveis');
    }
    
    // Add interpretation and type/strength
    const interpretation = this._interpretWalls(walls);
    
    // Add type and strength to walls
    if (walls.bidWall) {
      walls.bidWall.type = 'SUPPORT';
      walls.bidWall.strength = walls.bidWall.ratio > 20 ? 'VERY_STRONG' : 'STRONG';
    }
    
    if (walls.askWall) {
      walls.askWall.type = 'RESISTANCE';
      walls.askWall.strength = walls.askWall.ratio > 20 ? 'VERY_STRONG' : 'STRONG';
    }
    
    return {
      ...walls,
      interpretation
    };
  }

  /**
   * Interpret walls
   * @private
   */
  _interpretWalls(walls) {
    const interpretation = {
      message: '',
      significance: 'LOW'
    };
    
    if (walls.bidWall && walls.askWall) {
      interpretation.message = `Walls em ambos os lados: suporte em ${walls.bidWall.price.toFixed(2)} e resistência em ${walls.askWall.price.toFixed(2)}`;
      interpretation.significance = 'VERY_HIGH';
    } else if (walls.bidWall) {
      const strength = walls.bidWall.ratio > 20 ? 'MUITO forte' : 'forte';
      interpretation.message = `Wall de suporte ${strength} em ${walls.bidWall.price.toFixed(2)} (${walls.bidWall.distance.toFixed(2)}% abaixo)`;
      interpretation.significance = walls.bidWall.ratio > 20 ? 'VERY_HIGH' : 'HIGH';
    } else if (walls.askWall) {
      const strength = walls.askWall.ratio > 20 ? 'MUITO forte' : 'forte';
      interpretation.message = `Wall de resistência ${strength} em ${walls.askWall.price.toFixed(2)} (${walls.askWall.distance.toFixed(2)}% acima)`;
      interpretation.significance = walls.askWall.ratio > 20 ? 'VERY_HIGH' : 'HIGH';
    } else {
      interpretation.message = 'Nenhuma wall significativa detectada';
      interpretation.significance = 'LOW';
    }
    
    return interpretation;
  }

  /**
   * Get energy score
   */
  async getEnergy() {
    const energy = this.dataCollector.getOrderBookEnergy();
    
    if (!energy) {
      throw new Error('OrderBook energy não disponível');
    }
    
    // Add interpretation
    const interpretation = this._interpretEnergy(energy);
    
    return {
      ...energy,
      interpretation
    };
  }

  /**
   * Interpret energy
   * @private
   */
  _interpretEnergy(energy) {
    const interpretation = {
      message: '',
      recommendation: ''
    };
    
    if (energy.level === 'HIGH') {
      interpretation.message = 'Energia sustentada ALTA';
      interpretation.recommendation = 'Fluxo forte e persistente - favorece H1';
    } else if (energy.level === 'MEDIUM') {
      interpretation.message = 'Energia sustentada MÉDIA';
      interpretation.recommendation = 'Fluxo presente mas não dominante';
    } else {
      interpretation.message = 'Energia sustentada BAIXA';
      interpretation.recommendation = 'Fluxo fraco - possível H2 ou mercado preso';
    }
    
    return interpretation;
  }

  /**
   * Get history with stats
   * @param {number} window - Time window in seconds
   */
  async getHistory(window = 60) {
    const history = this.dataCollector.getOrderBookHistory();
    
    if (!history) {
      throw new Error('OrderBook history não disponível');
    }
    
    // Filter by time window
    const cutoff = Date.now() - (window * 1000);
    
    const filtered = {
      BI_history: history.BI_history.filter(h => h.time > cutoff),
      depth_history: history.depth_history.filter(h => h.time > cutoff),
      spread_history: history.spread_history.filter(h => h.time > cutoff)
    };
    
    // Calculate stats
    const stats = {
      dataPoints: filtered.BI_history.length,
      window: window,
      avgBI: this._calculateAverage(filtered.BI_history, 'BI'),
      avgDepth: this._calculateAverage(filtered.depth_history, 'totalDepth'),
      avgSpread: this._calculateAverage(filtered.spread_history, 'spread')
    };
    
    return {
      ...filtered,
      stats
    };
  }

  /**
   * Calculate average of field
   * @private
   */
  _calculateAverage(array, field) {
    if (array.length === 0) return 0;
    
    const sum = array.reduce((acc, item) => acc + item[field], 0);
    return sum / array.length;
  }
}

module.exports = OrderBookService;