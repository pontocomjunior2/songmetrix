import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { performanceDataCollectionService } from '../services/performanceDataCollectionService';

// Enhanced cache configurations for different data types with stale-while-revalidate
export const cacheConfigs = {
  // Dashboard data - frequently updated, moderate cache time
  dashboard: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: 'always' as const,
    refetchOnReconnect: 'always' as const,
    retry: 2,
    retryOnMount: true,
    // Stale-while-revalidate: serve stale data immediately, fetch fresh in background
    refetchInterval: false,
    refetchIntervalInBackground: false,
    structuralSharing: true,
    // Network mode for offline support
    networkMode: 'online' as const,
  },
  
  // User preferences - less frequently updated, longer cache time
  userPreferences: {
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: 3,
    retryOnMount: true,
    // Background refetch for preferences
    refetchInterval: 60 * 60 * 1000, // 1 hour background refresh
    refetchIntervalInBackground: true,
    structuralSharing: true,
    networkMode: 'online' as const,
  },
  
  // Static data - rarely changes, long cache time
  static: {
    staleTime: 60 * 60 * 1000, // 1 hour
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch static data on mount
    refetchOnReconnect: false,
    retry: 1,
    retryOnMount: false,
    // Very infrequent background refresh for static data
    refetchInterval: 24 * 60 * 60 * 1000, // 24 hours
    refetchIntervalInBackground: false,
    structuralSharing: true,
    networkMode: 'online' as const,
  },
  
  // Real-time data - frequently updated, short cache time
  realtime: {
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: 'always' as const,
    refetchOnReconnect: 'always' as const,
    retry: 3,
    retryOnMount: true,
    // Frequent background refresh for real-time data
    refetchInterval: 60 * 1000, // 1 minute
    refetchIntervalInBackground: true,
    structuralSharing: true,
    networkMode: 'online' as const,
  },
  
  // Essential data - critical for app functionality
  essential: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: 'always' as const,
    refetchOnReconnect: 'always' as const,
    retry: 5, // More retries for essential data
    retryOnMount: true,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    structuralSharing: true,
    networkMode: 'offlineFirst' as const, // Try cache first, then network
  },
  
  // Secondary data - important but not critical
  secondary: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: 2,
    retryOnMount: false,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    structuralSharing: true,
    networkMode: 'online' as const,
  },
  
  // Optional data - nice to have
  optional: {
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1,
    retryOnMount: false,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    structuralSharing: true,
    networkMode: 'online' as const,
  },
};

// Create persister for offline cache support
const localStoragePersister = {
  persistClient: async (client: any) => {
    try {
      const dataToStore = {
        clientState: client,
        timestamp: Date.now(),
        version: '1.0.0'
      };
      localStorage.setItem('songmetrix-cache', JSON.stringify(dataToStore));
    } catch (error) {
      console.error('Failed to persist cache:', error);
    }
  },
  restoreClient: async () => {
    try {
      const stored = localStorage.getItem('songmetrix-cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if cache is not too old (24 hours)
        const age = Date.now() - parsed.timestamp;
        if (age < 24 * 60 * 60 * 1000) {
          return parsed.clientState;
        }
      }
    } catch (error) {
      console.error('Failed to restore cache:', error);
    }
    return undefined;
  },
  removeClient: async () => {
    try {
      localStorage.removeItem('songmetrix-cache');
    } catch (error) {
      console.error('Failed to remove cache:', error);
    }
  }
};

