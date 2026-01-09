/**
 * ============================================================================
 * API SERVER - GAMMA TRACKER
 * ============================================================================
 * 
 * Express API server com arquitetura modular e middleware completo
 * 
 * Features:
 * - Modular routes (14 route files)
 * - Complete middleware suite (cache, validation, error handling)
 * - Service layer architecture
 * - Real-time entropy updates
 * - Graceful shutdown
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 2.0 (Refactored)
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');

// Middleware
const { 
  errorHandler, 
  requestLogger 
} = require('./middleware');

// Routes
const routes = require('./routes');

class APIServer {
  constructor(dependencies) {
    this.app = express();
    this.config = dependencies.config || { port: 3300, host: '0.0.0.0' };
    this.dependencies = dependencies;
    
    // Properties for lifecycle
    this.server = null;
    this.logger = dependencies.logger;
    this.dataCollector = dependencies.dataCollector;
    this.entropyCalc = dependencies.entropyCalc;
    
    // Metrics cache (for getMetrics)
    this.metricsCache = null;
    this.lastMetricsUpdate = 0;
    
    // Setup
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // CORS
    this.app.use(cors());
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use(requestLogger(this.logger));
    
    this.logger.info('✓ Middleware configured');
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check (no /api prefix)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        timestamp: Date.now(),
        uptime: process.uptime()
      });
    });
    
    // Mount all API routes
    this.app.use('/api', routes(this.dependencies));
    
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path
      });
    });
    
    this.logger.info('✓ Routes configured');
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // Global error handler (must be last!)
    this.app.use(errorHandler(this.logger));
    
    this.logger.info('✓ Error handling configured');
  }

  /**
   * Get comprehensive metrics (for persistence and API)
   * CRITICAL: Used by saveSnapshot() - must return complete data
   */
  async getMetrics() {
    const now = Date.now();

    // Return cache if still valid (5 second TTL)
    const cacheTTL = 5000;
    if (this.metricsCache && (now - this.lastMetricsUpdate) < cacheTTL) {
      return this.metricsCache;
    }

    try {
      // Get options
      const options = this.dataCollector.getAllOptions();
      
      if (!options || options.length === 0) {
        return null;
      }

      // Get spot price
      const spotPrice = this.dataCollector.spotPrice || this.estimateSpotPrice(options);
      
      // Calculate GEX metrics
      this.dependencies.gexCalculator.setSpotPrice(spotPrice);
      const metrics = this.dependencies.gexCalculator.calculateAllMetrics(options);

      // Add regime analysis
      try {
        const regimeAnalysis = this.dependencies.regimeAnalyzer.analyzeRegime(metrics);
        // Truncate regime to max 20 characters to fit database column
        const regime = regimeAnalysis.regime || '';
        metrics.regime = regime.substring(0, 20);
        metrics.regimeAnalysis = regimeAnalysis;
      } catch (error) {
        this.logger.error('Error analyzing regime:', error.message);
        metrics.regime = null;
      }

      // Update cache
      this.metricsCache = metrics;
      this.lastMetricsUpdate = now;

      return metrics;
      
    } catch (error) {
      this.logger.error('Error getting metrics:', error);
      return null;
    }
  }

  /**
   * Estimate spot price from options (fallback)
   */
  estimateSpotPrice(options) {
    if (!options || options.length === 0) {
      return null;
    }

    // Find ATM options and average their strikes
    const atmOptions = options
      .filter(opt => opt.delta && Math.abs(Math.abs(opt.delta) - 0.5) < 0.1)
      .slice(0, 10);

    if (atmOptions.length > 0) {
      const avgStrike = atmOptions.reduce((sum, opt) => sum + opt.strike, 0) / atmOptions.length;
      return avgStrike;
    }

    // Fallback: use median strike
    const strikes = options.map(opt => opt.strike).sort((a, b) => a - b);
    return strikes[Math.floor(strikes.length / 2)];
  }

  /**
   * Setup entropy real-time updates
   */
  setupEntropyUpdates() {
    const orderBook = this.dataCollector.orderBookAnalyzer;
    
    if (!orderBook) {
      this.logger.warn('OrderBookAnalyzer not available - entropy updates disabled');
      return;
    }
    
    // Listen to order book updates
    orderBook.on('update', (metrics) => {
      try {
        // Calculate entropy from order book
        const entropyData = this.entropyCalc.calculate(
          orderBook.bids,
          orderBook.asks
        );
        
        // EntropyCalculatorV2 handles storage internally
        
      } catch (error) {
        this.logger.error('Error calculating entropy:', error);
      }
    });
    
    this.logger.success('✓ Entropy updates connected to OrderBookAnalyzer');
  }

  /**
   * Start the API server
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        // Setup entropy updates if available
        if (this.dataCollector.orderBookAnalyzer && this.entropyCalc) {
          this.setupEntropyUpdates();
        }
        
        // Start Express server
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          this.logger.success(
            `🚀 API Server running at http://${this.config.host}:${this.config.port}`
          );
          this.logger.info(`📊 Total routes: 72+ endpoints across 14 route files`);
          resolve();
        });
        
        // Handle server errors
        this.server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            this.logger.error(`Port ${this.config.port} is already in use`);
          } else {
            this.logger.error('Server error:', error);
          }
          reject(error);
        });
        
      } catch (error) {
        this.logger.error('Failed to start server:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the API server gracefully
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('✓ API Server stopped gracefully');
          resolve();
        });
      } else {
        this.logger.warn('Server was not running');
        resolve();
      }
    });
  }

  /**
   * Get Express app instance (for testing)
   */
  getApp() {
    return this.app;
  }
}

module.exports = APIServer;