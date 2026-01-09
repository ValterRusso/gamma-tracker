/**
 * ============================================================================
 * MARKET ANALYSIS SERVICE
 * ============================================================================
 * 
 * Business logic para análise combinada de mercado
 * Usa CombinedMarketAnalyzer (Entropy + RSI + Volume)
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

class MarketAnalysisService {
  constructor(marketAnalyzer) {
    this.marketAnalyzer = marketAnalyzer;
  }

  /**
   * Get complete market analysis
   */
  async getAnalysis() {
    if (!this.marketAnalyzer) {
      throw new Error('Market analyzer not available');
    }

    const analysis = this.marketAnalyzer.analyze();
    
    if (!analysis) {
      throw new Error('Unable to generate market analysis');
    }

    return analysis;
  }

  /**
   * Get analysis history
   * @param {number} limit - Number of historical entries
   */
  async getHistory(limit = 10) {
    if (!this.marketAnalyzer) {
      throw new Error('Market analyzer not available');
    }

    // Check if analyzer has getHistory method
    if (typeof this.marketAnalyzer.getHistory === 'function') {
      return this.marketAnalyzer.getHistory(limit);
    }

    // Fallback: return empty array if method doesn't exist
    return [];
  }

  /**
   * Get analyzer statistics
   */
  async getStats() {
    if (!this.marketAnalyzer) {
      throw new Error('Market analyzer not available');
    }

    // Check if analyzer has getStats method
    if (typeof this.marketAnalyzer.getStats === 'function') {
      return this.marketAnalyzer.getStats();
    }

    // Fallback: return basic stats
    return {
      available: true,
      type: 'CombinedMarketAnalyzer'
    };
  }

  /**
   * Get pattern explanation
   * @param {string} pattern - Pattern name
   */
  async getPatternExplanation(pattern) {
    const patternUpper = pattern.toUpperCase();

    // Pattern explanations
    const explanations = {
      'DISTRIBUTION': {
        name: 'Distribution Phase',
        description: 'Market makers are distributing (selling) positions to retail. High ask entropy with diverging RSI suggests potential top.',
        signals: [
          'Ask entropy > Bid entropy',
          'RSI showing bearish divergence',
          'Volume declining on rallies'
        ],
        implications: 'Potential reversal to downside. Market makers likely offloading positions.',
        trading: 'Consider reducing long exposure or taking profits.'
      },
      'ACCUMULATION': {
        name: 'Accumulation Phase',
        description: 'Market makers are accumulating (buying) positions from retail. High bid entropy with diverging RSI suggests potential bottom.',
        signals: [
          'Bid entropy > Ask entropy',
          'RSI showing bullish divergence',
          'Volume declining on selloffs'
        ],
        implications: 'Potential reversal to upside. Market makers likely building positions.',
        trading: 'Consider entering long positions or adding to positions.'
      },
      'BEARISH_MOMENTUM': {
        name: 'Bearish Momentum',
        description: 'Strong selling pressure with confirming indicators. Trend continuation likely.',
        signals: [
          'High ask entropy',
          'RSI in oversold territory',
          'Volume increasing on declines'
        ],
        implications: 'Downtrend with strong momentum. Expect continuation.',
        trading: 'Avoid longs. Consider shorts with tight stops.'
      },
      'BULLISH_MOMENTUM': {
        name: 'Bullish Momentum',
        description: 'Strong buying pressure with confirming indicators. Trend continuation likely.',
        signals: [
          'High bid entropy',
          'RSI in overbought territory',
          'Volume increasing on rallies'
        ],
        implications: 'Uptrend with strong momentum. Expect continuation.',
        trading: 'Hold longs. Avoid shorts.'
      },
      'SQUEEZE': {
        name: 'Low Volatility Squeeze',
        description: 'Market in consolidation with low entropy on both sides. Breakout imminent.',
        signals: [
          'Low bid and ask entropy',
          'RSI near 50',
          'Volume declining'
        ],
        implications: 'Energy building for major move. Direction uncertain.',
        trading: 'Wait for breakout confirmation. Prepare for volatility expansion.'
      },
      'RSI_VOLUME_DIVERGENCE': {
        name: 'RSI-Volume Divergence',
        description: 'RSI and volume showing conflicting signals. Potential reversal or fake move.',
        signals: [
          'RSI trending one direction',
          'Volume trending opposite direction',
          'Price action inconclusive'
        ],
        implications: 'Mixed signals. Market indecision or manipulation.',
        trading: 'Reduce position size. Wait for clarity.'
      }
    };

    const explanation = explanations[patternUpper];

    if (!explanation) {
      throw new Error(`Pattern '${pattern}' not found. Available patterns: ${Object.keys(explanations).join(', ')}`);
    }

    return explanation;
  }
}

module.exports = MarketAnalysisService;