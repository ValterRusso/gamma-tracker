/**
 * ============================================================================
 * IV COMPARISON SERVICE
 * ============================================================================
 * 
 * Business logic para comparação Binance vs Deribit
 * Detecta Retail Panic e divergências de pricing
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

class IVComparisonService {
  constructor(binanceAdapter, deribitAPI, ivComparator) {
    this.binanceAdapter = binanceAdapter;
    this.deribitAPI = deribitAPI;
    this.ivComparator = ivComparator;
  }

  // ========================================
  // BINANCE METHODS
  // ========================================

  /**
   * Get Binance IV surface
   */
  async getBinanceIVSurface() {
    const surface = await this.binanceAdapter.getIVSurface();
    
    if (!surface) {
      throw new Error('Failed to fetch Binance IV surface');
    }
    
    return surface;
  }

  /**
   * Get Binance IV metrics by DTE
   * @param {number} dte - Days to expiry
   */
  async getBinanceIVMetrics(dte) {
    const metrics = await this.binanceAdapter.getIVMetricsByDTE(dte);
    
    if (!metrics) {
      throw new Error(`No data available for ${dte} DTE`);
    }
    
    return metrics;
  }

  /**
   * Get Binance adapter stats
   */
  async getBinanceStats() {
    const stats = this.binanceAdapter.getStats();
    return stats;
  }

  // ========================================
  // DERIBIT METHODS
  // ========================================

  /**
   * Get Deribit IV surface
   */
  async getDeribitIVSurface() {
    const surface = await this.deribitAPI.getIVSurface();
    
    if (!surface) {
      throw new Error('Failed to fetch Deribit IV surface');
    }
    
    return surface;
  }

  /**
   * Get Deribit IV metrics by DTE
   * @param {number} dte - Days to expiry
   */
  async getDeribitIVMetrics(dte) {
    const metrics = await this.deribitAPI.getIVMetricsByDTE(dte);
    
    if (!metrics) {
      throw new Error(`No data available for ${dte} DTE`);
    }
    
    return metrics;
  }

  // ========================================
  // COMPARISON METHODS
  // ========================================

  /**
   * Compare Binance vs Deribit for single DTE
   * @param {number} dte - Days to expiry
   */
  async compare(dte) {
    const comparison = await this.ivComparator.compare(dte);
    return comparison;
  }

  /**
   * Compare multiple DTEs at once
   * @param {Array<number>} dtes - Array of DTEs
   */
  async compareMultiple(dtes) {
    const comparisons = await this.ivComparator.compareMultipleDTE(dtes);
    return comparisons;
  }

  /**
   * Get spread history
   * @param {number|null} dte - Optional DTE filter
   * @param {number} hours - Time range in hours
   */
  async getHistory(dte = null, hours = 24) {
    const history = this.ivComparator.getSpreadHistory(dte, hours);
    return history;
  }

  /**
   * Get comparator statistics
   */
  async getStats() {
    const stats = this.ivComparator.getStats();
    return stats;
  }

  /**
   * Get Retail Panic Index (simplified)
   * @param {number} dte - Days to expiry
   */
  async getRetailPanicIndex(dte = 1) {
    const comparison = await this.ivComparator.compare(dte);
    
    if (!comparison.success) {
      return comparison; // Return error as-is
    }
    
    // Extract only Retail Panic Index data
    return {
      success: true,
      data: {
        dte,
        retailPanicIndex: comparison.retailPanicIndex,
        putSpread: comparison.spreads?.putSpread,
        alerts: comparison.alerts?.filter(a => a.type === 'RETAIL_PANIC') || [],
        timestamp: comparison.timestamp
      }
    };
  }
}

module.exports = IVComparisonService;