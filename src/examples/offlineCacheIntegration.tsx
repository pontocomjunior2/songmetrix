import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineCache, useCacheStatus, useOfflineQuery, useOfflineMutation } from '../hooks/useOfflineCache';
import { CacheStatusIndicator, OfflineModeBanner, CacheErrorAlert } from '../components/CacheStatusIndicator';
import { queryKeys } from '../lib/queryClient';

/**
 * Example: Dashboard with Offline Support
 */
export function OfflineDashboard({ userId }: { userId: string }) {
  const { storeFallbackData, isOffline, forceSyncWhenOnline } = useOfflineCache();
  const { status, forceUpdate } = useCacheStatus();
  
  // Example: Offline-aware dashboard metrics query
  const { queryFn: offlineMetricsQueryFn } = useOfflineQuery(
    queryKeys.dashboard.essential.metrics(userId),
    async () => {
      const response = await fetch(`/api/dashboard/metrics/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    },
    {
      fallbackTTL: 6 * 60 * 60 * 1000, // 6 hours
      enableOfflineServing: true,
      onOfflineData: (data) => {
        console.log('Serving offline dashboard metrics:', data);
      },
      onError: (error) => {
        console.error('Dashboard metrics query failed:', error);
      }
    }
  );
  
  const metricsQuery = useQuery({
    queryKey: queryKeys.dashboard.essential.metrics(userId),
    queryFn: offlineMetricsQueryFn,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry if offline
      if (isOffline()) return false;
      return failureCount < 3;
    }
  });
  
  // Example: Offline-aware user preferences mutation
  const { mutationFn: offlinePreferencesMutationFn, queuedMutations } = useOfflineMutation(
    async (preferences: any) => {
      const response = await fetch(`/api/users/${userId}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });
      if (!response.ok) throw new Error('Failed to update preferences');
      return response.json();
    },
    {
      onOfflineQueue: (preferences) => {
        console.log('Preferences update queued for offline:', preferences);
        // Show user feedback that changes will sync when online
      },
      onError: (error, preferences) => {
        console.error('Failed to update preferences:', error);
      }
    }
  );
  
  const updatePreferencesMutation = useMutation({
    mutationFn: offlinePreferencesMutationFn,
    onSuccess: (data) => {
      // Store successful data as fallback
      storeFallbackData(queryKeys.user.preferences(userId), data);
      console.log('Preferences updated successfully');
    }
  });
  
  // Handle coming back online
  useEffect(() => {
    const handleOnline = () => {
      console.log('App came back online - syncing data...');
      forceSyncWhenOnline();
      forceUpdate();
    };
    
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [forceSyncWhenOnline, forceUpdate]);
  
  // Auto-store successful data as fallback
  useEffect(() => {
    if (metricsQuery.data && metricsQuery.isSuccess) {
      storeFallbackData(
        queryKeys.dashboard.essential.metrics(userId),
        metricsQuery.data,
        6 * 60 * 60 * 1000 // 6 hours TTL
      );
    }
  }, [metricsQuery.data, metricsQuery.isSuccess, storeFallbackData, userId]);
  
  const handleUpdatePreferences = (newPreferences: any) => {
    updatePreferencesMutation.mutate(newPreferences);
  };
  
  const handleRetryFailedQueries = () => {
    metricsQuery.refetch();
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Offline Mode Banner */}
      <OfflineModeBanner />
      
      {/* Cache Error Alert */}
      <CacheErrorAlert 
        onRetry={handleRetryFailedQueries}
        onDismiss={() => console.log('Dismissed error alert')}
      />
      
      {/* Main Dashboard Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          
          {/* Status Indicators */}
          <div className="flex items-center space-x-4">
            {isOffline() && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.366zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                </svg>
                Offline Mode
              </span>
            )}
            
            {queuedMutations > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {queuedMutations} changes queued
              </span>
            )}
          </div>
        </div>
        
        {/* Dashboard Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {metricsQuery.isLoading && (
            <div className="col-span-3 text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading dashboard metrics...</p>
            </div>
          )}
          
          {metricsQuery.error && !metricsQuery.data && (
            <div className="col-span-3 text-center py-8">
              <div className="text-red-600 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-gray-600 mb-4">Failed to load dashboard metrics</p>
              <button
                onClick={() => metricsQuery.refetch()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          )}
          
          {metricsQuery.data && (
            <>
              <MetricCard
                title="Total Plays"
                value={metricsQuery.data.totalPlays}
                isOfflineData={(metricsQuery.data as any)?._isOfflineData}
              />
              <MetricCard
                title="Active Users"
                value={metricsQuery.data.activeUsers}
                isOfflineData={(metricsQuery.data as any)?._isOfflineData}
              />
              <MetricCard
                title="Revenue"
                value={`$${metricsQuery.data.revenue}`}
                isOfflineData={(metricsQuery.data as any)?._isOfflineData}
              />
            </>
          )}
        </div>
        
        {/* Preferences Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Preferences</h2>
          
          <div className="space-y-4">
            <button
              onClick={() => handleUpdatePreferences({ theme: 'dark' })}
              disabled={updatePreferencesMutation.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {updatePreferencesMutation.isPending ? 'Updating...' : 'Switch to Dark Theme'}
            </button>
            
            {updatePreferencesMutation.error && (
              <p className="text-red-600 text-sm">
                Failed to update preferences: {updatePreferencesMutation.error.message}
              </p>
            )}
            
            {isOffline() && queuedMutations > 0 && (
              <p className="text-orange-600 text-sm">
                Your changes will be saved when you're back online.
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Cache Status Indicator */}
      <CacheStatusIndicator showDetails position="bottom-right" />
    </div>
  );
}

