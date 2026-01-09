/**
 * ============================================================================
 * REQUEST LOGGER MIDDLEWARE
 * ============================================================================
 * 
 * Log estruturado de requests HTTP
 * Útil para debugging e monitoring
 * 
 * FEATURES:
 * - Log de requests e responses
 * - Tempo de resposta
 * - Status codes
 * - User agent
 * - Request ID (para tracing)
 * - Filtros configuráveis
 * 
 * USO:
 * app.use(requestLogger(logger, options));
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

const crypto = require('crypto');

// Stats
const stats = {
  total: 0,
  by_method: {},
  by_status: {},
  by_path: {},
  avg_response_time: 0,
  total_response_time: 0
};

/**
 * Request logger factory
 * @param {Object} logger - Logger instance
 * @param {Object} options - Configuration
 * @returns {Function} Express middleware
 */
const requestLogger = (logger, options = {}) => {
  // Fallback logger if none provided
  if (!logger) {
    logger = {
      info: console.log,
      warn: console.warn,
      error: console.error
    };
  }
  
  const config = {
    // What to log
    logBody: options.logBody !== false,
    logQuery: options.logQuery !== false,
    logHeaders: options.logHeaders || false,
    
    // Filters
    skip: options.skip || (() => false),
    skipPaths: options.skipPaths || ['/health'],
    
    // Sanitization
    sanitizeBody: options.sanitizeBody !== false,
    sanitizeHeaders: options.sanitizeHeaders !== false,
    
    // Performance
    slowThreshold: options.slowThreshold || 1000  // 1s
  };

  return (req, res, next) => {
    // Skip if configured
    if (config.skip(req) || config.skipPaths.includes(req.path)) {
      return next();
    }

    // Generate request ID
    const requestId = crypto.randomBytes(8).toString('hex');
    req.id = requestId;

    // Start time
    const startTime = Date.now();

    // Store original end
    const originalEnd = res.end;

    // Override res.end to log after response
    res.end = function(...args) {
      // Calculate response time
      const responseTime = Date.now() - startTime;

      // Update stats
      updateStats(req, res, responseTime);

      // Build log data
      const logData = {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        responseTime: `${responseTime}ms`,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent')
      };

      // Add query
      if (config.logQuery && Object.keys(req.query).length > 0) {
        logData.query = req.query;
      }

      // Add body
      if (config.logBody && req.body && Object.keys(req.body).length > 0) {
        logData.body = config.sanitizeBody 
          ? sanitizeObject(req.body)
          : req.body;
      }

      // Add headers
      if (config.logHeaders) {
        logData.headers = config.sanitizeHeaders
          ? sanitizeHeaders(req.headers)
          : req.headers;
      }

      // Determine log level
      let level = 'info';
      
      if (res.statusCode >= 500) {
        level = 'error';
      } else if (res.statusCode >= 400) {
        level = 'warn';
      } else if (responseTime > config.slowThreshold) {
        level = 'warn';
        logData.slow = true;
      }

      // Log (with fallback for invalid levels)
      if (typeof logger[level] === 'function') {
        logger[level]('HTTP Request', logData);
      } else {
        // Fallback to info if level method doesn't exist
        logger.info(`HTTP Request [${level}]`, logData);
      }

      // Call original end
      return originalEnd.apply(res, args);
    };

    next();
  };
};

/**
 * Update statistics
 * @private
 */
function updateStats(req, res, responseTime) {
  stats.total++;

  // By method
  stats.by_method[req.method] = (stats.by_method[req.method] || 0) + 1;

  // By status
  stats.by_status[res.statusCode] = (stats.by_status[res.statusCode] || 0) + 1;

  // By path
  const path = req.path;
  stats.by_path[path] = (stats.by_path[path] || 0) + 1;

  // Response time
  stats.total_response_time += responseTime;
  stats.avg_response_time = stats.total_response_time / stats.total;
}

/**
 * Sanitize object (remove sensitive fields)
 * @private
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = { ...obj };
  const sensitiveFields = [
    'password', 'token', 'apiKey', 'secret', 
    'creditCard', 'ssn', 'authorization'
  ];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Sanitize headers
 * @private
 */
function sanitizeHeaders(headers) {
  const sanitized = { ...headers };
  const sensitiveHeaders = [
    'authorization', 'cookie', 'x-api-key'
  ];

  for (const header of sensitiveHeaders) {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Get statistics
 */
requestLogger.getStats = () => {
  const topPaths = Object.entries(stats.by_path)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  return {
    total: stats.total,
    by_method: stats.by_method,
    by_status: stats.by_status,
    avg_response_time: `${stats.avg_response_time.toFixed(2)}ms`,
    top_paths: topPaths
  };
};

/**
 * Reset statistics
 */
requestLogger.resetStats = () => {
  stats.total = 0;
  stats.by_method = {};
  stats.by_status = {};
  stats.by_path = {};
  stats.avg_response_time = 0;
  stats.total_response_time = 0;
};

module.exports = requestLogger;