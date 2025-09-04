/**
 * Response caching middleware for API endpoints
 * Implements in-memory caching with TTL and cache invalidation
 */

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  // Generate cache key from request
  generateKey(req) {
    const { method, originalUrl, user } = req;
    const userId = user?.id || 'anonymous';
    const query = JSON.stringify(req.query || {});
    const body = method === 'POST' ? JSON.stringify(req.body || {}) : '';
    
    return `${method}:${originalUrl}:${userId}:${query}:${body}`;
  }

  // Get cached response
  get(key) {
    const cached = this.cache.get(key);
    if (cached) {
      if (Date.now() < cached.expiresAt) {
        this.stats.hits++;
        return cached.data;
      } else {
        // Expired, remove from cache
        this.delete(key);
      }
    }
    this.stats.misses++;
    return null;
  }

  // Set cached response with TTL
  set(key, data, ttlMs = 300000) { // Default 5 minutes
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { data, expiresAt });
    this.stats.sets++;

    // Set cleanup timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttlMs);
    
    this.timers.set(key, timer);
  }

  // Delete cached entry
  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.stats.deletes++;
    }
    
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  // Clear all cache entries matching pattern
  invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    const keysToDelete = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.delete(key));
    return keysToDelete.length;
  }

  // Clear all cache
  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    this.cache.clear();
    this.timers.clear();
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  }

  // Get cache statistics
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests * 100).toFixed(2) : 0;
    
    return {
      ...this.stats,
      totalRequests,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size,
      memoryUsage: this.getMemoryUsage()
    };
  }

  // Estimate memory usage
  getMemoryUsage() {
    let totalSize = 0;
    for (const [key, value] of this.cache.entries()) {
      totalSize += key.length * 2; // Approximate string size
      totalSize += JSON.stringify(value.data).length * 2;
    }
    return `${(totalSize / 1024 / 1024).toFixed(2)} MB`;
  }
}

// Global cache instance
const cacheManager = new CacheManager();

// Cache configuration for different endpoints
const cacheConfigs = {
  '/api/dashboard': { ttl: 300000, enabled: true }, // 5 minutes
  '/api/dashboard/essential': { ttl: 180000, enabled: true }, // 3 minutes
  '/api/dashboard/secondary': { ttl: 300000, enabled: true }, // 5 minutes
  '/api/dashboard/optional': { ttl: 600000, enabled: true }, // 10 minutes
  '/api/dashboard-batch/batch': { ttl: 300000, enabled: true }, // 5 minutes
  '/api/streams': { ttl: 3600000, enabled: true }, // 1 hour
  '/api/radios': { ttl: 1800000, enabled: true }, // 30 minutes
};

// Get cache config for endpoint
function getCacheConfig(path) {
  // Find exact match first
  if (cacheConfigs[path]) {
    return cacheConfigs[path];
  }
  
  // Find pattern match
  for (const [pattern, config] of Object.entries(cacheConfigs)) {
    if (path.startsWith(pattern)) {
      return config;
    }
  }
  
  // Default config
  return { ttl: 300000, enabled: false };
}

// Cache middleware factory
export function createCacheMiddleware(options = {}) {
  const defaultOptions = {
    enabled: true,
    ttl: 300000, // 5 minutes
    skipCache: false,
    keyGenerator: null
  };
  
  const config = { ...defaultOptions, ...options };
  
  return (req, res, next) => {
    // Skip if caching is disabled
    if (!config.enabled) {
      return next();
    }
    
    // Skip for non-GET requests by default (unless explicitly enabled)
    if (req.method !== 'GET' && req.method !== 'POST') {
      return next();
    }
    
    // Get endpoint-specific config
    const endpointConfig = getCacheConfig(req.originalUrl);
    if (!endpointConfig.enabled) {
      return next();
    }
    
    // Generate cache key
    const cacheKey = config.keyGenerator ? 
      config.keyGenerator(req) : 
      cacheManager.generateKey(req);
    
    // Check for skip cache header
    if (req.headers['x-skip-cache'] || config.skipCache) {
      return next();
    }
    
    // Try to get cached response
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      console.log(`[Cache] HIT: ${cacheKey}`);
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Key', cacheKey);
      return res.json(cached);
    }
    
    console.log(`[Cache] MISS: ${cacheKey}`);
    
    // Store original res.json method
    const originalJson = res.json.bind(res);
    
    // Override res.json to cache the response
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const ttl = config.ttl || endpointConfig.ttl;
        cacheManager.set(cacheKey, data, ttl);
        console.log(`[Cache] SET: ${cacheKey} (TTL: ${ttl}ms)`);
      }
      
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);
      return originalJson(data);
    };
    
    next();
  };
}

// Cache invalidation middleware
export function createCacheInvalidationMiddleware(patterns = []) {
  return (req, res, next) => {
    // Store original methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    
    // Override response methods to invalidate cache on successful mutations
    const invalidateCache = () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        let totalInvalidated = 0;
        
        // Invalidate specific patterns
        patterns.forEach(pattern => {
          const count = cacheManager.invalidatePattern(pattern);
          totalInvalidated += count;
          console.log(`[Cache] Invalidated ${count} entries matching pattern: ${pattern}`);
        });
        
        // Auto-invalidate dashboard cache on data mutations
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
          const dashboardCount = cacheManager.invalidatePattern('/api/dashboard');
          totalInvalidated += dashboardCount;
          console.log(`[Cache] Auto-invalidated ${dashboardCount} dashboard cache entries`);
        }
        
        if (totalInvalidated > 0) {
          res.set('X-Cache-Invalidated', totalInvalidated.toString());
        }
      }
    };
    
    res.json = function(data) {
      invalidateCache();
      return originalJson(data);
    };
    
    res.send = function(data) {
      invalidateCache();
      return originalSend(data);
    };
    
    next();
  };
}

// Cache statistics endpoint middleware
export function cacheStatsMiddleware(req, res) {
  const stats = cacheManager.getStats();
  res.json({
    cache: stats,
    configs: cacheConfigs,
    timestamp: new Date().toISOString()
  });
}

// Cache management endpoints
export function createCacheManagementRoutes() {
  const router = express.Router();
  
  // Get cache stats
  router.get('/stats', cacheStatsMiddleware);
  
  // Clear all cache
  router.delete('/clear', (req, res) => {
    cacheManager.clear();
    res.json({ message: 'Cache cleared successfully' });
  });
  
  // Invalidate cache by pattern
  router.delete('/invalidate/:pattern', (req, res) => {
    const pattern = decodeURIComponent(req.params.pattern);
    const count = cacheManager.invalidatePattern(pattern);
    res.json({ 
      message: `Invalidated ${count} cache entries`,
      pattern,
      count
    });
  });
  
  return router;
}

// Export cache manager for direct access
export { cacheManager };

// Default export
export default {
  createCacheMiddleware,
  createCacheInvalidationMiddleware,
  cacheStatsMiddleware,
  createCacheManagementRoutes,
  cacheManager
};