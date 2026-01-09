/**
 * ============================================================================
 * OPTIONS ROUTES
 * ============================================================================
 * 
 * Endpoints para acesso direto aos dados de opções
 * 
 * ENDPOINTS:
 * - GET /api/options                  - Lista todas as opções
 * - GET /api/options/strike/:strike   - Opções por strike específico
 * - GET /api/strikes                  - Lista de strikes únicos
 * - GET /api/expiries                 - Lista de expiries únicos
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const cache = require('../middleware/cache');
const { validateParams } = require('../middleware/validation');
const OptionsService = require('../../services/OptionsService');

module.exports = (dependencies) => {
  const { dataCollector } = dependencies;
  
  // Create service
  const optionsService = new OptionsService(dataCollector);

  /**
   * GET /api/options
   * Lista completa de todas as opções
   * Cache: 5s
   */
  router.get('/options', 
    cache(5000), 
    asyncHandler(async (req, res) => {
      const result = await optionsService.getAllOptions();
      
      res.json({
        success: true,
        data: result.options,
        count: result.count
      });
    })
  );

  /**
   * GET /api/options/strike/:strike
   * Opções filtradas por strike específico
   * Cache: 5s
   */
  router.get('/options/strike/:strike',
    cache(5000),
    validateParams({
      strike: { type: 'string', required: true }
    }),
    asyncHandler(async (req, res) => {
      const strike = parseFloat(req.params.strike);
      
      if (isNaN(strike) || strike <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid strike parameter'
        });
      }
      
      const result = await optionsService.getOptionsByStrike(strike);
      
      res.json({
        success: true,
        data: result.options,
        count: result.count,
        strike: strike
      });
    })
  );

  /**
   * GET /api/strikes
   * Lista de strikes únicos disponíveis
   * Cache: 10s
   */
  router.get('/strikes', 
    cache(10000), 
    asyncHandler(async (req, res) => {
      const result = await optionsService.getStrikes();
      
      res.json({
        success: true,
        data: result.strikes,
        count: result.count
      });
    })
  );

  /**
   * GET /api/expiries
   * Lista de datas de expiração únicas
   * Cache: 10s
   */
  router.get('/expiries', 
    cache(10000), 
    asyncHandler(async (req, res) => {
      const result = await optionsService.getExpiries();
      
      res.json({
        success: true,
        data: result.expiries,
        count: result.count
      });
    })
  );

  return router;
};