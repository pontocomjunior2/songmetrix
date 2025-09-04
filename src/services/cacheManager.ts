import { QueryClient } from '@tanstack/react-query';
import { queryKeys, cacheWarming, invalidateQueries } from '../lib/queryClient';

/**
 * Cache Manager Service - Centralized cache management with intelligent strategies
 */
export class CacheManager {
  private queryClient: QueryClient;
  private refreshIntervals: Map<string, NodeJS.Timeout> = new Map();
  private warmingQueue: Set<string> = new Set();
  
  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.setupGlobalCacheListeners();
  }
  
  /**
   * Setup global cache event listeners for monitoring and optimization
   */
  private setupGlobalCacheListeners() {
    // Monitor cache size and cleanup when needed
    setInterval(() => {
      this.monitorCacheHealth();
    }, 5 * 60 * 1000); // Every 5 minutes
    
    // Setup visibility change listener for background refresh
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.handleVisibilityChange();
      }
    });
    
    // Setup online/offline listeners
    window.addEventListener('online', () => {
      this.handleOnlineStatusChange(true);
    });
    
    window.addEventListener('offline', () => {
      this.handleOnlineStatusChange(false);
    });
  }
  
  /**
   * Handle visibility change - refresh stale data when user returns
   */
  private async handleVisibilityChange() {
    console.log('App became visible - checking for stale data...');
    
    const cache = this.queryClient.getQueryCache();
    const staleQueries = cache.getAll().filter(query => query.isStale());
    
    if (staleQueries.length > 0) {
      console.log(`Found ${staleQueries.length} stale queries - refreshing...`);
      
      // Prioritize essential queries
      const essentialStaleQueries = staleQueries.filter(query => 
        JSON.stringify(query.queryKey).includes('essential')
      );
      
      // Refresh essential queries immediately
      if (essentialStaleQueries.length > 0) {
        await Promise.all(
          essentialStaleQueries.map(query => 
            this.queryClient.refetchQueries({ queryKey: query.queryKey })
          )
        );
      }
      
      // Refresh other stale queries with delay
      const otherStaleQueries = staleQueries.filter(query => 
        !JSON.stringify(query.queryKey).includes('essential')
      );
      
      if (otherStaleQueries.length > 0) {
        setTimeout(async () => {
          await Promise.all(
            otherStaleQueries.slice(0, 5).map(query => // Limit to 5 queries at once
              this.queryClient.refetchQueries({ queryKey: query.queryKey })
            )
          );
        }, 2000);
      }
    }
  }
  
  /**
   * Handle online/offline status changes
   */
  private handleOnlineStatusChange(isOnline: boolean) {
    if (isOnline) {
      console.log('App came online - refreshing failed queries...');
      
      // Retry failed queries when coming back online
      const cache = this.queryClient.getQueryCache();
      const failedQueries = cache.getAll().filter(query => 
        query.state.status === 'error'
      );
      
      if (failedQueries.length > 0) {
        console.log(`Retrying ${failedQueries.length} failed queries...`);
        
        failedQueries.forEach(query => {
          // Retry with exponential backoff
          setTimeout(() => {
            this.queryClient.refetchQueries({ queryKey: query.queryKey });
          }, Math.random() * 2000); // Random delay to avoid thundering herd
        });
      }
    } else {
      console.log('App went offline - pausing background refresh...');
      
      // Clear all refresh intervals when offline
      this.refreshIntervals.forEach(interval => clearInterval(interval));
      this.refreshIntervals.clear();
    }
  }
  
  /**
   * Monitor cache health and perform cleanup
   */
  private monitorCacheHealth() {
    const cache = this.queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const stats = {
      total: queries.length,
      successful: queries.filter(q => q.state.status === 'success').length,
      error: queries.filter(q => q.state.status === 'error').length,
      stale: queries.filter(q => q.isStale()).length,
    };
    
    console.log('Cache Health Stats:', stats);
    
    // Cleanup old error queries
    if (stats.error > 10) {
      this.cleanupErrorQueries();
    }
    
    // Cleanup if cache is getting too large
    if (stats.total > 100) {
      this.cleanupOldQueries();
    }
    
    // Log warning if too many stale queries
    if (stats.stale > stats.total * 0.5) {
      console.warn(`High number of stale queries: ${stats.stale}/${stats.total}`);
    }
  }
  
  /**
   * Cleanup old error queries
   */
  private cleanupErrorQueries() {
    const cache = this.queryClient.getQueryCache();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    
    const oldErrorQueries = cache.getAll().filter(query => 
      query.state.status === 'error' && 
      query.state.errorUpdatedAt < fiveMinutesAgo
    );
    
    oldErrorQueries.forEach(query => {
      cache.remove(query);
    });
    
    if (oldErrorQueries.length > 0) {
      console.log(`Cleaned up ${oldErrorQueries.length} old error queries`);
    }
  }
  
  /**
   * Cleanup old queries to prevent memory issues
   */
  private cleanupOldQueries() {
    const cache = this.queryClient.getQueryCache();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    // Remove old optional queries
    const oldOptionalQueries = cache.getAll().filter(query => 
      JSON.stringify(query.queryKey).includes('optional') &&
      query.state.dataUpdatedAt < oneHourAgo &&
      query.isStale()
    );
    
    oldOptionalQueries.forEach(query => {
      cache.remove(query);
    });
    
    if (oldOptionalQueries.length > 0) {
      console.log(`Cleaned up ${oldOptionalQueries.length} old optional queries`);
    }
  }
  
  /**
   * Intelligent cache invalidation based on mutation type and context
   */
  public invalidateByContext(context: {
    type: string;
    userId?: string;
    affectedData?: string[];
    priority?: 'high' | 'medium' | 'low';
  }) {
    const { type, userId, affectedData = [], priority = 'medium' } = context;
    
    console.log(`Cache invalidation - Type: ${type}, Priority: ${priority}`, { userId, affectedData });
    
    switch (type) {
      case 'user-login':
        if (userId) {
          // Invalidate all user-related data on login
          this.queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
          this.queryClient.invalidateQueries({ queryKey: queryKeys.essential.all });
          
          // Warm cache for new user session
          setTimeout(() => {
            cacheWarming.warmFrequentData(userId);
          }, 500);
        }
        break;
        
      case 'user-logout':
        // Clear all cache on logout
        this.queryClient.clear();
        break;
        
      case 'preferences-update':
        if (userId) {
          // Invalidate preferences and related dashboard data
          this.queryClient.invalidateQueries({ queryKey: queryKeys.user.preferences(userId) });
          this.queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.essential.all });
          
          // Refresh dashboard data in background
          setTimeout(() => {
            this.queryClient.refetchQueries({ queryKey: queryKeys.dashboard.essential.metrics(userId) });
          }, 1000);
        }
        break;
        
      case 'data-mutation':
        // Invalidate specific data based on affected data types
        affectedData.forEach(dataType => {
          switch (dataType) {
            case 'dashboard':
              this.queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
              break;
            case 'user-profile':
              if (userId) {
                this.queryClient.invalidateQueries({ queryKey: queryKeys.user.profile(userId) });
              }
              break;
            case 'realtime':
              this.queryClient.invalidateQueries({ queryKey: queryKeys.realtime.all });
              break;
            case 'admin':
              this.queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
              break;
          }
        });
        break;
        
      case 'network-error':
        // Don't invalidate on network errors, keep stale data
        console.log('Network error - keeping stale data available');
        break;
        
      default:
        console.warn(`Unknown invalidation context type: ${type}`);
    }
  }
  
  /**
   * Setup background refresh for specific query patterns
   */
  public setupBackgroundRefresh(config: {
    queryPattern: string;
    interval: number;
    userId?: string;
    condition?: () => boolean;
  }) {
    const { queryPattern, interval, userId, condition } = config;
    const refreshKey = `${queryPattern}-${userId || 'global'}`;
    
    // Clear existing interval if any
    if (this.refreshIntervals.has(refreshKey)) {
      clearInterval(this.refreshIntervals.get(refreshKey)!);
    }
    
    // Setup new interval
    const intervalId = setInterval(() => {
      // Check condition if provided
      if (condition && !condition()) {
        return;
      }
      
      // Check if app is visible and online
      if (document.hidden || !navigator.onLine) {
        return;
      }
      
      console.log(`Background refresh for pattern: ${queryPattern}`);
      
      switch (queryPattern) {
        case 'realtime':
          this.queryClient.refetchQueries({ queryKey: queryKeys.realtime.all });
          break;
        case 'dashboard-essential':
          if (userId) {
            this.queryClient.refetchQueries({ queryKey: queryKeys.dashboard.essential.all });
          }
          break;
        case 'user-preferences':
          if (userId) {
            this.queryClient.refetchQueries({ queryKey: queryKeys.user.preferences(userId) });
          }
          break;
        default:
          console.warn(`Unknown refresh pattern: ${queryPattern}`);
      }
    }, interval);
    
    this.refreshIntervals.set(refreshKey, intervalId);
    
    console.log(`Setup background refresh for ${queryPattern} every ${interval}ms`);
  }
  
  /**
   * Cache warming with intelligent prioritization
   */
  public async warmCache(config: {
    userId: string;
    priority: 'essential' | 'secondary' | 'optional' | 'all';
    force?: boolean;
  }) {
    const { userId, priority, force = false } = config;
    const warmingKey = `${userId}-${priority}`;
    
    // Prevent duplicate warming requests
    if (!force && this.warmingQueue.has(warmingKey)) {
      console.log(`Cache warming already in progress for ${warmingKey}`);
      return;
    }
    
    this.warmingQueue.add(warmingKey);
    
    try {
      console.log(`Starting cache warming - Priority: ${priority}, User: ${userId}`);
      
      switch (priority) {
        case 'essential':
          await cacheWarming.warmFrequentData(userId);
          break;
          
        case 'secondary':
          // Warm secondary data with delay
          setTimeout(async () => {
            await this.queryClient.prefetchQuery({
              queryKey: queryKeys.dashboard.secondary.topSongs(userId),
            });
            await this.queryClient.prefetchQuery({
              queryKey: queryKeys.dashboard.secondary.artistData(userId),
            });
          }, 1000);
          break;
          
        case 'optional':
          // Warm optional data with longer delay
          setTimeout(async () => {
            await this.queryClient.prefetchQuery({
              queryKey: queryKeys.dashboard.optional.recommendations(userId),
            });
          }, 3000);
          break;
          
        case 'all':
          await cacheWarming.warmFrequentData(userId);
          setTimeout(() => this.warmCache({ userId, priority: 'secondary' }), 2000);
          setTimeout(() => this.warmCache({ userId, priority: 'optional' }), 5000);
          break;
      }
      
      console.log(`Cache warming completed for ${priority}`);
    } catch (error) {
      console.error(`Cache warming failed for ${priority}:`, error);
    } finally {
      this.warmingQueue.delete(warmingKey);
    }
  }
  
  /**
   * Get cache performance metrics
   */
  public getCacheMetrics() {
    const cache = this.queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const metrics = {
      totalQueries: queries.length,
      successfulQueries: queries.filter(q => q.state.status === 'success').length,
      errorQueries: queries.filter(q => q.state.status === 'error').length,
      staleQueries: queries.filter(q => q.isStale()).length,
      freshQueries: queries.filter(q => !q.isStale()).length,
      memoryUsage: this.estimateMemoryUsage(queries),
      cacheHitRate: this.calculateCacheHitRate(queries),
      activeRefreshIntervals: this.refreshIntervals.size,
      warmingQueueSize: this.warmingQueue.size,
    };
    
    return metrics;
  }
  
  /**
   * Estimate memory usage of cache
   */
  private estimateMemoryUsage(queries: any[]): number {
    // Rough estimation based on query count and data size
    return queries.reduce((total, query) => {
      const dataSize = query.state.data ? JSON.stringify(query.state.data).length : 0;
      return total + dataSize;
    }, 0);
  }
  
  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(queries: any[]): number {
    const totalFetches = queries.reduce((sum, q) => {
      return sum + (q.state.fetchFailureCount || 0) + (q.state.dataUpdateCount || 0);
    }, 0);
    
    const cacheMisses = queries.reduce((sum, q) => {
      return sum + (q.state.fetchFailureCount || 0);
    }, 0);
    
    return totalFetches > 0 ? ((totalFetches - cacheMisses) / totalFetches) * 100 : 0;
  }
  
  /**
   * Cleanup and destroy cache manager
   */
  public destroy() {
    // Clear all intervals
    this.refreshIntervals.forEach(interval => clearInterval(interval));
    this.refreshIntervals.clear();
    
    // Clear warming queue
    this.warmingQueue.clear();
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('online', () => this.handleOnlineStatusChange(true));
    window.removeEventListener('offline', () => this.handleOnlineStatusChange(false));
    
    console.log('Cache manager destroyed');
  }
}