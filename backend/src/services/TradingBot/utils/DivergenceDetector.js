const Logger = require('../../../utils/logger');

/**
 * Divergence Detector
 * Detects RSI divergences (classic and hidden) for reversal trading
 * 
 * DIVERGENCE TYPES:
 * 
 * 1. CLASSIC BEARISH (Reversal Down):
 *    - Price: Higher High
 *    - RSI: Lower High (< overbought threshold)
 *    → Signal: Expect reversal down
 * 
 * 2. CLASSIC BULLISH (Reversal Up):
 *    - Price: Lower Low
 *    - RSI: Higher Low (> oversold threshold)
 *    → Signal: Expect reversal up
 * 
 * 3. HIDDEN BEARISH (Continuation Down):
 *    - Price: Lower High
 *    - RSI: Higher High
 *    → Signal: Downtrend continuation
 * 
 * 4. HIDDEN BULLISH (Continuation Up):
 *    - Price: Higher Low
 *    - RSI: Lower Low
 *    → Signal: Uptrend continuation
 */
class DivergenceDetector {
  constructor(logger = null) {
    this.logger = logger || new Logger('DivergenceDetector');
  }

  /**
   * Detect all types of divergences
   * @param {Array} priceHistory - [{timestamp, price}] sorted by timestamp ASC
   * @param {Array} rsiHistory - [{timestamp, rsi}] sorted by timestamp ASC
   * @param {Object} params - Detection parameters
   * @returns {Object} Divergence analysis result
   */
  detect(priceHistory, rsiHistory, params = {}) {
    const {
      lookback = 20,
      rsiOverbought = 70,
      rsiOversold = 30,
      minPeakDistance = 5,
      priceThreshold = 0.001, // 0.1% minimum price difference
      rsiThreshold = 2 // Minimum RSI difference
    } = params;

    try {
      // Validate inputs
      if (!priceHistory || priceHistory.length < lookback) {
        return this.createEmptyResult('Insufficient price history');
      }
      
      if (!rsiHistory || rsiHistory.length < lookback) {
        return this.createEmptyResult('Insufficient RSI history');
      }

      // Get recent data
      const recentPrice = priceHistory.slice(-lookback);
      const recentRSI = rsiHistory.slice(-lookback);

      // Find peaks and troughs
      const pricePeaks = this.findPeaks(recentPrice, minPeakDistance);
      const priceTroughs = this.findTroughs(recentPrice, minPeakDistance);
      const rsiPeaks = this.findPeaks(recentRSI, minPeakDistance);
      const rsiTroughs = this.findTroughs(recentRSI, minPeakDistance);

      // Detect classic divergences (reversal signals)
      const classicBearish = this.detectClassicBearish(
        pricePeaks,
        rsiPeaks,
        rsiOverbought,
        priceThreshold,
        rsiThreshold
      );

      const classicBullish = this.detectClassicBullish(
        priceTroughs,
        rsiTroughs,
        rsiOversold,
        priceThreshold,
        rsiThreshold
      );

      // Detect hidden divergences (continuation signals)
      const hiddenBearish = this.detectHiddenBearish(
        pricePeaks,
        rsiPeaks,
        priceThreshold,
        rsiThreshold
      );

      const hiddenBullish = this.detectHiddenBullish(
        priceTroughs,
        rsiTroughs,
        priceThreshold,
        rsiThreshold
      );

      // Determine primary signal
      const signals = [
        { ...classicBearish, priority: 1 },
        { ...classicBullish, priority: 1 },
        { ...hiddenBearish, priority: 2 },
        { ...hiddenBullish, priority: 2 }
      ].filter(s => s.detected);

      // Sort by confidence and priority
      signals.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.confidence - a.confidence;
      });

      const primarySignal = signals[0] || null;

