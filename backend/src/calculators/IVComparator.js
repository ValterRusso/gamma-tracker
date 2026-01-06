/**
 * IVComparator.js
 * 
 * Compara métricas de IV entre Binance e Deribit
 * Detecta divergências, calcula Retail Panic Index, gera alertas
 * 
 * Uso:
 *   const comparator = new IVComparator(binanceAPI, deribitAPI, logger);
 *   const comparison = await comparator.compare(1); // 1 DTE
 */

class IVComparator {
  constructor(binanceAPI, deribitAPI, logger = console) {
    this.binanceAPI = binanceAPI;
    this.deribitAPI = deribitAPI;
    this.logger = logger;
    
    // Histórico de comparações (últimas 24h)
    this.history = [];
    this.maxHistorySize = 288; // 24h com updates a cada 5 min
    
    // Thresholds para alertas
    this.thresholds = {
      atmSpread: 10,        // pp (percentage points)
      putSpread: 15,        // pp
      callSpread: 10,       // pp
      skewSpread: 0.3,      // ratio
      retailPanicIndex: 120 // index value
    };
    
    this.logger.info('[IVComparator] Initialized');
  }

  /**
   * Compara IV metrics entre Binance e Deribit para um DTE específico
   */
  async compare(dte = 1) {
    try {
      this.logger.info(`[IVComparator] Starting comparison for ${dte} DTE`);
      
      // Buscar dados de ambas as fontes
      const [binanceMetrics, deribitMetrics] = await Promise.all([
        this.binanceAPI.getIVMetricsByDTE(dte),
        this.deribitAPI.getIVMetricsByDTE(dte)
      ]);
      
      // Validar dados
      if (!binanceMetrics) {
        this.logger.warn('[IVComparator] Binance metrics unavailable');
      }
      
      if (!deribitMetrics) {
        this.logger.warn('[IVComparator] Deribit metrics unavailable');
      }
      
      if (!binanceMetrics || !deribitMetrics) {
        return {
          success: false,
          error: 'One or both data sources unavailable',
          dte,
          timestamp: Date.now()
        };
      }
      
      // Calcular spreads
      const spreads = this.calculateSpreads(binanceMetrics, deribitMetrics);
      
      // Calcular Retail Panic Index
      const retailPanicIndex = this.calculateRetailPanicIndex(binanceMetrics, deribitMetrics);
      
      // Detectar divergências e gerar alertas
      const alerts = this.detectDivergences(spreads, retailPanicIndex, binanceMetrics, deribitMetrics);
      
      // Gerar insights
      const insights = this.generateInsights(spreads, retailPanicIndex, binanceMetrics, deribitMetrics, alerts);
      
      const comparison = {
        success: true,
        dte,
        timestamp: Date.now(),
        binance: binanceMetrics,
        deribit: deribitMetrics,
        spreads,
        retailPanicIndex,
        alerts,
        insights
      };
      
      // Adicionar ao histórico
      this.addToHistory(comparison);
      
      this.logger.info(`[IVComparator] Comparison complete: ${alerts.length} alerts, RPI=${retailPanicIndex.toFixed(1)}`);
      
      return comparison;
    } catch (error) {
      this.logger.error('[IVComparator] Comparison failed:', error.message);
      return {
        success: false,
        error: error.message,
        dte,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Calcula spreads entre Binance e Deribit
   * Spread positivo = Binance maior que Deribit
   */
  calculateSpreads(binance, deribit) {
    const atmSpread = binance.atmIV && deribit.atmIV
      ? binance.atmIV - deribit.atmIV
      : null;
    
    const putSpread = binance.otmPutIV && deribit.otmPutIV
      ? binance.otmPutIV - deribit.otmPutIV
      : null;
    
    const callSpread = binance.otmCallIV && deribit.otmCallIV
      ? binance.otmCallIV - deribit.otmCallIV
      : null;
    
    const skewSpread = binance.skewRatio && deribit.skewRatio
      ? binance.skewRatio - deribit.skewRatio
      : null;
    
    const pcSpread = binance.pcSpread && deribit.pcSpread
      ? binance.pcSpread - deribit.pcSpread
      : null;
    
    return {
      atmSpread,
      putSpread,
      callSpread,
      skewSpread,
      pcSpread,
      timestamp: Date.now()
    };
  }

  /**
   * Calcula Retail Panic Index
   * RPI = (Binance Put IV / Deribit Put IV) * 100
   * 
   * Interpretação:
   * - 100: Paridade (ambos precificam igual)
   * - > 100: Retail (Binance) pagando mais por proteção
   * - > 120: Pânico moderado no retail
   * - > 150: Pânico extremo (oportunidade de arbitragem)
   * - < 100: Incomum (retail pagando menos que profissionais)
   */
  calculateRetailPanicIndex(binance, deribit) {
    if (!binance.otmPutIV || !deribit.otmPutIV) {
      return null;
    }
    
    return (binance.otmPutIV / deribit.otmPutIV) * 100;
  }

  /**
   * Detecta divergências e gera alertas
   */
  detectDivergences(spreads, retailPanicIndex, binance, deribit) {
    const alerts = [];
    
    // Alert: ATM IV Spread
    if (spreads.atmSpread !== null && Math.abs(spreads.atmSpread) > this.thresholds.atmSpread) {
      alerts.push({
        type: 'ATM_DIVERGENCE',
        severity: Math.abs(spreads.atmSpread) > 15 ? 'HIGH' : 'MEDIUM',
        message: spreads.atmSpread > 0
          ? `Binance ATM IV ${spreads.atmSpread.toFixed(1)}pp above Deribit`
          : `Deribit ATM IV ${Math.abs(spreads.atmSpread).toFixed(1)}pp above Binance`,
        value: spreads.atmSpread,
        binanceValue: binance.atmIV,
        deribitValue: deribit.atmIV,
        timestamp: Date.now()
      });
    }
    
    // Alert: Put IV Spread (mais importante)
    if (spreads.putSpread !== null && Math.abs(spreads.putSpread) > this.thresholds.putSpread) {
      alerts.push({
        type: 'PUT_DIVERGENCE',
        severity: Math.abs(spreads.putSpread) > 25 ? 'HIGH' : 'MEDIUM',
        message: spreads.putSpread > 0
          ? `Binance Put IV ${spreads.putSpread.toFixed(1)}pp above Deribit - Retail panic detected`
          : `Deribit Put IV ${Math.abs(spreads.putSpread).toFixed(1)}pp above Binance - Institutional hedging`,
        value: spreads.putSpread,
        binanceValue: binance.otmPutIV,
        deribitValue: deribit.otmPutIV,
        timestamp: Date.now()
      });
    }
    
    // Alert: Call IV Spread
    if (spreads.callSpread !== null && Math.abs(spreads.callSpread) > this.thresholds.callSpread) {
      alerts.push({
        type: 'CALL_DIVERGENCE',
        severity: 'LOW',
        message: spreads.callSpread > 0
          ? `Binance Call IV ${spreads.callSpread.toFixed(1)}pp above Deribit`
          : `Deribit Call IV ${Math.abs(spreads.callSpread).toFixed(1)}pp above Binance`,
        value: spreads.callSpread,
        binanceValue: binance.otmCallIV,
        deribitValue: deribit.otmCallIV,
        timestamp: Date.now()
      });
    }
    
    // Alert: Retail Panic Index
    if (retailPanicIndex !== null && retailPanicIndex > this.thresholds.retailPanicIndex) {
      const severity = retailPanicIndex > 150 ? 'HIGH' : 'MEDIUM';
      alerts.push({
        type: 'RETAIL_PANIC',
        severity,
        message: `Retail Panic Index at ${retailPanicIndex.toFixed(1)} - Retail overpaying for protection`,
        value: retailPanicIndex,
        timestamp: Date.now()
      });
    }
    
    // Alert: Liquidity Gap (Binance missing data)
    if (!binance.otmCallIV && deribit.otmCallIV) {
      alerts.push({
        type: 'LIQUIDITY_GAP',
        severity: 'LOW',
        message: `Binance missing OTM calls (${binance.dte} DTE) - Use Deribit for OTM hedging`,
        timestamp: Date.now()
      });
    }
    
    // Alert: Skew Divergence
    if (spreads.skewSpread !== null && Math.abs(spreads.skewSpread) > this.thresholds.skewSpread) {
      alerts.push({
        type: 'SKEW_DIVERGENCE',
        severity: 'MEDIUM',
        message: spreads.skewSpread > 0
          ? `Binance skew ${spreads.skewSpread.toFixed(2)} higher than Deribit - Retail more bearish`
          : `Deribit skew ${Math.abs(spreads.skewSpread).toFixed(2)} higher than Binance - Institutions more bearish`,
        value: spreads.skewSpread,
        binanceValue: binance.skewRatio,
        deribitValue: deribit.skewRatio,
        timestamp: Date.now()
      });
    }
    
    return alerts;
  }

  /**
   * Gera insights de trading baseado na comparação
   */
  generateInsights(spreads, retailPanicIndex, binance, deribit, alerts) {
    const insights = [];
    
    // Insight: Arbitragem de IV
    if (spreads.putSpread !== null && spreads.putSpread > 20) {
      insights.push({
        type: 'ARBITRAGE_OPPORTUNITY',
        message: `Consider selling Binance puts / buying Deribit puts to capture ${spreads.putSpread.toFixed(1)}pp spread`,
        confidence: 'MEDIUM',
        risk: 'MEDIUM'
      });
    }
    
    // Insight: Retail overreaction
    if (retailPanicIndex !== null && retailPanicIndex > 130) {
      insights.push({
        type: 'RETAIL_OVERREACTION',
        message: `Retail panic index at ${retailPanicIndex.toFixed(1)} suggests overreaction - Consider fading retail sentiment`,
        confidence: 'MEDIUM',
        risk: 'HIGH'
      });
    }
    
    // Insight: Smart money positioning
    if (spreads.atmSpread !== null && spreads.atmSpread < -5) {
      insights.push({
        type: 'SMART_MONEY_POSITIONING',
        message: `Deribit (institutions) pricing ${Math.abs(spreads.atmSpread).toFixed(1)}pp more risk than Binance - Watch for move`,
        confidence: 'HIGH',
        risk: 'LOW'
      });
    }
    
    // Insight: Liquidez complementar
    if (!binance.otmCallIV && deribit.otmCallIV) {
      insights.push({
        type: 'LIQUIDITY_RECOMMENDATION',
        message: `Use Deribit for OTM call hedging (${deribit.otmCallsCount} strikes available vs 0 on Binance)`,
        confidence: 'HIGH',
        risk: 'LOW'
      });
    }
    
    // Insight: Convergência (situação normal)
    if (spreads.atmSpread !== null && Math.abs(spreads.atmSpread) < 5 && 
        retailPanicIndex !== null && retailPanicIndex < 110) {
      insights.push({
        type: 'MARKET_CONVERGENCE',
        message: `Binance and Deribit pricing aligned - No significant arbitrage opportunities`,
        confidence: 'HIGH',
        risk: 'LOW'
      });
    }
    
    return insights;
  }

  /**
   * Adiciona comparação ao histórico
   */
  addToHistory(comparison) {
    this.history.push({
      dte: comparison.dte,
      timestamp: comparison.timestamp,
      spreads: comparison.spreads,
      retailPanicIndex: comparison.retailPanicIndex,
      alertCount: comparison.alerts.length
    });
    
    // Limitar tamanho do histórico
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Retorna histórico de spreads
   */
  getSpreadHistory(dte = null, hours = 24) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    let filtered = this.history.filter(h => h.timestamp > cutoff);
    
    if (dte !== null) {
      filtered = filtered.filter(h => h.dte === dte);
    }
    
    return filtered;
  }

  /**
   * Compara múltiplos DTEs de uma vez
   */
  async compareMultipleDTE(dtes = [1, 2, 3, 7, 30]) {
    const results = {};
    
    for (const dte of dtes) {
      results[dte] = await this.compare(dte);
    }
    
    return results;
  }

  /**
   * Retorna estatísticas do comparador
   */
  getStats() {
    const recentComparisons = this.history.slice(-12); // Última hora (5min intervals)
    
    if (recentComparisons.length === 0) {
      return {
        comparisons: 0,
        avgRetailPanicIndex: null,
        avgAtmSpread: null,
        avgPutSpread: null,
        totalAlerts: 0
      };
    }
    
    const validRPI = recentComparisons.filter(c => c.retailPanicIndex !== null);
    const validAtm = recentComparisons.filter(c => c.spreads.atmSpread !== null);
    const validPut = recentComparisons.filter(c => c.spreads.putSpread !== null);
    
    return {
      comparisons: recentComparisons.length,
      avgRetailPanicIndex: validRPI.length > 0
        ? validRPI.reduce((sum, c) => sum + c.retailPanicIndex, 0) / validRPI.length
        : null,
      avgAtmSpread: validAtm.length > 0
        ? validAtm.reduce((sum, c) => sum + c.spreads.atmSpread, 0) / validAtm.length
        : null,
      avgPutSpread: validPut.length > 0
        ? validPut.reduce((sum, c) => sum + c.spreads.putSpread, 0) / validPut.length
        : null,
      totalAlerts: recentComparisons.reduce((sum, c) => sum + c.alertCount, 0)
    };
  }
}

module.exports = IVComparator;
