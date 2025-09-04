import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { queryKeys, invalidateQueries, cacheWarming } from '../lib/queryClient';
import { CacheInvalidationService, BackgroundRefreshService } from '../services/cacheInvalidationService';
import { CacheWarmingService } from '../services/cacheWarmingService';

/**
 * Hook for cache invalidation with smart invalidation strategies
 */
export function useCacheInvalidation() {
  const queryClient = useQueryClient();
  
  // Create invalidation service instance
  const invalidationService = useMemo(() => 
    new CacheInvalidationService(queryClient), 
    [queryClient]
  );
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      invalidationService.destroy();
    };
  }, [invalidationService]);
  
  // Smart invalidation based on mutation type
  const invalidateByMutation = useCallback((mutationType: string, userId?: string, additionalData?: any) => {
    console.log(`Invalidating cache for mutation: ${mutationType}`);
    
    switch (mutationType) {
      case 'userPreferences':
        if (userId) {
          // Invalidate user preferences and related dashboard data
          queryClient.invalidateQueries({ queryKey: queryKeys.user.preferences(userId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.essential.all });
          
          // Warm cache with new preferences
          setTimeout(() => {
            cacheWarming.warmFrequentData(userId);
          }, 500);
        }
        break;
        
      case 'userProfile':
        if (userId) {
          // Invalidate user profile and essential data
          queryClient.invalidateQueries({ queryKey: queryKeys.user.profile(userId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.essential.userProfile(userId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.essential.userInfo(userId) });
        }
        break;
        
      case 'dashboardData':
        // Invalidate all dashboard data but keep user data
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
        break;
        
      case 'radioStatus':
        // Invalidate real-time radio data
        queryClient.invalidateQueries({ queryKey: queryKeys.realtime.radioStatus() });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.secondary.radioStatus() });
        break;
        
      case 'adminData':
        // Invalidate admin-specific data
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
        break;
        
      case 'staticData':
        // Rarely needed - invalidate static data
        queryClient.invalidateQueries({ queryKey: queryKeys.static.all });
        break;
        
      default:
        console.warn(`Unknown mutation type for cache invalidation: ${mutationType}`);
    }
  }, [queryClient]);
  
  // Selective invalidation for specific data types
  const invalidateSpecific = useCallback({
    dashboard: () => invalidateQueries.dashboard(),
    dashboardEssential: () => invalidateQueries.dashboardEssential(),
    dashboardSecondary: () => invalidateQueries.dashboardSecondary(),
    dashboardOptional: () => invalidateQueries.dashboardOptional(),
    user: (userId: string) => invalidateQueries.user(userId),
    userPreferences: (userId: string) => invalidateQueries.userPreferences(userId),
    realtime: () => invalidateQueries.realtime(),
    admin: () => invalidateQueries.admin(),
    all: () => invalidateQueries.all(),
  }, []);
  
  // Batch invalidation for multiple related queries
  const invalidateBatch = useCallback((queryPatterns: string[], userId?: string) => {
    const promises = queryPatterns.map(pattern => {
      switch (pattern) {
        case 'user-related':
          return userId ? [
            queryClient.invalidateQueries({ queryKey: queryKeys.user.all }),
            queryClient.invalidateQueries({ queryKey: queryKeys.essential.userProfile(userId) }),
          ] : [];
        case 'dashboard-related':
          return [
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
          ];
        case 'realtime-related':
          return [
            queryClient.invalidateQueries({ queryKey: queryKeys.realtime.all }),
          ];
        default:
          return [];
      }
    }).flat();
    
    return Promise.all(promises);
  }, [queryClient]);
  
  // Enhanced invalidation methods using the service
  const invalidateWithDebounce = useCallback((queryKey: readonly unknown[], delay?: number) => {
    invalidationService.invalidateWithDebounce({ queryKey, delay });
  }, [invalidationService]);
  
  const cascadeInvalidate = useCallback((triggerKey: readonly unknown[], userId?: string, scope?: 'local' | 'user' | 'global') => {
    invalidationService.cascadeInvalidate({ triggerKey, userId, scope });
  }, [invalidationService]);
  
  const selectiveInvalidate = useCallback((config: {
    maxAge?: number;
    priority?: 'essential' | 'secondary' | 'optional';
    userId?: string;
    force?: boolean;
  }) => {
    invalidationService.selectiveInvalidate(config);
  }, [invalidationService]);
  
  const invalidateByMutationType = useCallback((config: {
    mutationType: string;
    mutationData?: any;
    userId?: string;
    refreshStrategy?: 'immediate' | 'background' | 'lazy';
  }) => {
    invalidationService.invalidateByMutation(config);
  }, [invalidationService]);

  return {
    invalidateByMutation,
    invalidateSpecific,
    invalidateBatch,
    // Enhanced invalidation methods
    invalidateWithDebounce,
    cascadeInvalidate,
    selectiveInvalidate,
    invalidateByMutationType,
    // Service access for advanced usage
    invalidationService,
    // Direct access to query client for custom invalidations
    queryClient,
  };
}

