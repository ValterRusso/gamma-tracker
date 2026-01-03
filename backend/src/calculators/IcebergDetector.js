/**
 * IcebergDetector.js
 * 
 * Detects hidden iceberg orders in the order book using 5 heuristic signals:
 * 1. Refilling Pattern - Small orders that reappear constantly
 * 2. Volume Anomaly - Executed volume >> Visible volume
 * 3. Price Rejection - Price "bounces" off same level repeatedly
 * 4. Depth Regeneration - Depth recovers quickly after execution
 * 5. Consistent Size - Same order size appears repeatedly
 * 
 * Inspired by BookMap and professional order flow analysis tools.
 * 
 * @author Gamma Tracker Team
 * @date 2026-01-01
 * @version 1.0.0
 */

class IcebergDetector {
  constructor(config = {}) {
    this.config = {
      // Refilling Pattern thresholds
      refillingMinOccurrences: config.refillingMinOccurrences || 5,
      refillingMaxSize: config.refillingMaxSize || 5, // BTC
      refillingMinLevels: config.refillingMinLevels || 3,
      
      // Volume Anomaly thresholds
      volumeAnomalyRatio: config.volumeAnomalyRatio || 2.0,
      volumeWindowMs: config.volumeWindowMs || 300000, // 5 minutes
      
      // Price Rejection thresholds
      rejectionMinCount: config.rejectionMinCount || 3,
      rejectionRoundTo: config.rejectionRoundTo || 100, // Round to $100
      
      // Depth Regeneration thresholds
      regenMinDrop: config.regenMinDrop || 0.2, // 20% drop
      regenMinRecovery: config.regenMinRecovery || 0.15, // 15% recovery
      regenMinCount: config.regenMinCount || 2,
      
      // Consistent Size thresholds
      consistentSizeMinOccurrences: config.consistentSizeMinOccurrences || 5,
      consistentSizeRounding: config.consistentSizeRounding || 0.1, // Round to 0.1 BTC
      
      // Weights for scoring
      weights: {
        refillingOrders: 0.30,
        volumeAnomaly: 0.25,
        priceRejection: 0.20,
        depthRegeneration: 0.15,
        consistentSize: 0.10
      },
      
      // History buffer sizes
      maxSnapshotHistory: config.maxSnapshotHistory || 100,
      maxTradeHistory: config.maxTradeHistory || 1000,
      maxPriceHistory: config.maxPriceHistory || 500,
      maxDepthHistory: config.maxDepthHistory || 100
    };
    
    // Internal state
    this.snapshotHistory = [];
    this.tradeHistory = [];
    this.priceHistory = [];
    this.depthHistory = [];
    
    // Statistics
    this.stats = {
      totalDetections: 0,
      highConfidenceDetections: 0,
      lastDetectionTime: null,
      averageScore: 0
    };
  }
  
  /**
   * Main detection method
   * @param {Object} orderBook - Current order book snapshot
   * @param {Array} recentTrades - Recent trades (optional, for volume anomaly)
   * @returns {Object} Detection result with score, confidence, and signals
   */
  detect(orderBook, recentTrades = null) {
    // Update history
    this.updateHistory(orderBook, recentTrades);
    
    // Run all detection signals
    const signals = {
      refillingOrders: this.detectRefillingPattern(),
      volumeAnomaly: this.detectVolumeAnomaly(orderBook, recentTrades),
      priceRejection: this.detectPriceRejection(),
      depthRegeneration: this.detectDepthRegeneration(),
      consistentSize: this.detectConsistentSize(orderBook)
    };
    
    // Calculate weighted score
    const score = this.calculateScore(signals);
    
    // Determine confidence level
    const confidence = this.getConfidenceLevel(score);
    
    // Estimate hidden size
    const estimatedHiddenSize = this.estimateHiddenSize(orderBook, score);
    
    // Update statistics
    this.updateStats(score, confidence);
    
    return {
      detected: score > 0.,
      score: score,
      confidence: confidence,
      signals: signals,
      estimatedHiddenSize: estimatedHiddenSize,
      timestamp: new Date().toISOString(),
      details: this.getDetectionDetails(signals, score)
    };
  }
  
