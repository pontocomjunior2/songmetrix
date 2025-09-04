import { useCallback, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User } from '@supabase/supabase-js';
import { useSessionManagement } from './useSessionManagement';
import { useCachedUserData } from './useCachedUserData';
import { getUserMetadataService, UserPermissions } from '../services/userMetadataService';
import { getSessionManager } from '../services/sessionManager';
import { supabase } from '../lib/supabase-client';
import { toast } from 'react-toastify';

// Comprehensive auth integration hook that combines all optimized features
export const useOptimizedAuthIntegration = () => {
  const queryClient = useQueryClient();
  const sessionManager = getSessionManager(queryClient);
  const userMetadataService = getUserMetadataService(queryClient);

  // Session management
  const {
    session,
    user,
    isValid: sessionIsValid,
    isAuthenticated,
    isLoading: sessionLoading,
    isRefreshing,
    refreshToken,
    validateSession,
    refreshSession,
    sessionError,
  } = useSessionManagement();

  // User data and permissions
  const {
    userMetadata,
    permissions,
    cachedUserData,
    planId,
    isTrialExpired,
    isLoading: userDataLoading,
    hasPermission,
    canPerformAction,
    isAdmin,
    isPro,
    isTrialActive,
    hasPreferences,
    updatePreference,
    batchUpdatePreferences,
    getUserLimits,
    isApproachingLimits,
    preloadUserData,
    clearUserCache,
    getFreshUserData,
  } = useCachedUserData(user);

  // Combined loading state
  const isLoading = sessionLoading || userDataLoading || isRefreshing;

  // Enhanced login function with preloading
  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      if (!data?.user) {
        return { error: new Error('User not found after login') };
      }

      // Preload user data immediately after login
      await preloadUserData();

      // Refresh session to ensure everything is up to date
      await refreshSession();

      return { error: null };
    } catch (err) {
      return { error: err };
    }
  }, [preloadUserData, refreshSession]);

  // Enhanced logout function with cache clearing
  const logout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast.error('Error signing out. Please try again.');
        return;
      }

      // Clear all caches
      clearUserCache();
      sessionManager.clearAll();
      
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error during logout');
    }
  }, [clearUserCache, sessionManager]);

  // Enhanced sign up function
  const signUp = useCallback(async (
    email: string, 
    password: string, 
    fullName?: string, 
    whatsapp?: string
  ) => {
    try {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            whatsapp: whatsapp,
            plan_id: 'trial',
            trial_ends_at: trialEndDate.toISOString(),
          },
        },
      });

      if (error) {
        return { error };
      }

      const confirmationRequired = data.session === null && data.user !== null;

      if (confirmationRequired) {
        return {
          error: null,
          confirmation_sent: true,
          message: 'Registration successful! Check your email to activate your account.',
        };
      }

      // Preload user data for immediate login
      if (data.user) {
        await preloadUserData();
      }

      return {
        error: null,
        confirmation_sent: false,
        message: 'Account created successfully!',
      };
    } catch (err) {
      return { error: err };
    }
  }, [preloadUserData]);

  // Update favorite segments with optimistic updates
  const updateFavoriteSegments = useCallback(async (segments: string[]) => {
    if (!user) {
      toast.error('You need to be logged in to save preferences.');
      return;
    }

    try {
      await updatePreference('favorite_segments', segments);
      toast.success('Favorite segments updated successfully!');
    } catch (error) {
      console.error('Error updating favorite segments:', error);
      toast.error('Failed to update favorite segments');
      throw error;
    }
  }, [user, updatePreference]);

  // Update favorite radios (legacy support)
  const updateFavoriteRadios = useCallback(async (radios: string[]) => {
    if (!user) {
      toast.error('You need to be logged in to save favorites.');
      return;
    }

    try {
      await updatePreference('favorite_radios', radios);
      toast.success('Favorite radios updated successfully!');
    } catch (error) {
      console.error('Error updating favorite radios:', error);
      toast.error('Failed to update favorite radios');
      throw error;
    }
  }, [user, updatePreference]);

  // Check if user needs preference migration
  const needsPreferenceMigration = useMemo(() => {
    if (!userMetadata) return false;
    return !userMetadata.preferences_migrated && 
           !userMetadata.favorite_segments?.length && 
           !!userMetadata.favorite_radios?.length;
  }, [userMetadata]);

  // Migrate preferences in background
  const migratePreferences = useCallback(async () => {
    if (!user || !needsPreferenceMigration || !userMetadata?.favorite_radios) {
      return;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch('/api/radios/segments-map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ radioNames: userMetadata.favorite_radios }),
      });

      if (!response.ok) {
        throw new Error(`Migration API error: ${response.statusText}`);
      }

      const mappedSegments: string[] = await response.json();

      if (mappedSegments.length > 0) {
        await batchUpdatePreferences({
          favorite_segments: mappedSegments,
          preferences_migrated: true,
          favorite_radios: null, // Remove old data
        });

        console.log('Preferences migrated successfully');
      }
    } catch (error) {
      console.error('Preference migration failed:', error);
    }
  }, [user, needsPreferenceMigration, userMetadata, batchUpdatePreferences]);

  // Auto-migrate preferences when needed
  useEffect(() => {
    if (needsPreferenceMigration && isAuthenticated) {
      // Delay migration to not block initial load
      const timeout = setTimeout(() => {
        migratePreferences();
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [needsPreferenceMigration, isAuthenticated, migratePreferences]);

  // Auto-refresh token when needed
  useEffect(() => {
    if (sessionIsValid && session?.expires_at) {
      const expiresAt = new Date(session.expires_at).getTime();
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      
      // Refresh token 5 minutes before expiry
      if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
        refreshToken().catch(console.error);
      }
    }
  }, [sessionIsValid, session, refreshToken]);

  // Preload data on authentication
  useEffect(() => {
    if (isAuthenticated && user && !userDataLoading) {
      preloadUserData().catch(console.error);
    }
  }, [isAuthenticated, user, userDataLoading, preloadUserData]);

  // Memoized auth state
  const authState = useMemo(() => ({
    // Core state
    currentUser: user,
    session,
    isAuthenticated,
    isLoading,
    
    // User data
    userMetadata,
    permissions,
    planId,
    trialEndsAt: userMetadata?.trial_ends_at || null,
    favoriteSegments: userMetadata?.favorite_segments || null,
    
    // Status checks
    isTrialExpired,
    isTrialActive: isTrialActive(),
    isPro: isPro(),
    isAdmin: isAdmin(),
    hasPreferences: hasPreferences(),
    needsPreferenceMigration,
    
    // Session status
    sessionIsValid,
    isRefreshing,
    
    // Errors
    error: sessionError,
  }), [
    user,
    session,
    isAuthenticated,
    isLoading,
    userMetadata,
    permissions,
    planId,
    isTrialExpired,
    isTrialActive,
    isPro,
    isAdmin,
    hasPreferences,
    needsPreferenceMigration,
    sessionIsValid,
    isRefreshing,
    sessionError,
  ]);

  // Memoized actions
  const authActions = useMemo(() => ({
    // Authentication
    login,
    logout,
    signUp,
    
    // Session management
    refreshSession,
    validateSession,
    refreshToken,
    
    // User preferences
    updateFavoriteSegments,
    updateFavoriteRadios,
    updatePreference,
    batchUpdatePreferences,
    migratePreferences,
    
    // Permission checking
    hasPermission,
    canPerformAction,
    getUserLimits,
    isApproachingLimits,
    
    // Cache management
    preloadUserData,
    clearUserCache,
    getFreshUserData,
    
    // Utilities
    clearAllCaches: () => {
      clearUserCache();
      sessionManager.clearAll();
    },
  }), [
    login,
    logout,
    signUp,
    refreshSession,
    validateSession,
    refreshToken,
    updateFavoriteSegments,
    updateFavoriteRadios,
    updatePreference,
    batchUpdatePreferences,
    migratePreferences,
    hasPermission,
    canPerformAction,
    getUserLimits,
    isApproachingLimits,
    preloadUserData,
    clearUserCache,
    getFreshUserData,
    sessionManager,
  ]);

  return {
    ...authState,
    ...authActions,
  };
};

// Hook for checking specific permissions with loading state
export const usePermissionCheck = (permission: keyof UserPermissions) => {
  const { hasPermission, isLoading, currentUser } = useOptimizedAuthIntegration();
  
  return useMemo(() => ({
    hasPermission: hasPermission(permission),
    isLoading,
    isAuthenticated: !!currentUser,
    canRender: !isLoading && hasPermission(permission),
  }), [hasPermission, permission, isLoading, currentUser]);
};

// Hook for plan-based feature access
export const usePlanAccess = () => {
  const { planId, permissions, isTrialActive, isPro, isAdmin } = useOptimizedAuthIntegration();
  
  return useMemo(() => ({
    planId,
    isTrialActive,
    isPro,
    isAdmin,
    canAccessAnalytics: permissions?.canViewAnalytics || false,
    canExportData: permissions?.canExportData || false,
    canManageUsers: permissions?.canManageUsers || false,
    hasUnlimitedInsights: permissions?.maxInsights === -1,
    hasUnlimitedRadios: permissions?.maxRadios === -1,
    maxInsights: permissions?.maxInsights || 0,
    maxRadios: permissions?.maxRadios || 0,
  }), [planId, permissions, isTrialActive, isPro, isAdmin]);
};

export default useOptimizedAuthIntegration;