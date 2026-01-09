/**
 * ============================================================================
 * LIQUIDATION SERVICE
 * ============================================================================
 * 
 * Business logic para rastreamento de liquidações
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

class LiquidationService {
  constructor(dataCollector, liquidationTracker) {
    this.dataCollector = dataCollector;
    this.tracker = liquidationTracker || dataCollector?.liquidationTracker;
  }

  /**
   * Verificar disponibilidade do tracker
   * @private
   */
  _checkAvailability() {
    // Always try to get from dataCollector (may be initialized after service creation)
    if (!this.tracker && this.dataCollector?.liquidationTracker) {
      this.tracker = this.dataCollector.liquidationTracker;
    }
    
    if (!this.tracker) {
      const error = new Error('LiquidationTracker not initialized. Waiting for data collection to start...');
      error.code = 'TRACKER_NOT_READY';
      error.statusCode = 503;
      throw error;
    }
  }

  /**
   * Get liquidation stats
   */
  async getStats() {
    this._checkAvailability();
    
    const stats = this.dataCollector.getLiquidationStats();
    
    if (!stats) {
      throw new Error('Estatísticas de liquidação não disponíveis');
    }
    
    return stats;
  }

  /**
   * Get liquidation energy score
   */
  async getEnergy() {
    this._checkAvailability();
    
    const energy = this.dataCollector.getLiquidationEnergy();
    
    if (!energy) {
      throw new Error('Energy score não disponível');
    }
    
    return energy;
  }

  /**
   * Get complete summary (stats + energy)
   */
  async getSummary() {
    this._checkAvailability();
    
    const stats = this.dataCollector.getLiquidationStats();
    const energy = this.dataCollector.getLiquidationEnergy();
    
    if (!stats || !energy) {
      throw new Error('Dados de liquidação não disponíveis');
    }
    
    return {
      stats,
      energy,
      connected: this.tracker.connected || false,
      lastUpdate: Date.now()
    };
  }

  /**
   * Get recent liquidations
   * @param {number} minutes - Number of minutes to look back
   */
  async getRecent(minutes = 5) {
    this._checkAvailability();
    
    const now = Date.now();
    const startTime = now - (minutes * 60 * 1000);
    
    const liquidations = this.tracker.getLiquidations(startTime, now);
    
    // Calculate summary
    const totalValue = liquidations.reduce((sum, liq) => sum + liq.value, 0);
    const longLiquidated = liquidations
      .filter(liq => liq.side === 'SELL')
      .reduce((sum, liq) => sum + liq.value, 0);
    const shortLiquidated = liquidations
      .filter(liq => liq.side === 'BUY')
      .reduce((sum, liq) => sum + liq.value, 0);
    
    return {
      liquidations,
      count: liquidations.length,
      totalValue,
      longLiquidated,
      shortLiquidated,
      minutes,
      startTime,
      endTime: now
    };
  }

  /**
   * Get early liquidations (H2 - Falso Escape indicator)
   * @param {number} minutes - Window for "early" detection
   */
  async getEarly(minutes = 2) {
    this._checkAvailability();
    
    const early = this.tracker.getEarlyLiquidations(minutes);
    
    // Classify risk
    let risk = 'LOW';
    let warning = null;
    
    if (early.percentage > 0.7) {
      risk = 'HIGH';
      warning = 'Mais de 70% das liquidações nos primeiros minutos - Possível falso escape (stop hunt)';
    } else if (early.percentage > 0.5) {
      risk = 'MEDIUM';
      warning = 'Liquidações concentradas no início - Monitorar para falso escape';
    }
    
    return {
      early,
      risk,
      warning
    };
  }

  /**
   * Get liquidation growth rate (H1 - Escape Bom indicator)
   */
  async getGrowth() {
    this._checkAvailability();
    
    const growth = this.tracker.getLiquidationGrowth();
    
    // Classify quality
    let quality = 'UNKNOWN';
    let description = '';
    
    if (growth.trend === 'INCREASING' && growth.growth > 0.5) {
      quality = 'GOOD';
      description = 'Liquidações crescendo gradualmente - Possível escape direcional por fluxo real (H1)';
    } else if (growth.trend === 'STABLE') {
      quality = 'NEUTRAL';
      description = 'Liquidações estáveis - Sem sinal claro de escape';
    } else if (growth.trend === 'DECREASING') {
      quality = 'POOR';
      description = 'Liquidações diminuindo - Energia enfraquecendo';
    }
    
    return {
      growth,
      quality,
      description
    };
  }

  /**
   * Get cascade detection
   */
  async getCascade() {
    this._checkAvailability();
    
    const stats = this.dataCollector.getLiquidationStats();
    
    if (!stats) {
      throw new Error('Estatísticas de liquidação não disponíveis');
    }
    
    // Get liquidations from last minute
    const now = Date.now();
    const lastMinute = this.tracker.getLiquidations(now - 60 * 1000, now);
    
    return {
      cascadeDetected: stats.cascade,
      liquidationsLastMinute: lastMinute.length,
      threshold: this.tracker.config?.cascadeThreshold || 10,
      recentLiquidations: lastMinute.slice(0, 10)  // Last 10
    };
  }
}

module.exports = LiquidationService;