import { Session, User } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase-client';
import { queryKeys } from '../lib/queryClient';

// Types for session management
export interface SessionState {
  session: Session | null;
  user: User | null;
  isValid: boolean;
  expiresAt: number | null;
  needsRefresh: boolean;
  lastValidated: number;
}

export interface SessionValidationResult {
  isValid: boolean;
  needsRefresh: boolean;
  timeUntilExpiry: number;
  error?: string;
}

export interface TokenRefreshResult {
  success: boolean;
  newSession?: Session;
  error?: string;
}

class SessionManager {
  private queryClient: QueryClient;
  private sessionState: SessionState | null = null;
  private validationCache = new Map<string, { result: SessionValidationResult; timestamp: number }>();
  private refreshPromise: Promise<TokenRefreshResult> | null = null;
  private validationInterval: NodeJS.Timeout | null = null;
  private refreshThreshold = 5 * 60 * 1000; // 5 minutes before expiry
  private validationCacheTimeout = 30 * 1000; // 30 seconds
  private backgroundValidationInterval = 2 * 60 * 1000; // 2 minutes

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.initializeSessionMonitoring();
  }

  // Initialize session monitoring and background validation
  private initializeSessionMonitoring(): void {
    // Set up auth state change listener
    supabase.auth.onAuthStateChange(async (event, session) => {
      await this.handleAuthStateChange(event, session);
    });

    // Set up background validation
    this.startBackgroundValidation();
  }

  // Handle auth state changes
  private async handleAuthStateChange(event: string, session: Session | null): Promise<void> {
    console.log(`Auth state change: ${event}`);

    switch (event) {
      case 'SIGNED_IN':
        await this.updateSessionState(session);
        this.scheduleTokenRefresh();
        break;
      
      case 'SIGNED_OUT':
        this.clearSessionState();
        this.stopBackgroundValidation();
        break;
      
      case 'TOKEN_REFRESHED':
        await this.updateSessionState(session);
        this.scheduleTokenRefresh();
        break;
      
      case 'USER_UPDATED':
        if (session) {
          await this.updateSessionState(session);
        }
        break;
    }

    // Update React Query cache
    this.updateQueryCache(session);
  }

  // Update internal session state
  private async updateSessionState(session: Session | null): Promise<void> {
    if (!session) {
      this.sessionState = null;
      return;
    }

    const expiresAt = session.expires_at ? new Date(session.expires_at).getTime() : null;
    const now = Date.now();
    const needsRefresh = expiresAt ? (expiresAt - now) < this.refreshThreshold : false;

    this.sessionState = {
      session,
      user: session.user,
      isValid: true,
      expiresAt,
      needsRefresh,
      lastValidated: now,
    };

    // Clear validation cache when session updates
    this.validationCache.clear();
  }

  // Clear session state
  private clearSessionState(): void {
    this.sessionState = null;
    this.validationCache.clear();
    this.clearRefreshPromise();
  }

  // Update React Query cache
  private updateQueryCache(session: Session | null): void {
    // Update session cache
    this.queryClient.setQueryData(
      [...queryKeys.essential.all, 'auth', 'session'],
      session
    );

    // Invalidate user-related queries
    if (session?.user) {
      this.queryClient.invalidateQueries({
        queryKey: queryKeys.user.metadata(session.user.id),
      });
    } else {
      // Clear user data when signed out
      this.queryClient.removeQueries({
        queryKey: queryKeys.user.all,
      });
    }
  }

  // Get current session (cached)
  getCurrentSession(): Session | null {
    return this.sessionState?.session || null;
  }

  // Get current user (cached)
  getCurrentUser(): User | null {
    return this.sessionState?.user || null;
  }

  // Validate session with caching
  async validateSession(forceRefresh = false): Promise<SessionValidationResult> {
    const cacheKey = this.sessionState?.user?.id || 'anonymous';
    
    // Return cached result if available and not expired
    if (!forceRefresh) {
      const cached = this.validationCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.validationCacheTimeout) {
        return cached.result;
      }
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        const result: SessionValidationResult = {
          isValid: false,
          needsRefresh: false,
          timeUntilExpiry: 0,
          error: error.message,
        };
        this.validationCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      const session = data.session;
      const isValid = !!session;
      const now = Date.now();
      const expiresAt = session?.expires_at ? new Date(session.expires_at).getTime() : 0;
      const timeUntilExpiry = Math.max(0, expiresAt - now);
      const needsRefresh = timeUntilExpiry < this.refreshThreshold;

      const result: SessionValidationResult = {
        isValid,
        needsRefresh,
        timeUntilExpiry,
      };

      // Update internal state if session changed
      if (session && (!this.sessionState || this.sessionState.session?.access_token !== session.access_token)) {
        await this.updateSessionState(session);
      }

      // Cache the result
      this.validationCache.set(cacheKey, { result, timestamp: Date.now() });
      
      return result;
    } catch (error) {
      const result: SessionValidationResult = {
        isValid: false,
        needsRefresh: false,
        timeUntilExpiry: 0,
        error: error instanceof Error ? error.message : 'Unknown validation error',
      };
      this.validationCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }
  }

  // Refresh token without blocking UI
  async refreshToken(): Promise<TokenRefreshResult> {
    // Return existing promise if refresh is already in progress
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.clearRefreshPromise();
    }
  }

  // Perform the actual token refresh
  private async performTokenRefresh(): Promise<TokenRefreshResult> {
    try {
      console.log('Refreshing authentication token...');
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.warn('Token refresh failed:', error.message);
        return {
          success: false,
          error: error.message,
        };
      }

      if (!data.session) {
        return {
          success: false,
          error: 'No session returned from refresh',
        };
      }

      console.log('Token refreshed successfully');
      
      // Update internal state
      await this.updateSessionState(data.session);
      
      // Schedule next refresh
      this.scheduleTokenRefresh();

      return {
        success: true,
        newSession: data.session,
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown refresh error',
      };
    }
  }

  // Schedule automatic token refresh
  private scheduleTokenRefresh(): void {
    if (!this.sessionState?.expiresAt) return;

    const now = Date.now();
    const timeUntilRefresh = Math.max(0, this.sessionState.expiresAt - now - this.refreshThreshold);

    // Clear existing timeout
    if (this.refreshPromise) {
      this.clearRefreshPromise();
    }

    // Schedule refresh
    setTimeout(() => {
      if (this.sessionState?.needsRefresh) {
        this.refreshToken();
      }
    }, timeUntilRefresh);
  }

  // Start background validation
  private startBackgroundValidation(): void {
    if (this.validationInterval) return;

    this.validationInterval = setInterval(async () => {
      if (this.sessionState?.isValid) {
        const validation = await this.validateSession();
        
        // Auto-refresh if needed
        if (validation.needsRefresh && validation.isValid) {
          await this.refreshToken();
        }
        
        // Handle invalid session
        if (!validation.isValid) {
          console.warn('Session became invalid during background validation');
          this.clearSessionState();
        }
      }
    }, this.backgroundValidationInterval);
  }

  // Stop background validation
  private stopBackgroundValidation(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
  }

  // Clear refresh promise
  private clearRefreshPromise(): void {
    this.refreshPromise = null;
  }

  // Check if session is valid (cached)
  isSessionValid(): boolean {
    if (!this.sessionState) return false;
    
    const now = Date.now();
    const isExpired = this.sessionState.expiresAt ? now >= this.sessionState.expiresAt : false;
    
    return this.sessionState.isValid && !isExpired;
  }

  // Check if session needs refresh
  needsRefresh(): boolean {
    return this.sessionState?.needsRefresh || false;
  }

  // Get session expiry time
  getExpiryTime(): number | null {
    return this.sessionState?.expiresAt || null;
  }

  // Get time until expiry
  getTimeUntilExpiry(): number {
    if (!this.sessionState?.expiresAt) return 0;
    return Math.max(0, this.sessionState.expiresAt - Date.now());
  }

  // Force session refresh
  async forceRefresh(): Promise<TokenRefreshResult> {
    this.clearRefreshPromise();
    this.validationCache.clear();
    return this.refreshToken();
  }

  // Get session statistics
  getSessionStats(): {
    isValid: boolean;
    timeUntilExpiry: number;
    needsRefresh: boolean;
    lastValidated: number;
    cacheSize: number;
  } {
    return {
      isValid: this.isSessionValid(),
      timeUntilExpiry: this.getTimeUntilExpiry(),
      needsRefresh: this.needsRefresh(),
      lastValidated: this.sessionState?.lastValidated || 0,
      cacheSize: this.validationCache.size,
    };
  }

  // Clear all caches and state
  clearAll(): void {
    this.clearSessionState();
    this.stopBackgroundValidation();
    this.queryClient.removeQueries({
      queryKey: [...queryKeys.essential.all, 'auth'],
    });
  }

  // Destroy the session manager
  destroy(): void {
    this.stopBackgroundValidation();
    this.clearRefreshPromise();
    this.clearSessionState();
  }
}

// Singleton instance
let sessionManager: SessionManager | null = null;

export const getSessionManager = (queryClient: QueryClient): SessionManager => {
  if (!sessionManager) {
    sessionManager = new SessionManager(queryClient);
  }
  return sessionManager;
};

// Hook for using session manager
export const useSessionManager = () => {
  // This should get queryClient from context in a real implementation
  const queryClient = new QueryClient();
  return getSessionManager(queryClient);
};

export default SessionManager;