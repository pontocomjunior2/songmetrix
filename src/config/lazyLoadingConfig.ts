/**
 * Configuration for lazy loading components
 */
export const lazyLoadingConfig = {
  // Default intersection observer options
  defaultOptions: {
    threshold: 0.1,
    rootMargin: '50px',
    triggerOnce: true,
  },

  // Component-specific configurations
  components: {
    charts: {
      threshold: 0.1,
      rootMargin: '100px',
      triggerOnce: true,
      minHeight: '280px',
    },
    tables: {
      threshold: 0.1,
      rootMargin: '50px',
      triggerOnce: true,
      minHeight: '200px',
    },
    admin: {
      threshold: 0.1,
      rootMargin: '100px',
      triggerOnce: true,
      minHeight: '400px',
    },
    dashboard: {
      threshold: 0.05,
      rootMargin: '150px',
      triggerOnce: true,
      minHeight: '300px',
    },
  },

  // Preloading configurations
  preload: {
    // Preload components when hovering over navigation links
    onHover: {
      enabled: true,
      delay: 200, // ms
    },
    
    // Preload components based on user behavior
    predictive: {
      enabled: true,
      routes: [
        { from: '/dashboard', to: '/ranking', probability: 0.7 },
        { from: '/dashboard', to: '/realtime', probability: 0.5 },
        { from: '/ranking', to: '/dashboard', probability: 0.8 },
      ],
    },
  },

  // Performance monitoring
  monitoring: {
    enabled: process.env.NODE_ENV === 'development',
    logLoadTimes: true,
    trackIntersections: true,
  },
} as const;

export type LazyLoadingConfig = typeof lazyLoadingConfig;

export default lazyLoadingConfig;