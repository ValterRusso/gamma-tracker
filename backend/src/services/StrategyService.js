/**
 * ============================================================================
 * STRATEGY SERVICE
 * ============================================================================
 * 
 * Business logic para recomendação de estratégias de opções
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

const { Op } = require('sequelize');

class StrategyService {
  constructor(database, marketStateAnalyzer, strategyRecommender, strategies) {
    this.database = database;
    this.marketStateAnalyzer = marketStateAnalyzer;
    this.strategyRecommender = strategyRecommender;
    this.strategies = strategies;
  }

  /**
   * Get market state analysis
   * @private
   */
  async _getMarketState() {
    // Check if database is available
    if (!this.database) {
      const error = new Error('Database not initialized. Strategy recommendations require historical market data.');
      error.statusCode = 503;
      error.code = 'DATABASE_NOT_READY';
      throw error;
    }
    
    // Try to get MarketSnapshot model (support both .models and .getModel())
    let MarketSnapshot = null;
    
    if (this.database.models && this.database.models.MarketSnapshot) {
      MarketSnapshot = this.database.models.MarketSnapshot;
    } else if (typeof this.database.getModel === 'function') {
      MarketSnapshot = this.database.getModel('MarketSnapshot');
    }
    
    if (!MarketSnapshot) {
      const error = new Error('MarketSnapshot model not available. Database may not be fully initialized.');
      error.statusCode = 503;
      error.code = 'MODEL_NOT_READY';
      throw error;
    }
    
    // 1. Get latest market snapshot
    const latestSnapshot = await MarketSnapshot.findOne({
      order: [['timestamp', 'DESC']]
    });
    
    if (!latestSnapshot) {
      const error = new Error('No historical market data available yet. Please wait for data collection to start.');
      error.statusCode = 503;
      error.code = 'NO_DATA';
      throw error;
    }
    
    // 2. Get volatility surface data
    const volData = await this._getVolatilitySurfaceData(latestSnapshot);
    
    // 3. Get recent anomalies (last 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // Try to get AnomaliesLog model
    let AnomaliesLog = null;
    
    if (this.database.models && this.database.models.AnomaliesLog) {
      AnomaliesLog = this.database.models.AnomaliesLog;
    } else if (typeof this.database.getModel === 'function') {
      AnomaliesLog = this.database.getModel('AnomaliesLog');
    }
    
    let recentAnomalies = [];
    
    if (AnomaliesLog) {
      recentAnomalies = await AnomaliesLog.findAll({
        where: {
          created_at: {  // ✅ CORRIGIDO: usar created_at em vez de timestamp
            [Op.gte]: oneHourAgo
          }
        },
        order: [['created_at', 'DESC']],  // ✅ CORRIGIDO
        limit: 10
      });
    }
    
    // 4. Analyze market state
    const analyzer = new this.marketStateAnalyzer(
      latestSnapshot.toJSON(),
      volData,
      recentAnomalies.map(a => a.toJSON())
    );
    
    const marketState = analyzer.analyze();
    
    return {
      marketState,
      snapshot: latestSnapshot,
      anomalies: recentAnomalies
    };
  }

  /**
   * Get volatility surface data
   * @private
   */
  async _getVolatilitySurfaceData(snapshot) {
    try {
      if (!snapshot || !snapshot.vol_surface_data) {
        return [];
      }
      
      // Parse JSON if it's a string
      if (typeof snapshot.vol_surface_data === 'string') {
        return JSON.parse(snapshot.vol_surface_data);
      }
      
      return snapshot.vol_surface_data;
    } catch (error) {
      console.error('Error parsing vol surface data:', error);
      return [];
    }
  }

  /**
   * Recommend top N strategies
   * @param {Object} options - { topN, minScore }
   */
  async recommend(options = {}) {
    const { topN = 5, minScore = 50 } = options;
    
    // Get market state
    const { marketState, snapshot } = await this._getMarketState();
    
    // Recommend strategies
    const recommender = new this.strategyRecommender(
      this.strategies,
      marketState
    );
    
    const recommendations = recommender.recommend({ topN, minScore });
    
    return {
      recommendations,
      marketState,
      totalStrategies: this.strategies.length,
      spotPrice: snapshot.spot_price,
      regime: snapshot.regime
    };
  }

  /**
   * Get all strategies with scores
   */
  async getAllWithScores() {
    // Get market state
    const { marketState } = await this._getMarketState();
    
    // Get all strategies with scores
    const recommender = new this.strategyRecommender(
      this.strategies,
      marketState
    );
    
    const allStrategies = recommender.getAllWithScores();
    
    return {
      strategies: allStrategies,
      marketState
    };
  }

  /**
   * Get specific strategy details
   * @param {string} strategyId - Strategy ID
   */
  async getStrategy(strategyId) {
    // Find strategy
    const strategy = this.strategies.find(s => s.id === strategyId);
    
    if (!strategy) {
      throw new Error(`Strategy '${strategyId}' not found`);
    }
    
    try {
      // Try to get market state and calculate score
      const { marketState } = await this._getMarketState();
      
      const recommender = new this.strategyRecommender(
        [strategy],
        marketState
      );
      
      const scored = recommender.recommend({ topN: 1, minScore: 0 })[0];
      
      return {
        strategy: scored,
        marketState
      };
      
    } catch (error) {
      // If market data not available, return strategy without score
      console.warn('Market data not available for strategy scoring:', error.message);
      
      return {
        strategy,
        marketState: null
      };
    }
  }
}

module.exports = StrategyService;