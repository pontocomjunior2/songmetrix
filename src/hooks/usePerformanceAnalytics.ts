import { useState, useEffect, useCallback } from 'react';
import { performanceMonitoringService, PerformanceMetrics } from '../services/performanceMonitoringService';
import { performanceDataCollectionService } from '../services/performanceDataCollectionService';

export interface PerformanceAnalytics {
  currentMetrics: PerformanceMetrics | null;
  summary: any;
  trends: PerformanceTrend[];
  alerts: PerformanceAlert[];
  isCollecting: boolean;
}

export interface PerformanceTrend {
  metric: string;
  values: number[];
  timestamps: number[];
  trend: 'improving' | 'degrading' | 'stable';
  change: number;
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  metric: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export const usePerformanceAnalytics = () => {
  const [analytics, setAnalytics] = useState<PerformanceAnalytics>({
    currentMetrics: null,
    summary: null,
    trends: [],
    alerts: [],
    isCollecting: true
  });

  const [historicalData, setHistoricalData] = useState<PerformanceMetrics[]>([]);

  // Update analytics data
  const updateAnalytics = useCallback(() => {
    const currentMetrics = performanceMonitoringService.getMetrics();
    const summary = performanceDataCollectionService.getPerformanceSummary();
    
    // Update historical data
    setHistoricalData(prev => {
      const newData = [...prev, currentMetrics];
      // Keep only last 100 entries
      return newData.slice(-100);
    });

    // Calculate trends
    const trends = calculateTrends(historicalData);
    
    // Check for alerts
    const alerts = checkPerformanceAlerts(currentMetrics, trends);

    setAnalytics({
      currentMetrics,
      summary,
      trends,
      alerts,
      isCollecting: true
    });
  }, [historicalData]);

  // Calculate performance trends
  const calculateTrends = (data: PerformanceMetrics[]): PerformanceTrend[] => {
    if (data.length < 5) return [];

    const trends: PerformanceTrend[] = [];
    const metrics = ['lcp', 'fid', 'cls', 'dashboardLoadTime', 'apiResponseTime'] as const;

    metrics.forEach(metric => {
      const values = data
        .map(d => d[metric])
        .filter((v): v is number => v !== undefined)
        .slice(-20); // Last 20 values

      if (values.length < 5) return;

      const timestamps = data
        .filter(d => d[metric] !== undefined)
        .map(d => d.timestamp)
        .slice(-20);

      // Calculate trend using linear regression
      const trend = calculateLinearTrend(values);
      const change = values.length > 1 ? 
        ((values[values.length - 1] - values[0]) / values[0]) * 100 : 0;

      trends.push({
        metric,
        values,
        timestamps,
        trend: Math.abs(change) < 5 ? 'stable' : change < 0 ? 'improving' : 'degrading',
        change: Math.round(change * 100) / 100
      });
    });

    return trends;
  };

  // Calculate linear trend
  const calculateLinearTrend = (values: number[]): 'improving' | 'degrading' | 'stable' => {
    if (values.length < 2) return 'stable';

    const n = values.length;
    const sumX = values.reduce((sum, _, i) => sum + i, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumXX = values.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    if (Math.abs(slope) < 0.1) return 'stable';
    return slope < 0 ? 'improving' : 'degrading';
  };

  // Check for performance alerts
  const checkPerformanceAlerts = (
    metrics: PerformanceMetrics, 
    trends: PerformanceTrend[]
  ): PerformanceAlert[] => {
    const alerts: PerformanceAlert[] = [];

    // Core Web Vitals alerts
    if (metrics.lcp && metrics.lcp > 4000) {
      alerts.push({
        id: `lcp-${Date.now()}`,
        type: 'error',
        metric: 'lcp',
        message: 'Largest Contentful Paint is critically slow',
        value: metrics.lcp,
        threshold: 4000,
        timestamp: Date.now()
      });
    } else if (metrics.lcp && metrics.lcp > 2500) {
      alerts.push({
        id: `lcp-${Date.now()}`,
        type: 'warning',
        metric: 'lcp',
        message: 'Largest Contentful Paint needs improvement',
        value: metrics.lcp,
        threshold: 2500,
        timestamp: Date.now()
      });
    }

    if (metrics.fid && metrics.fid > 300) {
      alerts.push({
        id: `fid-${Date.now()}`,
        type: 'error',
        metric: 'fid',
        message: 'First Input Delay is critically slow',
        value: metrics.fid,
        threshold: 300,
        timestamp: Date.now()
      });
    } else if (metrics.fid && metrics.fid > 100) {
      alerts.push({
        id: `fid-${Date.now()}`,
        type: 'warning',
        metric: 'fid',
        message: 'First Input Delay needs improvement',
        value: metrics.fid,
        threshold: 100,
        timestamp: Date.now()
      });
    }

    if (metrics.cls && metrics.cls > 0.25) {
      alerts.push({
        id: `cls-${Date.now()}`,
        type: 'error',
        metric: 'cls',
        message: 'Cumulative Layout Shift is critically high',
        value: metrics.cls,
        threshold: 0.25,
        timestamp: Date.now()
      });
    } else if (metrics.cls && metrics.cls > 0.1) {
      alerts.push({
        id: `cls-${Date.now()}`,
        type: 'warning',
        metric: 'cls',
        message: 'Cumulative Layout Shift needs improvement',
        value: metrics.cls,
        threshold: 0.1,
        timestamp: Date.now()
      });
    }

    // Custom metrics alerts
    if (metrics.dashboardLoadTime && metrics.dashboardLoadTime > 5000) {
      alerts.push({
        id: `dashboard-${Date.now()}`,
        type: 'error',
        metric: 'dashboardLoadTime',
        message: 'Dashboard load time is critically slow',
        value: metrics.dashboardLoadTime,
        threshold: 5000,
        timestamp: Date.now()
      });
    }

    if (metrics.apiResponseTime && metrics.apiResponseTime > 2000) {
      alerts.push({
        id: `api-${Date.now()}`,
        type: 'warning',
        metric: 'apiResponseTime',
        message: 'API response time is slow',
        value: metrics.apiResponseTime,
        threshold: 2000,
        timestamp: Date.now()
      });
    }

    if (metrics.cacheHitRate !== undefined && metrics.cacheHitRate < 50) {
      alerts.push({
        id: `cache-${Date.now()}`,
        type: 'warning',
        metric: 'cacheHitRate',
        message: 'Cache hit rate is low',
        value: metrics.cacheHitRate,
        threshold: 50,
        timestamp: Date.now()
      });
    }

    if (metrics.errorRate !== undefined && metrics.errorRate > 10) {
      alerts.push({
        id: `error-${Date.now()}`,
        type: 'error',
        metric: 'errorRate',
        message: 'Error rate is high',
        value: metrics.errorRate,
        threshold: 10,
        timestamp: Date.now()
      });
    }

    // Trend-based alerts
    trends.forEach(trend => {
      if (trend.trend === 'degrading' && Math.abs(trend.change) > 20) {
        alerts.push({
          id: `trend-${trend.metric}-${Date.now()}`,
          type: 'warning',
          metric: trend.metric,
          message: `${trend.metric} performance is degrading (${trend.change.toFixed(1)}% worse)`,
          value: trend.values[trend.values.length - 1] || 0,
          threshold: trend.values[0] || 0,
          timestamp: Date.now()
        });
      }
    });

    return alerts;
  };

  // Export performance data
  const exportData = useCallback(() => {
    const exportData = {
      currentMetrics: analytics.currentMetrics,
      summary: analytics.summary,
      trends: analytics.trends,
      alerts: analytics.alerts,
      historicalData: historicalData,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-analytics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [analytics, historicalData]);

  // Clear performance data
  const clearData = useCallback(() => {
    performanceDataCollectionService.clearStoredData();
    performanceMonitoringService.reset();
    setHistoricalData([]);
    setAnalytics({
      currentMetrics: null,
      summary: null,
      trends: [],
      alerts: [],
      isCollecting: true
    });
  }, []);

  // Get performance score
  const getPerformanceScore = useCallback((): number => {
    if (!analytics.currentMetrics) return 0;

    const metrics = analytics.currentMetrics;
    let score = 100;

    // Core Web Vitals scoring (60% weight)
    if (metrics.lcp) {
      if (metrics.lcp > 4000) score -= 25;
      else if (metrics.lcp > 2500) score -= 15;
      else if (metrics.lcp > 1500) score -= 5;
    }

    if (metrics.fid) {
      if (metrics.fid > 300) score -= 20;
      else if (metrics.fid > 100) score -= 10;
      else if (metrics.fid > 50) score -= 3;
    }

    if (metrics.cls) {
      if (metrics.cls > 0.25) score -= 15;
      else if (metrics.cls > 0.1) score -= 8;
      else if (metrics.cls > 0.05) score -= 2;
    }

    // Custom metrics scoring (40% weight)
    if (metrics.dashboardLoadTime) {
      if (metrics.dashboardLoadTime > 5000) score -= 20;
      else if (metrics.dashboardLoadTime > 3000) score -= 10;
      else if (metrics.dashboardLoadTime > 2000) score -= 5;
    }

    if (metrics.errorRate !== undefined) {
      if (metrics.errorRate > 10) score -= 10;
      else if (metrics.errorRate > 5) score -= 5;
    }

    if (metrics.cacheHitRate !== undefined) {
      if (metrics.cacheHitRate < 50) score -= 10;
      else if (metrics.cacheHitRate < 70) score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }, [analytics.currentMetrics]);

  // Setup periodic updates
  useEffect(() => {
    updateAnalytics();
    
    const interval = setInterval(updateAnalytics, 10000); // Update every 10 seconds
    
    return () => clearInterval(interval);
  }, [updateAnalytics]);

  return {
    analytics,
    exportData,
    clearData,
    getPerformanceScore,
    updateAnalytics
  };
};