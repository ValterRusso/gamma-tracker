const Logger = require('../../../utils/logger');
const axios = require('axios');

/**
 * Trade Validator
 * Validates trades before execution using Gamma Tracker data
 * Checks: Liquidity, Gamma Walls, Bid-Ask Spread, Risk Limits
 */
class TradeValidator {
  constructor(optionsService) {
    this.optionsService = optionsService;
    this.logger = new Logger('TradeValidator');
    
    // Validation thresholds (can be configured)
    this.thresholds = {
      maxBidAskSpread: 0.10,     // Max 10% spread
      minVolume: 0.1,             // Minimum volume
      minOpenInterest: 1,         // Minimum OI
      gammaWallThreshold: 5000,   // Avoid strikes with high gamma concentration
      minSweetSpotScore: 0.5      // Minimum sweet spot score from Gamma Tracker
    };
  }

  /**
   * Validate a signal before execution
   * @param {Object} signal - Trading signal
   * @param {Object} gammaTrackerData - Data from Gamma Tracker
   * @returns {Object} - Validation result
   */
  async validate(signal, gammaTrackerData = null) {
    try {
      this.logger.info('[TradeValidator] Validating trade...');

      if (!signal || !signal.legs || signal.legs.length === 0) {
        return this.createValidationResult(false, 'No legs in signal', {});
      }

      // Fetch Gamma Tracker data if not provided
      if (!gammaTrackerData) {
        gammaTrackerData = await this.fetchGammaTrackerData();
      }

      const validations = {
        hasLiquidity: await this.validateLiquidity(signal.legs),
        noGammaWalls: await this.validateGammaWalls(signal.legs, gammaTrackerData),
        goodSpreads: await this.validateBidAskSpreads(signal.legs),
        withinRisk: this.validateRiskLimits(signal),
        sweetSpots: await this.validateSweetSpots(signal.legs, gammaTrackerData)
      };

      // Overall validation
      const allPassed = Object.values(validations).every(v => v.passed);

      // Collect warnings
      const warnings = [];
      Object.entries(validations).forEach(([key, val]) => {
        if (!val.passed && val.warning) {
          warnings.push(val.warning);
        }
      });

      const result = {
        valid: allPassed,
        validations,
        warnings,
        timestamp: new Date()
      };

      if (allPassed) {
        this.logger.info('[TradeValidator] ✅ Trade validation PASSED');
      } else {
        this.logger.warn('[TradeValidator] ❌ Trade validation FAILED:', warnings);
      }

      return result;

    } catch (error) {
      this.logger.error('[TradeValidator] Error validating trade:', error);
      return this.createValidationResult(false, `Validation error: ${error.message}`, {});
    }
  }

  /**
   * Validate liquidity for all legs
   * @param {Array} legs - Trade legs
   * @returns {Object} - Validation result
   */
  async validateLiquidity(legs) {
    try {
      const optionsData = await this.optionsService.getAllOptions();
      const options = optionsData.options;

      for (const leg of legs) {
        const option = leg.option || leg;

        // Find matching option in market data
        const marketOption = options.find(opt =>
          opt.symbol === option.symbol &&
          opt.strike === option.strike &&
          opt.side === option.side
        );

        if (!marketOption) {
          return {
            passed: false,
            warning: `Option not found in market data: ${option.symbol}`,
            details: { missingOption: option.symbol }
          };
        }

        // Check volume
        if (marketOption.volume < this.thresholds.minVolume) {
          return {
            passed: false,
            warning: `Low volume for ${option.symbol}: ${marketOption.volume}`,
            details: { strike: option.strike, volume: marketOption.volume }
          };
        }

        // Check open interest
        const oi = marketOption.openInterest || marketOption.open_interest || 0;
        if (oi < this.thresholds.minOpenInterest) {
          return {
            passed: false,
            warning: `Low open interest for ${option.symbol}: ${oi}`,
            details: { strike: option.strike, openInterest: oi }
          };
        }
      }

      return {
        passed: true,
        warning: null,
        details: { message: 'All legs have sufficient liquidity' }
      };

    } catch (error) {
      this.logger.error('[TradeValidator] Error validating liquidity:', error);
      return {
        passed: false,
        warning: `Liquidity check failed: ${error.message}`,
        details: {}
      };
    }
  }

