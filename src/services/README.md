# Cache Management Services

This directory contains the intelligent cache management system for the Songmetrix application, implementing advanced caching strategies with invalidation, background refresh, and cache warming.

## Overview

The cache management system consists of four main services that work together to provide optimal performance:

1. **CacheManager** - Core cache management with health monitoring
2. **CacheInvalidationService** - Smart cache invalidation strategies
3. **BackgroundRefreshService** - Intelligent background data refresh
4. **CacheWarmingService** - Predictive cache preloading

## Services

### CacheManager (`cacheManager.ts`)

The main cache management service that coordinates all cache operations and monitors cache health.

**Key Features:**
- Global cache event listeners
- Visibility change handling for background refresh
- Online/offline status management
- Cache health monitoring and cleanup
- Memory usage optimization

**Usage:**
```typescript
import { CacheManager } from './services/cacheManager';

const cacheManager = new CacheManager(queryClient);

// Invalidate by context
cacheManager.invalidateByContext({
  type: 'user-login',
  userId: 'user123',
  priority: 'high'
});

// Setup background refresh
cacheManager.setupBackgroundRefresh({
  queryPattern: 'dashboard-essential',
  interval: 2 * 60 * 1000, // 2 minutes
  userId: 'user123'
});

// Warm cache with priority
await cacheManager.warmCache({
  userId: 'user123',
  priority: 'essential'
});
```

### CacheInvalidationService (`cacheInvalidationService.ts`)

Advanced cache invalidation with smart strategies to prevent excessive invalidations and optimize performance.

**Key Features:**
- Debounced invalidation to prevent excessive calls
- Batch invalidation for multiple queries
- Cascade invalidation based on data dependencies
- Selective invalidation by age, priority, or conditions
- Mutation-based invalidation with refresh strategies

**Usage:**
```typescript
import { CacheInvalidationService } from './services/cacheInvalidationService';

const invalidationService = new CacheInvalidationService(queryClient);

// Debounced invalidation
invalidationService.invalidateWithDebounce({
  queryKey: ['user', 'preferences', userId],
  delay: 500
});

// Cascade invalidation
invalidationService.cascadeInvalidate({
  triggerKey: ['user', 'preferences', userId],
  userId,
  scope: 'user'
});

// Mutation-based invalidation
invalidationService.invalidateByMutation({
  mutationType: 'user-preferences-update',
  userId,
  refreshStrategy: 'background'
});
```

### BackgroundRefreshService (`cacheInvalidationService.ts`)

Intelligent background refresh system that keeps data fresh without blocking the UI.

**Key Features:**
- Periodic refresh with priority-based scheduling
- Smart refresh based on user activity patterns
- Visibility-aware refresh (only when app is visible)
- Batch refresh to avoid server overload
- Conditional refresh based on custom logic

**Usage:**
```typescript
import { BackgroundRefreshService } from './services/cacheInvalidationService';

const refreshService = new BackgroundRefreshService(queryClient);

// Setup periodic refresh
refreshService.setupPeriodicRefresh({
  queryKey: ['dashboard', 'metrics', userId],
  interval: 2 * 60 * 1000, // 2 minutes
  priority: 'high',
  condition: () => window.location.pathname.includes('/dashboard')
});

// Setup smart refresh patterns
refreshService.setupSmartRefresh({
  userId,
  activityPatterns: ['dashboard-heavy', 'realtime-user']
});

// Refresh stale data intelligently
await refreshService.refreshStaleData({
  priority: 'essential',
  userId
});
```

### CacheWarmingService (`cacheWarmingService.ts`)

Predictive cache warming that preloads data based on user behavior and navigation patterns.

**Key Features:**
- Login-based cache warming with progressive loading
- Navigation-based predictive warming
- Behavior pattern analysis and warming
- Idle time cache warming using requestIdleCallback
- Frequently accessed data warming

**Usage:**
```typescript
import { CacheWarmingService } from './services/cacheWarmingService';

const warmingService = new CacheWarmingService(queryClient);

// Warm on user login
await warmingService.warmOnLogin(userId, userProfile);

// Warm based on behavior patterns
await warmingService.warmBasedOnBehavior(userId, [
  'dashboard-heavy',
  'realtime-user',
  'admin-user'
]);

// Warm on navigation
await warmingService.warmOnNavigation('/dashboard', userId);

// Predictive warming
await warmingService.warmPredictive(userId, {
  timeOfDay: 'morning',
  dayOfWeek: 'weekday',
  userActivity: 'high'
});
```

## Hooks

### useCacheInvalidation

Provides cache invalidation functionality with smart strategies.

```typescript
import { useCacheInvalidation } from '../hooks/useCacheInvalidation';

const {
  invalidateByMutation,
  invalidateWithDebounce,
  cascadeInvalidate,
  selectiveInvalidate,
  invalidateByMutationType
} = useCacheInvalidation();

// Smart mutation-based invalidation
invalidateByMutation('userPreferences', userId);

// Debounced invalidation
invalidateWithDebounce(['user', 'profile', userId], 500);
```

### useBackgroundRefresh

Manages background refresh with intelligent scheduling.

```typescript
import { useBackgroundRefresh } from '../hooks/useCacheInvalidation';

const {
  setupPeriodicRefresh,
  setupSmartRefresh,
  refreshStaleDataAdvanced
} = useBackgroundRefresh(userId);

// Setup periodic refresh
setupPeriodicRefresh({
  queryKey: ['dashboard', 'metrics', userId],
  interval: 2 * 60 * 1000,
  priority: 'high'
});

// Setup smart refresh based on user patterns
setupSmartRefresh(['dashboard-heavy', 'realtime-user']);
```

### useCacheWarming

