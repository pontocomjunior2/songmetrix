import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';

/**
 * Cache Invalidation Service - Advanced invalidation strategies with smart refresh
 */
export class CacheInvalidationService {
  private queryClient: QueryClient;
  private invalidationQueue: Map<string, NodeJS.Timeout> = new Map();
  private batchInvalidationTimeout: NodeJS.Timeout | null = null;
  private pendingInvalidations: Set<string> = new Set();
  
  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }
  
  /**
   * Smart invalidation with debouncing to prevent excessive invalidations
   */
  public invalidateWithDebounce(config: {
    queryKey: readonly unknown[];
    delay?: number;
    force?: boolean;
  }) {
    const { queryKey, delay = 500, force = false } = config;
    const keyString = JSON.stringify(queryKey);
    
    if (force) {
      // Immediate invalidation
      this.queryClient.invalidateQueries({ queryKey });
      return;
    }
    
    // Clear existing timeout for this key
    if (this.invalidationQueue.has(keyString)) {
      clearTimeout(this.invalidationQueue.get(keyString)!);
    }
    
    // Setup debounced invalidation
    const timeout = setTimeout(() => {
      console.log(`Debounced invalidation for key: ${keyString}`);
      this.queryClient.invalidateQueries({ queryKey });
      this.invalidationQueue.delete(keyString);
    }, delay);
    
    this.invalidationQueue.set(keyString, timeout);
  }
  
  /**
   * Batch invalidation - collect multiple invalidations and execute together
   */
  public batchInvalidate(queryKeys: readonly unknown[][]) {
    // Add to pending invalidations
    queryKeys.forEach(key => {
      this.pendingInvalidations.add(JSON.stringify(key));
    });
    
    // Clear existing batch timeout
    if (this.batchInvalidationTimeout) {
      clearTimeout(this.batchInvalidationTimeout);
    }
    
    // Setup batch execution
    this.batchInvalidationTimeout = setTimeout(() => {
      console.log(`Executing batch invalidation for ${this.pendingInvalidations.size} queries`);
      
      // Execute all pending invalidations
      const promises = Array.from(this.pendingInvalidations).map(keyString => {
        const queryKey = JSON.parse(keyString);
        return this.queryClient.invalidateQueries({ queryKey });
      });
      
      Promise.all(promises).then(() => {
        console.log('Batch invalidation completed');
      }).catch(error => {
        console.error('Batch invalidation failed:', error);
      });
      
      // Clear pending invalidations
      this.pendingInvalidations.clear();
      this.batchInvalidationTimeout = null;
    }, 100); // Short delay to collect multiple invalidations
  }
  
  /**
   * Cascade invalidation - invalidate related queries based on dependencies
   */
  public cascadeInvalidate(config: {
    triggerKey: readonly unknown[];
    userId?: string;
    scope?: 'local' | 'user' | 'global';
  }) {
    const { triggerKey, userId, scope = 'local' } = config;
    const keyString = JSON.stringify(triggerKey);
    
    console.log(`Cascade invalidation triggered by: ${keyString}, scope: ${scope}`);
    
    const invalidationsToExecute: readonly unknown[][] = [];
    
    // Determine cascade scope based on trigger key
    if (keyString.includes('user') && keyString.includes('preferences')) {
      // User preferences changed - invalidate related dashboard and user data
      if (userId) {
        invalidationsToExecute.push(
          queryKeys.user.preferences(userId),
          queryKeys.dashboard.essential.all,
          queryKeys.dashboard.secondary.all
        );
      }
    } else if (keyString.includes('user') && keyString.includes('profile')) {
      // User profile changed - invalidate user data and essential dashboard
      if (userId) {
        invalidationsToExecute.push(
          queryKeys.user.profile(userId),
          queryKeys.essential.userProfile(userId),
          queryKeys.dashboard.essential.userInfo(userId)
        );
      }
    } else if (keyString.includes('dashboard')) {
      // Dashboard data changed - invalidate all dashboard sections
      invalidationsToExecute.push(
        queryKeys.dashboard.all
      );
    } else if (keyString.includes('realtime')) {
      // Real-time data changed - invalidate real-time and related dashboard data
      invalidationsToExecute.push(
        queryKeys.realtime.all,
        queryKeys.dashboard.secondary.radioStatus()
      );
    } else if (keyString.includes('admin')) {
      // Admin data changed - invalidate admin queries
      invalidationsToExecute.push(
        queryKeys.admin.all
      );
    }
    
    // Apply scope restrictions
    if (scope === 'user' && userId) {
      // Only invalidate user-specific queries
      const userSpecificInvalidations = invalidationsToExecute.filter(key => 
        JSON.stringify(key).includes(userId)
      );
      this.batchInvalidate(userSpecificInvalidations);
    } else if (scope === 'global') {
      // Invalidate all related queries
      this.batchInvalidate(invalidationsToExecute);
    } else {
      // Local scope - only invalidate the trigger key
      this.queryClient.invalidateQueries({ queryKey: triggerKey });
    }
  }
  
  /**
   * Selective invalidation based on data freshness and priority
   */
  public selectiveInvalidate(config: {
    maxAge?: number;
    priority?: 'essential' | 'secondary' | 'optional';
    userId?: string;
    force?: boolean;
  }) {
    const { maxAge = 5 * 60 * 1000, priority, userId, force = false } = config;
    const cache = this.queryClient.getQueryCache();
    const now = Date.now();
    
    console.log(`Selective invalidation - Priority: ${priority}, MaxAge: ${maxAge}ms`);
    
    const queriesToInvalidate = cache.getAll().filter(query => {
      // Check age
      const age = now - query.state.dataUpdatedAt;
      const isOld = age > maxAge;
      
      // Check priority filter
      const keyString = JSON.stringify(query.queryKey);
      const matchesPriority = !priority || keyString.includes(priority);
      
      // Check user filter
      const matchesUser = !userId || keyString.includes(userId);
      
      // Only invalidate if conditions are met
      return (force || isOld) && matchesPriority && matchesUser;
    });
    
    if (queriesToInvalidate.length > 0) {
      console.log(`Selectively invalidating ${queriesToInvalidate.length} queries`);
      
      const queryKeys = queriesToInvalidate.map(query => query.queryKey);
      this.batchInvalidate(queryKeys);
    }
  }
  
  /**
   * Conditional invalidation based on custom predicates
   */
  public conditionalInvalidate(config: {
    condition: (query: any) => boolean;
    reason?: string;
  }) {
    const { condition, reason = 'Custom condition' } = config;
    const cache = this.queryClient.getQueryCache();
    
    const queriesToInvalidate = cache.getAll().filter(condition);
    
    if (queriesToInvalidate.length > 0) {
      console.log(`Conditional invalidation (${reason}): ${queriesToInvalidate.length} queries`);
      
      const queryKeys = queriesToInvalidate.map(query => query.queryKey);
      this.batchInvalidate(queryKeys);
    }
  }
  
  /**
   * Invalidate stale queries with intelligent refresh
   */
  public invalidateStaleWithRefresh(config: {
    refreshEssential?: boolean;
    refreshSecondary?: boolean;
    refreshOptional?: boolean;
    userId?: string;
  }) {
    const { 
      refreshEssential = true, 
      refreshSecondary = false, 
      refreshOptional = false,
      userId 
    } = config;
    
    const cache = this.queryClient.getQueryCache();
    const staleQueries = cache.getAll().filter(query => query.isStale());
    
    if (staleQueries.length === 0) {
      console.log('No stale queries found');
      return;
    }
    
    console.log(`Found ${staleQueries.length} stale queries`);
    
    // Categorize stale queries by priority
    const essentialStale = staleQueries.filter(q => 
      JSON.stringify(q.queryKey).includes('essential')
    );
    const secondaryStale = staleQueries.filter(q => 
      JSON.stringify(q.queryKey).includes('secondary')
    );
    const optionalStale = staleQueries.filter(q => 
      JSON.stringify(q.queryKey).includes('optional')
    );
    
    // Invalidate and refresh based on configuration
    if (refreshEssential && essentialStale.length > 0) {
      console.log(`Refreshing ${essentialStale.length} essential stale queries`);
      essentialStale.forEach(query => {
        this.queryClient.refetchQueries({ queryKey: query.queryKey });
      });
    }
    
    if (refreshSecondary && secondaryStale.length > 0) {
      console.log(`Refreshing ${secondaryStale.length} secondary stale queries`);
      setTimeout(() => {
        secondaryStale.forEach(query => {
          this.queryClient.refetchQueries({ queryKey: query.queryKey });
        });
      }, 1000);
    }
    
    if (refreshOptional && optionalStale.length > 0) {
      console.log(`Refreshing ${optionalStale.length} optional stale queries`);
      setTimeout(() => {
        optionalStale.forEach(query => {
          this.queryClient.refetchQueries({ queryKey: query.queryKey });
        });
      }, 3000);
    }
  }
  
  /**
   * Mutation-based invalidation with smart refresh
   */
  public invalidateByMutation(config: {
    mutationType: string;
    mutationData?: any;
    userId?: string;
    refreshStrategy?: 'immediate' | 'background' | 'lazy';
  }) {
    const { mutationType, mutationData, userId, refreshStrategy = 'background' } = config;
    
    console.log(`Mutation-based invalidation: ${mutationType}, strategy: ${refreshStrategy}`);
    
    const invalidationMap: Record<string, readonly unknown[][]> = {
      'user-preferences-update': userId ? [
        queryKeys.user.preferences(userId),
        queryKeys.dashboard.essential.all,
        queryKeys.dashboard.secondary.all
      ] : [],
      
      'user-profile-update': userId ? [
        queryKeys.user.profile(userId),
        queryKeys.essential.userProfile(userId),
        queryKeys.dashboard.essential.userInfo(userId)
      ] : [],
      
      'dashboard-data-update': [
        queryKeys.dashboard.all
      ],
      
      'realtime-data-update': [
        queryKeys.realtime.all,
        queryKeys.dashboard.secondary.radioStatus()
      ],
      
      'admin-data-update': [
        queryKeys.admin.all
      ],
      
      'static-data-update': [
        queryKeys.static.all
      ],
    };
    
    const keysToInvalidate = invalidationMap[mutationType] || [];
    
    if (keysToInvalidate.length === 0) {
      console.warn(`No invalidation mapping found for mutation type: ${mutationType}`);
      return;
    }
    
    // Execute invalidation based on strategy
    switch (refreshStrategy) {
      case 'immediate':
        // Invalidate and refetch immediately
        keysToInvalidate.forEach(key => {
          this.queryClient.refetchQueries({ queryKey: key });
        });
        break;
        
      case 'background':
        // Invalidate immediately, refetch in background
        this.batchInvalidate(keysToInvalidate);
        setTimeout(() => {
          keysToInvalidate.forEach(key => {
            this.queryClient.refetchQueries({ queryKey: key });
          });
        }, 500);
        break;
        
      case 'lazy':
        // Only invalidate, let components refetch when needed
        this.batchInvalidate(keysToInvalidate);
        break;
    }
  }
  
  /**
   * Get invalidation statistics
   */
  public getInvalidationStats() {
    return {
      pendingInvalidations: this.pendingInvalidations.size,
      queuedInvalidations: this.invalidationQueue.size,
      hasBatchTimeout: this.batchInvalidationTimeout !== null,
    };
  }
  
  /**
   * Clear all pending invalidations
   */
  public clearPendingInvalidations() {
    // Clear debounced invalidations
    this.invalidationQueue.forEach(timeout => clearTimeout(timeout));
    this.invalidationQueue.clear();
    
    // Clear batch invalidation
    if (this.batchInvalidationTimeout) {
      clearTimeout(this.batchInvalidationTimeout);
      this.batchInvalidationTimeout = null;
    }
    
    this.pendingInvalidations.clear();
    
    console.log('All pending invalidations cleared');
  }
  
  /**
   * Destroy the invalidation service
   */
  public destroy() {
    this.clearPendingInvalidations();
    console.log('Cache invalidation service destroyed');
  }
}

