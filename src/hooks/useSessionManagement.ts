import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Session } from '@supabase/supabase-js';
import { getSessionManager, SessionValidationResult, TokenRefreshResult } from '../services/sessionManager';
import { queryKeys, cacheConfigs } from '../lib/queryClient';

// Hook for efficient session management
export const useSessionManagement = () => {
  const queryClient = useQueryClient();
  const sessionManager = getSessionManager(queryClient);

  // Query for current session with optimized caching
  const {
    data: session,
    isLoading: sessionLoading,
    error: sessionError,
    refetch: refetchSession,
  } = useQuery({
    queryKey: [...queryKeys.essential.all, 'auth', 'session'],
    queryFn: () => sessionManager.getCurrentSession(),
    ...cacheConfigs.essential,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    // Don't refetch automatically - let session manager handle it
    refetchInterval: false,
  });

  // Query for session validation with background refresh
  const {
    data: validationResult,
    isLoading: validationLoading,
    refetch: revalidateSession,
  } = useQuery({
    queryKey: [...queryKeys.essential.all, 'auth', 'validation'],
    queryFn: () => sessionManager.validateSession(),
    enabled: !!session,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 2 * 60 * 1000, // Revalidate every 2 minutes
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  // Mutation for token refresh
  const tokenRefreshMutation = useMutation({
    mutationFn: () => sessionManager.refreshToken(),
    onSuccess: (result: TokenRefreshResult) => {
      if (result.success) {
        // Update session cache
        queryClient.setQueryData(
          [...queryKeys.essential.all, 'auth', 'session'],
          result.newSession
        );
        
        // Invalidate validation cache
        queryClient.invalidateQueries({
          queryKey: [...queryKeys.essential.all, 'auth', 'validation'],
        });
        
        console.log('Token refreshed successfully');
      } else {
        console.error('Token refresh failed:', result.error);
      }
    },
    onError: (error) => {
      console.error('Token refresh mutation failed:', error);
    },
  });

  // Mutation for session validation
  const sessionValidationMutation = useMutation({
    mutationFn: (forceRefresh = false) => sessionManager.validateSession(forceRefresh),
    onSuccess: (result: SessionValidationResult) => {
      // Update validation cache
      queryClient.setQueryData(
        [...queryKeys.essential.all, 'auth', 'validation'],
        result
      );
      
      // Auto-refresh if needed
      if (result.needsRefresh && result.isValid && !tokenRefreshMutation.isPending) {
        tokenRefreshMutation.mutate();
      }
    },
  });

  // Computed session state
  const sessionState = useMemo(() => {
    const isValid = sessionManager.isSessionValid();
    const needsRefresh = sessionManager.needsRefresh();
    const timeUntilExpiry = sessionManager.getTimeUntilExpiry();
    const expiryTime = sessionManager.getExpiryTime();

    return {
      session,
      isValid,
      needsRefresh,
      timeUntilExpiry,
      expiryTime,
      isAuthenticated: isValid && !!session?.user,
      user: session?.user || null,
    };
  }, [session, sessionManager]);

  // Session actions
  const refreshToken = useCallback(async (): Promise<TokenRefreshResult> => {
    return tokenRefreshMutation.mutateAsync();
  }, [tokenRefreshMutation]);

  const validateSession = useCallback(async (forceRefresh = false): Promise<SessionValidationResult> => {
    return sessionValidationMutation.mutateAsync(forceRefresh);
  }, [sessionValidationMutation]);

  const forceRefresh = useCallback(async (): Promise<TokenRefreshResult> => {
    return sessionManager.forceRefresh();
  }, [sessionManager]);

  const refreshSession = useCallback(async () => {
    await refetchSession();
    await revalidateSession();
  }, [refetchSession, revalidateSession]);

  // Auto-refresh logic
  useEffect(() => {
    if (validationResult?.needsRefresh && validationResult.isValid && !tokenRefreshMutation.isPending) {
      console.log('Auto-refreshing token due to upcoming expiry');
      tokenRefreshMutation.mutate();
    }
  }, [validationResult, tokenRefreshMutation]);

  // Session expiry warning
  useEffect(() => {
    if (sessionState.timeUntilExpiry > 0 && sessionState.timeUntilExpiry < 60000) { // 1 minute
      console.warn(`Session expires in ${Math.round(sessionState.timeUntilExpiry / 1000)} seconds`);
    }
  }, [sessionState.timeUntilExpiry]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't destroy session manager on unmount as it's a singleton
      // Just cancel any pending mutations
      tokenRefreshMutation.reset();
      sessionValidationMutation.reset();
    };
  }, [tokenRefreshMutation, sessionValidationMutation]);

  return {
    // Session state
    ...sessionState,
    
    // Loading states
    isLoading: sessionLoading || validationLoading,
    isRefreshing: tokenRefreshMutation.isPending,
    isValidating: sessionValidationMutation.isPending,
    
    // Error states
    sessionError,
    refreshError: tokenRefreshMutation.error,
    validationError: sessionValidationMutation.error,
    
    // Validation result
    validationResult,
    
    // Actions
    refreshToken,
    validateSession,
    forceRefresh,
    refreshSession,
    
    // Utilities
    getSessionStats: () => sessionManager.getSessionStats(),
    clearSessionCache: () => {
      queryClient.removeQueries({
        queryKey: [...queryKeys.essential.all, 'auth'],
      });
    },
  };
};

// Hook for session status monitoring
export const useSessionStatus = () => {
  const queryClient = useQueryClient();
  const sessionManager = getSessionManager(queryClient);

  return useMemo(() => {
    const stats = sessionManager.getSessionStats();
    
    return {
      ...stats,
      isExpiringSoon: stats.timeUntilExpiry < 5 * 60 * 1000, // 5 minutes
      isExpired: stats.timeUntilExpiry <= 0,
      expiryPercentage: stats.timeUntilExpiry > 0 ? 
        Math.max(0, Math.min(100, (stats.timeUntilExpiry / (60 * 60 * 1000)) * 100)) : 0, // Percentage of hour remaining
    };
  }, [sessionManager]);
};

// Hook for automatic session refresh
export const useAutoSessionRefresh = (enabled = true) => {
  const { needsRefresh, isValid, refreshToken, isRefreshing } = useSessionManagement();

  useEffect(() => {
    if (!enabled || !needsRefresh || !isValid || isRefreshing) {
      return;
    }

    // Auto-refresh with a small delay to avoid race conditions
    const timeout = setTimeout(() => {
      refreshToken().catch((error) => {
        console.error('Auto-refresh failed:', error);
      });
    }, 1000);

    return () => clearTimeout(timeout);
  }, [enabled, needsRefresh, isValid, refreshToken, isRefreshing]);
};

export default useSessionManagement;