Provides cache warming strategies based on user behavior.

```typescript
import { useCacheWarming } from '../hooks/useCacheInvalidation';

const {
  warmOnLoginAdvanced,
  warmBasedOnBehavior,
  warmOnNavigationAdvanced,
  warmPredictiveAdvanced
} = useCacheWarming(userId);

// Warm cache on login with user profile
await warmOnLoginAdvanced(userId, userProfile);

// Warm based on behavior patterns
await warmBasedOnBehavior(userId, ['dashboard-heavy', 'admin-user']);
```

### useCacheManager

Comprehensive cache management that integrates all services.

```typescript
import { useCacheManager } from '../hooks/useCacheManager';

const {
  initializeUserCache,
  handleMutation,
  handleNavigation,
  optimizeCache,
  getCacheStats,
  handleUserLogout
} = useCacheManager(userId);

// Initialize cache for user session
await initializeUserCache(userId, userProfile);

// Handle data mutations
handleMutation({
  type: 'user-preferences-update',
  data: newPreferences,
  refreshStrategy: 'background'
});

// Handle navigation
await handleNavigation('/dashboard');

// Get comprehensive cache statistics
const stats = getCacheStats();
```

## Cache Strategies

### Invalidation Strategies

1. **Debounced Invalidation**: Prevents excessive invalidations by debouncing rapid calls
2. **Batch Invalidation**: Groups multiple invalidations for efficient execution
3. **Cascade Invalidation**: Automatically invalidates related queries based on dependencies
4. **Selective Invalidation**: Invalidates queries based on age, priority, or custom conditions
5. **Mutation-based Invalidation**: Smart invalidation based on mutation types

### Refresh Strategies

1. **Immediate**: Refresh data immediately after invalidation
2. **Background**: Invalidate immediately, refresh in background
3. **Lazy**: Only invalidate, let components refetch when needed

### Warming Strategies

1. **Progressive Loading**: Load data in priority order (essential → secondary → optional)
2. **Behavior-based**: Warm cache based on user behavior patterns
3. **Navigation-based**: Predictive warming based on route changes
4. **Time-based**: Warm cache based on time of day and usage patterns
5. **Idle-time**: Warm cache during browser idle time

## Performance Optimizations

### Memory Management
- Automatic cleanup of old error queries
- Removal of stale optional queries
- Memory usage monitoring and alerts

### Network Optimization
- Batch API calls to reduce network requests
- Priority-based refresh to optimize bandwidth
- Offline-aware refresh strategies

### User Experience
- Stale-while-revalidate pattern for instant loading
- Progressive loading for perceived performance
- Background refresh without blocking UI

## Configuration

### Cache Configurations

Different cache configurations for different data types:

```typescript
const cacheConfigs = {
  essential: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes
    retry: 5,
    networkMode: 'offlineFirst'
  },
  dashboard: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    networkMode: 'online'
  },
  realtime: {
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 60 * 1000, // 1 minute
    networkMode: 'online'
  },
  static: {
    staleTime: 60 * 60 * 1000, // 1 hour
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnMount: false,
    networkMode: 'online'
  }
};
```

### User Behavior Patterns

The system recognizes these user behavior patterns:

- `admin-user`: Users with admin privileges
- `dashboard-heavy`: Users who frequently access dashboard
- `realtime-user`: Users who use real-time features
- `analytics-user`: Users who frequently view analytics
- `active-user`: Users who login frequently
- `frequent-user`: Daily users
- `regular-user`: Weekly users
- `occasional-user`: Infrequent users

## Monitoring and Analytics

### Cache Health Metrics

```typescript
const health = {
  totalQueries: number,
  successfulQueries: number,
  errorQueries: number,
  staleQueries: number,
  loadingQueries: number,
  healthScore: number, // 0-100
  status: 'excellent' | 'good' | 'fair' | 'poor'
};
```

### Performance Metrics

```typescript
const metrics = {
  cacheHitRate: number, // Percentage
  memoryUsage: number, // Bytes
  activeProcesses: number,
  refreshIntervals: number,
  warmingTasks: number
};
```

## Best Practices

1. **Use appropriate cache configurations** for different data types
2. **Implement progressive loading** for better perceived performance
3. **Monitor cache health** regularly and optimize when needed
4. **Use behavior patterns** to optimize cache warming
5. **Handle offline scenarios** gracefully with cached data
6. **Batch operations** to reduce overhead
7. **Clean up resources** properly to prevent memory leaks

## Testing

The cache management system includes comprehensive tests:

```bash
# Run cache invalidation tests
npm test src/hooks/__tests__/useCacheInvalidation.test.ts

# Run all cache-related tests
npm test -- --testPathPattern=cache
```

## Integration Example

Complete integration example for a user session:

```typescript
import { useCacheManager } from '../hooks/useCacheManager';

function App() {
  const { 
    initializeUserCache,
    handleMutation,
    handleNavigation,
    handleUserLogout 
  } = useCacheManager(userId);

  // Initialize cache on login
  useEffect(() => {
    if (userId && userProfile) {
      initializeUserCache(userId, userProfile);
    }
  }, [userId, userProfile]);

  // Handle mutations
  const updateUserPreferences = useMutation({
    mutationFn: updatePreferencesAPI,
    onSuccess: (data) => {
      handleMutation({
        type: 'user-preferences-update',
        data,
        refreshStrategy: 'background'
      });
    }
  });

  // Handle navigation
  useEffect(() => {
    handleNavigation(location.pathname);
  }, [location.pathname]);

  // Handle logout
  const logout = () => {
    handleUserLogout();
    // ... logout logic
  };
}
```

This cache management system provides a comprehensive solution for optimizing application performance through intelligent caching, invalidation, and refresh strategies.