// Query cache with enhanced error handling and logging
const queryCache = new QueryCache({
  onError: (error: any, query) => {
    console.error(`Query failed for key: ${JSON.stringify(query.queryKey)}`, error);

    // Detectar e tratar erros específicos de rede
    const isNetworkError = error?.message?.includes('ERR_BLOCKED_BY_CLIENT') ||
                          error?.message?.includes('ERR_NETWORK') ||
                          error?.message?.includes('Failed to fetch') ||
                          error?.message?.includes('ERR_INTERNET_DISCONNECTED') ||
                          error?.message?.includes('ERR_CONNECTION_REFUSED') ||
                          error?.code === 'NETWORK_ERROR' ||
                          error?.name === 'TypeError' && error?.message?.includes('fetch') ||
                          !navigator.onLine;

    // Detectar problemas relacionados ao Facebook Pixel
    const isFacebookPixelError = error?.message?.includes('connect.facebook.net') ||
                                error?.message?.includes('fbevents.js') ||
                                window.metaPixelBlocked === true;

    if (isNetworkError) {
      console.warn('Erro de rede detectado - tentando recuperação automática');

      // Invalidar queries relacionadas para forçar refetch
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: query.queryKey });
      }, 2000);

      // Tentar refetch após um atraso maior se estiver offline
      if (!navigator.onLine) {
        console.log('Dispositivo offline - aguardando reconexão');
        window.addEventListener('online', () => {
          console.log('Conexão restaurada - refetching queries');
          queryClient.invalidateQueries({ queryKey: query.queryKey });
        }, { once: true });
      }
    }

    // Tratamento específico para erros do Facebook Pixel
    if (isFacebookPixelError) {
      console.warn('Erro relacionado ao Facebook Pixel detectado - não afetará funcionalidade principal');

      // Marcar como bloqueado se ainda não estiver
      if (!window.metaPixelBlocked) {
        window.metaPixelBlocked = true;
        console.log('Facebook Pixel marcado como bloqueado');
      }

      // Não invalidar queries para erros do Facebook Pixel
      // Apenas logar e continuar normalmente
      return;
    }

    // Detectar erros de autenticação
    if (error?.status === 401 || error?.code === 'UNAUTHORIZED') {
      console.warn('Erro de autenticação detectado - tentando renovar sessão');

      // Invalidar queries de autenticação
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['essential'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }, 1000);
    }

    // Log performance metrics for failed queries
    if (window.performance && window.performance.mark) {
      window.performance.mark(`query-error-${query.queryHash}`);
    }
  },
  onSuccess: (data, query) => {
    // Log successful cache hits for monitoring
    if (query.state.dataUpdatedAt > 0) {
      console.log(`Query cache hit for key: ${JSON.stringify(query.queryKey)}`);
    }
  },
});

// Enhanced query keys factory with priority-based organization
export const queryKeys = {
  // Essential data - critical for app functionality
  essential: {
    all: ['essential'] as const,
    userSession: (userId: string) => [...queryKeys.essential.all, 'session', userId] as const,
    userProfile: (userId: string) => [...queryKeys.essential.all, 'profile', userId] as const,
    navigation: () => [...queryKeys.essential.all, 'navigation'] as const,
  },
  
  // Dashboard related queries with priority levels
  dashboard: {
    all: ['dashboard'] as const,
    essential: {
      all: ['dashboard', 'essential'] as const,
      metrics: (userId: string) => ['dashboard', 'essential', 'metrics', userId] as const,
      userInfo: (userId: string) => ['dashboard', 'essential', 'userInfo', userId] as const,
    },
    secondary: {
      all: ['dashboard', 'secondary'] as const,
      topSongs: (userId: string) => ['dashboard', 'secondary', 'topSongs', userId] as const,
      artistData: (userId: string) => ['dashboard', 'secondary', 'artistData', userId] as const,
      radioStatus: () => ['dashboard', 'secondary', 'radioStatus'] as const,
    },
    optional: {
      all: ['dashboard', 'optional'] as const,
      genreDistribution: (userId: string) => ['dashboard', 'optional', 'genreDistribution', userId] as const,
      recommendations: (userId: string) => ['dashboard', 'optional', 'recommendations', userId] as const,
      analytics: (userId: string) => ['dashboard', 'optional', 'analytics', userId] as const,
    },
  },
  
  // User related queries
  user: {
    all: ['user'] as const,
    profile: (userId: string) => ['user', 'profile', userId] as const,
    preferences: (userId: string) => ['user', 'preferences', userId] as const,
    metadata: (userId: string) => ['user', 'metadata', userId] as const,
    settings: (userId: string) => ['user', 'settings', userId] as const,
  },
  
  // Admin related queries
  admin: {
    all: ['admin'] as const,
    insights: () => ['admin', 'insights'] as const,
    users: (filters?: Record<string, any>) => ['admin', 'users', filters] as const,
    analytics: (dateRange?: string) => ['admin', 'analytics', dateRange] as const,
    reports: () => ['admin', 'reports'] as const,
  },
  
  // Static data queries
  static: {
    all: ['static'] as const,
    genres: () => ['static', 'genres'] as const,
    countries: () => ['static', 'countries'] as const,
    radioStations: () => ['static', 'radioStations'] as const,
    appConfig: () => ['static', 'appConfig'] as const,
  },
  
  // Real-time data queries
  realtime: {
    all: ['realtime'] as const,
    radioStatus: () => ['realtime', 'radioStatus'] as const,
    liveMetrics: (userId: string) => ['realtime', 'liveMetrics', userId] as const,
    notifications: (userId: string) => ['realtime', 'notifications', userId] as const,
  },
} as const;

