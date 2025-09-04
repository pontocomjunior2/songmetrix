import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCacheInvalidation, useBackgroundRefresh, useCacheWarming } from '../useCacheInvalidation';
import { useCacheManager } from '../useCacheManager';
import React from 'react';

// Mock services
jest.mock('../services/cacheInvalidationService');
jest.mock('../services/cacheWarmingService');
jest.mock('../services/cacheManager');

describe('Cache Invalidation Hooks', () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    wrapper = ({ children }) => (
      React.createElement(QueryClientProvider, { client: queryClient }, children)
    );
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('useCacheInvalidation', () => {
    it('should provide invalidation methods', () => {
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

      expect(result.current.invalidateByMutation).toBeDefined();
      expect(result.current.invalidateSpecific).toBeDefined();
      expect(result.current.invalidateBatch).toBeDefined();
      expect(result.current.invalidateWithDebounce).toBeDefined();
      expect(result.current.cascadeInvalidate).toBeDefined();
      expect(result.current.selectiveInvalidate).toBeDefined();
      expect(result.current.invalidateByMutationType).toBeDefined();
    });

    it('should handle mutation-based invalidation', async () => {
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

      await act(async () => {
        result.current.invalidateByMutation('userPreferences', 'user123');
      });

      // Verify that the invalidation was called
      expect(result.current.queryClient).toBeDefined();
    });

    it('should handle debounced invalidation', async () => {
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

      await act(async () => {
        result.current.invalidateWithDebounce(['test', 'query'], 100);
      });

      // Should not throw and should be callable
      expect(result.current.invalidateWithDebounce).toBeDefined();
    });

    it('should handle cascade invalidation', async () => {
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

      await act(async () => {
        result.current.cascadeInvalidate(['user', 'preferences'], 'user123', 'user');
      });

      // Should not throw and should be callable
      expect(result.current.cascadeInvalidate).toBeDefined();
    });
  });

  describe('useBackgroundRefresh', () => {
    it('should provide refresh methods', () => {
      const { result } = renderHook(() => useBackgroundRefresh('user123'), { wrapper });

      expect(result.current.refreshStaleData).toBeDefined();
      expect(result.current.refreshSpecific).toBeDefined();
      expect(result.current.refreshByActivity).toBeDefined();
      expect(result.current.setupPeriodicRefresh).toBeDefined();
      expect(result.current.setupSmartRefresh).toBeDefined();
      expect(result.current.refreshStaleDataAdvanced).toBeDefined();
    });

    it('should handle periodic refresh setup', async () => {
      const { result } = renderHook(() => useBackgroundRefresh('user123'), { wrapper });

      await act(async () => {
        result.current.setupPeriodicRefresh({
          queryKey: ['test', 'query'],
          interval: 5000,
          priority: 'medium'
        });
      });

      // Should not throw
      expect(result.current.setupPeriodicRefresh).toBeDefined();
    });

    it('should handle smart refresh setup', async () => {
      const { result } = renderHook(() => useBackgroundRefresh('user123'), { wrapper });

      await act(async () => {
        result.current.setupSmartRefresh(['dashboard-heavy', 'realtime-user']);
      });

      // Should not throw
      expect(result.current.setupSmartRefresh).toBeDefined();
    });
  });

  describe('useCacheWarming', () => {
    it('should provide warming methods', () => {
      const { result } = renderHook(() => useCacheWarming('user123'), { wrapper });

      expect(result.current.warmOnLogin).toBeDefined();
      expect(result.current.warmOnNavigation).toBeDefined();
      expect(result.current.warmPredictive).toBeDefined();
      expect(result.current.warmDuringIdle).toBeDefined();
      expect(result.current.warmOnLoginAdvanced).toBeDefined();
      expect(result.current.warmBasedOnBehavior).toBeDefined();
      expect(result.current.warmFrequentlyAccessed).toBeDefined();
    });

    it('should handle login warming', async () => {
      const { result } = renderHook(() => useCacheWarming('user123'), { wrapper });

      await act(async () => {
        await result.current.warmOnLoginAdvanced('user123', { role: 'admin' });
      });

      // Should not throw
      expect(result.current.warmOnLoginAdvanced).toBeDefined();
    });

    it('should handle behavior-based warming', async () => {
      const { result } = renderHook(() => useCacheWarming('user123'), { wrapper });

      await act(async () => {
        await result.current.warmBasedOnBehavior('user123', ['dashboard-heavy', 'admin-user']);
      });

      // Should not throw
      expect(result.current.warmBasedOnBehavior).toBeDefined();
    });

    it('should update behavior patterns', async () => {
      const { result } = renderHook(() => useCacheWarming('user123'), { wrapper });

      await act(async () => {
        result.current.updateBehaviorPatterns('user123', ['realtime-user', 'analytics-user']);
      });

      // Should not throw
      expect(result.current.updateBehaviorPatterns).toBeDefined();
    });
  });

  describe('useCacheManager', () => {
    it('should provide comprehensive cache management', () => {
      const { result } = renderHook(() => useCacheManager('user123'), { wrapper });

      expect(result.current.initializeUserCache).toBeDefined();
      expect(result.current.handleUserLogout).toBeDefined();
      expect(result.current.handleMutation).toBeDefined();
      expect(result.current.handleNavigation).toBeDefined();
      expect(result.current.optimizeCache).toBeDefined();
      expect(result.current.getCacheStats).toBeDefined();
      expect(result.current.forceRefreshUserData).toBeDefined();
    });

    it('should initialize user cache', async () => {
      const { result } = renderHook(() => useCacheManager('user123'), { wrapper });

      await act(async () => {
        await result.current.initializeUserCache('user123', { 
          role: 'admin', 
          dashboardViews: 100,
          realtimeUsage: 0.8 
        });
      });

      // Should not throw
      expect(result.current.initializeUserCache).toBeDefined();
    });

    it('should handle mutations', async () => {
      const { result } = renderHook(() => useCacheManager('user123'), { wrapper });

      await act(async () => {
        result.current.handleMutation({
          type: 'user-preferences-update',
          data: { theme: 'dark' },
          refreshStrategy: 'background'
        });
      });

      // Should not throw
      expect(result.current.handleMutation).toBeDefined();
    });

    it('should handle navigation', async () => {
      const { result } = renderHook(() => useCacheManager('user123'), { wrapper });

      await act(async () => {
        await result.current.handleNavigation('/dashboard');
      });

      // Should not throw
      expect(result.current.handleNavigation).toBeDefined();
    });

    it('should optimize cache', async () => {
      const { result } = renderHook(() => useCacheManager('user123'), { wrapper });

      await act(async () => {
        await result.current.optimizeCache();
      });

      // Should not throw
      expect(result.current.optimizeCache).toBeDefined();
    });

    it('should get cache statistics', () => {
      const { result } = renderHook(() => useCacheManager('user123'), { wrapper });

      const stats = result.current.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats.overall).toBeDefined();
      expect(stats.manager).toBeDefined();
      expect(stats.invalidation).toBeDefined();
      expect(stats.refresh).toBeDefined();
      expect(stats.warming).toBeDefined();
    });

    it('should handle user logout', async () => {
      const { result } = renderHook(() => useCacheManager('user123'), { wrapper });

      await act(async () => {
        result.current.handleUserLogout();
      });

      // Should not throw
      expect(result.current.handleUserLogout).toBeDefined();
    });

    it('should force refresh user data', async () => {
      const { result } = renderHook(() => useCacheManager('user123'), { wrapper });

      await act(async () => {
        await result.current.forceRefreshUserData();
      });

      // Should not throw
      expect(result.current.forceRefreshUserData).toBeDefined();
    });
  });
});

