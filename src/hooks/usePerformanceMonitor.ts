import { useEffect, useRef, useState, useCallback } from 'react';
import { performanceLogger, performanceUtils, performanceConfig } from '../lib/performance';

// Hook to monitor component render performance
export function usePerformanceMonitor(componentName: string) {
  const renderStartTime = useRef<number>(0);
  const mountTime = useRef<number>(0);

  useEffect(() => {
    // Record mount time
    mountTime.current = performance.now();
    
    return () => {
      // Record unmount time if needed
      const unmountTime = performance.now();
      const totalLifetime = unmountTime - mountTime.current;
      performanceLogger.logMetric(`${componentName}_lifetime`, totalLifetime);
    };
  }, [componentName]);

  // Function to start measuring render time
  const startRender = useCallback(() => {
    renderStartTime.current = performance.now();
  }, []);

  // Function to end measuring render time
  const endRender = useCallback(() => {
    if (renderStartTime.current > 0) {
      const renderTime = performance.now() - renderStartTime.current;
      performanceLogger.logComponentRender(componentName, renderTime);
      
      // Alert if render time exceeds threshold
      if (renderTime > performanceConfig.thresholds.componentRenderTime) {
        console.warn(`Component ${componentName} render time (${renderTime}ms) exceeds threshold`);
      }
      
      renderStartTime.current = 0;
      return renderTime;
    }
    return 0;
  }, [componentName]);

  return { startRender, endRender };
}

// Hook to monitor API call performance
export function useApiPerformanceMonitor() {
  const [isLoading, setIsLoading] = useState(false);
  const [metrics, setMetrics] = useState<{
    averageResponseTime: number;
    totalCalls: number;
    errorRate: number;
  }>({
    averageResponseTime: 0,
    totalCalls: 0,
    errorRate: 0,
  });

  const measureApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    endpoint: string
  ): Promise<T> => {
    setIsLoading(true);
    const startTime = performance.now();
    
    try {
      const result = await apiCall();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      performanceLogger.logApiCall(endpoint, duration);
      
      // Alert if API response time exceeds threshold
      if (duration > performanceConfig.thresholds.apiResponseTime) {
        console.warn(`API call to ${endpoint} (${duration}ms) exceeds threshold`);
      }
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      performanceLogger.logApiCall(`${endpoint}_error`, duration);
      throw error;
    } finally {
      setIsLoading(false);
      
      // Update metrics
      const summary = performanceLogger.getMetricsSummary();
      setMetrics({
        averageResponseTime: summary.averageApiResponseTime,
        totalCalls: summary.recentApiCalls.length,
        errorRate: 0, // Calculate based on error tracking if needed
      });
    }
  }, []);

  return { measureApiCall, isLoading, metrics };
}

// Hook to monitor page load performance
export function usePageLoadMonitor(pageName: string) {
  const [loadMetrics, setLoadMetrics] = useState<{
    loadTime: number;
    isLoaded: boolean;
  }>({
    loadTime: 0,
    isLoaded: false,
  });

  useEffect(() => {
    const startTime = performance.now();
    performanceUtils.mark(`${pageName}_start`);

    // Mark as loaded after component mounts and renders
    const timer = setTimeout(() => {
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      performanceUtils.mark(`${pageName}_end`);
      performanceUtils.measureBetweenMarks(
        `${pageName}_start`,
        `${pageName}_end`,
        `${pageName}_load_time`
      );
      
      setLoadMetrics({
        loadTime,
        isLoaded: true,
      });

      // Alert if page load time exceeds threshold
      if (loadTime > performanceConfig.thresholds.dashboardLoadTime) {
        console.warn(`Page ${pageName} load time (${loadTime}ms) exceeds threshold`);
      }
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [pageName]);

  return loadMetrics;
}

// Hook to get real-time performance metrics
export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState(performanceLogger.getMetricsSummary());

  const refreshMetrics = useCallback(() => {
    setMetrics(performanceLogger.getMetricsSummary());
  }, []);

  useEffect(() => {
    // Refresh metrics every 5 seconds
    const interval = setInterval(refreshMetrics, 5000);
    
    return () => clearInterval(interval);
  }, [refreshMetrics]);

  const clearMetrics = useCallback(() => {
    performanceLogger.clear();
    setMetrics(performanceLogger.getMetricsSummary());
  }, []);

  return {
    metrics,
    refreshMetrics,
    clearMetrics,
  };
}

// Hook for measuring user interactions
export function useInteractionMonitor() {
  const measureInteraction = useCallback((
    interactionName: string,
    callback: () => void | Promise<void>
  ) => {
    return async () => {
      const startTime = performance.now();
      
      try {
        await callback();
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        performanceLogger.logMetric(`interaction_${interactionName}`, duration);
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        performanceLogger.logMetric(`interaction_${interactionName}_error`, duration);
        throw error;
      }
    };
  }, []);

  return { measureInteraction };
}

// Hook for monitoring memory usage (if supported)
export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null>(null);

  useEffect(() => {
    const updateMemoryInfo = () => {
      // @ts-ignore - performance.memory is not in TypeScript types but exists in Chrome
      if (performance.memory) {
        // @ts-ignore
        const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory;
        setMemoryInfo({
          usedJSHeapSize,
          totalJSHeapSize,
          jsHeapSizeLimit,
        });
      }
    };

    updateMemoryInfo();
    
    // Update memory info every 10 seconds
    const interval = setInterval(updateMemoryInfo, 10000);
    
    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
}