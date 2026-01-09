/**
 * ============================================================================
 * CALCULATORS INDEX
 * ============================================================================
 * 
 * Exporta todos os calculators para fácil importação
 * 
 * USO:
 * const { EntropyCalculatorV2, GEXCalculator } = require('./calculators');
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

module.exports = {
  // ========================================
  // ENTROPY & MARKET ANALYSIS (V2 - NEW!)
  // ========================================
  EntropyCalculatorV2: require('./EntropyCalculatorV2'),
  RSICalculatorV2: require('./RSICalculatorV2'),
  CombinedMarketAnalyzer: require('./CombinedMarketAnalyzer'),
  
  // ========================================
  // GEX & GAMMA
  // ========================================
  GEXCalculator: require('./GEXCalculator'),
  RegimeAnalyzer: require('./RegimeAnalyzer'),
  
  // ========================================
  // VOLATILITY
  // ========================================
  VolatilitySurfaceCalculator: require('./VolatilitySurfaceCalculator'),
  VolatilityAnomalyDetector: require('./VolatilityAnomalyDetector'),
  VolatilitySmileAnalyzer: require('./VolatilitySmileAnalyzer'),
  
  // ========================================
  // SENTIMENT & MAX PAIN
  // ========================================
  MaxPainCalculator: require('./MaxPainCalculator'),
  SentimentAnalyzer: require('./SentimentAnalyzer'),
  
  // ========================================
  // OPTIONS PRICING
  // ========================================
  BlackScholesCalculator: require('./BlackScholesCalculator'),
  ImpliedVolatilityCalculator: require('./ImpliedVolatilityCalculator'),
  GreeksCalculator: require('./GreeksCalculator'),
  
  // ========================================
  // TECHNICAL INDICATORS (Legacy)
  // ========================================
  EntropyCalculator: require('./EntropyCalculator'),        // V1 (legacy)
  RSICalculator: require('./RSICalculator'),                // V1 (legacy)
  
  // ========================================
  // MISC
  // ========================================
  // Adicione outros calculators aqui conforme necessário
};