  /**
   * Signal 1: Refilling Pattern
   * Detects small orders that reappear constantly at same price levels
   */
  detectRefillingPattern() {
    if (this.snapshotHistory.length < 10) {
      return { detected: false, reason: 'Insufficient history' };
    }
    
    // Group orders by price level
    const priceOccurrences = {};
    
    this.snapshotHistory.forEach(snapshot => {
      if (!snapshot.asks) return;
      
      snapshot.asks.forEach(ask => {
        const price = Array.isArray(ask) ? ask[0] : ask.price;
        const size = Array.isArray(ask) ? ask[1] : ask.size;
        
        if (!priceOccurrences[price]) {
          priceOccurrences[price] = [];
        }
        priceOccurrences[price].push(size);
      });
    });
    
    // Analyze patterns
    let refillingLevels = 0;
    const detectedLevels = [];
    
    Object.entries(priceOccurrences).forEach(([price, sizes]) => {
      const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      const occurrences = sizes.length;
      
      // Small size but appears frequently = refilling pattern
      if (avgSize < this.config.refillingMaxSize && 
          occurrences >= this.config.refillingMinOccurrences) {
        refillingLevels++;
        detectedLevels.push({
          price: parseFloat(price),
          avgSize: avgSize,
          occurrences: occurrences
        });
      }
    });
    
    const detected = refillingLevels >= this.config.refillingMinLevels;
    
    return {
      detected: detected,
      refillingLevels: refillingLevels,
      detectedLevels: detectedLevels.slice(0, 5), // Top 5
      score: detected ? Math.min(1, refillingLevels / 5) : 0
    };
  }
  
  /**
   * Signal 2: Volume Anomaly
   * Detects when executed volume >> visible volume (hidden liquidity)
   */
  detectVolumeAnomaly(orderBook, recentTrades) {
    if (!recentTrades || recentTrades.length === 0) {
      return { detected: false, reason: 'No trade data' };
    }
    
    // Calculate executed volume in time window
    const now = Date.now();
    const windowStart = now - this.config.volumeWindowMs;
    
    const executedVolume = recentTrades
      .filter(t => t.timestamp >= windowStart)
      .reduce((sum, t) => sum + (t.size || t.quantity || 0), 0);
    
    // Calculate visible volume (top 10 levels)
    let visibleVolume = 0;
    
    if (orderBook.asks && Array.isArray(orderBook.asks)) {
      visibleVolume += orderBook.asks
        .slice(0, 10)
        .reduce((sum, ask) => {
          const size = Array.isArray(ask) ? ask[1] : ask.size;
          return sum + size;
        }, 0);
    }
    
    if (orderBook.bids && Array.isArray(orderBook.bids)) {
      visibleVolume += orderBook.bids
        .slice(0, 10)
        .reduce((sum, bid) => {
          const size = Array.isArray(bid) ? bid[1] : bid.size;
          return sum + size;
        }, 0);
    }
    
    // Calculate ratio
    const ratio = visibleVolume > 0 ? executedVolume / visibleVolume : 0;
    const detected = ratio >= this.config.volumeAnomalyRatio;
    
    return {
      detected: detected,
      executedVolume: executedVolume,
      visibleVolume: visibleVolume,
      ratio: ratio,
      score: detected ? Math.min(1, ratio / 5) : 0
    };
  }
  
  /**
   * Signal 3: Price Rejection
   * Detects price levels where price repeatedly "bounces" (iceberg wall)
   */
  detectPriceRejection() {
    if (this.priceHistory.length < 20) {
      return { detected: false, reason: 'Insufficient price history' };
    }
    
    // Find rejection levels (local maxima/minima)
    const rejectionLevels = {};
    
    for (let i = 1; i < this.priceHistory.length - 1; i++) {
      const prev = this.priceHistory[i - 1];
      const curr = this.priceHistory[i];
      const next = this.priceHistory[i + 1];
      
      // Detect peak (tried to go up, but reversed)
      if (curr > prev && curr > next) {
        const level = Math.round(curr / this.config.rejectionRoundTo) * this.config.rejectionRoundTo;
        rejectionLevels[level] = (rejectionLevels[level] || 0) + 1;
      }
      
      // Detect valley (tried to go down, but reversed)
      if (curr < prev && curr < next) {
        const level = Math.round(curr / this.config.rejectionRoundTo) * this.config.rejectionRoundTo;
        rejectionLevels[level] = (rejectionLevels[level] || 0) + 1;
      }
    }
    
    // Find strongest rejection levels
    const strongRejections = Object.entries(rejectionLevels)
      .filter(([level, count]) => count >= this.config.rejectionMinCount)
      .sort((a, b) => b[1] - a[1])
      .map(([level, count]) => ({
        level: parseFloat(level),
        rejections: count
      }));
    
    const detected = strongRejections.length > 0;
    
    return {
      detected: detected,
      rejectionLevels: strongRejections.slice(0, 5), // Top 5
      strongestLevel: strongRejections[0] || null,
      score: detected ? Math.min(1, strongRejections[0].rejections / 10) : 0
    };
  }
  
