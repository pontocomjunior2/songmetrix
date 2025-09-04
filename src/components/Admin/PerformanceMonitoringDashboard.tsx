import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { continuousPerformanceMonitoring } from '../../services/continuousPerformanceMonitoring';

interface MonitoringDashboardProps {
  className?: string;
}

export const PerformanceMonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ 
  className = '' 
}) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');

  useEffect(() => {
    // Check initial monitoring status
    const initialStatus = continuousPerformanceMonitoring.getStatus();
    setIsMonitoring(initialStatus.isRunning);
    setStatus(initialStatus);

    // Load initial data
    loadData();

    // Set up periodic updates
    const interval = setInterval(() => {
      const currentStatus = continuousPerformanceMonitoring.getStatus();
      setStatus(currentStatus);
      setIsMonitoring(currentStatus.isRunning);
      
      if (currentStatus.isRunning) {
        loadData();
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  const loadData = () => {
    const timeRanges = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    };

    const since = Date.now() - timeRanges[selectedTimeRange as keyof typeof timeRanges];
    
    const recentMetrics = continuousPerformanceMonitoring.getMetrics(undefined, since);
    const recentAlerts = continuousPerformanceMonitoring.getAlerts(undefined, since);
    const recentReports = continuousPerformanceMonitoring.getReports(since);

    setMetrics(recentMetrics);
    setAlerts(recentAlerts);
    setReports(recentReports);
  };

  const handleStartMonitoring = () => {
    continuousPerformanceMonitoring.start();
    setIsMonitoring(true);
  };

  const handleStopMonitoring = () => {
    continuousPerformanceMonitoring.stop();
    setIsMonitoring(false);
  };

  const handleResolveAlert = (alertId: string) => {
    const resolved = continuousPerformanceMonitoring.resolveAlert(alertId);
    if (resolved) {
      loadData(); // Refresh data
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'down': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getAlertColor = (level: string) => {
    switch (level) {
      case 'critical': return 'destructive';
      case 'warning': return 'secondary';
      default: return 'outline';
    }
  };

  const calculateEndpointMetrics = () => {
    const endpointGroups = new Map();
    
    metrics.forEach(metric => {
      if (!endpointGroups.has(metric.endpoint)) {
        endpointGroups.set(metric.endpoint, []);
      }
      endpointGroups.get(metric.endpoint).push(metric);
    });

    return Array.from(endpointGroups.entries()).map(([endpoint, endpointMetrics]) => {
      const successfulRequests = endpointMetrics.filter((m: any) => m.success).length;
      const totalRequests = endpointMetrics.length;
      const avgResponseTime = endpointMetrics.reduce((sum: number, m: any) => sum + m.responseTime, 0) / totalRequests;
      const availability = (successfulRequests / totalRequests) * 100;
      
      let status = 'healthy';
      if (availability < 95) {
        status = 'down';
      } else if (availability < 99 || avgResponseTime > 2000) {
        status = 'degraded';
      }

      return {
        endpoint,
        totalRequests,
        successfulRequests,
        avgResponseTime,
        availability,
        status
      };
    });
  };

  const endpointMetrics = calculateEndpointMetrics();
  const activeAlerts = alerts.filter(alert => !alert.resolved);
  const resolvedAlerts = alerts.filter(alert => alert.resolved);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Monitoring</h2>
          <p className="text-gray-600">Real-time performance monitoring and alerting</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="5m">Last 5 minutes</option>
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
          </select>
          {isMonitoring ? (
            <Button onClick={handleStopMonitoring} variant="destructive">
              Stop Monitoring
            </Button>
          ) : (
            <Button onClick={handleStartMonitoring}>
              Start Monitoring
            </Button>
          )}
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-2xl font-bold">
                {isMonitoring ? 'Running' : 'Stopped'}
              </span>
            </div>
            {status && isMonitoring && (
              <p className="text-sm text-gray-600 mt-1">
                Uptime: {Math.floor(status.uptime / 1000)}s
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Metrics Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.metricsCount || 0}</div>
            <p className="text-sm text-gray-600">
              {metrics.length} in selected range
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{activeAlerts.length}</div>
            <p className="text-sm text-gray-600">
              {alerts.length} total alerts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Reports Generated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.reportsCount || 0}</div>
            <p className="text-sm text-gray-600">
              {reports.length} in selected range
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>🚨 Active Alerts</span>
              <Badge variant="destructive">{activeAlerts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeAlerts.map((alert) => (
                <Alert key={alert.id} className="border-red-200">
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={getAlertColor(alert.level)}>
                            {alert.level.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{alert.endpoint}</span>
                          <span className="text-sm text-gray-600">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="mt-1 text-sm">{alert.message}</p>
                        <p className="text-xs text-gray-500">
                          Value: {alert.value} | Threshold: {alert.threshold}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolveAlert(alert.id)}
                      >
                        Resolve
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Endpoint Status */}
      <Card>
        <CardHeader>
          <CardTitle>Endpoint Status</CardTitle>
        </CardHeader>
        <CardContent>
          {endpointMetrics.length > 0 ? (
            <div className="space-y-4">
              {endpointMetrics.map((endpoint) => (
                <div key={endpoint.endpoint} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(endpoint.status)}`} />
                      <h3 className="font-medium">{endpoint.endpoint}</h3>
                      <Badge variant="outline">{endpoint.status}</Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      {endpoint.totalRequests} requests
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Availability:</span>
                      <div className="font-medium">
                        {endpoint.availability.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Avg Response:</span>
                      <div className="font-medium">
                        {endpoint.avgResponseTime.toFixed(2)}ms
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Success Rate:</span>
                      <div className="font-medium">
                        {((endpoint.successfulRequests / endpoint.totalRequests) * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {isMonitoring ? 'Collecting data...' : 'No monitoring data available'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Reports */}
      {reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reports.slice(0, 5).map((report) => (
                <div key={report.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">
                      Report {new Date(report.timestamp).toLocaleString()}
                    </span>
                    <Badge variant="outline">
                      {Math.floor((report.period.end - report.period.start) / (60 * 1000))}min
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Requests:</span>
                      <div className="font-medium">{report.summary.totalRequests}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Success Rate:</span>
                      <div className="font-medium">
                        {((report.summary.successfulRequests / report.summary.totalRequests) * 100).toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Avg Response:</span>
                      <div className="font-medium">
                        {report.summary.averageResponseTime.toFixed(2)}ms
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Alerts:</span>
                      <div className="font-medium">{report.alerts.length}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resolved Alerts */}
      {resolvedAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recently Resolved Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resolvedAlerts.slice(0, 10).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-green-600">
                      RESOLVED
                    </Badge>
                    <span className="text-sm">{alert.endpoint}</span>
                    <span className="text-sm text-gray-600">{alert.message}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(alert.resolvedAt || alert.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PerformanceMonitoringDashboard;