/**
 * Metric Card Component with Offline Indicator
 */
function MetricCard({ 
  title, 
  value, 
  isOfflineData = false 
}: { 
  title: string; 
  value: string | number; 
  isOfflineData?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6 relative">
      {isOfflineData && (
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.366zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
            </svg>
            Cached
          </span>
        </div>
      )}
      
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

/**
 * Example: Query with Graceful Degradation
 */
export function GracefulDashboard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { isOffline } = useOfflineCache();
  
  // Query with graceful degradation - returns partial data on error
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'graceful', userId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/dashboard/full/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch full dashboard');
        return response.json();
      } catch (error) {
        // Try to get cached data and return essential fields only
        const cachedData = queryClient.getQueryData(['dashboard', 'graceful', userId]);
        if (cachedData) {
          console.warn('Full dashboard failed, serving essential cached data');
          return {
            // Return only essential fields
            totalPlays: (cachedData as any).totalPlays || 0,
            activeUsers: (cachedData as any).activeUsers || 0,
            _isPartialData: true,
            _error: error.message
          };
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (isOffline()) return false;
      return failureCount < 2;
    }
  });
  
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Graceful Dashboard</h2>
      
      {dashboardQuery.data?._isPartialData && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
          <div className="flex">
            <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Showing partial data from cache. Some features may be unavailable.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {dashboardQuery.data && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm text-gray-500">Total Plays</h3>
            <p className="text-2xl font-bold">{dashboardQuery.data.totalPlays}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm text-gray-500">Active Users</h3>
            <p className="text-2xl font-bold">{dashboardQuery.data.activeUsers}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Example: App with Comprehensive Offline Support
 */
export function OfflineAwareApp() {
  const { isOnline, hasErrors, cacheHealth } = useCacheStatus();
  const { forceSyncWhenOnline, cleanupExpiredData } = useOfflineCache();
  
  // Cleanup expired data periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      cleanupExpiredData();
    }, 60 * 60 * 1000); // Every hour
    
    return () => clearInterval(cleanup);
  }, [cleanupExpiredData]);
  
  // Handle app coming back online
  useEffect(() => {
    const handleOnline = async () => {
      console.log('App came back online');
      await forceSyncWhenOnline();
    };
    
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [forceSyncWhenOnline]);
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Global Status Bar */}
      <div className={`px-4 py-2 text-sm ${
        !isOnline ? 'bg-orange-100 text-orange-800' :
        hasErrors ? 'bg-red-100 text-red-800' :
        cacheHealth < 70 ? 'bg-yellow-100 text-yellow-800' :
        'bg-green-100 text-green-800'
      }`}>
        <div className="flex justify-between items-center">
          <span>
            {!isOnline ? 'Offline Mode - Using cached data' :
             hasErrors ? 'Some data failed to load' :
             cacheHealth < 70 ? 'Performance degraded' :
             'All systems operational'}
          </span>
          <span>Cache Health: {cacheHealth}%</span>
        </div>
      </div>
      
      {/* Main App Content */}
      <div className="container mx-auto px-4 py-8">
        <OfflineDashboard userId="user123" />
      </div>
    </div>
  );
}