  /**
   * Signal 4: Depth Regeneration
   * Detects when depth drops sharply but recovers quickly (iceberg refilling)
   */
  detectDepthRegeneration() {
    if (this.depthHistory.length < 5) {
      return { detected: false, reason: 'Insufficient depth history' };
    }
    
    let regenerationCount = 0;
    const regenerationEvents = [];
    
    for (let i = 2; i < this.depthHistory.length; i++) {
      const prev2 = this.depthHistory[i - 2];
      const prev1 = this.depthHistory[i - 1];
      const curr = this.depthHistory[i];
      
      // Calculate drop and recovery
      const drop = prev2 > 0 ? (prev2 - prev1) / prev2 : 0;
      const recovery = prev1 > 0 ? (curr - prev1) / prev1 : 0;
      
      // Sharp drop followed by recovery = regeneration
      if (drop >= this.config.regenMinDrop && 
          recovery >= this.config.regenMinRecovery) {
        regenerationCount++;
        regenerationEvents.push({
          index: i,
          drop: drop,
          recovery: recovery,
          timestamp: this.depthHistory[i].timestamp
        });
      }
    }
    
    const detected = regenerationCount >= this.config.regenMinCount;
    
    return {
      detected: detected,
      regenerationCount: regenerationCount,
      events: regenerationEvents.slice(-5), // Last 5
      score: detected ? Math.min(1, regenerationCount / 5) : 0
    };
  }
  
  /**
   * Signal 5: Consistent Size
   * Detects when same order size appears repeatedly (bot pattern)
   */
  detectConsistentSize(orderBook) {
    if (!orderBook.asks || !Array.isArray(orderBook.asks)) {
      return { detected: false, reason: 'No order book data' };
    }
    
    // Group orders by rounded size
    const sizeCounts = {};
    
    orderBook.asks.forEach(ask => {
      const size = Array.isArray(ask) ? ask[1] : ask.size;
      const roundedSize = Math.round(size / this.config.consistentSizeRounding) * this.config.consistentSizeRounding;
      
      sizeCounts[roundedSize] = (sizeCounts[roundedSize] || 0) + 1;
    });
    
    // Find sizes that appear frequently
    const consistentSizes = Object.entries(sizeCounts)
      .filter(([size, count]) => count >= this.config.consistentSizeMinOccurrences)
      .sort((a, b) => b[1] - a[1])
      .map(([size, count]) => ({
        size: parseFloat(size),
        occurrences: count
      }));
    
    const detected = consistentSizes.length > 0;
    
    return {
      detected: detected,
      consistentSizes: consistentSizes.slice(0, 5), // Top 5
      mostCommonSize: consistentSizes[0] || null,
      score: detected ? Math.min(1, consistentSizes[0].occurrences / 10) : 0
    };
  }
  
  /**
   * Calculate weighted score from signals
   */
  calculateScore(signals) {
    let score = 0;
    
    Object.entries(signals).forEach(([signalName, signalData]) => {
      if (signalData.detected) {
        const weight = this.config.weights[signalName] || 0;
        const signalScore = signalData.score || 1;
        score += weight * signalScore;
      }
    });
    
    return Math.min(1, score);
  }
  
  /**
   * Get confidence level from score
   */
  getConfidenceLevel(score) {
    if (score >= 0.7) return 'VERY_HIGH';
    if (score >= 0.5) return 'HIGH';
    if (score >= 0.3) return 'MEDIUM';
    if (score >= 0.15) return 'LOW';
    return 'VERY_LOW';
  }
  
