/**
 * ============================================================================
 * ESCAPE SERVICE
 * ============================================================================
 * 
 * Business logic para detecção de tipo de escape (Half Pipe Model)
 * Integra EscapeTypeDetector com interpretações e análises
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

class EscapeService {
  constructor(dataCollector, escapeTypeDetector) {
    this.dataCollector = dataCollector;
    this.detector = escapeTypeDetector || dataCollector?.escapeTypeDetector;
  }

  /**
   * Check if detector is available
   * @private
   */
  _checkDetector() {
    // Always try to get from dataCollector (may be initialized after service creation)
    if (!this.detector && this.dataCollector?.escapeTypeDetector) {
      this.detector = this.dataCollector.escapeTypeDetector;
    }
    
    if (!this.detector) {
      // Return friendly error with instructions
      const error = new Error('EscapeTypeDetector not initialized. Waiting for data collection to start...');
      error.code = 'DETECTOR_NOT_READY';
      error.statusCode = 503;
      throw error;
    }
  }

  /**
   * Get current detection
   */
  async getDetection() {
    this._checkDetector();
    
    const detection = this.detector.getCurrentDetection();
    
    // Return default if no detection yet
    if (!detection) {
      return {
        type: 'NONE',
        confidence: 0,
        direction: 'NEUTRAL',
        interpretation: 'No detection available yet. Waiting for data...'
      };
    }
    
    return detection;
  }

  /**
   * Get escape probability
   */
  async getProbability() {
    this._checkDetector();
    
    const detection = this.detector.getCurrentDetection();
    
    // Return default if no data
    if (!detection || !detection.metrics) {
      return {
        P_escape: 0,
        classification: 'UNKNOWN',
        components: {},
        interpretation: 'No data available yet'
      };
    }
    
    const P_escape = detection.metrics.P_escape;
    
    // Classify probability
    let classification = 'MEDIUM';
    if (P_escape > 0.7) {
      classification = 'HIGH';
    } else if (P_escape < 0.4) {
      classification = 'LOW';
    }
    
    // Generate interpretation
    const totalEnergy = detection.metrics.totalEnergy.toFixed(2);
    const potential = detection.metrics.potential.total.toFixed(2);
    
    let interpretation = '';
    if (P_escape > 0.7) {
      interpretation = `High probability of escaping gamma wall. Strong energy (${totalEnergy}) relative to potential (${potential}).`;
    } else if (P_escape < 0.4) {
      interpretation = `Low probability of escape. Weak energy (${totalEnergy}) relative to potential (${potential}). Expect rejection.`;
    } else {
      interpretation = `Medium probability. Energy (${totalEnergy}) and potential (${potential}) are balanced. Watch closely.`;
    }
    
    return {
      P_escape,
      classification,
      components: {
        sustainedEnergy: detection.metrics.sustainedEnergy,
        injectedEnergy: detection.metrics.injectedEnergy,
        totalEnergy: detection.metrics.totalEnergy,
        potential: detection.metrics.potential
      },
      interpretation
    };
  }

  /**
   * Get energy breakdown
   */
  async getEnergy() {
    this._checkDetector();
    
    const detection = this.detector.getCurrentDetection();
    
    // Return default if no data
    if (!detection || !detection.metrics) {
      return {
        sustained: { score: 0, components: {} },
        injected: { score: 0 },
        total: 0,
        classification: 'UNKNOWN'
      };
    }
    
    // Get orderbook and liquidation metrics
    const orderBook = this.dataCollector.getOrderBookMetrics 
      ? this.dataCollector.getOrderBookMetrics() 
      : null;
      
    const liquidations = this.dataCollector.getLiquidationMetrics
      ? this.dataCollector.getLiquidationMetrics()
      : null;
    
    // Build sustained energy components
    const sustainedComponents = orderBook ? {
      bookImbalance: Math.abs(orderBook.BI || 0),
      biPersistence: orderBook.BI_persistence || 0,
      spreadQuality: Math.max(0, Math.min(1, 1 - (Math.abs(orderBook.spread_pct || 0) * 10000))),
      depthComponent: Math.max(0, Math.min(1, ((orderBook.depthChange || 0) + 0.5) / 1.0))
    } : {};
    
    // Classify total energy
    const total = detection.metrics.totalEnergy;
    let classification = 'MEDIUM';
    
    if (total > 0.8) {
      classification = 'HIGH';
    } else if (total > 0.6) {
      classification = 'MEDIUM-HIGH';
    } else if (total > 0.4) {
      classification = 'MEDIUM';
    } else if (total > 0.2) {
      classification = 'MEDIUM-LOW';
    } else {
      classification = 'LOW';
    }
    
    return {
      sustained: {
        score: detection.metrics.sustainedEnergy,
        components: sustainedComponents
      },
      injected: {
        score: detection.metrics.injectedEnergy,
        volume5min: liquidations?.recent5min?.totalVolume || 0,
        cascadeDetected: liquidations?.cascade?.detected || false,
        dominantSide: liquidations?.recent5min?.dominantSide || 'NEUTRAL'
      },
      total,
      classification
    };
  }

  /**
   * Get conditions for each hypothesis
   */
  async getConditions() {
    this._checkDetector();
    
    const detection = this.detector.getCurrentDetection();
    
    // Return empty if no data
    if (!detection || !detection.conditions) {
      return {
        conditions: {},
        currentType: 'NONE',
        currentConfidence: 0
      };
    }
    
    return {
      conditions: detection.conditions,
      currentType: detection.type,
      currentConfidence: detection.confidence
    };
  }

  /**
   * Get detection history
   * @param {number} minutes - Time window in minutes
   */
  async getHistory(minutes = 60) {
    this._checkDetector();
    
    const history = this.detector.getHistory(minutes);
    const stats = this.detector.getStats();
    
    return {
      history,
      stats
    };
  }

  /**
   * Get complete summary
   */
  async getSummary() {
    this._checkDetector();
    
    const detection = this.detector.getCurrentDetection();
    const history = this.detector.getHistory(10); // Last 10 minutes
    const stats = this.detector.getStats();
    const alerts = this.detector.getAlerts();
    
    return {
      currentDetection: detection,
      recentHistory: history,
      stats,
      alerts
    };
  }

  /**
   * Get active alerts
   */
  async getAlerts() {
    this._checkDetector();
    
    const alerts = this.detector.getAlerts();
    
    // Generate summary
    const summary = {
      totalAlerts: alerts.length,
      criticalCount: alerts.filter(a => a.severity === 'CRITICAL').length,
      highCount: alerts.filter(a => a.severity === 'HIGH').length,
      mediumCount: alerts.filter(a => a.severity === 'MEDIUM').length,
      lowCount: alerts.filter(a => a.severity === 'LOW').length
    };
    
    return {
      alerts,
      summary
    };
  }
}

module.exports = EscapeService;