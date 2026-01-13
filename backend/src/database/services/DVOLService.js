/**
 * DVOLService.js - Deribit Volatility Index (DVOL) Service
 * 
 * Fetches volatility index data from Deribit API
 * DVOL is similar to VIX - measures 30-day implied volatility
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 */

const axios = require('axios');

const DERIBIT_API_BASE = 'https://www.deribit.com/api/v2';

class DVOLService {
  /**
   * Get current DVOL for a currency
   * @param {string} currency - 'BTC' or 'ETH'
   * @returns {Promise<Object>} Current DVOL data
   */
  async getCurrentDVOL(currency = 'BTC') {
    try {
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000); // 1 hour ago
      
      const response = await axios.get(`${DERIBIT_API_BASE}/public/get_volatility_index_data`, {
        params: {
          currency: currency.toUpperCase(),
          start_timestamp: oneHourAgo,
          end_timestamp: now,
          resolution: '60' // 1 minute resolution
        }
      });

      if (!response.data || !response.data.result || !response.data.result.data) {
        throw new Error('Invalid response from Deribit API');
      }

      const data = response.data.result.data;
      
      if (data.length === 0) {
        throw new Error('No DVOL data available');
      }

      // Get the most recent data point
      const latest = data[data.length - 1];
      const [timestamp, open, high, low, close] = latest;

      // Calculate 24h change if we have enough data
      let change24h = 0;
      let changePercent24h = 0;
      
      if (data.length > 1) {
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        const dayAgoData = data.find(d => d[0] >= oneDayAgo);
        
        if (dayAgoData) {
          const dayAgoClose = dayAgoData[4];
          change24h = close - dayAgoClose;
          changePercent24h = (change24h / dayAgoClose) * 100;
        }
      }

      return {
        currency,
        timestamp,
        volatility: close,
        open,
        high,
        low,
        close,
        change24h,
        changePercent24h
      };
    } catch (error) {
      console.error(`[DVOLService] Error fetching current DVOL for ${currency}:`, error.message);
      throw error;
    }
  }

  /**
   * Get historical DVOL data
   * @param {string} currency - 'BTC' or 'ETH'
   * @param {string} timeframe - '7d', '30d', or '90d'
   * @returns {Promise<Array>} Historical DVOL data points
   */
  async getHistoricalDVOL(currency = 'BTC', timeframe = '7d') {
    try {
      const now = Date.now();
      let startTime;
      let resolution;

      // Determine start time and resolution based on timeframe
      switch (timeframe) {
        case '7d':
          startTime = now - (7 * 24 * 60 * 60 * 1000);
          resolution = '3600'; // 1 hour
          break;
        case '30d':
          startTime = now - (30 * 24 * 60 * 60 * 1000);
          resolution = '43200'; // 12 hours
          break;
        case '90d':
          startTime = now - (90 * 24 * 60 * 60 * 1000);
          resolution = '1D'; // 1 day
          break;
        default:
          startTime = now - (7 * 24 * 60 * 60 * 1000);
          resolution = '3600';
      }

      const response = await axios.get(`${DERIBIT_API_BASE}/public/get_volatility_index_data`, {
        params: {
          currency: currency.toUpperCase(),
          start_timestamp: startTime,
          end_timestamp: now,
          resolution
        }
      });

      if (!response.data || !response.data.result || !response.data.result.data) {
        throw new Error('Invalid response from Deribit API');
      }

      const data = response.data.result.data;

      // Transform data to our format
      return data.map(([timestamp, open, high, low, close]) => ({
        timestamp,
        volatility: close,
        open,
        high,
        low,
        close
      }));
    } catch (error) {
      console.error(`[DVOLService] Error fetching historical DVOL for ${currency} (${timeframe}):`, error.message);
      throw error;
    }
  }

  /**
   * Get DVOL for both BTC and ETH
   * @returns {Promise<Object>} Current DVOL for both currencies
   */
  async getCurrentDVOLBoth() {
    try {
      const [btc, eth] = await Promise.all([
        this.getCurrentDVOL('BTC'),
        this.getCurrentDVOL('ETH')
      ]);

      return {
        btc,
        eth,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[DVOLService] Error fetching DVOL for both currencies:', error.message);
      throw error;
    }
  }

  /**
   * Get historical DVOL for both BTC and ETH
   * @param {string} timeframe - '7d', '30d', or '90d'
   * @returns {Promise<Object>} Historical DVOL for both currencies
   */
  async getHistoricalDVOLBoth(timeframe = '7d') {
    try {
      const [btc, eth] = await Promise.all([
        this.getHistoricalDVOL('BTC', timeframe),
        this.getHistoricalDVOL('ETH', timeframe)
      ]);

      return {
        btc,
        eth,
        timeframe
      };
    } catch (error) {
      console.error(`[DVOLService] Error fetching historical DVOL for both currencies (${timeframe}):`, error.message);
      throw error;
    }
  }

  /**
   * Calculate IV percentile (where current IV sits in historical range)
   * @param {number} currentIV - Current implied volatility
   * @param {Array} historicalData - Array of historical data points
   * @returns {number} Percentile (0-100)
   */
  calculateIVPercentile(currentIV, historicalData) {
    if (!historicalData || historicalData.length === 0) {
      return 50; // Default to middle if no data
    }

    const values = historicalData.map(d => d.volatility).sort((a, b) => a - b);
    const belowCount = values.filter(v => v < currentIV).length;
    const percentile = (belowCount / values.length) * 100;

    return Math.round(percentile * 10) / 10; // Round to 1 decimal
  }

  /**
   * Calculate IV rank (current IV vs 52-week high/low)
   * @param {number} currentIV - Current implied volatility
   * @param {Array} historicalData - Array of historical data points (should be 52 weeks)
   * @returns {Object} IV rank data
   */
  calculateIVRank(currentIV, historicalData) {
    if (!historicalData || historicalData.length === 0) {
      return {
        rank: 50,
        high52w: currentIV,
        low52w: currentIV
      };
    }

    const values = historicalData.map(d => d.volatility);
    const high52w = Math.max(...values);
    const low52w = Math.min(...values);
    const range = high52w - low52w;
    
    const rank = range > 0 ? ((currentIV - low52w) / range) * 100 : 50;

    return {
      rank: Math.round(rank * 10) / 10,
      high52w: Math.round(high52w * 1000) / 1000,
      low52w: Math.round(low52w * 1000) / 1000
    };
  }
}

module.exports = new DVOLService();
