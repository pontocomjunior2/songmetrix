import { QueryClient } from '@tanstack/react-query';
import { performanceMonitoringService } from './performanceMonitoringService';

export interface PerformanceDataCollectionConfig {
  enableQueryTracking: boolean;
  enableMutationTracking: boolean;
  enableCacheTracking: boolean;
  batchSize: number;
  flushInterval: number;
  endpoint?: string;
}

export interface PerformanceDataBatch {
  metrics: any[];
  timestamp: number;
  sessionId: string;
  batchId: string;
}

class PerformanceDataCollectionService {
  private config: PerformanceDataCollectionConfig;
  private queryClient: QueryClient | null = null;
  private dataBatch: any[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(config: Partial<PerformanceDataCollectionConfig> = {}) {
    this.config = {
      enableQueryTracking: true,
      enableMutationTracking: true,
      enableCacheTracking: true,
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
      ...config
    };
  }

  /**
   * Initialize the service with React Query client
   */
  public initialize(queryClient: QueryClient): void {
    if (this.isInitialized) return;

    this.queryClient = queryClient;
    this.setupQueryClientTracking();
    this.startBatchFlushTimer();
    this.isInitialized = true;

    console.log('Performance data collection service initialized');
  }

  /**
   * Setup React Query performance tracking
   */
  private setupQueryClientTracking(): void {
    if (!this.queryClient) return;

    // Track query performance
    if (this.config.enableQueryTracking) {
      this.queryClient.getQueryCache().subscribe((event) => {
        if (event.type === 'updated' && event.query.state.status === 'success') {
          const queryKey = JSON.stringify(event.query.queryKey);
          const dataUpdatedAt = event.query.state.dataUpdatedAt;
          const fetchedAt = event.query.state.fetchedAt;
          
          if (dataUpdatedAt && fetchedAt) {
            const duration = dataUpdatedAt - fetchedAt;
            performanceMonitoringService.trackApiResponseTime(queryKey, duration, true);
            this.addToBatch('query_performance', {
              queryKey,
              duration,
              success: true,
              timestamp: Date.now()
            });
          }
        } else if (event.type === 'updated' && event.query.state.status === 'error') {
          const queryKey = JSON.stringify(event.query.queryKey);
          performanceMonitoringService.trackApiResponseTime(queryKey, 0, false);
          this.addToBatch('query_error', {
            queryKey,
            error: event.query.state.error?.message,
            timestamp: Date.now()
          });
        }
      });
    }

    // Track mutation performance
    if (this.config.enableMutationTracking) {
      this.queryClient.getMutationCache().subscribe((event) => {
        if (event.type === 'updated' && event.mutation.state.status === 'success') {
          const mutationKey = JSON.stringify(event.mutation.options.mutationKey || 'unknown');
          const submittedAt = event.mutation.state.submittedAt;
          
          if (submittedAt) {
            const duration = Date.now() - submittedAt;
            this.addToBatch('mutation_performance', {
              mutationKey,
              duration,
              success: true,
              timestamp: Date.now()
            });
          }
        } else if (event.type === 'updated' && event.mutation.state.status === 'error') {
          const mutationKey = JSON.stringify(event.mutation.options.mutationKey || 'unknown');
          this.addToBatch('mutation_error', {
            mutationKey,
            error: event.mutation.state.error?.message,
            timestamp: Date.now()
          });
        }
      });
    }

    // Track cache performance
    if (this.config.enableCacheTracking) {
      const originalGetQueryData = this.queryClient.getQueryData.bind(this.queryClient);
      this.queryClient.getQueryData = (queryKey: any) => {
        const startTime = Date.now();
        const result = originalGetQueryData(queryKey);
        const duration = Date.now() - startTime;
        
        const hit = result !== undefined;
        const cacheKey = JSON.stringify(queryKey);
        
        performanceMonitoringService.trackCacheHit(hit, cacheKey);
        this.addToBatch('cache_access', {
          queryKey: cacheKey,
          hit,
          duration,
          timestamp: Date.now()
        });
        
        return result;
      };
    }
  }

  /**
   * Add data to batch for collection
   */
  private addToBatch(type: string, data: any): void {
    this.dataBatch.push({
      type,
      data,
      timestamp: Date.now()
    });

    // Flush if batch is full
    if (this.dataBatch.length >= this.config.batchSize) {
      this.flushBatch();
    }
  }

  /**
   * Start the batch flush timer
   */
  private startBatchFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.dataBatch.length > 0) {
        this.flushBatch();
      }
    }, this.config.flushInterval);
  }

  /**
   * Flush the current batch
   */
  private flushBatch(): void {
    if (this.dataBatch.length === 0) return;

    const batch: PerformanceDataBatch = {
      metrics: [...this.dataBatch],
      timestamp: Date.now(),
      sessionId: performanceMonitoringService.getMetrics().sessionId,
      batchId: this.generateBatchId()
    };

    // Clear the batch
    this.dataBatch = [];

    // Send batch to collection endpoint or store locally
    this.processBatch(batch);
  }

  /**
   * Process the batch (send to server or store locally)
   */
  private async processBatch(batch: PerformanceDataBatch): Promise<void> {
    try {
      if (this.config.endpoint) {
        // Send to server endpoint
        await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch)
        });
      } else {
        // Store locally for demo purposes
        this.storeLocalBatch(batch);
      }

      console.log(`Performance batch processed: ${batch.metrics.length} metrics`);
    } catch (error) {
      console.error('Failed to process performance batch:', error);
      
      // Store locally as fallback
      this.storeLocalBatch(batch);
    }
  }

  /**
   * Store batch locally
   */
  private storeLocalBatch(batch: PerformanceDataBatch): void {
    try {
      const existingBatches = JSON.parse(localStorage.getItem('performance_batches') || '[]');
      existingBatches.push(batch);
      
      // Keep only last 100 batches
      if (existingBatches.length > 100) {
        existingBatches.splice(0, existingBatches.length - 100);
      }
      
      localStorage.setItem('performance_batches', JSON.stringify(existingBatches));
    } catch (error) {
      console.error('Failed to store performance batch locally:', error);
    }
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get stored performance data
   */
  public getStoredData(): PerformanceDataBatch[] {
    try {
      return JSON.parse(localStorage.getItem('performance_batches') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Clear stored performance data
   */
  public clearStoredData(): void {
    localStorage.removeItem('performance_batches');
    localStorage.removeItem('performance_analytics');
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): any {
    const batches = this.getStoredData();
    const allMetrics = batches.flatMap(batch => batch.metrics);
    
    const summary = {
      totalMetrics: allMetrics.length,
      queryPerformance: this.calculateQueryPerformance(allMetrics),
      cachePerformance: this.calculateCachePerformance(allMetrics),
      errorRate: this.calculateErrorRate(allMetrics),
      timeRange: this.getTimeRange(batches)
    };

    return summary;
  }

  /**
   * Calculate query performance metrics
   */
  private calculateQueryPerformance(metrics: any[]): any {
    const queryMetrics = metrics.filter(m => m.type === 'query_performance');
    
    if (queryMetrics.length === 0) {
      return { averageTime: 0, totalQueries: 0 };
    }

    const totalTime = queryMetrics.reduce((sum, m) => sum + m.data.duration, 0);
    const averageTime = totalTime / queryMetrics.length;

    return {
      averageTime: Math.round(averageTime),
      totalQueries: queryMetrics.length,
      slowestQuery: Math.max(...queryMetrics.map(m => m.data.duration)),
      fastestQuery: Math.min(...queryMetrics.map(m => m.data.duration))
    };
  }

  /**
   * Calculate cache performance metrics
   */
  private calculateCachePerformance(metrics: any[]): any {
    const cacheMetrics = metrics.filter(m => m.type === 'cache_access');
    
    if (cacheMetrics.length === 0) {
      return { hitRate: 0, totalAccesses: 0 };
    }

    const hits = cacheMetrics.filter(m => m.data.hit).length;
    const hitRate = (hits / cacheMetrics.length) * 100;

    return {
      hitRate: Math.round(hitRate),
      totalAccesses: cacheMetrics.length,
      hits,
      misses: cacheMetrics.length - hits
    };
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(metrics: any[]): number {
    const errorMetrics = metrics.filter(m => m.type.includes('error'));
    const totalMetrics = metrics.filter(m => m.type.includes('performance') || m.type.includes('error'));
    
    if (totalMetrics.length === 0) return 0;
    
    return Math.round((errorMetrics.length / totalMetrics.length) * 100);
  }

  /**
   * Get time range of collected data
   */
  private getTimeRange(batches: PerformanceDataBatch[]): any {
    if (batches.length === 0) {
      return { start: null, end: null, duration: 0 };
    }

    const timestamps = batches.map(b => b.timestamp);
    const start = Math.min(...timestamps);
    const end = Math.max(...timestamps);

    return {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      duration: end - start
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush any remaining data
    this.flushBatch();
    
    this.isInitialized = false;
  }
}

// Create singleton instance
export const performanceDataCollectionService = new PerformanceDataCollectionService();