import { useEffect, useCallback, useRef } from 'react';
import { performanceMonitoringService, PerformanceMetrics, CustomMetricData } from '../services/performanceMonitoringService';

export interface UsePerformanceTrackingOptions {
  trackComponentRender?: boolean;
  componentName?: string;
  trackApiCalls?: boolean;
  trackCacheHits?: boolean;
}

export interface PerformanceTrackingHook {
  trackDashboardLoad: (startTime: number) => void;
  trackApiCall: (endpoint: string, responseTime: number, success: boolean) => void;
  trackComponentRender: (componentName: string, renderTime: number) => void;
  trackCacheHit: (hit: boolean, cacheKey: string) => void;
  trackCustomMetric: (name: string, value: number, metadata?: Record<string, any>) => void;
  getMetrics: () => PerformanceMetrics;
  getCustomMetrics: (name?: string) => Map<string, CustomMetricData[]> | CustomMetricData[];
  startTimer: () => () => number;
}

export const usePerformanceTracking = (
  options: UsePerformanceTrackingOptions = {}
): PerformanceTrackingHook => {
  const renderStartTime = useRef<number>(Date.now());
  const { trackComponentRender = false, componentName, trackApiCalls = false } = options;

  // Track component render time if enabled
  useEffect(() => {
    if (trackComponentRender && componentName) {
      const renderTime = Date.now() - renderStartTime.current;
      performanceMonitoringService.trackComponentRenderTime(componentName, renderTime);
    }
  }, [trackComponentRender, componentName]);

  // Dashboard load tracking
  const trackDashboardLoad = useCallback((startTime: number) => {
    const endTime = Date.now();
    performanceMonitoringService.trackDashboardLoadTime(startTime, endTime);
  }, []);

  // API call tracking
  const trackApiCall = useCallback((endpoint: string, responseTime: number, success: boolean) => {
    performanceMonitoringService.trackApiResponseTime(endpoint, responseTime, success);
  }, []);

  // Component render tracking
  const trackComponentRenderTime = useCallback((componentName: string, renderTime: number) => {
    performanceMonitoringService.trackComponentRenderTime(componentName, renderTime);
  }, []);

  // Cache hit tracking
  const trackCacheHit = useCallback((hit: boolean, cacheKey: string) => {
    performanceMonitoringService.trackCacheHit(hit, cacheKey);
  }, []);

  // Custom metric tracking
  const trackCustomMetric = useCallback((name: string, value: number, metadata?: Record<string, any>) => {
    performanceMonitoringService.trackCustomMetric(name, value, metadata);
  }, []);

  // Get current metrics
  const getMetrics = useCallback(() => {
    return performanceMonitoringService.getMetrics();
  }, []);

  // Get custom metrics
  const getCustomMetrics = useCallback((name?: string) => {
    return performanceMonitoringService.getCustomMetrics(name);
  }, []);

  // Timer utility for measuring operations
  const startTimer = useCallback(() => {
    const startTime = Date.now();
    return () => Date.now() - startTime;
  }, []);

  return {
    trackDashboardLoad,
    trackApiCall,
    trackComponentRender: trackComponentRenderTime,
    trackCacheHit,
    trackCustomMetric,
    getMetrics,
    getCustomMetrics,
    startTimer
  };
};

// Higher-order component for automatic performance tracking
export const withPerformanceTracking = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
) => {
  return (props: P) => {
    const renderStartTime = useRef<number>(Date.now());
    
    useEffect(() => {
      const renderTime = Date.now() - renderStartTime.current;
      performanceMonitoringService.trackComponentRenderTime(componentName, renderTime);
    }, []);

    return React.createElement(WrappedComponent, props);
  };
};

// Hook for tracking page load performance
export const usePageLoadTracking = (pageName: string) => {
  const loadStartTime = useRef<number>(Date.now());
  
  useEffect(() => {
    const handleLoad = () => {
      const loadTime = Date.now() - loadStartTime.current;
      performanceMonitoringService.trackCustomMetric('page_load_time', loadTime, {
        pageName,
        url: window.location.pathname
      });
    };

    // Track when page is fully loaded
    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, [pageName]);
};

// Hook for tracking API performance with React Query integration
export const useApiPerformanceTracking = () => {
  const trackQuery = useCallback((queryKey: string, duration: number, success: boolean) => {
    performanceMonitoringService.trackApiResponseTime(queryKey, duration, success);
  }, []);

  const trackMutation = useCallback((mutationKey: string, duration: number, success: boolean) => {
    performanceMonitoringService.trackCustomMetric('mutation_time', duration, {
      mutationKey,
      success
    });
  }, []);

  return { trackQuery, trackMutation };
};