/**
 * Hook for background cache refresh with intelligent scheduling
 */
export function useBackgroundRefresh(userId?: string) {
  const queryClient = useQueryClient();
  
  // Create background refresh service instance
  const refreshService = useMemo(() => 
    new BackgroundRefreshService(queryClient), 
    [queryClient]
  );
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      refreshService.destroy();
    };
  }, [refreshService]);
  
  // Background refresh for stale data
  const refreshStaleData = useCallback(async () => {
    const cache = queryClient.getQueryCache();
    const staleQueries = cache.getAll().filter(query => query.isStale());
    
    if (staleQueries.length === 0) {
      console.log('No stale queries found');
      return;
    }
    
    console.log(`Refreshing ${staleQueries.length} stale queries in background`);
    
    // Prioritize essential data refresh
    const essentialStaleQueries = staleQueries.filter(query => 
      JSON.stringify(query.queryKey).includes('essential')
    );
    
    const secondaryStaleQueries = staleQueries.filter(query => 
      JSON.stringify(query.queryKey).includes('secondary')
    );
    
    const optionalStaleQueries = staleQueries.filter(query => 
      JSON.stringify(query.queryKey).includes('optional')
    );
    
    // Refresh in priority order with delays
    if (essentialStaleQueries.length > 0) {
      await Promise.all(
        essentialStaleQueries.map(query => 
          queryClient.refetchQueries({ queryKey: query.queryKey })
        )
      );
    }
    
    if (secondaryStaleQueries.length > 0) {
      setTimeout(async () => {
        await Promise.all(
          secondaryStaleQueries.map(query => 
            queryClient.refetchQueries({ queryKey: query.queryKey })
          )
        );
      }, 1000);
    }
    
    if (optionalStaleQueries.length > 0) {
      setTimeout(async () => {
        await Promise.all(
          optionalStaleQueries.map(query => 
            queryClient.refetchQueries({ queryKey: query.queryKey })
          )
        );
      }, 3000);
    }
  }, [queryClient]);
  
  // Refresh specific data types in background
  const refreshSpecific = useCallback({
    dashboard: async (userId: string) => {
      console.log('Background refresh: dashboard data');
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.dashboard.essential.metrics(userId) }),
        queryClient.refetchQueries({ queryKey: queryKeys.dashboard.essential.userInfo(userId) }),
      ]);
      
      // Refresh secondary data with delay
      setTimeout(async () => {
        await Promise.all([
          queryClient.refetchQueries({ queryKey: queryKeys.dashboard.secondary.topSongs(userId) }),
          queryClient.refetchQueries({ queryKey: queryKeys.dashboard.secondary.artistData(userId) }),
        ]);
      }, 2000);
    },
    
    userPreferences: async (userId: string) => {
      console.log('Background refresh: user preferences');
      await queryClient.refetchQueries({ queryKey: queryKeys.user.preferences(userId) });
    },
    
    realtime: async () => {
      console.log('Background refresh: real-time data');
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.realtime.radioStatus() }),
        queryClient.refetchQueries({ queryKey: queryKeys.realtime.liveMetrics(userId || '') }),
      ]);
    },
  }, [queryClient, userId]);
  
  // Intelligent refresh based on user activity
  const refreshByActivity = useCallback(async (activityType: string) => {
    switch (activityType) {
      case 'dashboard-view':
        if (userId) {
          await refreshSpecific.dashboard(userId);
        }
        break;
      case 'preferences-change':
        if (userId) {
          await refreshSpecific.userPreferences(userId);
          // Also refresh dashboard as preferences affect it
          setTimeout(() => refreshSpecific.dashboard(userId), 1000);
        }
        break;
      case 'realtime-focus':
        await refreshSpecific.realtime();
        break;
      default:
        console.log(`Unknown activity type for refresh: ${activityType}`);
    }
  }, [refreshSpecific, userId]);
  
  // Setup automatic background refresh intervals
  useEffect(() => {
    if (!userId) return;
    
    // Refresh stale data every 5 minutes
    const staleRefreshInterval = setInterval(refreshStaleData, 5 * 60 * 1000);
    
    // Refresh real-time data every 2 minutes
    const realtimeRefreshInterval = setInterval(() => {
      refreshSpecific.realtime();
    }, 2 * 60 * 1000);
    
    // Refresh user preferences every 30 minutes
    const preferencesRefreshInterval = setInterval(() => {
      refreshSpecific.userPreferences(userId);
    }, 30 * 60 * 1000);
    
    return () => {
      clearInterval(staleRefreshInterval);
      clearInterval(realtimeRefreshInterval);
      clearInterval(preferencesRefreshInterval);
    };
  }, [userId, refreshStaleData, refreshSpecific]);
  
  // Enhanced refresh methods using the service
  const setupPeriodicRefresh = useCallback((config: {
    queryKey: readonly unknown[];
    interval: number;
    condition?: () => boolean;
    priority?: 'high' | 'medium' | 'low';
  }) => {
    refreshService.setupPeriodicRefresh(config);
  }, [refreshService]);
  
  const setupSmartRefresh = useCallback((activityPatterns: string[]) => {
    if (userId) {
      refreshService.setupSmartRefresh({ userId, activityPatterns });
    }
  }, [refreshService, userId]);
  
  const refreshStaleDataAdvanced = useCallback((config: {
    maxAge?: number;
    priority?: 'essential' | 'secondary' | 'optional' | 'all';
    userId?: string;
  }) => {
    return refreshService.refreshStaleData(config);
  }, [refreshService]);

  return {
    refreshStaleData,
    refreshSpecific,
    refreshByActivity,
    // Enhanced refresh methods
    setupPeriodicRefresh,
    setupSmartRefresh,
    refreshStaleDataAdvanced,
    // Service access for advanced usage
    refreshService,
  };
}

