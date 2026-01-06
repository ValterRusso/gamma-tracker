/**
 * BinanceAdapter.js
 * 
 * Adapter que converte dados do DataCollector (Binance) para o formato
 * esperado pelo IVComparator
 * 
 * USO:
 *   const adapter = new BinanceAdapter(dataCollector, logger);
 *   const metrics = await adapter.getIVMetricsByDTE(1);
 */

class BinanceAdapter {
  constructor(dataCollector, logger = console) {
    this.dataCollector = dataCollector;
    this.logger = logger;
    
    this.logger.info('[BinanceAdapter] Initialized');
  }

  /**
   * Calcula DTE (Days To Expiry) a partir de uma data
   */
  calculateDTE(expiryDate) {
    const now = new Date();
    const expiry = expiryDate instanceof Date ? expiryDate : new Date(expiryDate);
    const diffMs = expiry - now;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return Math.max(0, diffDays);
  }

  /**
   * Busca IV metrics para um DTE específico
   * Retorna formato compatível com IVComparator
   */
  async getIVMetricsByDTE(targetDTE) {
    try {
      // Obter todas as options
      const allOptions = this.dataCollector.getAllOptions();
      
      if (allOptions.length === 0) {
        this.logger.warn('[BinanceAdapter] No options available');
        return null;
      }
      
      // Obter spot price
      const spotPrice = this.dataCollector.spotPrice;
      
      if (!spotPrice || spotPrice <= 0) {
        this.logger.warn('[BinanceAdapter] Invalid spot price');
        return null;
      }
      
      // Filtrar options por DTE (±0.5 dias de tolerância)
      const optionsWithDTE = allOptions.map(opt => ({
        ...opt,
        dte: this.calculateDTE(opt.expiryDate),
        moneyness: opt.strike / spotPrice
      })).filter(opt => 
        Math.abs(opt.dte - targetDTE) <= 0.5 &&
        opt.markIV !== null &&
        opt.markIV !== undefined &&
        opt.markIV > 0
      );
      
      if (optionsWithDTE.length === 0) {
        this.logger.warn(`[BinanceAdapter] No options found for DTE ${targetDTE}`);
        return null;
      }
      
      // Separar calls e puts
      const calls = optionsWithDTE.filter(opt => opt.side === 'CALL');
      const puts = optionsWithDTE.filter(opt => opt.side === 'PUT');
      
      // Encontrar ATM (closest to 100% moneyness)
      const atmOption = optionsWithDTE.reduce((closest, opt) => {
        const currentDiff = Math.abs(opt.moneyness - 1.0);
        const closestDiff = Math.abs(closest.moneyness - 1.0);
        return currentDiff < closestDiff ? opt : closest;
      });
      
      const atmIV = atmOption.markIV * 100; // Converter para %
      const atmStrike = atmOption.strike;
      
      // OTM Puts (< 97% moneyness)
      const otmPuts = puts.filter(opt => opt.moneyness < 0.97);
      const otmPutIV = otmPuts.length > 0
        ? (otmPuts.reduce((sum, opt) => sum + opt.markIV, 0) / otmPuts.length) * 100
        : null;
      
      // OTM Calls (> 103% moneyness)
      const otmCalls = calls.filter(opt => opt.moneyness > 1.03);
      const otmCallIV = otmCalls.length > 0
        ? (otmCalls.reduce((sum, opt) => sum + opt.markIV, 0) / otmCalls.length) * 100
        : null;
      
      // Skew Ratio
      const skewRatio = (otmPutIV && otmCallIV) 
        ? otmPutIV / otmCallIV 
        : null;
      
      // P-C Spread
      const pcSpread = (otmPutIV && otmCallIV)
        ? otmPutIV - otmCallIV
        : null;
      
      return {
        dte: targetDTE,
        spotPrice,
        atmStrike,
        atmIV,
        otmPutIV,
        otmCallIV,
        skewRatio,
        pcSpread,
        totalOptions: optionsWithDTE.length,
        callsCount: calls.length,
        putsCount: puts.length,
        otmCallsCount: otmCalls.length,
        otmPutsCount: otmPuts.length,
        timestamp: Date.now(),
        source: 'binance'
      };
    } catch (error) {
      this.logger.error(`[BinanceAdapter] Failed to get IV metrics for DTE ${targetDTE}:`, error.message);
      return null;
    }
  }

  /**
   * Busca IV metrics para múltiplos DTEs
   */
  async getIVMetricsMultipleDTE(dtes = [1, 2, 3, 7, 30]) {
    const results = {};
    
    for (const dte of dtes) {
      results[dte] = await this.getIVMetricsByDTE(dte);
    }
    
    return results;
  }

  /**
   * Busca IV surface completa (todas as options)
   * Formato similar ao DeribitAPI para facilitar comparação
   */
  async getIVSurface() {
    try {
      const allOptions = this.dataCollector.getAllOptions();
      const spotPrice = this.dataCollector.spotPrice;
      
      if (allOptions.length === 0 || !spotPrice || spotPrice <= 0) {
        this.logger.warn('[BinanceAdapter] Cannot build IV surface - no data');
        return null;
      }
      
      const surface = allOptions
        .filter(opt => opt.markIV !== null && opt.markIV !== undefined && opt.markIV > 0)
        .map(opt => ({
          strike: opt.strike,
          expiry: opt.expiryDate,
          dte: Math.round(this.calculateDTE(opt.expiryDate)),
          type: opt.side.toLowerCase(), // CALL -> call, PUT -> put
          iv: opt.markIV * 100, // Converter para %
          moneyness: opt.strike / spotPrice,
          volume: opt.volume || 0,
          openInterest: opt.openInterest || 0,
          bid: opt.bidPrice || 0,
          ask: opt.askPrice || 0,
          mark: opt.markPrice || 0,
          delta: opt.delta || null,
          gamma: opt.gamma || null,
          vega: opt.vega || null,
          theta: opt.theta || null,
          symbol: opt.symbol,
          timestamp: Date.now()
        }));
      
      return {
        spotPrice,
        timestamp: Date.now(),
        options: surface,
        source: 'binance'
      };
    } catch (error) {
      this.logger.error('[BinanceAdapter] Failed to build IV surface:', error.message);
      return null;
    }
  }

  /**
   * Retorna estatísticas básicas do adapter
   */
  getStats() {
    const allOptions = this.dataCollector.getAllOptions();
    const validIV = allOptions.filter(opt => opt.markIV && opt.markIV > 0);
    const expiries = this.dataCollector.getUniqueExpiries();
    
    return {
      totalOptions: allOptions.length,
      validIVCount: validIV.length,
      expiryCount: expiries.length,
      spotPrice: this.dataCollector.spotPrice,
      source: 'binance'
    };
  }
}

module.exports = BinanceAdapter;
