/**
 * VolatilityAnomalyDetector
 * 
 * Detecta anomalias estatísticas na superfície de volatilidade implícita.
 * Identifica strikes com IV significativamente fora do padrão esperado,
 * considerando skew natural, volume/OI, e características de cada vencimento.
 * 
 * Melhorias implementadas:
 * - Usa avgIV, callIV e putIV separadamente
 * - Detecta skew anômalo (Put-Call spread fora do normal)
 * - Pondera anomalias por volume e open interest
 * - Identifica wings naturais vs anomalias reais
 * - Calcula IV esperado baseado em interpolação de vizinhos
 */

class VolatilityAnomalyDetector {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Detecta anomalias na volatility surface
   * @param {Object} surfaceData - Dados da superfície (retorno de buildVolSurface)
   * @param {number} threshold - Z-score threshold (padrão: 2.0)
   * @returns {Array} Array de anomalias detectadas
   */
  detectAnomalies(surfaceData, threshold = 2.0) {
    const anomalies = [];
    
    if (!surfaceData || !surfaceData.points || surfaceData.points.length === 0) {
      this.logger.warn('[AnomalyDetector] Dados insuficientes para detecção');
      return anomalies;
    }

    // Agrupar pontos por DTE
    const byDTE = this.groupByDTE(surfaceData.points);
    
    // Analisar cada vencimento separadamente
    byDTE.forEach((points, dte) => {
      if (points.length < 5) {
        this.logger.debug(`[AnomalyDetector] DTE ${dte}: poucos pontos (${points.length}), pulando`);
        return;
      }
      
      // Detectar anomalias de IV absoluto
      const ivAnomalies = this.detectIVAnomalies(points, dte, threshold);
      anomalies.push(...ivAnomalies);
      
      // Detectar anomalias de skew (Put-Call spread)
      const skewAnomalies = this.detectSkewAnomalies(points, dte, threshold);
      anomalies.push(...skewAnomalies);
    });
    
    // Ordenar por severidade (z-score absoluto) e relevância (volume/OI)
    anomalies.sort((a, b) => {
      const scoreA = Math.abs(a.zScore) * (1 + Math.log10(1 + a.relevanceScore));
      const scoreB = Math.abs(b.zScore) * (1 + Math.log10(1 + b.relevanceScore));
      return scoreB - scoreA;
    });
    
    this.logger.info(`[AnomalyDetector] Detectadas ${anomalies.length} anomalias (threshold: ${threshold})`);
    
    return anomalies;
  }

  /**
   * Agrupa pontos por DTE
   */
  groupByDTE(points) {
    const byDTE = new Map();
    
    points.forEach(point => {
      if (!byDTE.has(point.dte)) {
        byDTE.set(point.dte, []);
      }
      byDTE.get(point.dte).push(point);
    });
    
    return byDTE;
  }

