/**
 * ============================================================================
 * RATE LIMITER MIDDLEWARE
 * ============================================================================
 * 
 * Protege API contra abuso com rate limiting
 * Baseado em IP ou API key
 * 
 * FEATURES:
 * - Rate limiting por IP
 * - Rate limiting por API key
 * - Janelas de tempo configuráveis
 * - Headers informativos (X-RateLimit-*)
 * - Blacklist automática
 * 
 * USO:
 * // Aplicar globalmente
 * app.use(rateLimit({ windowMs: 60000, max: 100 }));
 * 
 * // Aplicar por endpoint
 * router.post('/expensive', rateLimit({ windowMs: 60000, max: 10 }), handler);
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

// Request tracking
const requests = new Map();

// Blacklist
const blacklist = new Set();

// Stats
const stats = {
  total_requests: 0,
  blocked_requests: 0,
  blacklisted_ips: 0
};

/**
 * Rate limiter factory
 * @param {Object} options - Configuration
 * @returns {Function} Express middleware
 */
const rateLimit = (options = {}) => {
  const config = {
    windowMs: options.windowMs || 60000,  // 1 minute
    max: options.max || 100,               // 100 requests per window
    message: options.message || 'Too many requests, please try again later',
    statusCode: options.statusCode || 429,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    keyGenerator: options.keyGenerator || defaultKeyGenerator,
    handler: options.handler || defaultHandler,
    onLimitReached: options.onLimitReached || null
  };

  return (req, res, next) => {
    stats.total_requests++;

    // Generate key (IP or custom)
    const key = config.keyGenerator(req);

    // Check blacklist
    if (blacklist.has(key)) {
      stats.blocked_requests++;
      return res.status(403).json({
        success: false,
        error: 'Your IP has been blacklisted due to excessive requests'
      });
    }

    // Get or create request tracker
    let tracker = requests.get(key);
    const now = Date.now();

    if (!tracker || now > tracker.resetTime) {
      // New window
      tracker = {
        count: 0,
        resetTime: now + config.windowMs,
        violations: 0
      };
      requests.set(key, tracker);
    }

    // Increment count
    tracker.count++;

    // Calculate remaining
    const remaining = Math.max(0, config.max - tracker.count);

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': config.max,
      'X-RateLimit-Remaining': remaining,
      'X-RateLimit-Reset': new Date(tracker.resetTime).toISOString()
    });

    // Check if limit exceeded
    if (tracker.count > config.max) {
      stats.blocked_requests++;
      tracker.violations++;

      // Auto-blacklist after multiple violations
      if (tracker.violations >= 3) {
        blacklist.add(key);
        stats.blacklisted_ips++;
        console.log(`[RateLimit] Blacklisted ${key} after ${tracker.violations} violations`);
      }

      // Callback
      if (config.onLimitReached) {
        config.onLimitReached(req, key, tracker);
      }

      return config.handler(req, res);
    }

    // Continue
    next();
  };
};

/**
 * Default key generator (use IP)
 * @private
 */
function defaultKeyGenerator(req) {
  return req.ip || req.connection.remoteAddress;
}

/**
 * Default handler for rate limit exceeded
 * @private
 */
function defaultHandler(req, res) {
  return res.status(429).json({
    success: false,
    error: 'Too many requests, please try again later',
    retryAfter: res.get('X-RateLimit-Reset')
  });
}

/**
 * Clear all rate limit data
 */
rateLimit.clear = () => {
  requests.clear();
  console.log('[RateLimit] Cleared all tracking data');
};

/**
 * Clear specific key
 */
rateLimit.clearKey = (key) => {
  requests.delete(key);
  blacklist.delete(key);
  console.log(`[RateLimit] Cleared key: ${key}`);
};

/**
 * Add to blacklist
 */
rateLimit.blacklist = (key) => {
  blacklist.add(key);
  stats.blacklisted_ips++;
  console.log(`[RateLimit] Blacklisted: ${key}`);
};

/**
 * Remove from blacklist
 */
rateLimit.unblacklist = (key) => {
  if (blacklist.delete(key)) {
    stats.blacklisted_ips--;
    console.log(`[RateLimit] Removed from blacklist: ${key}`);
    return true;
  }
  return false;
};

/**
 * Get statistics
 */
rateLimit.getStats = () => {
  const topClients = Array.from(requests.entries())
    .map(([key, tracker]) => ({
      key,
      count: tracker.count,
      violations: tracker.violations,
      resetTime: new Date(tracker.resetTime).toISOString()
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    ...stats,
    active_clients: requests.size,
    blacklisted: Array.from(blacklist),
    top_clients: topClients
  };
};

/**
 * Cleanup expired entries
 */
rateLimit.cleanup = () => {
  let removed = 0;
  const now = Date.now();

  for (const [key, tracker] of requests.entries()) {
    if (now > tracker.resetTime) {
      requests.delete(key);
      removed++;
    }
  }

  if (removed > 0) {
    console.log(`[RateLimit] Cleaned up ${removed} expired entries`);
  }

  return removed;
};

// Auto-cleanup every 5 minutes
setInterval(() => {
  rateLimit.cleanup();
}, 5 * 60 * 1000);

module.exports = rateLimit;