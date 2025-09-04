import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { getCacheConfigForQuery, cacheConfigs } from '../lib/queryClient';

/**
 * Custom hook that applies appropriate cache configuration based on query type
 */
export function useCacheConfig<TData = unknown, TError = Error>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: Partial<UseQueryOptions<TData, TError>>
) {
  // Get cache config based on query key pattern
  const cacheConfig = getCacheConfigForQuery(queryKey);
  
  // Merge cache config with provided options
  const mergedOptions: UseQueryOptions<TData, TError> = {
    queryKey,
    queryFn,
    ...cacheConfig,
    ...options, // User options override cache config
  };
  
  return useQuery(mergedOptions);
}

/**
 * Hook for essential data with aggressive caching and offline support
 */
export function useEssentialQuery<TData = unknown, TError = Error>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: Partial<UseQueryOptions<TData, TError>>
) {
  return useQuery({
    queryKey,
    queryFn,
    ...cacheConfigs.essential,
    ...options,
  });
}

/**
 * Hook for dashboard data with balanced caching
 */
export function useDashboardQuery<TData = unknown, TError = Error>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: Partial<UseQueryOptions<TData, TError>>
) {
  return useQuery({
    queryKey,
    queryFn,
    ...cacheConfigs.dashboard,
    ...options,
  });
}

/**
 * Hook for secondary data with moderate caching
 */
export function useSecondaryQuery<TData = unknown, TError = Error>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: Partial<UseQueryOptions<TData, TError>>
) {
  return useQuery({
    queryKey,
    queryFn,
    ...cacheConfigs.secondary,
    ...options,
  });
}

/**
 * Hook for optional data with relaxed caching
 */
export function useOptionalQuery<TData = unknown, TError = Error>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: Partial<UseQueryOptions<TData, TError>>
) {
  return useQuery({
    queryKey,
    queryFn,
    ...cacheConfigs.optional,
    ...options,
  });
}

/**
 * Hook for static data with long-term caching
 */
export function useStaticQuery<TData = unknown, TError = Error>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: Partial<UseQueryOptions<TData, TError>>
) {
  return useQuery({
    queryKey,
    queryFn,
    ...cacheConfigs.static,
    ...options,
  });
}

/**
 * Hook for real-time data with frequent updates
 */
export function useRealtimeQuery<TData = unknown, TError = Error>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: Partial<UseQueryOptions<TData, TError>>
) {
  return useQuery({
    queryKey,
    queryFn,
    ...cacheConfigs.realtime,
    ...options,
  });
}

/**
 * Hook for user preferences with background refresh
 */
export function useUserPreferencesQuery<TData = unknown, TError = Error>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: Partial<UseQueryOptions<TData, TError>>
) {
  return useQuery({
    queryKey,
    queryFn,
    ...cacheConfigs.userPreferences,
    ...options,
  });
}