  /**
   * Detecta anomalias de IV absoluto (outliers na curva de skew)
   */
  detectIVAnomalies(points, dte, threshold) {
    const anomalies = [];
    
    // Ordenar por moneyness
    const sortedPoints = [...points].sort((a, b) => a.moneyness - b.moneyness);
    
    // Calcular estatísticas de avgIV
    const avgIVs = sortedPoints.map(p => p.avgIV).filter(iv => iv !== null);
    if (avgIVs.length < 5) return anomalies;
    
    const stats = this.calculateStats(avgIVs);
    
    // Detectar outliers
    sortedPoints.forEach((point, index) => {
      if (point.avgIV === null) return;
      
      const zScore = (point.avgIV - stats.mean) / stats.stdDev;
      
      if (Math.abs(zScore) > threshold) {
        // Verificar se é wing natural (extremos da curva)
        const isWing = index < 2 || index >= sortedPoints.length - 2;
        
        // Calcular IV esperado baseado em vizinhos
        const expectedIV = this.calculateExpectedIV(sortedPoints, index);
        const deviation = point.avgIV - expectedIV;
        const deviationPct = (deviation / expectedIV) * 100;
        
        // Calcular relevância baseada em volume e OI
        const relevanceScore = this.calculateRelevance(point);
        
        // Determinar severidade
        const severity = this.calculateSeverity(zScore, relevanceScore, isWing);
        
        // Calculate OI/Volume ratio
        const oiVolRatio = point.volume > 0 ? (point.openInterest || 0) / point.volume : null;
        
        // Calculate spread percentage (from bid/ask if available)
        const spreadPct = point.bidPrice && point.askPrice && point.askPrice > 0
          ? ((point.askPrice - point.bidPrice) / point.askPrice) * 100
          : null;
        
        anomalies.push({
          type: 'IV_OUTLIER',
          strike: point.strike,
          dte: point.dte,
          moneyness: parseFloat(point.moneyness.toFixed(4)),
          iv: parseFloat(point.avgIV.toFixed(4)),
          callIV: point.callIV ? parseFloat(point.callIV.toFixed(4)) : null,
          putIV: point.putIV ? parseFloat(point.putIV.toFixed(4)) : null,
          expectedIV: parseFloat(expectedIV.toFixed(4)),
          deviation: parseFloat(deviation.toFixed(4)),
          deviationPct: parseFloat(deviationPct.toFixed(2)),
          zScore: parseFloat(zScore.toFixed(2)),
          severity,
          priceType: zScore > 0 ? 'OVERPRICED' : 'UNDERPRICED',
          isWing,
          relevanceScore: parseFloat(relevanceScore.toFixed(2)),
          volume: point.volume || 0,
          openInterest: point.openInterest || 0,
          oiVolumeRatio: oiVolRatio ? parseFloat(oiVolRatio.toFixed(2)) : null,
          spreadPct: spreadPct ? parseFloat(spreadPct.toFixed(2)) : null,
          bidPrice: point.bidPrice || null,
          askPrice: point.askPrice || null,
          expiryDate: point.expiryDate
        });
      }
    });
    
    return anomalies;
  }

  /**
   * Detecta anomalias de skew (Put-Call spread anormal)
   */
  detectSkewAnomalies(points, dte, threshold) {
    const anomalies = [];
    
    // Filtrar pontos que têm tanto call quanto put IV
    const pairsWithBoth = points.filter(p => p.callIV !== null && p.putIV !== null);
    if (pairsWithBoth.length < 5) return anomalies;
    
    // Calcular Put-Call spread para cada ponto
    const spreads = pairsWithBoth.map(p => ({
      point: p,
      spread: p.putIV - p.callIV,
      spreadPct: ((p.putIV - p.callIV) / p.callIV) * 100
    }));
    
    // Estatísticas do spread
    const spreadValues = spreads.map(s => s.spread);
    const stats = this.calculateStats(spreadValues);
    
    // Detectar spreads anômalos
    spreads.forEach(({ point, spread, spreadPct }) => {
      const zScore = (spread - stats.mean) / stats.stdDev;
      
      if (Math.abs(zScore) > threshold) {
        const relevanceScore = this.calculateRelevance(point);
        const severity = this.calculateSeverity(zScore, relevanceScore, false);
        
        // Calculate OI/Volume ratio
        const oiVolRatio = point.volume > 0 ? (point.openInterest || 0) / point.volume : null;
        
        // Calculate bid/ask spread percentage
        const bidAskSpreadPct = point.bidPrice && point.askPrice && point.askPrice > 0
          ? ((point.askPrice - point.bidPrice) / point.askPrice) * 100
          : null;
        
        anomalies.push({
          type: 'SKEW_ANOMALY',
          strike: point.strike,
          dte: point.dte,
          moneyness: parseFloat(point.moneyness.toFixed(4)),
          callIV: parseFloat(point.callIV.toFixed(4)),
          putIV: parseFloat(point.putIV.toFixed(4)),
          spread: parseFloat(spread.toFixed(4)),
          spreadPct: parseFloat(spreadPct.toFixed(2)),
          expectedSpread: parseFloat(stats.mean.toFixed(4)),
          zScore: parseFloat(zScore.toFixed(2)),
          severity,
          skewType: spread > stats.mean ? 'PUT_PREMIUM' : 'CALL_PREMIUM',
          relevanceScore: parseFloat(relevanceScore.toFixed(2)),
          volume: point.volume || 0,
          openInterest: point.openInterest || 0,
          oiVolumeRatio: oiVolRatio ? parseFloat(oiVolRatio.toFixed(2)) : null,
          spreadPct: bidAskSpreadPct ? parseFloat(bidAskSpreadPct.toFixed(2)) : null,
          bidPrice: point.bidPrice || null,
          askPrice: point.askPrice || null,
          expiryDate: point.expiryDate
        });
      }
    });
    
    return anomalies;
  }

