/**
 * ============================================================================
 * METRICS SERVICE (FINAL VERSION)
 * ============================================================================
 * 
 * Business logic para métricas GEX completas
 * Inclui cache, regime analysis, e wall zones avançadas
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 2.0 (Final)
 * ============================================================================
 */

class MetricsService {
  constructor(dataCollector, gexCalculator, regimeAnalyzer) {
    this.dataCollector = dataCollector;
    this.gexCalculator = gexCalculator;
    this.regimeAnalyzer = regimeAnalyzer;
    this.metricsCache = null;
    this.cacheTimestamp = 0;
    this.cacheTTL = 5000; // 5 seconds
  }

  /**
   * Get cached metrics or fetch new (with regime analysis)
   * @private
   */
  async _getMetrics() {
    const now = Date.now();
    
    // Return cache if valid
    if (this.metricsCache && (now - this.cacheTimestamp) < this.cacheTTL) {
      return this.metricsCache;
    }
    
    // Fetch fresh metrics
    const options = this.dataCollector.getAllOptions();
    
    if (!options || options.length === 0) {
      throw new Error('No options data available');
    }
    
    // Get or estimate spot price
    const spotPrice = this.dataCollector.spotPrice || this._estimateSpotPrice(options);
    
    // Set spot price in calculator
    this.gexCalculator.setSpotPrice(spotPrice);
    
    // Calculate metrics
    const metrics = this.gexCalculator.calculateAllMetrics(options);
    
    // Add regime analysis
    if (this.regimeAnalyzer && typeof this.regimeAnalyzer.analyzeRegime === 'function') {
      try {
        const regimeAnalysis = this.regimeAnalyzer.analyzeRegime(metrics);
        
        // Truncate regime to max 20 characters (database constraint)
        const regime = regimeAnalysis.regime || '';
        metrics.regime = regime.substring(0, 20);
        metrics.regimeAnalysis = regimeAnalysis;
      } catch (error) {
        console.error('Error analyzing regime:', error);
        metrics.regime = null;
        metrics.regimeAnalysis = null;
      }
    } else {
      metrics.regime = null;
      metrics.regimeAnalysis = null;
    }
    
    // Update cache
    this.metricsCache = metrics;
    this.cacheTimestamp = now;
    
    return metrics;
  }

  /**
   * Estimate spot price from ATM options
   * @private
   */
  _estimateSpotPrice(options) {
    // Find ATM calls (delta ~0.5)
    const atmCalls = options
      .filter(opt => opt.side === 'CALL' && opt.delta > 0.4 && opt.delta < 0.6)
      .sort((a, b) => Math.abs(a.delta - 0.5) - Math.abs(b.delta - 0.5));
    
    if (atmCalls.length > 0) {
      return atmCalls[0].strike;
    }
    
    // Fallback: average of all strikes
    const strikes = options.map(opt => opt.strike);
    return strikes.reduce((sum, s) => sum + s, 0) / strikes.length;
  }

  /**
   * Calculate wall zones from gamma profile (advanced version)
   * @private
   */
  _calculateWallZones(gammaProfile, threshold = 0.7) {
    if (!gammaProfile || gammaProfile.length === 0) {
      return { putWallZone: null, callWallZone: null };
    }
    
    // Find put and call peaks
    const putPeak = gammaProfile.reduce((max, item) =>
      item.putGEX < max.putGEX ? item : max
    );
    
    const callPeak = gammaProfile.reduce((max, item) =>
      item.callGEX > max.callGEX ? item : max
    );
    
    // Calculate Put Wall Zone
    let putWallZone = null;
    if (putPeak && putPeak.putGEX < 0) {
      const putThreshold = Math.abs(putPeak.putGEX) * threshold;
      const putZoneStrikes = gammaProfile
        .filter(p => p.putGEX < 0 && Math.abs(p.putGEX) >= putThreshold)
        .map(p => ({
          strike: p.strike,
          gex: p.putGEX,
          percentage: (Math.abs(p.putGEX) / Math.abs(putPeak.putGEX)) * 100
        }))
        .sort((a, b) => a.strike - b.strike);
      
      if (putZoneStrikes.length > 0) {
        const zoneLow = putZoneStrikes[0].strike;
        const zoneHigh = putZoneStrikes[putZoneStrikes.length - 1].strike;
        
        putWallZone = {
          peak: putPeak.strike,
          peakGEX: putPeak.putGEX,
          zoneLow: zoneLow,
          zoneHigh: zoneHigh,
          zoneWidth: zoneHigh - zoneLow,
          zoneStrikes: putZoneStrikes,
          strikeCount: putZoneStrikes.length,
          threshold: threshold,
          totalZoneGEX: putZoneStrikes.reduce((sum, s) => sum + s.gex, 0)
        };
      }
    }
    
    // Calculate Call Wall Zone
    let callWallZone = null;
    if (callPeak && callPeak.callGEX > 0) {
      const callThreshold = callPeak.callGEX * threshold;
      const callZoneStrikes = gammaProfile
        .filter(p => p.callGEX > 0 && p.callGEX >= callThreshold)
        .map(p => ({
          strike: p.strike,
          gex: p.callGEX,
          percentage: (p.callGEX / callPeak.callGEX) * 100
        }))
        .sort((a, b) => a.strike - b.strike);
      
      if (callZoneStrikes.length > 0) {
        const zoneLow = callZoneStrikes[0].strike;
        const zoneHigh = callZoneStrikes[callZoneStrikes.length - 1].strike;
        
        callWallZone = {
          peak: callPeak.strike,
          peakGEX: callPeak.callGEX,
          zoneLow: zoneLow,
          zoneHigh: zoneHigh,
          zoneWidth: zoneHigh - zoneLow,
          zoneStrikes: callZoneStrikes,
          strikeCount: callZoneStrikes.length,
          threshold: threshold,
          totalZoneGEX: callZoneStrikes.reduce((sum, s) => sum + s.gex, 0)
        };
      }
    }
    
    return { putWallZone, callWallZone };
  }