      return {
        detected: !!primarySignal,
        type: primarySignal ? primarySignal.type : null,
        subtype: primarySignal ? primarySignal.subtype : null,
        confidence: primarySignal ? primarySignal.confidence : 0,
        direction: primarySignal ? primarySignal.direction : null,
        
        // Detailed results
        classic: {
          bearish: classicBearish,
          bullish: classicBullish
        },
        hidden: {
          bearish: hiddenBearish,
          bullish: hiddenBullish
        },
        
        // All signals sorted by strength
        allSignals: signals,
        
        // Debug info
        debug: {
          pricePeaks: pricePeaks.length,
          priceTroughs: priceTroughs.length,
          rsiPeaks: rsiPeaks.length,
          rsiTroughs: rsiTroughs.length
        }
      };
    } catch (error) {
      this.logger.error('[DivergenceDetector] Error detecting divergences:', error);
      return this.createEmptyResult(`Error: ${error.message}`);
    }
  }

  /**
   * Detect classic bearish divergence (reversal down)
   * Price makes higher high, RSI makes lower high
   */
  detectClassicBearish(pricePeaks, rsiPeaks, rsiOverbought, priceThreshold, rsiThreshold) {
    if (pricePeaks.length < 2 || rsiPeaks.length < 2) {
      return { detected: false, reason: 'Insufficient peaks' };
    }

    // Get last two peaks
    const price1 = pricePeaks[pricePeaks.length - 2];
    const price2 = pricePeaks[pricePeaks.length - 1];
    
    // Find corresponding RSI peaks (closest in time)
    const rsi1 = this.findClosestPoint(rsiPeaks, price1.timestamp);
    const rsi2 = this.findClosestPoint(rsiPeaks, price2.timestamp);

    if (!rsi1 || !rsi2) {
      return { detected: false, reason: 'No matching RSI peaks' };
    }

    // Check conditions
    const priceHigherHigh = price2.value > price1.value * (1 + priceThreshold);
    const rsiLowerHigh = rsi2.value < rsi1.value - rsiThreshold;
    const rsiInOverbought = rsi1.value > rsiOverbought || rsi2.value > rsiOverbought;

    if (priceHigherHigh && rsiLowerHigh && rsiInOverbought) {
      const confidence = this.calculateConfidence({
        priceDiff: (price2.value - price1.value) / price1.value,
        rsiDiff: rsi1.value - rsi2.value,
        rsiLevel: Math.max(rsi1.value, rsi2.value),
        threshold: rsiOverbought
      });

      return {
        detected: true,
        type: 'classic',
        subtype: 'bearish',
        direction: 'down',
        confidence,
        priority: 1,
        price1: price1.value,
        price2: price2.value,
        rsi1: rsi1.value,
        rsi2: rsi2.value,
        timestamp1: price1.timestamp,
        timestamp2: price2.timestamp,
        reason: `Price higher high (${price1.value.toFixed(2)} → ${price2.value.toFixed(2)}), RSI lower high (${rsi1.value.toFixed(1)} → ${rsi2.value.toFixed(1)})`
      };
    }

    return { detected: false, reason: 'Conditions not met' };
  }

  /**
   * Detect classic bullish divergence (reversal up)
   * Price makes lower low, RSI makes higher low
   */
  detectClassicBullish(priceTroughs, rsiTroughs, rsiOversold, priceThreshold, rsiThreshold) {
    if (priceTroughs.length < 2 || rsiTroughs.length < 2) {
      return { detected: false, reason: 'Insufficient troughs' };
    }

    // Get last two troughs
    const price1 = priceTroughs[priceTroughs.length - 2];
    const price2 = priceTroughs[priceTroughs.length - 1];
    
    // Find corresponding RSI troughs
    const rsi1 = this.findClosestPoint(rsiTroughs, price1.timestamp);
    const rsi2 = this.findClosestPoint(rsiTroughs, price2.timestamp);

    if (!rsi1 || !rsi2) {
      return { detected: false, reason: 'No matching RSI troughs' };
    }

    // Check conditions
    const priceLowerLow = price2.value < price1.value * (1 - priceThreshold);
    const rsiHigherLow = rsi2.value > rsi1.value + rsiThreshold;
    const rsiInOversold = rsi1.value < rsiOversold || rsi2.value < rsiOversold;

    if (priceLowerLow && rsiHigherLow && rsiInOversold) {
      const confidence = this.calculateConfidence({
        priceDiff: (price1.value - price2.value) / price1.value,
        rsiDiff: rsi2.value - rsi1.value,
        rsiLevel: Math.min(rsi1.value, rsi2.value),
        threshold: rsiOversold,
        inverted: true
      });

      return {
        detected: true,
        type: 'classic',
        subtype: 'bullish',
        direction: 'up',
        confidence,
        priority: 1,
        price1: price1.value,
        price2: price2.value,
        rsi1: rsi1.value,
        rsi2: rsi2.value,
        timestamp1: price1.timestamp,
        timestamp2: price2.timestamp,
        reason: `Price lower low (${price1.value.toFixed(2)} → ${price2.value.toFixed(2)}), RSI higher low (${rsi1.value.toFixed(1)} → ${rsi2.value.toFixed(1)})`
      };
    }

    return { detected: false, reason: 'Conditions not met' };
  }

  /**
   * Detect hidden bearish divergence (downtrend continuation)
   * Price makes lower high, RSI makes higher high
   */
  detectHiddenBearish(pricePeaks, rsiPeaks, priceThreshold, rsiThreshold) {
    if (pricePeaks.length < 2 || rsiPeaks.length < 2) {
      return { detected: false, reason: 'Insufficient peaks' };
    }

    const price1 = pricePeaks[pricePeaks.length - 2];
    const price2 = pricePeaks[pricePeaks.length - 1];
    const rsi1 = this.findClosestPoint(rsiPeaks, price1.timestamp);
    const rsi2 = this.findClosestPoint(rsiPeaks, price2.timestamp);

    if (!rsi1 || !rsi2) {
      return { detected: false, reason: 'No matching RSI peaks' };
    }

    const priceLowerHigh = price2.value < price1.value * (1 - priceThreshold);
    const rsiHigherHigh = rsi2.value > rsi1.value + rsiThreshold;

    if (priceLowerHigh && rsiHigherHigh) {
      const confidence = this.calculateConfidence({
        priceDiff: (price1.value - price2.value) / price1.value,
        rsiDiff: rsi2.value - rsi1.value,
        rsiLevel: rsi2.value,
        threshold: 50
      }) * 0.8; // Hidden divergences slightly less confident

      return {
        detected: true,
        type: 'hidden',
        subtype: 'bearish',
        direction: 'down',
        confidence,
        priority: 2,
        price1: price1.value,
        price2: price2.value,
        rsi1: rsi1.value,
        rsi2: rsi2.value,
        timestamp1: price1.timestamp,
        timestamp2: price2.timestamp,
        reason: `Hidden bearish: Price lower high (${price1.value.toFixed(2)} → ${price2.value.toFixed(2)}), RSI higher high (${rsi1.value.toFixed(1)} → ${rsi2.value.toFixed(1)})`
      };
    }

    return { detected: false, reason: 'Conditions not met' };
  }

  /**
   * Detect hidden bullish divergence (uptrend continuation)
   * Price makes higher low, RSI makes lower low
   */
  detectHiddenBullish(priceTroughs, rsiTroughs, priceThreshold, rsiThreshold) {
    if (priceTroughs.length < 2 || rsiTroughs.length < 2) {
      return { detected: false, reason: 'Insufficient troughs' };
    }

    const price1 = priceTroughs[priceTroughs.length - 2];
    const price2 = priceTroughs[priceTroughs.length - 1];
    const rsi1 = this.findClosestPoint(rsiTroughs, price1.timestamp);
    const rsi2 = this.findClosestPoint(rsiTroughs, price2.timestamp);

    if (!rsi1 || !rsi2) {
      return { detected: false, reason: 'No matching RSI troughs' };
    }

    const priceHigherLow = price2.value > price1.value * (1 + priceThreshold);
    const rsiLowerLow = rsi2.value < rsi1.value - rsiThreshold;

    if (priceHigherLow && rsiLowerLow) {
      const confidence = this.calculateConfidence({
        priceDiff: (price2.value - price1.value) / price1.value,
        rsiDiff: rsi1.value - rsi2.value,
        rsiLevel: rsi2.value,
        threshold: 50,
        inverted: true
      }) * 0.8; // Hidden divergences slightly less confident

      return {
        detected: true,
        type: 'hidden',
        subtype: 'bullish',
        direction: 'up',
        confidence,
        priority: 2,
        price1: price1.value,
        price2: price2.value,
        rsi1: rsi1.value,
        rsi2: rsi2.value,
        timestamp1: price1.timestamp,
        timestamp2: price2.timestamp,
        reason: `Hidden bullish: Price higher low (${price1.value.toFixed(2)} → ${price2.value.toFixed(2)}), RSI lower low (${rsi1.value.toFixed(1)} → ${rsi2.value.toFixed(1)})`
      };
    }

    return { detected: false, reason: 'Conditions not met' };
  }

  /**
   * Find peaks in data series
   */
  findPeaks(data, minDistance = 5) {
    const peaks = [];
    
    for (let i = minDistance; i < data.length - minDistance; i++) {
      let isPeak = true;
      
      // Check if current point is higher than neighbors
      for (let j = 1; j <= minDistance; j++) {
        if (data[i].value <= data[i - j].value || data[i].value <= data[i + j].value) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        peaks.push({
          index: i,
          timestamp: data[i].timestamp,
          value: data[i].value
        });
      }
    }
    
    return peaks;
  }

  /**
   * Find troughs in data series
   */
  findTroughs(data, minDistance = 5) {
    const troughs = [];
    
    for (let i = minDistance; i < data.length - minDistance; i++) {
      let isTrough = true;
      
      // Check if current point is lower than neighbors
      for (let j = 1; j <= minDistance; j++) {
        if (data[i].value >= data[i - j].value || data[i].value >= data[i + j].value) {
          isTrough = false;
          break;
        }
      }
      
      if (isTrough) {
        troughs.push({
          index: i,
          timestamp: data[i].timestamp,
          value: data[i].value
        });
      }
    }
    
    return troughs;
  }

  /**
   * Find closest point in array by timestamp
   */
  findClosestPoint(points, targetTimestamp) {
    if (!points || points.length === 0) return null;
    
    let closest = points[0];
    let minDiff = Math.abs(points[0].timestamp - targetTimestamp);
    
    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(points[i].timestamp - targetTimestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = points[i];
      }
    }
    
    return closest;
  }

  /**
   * Calculate confidence score (0-1)
   */
  calculateConfidence({ priceDiff, rsiDiff, rsiLevel, threshold, inverted = false }) {
    // Base confidence from divergence strength
    const priceStrength = Math.min(Math.abs(priceDiff) * 100, 10) / 10; // 0-1
    const rsiStrength = Math.min(Math.abs(rsiDiff) / 20, 1); // 0-1
    
    // RSI extreme bonus
    let extremeBonus = 0;
    if (inverted) {
      extremeBonus = Math.max(0, (threshold - rsiLevel) / threshold) * 0.2;
    } else {
      extremeBonus = Math.max(0, (rsiLevel - threshold) / (100 - threshold)) * 0.2;
    }
    
    // Combine factors
    const baseConfidence = (priceStrength * 0.4 + rsiStrength * 0.4 + extremeBonus);
    
    return Math.min(Math.max(baseConfidence, 0), 1);
  }

  /**
   * Create empty result
   */
  createEmptyResult(reason = 'No divergence detected') {
    return {
      detected: false,
      type: null,
      subtype: null,
      confidence: 0,
      direction: null,
      classic: {
        bearish: { detected: false, reason },
        bullish: { detected: false, reason }
      },
      hidden: {
        bearish: { detected: false, reason },
        bullish: { detected: false, reason }
      },
      allSignals: [],
      debug: {}
    };
  }
}

module.exports = DivergenceDetector;
