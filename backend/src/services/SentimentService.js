/**
 * ============================================================================
 * SENTIMENT SERVICE
 * ============================================================================
 * 
 * Business logic para análise de sentimento do mercado
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

class SentimentService {
  constructor(dataCollector, maxPainCalculator, sentimentAnalyzer) {
    this.dataCollector = dataCollector;
    this.maxPainCalculator = maxPainCalculator;
    this.sentimentAnalyzer = sentimentAnalyzer;
  }

  /**
   * Get Max Pain calculation
   */
  async getMaxPain() {
    // Get options data
    const options = this.dataCollector.getAllOptions();
    const spotPrice = this.dataCollector.spotPrice; // ✅ Propriedade, não método

    if (!options || options.length === 0) {
      throw new Error('Nenhuma opção disponível');
    }

    // Calculate Max Pain
    const maxPain = this.maxPainCalculator.calculateMaxPain(options, spotPrice);

    if (!maxPain) {
      throw new Error('Não foi possível calcular Max Pain');
    }

    // Format top strikes
    const topStrikes = maxPain.strikeOIMap
      ? Object.entries(maxPain.strikeOIMap)
          .sort((a, b) => b[1].totalOI - a[1].totalOI)
          .slice(0, 10)
          .map(([strike, data]) => ({
            strike: parseFloat(strike),
            totalOI: data.totalOI,
            callOI: data.callOI,
            putOI: data.putOI
          }))
      : [];

    return {
      maxPainStrike: maxPain.maxPainStrike,
      maxPainOI: maxPain.maxPainOI,
      maxPainCallOI: maxPain.maxPainCallOI,
      maxPainPutOI: maxPain.maxPainPutOI,
      spotPrice: spotPrice,
      analysis: maxPain.analysis,
      topStrikes
    };
  }

  /**
   * Get sentiment analysis
   */
  async getSentiment() {
    // Get options data
    const options = this.dataCollector.getAllOptions();

    if (!options || options.length === 0) {
      throw new Error('Nenhuma opção disponível');
    }

    // Analyze sentiment
    const sentiment = this.sentimentAnalyzer.analyzeSentiment(options);

    if (!sentiment) {
      throw new Error('Não foi possível analisar sentimento');
    }

    return sentiment;
  }
}

module.exports = SentimentService;