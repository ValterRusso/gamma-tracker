/**
 * ============================================================================
 * ENTROPY ROUTES (NEW!)
 * ============================================================================
 * 
 * Endpoints de Shannon Entropy + RSI:
 * - GET  /api/entropy              - Entropy atual + RSI
 * - GET  /api/entropy/stats        - Estatísticas
 * - GET  /api/entropy/events       - Eventos recentes
 * - GET  /api/entropy/history      - Histórico
 * - GET  /api/entropy/divergence   - Divergência bid/ask
 * - POST /api/entropy/depth        - Trocar profundidade
 * - GET  /api/entropy/depth        - Ver profundidade
 * - POST /api/entropy/asset        - Trocar asset
 * - GET  /api/entropy/assets       - Listar assets
 * - GET  /api/rsi                  - RSI + volume
 * - GET  /api/volume               - Volume trend
 * - GET  /api/divergences          - Todas divergências
 * 
 * @author Valter Russo
 * @version 1.0
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { validateBody, validateQuery } = require('../middleware/validation');
const EntropyService = require('../../services/EntropyService');

module.exports = (dependencies) => {
  const { entropyCalc, rsiCalc, orderbook } = dependencies;
  
  // Create service
  const entropyService = new EntropyService(entropyCalc, rsiCalc, orderbook);

  /**
   * GET /api/entropy
   * Entropy atual + RSI
   */
  router.get('/entropy-rsi', 
    validateQuery({
      depth: { type: 'string', min: 5, max: 200 }
    }),
    asyncHandler(async (req, res) => {
      const depth = req.query.depth || null;
      const data = await entropyService.getEntropy(depth);
      
      res.json({ success: true, data });
    })
  );

  /**
   * GET /api/entropy/stats
   * Estatísticas de entropy e RSI
   */
  router.get('/entropy/stats', asyncHandler(async (req, res) => {
    const stats = await entropyService.getStats();
    
    res.json({ success: true, data: stats });
  }));

  /**
   * GET /api/entropy/events
   * Eventos recentes de entropy
   */
  router.get('/entropy/events',
    validateQuery({
      limit: { type: 'string', min: 1, max: 100, default: 5 }
    }),
    asyncHandler(async (req, res) => {
      const limit = parseInt(req.query.limit);      
      const type = req.query.type || null;
      
      const events = await entropyService.getEvents(limit, type);
      
      res.json({ success: true, data: events });
    })
  );

  /**
   * GET /api/entropy/history
   * Histórico de entropy
   */
  router.get('/entropy/history',
    validateQuery({
      limit: { type: 'string', min: 1, max: 1000, default: 100 }
    }),
    asyncHandler(async (req, res) => {
      
      const limit = parseInt(req.query.limit);
      
      const history = await entropyService.getHistory(limit);
      
      res.json({ success: true, data: history });
    })
  );

  /**
   * GET /api/entropy/divergence
   * Divergência bid vs ask
   */
  router.get('/entropy/divergence', asyncHandler(async (req, res) => {
    const divergence = await entropyService.getDivergence();
    
    res.json({ success: true, data: divergence });
  }));

  /**
   * POST /api/entropy/depth
   * Trocar profundidade do orderbook
   */
  router.post('/entropy/depth',
    validateBody({
      depth: { type: 'number', required: true, min: 5, max: 200 }
    }),
    asyncHandler(async (req, res) => {
      const { depth } = req.body;
      
      const newDepth = await entropyService.setDepth(depth);
      
      res.json({
        success: true,
        depth: newDepth,
        message: `Depth successfully changed to ${newDepth} levels`
      });
    })
  );

  /**
   * GET /api/entropy/depth
   * Ver profundidade atual
   */
  router.get('/entropy/depth', asyncHandler(async (req, res) => {
    const depthInfo = await entropyService.getDepthInfo();
    
    res.json({ success: true, data: depthInfo });
  }));

  /**
   * GET /api/entropy/multi-depth
   * Calculate entropy at multiple depths in a single request
   * Query params: depths (comma-separated, e.g., "5,10,20,50,80,100")
   */
  router.get('/entropy/multi-depth', asyncHandler(async (req, res) => {
    // Parse depths from query param
    let depths = [5, 10, 20, 50, 80, 100]; // Default depths
    
    if (req.query.depths) {
      depths = req.query.depths
        .split(',')
        .map(d => parseInt(d.trim(), 10))
        .filter(d => !isNaN(d) && d >= 5 && d <= 200);
    }
    
    if (depths.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid depths parameter. Must be comma-separated numbers between 5 and 200.'
      });
    }
    
    // Get orderbook
    const bids = orderbook.getBids();
    const asks = orderbook.getAsks();
    
    if (!bids || !asks) {
      return res.status(503).json({
        success: false,
        error: 'Orderbook not available'
      });
    }
    
    // Calculate multi-depth
    const results = entropyCalc.calculateMultiDepth(bids, asks, depths);
    
    res.json({
      success: true,
      data: results,
      meta: {
        depths_requested: depths,
        depths_calculated: Object.keys(results).map(k => parseInt(k, 10)),
        timestamp: Date.now()
      }
    });
  }));

  /**
   * POST /api/entropy/asset
   * Trocar asset (aplica profile)
   */
  router.post('/entropy/asset',
    validateBody({
      asset: { type: 'string', required: true }
    }),
    asyncHandler(async (req, res) => {
      const { asset } = req.body;
      
      const result = await entropyService.setAsset(asset);
      
      res.json({
        success: true,
        asset: result.asset,
        depth: result.depth,
        thresholds: result.thresholds,
        message: `Asset successfully changed to ${result.asset}`
      });
    })
  );

  /**
   * GET /api/entropy/assets
   * Listar assets disponíveis com profiles
   */
  router.get('/entropy/assets', asyncHandler(async (req, res) => {
    const assets = await entropyService.getAssets();
    
    res.json({ success: true, data: assets });
  }));

  /**
   * GET /api/rsi
   * RSI atual com volume analysis
   */
  router.get('/rsi', asyncHandler(async (req, res) => {
    const rsiData = await entropyService.getRSI();
    
    res.json({ success: true, data: rsiData });
  }));

  /**
   * GET /api/volume
   * Volume trend analysis
   */
  router.get('/volume', asyncHandler(async (req, res) => {
    const volumeData = await entropyService.getVolume();
    
    res.json({ success: true, data: volumeData });
  }));

  /**
   * GET /api/divergences
   * Todas as divergências detectadas
   */
  router.get('/divergences', asyncHandler(async (req, res) => {
    const divergences = await entropyService.getDivergences();
    
    res.json({ success: true, data: divergences });
  }));

  return router;
};