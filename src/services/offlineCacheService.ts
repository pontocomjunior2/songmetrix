import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';

/**
 * Offline Cache Service - Handles offline data serving and fallback mechanisms
 */
export class OfflineCacheService {
  private queryClient: QueryClient;
  private isOnline: boolean = navigator.onLine;
  private offlineQueue: Array<{ queryKey: readonly unknown[]; timestamp: number }> = [];
  private fallbackData: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  
  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.setupOfflineListeners();
    this.loadPersistedFallbackData();
  }
  
  /**
   * Setup online/offline event listeners
   */
  private setupOfflineListeners() {
    window.addEventListener('online', () => {
      console.log('App came online - processing offline queue...');
      this.isOnline = true;
      this.processOfflineQueue();
    });
    
    window.addEventListener('offline', () => {
      console.log('App went offline - enabling offline mode...');
      this.isOnline = false;
    });
    
    // Update online status periodically
    setInterval(() => {
      const currentOnlineStatus = navigator.onLine;
      if (currentOnlineStatus !== this.isOnline) {
        this.isOnline = currentOnlineStatus;
        if (currentOnlineStatus) {
          this.processOfflineQueue();
        }
      }
    }, 5000);
  }
  
  /**
   * Load persisted fallback data from localStorage
   */
  private loadPersistedFallbackData() {
    try {
      const stored = localStorage.getItem('songmetrix-offline-fallback');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.fallbackData = new Map(parsed);
        console.log(`Loaded ${this.fallbackData.size} fallback data entries from storage`);
      }
    } catch (error) {
      console.error('Failed to load persisted fallback data:', error);
    }
  }
  
  /**
   * Persist fallback data to localStorage
   */
  private persistFallbackData() {
    try {
      const dataArray = Array.from(this.fallbackData.entries());
      localStorage.setItem('songmetrix-offline-fallback', JSON.stringify(dataArray));
    } catch (error) {
      console.error('Failed to persist fallback data:', error);
    }
  }
  
  /**
   * Store data as fallback for offline use
   */
  public storeFallbackData(queryKey: readonly unknown[], data: any, ttl: number = 24 * 60 * 60 * 1000) {
    const keyString = JSON.stringify(queryKey);
    const fallbackEntry = {
      data,
      timestamp: Date.now(),
      ttl
    };
    
    this.fallbackData.set(keyString, fallbackEntry);
    
    // Persist to localStorage for cross-session availability
    this.persistFallbackData();
    
    console.log(`Stored fallback data for key: ${keyString}`);
  }
  
  /**
   * Get fallback data for offline use
   */
  public getFallbackData(queryKey: readonly unknown[]): any | null {
    const keyString = JSON.stringify(queryKey);
    const fallbackEntry = this.fallbackData.get(keyString);
    
    if (!fallbackEntry) {
      return null;
    }
    
    // Check if fallback data is still valid
    const age = Date.now() - fallbackEntry.timestamp;
    if (age > fallbackEntry.ttl) {
      console.log(`Fallback data expired for key: ${keyString}`);
      this.fallbackData.delete(keyString);
      this.persistFallbackData();
      return null;
    }
    
    console.log(`Retrieved fallback data for key: ${keyString}`);
    return fallbackEntry.data;
  }
  
  /**
   * Serve data from cache when offline
   */
  public async serveOfflineData(queryKey: readonly unknown[]): Promise<any> {
    console.log('Serving offline data for:', JSON.stringify(queryKey));
    
    // First, try to get data from React Query cache
    const cachedData = this.queryClient.getQueryData(queryKey);
    if (cachedData) {
      console.log('Serving data from React Query cache');
      return cachedData;
    }
    
    // If no cached data, try fallback data
    const fallbackData = this.getFallbackData(queryKey);
    if (fallbackData) {
      console.log('Serving data from fallback storage');
      
      // Set the fallback data in React Query cache with offline indicator
      this.queryClient.setQueryData(queryKey, {
        ...fallbackData,
        _isOfflineData: true,
        _offlineTimestamp: Date.now()
      });
      
      return fallbackData;
    }
    
    // No data available offline
    console.warn('No offline data available for:', JSON.stringify(queryKey));
    throw new Error('No offline data available');
  }
  
  /**
   * Add query to offline queue for retry when online
   */
  public queueForRetry(queryKey: readonly unknown[]) {
    const queueEntry = {
      queryKey,
      timestamp: Date.now()
    };
    
    // Avoid duplicate entries
    const exists = this.offlineQueue.some(entry => 
      JSON.stringify(entry.queryKey) === JSON.stringify(queryKey)
    );
    
    if (!exists) {
      this.offlineQueue.push(queueEntry);
      console.log(`Queued query for retry: ${JSON.stringify(queryKey)}`);
    }
  }
  
  /**
   * Process offline queue when coming back online
   */
  private async processOfflineQueue() {
    if (this.offlineQueue.length === 0) {
      console.log('No queries in offline queue');
      return;
    }
    
    console.log(`Processing ${this.offlineQueue.length} queries from offline queue`);
    
    // Process queries in batches to avoid overwhelming the server
    const batchSize = 3;
    const batches = [];
    
    for (let i = 0; i < this.offlineQueue.length; i += batchSize) {
      batches.push(this.offlineQueue.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      try {
        await Promise.all(
          batch.map(entry => 
            this.queryClient.refetchQueries({ queryKey: entry.queryKey })
          )
        );
        
        console.log(`Processed batch of ${batch.length} queries`);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('Failed to process offline queue batch:', error);
      }
    }
    
    // Clear the queue after processing
    this.offlineQueue = [];
    console.log('Offline queue processing completed');
  }
  
  /**
   * Check if app is currently offline
   */
  public isOffline(): boolean {
    return !this.isOnline;
  }
  
  /**
   * Get offline status information
   */
  public getOfflineStatus() {
    return {
      isOffline: !this.isOnline,
      queuedQueries: this.offlineQueue.length,
      fallbackDataEntries: this.fallbackData.size,
      lastOnlineCheck: Date.now()
    };
  }
  
  /**
   * Clean up expired fallback data
   */
  public cleanupExpiredFallbackData() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.fallbackData.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        this.fallbackData.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired fallback data entries`);
      this.persistFallbackData();
    }
  }
  
  /**
   * Force sync when coming back online
   */
  public async forceSyncWhenOnline() {
    if (this.isOffline()) {
      console.log('Cannot force sync - app is offline');
      return;
    }
    
    console.log('Force syncing all cached data...');
    
    try {
      // Invalidate all queries to force fresh data
      await this.queryClient.invalidateQueries();
      
      // Process any queued queries
      await this.processOfflineQueue();
      
      console.log('Force sync completed');
    } catch (error) {
      console.error('Force sync failed:', error);
    }
  }
  
  /**
   * Destroy the offline service
   */
  public destroy() {
    window.removeEventListener('online', this.processOfflineQueue);
    window.removeEventListener('offline', () => {});
    this.offlineQueue = [];
    this.fallbackData.clear();
    console.log('Offline cache service destroyed');
  }
}

/**
 * Error Handling Service for cache operations
 */
export class CacheErrorHandlingService {
  private queryClient: QueryClient;
  private offlineService: OfflineCacheService;
  private errorRetryQueue: Map<string, { count: number; lastAttempt: number; maxRetries: number }> = new Map();
  private errorCallbacks: Map<string, (error: Error) => void> = new Map();
  
  constructor(queryClient: QueryClient, offlineService: OfflineCacheService) {
    this.queryClient = queryClient;
    this.offlineService = offlineService;
    this.setupGlobalErrorHandling();
  }
  
  /**
   * Setup global error handling for queries
   */
  private setupGlobalErrorHandling() {
    // Override the default query function to add error handling
    const originalQueryFn = this.queryClient.getDefaultOptions().queries?.queryFn;
    
    this.queryClient.setDefaultOptions({
      queries: {
        ...this.queryClient.getDefaultOptions().queries,
        retry: (failureCount, error) => this.shouldRetry(failureCount, error),
        retryDelay: (attemptIndex) => this.getRetryDelay(attemptIndex),
        onError: (error, query) => this.handleQueryError(error, query),
      },
      mutations: {
        ...this.queryClient.getDefaultOptions().mutations,
        retry: (failureCount, error) => this.shouldRetryMutation(failureCount, error),
        retryDelay: (attemptIndex) => this.getRetryDelay(attemptIndex),
        onError: (error, variables, context, mutation) => this.handleMutationError(error, mutation),
      }
    });
  }
  
  /**
   * Determine if a query should be retried
   */
  private shouldRetry(failureCount: number, error: any): boolean {
    // Don't retry if offline
    if (this.offlineService.isOffline()) {
      return false;
    }
    
    // Don't retry client errors (4xx)
    if (error?.status >= 400 && error?.status < 500) {
      return false;
    }
    
    // Don't retry authentication errors
    if (error?.status === 401 || error?.status === 403) {
      return false;
    }
    
    // Retry server errors and network errors up to 3 times
    return failureCount < 3;
  }
  
  /**
   * Determine if a mutation should be retried
   */
  private shouldRetryMutation(failureCount: number, error: any): boolean {
    // Don't retry mutations if offline (they'll be queued)
    if (this.offlineService.isOffline()) {
      return false;
    }
    
    // Don't retry client errors for mutations
    if (error?.status >= 400 && error?.status < 500) {
      return false;
    }
    
    // Only retry network errors for mutations, and only once
    return failureCount < 1 && (error?.code === 'NETWORK_ERROR' || error?.status >= 500);
  }
  
  /**
   * Get retry delay with exponential backoff
   */
  private getRetryDelay(attemptIndex: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attemptIndex), maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    return delay + jitter;
  }
  
  /**
   * Handle query errors
   */
  private handleQueryError(error: any, query: any) {
    const queryKey = query.queryKey;
    const keyString = JSON.stringify(queryKey);
    
    console.error(`Query error for ${keyString}:`, error);
    
    // If offline, try to serve cached data
    if (this.offlineService.isOffline()) {
      console.log('App is offline - attempting to serve cached data');
      
      try {
        const offlineData = this.offlineService.serveOfflineData(queryKey);
        if (offlineData) {
          // Set the offline data in cache
          this.queryClient.setQueryData(queryKey, {
            ...offlineData,
            _isOfflineData: true,
            _error: error
          });
          return;
        }
      } catch (offlineError) {
        console.error('Failed to serve offline data:', offlineError);
      }
      
      // Queue for retry when online
      this.offlineService.queueForRetry(queryKey);
    }
    
    // Track error for retry logic
    this.trackError(keyString, error);
    
    // Call registered error callback if any
    const errorCallback = this.errorCallbacks.get(keyString);
    if (errorCallback) {
      errorCallback(error);
    }
    
    // Log error details for monitoring
    this.logErrorForMonitoring(error, queryKey, 'query');
  }
  
  /**
   * Handle mutation errors
   */
  private handleMutationError(error: any, mutation: any) {
    const mutationKey = mutation.options.mutationKey || ['unknown-mutation'];
    const keyString = JSON.stringify(mutationKey);
    
    console.error(`Mutation error for ${keyString}:`, error);
    
    // If offline, queue mutation for retry
    if (this.offlineService.isOffline()) {
      console.log('Mutation failed offline - will retry when online');
      // Note: Mutation retry when online would need to be implemented
      // based on specific application requirements
    }
    
    // Track error for retry logic
    this.trackError(keyString, error);
    
    // Log error details for monitoring
    this.logErrorForMonitoring(error, mutationKey, 'mutation');
  }
  
  /**
   * Track errors for retry logic
   */
  private trackError(keyString: string, error: any) {
    const existing = this.errorRetryQueue.get(keyString);
    const now = Date.now();
    
    if (existing) {
      existing.count++;
      existing.lastAttempt = now;
    } else {
      this.errorRetryQueue.set(keyString, {
        count: 1,
        lastAttempt: now,
        maxRetries: this.getMaxRetriesForError(error)
      });
    }
  }
  
  /**
   * Get max retries based on error type
   */
  private getMaxRetriesForError(error: any): number {
    // Network errors: more retries
    if (error?.code === 'NETWORK_ERROR') {
      return 5;
    }
    
    // Server errors: moderate retries
    if (error?.status >= 500) {
      return 3;
    }
    
    // Client errors: no retries
    if (error?.status >= 400 && error?.status < 500) {
      return 0;
    }
    
    // Unknown errors: conservative retries
    return 2;
  }
  
  /**
   * Log error for monitoring and analytics
   */
  private logErrorForMonitoring(error: any, queryKey: readonly unknown[], type: 'query' | 'mutation') {
    const errorLog = {
      timestamp: new Date().toISOString(),
      type,
      queryKey: JSON.stringify(queryKey),
      error: {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        stack: error?.stack
      },
      userAgent: navigator.userAgent,
      url: window.location.href,
      isOnline: navigator.onLine
    };
    
    // Log to console for development
    console.error('Cache Error Log:', errorLog);
    
    // In production, this could be sent to an error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error tracking service
      // errorTrackingService.logError(errorLog);
    }
  }
  
  /**
   * Register error callback for specific query
   */
  public registerErrorCallback(queryKey: readonly unknown[], callback: (error: Error) => void) {
    const keyString = JSON.stringify(queryKey);
    this.errorCallbacks.set(keyString, callback);
  }
  
  /**
   * Unregister error callback
   */
  public unregisterErrorCallback(queryKey: readonly unknown[]) {
    const keyString = JSON.stringify(queryKey);
    this.errorCallbacks.delete(keyString);
  }
  
  /**
   * Get error statistics
   */
  public getErrorStats() {
    const now = Date.now();
    const recentErrors = Array.from(this.errorRetryQueue.entries()).filter(
      ([_, entry]) => now - entry.lastAttempt < 60 * 60 * 1000 // Last hour
    );
    
    return {
      totalTrackedErrors: this.errorRetryQueue.size,
      recentErrors: recentErrors.length,
      registeredCallbacks: this.errorCallbacks.size,
      offlineStatus: this.offlineService.getOfflineStatus()
    };
  }
  
  /**
   * Clear error tracking data
   */
  public clearErrorTracking() {
    this.errorRetryQueue.clear();
    this.errorCallbacks.clear();
    console.log('Error tracking data cleared');
  }
  
  /**
   * Destroy the error handling service
   */
  public destroy() {
    this.clearErrorTracking();
    console.log('Cache error handling service destroyed');
  }
}

/**
 * Cache Status Indicator Service
 */
export class CacheStatusService {
  private queryClient: QueryClient;
  private offlineService: OfflineCacheService;
  private statusCallbacks: Set<(status: CacheStatus) => void> = new Set();
  private currentStatus: CacheStatus;
  
  constructor(queryClient: QueryClient, offlineService: OfflineCacheService) {
    this.queryClient = queryClient;
    this.offlineService = offlineService;
    this.currentStatus = this.calculateStatus();
    this.setupStatusMonitoring();
  }
  
  /**
   * Setup status monitoring
   */
  private setupStatusMonitoring() {
    // Monitor status every 5 seconds
    setInterval(() => {
      const newStatus = this.calculateStatus();
      if (this.hasStatusChanged(newStatus)) {
        this.currentStatus = newStatus;
        this.notifyStatusChange(newStatus);
      }
    }, 5000);
  }
  
  /**
   * Calculate current cache status
   */
  private calculateStatus(): CacheStatus {
    const cache = this.queryClient.getQueryCache();
    const queries = cache.getAll();
    const offlineStatus = this.offlineService.getOfflineStatus();
    
    const totalQueries = queries.length;
    const successfulQueries = queries.filter(q => q.state.status === 'success').length;
    const errorQueries = queries.filter(q => q.state.status === 'error').length;
    const loadingQueries = queries.filter(q => q.state.status === 'pending').length;
    const staleQueries = queries.filter(q => q.isStale()).length;
    
    // Check for offline data
    const offlineDataQueries = queries.filter(q => 
      q.state.data && (q.state.data as any)?._isOfflineData
    ).length;
    
    return {
      isOnline: !offlineStatus.isOffline,
      totalQueries,
      successfulQueries,
      errorQueries,
      loadingQueries,
      staleQueries,
      offlineDataQueries,
      queuedQueries: offlineStatus.queuedQueries,
      fallbackDataEntries: offlineStatus.fallbackDataEntries,
      cacheHealth: this.calculateCacheHealth(totalQueries, successfulQueries, errorQueries, staleQueries),
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Calculate cache health score
   */
  private calculateCacheHealth(total: number, successful: number, error: number, stale: number): number {
    if (total === 0) return 100;
    
    const successRate = (successful / total) * 100;
    const errorRate = (error / total) * 100;
    const staleRate = (stale / total) * 100;
    
    // Health score calculation
    let health = successRate;
    health -= errorRate * 2; // Errors are more impactful
    health -= staleRate * 0.5; // Stale data is less impactful
    
    return Math.max(0, Math.min(100, Math.round(health)));
  }
  
  /**
   * Check if status has changed significantly
   */
  private hasStatusChanged(newStatus: CacheStatus): boolean {
    if (!this.currentStatus) return true;
    
    return (
      this.currentStatus.isOnline !== newStatus.isOnline ||
      this.currentStatus.totalQueries !== newStatus.totalQueries ||
      this.currentStatus.errorQueries !== newStatus.errorQueries ||
      this.currentStatus.offlineDataQueries !== newStatus.offlineDataQueries ||
      Math.abs(this.currentStatus.cacheHealth - newStatus.cacheHealth) > 5
    );
  }
  
  /**
   * Notify status change to callbacks
   */
  private notifyStatusChange(status: CacheStatus) {
    this.statusCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in status callback:', error);
      }
    });
  }
  
  /**
   * Subscribe to status changes
   */
  public subscribeToStatus(callback: (status: CacheStatus) => void): () => void {
    this.statusCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.statusCallbacks.delete(callback);
    };
  }
  
  /**
   * Get current cache status
   */
  public getCurrentStatus(): CacheStatus {
    return this.currentStatus;
  }
  
  /**
   * Force status update
   */
  public forceStatusUpdate() {
    const newStatus = this.calculateStatus();
    this.currentStatus = newStatus;
    this.notifyStatusChange(newStatus);
  }
  
  /**
   * Destroy the status service
   */
  public destroy() {
    this.statusCallbacks.clear();
    console.log('Cache status service destroyed');
  }
}

/**
 * Cache status interface
 */
export interface CacheStatus {
  isOnline: boolean;
  totalQueries: number;
  successfulQueries: number;
  errorQueries: number;
  loadingQueries: number;
  staleQueries: number;
  offlineDataQueries: number;
  queuedQueries: number;
  fallbackDataEntries: number;
  cacheHealth: number; // 0-100
  lastUpdated: number;
}