  /**
   * Validate no gamma walls at strike prices
   * @param {Array} legs - Trade legs
   * @param {Object} gammaTrackerData - Gamma Tracker data
   * @returns {Object} - Validation result
   */
  async validateGammaWalls(legs, gammaTrackerData) {
    try {
      if (!gammaTrackerData || !gammaTrackerData.levels) {
        // If no gamma data available, pass (don't block trade)
        return {
          passed: true,
          warning: 'Gamma data not available (skipped check)',
          details: {}
        };
      }

      const { levels } = gammaTrackerData;

      for (const leg of legs) {
        const option = leg.option || leg;
        const strike = option.strike;

        // Find gamma exposure at this strike
        const levelAtStrike = levels.find(level =>
          Math.abs(level.strike - strike) < 100 // Within $100 of strike
        );

        if (levelAtStrike) {
          const absGamma = Math.abs(levelAtStrike.netGamma);

          // Check if gamma exposure is too high (gamma wall)
          if (absGamma > this.thresholds.gammaWallThreshold) {
            return {
              passed: false,
              warning: `Gamma wall detected at strike ${strike}: ${absGamma.toFixed(0)}`,
              details: {
                strike,
                netGamma: levelAtStrike.netGamma,
                threshold: this.thresholds.gammaWallThreshold
              }
            };
          }
        }
      }

      return {
        passed: true,
        warning: null,
        details: { message: 'No gamma walls detected at selected strikes' }
      };

    } catch (error) {
      this.logger.error('[TradeValidator] Error validating gamma walls:', error);
      return {
        passed: true, // Don't block on error
        warning: `Gamma wall check failed: ${error.message}`,
        details: {}
      };
    }
  }

  /**
   * Validate bid-ask spreads
   * @param {Array} legs - Trade legs
   * @returns {Object} - Validation result
   */
  async validateBidAskSpreads(legs) {
    try {
      const optionsData = await this.optionsService.getAllOptions();
      const options = optionsData.options;

      for (const leg of legs) {
        const option = leg.option || leg;

        // Find matching option
        const marketOption = options.find(opt =>
          opt.symbol === option.symbol &&
          opt.strike === option.strike &&
          opt.side === option.side
        );

        if (!marketOption) continue;

        const bid = marketOption.bidPrice || marketOption.bid_price || 0;
        const ask = marketOption.askPrice || marketOption.ask_price || 0;

        if (bid === 0 || ask === 0) {
          return {
            passed: false,
            warning: `No bid/ask for ${option.symbol}`,
            details: { strike: option.strike, bid, ask }
          };
        }

        // Calculate spread as percentage
        const spread = (ask - bid) / bid;

        if (spread > this.thresholds.maxBidAskSpread) {
          return {
            passed: false,
            warning: `Wide spread for ${option.symbol}: ${(spread * 100).toFixed(1)}%`,
            details: { strike: option.strike, spread: spread, bid, ask }
          };
        }
      }

      return {
        passed: true,
        warning: null,
        details: { message: 'All spreads within acceptable range' }
      };

    } catch (error) {
      this.logger.error('[TradeValidator] Error validating spreads:', error);
      return {
        passed: false,
        warning: `Spread check failed: ${error.message}`,
        details: {}
      };
    }
  }

  /**
   * Validate sweet spots (optimal liquidity zones from Gamma Tracker)
   * @param {Array} legs - Trade legs
   * @param {Object} gammaTrackerData - Gamma Tracker data
   * @returns {Object} - Validation result
   */
  async validateSweetSpots(legs, gammaTrackerData) {
    try {
      if (!gammaTrackerData || !gammaTrackerData.sweetSpots) {
        // If no sweet spot data, skip check
        return {
          passed: true,
          warning: 'Sweet spot data not available (skipped check)',
          details: {}
        };
      }

      const { sweetSpots } = gammaTrackerData;

      // Check if any leg strikes are in sweet spots
      const legStrikes = legs.map(leg => (leg.option || leg).strike);
      const sweetSpotStrikes = sweetSpots.map(spot => spot.strike);

      let inSweetSpot = 0;
      for (const strike of legStrikes) {
        // Check if strike is within sweet spot range
        const nearSweetSpot = sweetSpotStrikes.some(ssStrike =>
          Math.abs(ssStrike - strike) < 1000 // Within $1000
        );

        if (nearSweetSpot) inSweetSpot++;
      }

      const sweetSpotRatio = inSweetSpot / legStrikes.length;

      if (sweetSpotRatio >= this.thresholds.minSweetSpotScore) {
        return {
          passed: true,
          warning: null,
          details: {
            message: `${inSweetSpot}/${legStrikes.length} strikes in sweet spots`,
            ratio: sweetSpotRatio
          }
        };
      } else {
        return {
          passed: false,
          warning: `Only ${inSweetSpot}/${legStrikes.length} strikes in sweet spots (prefer better liquidity)`,
          details: { sweetSpotRatio }
        };
      }

    } catch (error) {
      this.logger.error('[TradeValidator] Error validating sweet spots:', error);
      return {
        passed: true, // Don't block on error
        warning: `Sweet spot check failed: ${error.message}`,
        details: {}
      };
    }
  }

