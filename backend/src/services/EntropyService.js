/**
 * ============================================================================
 * ENTROPY SERVICE
 * ============================================================================
 * 
 * Business logic para Shannon Entropy + RSI
 * Extrai lógica dos endpoints para facilitar testes e reuso
 * 
 * @author Valter Russo
 * @version 1.0
 * ============================================================================
 */

class EntropyService {
  constructor(entropyCalc, rsiCalc, orderbook) {
    this.entropyCalc = entropyCalc;
    this.rsiCalc = rsiCalc;
    this.orderbook = orderbook;
  }

  /**
   * Get entropy com RSI
   */
  async getEntropy(customDepth = null) {
    // Parse depth to number (query params come as strings)
    const depth = customDepth ? parseInt(customDepth, 10) : null;
    
    // Validate depth
    if (depth && (depth < 5 || depth > 200 || isNaN(depth))) {
      throw new Error('Depth must be between 5 and 200');
    }

    // Get orderbook
    const bids = this.orderbook.getBids();
    const asks = this.orderbook.getAsks();

    if (!bids || !asks) {
      throw new Error('Orderbook not available');
    }

    // Calculate entropy with custom depth (now as number)
    const entropyResult = this.entropyCalc.calculate(bids, asks, depth);

    // Get RSI metrics
    const rsiMetrics = this.rsiCalc.getMetrics();

    // If custom depth was provided, return the direct result
    // Otherwise use getMetrics() for full historical data
    const entropyMetrics = depth ? entropyResult : this.entropyCalc.getMetrics();

    return {
      entropy: entropyMetrics,
      rsi: rsiMetrics
    };
  }

  /**
   * Get stats
   */
  async getStats() {
    const entropyStats = this.entropyCalc.getStats();
    const rsiStats = this.rsiCalc.getStats();

    return {
      entropy: entropyStats,
      rsi: rsiStats
    };
  }

  /**
   * Get recent events
   */
  async getEvents(limit = 5, type = null) {
    return this.entropyCalc.getRecentEvents(limit, type);
  }

  /**
   * Get history
   */
  async getHistory(limit = 100) {
    return this.entropyCalc.getHistory(limit);
  }

  /**
   * Get divergence
   */
  async getDivergence() {
    const metrics = this.entropyCalc.getMetrics();

    const bidEntropy = metrics.bid_entropy;
    const askEntropy = metrics.ask_entropy;
    const divergence = Math.abs(bidEntropy - askEntropy);
    const divergencePct = (divergence / Math.max(bidEntropy, askEntropy)) * 100;

    // Classify significance
    let significance = 'LOW';
    if (divergencePct > 10) {
      significance = 'EXTREME';
    } else if (divergencePct > 5) {
      significance = 'HIGH';
    } else if (divergencePct > 2) {
      significance = 'MEDIUM';
    }

    const direction = bidEntropy > askEntropy ? 'BID_HIGHER' : 'ASK_HIGHER';

    const interpretation = direction === 'BID_HIGHER'
      ? 'Bid side more dispersed - support may be weaker'
      : 'Ask side more dispersed - resistance may be weaker';

    return {
      bid_entropy: bidEntropy,
      ask_entropy: askEntropy,
      divergence,
      divergence_pct: divergencePct,
      ratio: metrics.ratio,
      significance,
      direction,
      interpretation,
      timestamp: metrics.timestamp
    };
  }

  /**
   * Set depth
   */
  async setDepth(depth) {
    if (!depth || typeof depth !== 'number') {
      throw new Error('Depth must be a number');
    }

    if (depth < 20 || depth > 200) {
      throw new Error('Depth must be between 20 and 200');
    }

    return this.entropyCalc.setDepth(depth);
  }

  /**
   * Get depth info
   */
  async getDepthInfo() {
    const depth = this.entropyCalc.getDepth();
    const availableAssets = this.entropyCalc.getAvailableAssets();
    const stats = this.entropyCalc.getStats();

    return {
      current_depth: depth,
      min_depth: this.entropyCalc.config.minDepth,
      max_depth: this.entropyCalc.config.maxDepth,
      default_depth: this.entropyCalc.config.defaultDepth,
      current_asset: stats.config.asset,
      available_assets: availableAssets,
      depth_changes: stats.depth_changes
    };
  }

  /**
   * Set asset
   */
  async setAsset(asset) {
    if (!asset || typeof asset !== 'string') {
      throw new Error('Asset must be a string');
    }

    const newAsset = this.entropyCalc.setAsset(asset);
    const newDepth = this.entropyCalc.getDepth();
    const stats = this.entropyCalc.getStats();

    return {
      asset: newAsset,
      depth: newDepth,
      thresholds: stats.config.thresholds
    };
  }

  /**
   * Get assets
   */
  async getAssets() {
    const assets = this.entropyCalc.getAvailableAssets();
    const profiles = {};

    assets.forEach(asset => {
      const profile = this.entropyCalc.config.assetProfiles[asset];
      if (profile) {
        profiles[asset] = profile;
      }
    });

    return {
      available: assets,
      current: this.entropyCalc.config.currentAsset,
      profiles
    };
  }

  /**
   * Get RSI
   */
  async getRSI() {
    return this.rsiCalc.getMetrics();
  }

  /**
   * Get volume
   */
  async getVolume() {
    const volumeTrend = this.rsiCalc.detectVolumeTrend();

    if (!volumeTrend) {
      throw new Error('Volume data not available yet');
    }

    return volumeTrend;
  }

  /**
   * Get divergences
   */
  async getDivergences() {
    const rsiVolumeDivergence = this.rsiCalc.detectRSIVolumeDivergence();
    const rsiPriceDivergence = this.rsiCalc.detectDivergence();

    return {
      rsi_volume: rsiVolumeDivergence,
      rsi_price: rsiPriceDivergence,
      timestamp: Date.now()
    };
  }
}

module.exports = EntropyService;