  /**
   * Calcula estatísticas básicas (média, desvio padrão)
   */
  calculateStats(values) {
    const n = values.length;
    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    return { mean, stdDev, variance, n };
  }

  /**
   * Calcula IV esperado baseado em interpolação de vizinhos
   */
  calculateExpectedIV(sortedPoints, index) {
    const point = sortedPoints[index];
    
    // Se está no início ou fim, usar média geral
    if (index === 0 || index === sortedPoints.length - 1) {
      const validIVs = sortedPoints.map(p => p.avgIV).filter(iv => iv !== null);
      return validIVs.reduce((sum, iv) => sum + iv, 0) / validIVs.length;
    }
    
    // Interpolação linear entre vizinhos
    const prev = sortedPoints[index - 1];
    const next = sortedPoints[index + 1];
    
    if (prev.avgIV !== null && next.avgIV !== null) {
      // Interpolação ponderada por distância de moneyness
      const totalDist = next.moneyness - prev.moneyness;
      const distFromPrev = point.moneyness - prev.moneyness;
      const weight = distFromPrev / totalDist;
      
      return prev.avgIV + (next.avgIV - prev.avgIV) * weight;
    }
    
    // Fallback: média dos vizinhos válidos
    const neighbors = [prev, next].filter(p => p.avgIV !== null);
    if (neighbors.length > 0) {
      return neighbors.reduce((sum, p) => sum + p.avgIV, 0) / neighbors.length;
    }
    
    // Último fallback: média geral
    const validIVs = sortedPoints.map(p => p.avgIV).filter(iv => iv !== null);
    return validIVs.reduce((sum, iv) => sum + iv, 0) / validIVs.length;
  }

  /**
   * Calcula relevância baseada em volume e open interest
   * Retorna score de 0-100
   */
  calculateRelevance(point) {
    const volume = point.volume || 0;
    const oi = point.openInterest || 0;
    
    // Score baseado em log para evitar dominância de valores extremos
    const volumeScore = volume > 0 ? Math.log10(1 + volume) * 10 : 0;
    const oiScore = oi > 0 ? Math.log10(1 + oi) * 10 : 0;
    
    // Média ponderada (OI tem peso maior que volume)
    const relevance = (volumeScore * 0.3 + oiScore * 0.7);
    
    return Math.min(relevance, 100); // Cap em 100
  }

  /**
   * Calcula severidade da anomalia
   */
  calculateSeverity(zScore, relevanceScore, isWing) {
    const absZ = Math.abs(zScore);
    
    // Wings naturalmente têm IV alto, então são menos severos
    if (isWing && absZ < 3.5) {
      return 'LOW';
    }
    
    // Anomalias com alta relevância (volume/OI) são mais severas
    if (absZ > 3 && relevanceScore > 30) {
      return 'CRITICAL';
    }
    
    if (absZ > 3) {
      return 'HIGH';
    }
    
    if (absZ > 2.5 || (absZ > 2 && relevanceScore > 20)) {
      return 'MEDIUM';
    }
    
    return 'LOW';
  }

  /**
   * Gera estatísticas agregadas das anomalias
   */
  generateStats(anomalies) {
    return {
      total: anomalies.length,
      byType: {
        ivOutlier: anomalies.filter(a => a.type === 'IV_OUTLIER').length,
        skewAnomaly: anomalies.filter(a => a.type === 'SKEW_ANOMALY').length
      },
      bySeverity: {
        critical: anomalies.filter(a => a.severity === 'CRITICAL').length,
        high: anomalies.filter(a => a.severity === 'HIGH').length,
        medium: anomalies.filter(a => a.severity === 'MEDIUM').length,
        low: anomalies.filter(a => a.severity === 'LOW').length
      },
      byPriceType: {
        overpriced: anomalies.filter(a => a.priceType === 'OVERPRICED').length,
        underpriced: anomalies.filter(a => a.priceType === 'UNDERPRICED').length
      },
      avgRelevance: anomalies.length > 0
        ? anomalies.reduce((sum, a) => sum + a.relevanceScore, 0) / anomalies.length
        : 0
    };
  }
}

module.exports = VolatilityAnomalyDetector;