/**
 * Hook for cache warming strategies
 */
export function useCacheWarming(userId?: string) {
  const queryClient = useQueryClient();
  
  // Create cache warming service instance
  const warmingService = useMemo(() => 
    new CacheWarmingService(queryClient), 
    [queryClient]
  );
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      warmingService.destroy();
    };
  }, [warmingService]);
  
  // Warm cache on user login
  const warmOnLogin = useCallback(async (userId: string) => {
    console.log('Warming cache on user login...');
    await cacheWarming.warmFrequentData(userId);
  }, []);
  
  // Warm cache based on navigation patterns
  const warmOnNavigation = useCallback(async (route: string, userId?: string) => {
    if (!userId) return;
    
    switch (route) {
      case '/dashboard':
        // Pre-warm dashboard data
        await cacheWarming.warmFrequentData(userId);
        break;
      case '/admin':
        // Pre-warm admin data
        await queryClient.prefetchQuery({
          queryKey: queryKeys.admin.insights(),
          staleTime: 5 * 60 * 1000,
        });
        break;
      case '/reports':
        // Pre-warm analytics data
        await queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard.optional.analytics(userId),
          staleTime: 10 * 60 * 1000,
        });
        break;
    }
  }, [queryClient]);
  
  // Predictive cache warming based on user behavior
  const warmPredictive = useCallback(async (userBehavior: string[]) => {
    if (!userId) return;
    
    console.log('Predictive cache warming based on user behavior:', userBehavior);
    await cacheWarming.warmByUserBehavior(userId, userBehavior);
  }, [userId]);
  
  // Warm cache during idle time
  const warmDuringIdle = useCallback(async () => {
    if (!userId) return;
    
    // Use requestIdleCallback if available, otherwise setTimeout
    const warmingTask = async () => {
      console.log('Warming cache during idle time...');
      
      // Warm optional data that might be needed later
      await queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.optional.recommendations(userId),
        staleTime: 30 * 60 * 1000,
      });
      
      await queryClient.prefetchQuery({
        queryKey: queryKeys.static.genres(),
        staleTime: 60 * 60 * 1000,
      });
    };
    
    if ('requestIdleCallback' in window) {
      requestIdleCallback(warmingTask, { timeout: 5000 });
    } else {
      setTimeout(warmingTask, 2000);
    }
  }, [queryClient, userId]);
  
  // Enhanced warming methods using the service
  const warmOnLoginAdvanced = useCallback(async (userId: string, userProfile?: any) => {
    return warmingService.warmOnLogin(userId, userProfile);
  }, [warmingService]);
  
  const warmBasedOnBehavior = useCallback(async (userId: string, patterns: string[]) => {
    return warmingService.warmBasedOnBehavior(userId, patterns);
  }, [warmingService]);
  
  const warmOnNavigationAdvanced = useCallback(async (route: string, userId?: string) => {
    return warmingService.warmOnNavigation(route, userId);
  }, [warmingService]);
  
  const warmPredictiveAdvanced = useCallback(async (userId: string, context?: {
    timeOfDay?: 'morning' | 'afternoon' | 'evening';
    dayOfWeek?: 'weekday' | 'weekend';
    userActivity?: 'high' | 'medium' | 'low';
  }) => {
    return warmingService.warmPredictive(userId, context);
  }, [warmingService]);
  
  const warmFrequentlyAccessed = useCallback(async (userId: string) => {
    return warmingService.warmFrequentlyAccessed(userId);
  }, [warmingService]);
  
  const updateBehaviorPatterns = useCallback((userId: string, patterns: string[]) => {
    warmingService.updateUserBehaviorPatterns(userId, patterns);
  }, [warmingService]);

  return {
    warmOnLogin,
    warmOnNavigation,
    warmPredictive,
    warmDuringIdle,
    // Enhanced warming methods
    warmOnLoginAdvanced,
    warmBasedOnBehavior,
    warmOnNavigationAdvanced,
    warmPredictiveAdvanced,
    warmFrequentlyAccessed,
    updateBehaviorPatterns,
    // Service access for advanced usage
    warmingService,
  };
}

