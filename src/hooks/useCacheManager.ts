import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { CacheManager } from '../services/cacheManager';
import { CacheInvalidationService, BackgroundRefreshService } from '../services/cacheInvalidationService';
import { CacheWarmingService } from '../services/cacheWarmingService';

/**
 * Comprehensive cache management hook that integrates all cache services
 */
export function useCacheManager(userId?: string) {
  const queryClient = useQueryClient();
  
  // Create service instances
  const cacheManager = useMemo(() => new CacheManager(queryClient), [queryClient]);
  const invalidationService = useMemo(() => new CacheInvalidationService(queryClient), [queryClient]);
  const refreshService = useMemo(() => new BackgroundRefreshService(queryClient), [queryClient]);
  const warmingService = useMemo(() => new CacheWarmingService(queryClient), [queryClient]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cacheManager.destroy();
      invalidationService.destroy();
      refreshService.destroy();
      warmingService.destroy();
    };
  }, [cacheManager, invalidationService, refreshService, warmingService]);
  
  // Setup smart refresh patterns based on user behavior
  useEffect(() => {
    if (userId) {
      // Setup basic refresh patterns for all users
      refreshService.setupPeriodicRefresh({
        queryKey: ['user', 'preferences', userId],
        interval: 15 * 60 * 1000, // 15 minutes
        priority: 'low'
      });
      
      // Setup real-time data refresh
      refreshService.setupPeriodicRefresh({
        queryKey: ['realtime', 'radioStatus'],
        interval: 60 * 1000, // 1 minute
        priority: 'high',
        condition: () => !document.hidden && window.location.pathname.includes('/dashboard')
      });
    }
  }, [userId, refreshService]);
  
  /**
   * Initialize cache for a new user session
   */
  const initializeUserCache = useCallback(async (userId: string, userProfile?: any) => {
    console.log('Initializing cache for user session...');
    
    try {
      // 1. Clear any existing cache for different user
      await cacheManager.invalidateByContext({
        type: 'user-login',
        userId,
        priority: 'high'
      });
      
      // 2. Warm essential data
      await warmingService.warmOnLogin(userId, userProfile);
      
      // 3. Setup smart refresh patterns based on user profile
      if (userProfile) {
        const patterns = inferUserPatterns(userProfile);
        refreshService.setupSmartRefresh({ userId, activityPatterns: patterns });
        warmingService.updateUserBehaviorPatterns(userId, patterns);
      }
      
      console.log('User cache initialization completed');
    } catch (error) {
      console.error('User cache initialization failed:', error);
    }
  }, [cacheManager, warmingService, refreshService]);
  
  /**
   * Handle user logout - clear all cache
   */
  const handleUserLogout = useCallback(() => {
    console.log('Handling user logout - clearing cache...');
    
    cacheManager.invalidateByContext({
      type: 'user-logout',
      priority: 'high'
    });
    
    // Clear all background processes
    refreshService.clearAllRefreshes();
    warmingService.clearWarmingData();
    
    console.log('User logout cache cleanup completed');
  }, [cacheManager, refreshService, warmingService]);
  
  /**
   * Handle data mutations with smart invalidation
   */
  const handleMutation = useCallback((config: {
    type: string;
    data?: any;
    userId?: string;
    refreshStrategy?: 'immediate' | 'background' | 'lazy';
  }) => {
    const { type, data, userId: mutationUserId, refreshStrategy = 'background' } = config;
    const targetUserId = mutationUserId || userId;
    
    console.log(`Handling mutation: ${type} with strategy: ${refreshStrategy}`);
    
    // Use invalidation service for smart invalidation
    invalidationService.invalidateByMutation({
      mutationType: type,
      mutationData: data,
      userId: targetUserId,
      refreshStrategy
    });
    
    // Update behavior patterns if user data changed
    if (type.includes('user') && targetUserId && data) {
      const patterns = inferUserPatterns(data);
      warmingService.updateUserBehaviorPatterns(targetUserId, patterns);
    }
  }, [invalidationService, warmingService, userId]);
  
  /**
   * Handle navigation with predictive cache warming
   */
  const handleNavigation = useCallback(async (route: string, context?: any) => {
    if (!userId) return;
    
    console.log(`Handling navigation to: ${route}`);
    
    try {
      // Warm cache for the target route
      await warmingService.warmOnNavigation(route, userId);
      
      // Setup route-specific refresh patterns
      if (route.includes('/dashboard')) {
        refreshService.setupPeriodicRefresh({
          queryKey: ['dashboard', 'essential', 'metrics', userId],
          interval: 2 * 60 * 1000, // 2 minutes
          priority: 'high',
          condition: () => window.location.pathname.includes('/dashboard')
        });
      }
      
      console.log(`Navigation cache warming completed for: ${route}`);
    } catch (error) {
      console.error(`Navigation cache warming failed for: ${route}`, error);
    }
  }, [warmingService, refreshService, userId]);
  
  /**
   * Optimize cache performance
   */
  const optimizeCache = useCallback(async () => {
    console.log('Optimizing cache performance...');
    
    try {
      // Get current cache metrics
      const metrics = cacheManager.getCacheMetrics();
      console.log('Current cache metrics:', metrics);
      
      // Clean up if cache is getting large
      if (metrics.totalQueries > 100) {
        invalidationService.selectiveInvalidate({
          maxAge: 30 * 60 * 1000, // 30 minutes
          priority: 'optional',
          force: false
        });
      }
      
      // Refresh stale essential data
      if (metrics.staleQueries > 10) {
        await refreshService.refreshStaleData({
          priority: 'essential',
          userId
        });
      }
      
      // Warm frequently accessed data if cache hit rate is low
      if (metrics.cacheHitRate < 70 && userId) {
        await warmingService.warmFrequentlyAccessed(userId);
      }
      
      console.log('Cache optimization completed');
    } catch (error) {
      console.error('Cache optimization failed:', error);
    }
  }, [cacheManager, invalidationService, refreshService, warmingService, userId]);
  
  /**
   * Get comprehensive cache statistics
   */
  const getCacheStats = useCallback(() => {
    const managerStats = cacheManager.getCacheMetrics();
    const invalidationStats = invalidationService.getInvalidationStats();
    const refreshStats = refreshService.getRefreshStats();
    const warmingStats = warmingService.getWarmingStats();
    
    return {
      manager: managerStats,
      invalidation: invalidationStats,
      refresh: refreshStats,
      warming: warmingStats,
      overall: {
        totalQueries: managerStats.totalQueries,
        cacheHitRate: managerStats.cacheHitRate,
        memoryUsage: managerStats.memoryUsage,
        activeProcesses: invalidationStats.pendingInvalidations + 
                        refreshStats.activeIntervals + 
                        warmingStats.activeWarmingTasks,
      }
    };
  }, [cacheManager, invalidationService, refreshService, warmingService]);
  
  /**
   * Force refresh all user data
   */
  const forceRefreshUserData = useCallback(async () => {
    if (!userId) return;
    
    console.log('Force refreshing all user data...');
    
    try {
      // Invalidate all user-related queries
      invalidationService.cascadeInvalidate({
        triggerKey: ['user', 'all'],
        userId,
        scope: 'user'
      });
      
      // Refresh essential data immediately
      await refreshService.refreshStaleData({
        priority: 'essential',
        userId
      });
      
      console.log('Force refresh completed');
    } catch (error) {
      console.error('Force refresh failed:', error);
    }
  }, [invalidationService, refreshService, userId]);
  
  return {
    // Core management functions
    initializeUserCache,
    handleUserLogout,
    handleMutation,
    handleNavigation,
    optimizeCache,
    forceRefreshUserData,
    
    // Statistics and monitoring
    getCacheStats,
    
    // Direct service access for advanced usage
    services: {
      cacheManager,
      invalidationService,
      refreshService,
      warmingService,
    },
    
    // Query client access
    queryClient,
  };
}

