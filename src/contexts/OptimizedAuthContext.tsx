import React, { createContext, useContext, useEffect, useCallback, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useOptimizedAuth } from '../hooks/useOptimizedAuth';
import { getUserMetadataService, UserPermissions, CachedUserData } from '../services/userMetadataService';
import { supabase } from '../lib/supabase-client';
import { toast } from 'react-toastify';

// Enhanced AuthContext interface with optimized features
export interface OptimizedAuthContextType {
  // Core auth state
  currentUser: User | null;
  planId: string | null;
  trialEndsAt: string | null;
  favoriteSegments: string[] | null;
  isAuthenticated: boolean;
  
  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  
  // Error state
  error: any;
  
  // Permissions and metadata
  permissions: UserPermissions | null;
  hasPermission: (permission: keyof UserPermissions) => boolean;
  canPerformAction: (action: 'createInsight' | 'addRadio', currentCount: number) => boolean;
  isAdmin: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<{ error: any }>;
  logout: () => Promise<void>;
  signUp: (email: string, password: string, fullName?: string, whatsapp?: string) => Promise<any>;
  
  // Optimized preference management
  updateFavoriteSegments: (segments: string[]) => Promise<void>;
  userHasPreferences: () => boolean;
  
  // Session management
  refreshSession: () => Promise<void>;
  validateSession: () => Promise<boolean>;
  
  // Cache management
  clearCache: () => void;
  preloadUserData: () => Promise<void>;
}

const OptimizedAuthContext = createContext<OptimizedAuthContextType | undefined>(undefined);

