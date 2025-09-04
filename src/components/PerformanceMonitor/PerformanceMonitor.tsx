import React, { useState, useEffect } from 'react';
import { performanceMonitoringService, PerformanceMetrics } from '../../services/performanceMonitoringService';
import { performanceDataCollectionService } from '../../services/performanceDataCollectionService';
import { usePerformanceTracking } from '../../hooks/usePerformanceTracking';

interface PerformanceMonitorProps {
  showDetails?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  minimized?: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  showDetails = false,
  position = 'bottom-right',
  minimized = false
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(!minimized);
  const [summary, setSummary] = useState<any>(null);
  const { getMetrics } = usePerformanceTracking();

  useEffect(() => {
    const updateMetrics = () => {
      const currentMetrics = getMetrics();
      setMetrics(currentMetrics);
      
      const performanceSummary = performanceDataCollectionService.getPerformanceSummary();
      setSummary(performanceSummary);
    };

    // Update metrics immediately
    updateMetrics();

    // Update metrics every 5 seconds
    const interval = setInterval(updateMetrics, 5000);

    return () => clearInterval(interval);
  }, [getMetrics]);

  if (!isVisible) {
    return (
      <div 
        className={`fixed ${getPositionClasses(position)} z-50 bg-gray-800 text-white p-2 rounded cursor-pointer`}
        onClick={() => setIsVisible(true)}
      >
        📊
      </div>
    );
  }

  const getPerformanceColor = (value: number, thresholds: { good: number; fair: number }) => {
    if (value <= thresholds.good) return 'text-green-500';
    if (value <= thresholds.fair) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className={`fixed ${getPositionClasses(position)} z-50 bg-gray-900 text-white p-4 rounded-lg shadow-lg max-w-sm`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold">Performance Monitor</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-white text-xs"
          >
            ✕
          </button>
        </div>
      </div>

      {metrics && (
        <div className="space-y-2 text-xs">
          {/* Core Web Vitals */}
          <div>
            <div className="font-medium mb-1">Core Web Vitals</div>
            <div className="grid grid-cols-2 gap-2">
              {metrics.lcp && (
                <div className="flex justify-between">
                  <span>LCP:</span>
                  <span className={getPerformanceColor(metrics.lcp, { good: 2500, fair: 4000 })}>
                    {Math.round(metrics.lcp)}ms
                  </span>
                </div>
              )}
              {metrics.fid && (
                <div className="flex justify-between">
                  <span>FID:</span>
                  <span className={getPerformanceColor(metrics.fid, { good: 100, fair: 300 })}>
                    {Math.round(metrics.fid)}ms
                  </span>
                </div>
              )}
              {metrics.cls && (
                <div className="flex justify-between">
                  <span>CLS:</span>
                  <span className={getPerformanceColor(metrics.cls, { good: 0.1, fair: 0.25 })}>
                    {metrics.cls.toFixed(3)}
                  </span>
                </div>
              )}
              {metrics.fcp && (
                <div className="flex justify-between">
                  <span>FCP:</span>
                  <span className={getPerformanceColor(metrics.fcp, { good: 1800, fair: 3000 })}>
                    {Math.round(metrics.fcp)}ms
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Custom Metrics */}
          <div>
            <div className="font-medium mb-1">Custom Metrics</div>
            <div className="space-y-1">
              {metrics.dashboardLoadTime && (
                <div className="flex justify-between">
                  <span>Dashboard:</span>
                  <span className={getPerformanceColor(metrics.dashboardLoadTime, { good: 2000, fair: 5000 })}>
                    {Math.round(metrics.dashboardLoadTime)}ms
                  </span>
                </div>
              )}
              {metrics.apiResponseTime && (
                <div className="flex justify-between">
                  <span>API:</span>
                  <span className={getPerformanceColor(metrics.apiResponseTime, { good: 500, fair: 1000 })}>
                    {Math.round(metrics.apiResponseTime)}ms
                  </span>
                </div>
              )}
              {metrics.cacheHitRate !== undefined && (
                <div className="flex justify-between">
                  <span>Cache Hit:</span>
                  <span className={metrics.cacheHitRate > 80 ? 'text-green-500' : metrics.cacheHitRate > 60 ? 'text-yellow-500' : 'text-red-500'}>
                    {metrics.cacheHitRate}%
                  </span>
                </div>
              )}
              {metrics.errorRate !== undefined && (
                <div className="flex justify-between">
                  <span>Error Rate:</span>
                  <span className={metrics.errorRate < 5 ? 'text-green-500' : metrics.errorRate < 10 ? 'text-yellow-500' : 'text-red-500'}>
                    {metrics.errorRate}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Summary Stats */}
          {summary && showDetails && (
            <div>
              <div className="font-medium mb-1">Session Summary</div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Total Metrics:</span>
                  <span>{summary.totalMetrics}</span>
                </div>
                {summary.queryPerformance && (
                  <div className="flex justify-between">
                    <span>Avg Query:</span>
                    <span>{summary.queryPerformance.averageTime}ms</span>
                  </div>
                )}
                {summary.cachePerformance && (
                  <div className="flex justify-between">
                    <span>Cache Hits:</span>
                    <span>{summary.cachePerformance.hitRate}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Session Info */}
          <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
            Session: {metrics.sessionId.split('_')[2]}
          </div>
        </div>
      )}
    </div>
  );
};

const getPositionClasses = (position: string): string => {
  switch (position) {
    case 'top-left':
      return 'top-4 left-4';
    case 'top-right':
      return 'top-4 right-4';
    case 'bottom-left':
      return 'bottom-4 left-4';
    case 'bottom-right':
    default:
      return 'bottom-4 right-4';
  }
};

// Development-only performance monitor
export const DevPerformanceMonitor: React.FC = () => {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return <PerformanceMonitor showDetails={true} />;
};