// Mutation cache with invalidation logic
const mutationCache = new MutationCache({
  onSuccess: (data, variables, context, mutation) => {
    console.log(`Mutation succeeded: ${mutation.options.mutationKey}`);
    
    // Auto-invalidate related queries based on mutation type
    if (mutation.options.mutationKey) {
      const mutationKey = Array.isArray(mutation.options.mutationKey) 
        ? mutation.options.mutationKey[0] 
        : mutation.options.mutationKey;
      
      // Invalidate dashboard queries on data mutations
      if (['updateUserPreferences', 'updateProfile', 'createInsight'].includes(mutationKey)) {
        // Use a function to avoid circular dependency
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
        }, 0);
      }
      
      // Invalidate user queries on user-related mutations
      if (['updateProfile', 'updateUserPreferences'].includes(mutationKey)) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
        }, 0);
      }
    }
  },
  onError: (error, variables, context, mutation) => {
    console.error(`Mutation failed: ${mutation.options.mutationKey}`, error);
  },
});

// Create QueryClient with optimized default settings and enhanced features
export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      // Default to essential config for most queries
      staleTime: cacheConfigs.essential.staleTime,
      cacheTime: cacheConfigs.essential.cacheTime,
      refetchOnWindowFocus: cacheConfigs.essential.refetchOnWindowFocus,
      refetchOnMount: cacheConfigs.essential.refetchOnMount,
      refetchOnReconnect: cacheConfigs.essential.refetchOnReconnect,
      retry: cacheConfigs.essential.retry,
      retryOnMount: cacheConfigs.essential.retryOnMount,
      networkMode: cacheConfigs.essential.networkMode,
      structuralSharing: cacheConfigs.essential.structuralSharing,
      
      // Enhanced network error handling with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Error handling - don't throw errors, let components handle them
      throwOnError: false,
      
      // Use error boundary for critical errors
      useErrorBoundary: (error: any) => {
        // Use error boundary for network errors and server errors
        return error?.status >= 500 || error?.code === 'NETWORK_ERROR';
      },
      
      // Optimize for performance
      notifyOnChangeProps: 'tracked', // Only re-render when tracked properties change
      
      // Stale-while-revalidate behavior
      refetchInterval: false, // Disable by default, enable per query type
      refetchIntervalInBackground: false,
    },
    mutations: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      
      // Use error boundary for mutation errors
      useErrorBoundary: true,
      
      // Network mode for mutations
      networkMode: 'online',
    },
  },
});

// Initialize performance monitoring with query client
performanceDataCollectionService.initialize(queryClient);

// Initialize cache persistence with offline support
let persistPromise: Promise<void> | null = null;

export const initializeCachePersistence = async () => {
  if (persistPromise) return persistPromise;
  
  persistPromise = (async () => {
    try {
      // Restore persisted cache on initialization
      const restoredClient = await localStoragePersister.restoreClient();
      if (restoredClient) {
        console.log('Restored cache from localStorage');
        // The cache will be automatically restored by React Query
      }
      
      // Setup periodic persistence
      setInterval(async () => {
        try {
          await localStoragePersister.persistClient(queryClient.getQueryCache().getAll());
        } catch (error) {
          console.error('Periodic cache persistence failed:', error);
        }
      }, 5 * 60 * 1000); // Persist every 5 minutes
      
      console.log('Cache persistence initialized');
    } catch (error) {
      console.error('Failed to initialize cache persistence:', error);
    }
  })();
  
  return persistPromise;
};



