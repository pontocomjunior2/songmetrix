import { QueryClient } from '@tanstack/react-query';
import { queryKeys, prefetchQueries } from '../lib/queryClient';

/**
 * Cache Warming Service - Intelligent cache preloading strategies
 */
export class CacheWarmingService {
  private queryClient: QueryClient;
  private warmingQueue: Map<string, Promise<void>> = new Map();
  private userBehaviorPatterns: Map<string, string[]> = new Map();
  private warmingHistory: Map<string, number> = new Map();
  
  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.setupIdleWarming();
  }
  
  /**
   * Setup idle time cache warming using requestIdleCallback
   */
  private setupIdleWarming() {
    const warmDuringIdle = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback((deadline) => {
          if (deadline.timeRemaining() > 50) {
            this.performIdleWarming();
          }
        }, { timeout: 5000 });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          this.performIdleWarming();
        }, 3000);
      }
    };
    
    // Setup periodic idle warming
    setInterval(warmDuringIdle, 30000); // Every 30 seconds
  }
  
  /**
   * Perform cache warming during idle time
   */
  private async performIdleWarming() {
    // Only warm during idle if user is active and online
    if (document.hidden || !navigator.onLine) {
      return;
    }
    
    console.log('Performing idle cache warming...');
    
    try {
      // Warm static data that might be needed later
      await this.queryClient.prefetchQuery({
        queryKey: queryKeys.static.genres(),
        staleTime: 60 * 60 * 1000, // 1 hour
      });
      
      await this.queryClient.prefetchQuery({
        queryKey: queryKeys.static.countries(),
        staleTime: 60 * 60 * 1000, // 1 hour
      });
      
      console.log('Idle cache warming completed');
    } catch (error) {
      console.error('Idle cache warming failed:', error);
    }
  }
  
  /**
   * Warm cache on user login with progressive loading
   */
  public async warmOnLogin(userId: string, userProfile?: any) {
    const warmingKey = `login-${userId}`;
    
    // Prevent duplicate warming
    if (this.warmingQueue.has(warmingKey)) {
      return this.warmingQueue.get(warmingKey);
    }
    
    console.log(`Starting login cache warming for user: ${userId}`);
    
    const warmingPromise = this.performLoginWarming(userId, userProfile);
    this.warmingQueue.set(warmingKey, warmingPromise);
    
    try {
      await warmingPromise;
      console.log('Login cache warming completed');
    } finally {
      this.warmingQueue.delete(warmingKey);
    }
    
    return warmingPromise;
  }
  
  /**
   * Perform the actual login cache warming
   */
  private async performLoginWarming(userId: string, userProfile?: any) {
    // Phase 1: Essential data (immediate)
    await Promise.all([
      this.queryClient.prefetchQuery({
        queryKey: queryKeys.essential.userSession(userId),
        staleTime: 15 * 60 * 1000, // 15 minutes
      }),
      this.queryClient.prefetchQuery({
        queryKey: queryKeys.essential.userProfile(userId),
        staleTime: 15 * 60 * 1000, // 15 minutes
      }),
      this.queryClient.prefetchQuery({
        queryKey: queryKeys.user.preferences(userId),
        staleTime: 30 * 60 * 1000, // 30 minutes
      }),
    ]);
    
    // Phase 2: Dashboard essential data (500ms delay)
    setTimeout(async () => {
      await Promise.all([
        this.queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard.essential.metrics(userId),
          staleTime: 5 * 60 * 1000, // 5 minutes
        }),
        this.queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard.essential.userInfo(userId),
          staleTime: 5 * 60 * 1000, // 5 minutes
        }),
      ]);
    }, 500);
    
    // Phase 3: Secondary data based on user profile (2s delay)
    setTimeout(async () => {
      const behaviorPatterns = this.inferBehaviorPatterns(userProfile);
      await this.warmBasedOnBehavior(userId, behaviorPatterns);
    }, 2000);
    
    // Phase 4: Static data (5s delay)
    setTimeout(async () => {
      await prefetchQueries.staticData();
    }, 5000);
  }
  
  /**
   * Infer user behavior patterns from profile data
   */
  private inferBehaviorPatterns(userProfile?: any): string[] {
    const patterns: string[] = [];
    
    if (!userProfile) {
      return ['basic-user'];
    }
    
    // Infer patterns based on user data
    if (userProfile.role === 'admin') {
      patterns.push('admin-user');
    }
    
    if (userProfile.lastLoginDays < 7) {
      patterns.push('active-user');
    }
    
    if (userProfile.dashboardViews > 50) {
      patterns.push('dashboard-heavy');
    }
    
    if (userProfile.realtimeUsage > 0.7) {
      patterns.push('realtime-user');
    }
    
    if (userProfile.analyticsUsage > 0.5) {
      patterns.push('analytics-user');
    }
    
    return patterns.length > 0 ? patterns : ['basic-user'];
  }
  
  /**
   * Warm cache based on user behavior patterns
   */
  public async warmBasedOnBehavior(userId: string, patterns: string[]) {
    const warmingKey = `behavior-${userId}-${patterns.join(',')}`;
    
    // Store patterns for future reference
    this.userBehaviorPatterns.set(userId, patterns);
    
    // Prevent duplicate warming
    if (this.warmingQueue.has(warmingKey)) {
      return this.warmingQueue.get(warmingKey);
    }
    
    console.log(`Warming cache based on behavior patterns:`, patterns);
    
    const warmingPromise = this.performBehaviorWarming(userId, patterns);
    this.warmingQueue.set(warmingKey, warmingPromise);
    
    try {
      await warmingPromise;
      console.log('Behavior-based cache warming completed');
    } finally {
      this.warmingQueue.delete(warmingKey);
    }
    
    return warmingPromise;
  }
  
  /**
   * Perform behavior-based cache warming
   */
  private async performBehaviorWarming(userId: string, patterns: string[]) {
    const warmingPromises: Promise<void>[] = [];
    
    if (patterns.includes('dashboard-heavy')) {
      warmingPromises.push(
        this.queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard.secondary.topSongs(userId),
          staleTime: 10 * 60 * 1000,
        }),
        this.queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard.secondary.artistData(userId),
          staleTime: 10 * 60 * 1000,
        })
      );
    }
    
    if (patterns.includes('realtime-user')) {
      warmingPromises.push(
        this.queryClient.prefetchQuery({
          queryKey: queryKeys.realtime.radioStatus(),
          staleTime: 30 * 1000,
        }),
        this.queryClient.prefetchQuery({
          queryKey: queryKeys.realtime.liveMetrics(userId),
          staleTime: 60 * 1000,
        })
      );
    }
    
    if (patterns.includes('admin-user')) {
      warmingPromises.push(
        this.queryClient.prefetchQuery({
          queryKey: queryKeys.admin.insights(),
          staleTime: 5 * 60 * 1000,
        }),
        this.queryClient.prefetchQuery({
          queryKey: queryKeys.admin.users(),
          staleTime: 10 * 60 * 1000,
        })
      );
    }
    
    if (patterns.includes('analytics-user')) {
      warmingPromises.push(
        this.queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard.optional.analytics(userId),
          staleTime: 30 * 60 * 1000,
        })
      );
    }
    
    if (patterns.includes('active-user')) {
      // Warm frequently accessed data for active users
      warmingPromises.push(
        this.queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard.optional.recommendations(userId),
          staleTime: 30 * 60 * 1000,
        })
      );
    }
    
    await Promise.all(warmingPromises);
  }
  
  /**
   * Warm cache on navigation with route-based predictions
   */
  public async warmOnNavigation(route: string, userId?: string) {
    if (!userId) return;
    
    const warmingKey = `navigation-${route}-${userId}`;
    
    // Prevent duplicate warming
    if (this.warmingQueue.has(warmingKey)) {
      return this.warmingQueue.get(warmingKey);
    }
    
    console.log(`Warming cache for navigation to: ${route}`);
    
    const warmingPromise = this.performNavigationWarming(route, userId);
    this.warmingQueue.set(warmingKey, warmingPromise);
    
    try {
      await warmingPromise;
      console.log(`Navigation cache warming completed for: ${route}`);
    } finally {
      this.warmingQueue.delete(warmingKey);
    }
    
    return warmingPromise;
  }
  
  /**
   * Perform navigation-based cache warming
   */
  private async performNavigationWarming(route: string, userId: string) {
    switch (route) {
      case '/dashboard':
        // Warm all dashboard data
        await Promise.all([
          prefetchQueries.dashboardEssential(userId),
          prefetchQueries.dashboardSecondary(userId),
        ]);
        
        // Warm optional data with delay
        setTimeout(() => {
          prefetchQueries.dashboardOptional(userId);
        }, 2000);
        break;
        
      case '/admin':
        // Warm admin data
        await Promise.all([
          this.queryClient.prefetchQuery({
            queryKey: queryKeys.admin.insights(),
            staleTime: 5 * 60 * 1000,
          }),
          this.queryClient.prefetchQuery({
            queryKey: queryKeys.admin.users(),
            staleTime: 10 * 60 * 1000,
          }),
        ]);
        break;
        
      case '/reports':
      case '/analytics':
        // Warm analytics data
        await this.queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard.optional.analytics(userId),
          staleTime: 30 * 60 * 1000,
        });
        break;
        
      case '/profile':
      case '/settings':
        // Warm user data
        await prefetchQueries.userData(userId);
        break;
        
      default:
        // For unknown routes, warm basic data
        await prefetchQueries.dashboardEssential(userId);
    }
  }
  
  /**
   * Predictive cache warming based on user patterns and time
   */
  public async warmPredictive(userId: string, context?: {
    timeOfDay?: 'morning' | 'afternoon' | 'evening';
    dayOfWeek?: 'weekday' | 'weekend';
    userActivity?: 'high' | 'medium' | 'low';
  }) {
    const warmingKey = `predictive-${userId}-${JSON.stringify(context)}`;
    
    // Prevent duplicate warming
    if (this.warmingQueue.has(warmingKey)) {
      return this.warmingQueue.get(warmingKey);
    }
    
    console.log('Performing predictive cache warming', context);
    
    const warmingPromise = this.performPredictiveWarming(userId, context);
    this.warmingQueue.set(warmingKey, warmingPromise);
    
    try {
      await warmingPromise;
      console.log('Predictive cache warming completed');
    } finally {
      this.warmingQueue.delete(warmingKey);
    }
    
    return warmingPromise;
  }
  
  /**
   * Perform predictive cache warming
   */
  private async performPredictiveWarming(userId: string, context?: any) {
    const warmingPromises: Promise<void>[] = [];
    
    // Get user behavior patterns
    const patterns = this.userBehaviorPatterns.get(userId) || ['basic-user'];
    
    // Time-based predictions
    if (context?.timeOfDay === 'morning') {
      // Users typically check dashboard in the morning
      warmingPromises.push(prefetchQueries.dashboardEssential(userId));
    }
    
    if (context?.timeOfDay === 'evening') {
      // Users might check analytics in the evening
      warmingPromises.push(
        this.queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard.optional.analytics(userId),
          staleTime: 30 * 60 * 1000,
        })
      );
    }
    
    // Activity-based predictions
    if (context?.userActivity === 'high') {
      // High activity users likely to access real-time data
      warmingPromises.push(
        this.queryClient.prefetchQuery({
          queryKey: queryKeys.realtime.radioStatus(),
          staleTime: 30 * 1000,
        })
      );
    }
    
    // Pattern-based predictions
    if (patterns.includes('admin-user') && context?.dayOfWeek === 'weekday') {
      // Admin users likely to check admin data on weekdays
      warmingPromises.push(
        this.queryClient.prefetchQuery({
          queryKey: queryKeys.admin.insights(),
          staleTime: 5 * 60 * 1000,
        })
      );
    }
    
    await Promise.all(warmingPromises);
  }
  
  /**
   * Warm frequently accessed data based on usage history
   */
  public async warmFrequentlyAccessed(userId: string) {
    const warmingKey = `frequent-${userId}`;
    
    // Check warming history to avoid over-warming
    const lastWarming = this.warmingHistory.get(warmingKey);
    const now = Date.now();
    
    if (lastWarming && (now - lastWarming) < 5 * 60 * 1000) {
      console.log('Frequent data warming skipped - too recent');
      return;
    }
    
    console.log('Warming frequently accessed data...');
    
    try {
      // Warm based on stored behavior patterns
      const patterns = this.userBehaviorPatterns.get(userId) || ['basic-user'];
      await this.warmBasedOnBehavior(userId, patterns);
      
      // Update warming history
      this.warmingHistory.set(warmingKey, now);
      
      console.log('Frequently accessed data warming completed');
    } catch (error) {
      console.error('Frequent data warming failed:', error);
    }
  }
  
  /**
   * Get cache warming statistics
   */
  public getWarmingStats() {
    return {
      activeWarmingTasks: this.warmingQueue.size,
      userPatterns: this.userBehaviorPatterns.size,
      warmingHistory: this.warmingHistory.size,
      queuedTasks: Array.from(this.warmingQueue.keys()),
    };
  }
  
  /**
   * Clear warming queue and history
   */
  public clearWarmingData() {
    this.warmingQueue.clear();
    this.userBehaviorPatterns.clear();
    this.warmingHistory.clear();
    
    console.log('Cache warming data cleared');
  }
  
  /**
   * Update user behavior patterns
   */
  public updateUserBehaviorPatterns(userId: string, patterns: string[]) {
    this.userBehaviorPatterns.set(userId, patterns);
    console.log(`Updated behavior patterns for user ${userId}:`, patterns);
  }
  
  /**
   * Destroy the warming service
   */
  public destroy() {
    this.clearWarmingData();
    console.log('Cache warming service destroyed');
  }
}