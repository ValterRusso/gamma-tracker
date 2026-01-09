/**
 * ============================================================================
 * CACHE MIDDLEWARE
 * ============================================================================
 * 
 * In-memory cache para responses HTTP
 * Reduz carga de cálculos pesados
 * 
 * FEATURES:
 * - TTL configurável
 * - Cache key baseado em URL + query params
 * - Clear cache manual ou por pattern
 * - Stats de hit/miss
 * 
 * USO:
 * router.get('/metrics', cache(5000), handler);  // Cache por 5s
 * router.get('/vol-surface', cache(10000), handler);  // Cache por 10s
 * 
 * CLEAR CACHE:
 * cache.clear();  // Limpar tudo
 * cache.clearKey('/metrics');  // Limpar específico
 * cache.getStats();  // Ver estatísticas
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

// In-memory cache storage
const cache = new Map();

// Cache stats
const stats = {
  hits: 0,
  misses: 0,
  size: 0
};

/**
 * Cache middleware factory
 * @param {number} ttl - Time to live em milliseconds
 * @returns {Function} Express middleware
 */
const cacheMiddleware = (ttl = 5000) => {
  return (req, res, next) => {
    // Generate cache key from method, path, and query
    const key = generateCacheKey(req);
    
    // Check cache
    const cached = cache.get(key);
    
    if (cached && Date.now() < cached.expires) {
      // Cache HIT
      stats.hits++;
      
      // Add cache header
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Expires', new Date(cached.expires).toISOString());
      
      return res.json(cached.data);
    }
    
    // Cache MISS
    stats.misses++;
    
    // Override res.json to cache response
    const originalJson = res.json.bind(res);
    
    res.json = (data) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const expires = Date.now() + ttl;
        
        cache.set(key, {
          data,
          expires,
          created: Date.now()
        });
        
        stats.size = cache.size;
        
        // Add cache headers
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Expires', new Date(expires).toISOString());
      }
      
      // Send response
      return originalJson(data);
    };
    
    next();
  };
};

/**
 * Generate cache key from request
 * @private
 */
function generateCacheKey(req) {
  const method = req.method;
  const path = req.path;
  const query = JSON.stringify(req.query);
  
  return `${method}:${path}:${query}`;
}

/**
 * Clear all cache
 */
cacheMiddleware.clear = () => {
  cache.clear();
  stats.size = 0;
  console.log('[Cache] Cleared all cache');
};

/**
 * Clear cache by pattern
 * @param {string} pattern - Pattern to match in cache keys
 */
cacheMiddleware.clearKey = (pattern) => {
  let cleared = 0;
  
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
      cleared++;
    }
  }
  
  stats.size = cache.size;
  console.log(`[Cache] Cleared ${cleared} keys matching "${pattern}"`);
  
  return cleared;
};

/**
 * Get cache statistics
 * @returns {Object}
 */
cacheMiddleware.getStats = () => {
  const total = stats.hits + stats.misses;
  const hitRate = total > 0 ? (stats.hits / total * 100).toFixed(2) : 0;
  
  return {
    hits: stats.hits,
    misses: stats.misses,
    hitRate: `${hitRate}%`,
    size: stats.size,
    entries: Array.from(cache.keys()).map(key => {
      const entry = cache.get(key);
      return {
        key,
        expires: new Date(entry.expires).toISOString(),
        age: ((Date.now() - entry.created) / 1000).toFixed(1) + 's'
      };
    })
  };
};

/**
 * Cleanup expired entries (run periodically)
 */
cacheMiddleware.cleanup = () => {
  let removed = 0;
  const now = Date.now();
  
  for (const [key, entry] of cache.entries()) {
    if (now >= entry.expires) {
      cache.delete(key);
      removed++;
    }
  }
  
  if (removed > 0) {
    stats.size = cache.size;
    console.log(`[Cache] Cleaned up ${removed} expired entries`);
  }
  
  return removed;
};

// Auto-cleanup every 5 minutes
setInterval(() => {
  cacheMiddleware.cleanup();
}, 5 * 60 * 1000);

module.exports = cacheMiddleware;