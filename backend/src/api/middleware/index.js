/**
 * ============================================================================
 * MIDDLEWARE INDEX
 * ============================================================================
 * 
 * Exporta todos os middlewares para fácil importação
 * 
 * USO:
 * const { asyncHandler, cache, errorHandler } = require('./middleware');
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

const asyncHandler = require('./asyncHandler');
const cache = require('./cache');
const errorHandler = require('./errorHandler');
const { validateBody, validateQuery, validateParams, commonSchemas } = require('./validation');
const rateLimit = require('./rateLimit');
const requestLogger = require('./requestLogger');

module.exports = {
  // Core middleware
  asyncHandler,
  cache,
  errorHandler,
  
  // Validation
  validateBody,
  validateQuery,
  validateParams,
  commonSchemas,
  
  // Security & monitoring
  rateLimit,
  requestLogger,
  
  // Custom error classes (from errorHandler)
  ValidationError: errorHandler.ValidationError,
  NotFoundError: errorHandler.NotFoundError,
  UnauthorizedError: errorHandler.UnauthorizedError,
  ForbiddenError: errorHandler.ForbiddenError,
  ConflictError: errorHandler.ConflictError
};