import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  OfflineCacheService, 
  CacheErrorHandlingService, 
  CacheStatusService,
  CacheStatus 
} from '../services/offlineCacheService';

/**
 * Hook for offline cache management
 */
export function useOfflineCache() {
  const queryClient = useQueryClient();
  
  // Create service instances
  const offlineService = useMemo(() => new OfflineCacheService(queryClient), [queryClient]);
  const errorService = useMemo(() => new CacheErrorHandlingService(queryClient, offlineService), [queryClient, offlineService]);
  const statusService = useMemo(() => new CacheStatusService(queryClient, offlineService), [queryClient, offlineService]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      offlineService.destroy();
      errorService.destroy();
      statusService.destroy();
    };
  }, [offlineService, errorService, statusService]);
  
  /**
   * Store data for offline fallback
   */
  const storeFallbackData = useCallback((queryKey: readonly unknown[], data: any, ttl?: number) => {
    offlineService.storeFallbackData(queryKey, data, ttl);
  }, [offlineService]);
  
  /**
   * Get fallback data for offline use
   */
  const getFallbackData = useCallback((queryKey: readonly unknown[]) => {
    return offlineService.getFallbackData(queryKey);
  }, [offlineService]);
  
  /**
   * Serve data when offline
   */
  const serveOfflineData = useCallback(async (queryKey: readonly unknown[]) => {
    return offlineService.serveOfflineData(queryKey);
  }, [offlineService]);
  
  /**
   * Check if app is offline
   */
  const isOffline = useCallback(() => {
    return offlineService.isOffline();
  }, [offlineService]);
  
  /**
   * Force sync when coming back online
   */
  const forceSyncWhenOnline = useCallback(async () => {
    return offlineService.forceSyncWhenOnline();
  }, [offlineService]);
  
  /**
   * Register error callback for specific query
   */
  const registerErrorCallback = useCallback((queryKey: readonly unknown[], callback: (error: Error) => void) => {
    errorService.registerErrorCallback(queryKey, callback);
  }, [errorService]);
  
  /**
   * Unregister error callback
   */
  const unregisterErrorCallback = useCallback((queryKey: readonly unknown[]) => {
    errorService.unregisterErrorCallback(queryKey);
  }, [errorService]);
  
  /**
   * Get offline status
   */
  const getOfflineStatus = useCallback(() => {
    return offlineService.getOfflineStatus();
  }, [offlineService]);
  
  /**
   * Get error statistics
   */
  const getErrorStats = useCallback(() => {
    return errorService.getErrorStats();
  }, [errorService]);
  
  /**
   * Clean up expired fallback data
   */
  const cleanupExpiredData = useCallback(() => {
    offlineService.cleanupExpiredFallbackData();
  }, [offlineService]);
  
  return {
    // Offline data management
    storeFallbackData,
    getFallbackData,
    serveOfflineData,
    isOffline,
    forceSyncWhenOnline,
    cleanupExpiredData,
    
    // Error handling
    registerErrorCallback,
    unregisterErrorCallback,
    getErrorStats,
    
    // Status
    getOfflineStatus,
    
    // Service access
    services: {
      offlineService,
      errorService,
      statusService,
    },
  };
}

/**
 * Hook for cache status monitoring with UI indicators
 */