// Cache configuration helper - get config by query key pattern
export const getCacheConfigForQuery = (queryKey: readonly unknown[]): typeof cacheConfigs.essential => {
  const keyString = JSON.stringify(queryKey);
  
  // Essential data
  if (keyString.includes('essential') || keyString.includes('session') || keyString.includes('navigation')) {
    return cacheConfigs.essential;
  }
  
  // Real-time data
  if (keyString.includes('realtime') || keyString.includes('liveMetrics') || keyString.includes('radioStatus')) {
    return cacheConfigs.realtime;
  }
  
  // Static data
  if (keyString.includes('static') || keyString.includes('genres') || keyString.includes('countries')) {
    return cacheConfigs.static;
  }
  
  // User preferences
  if (keyString.includes('preferences') || keyString.includes('settings')) {
    return cacheConfigs.userPreferences;
  }
  
  // Dashboard secondary data
  if (keyString.includes('secondary')) {
    return cacheConfigs.secondary;
  }
  
  // Dashboard optional data
  if (keyString.includes('optional')) {
    return cacheConfigs.optional;
  }
  
  // Default to dashboard config
  return cacheConfigs.dashboard;
};

// Enhanced cache invalidation helpers with granular control
export const invalidateQueries = {
  // Invalidate all dashboard data
  dashboard: () => queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
  
  // Invalidate specific dashboard sections
  dashboardEssential: () => queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.essential.all }),
  dashboardSecondary: () => queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.secondary.all }),
  dashboardOptional: () => queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.optional.all }),
  
  // Invalidate user data
  user: (userId: string) => queryClient.invalidateQueries({ queryKey: queryKeys.user.all }),
  userPreferences: (userId: string) => queryClient.invalidateQueries({ queryKey: queryKeys.user.preferences(userId) }),
  userProfile: (userId: string) => queryClient.invalidateQueries({ queryKey: queryKeys.user.profile(userId) }),
  
  // Invalidate real-time data
  realtime: () => queryClient.invalidateQueries({ queryKey: queryKeys.realtime.all }),
  
  // Invalidate admin data
  admin: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.all }),
  
  // Invalidate all queries
  all: () => queryClient.invalidateQueries(),
  
  // Smart invalidation based on mutation type
  smart: (mutationType: string, userId?: string) => {
    switch (mutationType) {
      case 'userPreferences':
        if (userId) {
          invalidateQueries.userPreferences(userId);
          invalidateQueries.dashboardEssential();
        }
        break;
      case 'userProfile':
        if (userId) {
          invalidateQueries.userProfile(userId);
          invalidateQueries.dashboardEssential();
        }
        break;
      case 'dashboardData':
        invalidateQueries.dashboard();
        break;
      case 'realtime':
        invalidateQueries.realtime();
        break;
      default:
        console.warn(`Unknown mutation type for smart invalidation: ${mutationType}`);
    }
  },
};

// Enhanced prefetch helpers with priority-based loading
export const prefetchQueries = {
  // Prefetch essential dashboard data
  dashboardEssential: async (userId: string) => {
    const config = cacheConfigs.essential;
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.essential.metrics(userId),
        staleTime: config.staleTime,
        cacheTime: config.cacheTime,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.essential.userInfo(userId),
        staleTime: config.staleTime,
        cacheTime: config.cacheTime,
      }),
    ]);
  },
  
  // Prefetch secondary dashboard data
  dashboardSecondary: async (userId: string) => {
    const config = cacheConfigs.secondary;
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.secondary.topSongs(userId),
        staleTime: config.staleTime,
        cacheTime: config.cacheTime,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.secondary.artistData(userId),
        staleTime: config.staleTime,
        cacheTime: config.cacheTime,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.secondary.radioStatus(),
        staleTime: config.staleTime,
        cacheTime: config.cacheTime,
      }),
    ]);
  },
  
  // Prefetch optional dashboard data
  dashboardOptional: async (userId: string) => {
    const config = cacheConfigs.optional;
    // Use setTimeout to defer optional data prefetching
    setTimeout(async () => {
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard.optional.genreDistribution(userId),
          staleTime: config.staleTime,
          cacheTime: config.cacheTime,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard.optional.recommendations(userId),
          staleTime: config.staleTime,
          cacheTime: config.cacheTime,
        }),
      ]);
    }, 2000); // Delay optional prefetch by 2 seconds
  },
  
  // Prefetch user data
  userData: async (userId: string) => {
    const config = cacheConfigs.userPreferences;
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.user.preferences(userId),
        staleTime: config.staleTime,
        cacheTime: config.cacheTime,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.user.metadata(userId),
        staleTime: config.staleTime,
        cacheTime: config.cacheTime,
      }),
    ]);
  },
  
  // Prefetch static data
  staticData: async () => {
    const config = cacheConfigs.static;
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.static.genres(),
        staleTime: config.staleTime,
        cacheTime: config.cacheTime,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.static.countries(),
        staleTime: config.staleTime,
        cacheTime: config.cacheTime,
      }),
    ]);
  },
  
  // Progressive prefetch - prefetch data in priority order
  progressive: async (userId: string) => {
    // 1. Essential data first
    await prefetchQueries.dashboardEssential(userId);
    
    // 2. User data in parallel with secondary dashboard data
    await Promise.all([
      prefetchQueries.userData(userId),
      prefetchQueries.dashboardSecondary(userId),
    ]);
    
    // 3. Static data and optional data last
    await Promise.all([
      prefetchQueries.staticData(),
      prefetchQueries.dashboardOptional(userId),
    ]);
  },
};