  /**
   * Get complete metrics
   */
  async getMetrics() {
    return await this._getMetrics();
  }

  /**
   * Get gamma profile with smart filtering
   * @param {Object} options - { rangePercent, gexThreshold, autoRange }
   */
  async getGammaProfile(options = {}) {
    const {
      rangePercent = 0.3,
      gexThreshold = 0.02,
      autoRange = true
    } = options;
    
    const metrics = await this._getMetrics();
    
    if (!metrics.gammaProfile || metrics.gammaProfile.length === 0) {
      throw new Error('No gamma profile data available');
    }
    
    let profile = metrics.gammaProfile;
    let rangeInfo = null;
    
    // Apply smart filtering if auto=true
    if (autoRange) {
      // Calculate wall zones for smart range
      const wallZones = this._calculateWallZones(metrics.gammaProfile);
      
      const smartRange = this.gexCalculator.calculateSmartRange(
        metrics.gammaProfile,
        metrics.spotPrice,
        wallZones,
        rangePercent,
        gexThreshold
      );
      
      profile = smartRange.filteredProfile;
      rangeInfo = {
        minStrike: smartRange.minStrike,
        maxStrike: smartRange.maxStrike,
        totalStrikes: smartRange.totalStrikes,
        filteredStrikes: smartRange.filteredStrikes,
        compressionRatio: smartRange.compressionRatio,
        rangePercent: rangePercent,
        gexThreshold: gexThreshold
      };
    }
    
    return {
      profile,
      rangeInfo,
      spotPrice: metrics.spotPrice
    };
  }

  /**
   * Get total GEX
   */
  async getTotalGEX() {
    const metrics = await this._getMetrics();
    return metrics.totalGEX;
  }

  /**
   * Get gamma flip
   */
  async getGammaFlip() {
    const metrics = await this._getMetrics();
    return metrics.gammaFlip;
  }

  /**
   * Get put/call walls
   */
  async getWalls() {
    const metrics = await this._getMetrics();
    
    return {
      putWall: metrics.putWall,
      callWall: metrics.callWall
    };
  }

  /**
   * Get wall zones with distances (advanced version)
   * @param {number} threshold - Zone threshold (default: 0.7)
   */
  async getWallZones(threshold = 0.7) {
    const metrics = await this._getMetrics();
    
    if (!metrics.gammaProfile || metrics.gammaProfile.length === 0) {
      throw new Error('No gamma profile data available');
    }
    
    const wallZones = this._calculateWallZones(metrics.gammaProfile, threshold);
    const spotPrice = metrics.spotPrice;
    
    // Add distances from spot
    if (wallZones.putWallZone) {
      wallZones.putWallZone.distanceFromSpot = {
        peak: spotPrice - wallZones.putWallZone.peak,
        zoneLow: spotPrice - wallZones.putWallZone.zoneLow,
        zoneHigh: spotPrice - wallZones.putWallZone.zoneHigh
      };
      wallZones.putWallZone.distancePercent = {
        peak: ((spotPrice - wallZones.putWallZone.peak) / spotPrice) * 100,
        zoneLow: ((spotPrice - wallZones.putWallZone.zoneLow) / spotPrice) * 100,
        zoneHigh: ((spotPrice - wallZones.putWallZone.zoneHigh) / spotPrice) * 100
      };
    }
    
    if (wallZones.callWallZone) {
      wallZones.callWallZone.distanceFromSpot = {
        peak: wallZones.callWallZone.peak - spotPrice,
        zoneLow: wallZones.callWallZone.zoneLow - spotPrice,
        zoneHigh: wallZones.callWallZone.zoneHigh - spotPrice
      };
      wallZones.callWallZone.distancePercent = {
        peak: ((wallZones.callWallZone.peak - spotPrice) / spotPrice) * 100,
        zoneLow: ((wallZones.callWallZone.zoneLow - spotPrice) / spotPrice) * 100,
        zoneHigh: ((wallZones.callWallZone.zoneHigh - spotPrice) / spotPrice) * 100
      };
    }
    
    return {
      spotPrice,
      threshold,
      ...wallZones
    };
  }
}

module.exports = MetricsService;