export function useCacheStatus() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CacheStatus | null>(null);
  
  // Create services
  const offlineService = useMemo(() => new OfflineCacheService(queryClient), [queryClient]);
  const statusService = useMemo(() => new CacheStatusService(queryClient, offlineService), [queryClient, offlineService]);
  
  // Subscribe to status changes
  useEffect(() => {
    // Get initial status
    setStatus(statusService.getCurrentStatus());
    
    // Subscribe to status updates
    const unsubscribe = statusService.subscribeToStatus((newStatus) => {
      setStatus(newStatus);
    });
    
    return () => {
      unsubscribe();
      offlineService.destroy();
      statusService.destroy();
    };
  }, [statusService, offlineService]);
  
  /**
   * Force status update
   */
  const forceUpdate = useCallback(() => {
    statusService.forceStatusUpdate();
  }, [statusService]);
  
  /**
   * Get status indicator props for UI components
   */
  const getStatusIndicator = useCallback(() => {
    if (!status) return { type: 'loading', message: 'Loading...', color: 'gray' };
    
    if (!status.isOnline) {
      return {
        type: 'offline',
        message: `Offline - ${status.offlineDataQueries} cached items available`,
        color: 'orange',
        details: `${status.queuedQueries} queries queued for sync`
      };
    }
    
    if (status.errorQueries > 0) {
      return {
        type: 'error',
        message: `${status.errorQueries} queries failed`,
        color: 'red',
        details: `Cache health: ${status.cacheHealth}%`
      };
    }
    
    if (status.loadingQueries > 0) {
      return {
        type: 'loading',
        message: `Loading ${status.loadingQueries} queries...`,
        color: 'blue',
        details: `${status.successfulQueries} queries cached`
      };
    }
    
    if (status.staleQueries > status.totalQueries * 0.5) {
      return {
        type: 'stale',
        message: 'Some data may be outdated',
        color: 'yellow',
        details: `${status.staleQueries} stale queries`
      };
    }
    
    return {
      type: 'online',
      message: 'All systems operational',
      color: 'green',
      details: `${status.successfulQueries} queries cached`
    };
  }, [status]);
  
  /**
   * Get detailed status for debugging
   */
  const getDetailedStatus = useCallback(() => {
    return status;
  }, [status]);
  
  return {
    status,
    forceUpdate,
    getStatusIndicator,
    getDetailedStatus,
    isOnline: status?.isOnline ?? true,
    isLoading: status?.loadingQueries > 0,
    hasErrors: status?.errorQueries > 0,
    cacheHealth: status?.cacheHealth ?? 100,
  };
}

/**
 * Hook for handling offline-aware queries
 */
export function useOfflineQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options?: {
    fallbackTTL?: number;
    enableOfflineServing?: boolean;
    onOfflineData?: (data: T) => void;
    onError?: (error: Error) => void;
  }
) {
  const queryClient = useQueryClient();
  const { storeFallbackData, serveOfflineData, isOffline, registerErrorCallback, unregisterErrorCallback } = useOfflineCache();
  
  const {
    fallbackTTL = 24 * 60 * 60 * 1000, // 24 hours
    enableOfflineServing = true,
    onOfflineData,
    onError
  } = options || {};
  
  // Register error callback
  useEffect(() => {
    if (onError) {
      registerErrorCallback(queryKey, onError);
      return () => unregisterErrorCallback(queryKey);
    }
  }, [queryKey, onError, registerErrorCallback, unregisterErrorCallback]);
  
  // Enhanced query function with offline support
  const enhancedQueryFn = useCallback(async (): Promise<T> => {
    try {
      // If offline and offline serving is enabled, try to serve cached data
      if (isOffline() && enableOfflineServing) {
        try {
          const offlineData = await serveOfflineData(queryKey);
          if (offlineData && onOfflineData) {
            onOfflineData(offlineData);
          }
          return offlineData;
        } catch (offlineError) {
          console.warn('Failed to serve offline data, throwing original error');
          throw new Error('No offline data available');
        }
      }
      
      // Execute the original query function
      const data = await queryFn();
      
      // Store successful data as fallback for offline use
      if (data) {
        storeFallbackData(queryKey, data, fallbackTTL);
      }
      
      return data;
    } catch (error) {
      // If online but query failed, try to serve stale data as fallback
      if (!isOffline() && enableOfflineServing) {
        try {
          const fallbackData = await serveOfflineData(queryKey);
          if (fallbackData) {
            console.warn('Query failed, serving stale data as fallback');
            if (onOfflineData) {
              onOfflineData(fallbackData);
            }
            return fallbackData;
          }
        } catch (fallbackError) {
          // No fallback available, throw original error
        }
      }
      
      throw error;
    }
  }, [queryFn, queryKey, isOffline, enableOfflineServing, serveOfflineData, storeFallbackData, fallbackTTL, onOfflineData]);
  
  return {
    queryFn: enhancedQueryFn,
    isOffline: isOffline(),
  };
}

/**
 * Hook for offline-aware mutations
 */
