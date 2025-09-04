import { useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase-client';
import { queryKeys, cacheConfigs } from '../lib/queryClient';
import { toast } from 'react-toastify';

// Types for optimized auth
interface UserMetadata {
  plan_id?: string;
  trial_ends_at?: string;
  favorite_segments?: string[];
  favorite_radios?: string[];
  full_name?: string;
  whatsapp?: string;
  preferences_migrated?: boolean;
  last_preference_check?: string;
}

interface OptimizedUserData {
  user: User;
  metadata: UserMetadata;
  planId: string;
  trialEndsAt: string | null;
  favoriteSegments: string[] | null;
  hasPreferences: boolean;
  needsMigration: boolean;
}

interface SessionValidationResult {
  isValid: boolean;
  user: User | null;
  needsRefresh: boolean;
  error?: string;
}

// Cache keys for auth-related data
const authQueryKeys = {
  session: () => [...queryKeys.essential.all, 'auth', 'session'] as const,
  userMetadata: (userId: string) => [...queryKeys.user.all, 'metadata', userId] as const,
  preferences: (userId: string) => [...queryKeys.user.preferences(userId)] as const,
  sessionValidation: (userId: string) => [...queryKeys.essential.all, 'auth', 'validation', userId] as const,
};

// Optimized hook for authentication and user state management
export const useOptimizedAuth = () => {
  const queryClient = useQueryClient();
  const migrationAttempted = useRef(false);
  const lastPreferenceCheck = useRef<number>(0);
  const sessionValidationCache = useRef<Map<string, { result: SessionValidationResult; timestamp: number }>>(new Map());

  // Session validation with caching
  const validateSession = useCallback(async (userId?: string): Promise<SessionValidationResult> => {
    const cacheKey = userId || 'anonymous';
    const cached = sessionValidationCache.current.get(cacheKey);
    
    // Return cached result if less than 30 seconds old
    if (cached && Date.now() - cached.timestamp < 30000) {
      return cached.result;
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        const result: SessionValidationResult = {
          isValid: false,
          user: null,
          needsRefresh: false,
          error: error.message,
        };
        sessionValidationCache.current.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      const isValid = !!data.session?.user;
      const needsRefresh = data.session ? 
        (new Date(data.session.expires_at || 0).getTime() - Date.now()) < 300000 : // 5 minutes
        false;

      const result: SessionValidationResult = {
        isValid,
        user: data.session?.user || null,
        needsRefresh,
      };

      sessionValidationCache.current.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (error) {
      const result: SessionValidationResult = {
        isValid: false,
        user: null,
        needsRefresh: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      sessionValidationCache.current.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }
  }, []);

  // Query for current session with optimized caching
  const {
    data: sessionData,
    isLoading: sessionLoading,
    error: sessionError,
    refetch: refetchSession,
  } = useQuery({
    queryKey: authQueryKeys.session(),
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    ...cacheConfigs.essential,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes (renamed from cacheTime)
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  // Query for user metadata with background refresh
  const {
    data: userMetadata,
    isLoading: metadataLoading,
    error: metadataError,
    refetch: refetchMetadata,
  } = useQuery({
    queryKey: authQueryKeys.userMetadata(sessionData?.user?.id || ''),
    queryFn: async () => {
      if (!sessionData?.user) return null;
      
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      return data.user?.user_metadata as UserMetadata || {};
    },
    enabled: !!sessionData?.user,
    ...cacheConfigs.userPreferences,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Background preference checking (non-blocking)
  const checkPreferencesInBackground = useCallback(async (userId: string) => {
    // Throttle preference checks to once per 5 minutes
    const now = Date.now();
    if (now - lastPreferenceCheck.current < 5 * 60 * 1000) {
      return;
    }
    lastPreferenceCheck.current = now;

    try {
      // Use a separate query for background preference checking
      const metadata = await queryClient.fetchQuery({
        queryKey: authQueryKeys.preferences(userId),
        queryFn: async () => {
          const { data, error } = await supabase.auth.getUser();
          if (error) throw error;
          return data.user?.user_metadata as UserMetadata || {};
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 15 * 60 * 1000, // 15 minutes
      });

      // Update last preference check timestamp
      if (metadata && !metadata.last_preference_check) {
        await supabase.auth.updateUser({
          data: {
            ...metadata,
            last_preference_check: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      console.warn('Background preference check failed:', error);
    }
  }, [queryClient]);

  // Non-blocking preference migration
  const migratePreferencesInBackground = useCallback(async (userId: string, metadata: UserMetadata) => {
    if (migrationAttempted.current || metadata.preferences_migrated) {
      return;
    }

    migrationAttempted.current = true;

    // Check if migration is needed
    const needsMigration = !metadata.favorite_segments?.length && metadata.favorite_radios?.length;
    
    if (!needsMigration) {
      // Mark as migrated even if no migration was needed
      try {
        await supabase.auth.updateUser({
          data: {
            ...metadata,
            preferences_migrated: true,
          },
        });
      } catch (error) {
        console.warn('Failed to mark preferences as migrated:', error);
      }
      return;
    }

    // Perform migration in background
    setTimeout(async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const response = await fetch('/api/radios/segments-map', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ radioNames: metadata.favorite_radios }),
        });

        if (!response.ok) {
          throw new Error(`Migration API error: ${response.statusText}`);
        }

        const mappedSegments: string[] = await response.json();

        if (mappedSegments.length > 0) {
          // Update user metadata with migrated preferences
          await supabase.auth.updateUser({
            data: {
              favorite_segments: mappedSegments,
              preferences_migrated: true,
              favorite_radios: null, // Remove old data
            },
          });

          // Invalidate relevant caches
          queryClient.invalidateQueries({ queryKey: authQueryKeys.userMetadata(userId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.user.preferences(userId) });

          console.log('Preferences migrated successfully in background');
        }
      } catch (error) {
        console.error('Background preference migration failed:', error);
        migrationAttempted.current = false; // Allow retry on next session
      }
    }, 2000); // Delay migration by 2 seconds to not block initial load
  }, [queryClient]);

  // Mutation for updating user preferences with optimistic updates
  const updatePreferencesMutation = useMutation({
    mutationFn: async ({ segments, userId }: { segments: string[]; userId: string }) => {
      const { data, error } = await supabase.auth.updateUser({
        data: { favorite_segments: segments },
      });
      if (error) throw error;
      return data.user?.user_metadata;
    },
    onMutate: async ({ segments, userId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: authQueryKeys.userMetadata(userId) });

      // Snapshot previous value
      const previousMetadata = queryClient.getQueryData(authQueryKeys.userMetadata(userId));

      // Optimistically update
      queryClient.setQueryData(authQueryKeys.userMetadata(userId), (old: UserMetadata) => ({
        ...old,
        favorite_segments: segments,
      }));

      return { previousMetadata };
    },
    onError: (err, { userId }, context) => {
      // Rollback on error
      if (context?.previousMetadata) {
        queryClient.setQueryData(authQueryKeys.userMetadata(userId), context.previousMetadata);
      }
      toast.error('Failed to update preferences');
    },
    onSuccess: (data, { userId }) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: authQueryKeys.userMetadata(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.essential.all });
      toast.success('Preferences updated successfully');
    },
  });

  // Token refresh without blocking UI
  const refreshTokenInBackground = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.warn('Token refresh failed:', error);
        return false;
      }
      
      // Update session cache
      queryClient.setQueryData(authQueryKeys.session(), data.session);
      return true;
    } catch (error) {
      console.warn('Token refresh error:', error);
      return false;
    }
  }, [queryClient]);

  // Computed values with memoization
  const computedValues = useMemo(() => {
    if (!sessionData?.user || !userMetadata) {
      return {
        currentUser: null,
        planId: null,
        trialEndsAt: null,
        favoriteSegments: null,
        hasPreferences: false,
        needsMigration: false,
        isAuthenticated: false,
      };
    }

    const user = sessionData.user;
    const metadata = userMetadata;
    
    // Compute plan ID with trial expiration check
    let planId = (metadata.plan_id || 'FREE').trim().toUpperCase();
    const trialEndsAt = metadata.trial_ends_at;
    
    if (planId === 'TRIAL' && trialEndsAt) {
      const now = new Date();
      const trialEnd = new Date(trialEndsAt);
      if (trialEnd < now) {
        planId = 'FREE';
      }
    }

    const favoriteSegments = metadata.favorite_segments || null;
    const hasPreferences = !!(favoriteSegments?.length || metadata.favorite_radios?.length);
    const needsMigration = !metadata.preferences_migrated && 
                          !favoriteSegments?.length && 
                          !!metadata.favorite_radios?.length;

    return {
      currentUser: user,
      planId,
      trialEndsAt,
      favoriteSegments,
      hasPreferences,
      needsMigration,
      isAuthenticated: true,
    };
  }, [sessionData, userMetadata]);

  // Background tasks effect
  const runBackgroundTasks = useCallback(() => {
    if (computedValues.currentUser) {
      const userId = computedValues.currentUser.id;
      
      // Run background preference check
      checkPreferencesInBackground(userId);
      
      // Run background migration if needed
      if (computedValues.needsMigration && userMetadata) {
        migratePreferencesInBackground(userId, userMetadata);
      }
      
      // Check if token needs refresh
      if (sessionData?.expires_at) {
        const expiresAt = new Date(sessionData.expires_at).getTime();
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;
        
        // Refresh token if it expires in less than 5 minutes
        if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
          refreshTokenInBackground();
        }
      }
    }
  }, [
    computedValues.currentUser,
    computedValues.needsMigration,
    userMetadata,
    sessionData,
    checkPreferencesInBackground,
    migratePreferencesInBackground,
    refreshTokenInBackground,
  ]);

  return {
    // Core auth state
    ...computedValues,
    
    // Loading states
    isLoading: sessionLoading || metadataLoading,
    error: sessionError || metadataError,
    
    // Actions
    validateSession,
    refreshSession: refetchSession,
    refreshMetadata: refetchMetadata,
    updatePreferences: updatePreferencesMutation.mutate,
    refreshTokenInBackground,
    runBackgroundTasks,
    
    // Status
    isUpdatingPreferences: updatePreferencesMutation.isPending,
    
    // Cache utilities
    clearAuthCache: () => {
      queryClient.removeQueries({ queryKey: authQueryKeys.session() });
      queryClient.removeQueries({ queryKey: queryKeys.user.all });
      sessionValidationCache.current.clear();
    },
  };
};