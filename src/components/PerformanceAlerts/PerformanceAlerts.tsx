import React, { useState, useEffect } from 'react';
import { performanceAlertsService, AlertNotification } from '../../services/performanceAlertsService';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface PerformanceAlertsProps {
  maxAlerts?: number;
  showHistory?: boolean;
  autoHide?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const PerformanceAlerts: React.FC<PerformanceAlertsProps> = ({
  maxAlerts = 5,
  showHistory = false,
  autoHide = true,
  position = 'top-right'
}) => {
  const [activeAlerts, setActiveAlerts] = useState<AlertNotification[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertNotification[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Load initial alerts
    setActiveAlerts(performanceAlertsService.getActiveAlerts());
    if (showHistory) {
      setAlertHistory(performanceAlertsService.getAlertHistory(20));
    }

    // Subscribe to new alerts
    const unsubscribe = performanceAlertsService.subscribe((alert) => {
      setActiveAlerts(performanceAlertsService.getActiveAlerts());
      if (showHistory) {
        setAlertHistory(performanceAlertsService.getAlertHistory(20));
      }

      // Show notification for new alerts
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Performance Alert: ${alert.ruleName}`, {
          body: alert.message,
          icon: '/favicon.ico',
          tag: alert.id
        });
      }
    });

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return unsubscribe;
  }, [showHistory]);

  const handleAcknowledge = (alertId: string) => {
    performanceAlertsService.acknowledgeAlert(alertId);
    setActiveAlerts(performanceAlertsService.getActiveAlerts());
    if (showHistory) {
      setAlertHistory(performanceAlertsService.getAlertHistory(20));
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-50 text-red-800';
      case 'high':
        return 'border-orange-500 bg-orange-50 text-orange-800';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 text-yellow-800';
      case 'low':
        return 'border-blue-500 bg-blue-50 text-blue-800';
      default:
        return 'border-gray-500 bg-gray-50 text-gray-800';
    }
  };

  const getSeverityBadgeVariant = (severity: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getPositionClasses = (): string => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      default:
        return 'top-4 right-4';
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (!isVisible && autoHide && activeAlerts.length === 0) {
    return null;
  }

  const displayAlerts = activeAlerts.slice(0, maxAlerts);

  return (
    <div className={`fixed ${getPositionClasses()} z-50 max-w-md space-y-2`}>
      {/* Active Alerts */}
      {displayAlerts.map((alert) => (
        <Alert
          key={alert.id}
          className={`${getSeverityColor(alert.severity)} shadow-lg`}
        >
          <AlertDescription>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center space-x-2">
                <Badge variant={getSeverityBadgeVariant(alert.severity)}>
                  {alert.severity.toUpperCase()}
                </Badge>
                <span className="text-xs text-gray-600">
                  {formatTimestamp(alert.timestamp)}
                </span>
              </div>
              <button
                onClick={() => handleAcknowledge(alert.id)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ✕
              </button>
            </div>
            <div>
              <p className="font-medium text-sm">{alert.ruleName}</p>
              <p className="text-xs mt-1">{alert.message}</p>
              <div className="flex justify-between items-center mt-2 text-xs">
                <span>Metric: {alert.metric}</span>
                <span>
                  Value: {alert.value} | Threshold: {alert.threshold}
                </span>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      ))}

      {/* Alert History (if enabled) */}
      {showHistory && alertHistory.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-lg p-4 max-h-80 overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-medium text-sm">Recent Alerts</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(!isVisible)}
            >
              {isVisible ? 'Hide' : 'Show'}
            </Button>
          </div>
          
          {isVisible && (
            <div className="space-y-2">
              {alertHistory.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-2 rounded border-l-4 ${
                    alert.acknowledged ? 'bg-gray-50 opacity-60' : 'bg-white'
                  } ${getSeverityColor(alert.severity).split(' ')[0]}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-xs font-medium">{alert.ruleName}</p>
                      <p className="text-xs text-gray-600 mt-1">{alert.message}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(alert.timestamp)}
                        </span>
                        {alert.resolvedAt && (
                          <span className="text-xs text-green-600">
                            Resolved at {formatTimestamp(alert.resolvedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      <Badge variant={getSeverityBadgeVariant(alert.severity)} className="text-xs">
                        {alert.severity}
                      </Badge>
                      {alert.acknowledged && (
                        <Badge variant="outline" className="text-xs">
                          ACK
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary Badge */}
      {activeAlerts.length > maxAlerts && (
        <div className="bg-gray-900 text-white p-2 rounded-lg text-center">
          <span className="text-xs">
            +{activeAlerts.length - maxAlerts} more alerts
          </span>
        </div>
      )}
    </div>
  );
};

// Compact alert indicator for minimal UI impact - DEV MODE ONLY
export const PerformanceAlertIndicator: React.FC = () => {
  // Only show in development mode
  const isDevelopment = import.meta.env.DEV;

  const [alertCount, setAlertCount] = useState(0);
  const [highestSeverity, setHighestSeverity] = useState<string>('');

  useEffect(() => {
    // Skip if not in development mode
    if (!isDevelopment) return;

    const updateAlerts = () => {
      const activeAlerts = performanceAlertsService.getActiveAlerts();
      setAlertCount(activeAlerts.length);

      if (activeAlerts.length > 0) {
        const severityOrder = ['critical', 'high', 'medium', 'low'];
        const highest = activeAlerts.reduce((prev, current) => {
          const prevIndex = severityOrder.indexOf(prev.severity);
          const currentIndex = severityOrder.indexOf(current.severity);
          return currentIndex < prevIndex ? current : prev;
        });
        setHighestSeverity(highest.severity);
      } else {
        setHighestSeverity('');
      }
    };

    updateAlerts();
    const unsubscribe = performanceAlertsService.subscribe(updateAlerts);

    return unsubscribe;
  }, [isDevelopment]);

  // Don't render anything in production
  if (!isDevelopment || alertCount === 0) return null;

  const getIndicatorColor = (): string => {
    switch (highestSeverity) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="fixed top-4 right-20 z-50">
      <div className={`${getIndicatorColor()} text-white px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1`}>
        <span>⚠</span>
        <span>{alertCount}</span>
      </div>
    </div>
  );
};