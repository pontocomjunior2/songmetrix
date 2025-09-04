import { lazyLoadingConfig } from '@/config/lazyLoadingConfig';

interface LazyLoadingMetrics {
  componentName: string;
  loadStartTime: number;
  loadEndTime: number;
  loadDuration: number;
  intersectionTime?: number;
  wasVisible: boolean;
}

class LazyLoadingMonitor {
  private metrics: LazyLoadingMetrics[] = [];
  private intersectionTimes = new Map<string, number>();

  /**
   * Record when a component starts loading
   */
  recordLoadStart(componentName: string): void {
    if (!lazyLoadingConfig.monitoring.enabled) return;

    const loadStartTime = performance.now();
    const intersectionTime = this.intersectionTimes.get(componentName);

    if (lazyLoadingConfig.monitoring.logLoadTimes) {
      console.log(`[LazyLoading] Started loading: ${componentName}`);
    }

    // Store the start time for later completion
    this.intersectionTimes.set(`${componentName}_start`, loadStartTime);
    
    if (intersectionTime) {
      this.intersectionTimes.set(`${componentName}_intersection`, intersectionTime);
    }
  }

  /**
   * Record when a component finishes loading
   */
  recordLoadEnd(componentName: string): void {
    if (!lazyLoadingConfig.monitoring.enabled) return;

    const loadEndTime = performance.now();
    const loadStartTime = this.intersectionTimes.get(`${componentName}_start`);
    const intersectionTime = this.intersectionTimes.get(`${componentName}_intersection`);

    if (loadStartTime) {
      const loadDuration = loadEndTime - loadStartTime;
      
      const metrics: LazyLoadingMetrics = {
        componentName,
        loadStartTime,
        loadEndTime,
        loadDuration,
        intersectionTime,
        wasVisible: !!intersectionTime,
      };

      this.metrics.push(metrics);

      if (lazyLoadingConfig.monitoring.logLoadTimes) {
        console.log(`[LazyLoading] Finished loading: ${componentName} (${loadDuration.toFixed(2)}ms)`);
      }

      // Clean up stored times
      this.intersectionTimes.delete(`${componentName}_start`);
      this.intersectionTimes.delete(`${componentName}_intersection`);
    }
  }

  /**
   * Record when a component becomes visible (intersection)
   */
  recordIntersection(componentName: string): void {
    if (!lazyLoadingConfig.monitoring.enabled || !lazyLoadingConfig.monitoring.trackIntersections) return;

    const intersectionTime = performance.now();
    this.intersectionTimes.set(componentName, intersectionTime);

    console.log(`[LazyLoading] Component became visible: ${componentName}`);
  }

  /**
   * Get performance metrics for all components
   */
  getMetrics(): LazyLoadingMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get metrics for a specific component
   */
  getComponentMetrics(componentName: string): LazyLoadingMetrics[] {
    return this.metrics.filter(metric => metric.componentName === componentName);
  }

  /**
   * Get average load time across all components
   */
  getAverageLoadTime(): number {
    if (this.metrics.length === 0) return 0;
    
    const totalTime = this.metrics.reduce((sum, metric) => sum + metric.loadDuration, 0);
    return totalTime / this.metrics.length;
  }

  /**
   * Get components that took longer than expected to load
   */
  getSlowComponents(threshold: number = 1000): LazyLoadingMetrics[] {
    return this.metrics.filter(metric => metric.loadDuration > threshold);
  }

  /**
   * Generate a performance report
   */
  generateReport(): string {
    const totalComponents = this.metrics.length;
    const averageLoadTime = this.getAverageLoadTime();
    const slowComponents = this.getSlowComponents();

    return `
Lazy Loading Performance Report
==============================
Total Components Loaded: ${totalComponents}
Average Load Time: ${averageLoadTime.toFixed(2)}ms
Slow Components (>1s): ${slowComponents.length}

${slowComponents.length > 0 ? 'Slow Components:' : ''}
${slowComponents.map(metric => 
  `- ${metric.componentName}: ${metric.loadDuration.toFixed(2)}ms`
).join('\n')}
    `.trim();
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.intersectionTimes.clear();
  }
}

// Create a singleton instance
export const lazyLoadingMonitor = new LazyLoadingMonitor();

// Export utility functions
export const recordLoadStart = (componentName: string) => 
  lazyLoadingMonitor.recordLoadStart(componentName);

export const recordLoadEnd = (componentName: string) => 
  lazyLoadingMonitor.recordLoadEnd(componentName);

export const recordIntersection = (componentName: string) => 
  lazyLoadingMonitor.recordIntersection(componentName);

export default lazyLoadingMonitor;