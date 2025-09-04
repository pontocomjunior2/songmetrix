import { QueryClient } from '@tanstack/react-query';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase-client';
import { queryKeys } from '../lib/queryClient';

// Types for user metadata and permissions
export interface UserMetadata {
  plan_id?: string;
  trial_ends_at?: string;
  favorite_segments?: string[];
  favorite_radios?: string[];
  full_name?: string;
  whatsapp?: string;
  preferences_migrated?: boolean;
  last_preference_check?: string;
  permissions?: UserPermissions;
  role?: 'user' | 'admin' | 'moderator';
}

export interface UserPermissions {
  canAccessAdmin?: boolean;
  canManageUsers?: boolean;
  canViewAnalytics?: boolean;
  canExportData?: boolean;
  canManageContent?: boolean;
  maxInsights?: number;
  maxRadios?: number;
}

export interface CachedUserData {
  user: User;
  metadata: UserMetadata;
  permissions: UserPermissions;
  planId: string;
  isTrialExpired: boolean;
  lastUpdated: number;
}

// Default permissions based on plan
const DEFAULT_PERMISSIONS: Record<string, UserPermissions> = {
  FREE: {
    canAccessAdmin: false,
    canManageUsers: false,
    canViewAnalytics: false,
    canExportData: false,
    canManageContent: false,
    maxInsights: 5,
    maxRadios: 3,
  },
  TRIAL: {
    canAccessAdmin: false,
    canManageUsers: false,
    canViewAnalytics: true,
    canExportData: false,
    canManageContent: false,
    maxInsights: 50,
    maxRadios: 10,
  },
  PRO: {
    canAccessAdmin: false,
    canManageUsers: false,
    canViewAnalytics: true,
    canExportData: true,
    canManageContent: false,
    maxInsights: -1, // unlimited
    maxRadios: -1, // unlimited
  },
  ADMIN: {
    canAccessAdmin: true,
    canManageUsers: true,
    canViewAnalytics: true,
    canExportData: true,
    canManageContent: true,
    maxInsights: -1,
    maxRadios: -1,
  },
};