/**
 * Infer user behavior patterns from profile data
 */
function inferUserPatterns(userProfile: any): string[] {
  const patterns: string[] = [];
  
  if (!userProfile) {
    return ['basic-user'];
  }
  
  // Role-based patterns
  if (userProfile.role === 'admin') {
    patterns.push('admin-user');
  }
  
  // Activity-based patterns
  if (userProfile.lastLoginDays < 7) {
    patterns.push('active-user');
  }
  
  if (userProfile.dashboardViews > 50) {
    patterns.push('dashboard-heavy');
  }
  
  if (userProfile.realtimeUsage > 0.7) {
    patterns.push('realtime-user');
  }
  
  if (userProfile.analyticsUsage > 0.5) {
    patterns.push('analytics-user');
  }
  
  // Usage frequency patterns
  if (userProfile.loginFrequency === 'daily') {
    patterns.push('frequent-user');
  } else if (userProfile.loginFrequency === 'weekly') {
    patterns.push('regular-user');
  } else {
    patterns.push('occasional-user');
  }
  
  return patterns.length > 0 ? patterns : ['basic-user'];
}

/**
 * Hook for cache performance monitoring
 */
export function useCacheMonitoring() {
  const queryClient = useQueryClient();
  
  const getCacheHealth = useCallback(() => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const health = {
      totalQueries: queries.length,
      successfulQueries: queries.filter(q => q.state.status === 'success').length,
      errorQueries: queries.filter(q => q.state.status === 'error').length,
      staleQueries: queries.filter(q => q.isStale()).length,
      loadingQueries: queries.filter(q => q.state.status === 'pending').length,
    };
    
    // Calculate health score (0-100)
    const successRate = health.totalQueries > 0 ? (health.successfulQueries / health.totalQueries) * 100 : 100;
    const staleRate = health.totalQueries > 0 ? (health.staleQueries / health.totalQueries) * 100 : 0;
    const errorRate = health.totalQueries > 0 ? (health.errorQueries / health.totalQueries) * 100 : 0;
    
    const healthScore = Math.max(0, successRate - (staleRate * 0.5) - (errorRate * 2));
    
    return {
      ...health,
      healthScore: Math.round(healthScore),
      status: healthScore > 80 ? 'excellent' : healthScore > 60 ? 'good' : healthScore > 40 ? 'fair' : 'poor'
    };
  }, [queryClient]);
  
  const logCacheHealth = useCallback(() => {
    const health = getCacheHealth();
    console.log('Cache Health Report:', health);
    
    if (health.healthScore < 60) {
      console.warn('Cache health is below optimal levels');
    }
    
    return health;
  }, [getCacheHealth]);
  
  return {
    getCacheHealth,
    logCacheHealth,
  };
}