export function useOfflineMutation<T, V>(
  mutationFn: (variables: V) => Promise<T>,
  options?: {
    onOfflineQueue?: (variables: V) => void;
    onError?: (error: Error, variables: V) => void;
  }
) {
  const { isOffline } = useOfflineCache();
  const [offlineQueue, setOfflineQueue] = useState<Array<{ variables: V; timestamp: number }>>([]);
  
  const { onOfflineQueue, onError } = options || {};
  
  // Enhanced mutation function with offline support
  const enhancedMutationFn = useCallback(async (variables: V): Promise<T> => {
    try {
      // If offline, queue the mutation
      if (isOffline()) {
        const queueEntry = { variables, timestamp: Date.now() };
        setOfflineQueue(prev => [...prev, queueEntry]);
        
        if (onOfflineQueue) {
          onOfflineQueue(variables);
        }
        
        throw new Error('Mutation queued for offline - will retry when online');
      }
      
      // Execute the mutation
      const result = await mutationFn(variables);
      return result;
    } catch (error) {
      if (onError) {
        onError(error as Error, variables);
      }
      throw error;
    }
  }, [mutationFn, isOffline, onOfflineQueue, onError]);
  
  // Process offline queue when coming back online
  useEffect(() => {
    const handleOnline = async () => {
      if (offlineQueue.length > 0 && !isOffline()) {
        console.log(`Processing ${offlineQueue.length} offline mutations...`);
        
        // Process queued mutations
        for (const queueEntry of offlineQueue) {
          try {
            await mutationFn(queueEntry.variables);
            console.log('Offline mutation processed successfully');
          } catch (error) {
            console.error('Failed to process offline mutation:', error);
            if (onError) {
              onError(error as Error, queueEntry.variables);
            }
          }
        }
        
        // Clear the queue
        setOfflineQueue([]);
      }
    };
    
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [offlineQueue, isOffline, mutationFn, onError]);
  
  return {
    mutationFn: enhancedMutationFn,
    offlineQueue,
    isOffline: isOffline(),
    queuedMutations: offlineQueue.length,
  };
}

/**
 * Hook for cache fallback mechanisms
 */
export function useCacheFallback() {
  const queryClient = useQueryClient();
  
  /**
   * Create fallback query that serves stale data on error
   */
  const createFallbackQuery = useCallback(<T>(
    queryKey: readonly unknown[],
    queryFn: () => Promise<T>,
    fallbackData?: T
  ) => {
    return {
      queryKey,
      queryFn: async (): Promise<T> => {
        try {
          return await queryFn();
        } catch (error) {
          // Try to get stale data from cache
          const staleData = queryClient.getQueryData<T>(queryKey);
          if (staleData) {
            console.warn('Query failed, serving stale data');
            return staleData;
          }
          
          // Use provided fallback data
          if (fallbackData !== undefined) {
            console.warn('Query failed, serving fallback data');
            return fallbackData;
          }
          
          // No fallback available
          throw error;
        }
      },
      staleTime: 0, // Always consider stale to allow fallback
      retry: false, // Don't retry, use fallback instead
    };
  }, [queryClient]);
  
  /**
   * Create graceful degradation query that returns partial data on error
   */
  const createGracefulQuery = useCallback(<T extends Record<string, any>>(
    queryKey: readonly unknown[],
    queryFn: () => Promise<T>,
    essentialFields: (keyof T)[]
  ) => {
    return {
      queryKey,
      queryFn: async (): Promise<Partial<T>> => {
        try {
          return await queryFn();
        } catch (error) {
          // Try to get cached data and return only essential fields
          const cachedData = queryClient.getQueryData<T>(queryKey);
          if (cachedData) {
            const essentialData: Partial<T> = {};
            essentialFields.forEach(field => {
              if (cachedData[field] !== undefined) {
                essentialData[field] = cachedData[field];
              }
            });
            
            if (Object.keys(essentialData).length > 0) {
              console.warn('Query failed, serving essential cached data');
              return essentialData;
            }
          }
          
          throw error;
        }
      },
    };
  }, [queryClient]);
  
  return {
    createFallbackQuery,
    createGracefulQuery,
  };
}