class UserMetadataService {
  private queryClient: QueryClient;
  private cache = new Map<string, CachedUserData>();
  private cacheExpiry = 10 * 60 * 1000; // 10 minutes

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  // Get user data from cache or fetch if needed
  async getUserData(userId: string, forceRefresh = false): Promise<CachedUserData | null> {
    // Check cache first
    if (!forceRefresh) {
      const cached = this.cache.get(userId);
      if (cached && Date.now() - cached.lastUpdated < this.cacheExpiry) {
        return cached;
      }
    }

    try {
      // Fetch from Supabase
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user || data.user.id !== userId) {
        return null;
      }

      const user = data.user;
      const metadata = (user.user_metadata as UserMetadata) || {};
      
      // Compute plan and permissions
      const planId = this.computePlanId(metadata);
      const permissions = this.computePermissions(metadata, planId);
      const isTrialExpired = this.isTrialExpired(metadata);

      const userData: CachedUserData = {
        user,
        metadata,
        permissions,
        planId,
        isTrialExpired,
        lastUpdated: Date.now(),
      };

      // Cache the result
      this.cache.set(userId, userData);

      // Also update React Query cache
      this.queryClient.setQueryData(
        queryKeys.user.metadata(userId),
        metadata
      );

      return userData;
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      return null;
    }
  }

  // Check permissions without API calls
  hasPermission(userId: string, permission: keyof UserPermissions): boolean {
    const cached = this.cache.get(userId);
    if (!cached) {
      // If not cached, assume no permission for security
      return false;
    }

    return !!cached.permissions[permission];
  }

  // Check if user can perform action based on limits
  canPerformAction(userId: string, action: 'createInsight' | 'addRadio', currentCount: number): boolean {
    const cached = this.cache.get(userId);
    if (!cached) return false;

    const { permissions } = cached;
    
    switch (action) {
      case 'createInsight':
        return permissions.maxInsights === -1 || currentCount < (permissions.maxInsights || 0);
      case 'addRadio':
        return permissions.maxRadios === -1 || currentCount < (permissions.maxRadios || 0);
      default:
        return false;
    }
  }

  // Get user plan without API calls
  getUserPlan(userId: string): string | null {
    const cached = this.cache.get(userId);
    return cached?.planId || null;
  }

  // Check if user is admin
  isAdmin(userId: string): boolean {
    return this.hasPermission(userId, 'canAccessAdmin');
  }

  // Update user metadata with optimistic updates
  async updateUserMetadata(userId: string, updates: Partial<UserMetadata>): Promise<boolean> {
    try {
      // Optimistically update cache
      const cached = this.cache.get(userId);
      if (cached) {
        const updatedMetadata = { ...cached.metadata, ...updates };
        const updatedUserData: CachedUserData = {
          ...cached,
          metadata: updatedMetadata,
          permissions: this.computePermissions(updatedMetadata, cached.planId),
          lastUpdated: Date.now(),
        };
        this.cache.set(userId, updatedUserData);
      }

      // Update in Supabase
      const { error } = await supabase.auth.updateUser({
        data: updates,
      });

      if (error) {
        // Rollback cache on error
        if (cached) {
          this.cache.set(userId, cached);
        }
        throw error;
      }

      // Invalidate React Query cache to trigger refetch
      this.queryClient.invalidateQueries({
        queryKey: queryKeys.user.metadata(userId),
      });

      return true;
    } catch (error) {
      console.error('Failed to update user metadata:', error);
      return false;
    }
  }

  // Preload user data for better performance
  async preloadUserData(userId: string): Promise<void> {
    // Use React Query to prefetch and cache
    await this.queryClient.prefetchQuery({
      queryKey: queryKeys.user.metadata(userId),
      queryFn: async () => {
        const userData = await this.getUserData(userId, true);
        return userData?.metadata || {};
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes
    });
  }

  // Clear cache for user
  clearUserCache(userId: string): void {
    this.cache.delete(userId);
    this.queryClient.removeQueries({
      queryKey: queryKeys.user.metadata(userId),
    });
  }

  // Clear all cache
  clearAllCache(): void {
    this.cache.clear();
    this.queryClient.removeQueries({
      queryKey: queryKeys.user.all,
    });
  }

  // Get cache statistics
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  // Private helper methods
  private computePlanId(metadata: UserMetadata): string {
    let planId = (metadata.plan_id || 'FREE').trim().toUpperCase();
    
    // Check if trial is expired
    if (planId === 'TRIAL' && this.isTrialExpired(metadata)) {
      planId = 'FREE';
    }

    // Check for admin role
    if (metadata.role === 'admin') {
      planId = 'ADMIN';
    }

    return planId;
  }

  private computePermissions(metadata: UserMetadata, planId: string): UserPermissions {
    // Start with default permissions for plan
    const defaultPerms = DEFAULT_PERMISSIONS[planId] || DEFAULT_PERMISSIONS.FREE;
    
    // Override with custom permissions if available
    const customPerms = metadata.permissions || {};
    
    return { ...defaultPerms, ...customPerms };
  }

  private isTrialExpired(metadata: UserMetadata): boolean {
    if (!metadata.trial_ends_at) return false;
    
    const trialEnd = new Date(metadata.trial_ends_at);
    const now = new Date();
    
    return trialEnd < now;
  }
}

// Singleton instance
let userMetadataService: UserMetadataService | null = null;

export const getUserMetadataService = (queryClient: QueryClient): UserMetadataService => {
  if (!userMetadataService) {
    userMetadataService = new UserMetadataService(queryClient);
  }
  return userMetadataService;
};

// Hook for using the service
export const useUserMetadataService = () => {
  const queryClient = new QueryClient(); // This should be injected from context
  return getUserMetadataService(queryClient);
};

// Utility functions for permission checking
export const checkPermission = (
  userData: CachedUserData | null,
  permission: keyof UserPermissions
): boolean => {
  if (!userData) return false;
  return !!userData.permissions[permission];
};

export const checkActionLimit = (
  userData: CachedUserData | null,
  action: 'createInsight' | 'addRadio',
  currentCount: number
): boolean => {
  if (!userData) return false;
  
  const { permissions } = userData;
  
  switch (action) {
    case 'createInsight':
      return permissions.maxInsights === -1 || currentCount < (permissions.maxInsights || 0);
    case 'addRadio':
      return permissions.maxRadios === -1 || currentCount < (permissions.maxRadios || 0);
    default:
      return false;
  }
};

export default UserMetadataService;