export const OptimizedAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const userMetadataService = getUserMetadataService(queryClient);
  
  const {
    currentUser,
    planId,
    trialEndsAt,
    favoriteSegments,
    hasPreferences,
    isAuthenticated,
    isLoading,
    error,
    validateSession,
    refreshSession,
    refreshMetadata,
    updatePreferences,
    refreshTokenInBackground,
    runBackgroundTasks,
    isUpdatingPreferences,
    clearAuthCache,
  } = useOptimizedAuth();

  // Get cached user data for permissions
  const cachedUserData = useMemo((): CachedUserData | null => {
    if (!currentUser) return null;
    
    // Try to get from service cache
    const cached = userMetadataService.getUserData(currentUser.id, false);
    return cached instanceof Promise ? null : cached;
  }, [currentUser, userMetadataService]);

  // Memoized permission helpers
  const permissions = useMemo(() => {
    return cachedUserData?.permissions || null;
  }, [cachedUserData]);

  const hasPermission = useCallback((permission: keyof UserPermissions): boolean => {
    if (!currentUser) return false;
    return userMetadataService.hasPermission(currentUser.id, permission);
  }, [currentUser, userMetadataService]);

  const canPerformAction = useCallback((action: 'createInsight' | 'addRadio', currentCount: number): boolean => {
    if (!currentUser) return false;
    return userMetadataService.canPerformAction(currentUser.id, action, currentCount);
  }, [currentUser, userMetadataService]);

  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    return userMetadataService.isAdmin(currentUser.id);
  }, [currentUser, userMetadataService]);

  // Optimized login function
  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        return { error: signInError };
      }

      if (!data?.user) {
        return { error: new Error('User not found after login') };
      }

      // Preload user data in background
      if (data.user.id) {
        userMetadataService.preloadUserData(data.user.id);
      }

      // Refresh session data
      await refreshSession();

      return { error: null };
    } catch (err) {
      return { error: err };
    }
  }, [refreshSession, userMetadataService]);

  // Optimized logout function
  const logout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error('Error signing out. Please try again.');
        return;
      }

      // Clear all caches
      clearAuthCache();
      userMetadataService.clearAllCache();
      
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error during logout');
    }
  }, [clearAuthCache, userMetadataService]);

  // Optimized sign up function
  const signUp = useCallback(async (email: string, password: string, fullName?: string, whatsapp?: string) => {
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

      return {
        error: null,
        confirmation_sent: false,
        message: 'Account created successfully!',
      };
    } catch (err) {
      return { error: err };
    }
  }, []);

  // Optimized preference update
  const updateFavoriteSegments = useCallback(async (segments: string[]) => {
    if (!currentUser) {
      toast.error('You need to be logged in to save preferences.');
      return;
    }

    try {
      // Use the optimized update function
      updatePreferences({ segments, userId: currentUser.id });
    } catch (error) {
      console.error('Error updating favorite segments:', error);
      throw error;
    }
  }, [currentUser, updatePreferences]);

  // Check if user has preferences (cached)
  const userHasPreferencesCheck = useCallback((): boolean => {
    return hasPreferences;
  }, [hasPreferences]);

  // Validate session with caching
  const validateSessionOptimized = useCallback(async (): Promise<boolean> => {
    const result = await validateSession(currentUser?.id);
    return result.isValid;
  }, [validateSession, currentUser]);

  // Preload user data
  const preloadUserData = useCallback(async () => {
    if (currentUser) {
      await userMetadataService.preloadUserData(currentUser.id);
    }
  }, [currentUser, userMetadataService]);

  // Clear all caches
  const clearCache = useCallback(() => {
    clearAuthCache();
    userMetadataService.clearAllCache();
  }, [clearAuthCache, userMetadataService]);

  // Run background tasks when user is authenticated
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      // Run background tasks (preference checks, migrations, token refresh)
      runBackgroundTasks();
      
      // Preload user data if not already cached
      const userId = currentUser.id;
      userMetadataService.getUserData(userId, false).then((cached) => {
        if (!cached) {
          userMetadataService.preloadUserData(userId);
        }
      });

      // Set up periodic background tasks
      const interval = setInterval(() => {
        runBackgroundTasks();
      }, 5 * 60 * 1000); // Every 5 minutes

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, currentUser, runBackgroundTasks, userMetadataService]);

  // Auth state change listener for cache management
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        // Clear caches on sign out
        clearCache();
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Preload data on sign in
        await userMetadataService.preloadUserData(session.user.id);
      } else if (event === 'TOKEN_REFRESHED') {
        // Update cached session data
        await refreshSession();
      }
    });

    return () => subscription.unsubscribe();
  }, [clearCache, userMetadataService, refreshSession]);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    // Core auth state
    currentUser,
    planId,
    trialEndsAt,
    favoriteSegments,
    isAuthenticated,
    
    // Loading states
    isLoading: isLoading || isUpdatingPreferences,
    isInitialized: !isLoading,
    
    // Error state
    error,
    
    // Permissions and metadata
    permissions,
    hasPermission,
    canPerformAction,
    isAdmin,
    
    // Actions
    login,
    logout,
    signUp,
    
    // Optimized preference management
    updateFavoriteSegments,
    userHasPreferences: userHasPreferencesCheck,
    
    // Session management
    refreshSession,
    validateSession: validateSessionOptimized,
    
    // Cache management
    clearCache,
    preloadUserData,
  }), [
    currentUser,
    planId,
    trialEndsAt,
    favoriteSegments,
    isAuthenticated,
    isLoading,
    isUpdatingPreferences,
    error,
    permissions,
    hasPermission,
    canPerformAction,
    isAdmin,
    login,
    logout,
    signUp,
    updateFavoriteSegments,
    userHasPreferencesCheck,
    refreshSession,
    validateSessionOptimized,
    clearCache,
    preloadUserData,
  ]);

  return (
    <OptimizedAuthContext.Provider value={contextValue}>
      {children}
    </OptimizedAuthContext.Provider>
  );
};

// Hook to use the optimized auth context
export const useOptimizedAuthContext = () => {
  const context = useContext(OptimizedAuthContext);
  if (context === undefined) {
    throw new Error('useOptimizedAuthContext must be used within an OptimizedAuthProvider');
  }
  return context;
};

export default OptimizedAuthContext;