/**
 * Hook for monitoring cache performance and health
 */
export function useCacheMonitoring() {
  const queryClient = useQueryClient();
  
  // Get current cache statistics
  const getCacheStats = useCallback(() => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const stats = {
      totalQueries: queries.length,
      successfulQueries: queries.filter(q => q.state.status === 'success').length,
      errorQueries: queries.filter(q => q.state.status === 'error').length,
      loadingQueries: queries.filter(q => q.state.status === 'loading').length,
      staleQueries: queries.filter(q => q.isStale()).length,
      freshQueries: queries.filter(q => !q.isStale()).length,
      cacheHitRate: 0,
      memoryUsage: queries.length * 1024, // Rough estimate
    };
    
    // Calculate cache hit rate
    const totalDataUpdates = queries.reduce((sum, q) => sum + (q.state.dataUpdateCount || 0), 0);
    const totalFetches = queries.reduce((sum, q) => sum + (q.state.fetchFailureCount || 0) + 1, 0);
    stats.cacheHitRate = totalFetches > 0 ? ((totalDataUpdates / totalFetches) * 100) : 0;
    
    return stats;
  }, [queryClient]);
  
  // Monitor cache health and log warnings
  const monitorCacheHealth = useCallback(() => {
    const stats = getCacheStats();
    
    // Log warnings for potential issues
    if (stats.errorQueries > stats.totalQueries * 0.1) {
      console.warn(`High error rate in cache: ${stats.errorQueries}/${stats.totalQueries} queries failed`);
    }
    
    if (stats.staleQueries > stats.totalQueries * 0.5) {
      console.warn(`Many stale queries: ${stats.staleQueries}/${stats.totalQueries} queries are stale`);
    }
    
    if (stats.cacheHitRate < 50) {
      console.warn(`Low cache hit rate: ${stats.cacheHitRate.toFixed(2)}%`);
    }
    
    return stats;
  }, [getCacheStats]);
  
  // Clean up cache when memory usage is high
  const cleanupCache = useCallback(() => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    // Remove error queries older than 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const errorQueriesToRemove = queries.filter(q => 
      q.state.status === 'error' && 
      q.state.errorUpdatedAt < fiveMinutesAgo
    );
    
    errorQueriesToRemove.forEach(query => {
      cache.remove(query);
    });
    
    // Remove stale optional queries older than 1 hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const staleOptionalQueries = queries.filter(q => 
      q.isStale() && 
      JSON.stringify(q.queryKey).includes('optional') &&
      q.state.dataUpdatedAt < oneHourAgo
    );
    
    staleOptionalQueries.forEach(query => {
      cache.remove(query);
    });
    
    console.log(`Cache cleanup: removed ${errorQueriesToRemove.length + staleOptionalQueries.length} queries`);
  }, [queryClient]);
  
  return {
    getCacheStats,
    monitorCacheHealth,
    cleanupCache,
  };
}