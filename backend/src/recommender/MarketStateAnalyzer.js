/**
 * Market State Analyzer
 * 
 * Analisa o estado atual do mercado para determinar quais estratégias
 * de opções são mais adequadas.
 */

class MarketStateAnalyzer {
  constructor(marketData, volData, anomalies) {
    this.marketData = marketData;
    this.volData = volData;
    // Filtrar nulls e undefined do array de anomalias
    this.anomalies = (anomalies || []).filter(a => a != null && typeof a === 'object');
  }
  
  /**
   * Analisa todos os aspectos do mercado e retorna um objeto com o estado
   */
  analyze() {
    return {
      regime: this.analyzeRegime(),
      volatility: this.analyzeVolatility(),
      skew: this.analyzeSkew(),
      gex: this.analyzeGEX(),
      maxPainDistance: this.analyzeMaxPainDistance(),
      sentiment: this.analyzeSentiment(),
      anomalies: this.detectAnomalies()
    };
  }
  
  /**
   * Analisa o regime de mercado (já calculado no backend)
   */
  analyzeRegime() {
    return this.marketData.regime || 'NEUTRAL';
  }
  
  /**
   * Analisa o nível de volatilidade implícita
   * Calcula IV Rank baseado no histórico
   */
  analyzeVolatility() {
    if (!this.volData || !this.volData.length) {
      return 'MEDIUM';
    }
    
    // Calcular IV médio atual
    const currentIV = this.volData.reduce((sum, point) => sum + point.avgIV, 0) / this.volData.length;
    
    // Para simplificar, vamos usar thresholds fixos
    // Em produção, você calcularia IV Rank baseado em histórico de 30-60 dias
    if (currentIV < 0.5) return 'LOW';      // IV < 50%
    if (currentIV < 0.8) return 'MEDIUM';   // IV 50-80%
    return 'HIGH';                          // IV > 80%
  }
  
  /**
   * Analisa o skew de volatilidade (Put Skew vs Call Skew)
   */
  analyzeSkew() {
    if (!this.volData || !this.volData.length) {
      return 'FLAT';
    }
    
    // Calcular IV médio de puts vs calls
    let totalPutIV = 0;
    let totalCallIV = 0;
    let putCount = 0;
    let callCount = 0;
    
    this.volData.forEach(point => {
      if (point.putIV) {
        totalPutIV += point.putIV;
        putCount++;
      }
      if (point.callIV) {
        totalCallIV += point.callIV;
        callCount++;
      }
    });
    
    if (putCount === 0 || callCount === 0) {
      return 'FLAT';
    }
    
    const avgPutIV = totalPutIV / putCount;
    const avgCallIV = totalCallIV / callCount;
    const diff = avgPutIV - avgCallIV;
    
    // Threshold de 5% para considerar skew significativo
    if (Math.abs(diff) < 0.05) return 'FLAT';
    if (diff > 0.05) return 'PUT_SKEW';
    return 'CALL_SKEW';
  }
  
  /**
   * Analisa o GEX (Gamma Exposure)
   */
  analyzeGEX() {
    const totalGEX = this.marketData.total_gex || 0;
    return totalGEX >= 0 ? 'POSITIVE' : 'NEGATIVE';
  }
  
  /**
   * Calcula a distância percentual entre spot e max pain
   */
  analyzeMaxPainDistance() {
    // Usar o campo max_pain_distance que já é calculado no backend
    return this.marketData.max_pain_distance || 0;
  }
  
  /**
   * Analisa o sentiment do mercado (Put/Call ratios)
   */
  analyzeSentiment() {
    return {
      putCallRatio: this.marketData.put_call_oi_ratio || 1.0,
      divergence: this.marketData.divergence_exists || false
    };
  }
  
  /**
   * Detecta anomalias recentes
   */
  detectAnomalies() {
    if (!this.anomalies || !Array.isArray(this.anomalies)) {
      return [];
    }
    
    // Retornar array de tipos de anomalias (Sequelize retorna em camelCase)
    return this.anomalies
      .filter(a => a && a.anomalyType)  // Filtrar anomalias válidas (camelCase!)
      .map(a => a.anomalyType);         // Usar campo em camelCase
  }
  
  /**
   * Calcula o percentil de um valor em um array histórico
   */
  calculatePercentile(value, history) {
    if (!history || history.length === 0) {
      return 50; // Default to median
    }
    
    const sorted = [...history].sort((a, b) => a - b);
    const index = sorted.findIndex(v => v >= value);
    
    if (index === -1) return 100;
    return (index / sorted.length) * 100;
  }
}

module.exports = MarketStateAnalyzer;
