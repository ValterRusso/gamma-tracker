/**
 * ============================================================================
 * ERROR HANDLER MIDDLEWARE
 * ============================================================================
 * 
 * Global error handler para Express
 * Captura todos os erros e formata responses consistentes
 * 
 * FEATURES:
 * - Log estruturado de erros
 * - Status codes apropriados
 * - Stack trace em development
 * - Sanitização de erros sensíveis
 * - Error tracking metrics
 * 
 * USO:
 * - Automaticamente captura erros de asyncHandler
 * - Pode ser chamado manualmente com next(error)
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

// Error statistics
const errorStats = {
  total: 0,
  by_status: {},
  by_path: {},
  recent: []
};

/**
 * Error handler middleware factory
 * @param {Object} logger - Logger instance
 * @returns {Function} Express error middleware
 */
module.exports = (logger) => {
  // Fallback logger if none provided
  if (!logger) {
    logger = {
      error: console.error,
      warn: console.warn,
      info: console.log
    };
  }
  
  return (err, req, res, next) => {
    // Update stats
    errorStats.total++;
    
    // Determine status code
    const statusCode = determineStatusCode(err);
    
    // Update stats by status
    errorStats.by_status[statusCode] = (errorStats.by_status[statusCode] || 0) + 1;
    
    // Update stats by path
    const path = req.path;
    errorStats.by_path[path] = (errorStats.by_path[path] || 0) + 1;
    
    // Store recent error
    errorStats.recent.unshift({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: statusCode,
      message: err.message
    });
    
    // Keep only last 20 errors
    if (errorStats.recent.length > 20) {
      errorStats.recent.pop();
    }
    
    // Log error with context
    logger.error('API Error', {
      method: req.method,
      path: req.path,
      query: req.query,
      body: sanitizeBody(req.body),
      status: statusCode,
      error: err.message,
      stack: err.stack,
      user: req.user?.id || 'anonymous'
    });
    
    // Build error response
    const response = {
      success: false,
      error: sanitizeErrorMessage(err.message),
      path: req.path,
      timestamp: new Date().toISOString()
    };
    
    // Add additional info in development
    if (process.env.NODE_ENV === 'development') {
      response.stack = err.stack;
      response.statusCode = statusCode;
      
      // Add request info
      response.request = {
        method: req.method,
        query: req.query,
        body: sanitizeBody(req.body)
      };
    }
    
    // Add error code if available
    if (err.code) {
      response.code = err.code;
    }
    
    // Send response
    res.status(statusCode).json(response);
  };
};

/**
 * Determine appropriate HTTP status code
 * @private
 */
function determineStatusCode(err) {
  // Explicit status code
  if (err.statusCode) return err.statusCode;
  if (err.status) return err.status;
  
  // Common error types
  if (err.name === 'ValidationError') return 400;
  if (err.name === 'CastError') return 400;
  if (err.name === 'UnauthorizedError') return 401;
  if (err.name === 'ForbiddenError') return 403;
  if (err.name === 'NotFoundError') return 404;
  if (err.name === 'ConflictError') return 409;
  if (err.name === 'TooManyRequestsError') return 429;
  
  // Error message keywords
  const message = err.message.toLowerCase();
  
  if (message.includes('not found')) return 404;
  if (message.includes('unauthorized') || message.includes('authentication')) return 401;
  if (message.includes('forbidden') || message.includes('permission')) return 403;
  if (message.includes('invalid') || message.includes('validation')) return 400;
  if (message.includes('required')) return 400;
  if (message.includes('conflict') || message.includes('already exists')) return 409;
  if (message.includes('rate limit')) return 429;
  if (message.includes('timeout')) return 504;
  
  // Default to 500
  return 500;
}

/**
 * Sanitize error message (remove sensitive info)
 * @private
 */
function sanitizeErrorMessage(message) {
  if (!message) return 'An error occurred';
  
  // Remove file paths
  message = message.replace(/\/[^\s]+\.(js|ts)/g, '[file]');
  
  // Remove potential credentials
  message = message.replace(/password[=:\s]+[^\s]+/gi, 'password=[REDACTED]');
  message = message.replace(/token[=:\s]+[^\s]+/gi, 'token=[REDACTED]');
  message = message.replace(/key[=:\s]+[^\s]+/gi, 'key=[REDACTED]');
  
  return message;
}

/**
 * Sanitize request body (remove sensitive fields)
 * @private
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'creditCard'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Get error statistics
 */
module.exports.getStats = () => {
  return {
    ...errorStats,
    top_errors: Object.entries(errorStats.by_path)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }))
  };
};

/**
 * Reset error statistics
 */
module.exports.resetStats = () => {
  errorStats.total = 0;
  errorStats.by_status = {};
  errorStats.by_path = {};
  errorStats.recent = [];
};

/**
 * Custom error classes
 */
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

// Export custom errors
module.exports.ValidationError = ValidationError;
module.exports.NotFoundError = NotFoundError;
module.exports.UnauthorizedError = UnauthorizedError;
module.exports.ForbiddenError = ForbiddenError;
module.exports.ConflictError = ConflictError;