  /**
   * Estimate hidden size based on signals
   */
  estimateHiddenSize(orderBook, score) {
    // Get visible size (top 5 levels)
    let visibleSize = 0;
    
    if (orderBook.asks && Array.isArray(orderBook.asks)) {
      visibleSize = orderBook.asks
        .slice(0, 5)
        .reduce((sum, ask) => {
          const size = Array.isArray(ask) ? ask[1] : ask.size;
          return sum + size;
        }, 0);
    }
    
    // Estimate hidden size based on score
    // Higher score = more hidden liquidity
    const multiplier = 1 + (score * 10); // 1x to 11x
    const estimatedTotal = visibleSize * multiplier;
    const estimatedHidden = estimatedTotal - visibleSize;
    
    return {
      visible: visibleSize,
      hidden: estimatedHidden,
      total: estimatedTotal,
      multiplier: multiplier
    };
  }
  
  /**
   * Update internal history buffers
   */
  updateHistory(orderBook, recentTrades) {
    // Update snapshot history
    this.snapshotHistory.push({
      timestamp: Date.now(),
      asks: orderBook.asks ? JSON.parse(JSON.stringify(orderBook.asks.slice(0, 20))) : [],
      bids: orderBook.bids ? JSON.parse(JSON.stringify(orderBook.bids.slice(0, 20))) : []
    });
    
    if (this.snapshotHistory.length > this.config.maxSnapshotHistory) {
      this.snapshotHistory.shift();
    }
    
    // Update trade history
    if (recentTrades && Array.isArray(recentTrades)) {
      this.tradeHistory.push(...recentTrades);
      
      if (this.tradeHistory.length > this.config.maxTradeHistory) {
        this.tradeHistory = this.tradeHistory.slice(-this.config.maxTradeHistory);
      }
    }
    
    // Update price history (from order book mid-price)
    if (orderBook.asks && orderBook.bids && 
        orderBook.asks.length > 0 && orderBook.bids.length > 0) {
      const bestAsk = Array.isArray(orderBook.asks[0]) ? orderBook.asks[0][0] : orderBook.asks[0].price;
      const bestBid = Array.isArray(orderBook.bids[0]) ? orderBook.bids[0][0] : orderBook.bids[0].price;
      const midPrice = (bestAsk + bestBid) / 2;
      
      this.priceHistory.push(midPrice);
      
      if (this.priceHistory.length > this.config.maxPriceHistory) {
        this.priceHistory.shift();
      }
    }
    
    // Update depth history
    if (orderBook.depth !== undefined) {
      this.depthHistory.push({
        timestamp: Date.now(),
        value: orderBook.depth
      });
      
      if (this.depthHistory.length > this.config.maxDepthHistory) {
        this.depthHistory.shift();
      }
    }
  }
  
  /**
   * Update statistics
   */
  updateStats(score, confidence) {
    this.stats.totalDetections++;
    
    if (confidence === 'HIGH' || confidence === 'VERY_HIGH') {
      this.stats.highConfidenceDetections++;
    }
    
    this.stats.lastDetectionTime = new Date().toISOString();
    
    // Update running average
    const alpha = 0.1; // Exponential smoothing factor
    this.stats.averageScore = this.stats.averageScore * (1 - alpha) + score * alpha;
  }
  
  /**
   * Get detailed detection information
   */
  getDetectionDetails(signals, score) {
    const activeSignals = Object.entries(signals)
      .filter(([name, data]) => data.detected)
      .map(([name, data]) => ({
        name: name,
        score: data.score,
        weight: this.config.weights[name]
      }));
    
    return {
      activeSignals: activeSignals,
      totalScore: score,
      signalCount: activeSignals.length,
      weightedContributions: activeSignals.map(s => ({
        signal: s.name,
        contribution: (s.score * s.weight).toFixed(3)
      }))
    };
  }
  
  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      historyBuffers: {
        snapshots: this.snapshotHistory.length,
        trades: this.tradeHistory.length,
        prices: this.priceHistory.length,
        depths: this.depthHistory.length
      }
    };
  }
  
  /**
   * Reset detector state
   */
  reset() {
    this.snapshotHistory = [];
    this.tradeHistory = [];
    this.priceHistory = [];
    this.depthHistory = [];
    
    this.stats = {
      totalDetections: 0,
      highConfidenceDetections: 0,
      lastDetectionTime: null,
      averageScore: 0
    };
  }
}

module.exports = IcebergDetector;
