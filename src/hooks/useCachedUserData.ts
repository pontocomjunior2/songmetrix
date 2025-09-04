import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { User } from '@supabase/supabase-js';
import { 
  getUserMetadataService, 
  UserMetadata, 
  UserPermissions, 
  CachedUserData,
  checkPermission,
  checkActionLimit 
} from '../services/userMetadataService';
import { queryKeys, cacheConfigs } from '../lib/queryClient';
import { supabase } from '../lib/supabase-client';

// Hook for cached user metadata and permissions
export const useCachedUserData = (user: User | null) => {
  const queryClient = useQueryClient();
  const userMetadataService = getUserMetadataService(queryClient);

  // Query for user metadata with aggressive caching
  const {
    data: userMetadata,
    isLoading: metadataLoading,
    error: metadataError,
    refetch: refetchMetadata,
  } = useQuery({
    queryKey: queryKeys.user.metadata(user?.id || ''),
    queryFn: async (): Promise<UserMetadata> => {
      if (!user) return {};
      
      const cachedData = await userMetadataService.getUserData(user.id);
      return cachedData?.metadata || {};
    },
    enabled: !!user,
    ...cacheConfigs.userPreferences,
    staleTime: 15 * 60 * 1000, // 15 minutes - longer for metadata
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false, // Don't refetch metadata on focus
    refetchOnMount: false, // Use cached data on mount
  });

  // Query for user permissions with even more aggressive caching
  const {
    data: permissions,
    isLoading: permissionsLoading,
    error: permissionsError,
  } = useQuery({
    queryKey: [...queryKeys.user.metadata(user?.id || ''), 'permissions'],
    queryFn: async (): Promise<UserPermissions> => {
      if (!user) return {};
      
      const cachedData = await userMetadataService.getUserData(user.id);
      return cachedData?.permissions || {};
    },
    enabled: !!user && !!userMetadata,
    staleTime: 30 * 60 * 1000, // 30 minutes - permissions change rarely
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Query for computed user data (plan, trial status, etc.)
  const {
    data: computedData,
    isLoading: computedLoading,
  } = useQuery({
    queryKey: [...queryKeys.user.metadata(user?.id || ''), 'computed'],
    queryFn: async (): Promise<Partial<CachedUserData>> => {
      if (!user || !userMetadata) return {};
      
      const cachedData = await userMetadataService.getUserData(user.id);
      if (!cachedData) return {};
      
      return {
        planId: cachedData.planId,
        isTrialExpired: cachedData.isTrialExpired,
        lastUpdated: cachedData.lastUpdated,
      };
    },
    enabled: !!user && !!userMetadata,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Mutation for updating user metadata with optimistic updates
  const updateMetadataMutation = useMutation({
    mutationFn: async (updates: Partial<UserMetadata>) => {
      if (!user) throw new Error('No user available');
      
      const success = await userMetadataService.updateUserMetadata(user.id, updates);
      if (!success) throw new Error('Failed to update metadata');
      
      return updates;
    },
    onMutate: async (updates) => {
      if (!user) return;
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.user.metadata(user.id) });
      
      // Snapshot previous values
      const previousMetadata = queryClient.getQueryData(queryKeys.user.metadata(user.id));
      const previousPermissions = queryClient.getQueryData([...queryKeys.user.metadata(user.id), 'permissions']);
      const previousComputed = queryClient.getQueryData([...queryKeys.user.metadata(user.id), 'computed']);
      
      // Optimistically update metadata
      queryClient.setQueryData(queryKeys.user.metadata(user.id), (old: UserMetadata) => ({
        ...old,
        ...updates,
      }));
      
      // If plan changed, update permissions optimistically
      if (updates.plan_id) {
        const newPermissions = userMetadataService.getUserData(user.id, false);
        if (newPermissions instanceof Promise) {
          newPermissions.then((data) => {
            if (data) {
              queryClient.setQueryData([...queryKeys.user.metadata(user.id), 'permissions'], data.permissions);
              queryClient.setQueryData([...queryKeys.user.metadata(user.id), 'computed'], {
                planId: data.planId,
                isTrialExpired: data.isTrialExpired,
                lastUpdated: data.lastUpdated,
              });
            }
          });
        }
      }
      
      return { previousMetadata, previousPermissions, previousComputed };
    },
    onError: (err, updates, context) => {
      if (!user || !context) return;
      
      // Rollback optimistic updates
      if (context.previousMetadata) {
        queryClient.setQueryData(queryKeys.user.metadata(user.id), context.previousMetadata);
      }
      if (context.previousPermissions) {
        queryClient.setQueryData([...queryKeys.user.metadata(user.id), 'permissions'], context.previousPermissions);
      }
      if (context.previousComputed) {
        queryClient.setQueryData([...queryKeys.user.metadata(user.id), 'computed'], context.previousComputed);
      }
    },
    onSuccess: (updates) => {
      if (!user) return;
      
      // Invalidate related queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.user.metadata(user.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.essential.all });
    },
  });

  // Memoized permission checking functions
  const hasPermission = useCallback((permission: keyof UserPermissions): boolean => {
    if (!user || !permissions) return false;
    return !!permissions[permission];
  }, [user, permissions]);

  const canPerformAction = useCallback((action: 'createInsight' | 'addRadio', currentCount: number): boolean => {
    if (!user) return false;
    return userMetadataService.canPerformAction(user.id, action, currentCount);
  }, [user, userMetadataService]);

  const isAdmin = useCallback((): boolean => {
    return hasPermission('canAccessAdmin');
  }, [hasPermission]);

  const isPro = useCallback((): boolean => {
    return computedData?.planId === 'PRO' || computedData?.planId === 'ADMIN';
  }, [computedData]);

  const isTrialActive = useCallback((): boolean => {
    return computedData?.planId === 'TRIAL' && !computedData?.isTrialExpired;
  }, [computedData]);

  // Memoized user data object
  const cachedUserData = useMemo((): CachedUserData | null => {
    if (!user || !userMetadata || !permissions || !computedData) return null;
    
    return {
      user,
      metadata: userMetadata,
      permissions,
      planId: computedData.planId || 'FREE',
      isTrialExpired: computedData.isTrialExpired || false,
      lastUpdated: computedData.lastUpdated || Date.now(),
    };
  }, [user, userMetadata, permissions, computedData]);

  // Preload user data
  const preloadUserData = useCallback(async () => {
    if (!user) return;
    await userMetadataService.preloadUserData(user.id);
  }, [user, userMetadataService]);

  // Clear user cache
  const clearUserCache = useCallback(() => {
    if (!user) return;
    userMetadataService.clearUserCache(user.id);
  }, [user, userMetadataService]);

  // Get fresh user data (bypass cache)
  const getFreshUserData = useCallback(async (): Promise<CachedUserData | null> => {
    if (!user) return null;
    return userMetadataService.getUserData(user.id, true);
  }, [user, userMetadataService]);

  // Update specific preference with optimistic update
  const updatePreference = useCallback(async (key: keyof UserMetadata, value: any) => {
    return updateMetadataMutation.mutateAsync({ [key]: value });
  }, [updateMetadataMutation]);

  // Batch update multiple preferences
  const batchUpdatePreferences = useCallback(async (updates: Partial<UserMetadata>) => {
    return updateMetadataMutation.mutateAsync(updates);
  }, [updateMetadataMutation]);

  // Check if user has specific preferences set
  const hasPreferences = useCallback((): boolean => {
    if (!userMetadata) return false;
    return !!(userMetadata.favorite_segments?.length || userMetadata.favorite_radios?.length);
  }, [userMetadata]);

  // Get user limits based on plan
  const getUserLimits = useCallback(() => {
    if (!permissions) return null;
    
    return {
      maxInsights: permissions.maxInsights || 0,
      maxRadios: permissions.maxRadios || 0,
      canExportData: permissions.canExportData || false,
      canViewAnalytics: permissions.canViewAnalytics || false,
    };
  }, [permissions]);

  // Check if user is approaching limits
  const isApproachingLimits = useCallback((currentCounts: { insights?: number; radios?: number }) => {
    const limits = getUserLimits();
    if (!limits) return false;
    
    const insightLimit = limits.maxInsights === -1 ? Infinity : limits.maxInsights;
    const radioLimit = limits.maxRadios === -1 ? Infinity : limits.maxRadios;
    
    const insightUsage = (currentCounts.insights || 0) / insightLimit;
    const radioUsage = (currentCounts.radios || 0) / radioLimit;
    
    return insightUsage > 0.8 || radioUsage > 0.8; // 80% threshold
  }, [getUserLimits]);

  return {
    // Core data
    user,
    userMetadata,
    permissions,
    cachedUserData,
    
    // Computed values
    planId: computedData?.planId || 'FREE',
    isTrialExpired: computedData?.isTrialExpired || false,
    
    // Loading states
    isLoading: metadataLoading || permissionsLoading || computedLoading,
    isUpdating: updateMetadataMutation.isPending,
    
    // Error states
    error: metadataError || permissionsError,
    updateError: updateMetadataMutation.error,
    
    // Permission checking
    hasPermission,
    canPerformAction,
    isAdmin,
    isPro,
    isTrialActive,
    
    // Preference management
    hasPreferences,
    updatePreference,
    batchUpdatePreferences,
    
    // Limit checking
    getUserLimits,
    isApproachingLimits,
    
    // Cache management
    preloadUserData,
    clearUserCache,
    getFreshUserData,
    refetchMetadata,
    
    // Service access
    userMetadataService,
  };
};

// Hook for permission-based component rendering
export const usePermissionGate = (permission: keyof UserPermissions, user: User | null) => {
  const { hasPermission, isLoading } = useCachedUserData(user);
  
  return useMemo(() => ({
    hasPermission: hasPermission(permission),
    isLoading,
    shouldRender: !isLoading && hasPermission(permission),
  }), [hasPermission, permission, isLoading]);
};

// Hook for plan-based features
export const usePlanFeatures = (user: User | null) => {
  const { planId, permissions, isTrialActive, isPro, isAdmin } = useCachedUserData(user);
  
  return useMemo(() => ({
    planId,
    isTrialActive: isTrialActive(),
    isPro: isPro(),
    isAdmin: isAdmin(),
    canAccessAnalytics: permissions?.canViewAnalytics || false,
    canExportData: permissions?.canExportData || false,
    canManageUsers: permissions?.canManageUsers || false,
    maxInsights: permissions?.maxInsights || 0,
    maxRadios: permissions?.maxRadios || 0,
    hasUnlimitedInsights: permissions?.maxInsights === -1,
    hasUnlimitedRadios: permissions?.maxRadios === -1,
  }), [planId, permissions, isTrialActive, isPro, isAdmin]);
};

export default useCachedUserData;