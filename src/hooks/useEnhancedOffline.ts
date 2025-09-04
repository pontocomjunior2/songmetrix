import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface OfflineState {
  isOffline: boolean;
  wasOffline: boolean;
  offlineDuration: number;
  lastOnlineTime: number;
  connectionType: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
}

interface OfflineQueueItem {
  id: string;
  type: 'query' | 'mutation';
  queryKey?: readonly unknown[];
  mutationFn?: () => Promise<any>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

interface UseEnhancedOfflineReturn {
  offlineState: OfflineState;
  queuedItems: OfflineQueueItem[];
  addToQueue: (item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>) => void;
  processQueue: () => Promise<void>;
  clearQueue: () => void;
  getOfflineData: (queryKey: readonly unknown[]) => any;
  storeOfflineData: (queryKey: readonly unknown[], data: any) => void;
  isSlowConnection: boolean;
  connectionQuality: 'good' | 'fair' | 'poor' | 'offline';
}

export const useEnhancedOffline = (): UseEnhancedOfflineReturn => {
  const queryClient = useQueryClient();
  const [offlineState, setOfflineState] = useState<OfflineState>({
    isOffline: !navigator.onLine,
    wasOffline: false,
    offlineDuration: 0,
    lastOnlineTime: Date.now(),
    connectionType: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0
  });

  const [queuedItems, setQueuedItems] = useState<OfflineQueueItem[]>([]);
  const offlineStartTime = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  // Get network information if available
  const getNetworkInfo = useCallback(() => {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      return {
        connectionType: connection.type || 'unknown',
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0
      };
    }
    
    return {
      connectionType: 'unknown',
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0
    };
  }, []);

  // Update offline state
  const updateOfflineState = useCallback(() => {
    const isCurrentlyOffline = !navigator.onLine;
    const networkInfo = getNetworkInfo();
    const now = Date.now();

    setOfflineState(prev => {
      let offlineDuration = prev.offlineDuration;
      let lastOnlineTime = prev.lastOnlineTime;
      let wasOffline = prev.wasOffline;

      if (isCurrentlyOffline && !prev.isOffline) {
        // Just went offline
        offlineStartTime.current = now;
        wasOffline = true;
      } else if (!isCurrentlyOffline && prev.isOffline) {
        // Just came back online
        if (offlineStartTime.current) {
          offlineDuration = now - offlineStartTime.current;
        }
        lastOnlineTime = now;
        offlineStartTime.current = null;
      } else if (isCurrentlyOffline && offlineStartTime.current) {
        // Still offline, update duration
        offlineDuration = now - offlineStartTime.current;
      }

      return {
        isOffline: isCurrentlyOffline,
        wasOffline,
        offlineDuration,
        lastOnlineTime,
        ...networkInfo
      };
    });
  }, [getNetworkInfo]);