  /**
   * Validate risk limits
   * @param {Object} signal - Trading signal
   * @returns {Object} - Validation result
   */
  validateRiskLimits(signal) {
    try {
      if (!signal.position) {
        return {
          passed: true,
          warning: 'No position metrics in signal',
          details: {}
        };
      }

      const { maxProfit, maxLoss, riskRewardRatio } = signal.position;

      // Check if max loss is reasonable
      if (maxLoss > 10000) {
        return {
          passed: false,
          warning: `Max loss too high: $${maxLoss.toFixed(2)}`,
          details: { maxLoss }
        };
      }

      // Check risk-reward ratio (optional)
      if (riskRewardRatio && riskRewardRatio < 0.2) {
        return {
          passed: false,
          warning: `Poor risk-reward ratio: ${riskRewardRatio.toFixed(2)}`,
          details: { riskRewardRatio }
        };
      }

      return {
        passed: true,
        warning: null,
        details: {
          message: 'Risk limits within acceptable range',
          maxProfit,
          maxLoss,
          riskRewardRatio
        }
      };

    } catch (error) {
      this.logger.error('[TradeValidator] Error validating risk:', error);
      return {
        passed: true, // Don't block on error
        warning: `Risk check failed: ${error.message}`,
        details: {}
      };
    }
  }

  /**
   * Fetch Gamma Tracker data
   * @returns {Object} - Gamma Tracker data
   */
  async fetchGammaTrackerData() {
    try {
      const apiPort = process.env.API_PORT || 3300;
      const baseUrl = `http://localhost:${apiPort}/api/gamma-tracker`;

      // Fetch multiple endpoints in parallel
      const [entropyRes, levelsRes, sweetSpotsRes] = await Promise.all([
        axios.get(`${baseUrl}/entropy`, { timeout: 5000 }).catch(() => null),
        axios.get(`${baseUrl}/levels`, { timeout: 5000 }).catch(() => null),
        axios.get(`${baseUrl}/sweet-spots`, { timeout: 5000 }).catch(() => null)
      ]);

      return {
        entropy: entropyRes?.data?.data?.entropy || null,
        levels: levelsRes?.data?.data?.levels || [],
        sweetSpots: sweetSpotsRes?.data?.data?.sweetSpots || []
      };

    } catch (error) {
      this.logger.warn('[TradeValidator] Could not fetch Gamma Tracker data:', error.message);
      return {
        entropy: null,
        levels: [],
        sweetSpots: []
      };
    }
  }

  /**
   * Create validation result object
   * @param {boolean} valid - Is valid
   * @param {string} reason - Reason
   * @param {Object} validations - Detailed validations
   * @returns {Object} - Validation result
   */
  createValidationResult(valid, reason, validations) {
    return {
      valid,
      validations,
      warnings: [reason],
      timestamp: new Date()
    };
  }

  /**
   * Get validation summary
   * @param {Object} validation - Validation result
   * @returns {string} - Human-readable summary
   */
  getValidationSummary(validation) {
    if (validation.valid) {
      return '✅ Trade validation PASSED - all checks successful';
    }

    let summary = '❌ Trade validation FAILED:\n';
    validation.warnings.forEach(warning => {
      summary += `  • ${warning}\n`;
    });

    return summary;
  }

  /**
   * Update validation thresholds
   * @param {Object} newThresholds - New threshold values
   */
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    this.logger.info('[TradeValidator] Thresholds updated:', this.thresholds);
  }
}

module.exports = TradeValidator;
