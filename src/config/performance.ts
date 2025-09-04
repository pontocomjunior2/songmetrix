// Performance configuration for the application
export const performanceConfig = {
  // Bundle size limits (in KB)
  bundleSizeLimits: {
    main: 500,        // Main bundle
    vendor: 800,      // Vendor libraries
    chunks: 200,      // Individual chunks
  },

  // Cache configuration
  cache: {
    // Service worker cache duration (in seconds)
    staticAssets: 86400 * 30,    // 30 days
    apiResponses: 300,           // 5 minutes
    images: 86400 * 7,           // 7 days
  },

  // Performance thresholds
  thresholds: {
    // Core Web Vitals
    largestContentfulPaint: 2500,  // 2.5s
    firstInputDelay: 100,          // 100ms
    cumulativeLayoutShift: 0.1,    // 0.1

    // Custom metrics
    dashboardLoadTime: 3000,       // 3s
    apiResponseTime: 2000,         // 2s
    componentRenderTime: 100,      // 100ms
    
    // Resource loading
    imageLoadTime: 1000,           // 1s
    fontLoadTime: 500,             // 500ms
  },

  // Feature flags for performance optimizations
  features: {
    lazyLoading: true,
    imageOptimization: true,
    codesplitting: true,
    prefetching: true,
    serviceWorker: false, // Disabled for now
    webVitalsTracking: true,
    performanceLogging: process.env.NODE_ENV === 'development',
  },

  // Lazy loading configuration
  lazyLoading: {
    // Intersection Observer options
    rootMargin: '50px',
    threshold: 0.1,
    
    // Component lazy loading
    components: {
      charts: true,
      tables: true,
      modals: true,
      adminPanels: true,
    },
    
    // Route lazy loading
    routes: {
      dashboard: false,  // Keep dashboard eager for performance
      admin: true,
      reports: true,
      settings: true,
    },
  },

  // Prefetching configuration
  prefetching: {
    // Prefetch routes on hover
    routesOnHover: true,
    
    // Prefetch critical data
    criticalData: {
      userPreferences: true,
      dashboardMetrics: true,
    },
    
    // Prefetch delay (ms)
    delay: 100,
  },

  // Development vs Production settings
  development: {
    enableDevtools: true,
    verboseLogging: true,
    skipOptimizations: false,
  },

  production: {
    enableDevtools: false,
    verboseLogging: false,
    skipOptimizations: false,
    
    // Production-only optimizations
    treeshaking: true,
    minification: true,
    compression: true,
  },
};

// Get configuration based on environment
export const getPerformanceConfig = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    ...performanceConfig,
    ...(isDevelopment ? performanceConfig.development : performanceConfig.production),
  };
};

// Performance budget configuration for CI/CD
export const performanceBudget = {
  // Bundle size budget
  bundles: {
    'main': { maxSize: '500kb' },
    'vendor': { maxSize: '800kb' },
    'chunks': { maxSize: '200kb' },
  },
  
  // Performance metrics budget
  metrics: {
    'first-contentful-paint': 1500,
    'largest-contentful-paint': 2500,
    'first-input-delay': 100,
    'cumulative-layout-shift': 0.1,
    'total-blocking-time': 300,
  },
  
  // Resource budget
  resources: {
    'script': { maxSize: '1mb', maxCount: 10 },
    'stylesheet': { maxSize: '100kb', maxCount: 5 },
    'image': { maxSize: '500kb', maxCount: 20 },
    'font': { maxSize: '200kb', maxCount: 5 },
  },
};