  // Setup event listeners
  useEffect(() => {
    const handleOnline = () => {
      updateOfflineState();
      processQueue();
    };

    const handleOffline = () => {
      updateOfflineState();
    };

    const handleConnectionChange = () => {
      updateOfflineState();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Update state periodically
    intervalRef.current = setInterval(updateOfflineState, 5000);

    // Initial state update
    updateOfflineState();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [updateOfflineState]);

  // Add item to offline queue
  const addToQueue = useCallback((item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>) => {
    const queueItem: OfflineQueueItem = {
      ...item,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0
    };

    setQueuedItems(prev => [...prev, queueItem]);
  }, []);

  // Process offline queue
  const processQueue = useCallback(async () => {
    if (offlineState.isOffline || queuedItems.length === 0) {
      return;
    }

    console.log(`Processing ${queuedItems.length} items from offline queue`);

    const itemsToProcess = [...queuedItems];
    const failedItems: OfflineQueueItem[] = [];

    for (const item of itemsToProcess) {
      try {
        if (item.type === 'query' && item.queryKey) {
          await queryClient.refetchQueries({ queryKey: item.queryKey });
        } else if (item.type === 'mutation' && item.mutationFn) {
          await item.mutationFn();
        }

        console.log(`Successfully processed queue item: ${item.id}`);
      } catch (error) {
        console.error(`Failed to process queue item ${item.id}:`, error);
        
        const updatedItem = {
          ...item,
          retryCount: item.retryCount + 1
        };

        if (updatedItem.retryCount < updatedItem.maxRetries) {
          failedItems.push(updatedItem);
        } else {
          console.warn(`Max retries reached for queue item: ${item.id}`);
        }
      }
    }

    setQueuedItems(failedItems);
  }, [offlineState.isOffline, queuedItems, queryClient]);

  // Clear offline queue
  const clearQueue = useCallback(() => {
    setQueuedItems([]);
  }, []);

  // Get offline data from localStorage
  const getOfflineData = useCallback((queryKey: readonly unknown[]) => {
    try {
      const key = `offline_${JSON.stringify(queryKey)}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if data is not too old (24 hours)
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.data;
        } else {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Failed to get offline data:', error);
    }
    return null;
  }, []);

  // Store data for offline use
  const storeOfflineData = useCallback((queryKey: readonly unknown[], data: any) => {
    try {
      const key = `offline_${JSON.stringify(queryKey)}`;
      const toStore = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(toStore));
    } catch (error) {
      console.error('Failed to store offline data:', error);
    }
  }, []);

  // Determine if connection is slow
  const isSlowConnection = offlineState.effectiveType === 'slow-2g' || 
                          offlineState.effectiveType === '2g' ||
                          (offlineState.downlink > 0 && offlineState.downlink < 0.5);

  // Determine connection quality
  const connectionQuality: 'good' | 'fair' | 'poor' | 'offline' = 
    offlineState.isOffline ? 'offline' :
    offlineState.effectiveType === '4g' || offlineState.downlink > 2 ? 'good' :
    offlineState.effectiveType === '3g' || offlineState.downlink > 0.5 ? 'fair' : 'poor';

  return {
    offlineState,
    queuedItems,
    addToQueue,
    processQueue,
    clearQueue,
    getOfflineData,
    storeOfflineData,
    isSlowConnection,
    connectionQuality
  };
};

// Hook for managing offline-first queries
export const useOfflineFirstQuery = <T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options: {
    staleTime?: number;
    cacheTime?: number;
    fallbackData?: T;
    enableOfflineQueue?: boolean;
  } = {}
) => {
  const { 
    offlineState, 
    addToQueue, 
    getOfflineData, 
    storeOfflineData 
  } = useEnhancedOffline();

  const queryClient = useQueryClient();

  const query = queryClient.useQuery({
    queryKey,
    queryFn: async () => {
      if (offlineState.isOffline) {
        // Try to get offline data
        const offlineData = getOfflineData(queryKey);
        if (offlineData) {
          return offlineData;
        }
        
        // If no offline data and fallback provided, use fallback
        if (options.fallbackData) {
          return options.fallbackData;
        }
        
        throw new Error('No offline data available');
      }

      // Online - fetch fresh data
      const data = await queryFn();
      
      // Store for offline use
      storeOfflineData(queryKey, data);
      
      return data;
    },
    staleTime: options.staleTime || 5 * 60 * 1000, // 5 minutes
    cacheTime: options.cacheTime || 30 * 60 * 1000, // 30 minutes
    retry: (failureCount, error) => {
      // Don't retry if offline
      if (offlineState.isOffline) {
        // Add to queue for retry when online
        if (options.enableOfflineQueue) {
          addToQueue({
            type: 'query',
            queryKey,
            maxRetries: 3
          });
        }
        return false;
      }
      
      // Retry network errors
      return failureCount < 2;
    },
    onError: (error) => {
      console.error('Query failed:', error);
      
      // Try to serve offline data on error
      if (!offlineState.isOffline) {
        const offlineData = getOfflineData(queryKey);
        if (offlineData) {
          queryClient.setQueryData(queryKey, offlineData);
        }
      }
    }
  });

  return {
    ...query,
    isOffline: offlineState.isOffline,
    isUsingOfflineData: query.data && offlineState.isOffline,
    connectionQuality: offlineState.effectiveType
  };
};

// Hook for connection-aware data fetching
export const useConnectionAwareQuery = <T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options: {
    lowBandwidthFn?: () => Promise<Partial<T>>;
    highBandwidthFn?: () => Promise<T>;
    adaptToConnection?: boolean;
  } = {}
) => {
  const { offlineState, connectionQuality, isSlowConnection } = useEnhancedOffline();

  const adaptedQueryFn = useCallback(async (): Promise<T> => {
    if (!options.adaptToConnection) {
      return queryFn();
    }

    // Use low bandwidth version for poor connections
    if (isSlowConnection && options.lowBandwidthFn) {
      console.log('Using low bandwidth query due to slow connection');
      return options.lowBandwidthFn() as Promise<T>;
    }

    // Use high bandwidth version for good connections
    if (connectionQuality === 'good' && options.highBandwidthFn) {
      return options.highBandwidthFn();
    }

    // Default query function
    return queryFn();
  }, [queryFn, options, isSlowConnection, connectionQuality]);

  return useOfflineFirstQuery(queryKey, adaptedQueryFn, {
    enableOfflineQueue: true,
    staleTime: isSlowConnection ? 10 * 60 * 1000 : 5 * 60 * 1000 // Longer stale time for slow connections
  });
};