/**
 * Background refresh service for intelligent cache updates
 */
export class BackgroundRefreshService {
  private queryClient: QueryClient;
  private refreshIntervals: Map<string, NodeJS.Timeout> = new Map();
  private refreshQueue: Set<string> = new Set();
  
  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.setupVisibilityListener();
  }
  
  /**
   * Setup visibility change listener for smart refresh
   */
  private setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.handleAppBecameVisible();
      }
    });
  }
  
  /**
   * Handle app becoming visible - refresh stale data
   */
  private async handleAppBecameVisible() {
    console.log('App became visible - checking for refresh opportunities...');
    
    const cache = this.queryClient.getQueryCache();
    const staleQueries = cache.getAll().filter(query => query.isStale());
    
    if (staleQueries.length > 0) {
      // Prioritize essential queries for immediate refresh
      const essentialStale = staleQueries.filter(query => 
        JSON.stringify(query.queryKey).includes('essential')
      );
      
      if (essentialStale.length > 0) {
        console.log(`Refreshing ${essentialStale.length} essential stale queries`);
        await Promise.all(
          essentialStale.map(query => 
            this.queryClient.refetchQueries({ queryKey: query.queryKey })
          )
        );
      }
      
      // Refresh other stale queries with delay
      const otherStale = staleQueries.filter(query => 
        !JSON.stringify(query.queryKey).includes('essential')
      );
      
      if (otherStale.length > 0) {
        setTimeout(async () => {
          console.log(`Background refreshing ${otherStale.length} other stale queries`);
          await Promise.all(
            otherStale.slice(0, 5).map(query => // Limit concurrent refreshes
              this.queryClient.refetchQueries({ queryKey: query.queryKey })
            )
          );
        }, 2000);
      }
    }
  }
  
  /**
   * Setup periodic background refresh for specific queries
   */
  public setupPeriodicRefresh(config: {
    queryKey: readonly unknown[];
    interval: number;
    condition?: () => boolean;
    priority?: 'high' | 'medium' | 'low';
  }) {
    const { queryKey, interval, condition, priority = 'medium' } = config;
    const keyString = JSON.stringify(queryKey);
    
    // Clear existing interval
    if (this.refreshIntervals.has(keyString)) {
      clearInterval(this.refreshIntervals.get(keyString)!);
    }
    
    // Setup new interval with priority-based delays
    const baseDelay = priority === 'high' ? 0 : priority === 'medium' ? 1000 : 3000;
    
    const intervalId = setInterval(() => {
      // Check condition if provided
      if (condition && !condition()) {
        return;
      }
      
      // Check if app is visible and online
      if (document.hidden || !navigator.onLine) {
        return;
      }
      
      // Add to refresh queue to prevent concurrent refreshes
      if (this.refreshQueue.has(keyString)) {
        console.log(`Refresh already in progress for: ${keyString}`);
        return;
      }
      
      this.refreshQueue.add(keyString);
      
      setTimeout(() => {
        console.log(`Periodic background refresh: ${keyString}`);
        
        this.queryClient.refetchQueries({ queryKey })
          .then(() => {
            console.log(`Background refresh completed: ${keyString}`);
          })
          .catch(error => {
            console.error(`Background refresh failed: ${keyString}`, error);
          })
          .finally(() => {
            this.refreshQueue.delete(keyString);
          });
      }, baseDelay);
      
    }, interval);
    
    this.refreshIntervals.set(keyString, intervalId);
    
    console.log(`Setup periodic refresh for ${keyString} every ${interval}ms (priority: ${priority})`);
  }
  
  /**
   * Setup smart refresh based on user activity patterns
   */
  public setupSmartRefresh(config: {
    userId: string;
    activityPatterns: string[];
  }) {
    const { userId, activityPatterns } = config;
    
    console.log(`Setting up smart refresh for user ${userId}`, activityPatterns);
    
    // Setup refresh patterns based on user behavior
    if (activityPatterns.includes('dashboard-heavy')) {
      // Refresh dashboard data more frequently
      this.setupPeriodicRefresh({
        queryKey: queryKeys.dashboard.essential.metrics(userId),
        interval: 2 * 60 * 1000, // 2 minutes
        priority: 'high',
        condition: () => window.location.pathname.includes('/dashboard')
      });
    }
    
    if (activityPatterns.includes('realtime-user')) {
      // Refresh real-time data frequently
      this.setupPeriodicRefresh({
        queryKey: queryKeys.realtime.radioStatus(),
        interval: 30 * 1000, // 30 seconds
        priority: 'high',
        condition: () => !document.hidden
      });
    }
    
    if (activityPatterns.includes('admin-user')) {
      // Refresh admin data periodically
      this.setupPeriodicRefresh({
        queryKey: queryKeys.admin.insights(),
        interval: 5 * 60 * 1000, // 5 minutes
        priority: 'medium',
        condition: () => window.location.pathname.includes('/admin')
      });
    }
    
    // Always refresh user preferences periodically
    this.setupPeriodicRefresh({
      queryKey: queryKeys.user.preferences(userId),
      interval: 15 * 60 * 1000, // 15 minutes
      priority: 'low'
    });
  }
  
  /**
   * Refresh stale data intelligently
   */
  public async refreshStaleData(config: {
    maxAge?: number;
    priority?: 'essential' | 'secondary' | 'optional' | 'all';
    userId?: string;
  }) {
    const { maxAge = 10 * 60 * 1000, priority = 'all', userId } = config;
    const cache = this.queryClient.getQueryCache();
    const now = Date.now();
    
    const staleQueries = cache.getAll().filter(query => {
      const age = now - query.state.dataUpdatedAt;
      const isStale = query.isStale() || age > maxAge;
      
      // Filter by priority if specified
      if (priority !== 'all') {
        const keyString = JSON.stringify(query.queryKey);
        if (!keyString.includes(priority)) {
          return false;
        }
      }
      
      // Filter by user if specified
      if (userId) {
        const keyString = JSON.stringify(query.queryKey);
        if (!keyString.includes(userId)) {
          return false;
        }
      }
      
      return isStale;
    });
    
    if (staleQueries.length === 0) {
      console.log('No stale data found for refresh');
      return;
    }
    
    console.log(`Refreshing ${staleQueries.length} stale queries (priority: ${priority})`);
    
    // Refresh in batches to avoid overwhelming the server
    const batchSize = 3;
    for (let i = 0; i < staleQueries.length; i += batchSize) {
      const batch = staleQueries.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(query => 
          this.queryClient.refetchQueries({ queryKey: query.queryKey })
        )
      );
      
      // Small delay between batches
      if (i + batchSize < staleQueries.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log('Stale data refresh completed');
  }
  
  /**
   * Get refresh statistics
   */
  public getRefreshStats() {
    return {
      activeIntervals: this.refreshIntervals.size,
      refreshQueue: this.refreshQueue.size,
      intervals: Array.from(this.refreshIntervals.keys()),
    };
  }
  
  /**
   * Clear all refresh intervals
   */
  public clearAllRefreshes() {
    this.refreshIntervals.forEach(interval => clearInterval(interval));
    this.refreshIntervals.clear();
    this.refreshQueue.clear();
    
    console.log('All background refreshes cleared');
  }
  
  /**
   * Destroy the refresh service
   */
  public destroy() {
    this.clearAllRefreshes();
    document.removeEventListener('visibilitychange', this.handleAppBecameVisible);
    console.log('Background refresh service destroyed');
  }
}