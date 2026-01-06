/**
 * DeribitAPI.js
 * 
 * Cliente para integração com Deribit API v2
 * Busca dados de options (IV, Greeks, order book) para comparação com Binance
 * 
 * Documentação: https://docs.deribit.com/
 */

const axios = require('axios');

class DeribitAPI {
  constructor(logger = console) {
    this.logger = logger;
    this.baseURL = 'https://www.deribit.com/api/v2';
    this.currency = 'BTC';
    
    // Cache para reduzir chamadas à API
    this.cache = {
      instruments: { data: null, timestamp: 0, ttl: 300000 }, // 5 min
      summary: { data: null, timestamp: 0, ttl: 10000 }        // 10 sec
    };
    
    // Rate limiting
    this.requestQueue = [];
    this.requestsPerSecond = 10; // Conservative (Deribit allows 20/s)
    this.lastRequestTime = 0;
    
    this.logger.info('[DeribitAPI] Initialized');
  }

  /**
   * Rate-limited request wrapper
   */
  async makeRequest(endpoint, params = {}) {
    // Rate limiting: mínimo 100ms entre requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / this.requestsPerSecond;
    
    if (timeSinceLastRequest < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
    }
    
    try {
      this.lastRequestTime = Date.now();
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.error) {
        throw new Error(`Deribit API Error: ${response.data.error.message}`);
      }
      
      return response.data.result;
    } catch (error) {
      this.logger.error('[DeribitAPI] Request failed:', {
        endpoint,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Busca lista de instrumentos (options) disponíveis
   */
  async getInstruments(expired = false) {
    const cacheKey = 'instruments';
    const now = Date.now();
    
    // Check cache
    if (this.cache[cacheKey].data && (now - this.cache[cacheKey].timestamp) < this.cache[cacheKey].ttl) {
      return this.cache[cacheKey].data;
    }
    
    try {
      const result = await this.makeRequest('/public/get_instruments', {
        currency: this.currency,
        kind: 'option',
        expired
      });
      
      // Update cache
      this.cache[cacheKey] = {
        data: result,
        timestamp: now,
        ttl: this.cache[cacheKey].ttl
      };
      
      this.logger.info(`[DeribitAPI] Fetched ${result.length} instruments`);
      return result;
    } catch (error) {
      this.logger.error('[DeribitAPI] Failed to fetch instruments:', error.message);
      return [];
    }
  }

  /**
   * Busca resumo de todos os options (book summary)
   * Retorna bid, ask, volume, IV, Greeks, etc
   */
  async getBookSummary() {
    const cacheKey = 'summary';
    const now = Date.now();
    
    // Check cache
    if (this.cache[cacheKey].data && (now - this.cache[cacheKey].timestamp) < this.cache[cacheKey].ttl) {
      return this.cache[cacheKey].data;
    }
    
    try {
      const result = await this.makeRequest('/public/get_book_summary_by_currency', {
        currency: this.currency,
        kind: 'option'
      });
      
      // Update cache
      this.cache[cacheKey] = {
        data: result,
        timestamp: now,
        ttl: this.cache[cacheKey].ttl
      };
      
      this.logger.info(`[DeribitAPI] Fetched book summary for ${result.length} options`);
      return result;
    } catch (error) {
      this.logger.error('[DeribitAPI] Failed to fetch book summary:', error.message);
      return [];
    }
  }

  /**
   * Busca índice BTC (spot price da Deribit)
   */
  async getIndex() {
    try {
      const result = await this.makeRequest('/public/get_index_price', {
        index_name: 'btc_usd'
      });
      
      return {
        price: result.index_price,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('[DeribitAPI] Failed to fetch index:', error.message);
      return null;
    }
  }

  /**
   * Parse instrument name para extrair detalhes
   * Formato: BTC-5JAN25-96000-C
   */
  parseInstrumentName(instrumentName) {
    const parts = instrumentName.split('-');
    if (parts.length !== 4) return null;
    
    const [currency, expiry, strikeStr, type] = parts;
    
    return {
      currency,
      expiry,
      strike: parseInt(strikeStr),
      type: type === 'C' ? 'call' : 'put',
      instrumentName
    };
  }

  /**
   * Calcula DTE (Days To Expiry) a partir da data de expiração
   * Formato expiry: 5JAN25, 10FEB25, etc
   */
  calculateDTE(expiryStr) {
    try {
      // Parse: 5JAN25 -> 2025-01-05
      const day = parseInt(expiryStr.slice(0, -5));
      const monthStr = expiryStr.slice(-5, -2);
      const year = 2000 + parseInt(expiryStr.slice(-2));
      
      const months = {
        'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
        'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
      };
      
      const expiryDate = new Date(year, months[monthStr], day, 8, 0, 0); // 8am UTC
      const now = new Date();
      const diffMs = expiryDate - now;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      
      return Math.max(0, diffDays);
    } catch (error) {
      this.logger.error('[DeribitAPI] Failed to parse expiry:', expiryStr);
      return null;
    }
  }

  /**
   * Busca IV Surface organizada por DTE e strike
   * Retorna estrutura similar à da Binance para facilitar comparação
   */
  async getIVSurface() {
    try {
      const summary = await this.getBookSummary();
      const index = await this.getIndex();
      
      if (!index) {
        throw new Error('Failed to fetch spot price');
      }
      
      const spotPrice = index.price;
      const surface = [];
      
      for (const option of summary) {
        const parsed = this.parseInstrumentName(option.instrument_name);
        if (!parsed) continue;
        
        const dte = this.calculateDTE(parsed.expiry);
        if (dte === null || dte < 0) continue;
        
        // Calcular moneyness
        const moneyness = parsed.strike / spotPrice;
        
        // Extrair IV (mark_iv já vem em %, ex: 65.5 = 65.5%)
        const iv = option.mark_iv ? option.mark_iv : null;
        
        if (iv === null || iv <= 0) continue;
        
        surface.push({
          strike: parsed.strike,
          expiry: parsed.expiry,
          dte: Math.round(dte),
          type: parsed.type,
          iv,
          moneyness,
          volume: option.volume || 0,
          openInterest: option.open_interest || 0,
          bid: option.bid_price || 0,
          ask: option.ask_price || 0,
          mark: option.mark_price || 0,
          delta: option.greeks?.delta || null,
          gamma: option.greeks?.gamma || null,
          vega: option.greeks?.vega || null,
          theta: option.greeks?.theta || null,
          instrumentName: option.instrument_name,
          timestamp: Date.now()
        });
      }
      
      this.logger.info(`[DeribitAPI] Processed ${surface.length} options for IV surface`);
      
      return {
        spotPrice,
        timestamp: Date.now(),
        options: surface
      };
    } catch (error) {
      this.logger.error('[DeribitAPI] Failed to build IV surface:', error.message);
      return null;
    }
  }

  /**
   * Busca IV metrics para um DTE específico
   * Calcula ATM IV, OTM Put IV, OTM Call IV, Skew
   */
  async getIVMetricsByDTE(targetDTE) {
    try {
      const surface = await this.getIVSurface();
      if (!surface) return null;
      
      // Filtrar options do DTE target (±0.5 dias de tolerância)
      const options = surface.options.filter(opt => 
        Math.abs(opt.dte - targetDTE) <= 0.5
      );
      
      if (options.length === 0) {
        this.logger.warn(`[DeribitAPI] No options found for DTE ${targetDTE}`);
        return null;
      }
      
      // Separar calls e puts
      const calls = options.filter(opt => opt.type === 'call');
      const puts = options.filter(opt => opt.type === 'put');
      
      // Encontrar ATM (closest to 100% moneyness)
      const allOptions = [...calls, ...puts];
      const atmOption = allOptions.reduce((closest, opt) => {
        const currentDiff = Math.abs(opt.moneyness - 1.0);
        const closestDiff = Math.abs(closest.moneyness - 1.0);
        return currentDiff < closestDiff ? opt : closest;
      });
      
      const atmIV = atmOption.iv;
      const atmStrike = atmOption.strike;
      
      // OTM Puts (< 97% moneyness)
      const otmPuts = puts.filter(opt => opt.moneyness < 0.97);
      const otmPutIV = otmPuts.length > 0
        ? otmPuts.reduce((sum, opt) => sum + opt.iv, 0) / otmPuts.length
        : null;
      
      // OTM Calls (> 103% moneyness)
      const otmCalls = calls.filter(opt => opt.moneyness > 1.03);
      const otmCallIV = otmCalls.length > 0
        ? otmCalls.reduce((sum, opt) => sum + opt.iv, 0) / otmCalls.length
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
        spotPrice: surface.spotPrice,
        atmStrike,
        atmIV,
        otmPutIV,
        otmCallIV,
        skewRatio,
        pcSpread,
        totalOptions: options.length,
        callsCount: calls.length,
        putsCount: puts.length,
        otmCallsCount: otmCalls.length,
        otmPutsCount: otmPuts.length,
        timestamp: Date.now(),
        source: 'deribit'
      };
    } catch (error) {
      this.logger.error(`[DeribitAPI] Failed to get IV metrics for DTE ${targetDTE}:`, error.message);
      return null;
    }
  }

  /**
   * Busca múltiplos DTEs de uma vez
   */
  async getIVMetricsMultipleDTE(dtes = [1, 2, 3, 7, 30]) {
    const results = {};
    
    for (const dte of dtes) {
      results[dte] = await this.getIVMetricsByDTE(dte);
    }
    
    return results;
  }

  /**
   * Limpa cache manualmente
   */
  clearCache() {
    this.cache.instruments = { data: null, timestamp: 0, ttl: this.cache.instruments.ttl };
    this.cache.summary = { data: null, timestamp: 0, ttl: this.cache.summary.ttl };
    this.logger.info('[DeribitAPI] Cache cleared');
  }
}

module.exports = DeribitAPI;
