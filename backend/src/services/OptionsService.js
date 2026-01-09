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
}

module.exports = OptionsService;