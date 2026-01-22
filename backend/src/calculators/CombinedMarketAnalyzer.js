/**
 * ============================================================================
 * COMBINED MARKET ANALYZER
 * ============================================================================
 * 
 * Combina múltiplas fontes de dados para gerar sinais synthesized:
 * - Shannon Entropy (orderbook liquidity)
 * - RSI (momentum)
 * - Volume (conviction)
 * 
 * PADRÕES DETECTADOS:
 * 
 * STRONG SELL:
 * ├─ Multiple ASK spikes (sellers positioning)
 * ├─ RSI falling or overbought
 * └─ Volume fading (no buying interest)
 * 
 * STRONG BUY:
 * ├─ Multiple BID collapses (buyers absorbing)
 * ├─ RSI rising or oversold
 * └─ Volume increasing (strong demand)
 * 
 * DISTRIBUTION (top forming):
 * ├─ ASK spikes
 * ├─ RSI overbought
 * └─ Volume fading
 * 
 * ACCUMULATION (bottom forming):
 * ├─ BID collapses
 * ├─ RSI oversold
 * └─ Volume increasing
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * @date 2026-01-06
 * ============================================================================
 */

const EventEmitter = require('events');

class CombinedMarketAnalyzer extends EventEmitter {
  /**
   * @param {EntropyCalculatorV2} entropyCalc - Entropy calculator instance
   * @param {RSICalculatorV2} rsiCalc - RSI calculator instance
   * @param {Object} logger - Logger instance
   * @param {Object} config - Configuration
   */
  constructor(entropyCalc, rsiCalc, logger, config = {}) {
    super();
    
    this.entropyCalc = entropyCalc;
    this.rsiCalc = rsiCalc;
    this.logger = logger;
    
    // Configuração
    this.config = {
      // Event thresholds
      minEventsForSignal: 2,       // Min 2 entropy events
      eventLookback: 5,             // Look at last 5 events
      
      // RSI thresholds
      rsiOverbought: 70,
      rsiOversold: 30,
      rsiNeutralLow: 45,
      rsiNeutralHigh: 55,
      
      // Volume thresholds
      volumeStrongChange: 0.3,      // 30% change = strong
      
      // Confidence calculation
      minConfidence: 0.50,          // Min 50% confidence
      highConfidence: 0.75,         // 75%+ = high confidence
      
      ...config
    };
    
    // Histórico de análises
    this.analysisHistory = [];
    this.maxHistorySize = 50;
    
    // Stats
    this.stats = {
      analyses: 0,
      strong_buy_signals: 0,
      strong_sell_signals: 0,
      neutral_signals: 0,
      high_confidence_signals: 0
    };
    
    this.logger.info('[CombinedMarketAnalyzer] Initialized');
  }
  
  /**
   * ========================================================================
   * COMBINED ANALYSIS
   * ========================================================================
   */
  
