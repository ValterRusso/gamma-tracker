/**
 * ============================================================================
 * VOLATILITY SERVICE
 * ============================================================================
 * 
 * Business logic para análise de volatilidade
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

class VolatilityService {
  constructor(dataCollector, volSurfaceCalculator, anomalyDetector, regimeAnalyzer, gexCalculator) {
    this.dataCollector = dataCollector;
    this.volSurfaceCalculator = volSurfaceCalculator;
    this.anomalyDetector = anomalyDetector;
    this.regimeAnalyzer = regimeAnalyzer;
    this.gexCalculator = gexCalculator;

  }

  /**
   * Get volatility surface
   */
  async getVolSurface() {
    // Get all options
    const allOptions = this.dataCollector.getAllOptions();

    if (!allOptions || allOptions.length === 0) {
      throw new Error('Nenhuma opção disponível');
    }

    // Get spot price (propriedade, não método!)
    const spotPrice = this.dataCollector.spotPrice;

    // Build surface
    const surface = this.volSurfaceCalculator.buildSurface(allOptions, spotPrice);

    if (!surface) {
      throw new Error('Não foi possível construir superfície de volatilidade');
    }

    return surface;
  }

  /**
   * Get volatility anomalies
   * @param {Object} options - { threshold, limit, severityFilter, typeFilter }
   */
  async getAnomalies(options = {}) {
    const {
      threshold = 2.0,
      limit = 50,
      severityFilter = null,
      typeFilter = null
    } = options;

    // Get all options
    const allOptions = this.dataCollector.getAllOptions();

    // Handle empty options
    if (!allOptions || allOptions.length === 0) {
      return {
        anomalies: [],
        stats: {
          total: 0,
          byType: { ivOutlier: 0, skewAnomaly: 0 },
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
          byPriceType: { overpriced: 0, underpriced: 0 },
          avgRelevance: 0
        },
        threshold,
        spotPrice: 0,
        filters: {
          severity: severityFilter || 'ALL',
          type: typeFilter || 'ALL',
          limit
        }
      };
    }

    // Get spot price (propriedade, não método!)
    const spotPrice = this.dataCollector.spotPrice;

    // Build volatility surface
    const surfaceData = this.volSurfaceCalculator.buildSurface(allOptions, spotPrice);

    if (!surfaceData) {
      throw new Error('Não foi possível construir superfície de volatilidade');
    }

    // Detect anomalies
    let anomalies = this.anomalyDetector.detectAnomalies(surfaceData, threshold);

    // Apply filters
    if (severityFilter) {
      anomalies = anomalies.filter(a => a.severity === severityFilter);
    }

    if (typeFilter) {
      anomalies = anomalies.filter(a => a.type === typeFilter);
    }

    // Generate statistics
    const stats = this.anomalyDetector.generateStats(anomalies);

    // Limit results
    const limitedAnomalies = anomalies.slice(0, limit);

    return {
      anomalies: limitedAnomalies,
      stats,
      threshold,
      spotPrice: surfaceData.spotPrice,
      filters: {
        severity: severityFilter || 'ALL',
        type: typeFilter || 'ALL',
        limit
      }
    };
  }

  /**
   * Get market insights
   */
  async getInsights() {
    // Get all options
    const allOptions = await this.dataCollector.getAllOptions();

    if (!allOptions || allOptions.length === 0) {
      return {
        regime: {
          regime: 'UNKNOWN',
          description: 'Nenhuma opção disponível para análise',
          volatilityExpectation: 'UNKNOWN',
          implications: []
        },
        distribution: {
          significantLevels: []
        }
      };
    }

    // Calculate GEX data
    const gexData = this.gexCalculator.calculateTotalGEX(allOptions);

    if (!gexData || !gexData.total) {
      return {
        regime: {
          regime: 'UNKNOWN',
          description: 'Erro ao calcular GEX',
          volatilityExpectation: 'UNKNOWN',
          implications: []
        },
        distribution: {
          significantLevels: []
        }
      };
    }

    // Calculate Gamma Flip
    const gammaFlip = this.gexCalculator.findGammaFlip(allOptions);

    // Calculate Put Wall and Call Wall
    const putWall = this.gexCalculator.findPutWall(allOptions);
    const callWall = this.gexCalculator.findCallWall(allOptions);

    // Calculate Gamma Profile
    const gammaProfile = this.gexCalculator.calculateGammaProfile(allOptions);

    // Get spot price
    const spotPrice = this.dataCollector.spotPrice;

    // Build metrics object with correct structure for RegimeAnalyzer
    const metrics = {
      spotPrice: spotPrice,
      totalGEX: {
        total: gexData.total,
        calls: gexData.calls,
        puts: gexData.puts,
        netGamma: gexData.netGamma
      },
      gammaFlip: {
        level: gammaFlip.level,
        currentSpot: gammaFlip.currentSpot,
        distanceFromSpot: gammaFlip.distanceFromSpot,
        distancePercent: gammaFlip.distancePercent,
        confidence: gammaFlip.confidence,
        nearbyStrikes: gammaFlip.nearbyStrikes
      },
      putWall: putWall,
      callWall: callWall,
      gammaProfile: gammaProfile
    };

    // Generate insights with correct structure
    try {
      const insights = this.regimeAnalyzer.generateInsights(metrics);
      return insights;
      
    } catch (error) {
      console.error('❌ Error generating insights:', error);      
      return {
        regime: {
        regime: 'UNKNOWN',        
        description: 'Análise de regime indisponível - aguardando dados completos' + error.message,
        volatilityExpectation: 'UNKNOWN',
        implications: []        
      },      
        distribution: {
          significantLevels: []
        }
      };
    }
  }

  /**
   * Get metrics helper
   * @private
   */
  async _getMetrics() {
    // Try to get from dataCollector stats method
    if (typeof this.dataCollector.getStats === 'function') {
      return this.dataCollector.getStats();
    }

    // Or build basic metrics
    const options = this.dataCollector.getAllOptions();
    const spotPrice = this.dataCollector.spotPrice; // ✅ Propriedade

    if (!options || !spotPrice) {
      return null;
    }

    return {
      spotPrice,
      totalOptions: options.length,
      options
    };
  }
}

module.exports = VolatilityService;