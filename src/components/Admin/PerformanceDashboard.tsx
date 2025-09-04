import React, { useState, useEffect } from 'react';
import { usePerformanceAnalytics } from '../../hooks/usePerformanceAnalytics';
import { performanceDataCollectionService } from '../../services/performanceDataCollectionService';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

export const PerformanceDashboard: React.FC = () => {
  const { analytics, exportData, clearData, getPerformanceScore } = usePerformanceAnalytics();
  const [refreshInterval, setRefreshInterval] = useState<number>(30); // seconds
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Analytics will auto-update via its own useEffect
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const performanceScore = getPerformanceScore();

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" | "outline" => {
    if (score >= 90) return 'default';
    if (score >= 70) return 'secondary';
    return 'destructive';
  };

  const formatMetricValue = (value: number, metric: string): string => {
    if (metric.includes('Time') || metric === 'lcp' || metric === 'fid' || metric === 'fcp' || metric === 'ttfb') {
      return `${Math.round(value)}ms`;
    }
    if (metric === 'cls') {
      return value.toFixed(3);
    }
    if (metric.includes('Rate') || metric.includes('Hit')) {
      return `${Math.round(value)}%`;
    }
    return Math.round(value).toString();
  };

  const prepareChartData = () => {
    if (!analytics.trends.length) return [];

    const chartData: any[] = [];
    const maxLength = Math.max(...analytics.trends.map(t => t.values.length));

    for (let i = 0; i < maxLength; i++) {
      const dataPoint: any = { index: i };
      
      analytics.trends.forEach(trend => {
        if (trend.values[i] !== undefined) {
          dataPoint[trend.metric] = trend.values[i];
        }
      });
      
      chartData.push(dataPoint);
    }

    return chartData;
  };

  const chartData = prepareChartData();

  const alertsByType = analytics.alerts.reduce((acc, alert) => {
    acc[alert.type] = (acc[alert.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const alertsChartData = Object.entries(alertsByType).map(([type, count]) => ({
    name: type,
    value: count,
    color: type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'
  }));

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Performance Dashboard</h1>
          <p className="text-gray-600 mt-1">Real-time application performance monitoring</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Pause' : 'Resume'} Auto-refresh
          </Button>
          <Button variant="outline" onClick={exportData}>
            Export Data
          </Button>
          <Button variant="destructive" onClick={clearData}>
            Clear Data
          </Button>
        </div>
      </div>

      {/* Performance Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Overall Performance Score
            <Badge variant={getScoreBadgeVariant(performanceScore)}>
              {performanceScore}/100
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className={`text-4xl font-bold ${getScoreColor(performanceScore)}`}>
              {performanceScore}
            </div>
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${
                    performanceScore >= 90 ? 'bg-green-500' :
                    performanceScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${performanceScore}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {performanceScore >= 90 ? 'Excellent performance' :
                 performanceScore >= 70 ? 'Good performance, room for improvement' :
                 'Performance needs attention'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {analytics.currentMetrics && (
          <>
            {analytics.currentMetrics.lcp && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Largest Contentful Paint</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMetricValue(analytics.currentMetrics.lcp, 'lcp')}
                  </div>
                  <p className="text-xs text-gray-600">
                    Target: &lt; 2.5s
                  </p>
                </CardContent>
              </Card>
            )}

            {analytics.currentMetrics.fid && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">First Input Delay</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMetricValue(analytics.currentMetrics.fid, 'fid')}
                  </div>
                  <p className="text-xs text-gray-600">
                    Target: &lt; 100ms
                  </p>
                </CardContent>
              </Card>
            )}

            {analytics.currentMetrics.cls && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Cumulative Layout Shift</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMetricValue(analytics.currentMetrics.cls, 'cls')}
                  </div>
                  <p className="text-xs text-gray-600">
                    Target: &lt; 0.1
                  </p>
                </CardContent>
              </Card>
            )}

            {analytics.currentMetrics.dashboardLoadTime && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Dashboard Load Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMetricValue(analytics.currentMetrics.dashboardLoadTime, 'dashboardLoadTime')}
                  </div>
                  <p className="text-xs text-gray-600">
                    Target: &lt; 3s
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Performance Trends */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="index" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      formatMetricValue(value, name),
                      name
                    ]}
                  />
                  {analytics.trends.map((trend, index) => (
                    <Line
                      key={trend.metric}
                      type="monotone"
                      dataKey={trend.metric}
                      stroke={`hsl(${index * 60}, 70%, 50%)`}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts and Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Active Alerts
              <Badge variant="outline">{analytics.alerts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {analytics.alerts.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No active alerts</p>
              ) : (
                analytics.alerts.map((alert) => (
                  <Alert key={alert.id} className={
                    alert.type === 'error' ? 'border-red-200 bg-red-50' :
                    alert.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                    'border-blue-200 bg-blue-50'
                  }>
                    <AlertDescription>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{alert.message}</p>
                          <p className="text-sm text-gray-600">
                            Value: {formatMetricValue(alert.value, alert.metric)} 
                            (Threshold: {formatMetricValue(alert.threshold, alert.metric)})
                          </p>
                        </div>
                        <Badge variant={
                          alert.type === 'error' ? 'destructive' :
                          alert.type === 'warning' ? 'secondary' : 'default'
                        }>
                          {alert.type}
                        </Badge>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Session Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.summary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Metrics</p>
                    <p className="text-2xl font-bold">{analytics.summary.totalMetrics}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Error Rate</p>
                    <p className="text-2xl font-bold">{analytics.summary.errorRate}%</p>
                  </div>
                </div>

                {analytics.summary.queryPerformance && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Query Performance</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Avg Time: {analytics.summary.queryPerformance.averageTime}ms</div>
                      <div>Total Queries: {analytics.summary.queryPerformance.totalQueries}</div>
                      <div>Fastest: {analytics.summary.queryPerformance.fastestQuery}ms</div>
                      <div>Slowest: {analytics.summary.queryPerformance.slowestQuery}ms</div>
                    </div>
                  </div>
                )}

                {analytics.summary.cachePerformance && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Cache Performance</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Hit Rate: {analytics.summary.cachePerformance.hitRate}%</div>
                      <div>Total Accesses: {analytics.summary.cachePerformance.totalAccesses}</div>
                      <div>Hits: {analytics.summary.cachePerformance.hits}</div>
                      <div>Misses: {analytics.summary.cachePerformance.misses}</div>
                    </div>
                  </div>
                )}

                {alertsChartData.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Alert Distribution</p>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={alertsChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={20}
                            outerRadius={50}
                            dataKey="value"
                          >
                            {alertsChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No summary data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Monitoring Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div>
              <label className="text-sm font-medium">Refresh Interval (seconds)</label>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="ml-2 border rounded px-2 py-1"
              >
                <option value={10}>10s</option>
                <option value={30}>30s</option>
                <option value={60}>1m</option>
                <option value={300}>5m</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoRefresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <label htmlFor="autoRefresh" className="text-sm font-medium">
                Auto-refresh
              </label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};