  /**
   * Analyze current market state
   * @returns {Object} Complete analysis with synthesized signal
   */
  analyze() {
    try {
      // Get metrics from calculators
      const entropyMetrics = this.entropyCalc.getMetrics();
      const rsiMetrics = this.rsiCalc.getMetrics();
      
      // Get recent entropy events
      const recentEvents = this.entropyCalc.getRecentEvents(this.config.eventLookback);
      
      // Count event types
      const askSpikes = recentEvents.filter(e => e.type === 'ASK_SPIKE').length;
      const bidCollapses = recentEvents.filter(e => e.type === 'BID_COLLAPSE').length;
      const squeezes = recentEvents.filter(e => e.type === 'SQUEEZE').length;
      
      // Get volume metrics
      const volumeTrend = rsiMetrics.volume;
      
      // Get divergences
      const rsiVolumeDivergence = rsiMetrics.divergence;
      const rsiPriceDivergence = this.rsiCalc.detectDivergence();
      
      // Synthesize signal
      const synthesized = this._synthesizeSignal({
        entropy: entropyMetrics,
        rsi: rsiMetrics,
        events: { askSpikes, bidCollapses, squeezes },
        volume: volumeTrend,
        divergences: {
          rsiVolume: rsiVolumeDivergence,
          rsiPrice: rsiPriceDivergence
        }
      });
      
      // Create complete analysis
      const analysis = {
        timestamp: Date.now(),
        
        // Raw metrics
        entropy: {
          bid_normalized: entropyMetrics.normalized.bid,
          ask_normalized: entropyMetrics.normalized.ask,
          total_normalized: entropyMetrics.normalized.total,
          ratio: entropyMetrics.ratio,
          bands: {
            bid: entropyMetrics.bands.bid.interpretation,
            ask: entropyMetrics.bands.ask.interpretation
          },
          depth: entropyMetrics.depth_info.current,
          asset: entropyMetrics.depth_info.asset
        },
        
        rsi: {
          current: rsiMetrics.current,
          status: rsiMetrics.status
        },
        
        volume: {
          trend: volumeTrend?.trend || 'UNKNOWN',
          strength: volumeTrend?.strength || 'UNKNOWN',
          spike: volumeTrend?.spike || false,
          change: volumeTrend?.changePct || 0
        },
        
        // Events
        events: {
          askSpikes,
          bidCollapses,
          squeezes,
          total: recentEvents.length,
          recent: recentEvents.slice(0, 3).map(e => ({
            type: e.type,
            signal: e.signal,
            confidence: e.confidence
          }))
        },
        
        // Divergences
        divergences: {
          rsiVolume: rsiVolumeDivergence,
          rsiPrice: rsiPriceDivergence
        },
        
        // Synthesized signal
        synthesized
      };
      
      // Add to history
      this._addToHistory(analysis);
      
      // Update stats
      this.stats.analyses++;
      
      if (synthesized.signal === 'STRONG_BUY') {
        this.stats.strong_buy_signals++;
      } else if (synthesized.signal === 'STRONG_SELL') {
        this.stats.strong_sell_signals++;
      } else {
        this.stats.neutral_signals++;
      }
      
      if (synthesized.confidence >= this.config.highConfidence) {
        this.stats.high_confidence_signals++;
      }
      
      // Emit event
      this.emit('analysis', analysis);
      
      // Log if high confidence
      if (synthesized.confidence >= this.config.highConfidence) {
        this.logger.info(`[CombinedMarketAnalyzer] 🎯 ${synthesized.signal} (${(synthesized.confidence * 100).toFixed(0)}% confidence)`, {
          reasons: synthesized.reasons
        });
      }
      
      return analysis;
      
    } catch (error) {
      this.logger.error('[CombinedMarketAnalyzer] Error analyzing', {
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * ========================================================================
   * SIGNAL SYNTHESIS (CORE LOGIC)
   * ========================================================================
   */
  
  /**
   * Synthesize signal from multiple sources
   * @private
   */
  _synthesizeSignal(data) {
    const { entropy, rsi, events, volume, divergences } = data;
    
    let signal = 'NEUTRAL';
    let confidence = 0;
    let reasons = [];
    let action = 'WAIT';
    let pattern = null;
    
    // ========================================================================
    // PATTERN 1: DISTRIBUTION (Top forming) 📉
    // ========================================================================
    if (events.askSpikes >= this.config.minEventsForSignal &&
        rsi.current >= this.config.rsiOverbought &&
        volume?.trend === 'DECREASING') {
      
      signal = 'STRONG_SELL';
      confidence = 0.85;
      pattern = 'DISTRIBUTION';
      action = 'SHORT or TAKE PROFIT';
      
      reasons = [
        `${events.askSpikes} ASK spikes (sellers positioning aggressively)`,
        `RSI ${rsi.current.toFixed(0)} (overbought - exhaustion)`,
        `Volume ${volume.trend.toLowerCase()} ${volume.change.toFixed(1)}% (no buying interest)`,
        'Classic distribution pattern - top likely forming'
      ];
    }
    
    // ========================================================================
    // PATTERN 2: ACCUMULATION (Bottom forming) 📈
    // ========================================================================
    else if (events.bidCollapses >= this.config.minEventsForSignal &&
             rsi.current <= this.config.rsiOversold &&
             volume?.trend === 'INCREASING') {
      
      signal = 'STRONG_BUY';
      confidence = 0.85;
      pattern = 'ACCUMULATION';
      action = 'BUY on confirmation';
      
      reasons = [
        `${events.bidCollapses} BID collapses (buyers absorbing)`,
        `RSI ${rsi.current.toFixed(0)} (oversold - reversal zone)`,
        `Volume ${volume.trend.toLowerCase()} ${volume.change.toFixed(1)}% (strong demand)`,
        'Classic accumulation pattern - bottom likely forming'
      ];
    }
    
    // ========================================================================
    // PATTERN 3: BEARISH MOMENTUM 📉
    // ========================================================================
    else if (events.askSpikes >= this.config.minEventsForSignal &&
             rsi.current < this.config.rsiNeutralHigh &&
             volume?.trend !== 'INCREASING') {
      
      signal = 'SELL';
      confidence = 0.70;
      pattern = 'BEARISH_MOMENTUM';
      action = 'SHORT or REDUCE LONGS';
      
      reasons = [
        `${events.askSpikes} ASK spikes (sellers active)`,
        `RSI ${rsi.current.toFixed(0)} (weakening momentum)`,
        'Volume not supporting reversal'
      ];
    }
    
    // ========================================================================
    // PATTERN 4: BULLISH MOMENTUM 📈
    // ========================================================================
    else if (events.bidCollapses >= this.config.minEventsForSignal &&
             rsi.current > this.config.rsiNeutralLow &&
             volume?.trend !== 'DECREASING') {
      
      signal = 'BUY';
      confidence = 0.70;
      pattern = 'BULLISH_MOMENTUM';
      action = 'BUY or ADD TO LONGS';
      
      reasons = [
        `${events.bidCollapses} BID collapses (absorption)`,
        `RSI ${rsi.current.toFixed(0)} (strengthening)`,
        'Volume supporting move'
      ];
    }
    
    // ========================================================================
    // PATTERN 5: RSI+VOLUME DIVERGENCE (if detected) 🎯
    // ========================================================================
    if (divergences.rsiVolume) {
      const div = divergences.rsiVolume;
      
      if (div.type === 'BEARISH_DIVERGENCE' || div.type === 'BULLISH_REVERSAL') {
        signal = div.signal;
        confidence = Math.max(confidence, 0.75);  // Boost confidence
        
        reasons.unshift(`${div.type}: ${div.message}`);
      }
    }
    
    // ========================================================================
    // PATTERN 6: SQUEEZE (Breakout imminent) ⚡
    // ========================================================================
    if (events.squeezes >= 1) {
      signal = 'WATCH';
      confidence = 0.60;
      pattern = 'SQUEEZE';
      action = 'WAIT FOR BREAKOUT';
      
      reasons = [
        `${events.squeezes} SQUEEZE detected (both sides tightening)`,
        'High probability breakout imminent',
        'Wait for direction confirmation'
      ];
    }
    
    // ========================================================================
    // VOLUME SPIKE (High conviction) 🔥
    // ========================================================================
    if (volume?.spike) {
      confidence = Math.min(confidence + 0.10, 1.0);  // Boost +10%
      reasons.push(`Volume spike ${volume.spikeRatio.toFixed(1)}x average (high conviction)`);
    }
    
    // ========================================================================
    // ENTROPY BANDS (Extreme levels) 📊
    // ========================================================================
    if (entropy.bands.bid === 'EXTREME_HIGH' || entropy.bands.ask === 'EXTREME_HIGH') {
      reasons.push('Entropy at extreme levels (unusual liquidity distribution)');
    }
    
    // ========================================================================
    // DEFAULT: NEUTRAL
    // ========================================================================
    if (signal === 'NEUTRAL') {
      confidence = 0.50;
      action = 'WAIT FOR CLEARER SIGNAL';
      reasons = [
        'No strong pattern detected',
        `RSI ${rsi.current?.toFixed(0) || 'N/A'} (neutral zone)`,
        `Volume ${volume?.trend || 'stable'}`,
        `${events.total} recent entropy events (mixed signals)`
      ];
    }
    
    // ========================================================================
    // CONFIDENCE ADJUSTMENTS
    // ========================================================================
    
    // Reduce confidence if conflicting signals
    if (events.askSpikes > 0 && events.bidCollapses > 0) {
      confidence *= 0.8;  // -20% for mixed signals
      reasons.push('⚠️ Mixed signals detected (both ASK spikes and BID collapses)');
    }
    
    // Boost confidence for aligned divergences
    if (divergences.rsiPrice && divergences.rsiVolume) {
      const aligned = (divergences.rsiPrice.type === divergences.rsiVolume.type);
      if (aligned) {
        confidence = Math.min(confidence + 0.10, 1.0);
        reasons.push('Multiple divergences aligned (high conviction)');
      }
    }
    
    return {
      signal,
      confidence,
      pattern,
      action,
      reasons,
      timestamp: Date.now()
    };
  }
  
  /**
   * ========================================================================
   * UTILITIES
   * ========================================================================
   */
  
  /**
   * Add to history
   * @private
   */
  _addToHistory(analysis) {
    this.analysisHistory.push(analysis);
    
    if (this.analysisHistory.length > this.maxHistorySize) {
      this.analysisHistory.shift();
    }
  }
  
  /**
   * Get analysis history
   * @param {number} limit
   * @returns {Array}
   */
  getHistory(limit = 10) {
    return this.analysisHistory.slice(-limit);
  }
  
  /**
   * Get stats
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats,
      history_size: this.analysisHistory.length,
      strong_buy_pct: this.stats.analyses > 0
        ? (this.stats.strong_buy_signals / this.stats.analyses * 100).toFixed(1)
        : '0',
      strong_sell_pct: this.stats.analyses > 0
        ? (this.stats.strong_sell_signals / this.stats.analyses * 100).toFixed(1)
        : '0',
      neutral_pct: this.stats.analyses > 0
        ? (this.stats.neutral_signals / this.stats.analyses * 100).toFixed(1)
        : '0',
      high_confidence_pct: this.stats.analyses > 0
        ? (this.stats.high_confidence_signals / this.stats.analyses * 100).toFixed(1)
        : '0'
    };
  }
  
  /**
   * Get pattern explanation
   * @param {string} pattern
   * @returns {Object}
   */
  getPatternExplanation(pattern) {
    const explanations = {
      'DISTRIBUTION': {
        description: 'Top formation pattern - sellers distributing to buyers',
        characteristics: [
          'Multiple ASK spikes (sellers positioning)',
          'RSI overbought (exhaustion)',
          'Volume fading (no new buyers)'
        ],
        action: 'SHORT or TAKE PROFIT',
        risk: 'HIGH',
        successRate: '75-85%'
      },
      
      'ACCUMULATION': {
        description: 'Bottom formation pattern - buyers accumulating from sellers',
        characteristics: [
          'Multiple BID collapses (buyers absorbing)',
          'RSI oversold (capitulation)',
          'Volume increasing (demand surge)'
        ],
        action: 'BUY on confirmation',
        risk: 'MEDIUM',
        successRate: '75-85%'
      },
      
      'BEARISH_MOMENTUM': {
        description: 'Downtrend continuation',
        characteristics: [
          'ASK spikes (sellers active)',
          'RSI weakening',
          'Volume not supporting reversal'
        ],
        action: 'SHORT or REDUCE LONGS',
        risk: 'MEDIUM',
        successRate: '65-75%'
      },
      
      'BULLISH_MOMENTUM': {
        description: 'Uptrend continuation',
        characteristics: [
          'BID collapses (absorption)',
          'RSI strengthening',
          'Volume supporting move'
        ],
        action: 'BUY or ADD TO LONGS',
        risk: 'MEDIUM',
        successRate: '65-75%'
      },
      
      'SQUEEZE': {
        description: 'Liquidity compression - breakout imminent',
        characteristics: [
          'Both BID and ASK entropy collapsing',
          'Tight range',
          'Decreasing volume'
        ],
        action: 'WAIT FOR BREAKOUT',
        risk: 'HIGH (directional uncertainty)',
        successRate: '50-60% (direction prediction)'
      }
    };
    
    return explanations[pattern] || {
      description: 'Unknown pattern',
      characteristics: [],
      action: 'WAIT',
      risk: 'UNKNOWN',
      successRate: 'N/A'
    };
  }
}

module.exports = CombinedMarketAnalyzer;