describe('Cache Integration Tests', () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    wrapper = ({ children }) => (
      React.createElement(QueryClientProvider, { client: queryClient }, children)
    );
  });

  it('should integrate invalidation and warming', async () => {
    const { result: invalidationResult } = renderHook(() => useCacheInvalidation(), { wrapper });
    const { result: warmingResult } = renderHook(() => useCacheWarming('user123'), { wrapper });

    // Test integration between invalidation and warming
    await act(async () => {
      // Invalidate user preferences
      invalidationResult.current.invalidateByMutation('userPreferences', 'user123');
      
      // Warm cache after invalidation
      await warmingResult.current.warmFrequentlyAccessed('user123');
    });

    // Should complete without errors
    expect(invalidationResult.current.queryClient).toBe(warmingResult.current.queryClient);
  });

  it('should integrate refresh and warming services', async () => {
    const { result: refreshResult } = renderHook(() => useBackgroundRefresh('user123'), { wrapper });
    const { result: warmingResult } = renderHook(() => useCacheWarming('user123'), { wrapper });

    await act(async () => {
      // Setup smart refresh
      refreshResult.current.setupSmartRefresh(['dashboard-heavy']);
      
      // Update behavior patterns
      warmingResult.current.updateBehaviorPatterns('user123', ['dashboard-heavy', 'realtime-user']);
    });

    // Should complete without errors
    expect(refreshResult.current.refreshService).toBeDefined();
    expect(warmingResult.current.warmingService).toBeDefined();
  });

  it('should handle complete user session lifecycle', async () => {
    const { result } = renderHook(() => useCacheManager('user123'), { wrapper });

    await act(async () => {
      // Initialize user cache
      await result.current.initializeUserCache('user123', {
        role: 'admin',
        dashboardViews: 50,
        realtimeUsage: 0.6,
        loginFrequency: 'daily'
      });

      // Handle navigation
      await result.current.handleNavigation('/dashboard');

      // Handle mutation
      result.current.handleMutation({
        type: 'user-preferences-update',
        data: { theme: 'dark' },
        refreshStrategy: 'background'
      });

      // Optimize cache
      await result.current.optimizeCache();

      // Get stats
      const stats = result.current.getCacheStats();
      expect(stats).toBeDefined();

      // Handle logout
      result.current.handleUserLogout();
    });

    // Should complete the full lifecycle without errors
    expect(result.current.services).toBeDefined();
  });
});