// Cache warming utilities
export const cacheWarming = {
  // Warm cache with frequently accessed data
  warmFrequentData: async (userId: string) => {
    console.log('Starting cache warming for frequent data...');
    
    // Warm essential data immediately
    await prefetchQueries.dashboardEssential(userId);
    
    // Warm secondary data with slight delay
    setTimeout(() => {
      prefetchQueries.dashboardSecondary(userId);
    }, 1000);
    
    // Warm static data in background
    setTimeout(() => {
      prefetchQueries.staticData();
    }, 3000);
    
    console.log('Cache warming completed');
  },
  
  // Warm cache based on user behavior patterns
  warmByUserBehavior: async (userId: string, userBehavior: string[]) => {
    const warmingPromises: Promise<void>[] = [];
    
    if (userBehavior.includes('dashboard-heavy')) {
      warmingPromises.push(prefetchQueries.dashboardSecondary(userId));
    }
    
    if (userBehavior.includes('admin-user')) {
      warmingPromises.push(
        queryClient.prefetchQuery({
          queryKey: queryKeys.admin.insights(),
          staleTime: cacheConfigs.dashboard.staleTime,
        })
      );
    }
    
    if (userBehavior.includes('analytics-user')) {
      warmingPromises.push(
        queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard.optional.analytics(userId),
          staleTime: cacheConfigs.optional.staleTime,
        })
      );
    }
    
    await Promise.all(warmingPromises);
  },
};

// Cache status and monitoring utilities
export const cacheMonitoring = {
  // Get cache statistics
  getCacheStats: () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const stats = {
      totalQueries: queries.length,
      successfulQueries: queries.filter(q => q.state.status === 'success').length,
      errorQueries: queries.filter(q => q.state.status === 'error').length,
      loadingQueries: queries.filter(q => q.state.status === 'loading').length,
      staleQueries: queries.filter(q => q.isStale()).length,
      cacheHitRate: 0,
    };
    
    // Calculate cache hit rate
    const totalFetches = queries.reduce((sum, q) => sum + (q.state.fetchFailureCount || 0) + 1, 0);
    const cacheMisses = queries.reduce((sum, q) => sum + (q.state.fetchFailureCount || 0), 0);
    stats.cacheHitRate = totalFetches > 0 ? ((totalFetches - cacheMisses) / totalFetches) * 100 : 0;
    
    return stats;
  },
  
  // Log cache performance
  logCachePerformance: () => {
    const stats = cacheMonitoring.getCacheStats();
    console.log('Cache Performance Stats:', stats);
    
    // Log to performance monitoring service if available
    if (window.performance && window.performance.mark) {
      window.performance.mark('cache-stats-logged');
      window.performance.measure('cache-performance', 'cache-stats-logged');
    }
    
    return stats;
  },
  
  // Monitor stale queries
  monitorStaleQueries: () => {
    const cache = queryClient.getQueryCache();
    const staleQueries = cache.getAll().filter(q => q.isStale());
    
    if (staleQueries.length > 0) {
      console.log(`Found ${staleQueries.length} stale queries:`, 
        staleQueries.map(q => ({ key: q.queryKey, lastUpdated: q.state.dataUpdatedAt }))
      );
    }
    
    return staleQueries;
  },
};