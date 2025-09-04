import { onCLS, onINP, onFCP, onLCP, onTTFB, Metric } from 'web-vitals';

export interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
  
  // Custom Metrics
  dashboardLoadTime?: number;
  apiResponseTime?: number;
  componentRenderTime?: number;
  cacheHitRate?: number;
  errorRate?: number;
  
  // Metadata
  timestamp: number;
  userId?: string;
  sessionId: string;
  userAgent: string;
  url: string;
}

export interface CustomMetricData {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitoringService {
  private metrics: PerformanceMetrics;
  private customMetrics: Map<string, CustomMetricData[]> = new Map();
  private sessionId: string;
  private isInitialized = false;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.metrics = {
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
  }

  /**
   * Initialize Web Vitals tracking
   */
  public initializeWebVitals(): void {
    if (this.isInitialized) return;
    
    // Track Core Web Vitals
    onCLS(this.handleMetric.bind(this, 'cls'));
    onINP(this.handleMetric.bind(this, 'inp')); // INP replaced FID in web-vitals v3
    onFCP(this.handleMetric.bind(this, 'fcp'));
    onLCP(this.handleMetric.bind(this, 'lcp'));
    onTTFB(this.handleMetric.bind(this, 'ttfb'));

    this.isInitialized = true;
    console.log('Performance monitoring initialized');
  }

  /**
   * Handle Web Vitals metric updates
   */
  private handleMetric(metricName: keyof PerformanceMetrics, metric: Metric): void {
    this.metrics[metricName] = metric.value;
    this.metrics.timestamp = Date.now();

    // Send metric to analytics service
    this.sendMetricToAnalytics(metricName, metric.value);

    // Log performance issues
    this.checkPerformanceThresholds(metricName, metric.value);
  }

  /**
   * Track custom dashboard load time
   */
  public trackDashboardLoadTime(startTime: number, endTime: number): void {
    const loadTime = endTime - startTime;
    this.metrics.dashboardLoadTime = loadTime;
    
    this.trackCustomMetric('dashboard_load_time', loadTime, {
      url: window.location.pathname,
      timestamp: Date.now()
    });

    console.log(`Dashboard loaded in ${loadTime}ms`);
  }

  /**
   * Track API response times
   */
  public trackApiResponseTime(endpoint: string, responseTime: number, success: boolean): void {
    this.metrics.apiResponseTime = responseTime;
    
    this.trackCustomMetric('api_response_time', responseTime, {
      endpoint,
      success,
      timestamp: Date.now()
    });

    // Update error rate
    this.updateErrorRate(success);
  }

  /**
   * Track component render time
   */
  public trackComponentRenderTime(componentName: string, renderTime: number): void {
    this.trackCustomMetric('component_render_time', renderTime, {
      componentName,
      timestamp: Date.now()
    });
  }

  /**
   * Track cache performance
   */
  public trackCacheHit(hit: boolean, cacheKey: string): void {
    const hitRate = this.calculateCacheHitRate(hit);
    this.metrics.cacheHitRate = hitRate;
    
    this.trackCustomMetric('cache_hit', hit ? 1 : 0, {
      cacheKey,
      hitRate,
      timestamp: Date.now()
    });
  }

  /**
   * Track custom metrics
   */
  public trackCustomMetric(name: string, value: number, metadata?: Record<string, any>): void {
    const metricData: CustomMetricData = {
      name,
      value,
      timestamp: Date.now(),
      metadata
    };

    if (!this.customMetrics.has(name)) {
      this.customMetrics.set(name, []);
    }
    
    this.customMetrics.get(name)!.push(metricData);
    
    // Keep only last 100 entries per metric
    const metrics = this.customMetrics.get(name)!;
    if (metrics.length > 100) {
      metrics.splice(0, metrics.length - 100);
    }
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get custom metrics by name
   */
  public getCustomMetrics(name?: string): Map<string, CustomMetricData[]> | CustomMetricData[] {
    if (name) {
      return this.customMetrics.get(name) || [];
    }
    return new Map(this.customMetrics);
  }

  /**
   * Send metrics to analytics service
   */
  private sendMetricToAnalytics(metricName: string, value: number): void {
    // In a real implementation, this would send to your analytics service
    // For now, we'll use console.log and localStorage for demonstration
    
    const analyticsData = {
      metric: metricName,
      value,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      url: window.location.href
    };

    // Store in localStorage for demo purposes
    const existingData = JSON.parse(localStorage.getItem('performance_analytics') || '[]');
    existingData.push(analyticsData);
    
    // Keep only last 1000 entries
    if (existingData.length > 1000) {
      existingData.splice(0, existingData.length - 1000);
    }
    
    localStorage.setItem('performance_analytics', JSON.stringify(existingData));
    
    console.log('Performance metric tracked:', analyticsData);
  }

  /**
   * Check performance thresholds and log warnings
   */
  private checkPerformanceThresholds(metricName: string, value: number): void {
    const thresholds = {
      lcp: 2500, // 2.5 seconds
      fid: 100,  // 100ms
      cls: 0.1,  // 0.1
      fcp: 1800, // 1.8 seconds
      ttfb: 800  // 800ms
    };

    const threshold = thresholds[metricName as keyof typeof thresholds];
    if (threshold && value > threshold) {
      console.warn(`Performance threshold exceeded for ${metricName}: ${value} > ${threshold}`);
      
      // Track performance issue
      this.trackCustomMetric('performance_issue', 1, {
        metric: metricName,
        value,
        threshold,
        severity: value > threshold * 1.5 ? 'high' : 'medium'
      });
    }
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(hit: boolean): number {
    const cacheMetrics = this.customMetrics.get('cache_hit') || [];
    const recentMetrics = cacheMetrics.slice(-50); // Last 50 cache operations
    
    if (recentMetrics.length === 0) return hit ? 100 : 0;
    
    const hits = recentMetrics.filter(m => m.value === 1).length + (hit ? 1 : 0);
    const total = recentMetrics.length + 1;
    
    return Math.round((hits / total) * 100);
  }

  /**
   * Update error rate based on API calls
   */
  private updateErrorRate(success: boolean): void {
    const apiMetrics = this.customMetrics.get('api_response_time') || [];
    const recentMetrics = apiMetrics.slice(-50); // Last 50 API calls
    
    if (recentMetrics.length === 0) {
      this.metrics.errorRate = success ? 0 : 100;
      return;
    }
    
    const errors = recentMetrics.filter(m => !m.metadata?.success).length + (success ? 0 : 1);
    const total = recentMetrics.length + 1;
    
    this.metrics.errorRate = Math.round((errors / total) * 100);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export metrics for reporting
   */
  public exportMetrics(): string {
    const exportData = {
      coreMetrics: this.metrics,
      customMetrics: Object.fromEntries(this.customMetrics),
      exportedAt: new Date().toISOString()
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Reset metrics (useful for testing)
   */
  public reset(): void {
    this.metrics = {
      timestamp: Date.now(),
      sessionId: this.generateSessionId(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    this.customMetrics.clear();
  }
}

// Create singleton instance
export const performanceMonitoringService = new PerformanceMonitoringService();

// Auto-initialize Web Vitals tracking
if (typeof window !== 'undefined') {
  performanceMonitoringService.initializeWebVitals();
}