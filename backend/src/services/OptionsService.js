/**
 * ============================================================================
 * OPTIONS SERVICE
 * ============================================================================
 * 
 * Business logic para acesso aos dados de opções
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

class OptionsService {
  constructor(dataCollector) {
    this.dataCollector = dataCollector;
  }

  /**
   * Get all options
   */
  async getAllOptions() {
    const options = this.dataCollector.getAllOptions();
    
    if (!options) {
      throw new Error('Options data not available');
    }
    
    // Convert to JSON if needed
    const optionsData = options.map(opt => 
      typeof opt.toJSON === 'function' ? opt.toJSON() : opt
    );
    
    return {
      options: optionsData,
      count: optionsData.length
    };
  }

  /**
   * Get options by strike
   * @param {number} strike - Strike price
   */
  async getOptionsByStrike(strike) {
    const options = this.dataCollector.getOptionsByStrike(strike);
    
    if (!options) {
      return {
        options: [],
        count: 0
      };
    }
    
    // Convert to JSON if needed
    const optionsData = options.map(opt => 
      typeof opt.toJSON === 'function' ? opt.toJSON() : opt
    );
    
    return {
      options: optionsData,
      count: optionsData.length
    };
  }

  /**
   * Get unique strikes
   */
  async getStrikes() {
    const strikes = this.dataCollector.getUniqueStrikes();
    
    if (!strikes) {
      return {
        strikes: [],
        count: 0
      };
    }
    
    return {
      strikes: strikes,
      count: strikes.length
    };
  }

  /**
   * Get unique expiries
   */
  async getExpiries() {
    const expiries = this.dataCollector.getUniqueExpiries();
    
    if (!expiries) {
      return {
        expiries: [],
        count: 0
      };
    }
    
    return {
      expiries: expiries,
      count: expiries.length
    };
  }

  /**
   * Get current spot price
   * Extracts from the most recent option data
   */
  async getCurrentSpot() {
    const options = this.dataCollector.getAllOptions();
    
    if (!options || options.length === 0) {
      throw new Error('No options data available to extract spot price');
    }
    
    // Get spot price from first option (they all have the same spot)
    const firstOption = options[0];
    const spot = firstOption.underlyingPrice || firstOption.spot || firstOption.spotPrice;
    
    if (!spot) {
      throw new Error('Spot price not found in options data');
    }
    
    return spot;
  }
}

module.exports = OptionsService;