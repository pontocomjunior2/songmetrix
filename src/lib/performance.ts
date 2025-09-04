import { onCLS, onINP, onFCP, onLCP, onTTFB, Metric } from 'web-vitals';

// Performance metrics interface
export interface PerformanceMetrics {
  pageLoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  timeToFirstByte: number;
}

export interface CustomMetrics {
  dashboardLoadTime: number;
  apiResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  componentRenderTime: number;
}

// Performance logging service
class PerformanceLogger {
  private metrics: Map<string, number> = new Map();
  private apiMetrics: Array<{ endpoint: string; duration: number; timestamp: number }> = [];
  private componentMetrics: Map<string, number[]> = new Map();

  // Log API call performance
  logApiCall(endpoint: string, duration: number) {
    this.apiMetrics.push({
      endpoint,
      duration,
      timestamp: Date.now(),
    });

    // Keep only last 100 API calls to prevent memory leaks
    if (this.apiMetrics.length > 100) {
      this.apiMetrics.shift();
    }

    console.log(`API Call: ${endpoint} took ${duration}ms`);
  }

  // Log component render time
  logComponentRender(componentName: string, duration: number) {
    if (!this.componentMetrics.has(componentName)) {
      this.componentMetrics.set(componentName, []);
    }

    const renders = this.componentMetrics.get(componentName)!;
    renders.push(duration);

    // Keep only last 50 renders per component
    if (renders.length > 50) {
      renders.shift();
    }

    console.log(`Component ${componentName} rendered in ${duration}ms`);
  }

  // Log custom metric
  logMetric(name: string, value: number) {
    this.metrics.set(name, value);
    console.log(`Metric ${name}: ${value}`);
  }

  // Get average API response time
  getAverageApiResponseTime(): number {
    if (this.apiMetrics.length === 0) return 0;
    
    const total = this.apiMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    return total / this.apiMetrics.length;
  }

  // Get average component render time
  getAverageComponentRenderTime(componentName: string): number {
    const renders = this.componentMetrics.get(componentName);
    if (!renders || renders.length === 0) return 0;

    const total = renders.reduce((sum, duration) => sum + duration, 0);
    return total / renders.length;
  }

  // Get all metrics summary
  getMetricsSummary() {
    return {
      customMetrics: Object.fromEntries(this.metrics),
      averageApiResponseTime: this.getAverageApiResponseTime(),
      componentMetrics: Object.fromEntries(
        Array.from(this.componentMetrics.entries()).map(([name, renders]) => [
          name,
          {
            averageRenderTime: this.getAverageComponentRenderTime(name),
            renderCount: renders.length,
          },
        ])
      ),
      recentApiCalls: this.apiMetrics.slice(-10), // Last 10 API calls
    };
  }

  // Clear all metrics
  clear() {
    this.metrics.clear();
    this.apiMetrics.length = 0;
    this.componentMetrics.clear();
  }
}

// Global performance logger instance
export const performanceLogger = new PerformanceLogger();

// Web Vitals reporting function
export function reportWebVitals(onPerfEntry?: (metric: Metric) => void) {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    onCLS(onPerfEntry);
    onINP(onPerfEntry); // INP replaced FID in web-vitals v3
    onFCP(onPerfEntry);
    onLCP(onPerfEntry);
    onTTFB(onPerfEntry);
  }
}

// Enhanced Web Vitals reporting with logging
export function setupWebVitalsReporting() {
  const handleMetric = (metric: Metric) => {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Web Vital - ${metric.name}:`, metric.value);
    }

    // Log to performance logger
    performanceLogger.logMetric(`webVital_${metric.name}`, metric.value);

    // You can send to analytics service here
    // Example: analytics.track('web_vital', { name: metric.name, value: metric.value });
  };

  reportWebVitals(handleMetric);
}

// Performance measurement utilities
export const performanceUtils = {
  // Measure function execution time
  measureFunction: <T extends (...args: any[]) => any>(
    fn: T,
    name: string
  ): T => {
    return ((...args: any[]) => {
      const start = performance.now();
      const result = fn(...args);
      const end = performance.now();
      
      performanceLogger.logMetric(`function_${name}`, end - start);
      
      return result;
    }) as T;
  },

  // Measure async function execution time
  measureAsyncFunction: <T extends (...args: any[]) => Promise<any>>(
    fn: T,
    name: string
  ): T => {
    return (async (...args: any[]) => {
      const start = performance.now();
      const result = await fn(...args);
      const end = performance.now();
      
      performanceLogger.logMetric(`async_function_${name}`, end - start);
      
      return result;
    }) as T;
  },

  // Create a performance mark
  mark: (name: string) => {
    performance.mark(name);
  },

  // Measure between two marks
  measureBetweenMarks: (startMark: string, endMark: string, measureName: string) => {
    performance.mark(endMark);
    performance.measure(measureName, startMark, endMark);
    
    const measure = performance.getEntriesByName(measureName)[0];
    if (measure) {
      performanceLogger.logMetric(measureName, measure.duration);
    }
    
    return measure?.duration || 0;
  },

  // Get navigation timing
  getNavigationTiming: () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigation) {
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        domInteractive: navigation.domInteractive - navigation.navigationStart,
        firstPaint: navigation.responseEnd - navigation.requestStart,
      };
    }
    
    return null;
  },
};

// Performance monitoring configuration
export const performanceConfig = {
  // Thresholds for performance alerts (in milliseconds)
  thresholds: {
    apiResponseTime: 2000, // 2 seconds
    componentRenderTime: 100, // 100ms
    dashboardLoadTime: 3000, // 3 seconds
    webVitals: {
      LCP: 2500, // Largest Contentful Paint
      FID: 100,  // First Input Delay
      CLS: 0.1,  // Cumulative Layout Shift
    },
  },

  // Enable/disable different monitoring features
  features: {
    webVitals: true,
    apiMonitoring: true,
    componentMonitoring: true,
    navigationTiming: true,
  },
};