import { PerformanceMetrics, performanceMonitoringService } from './performanceMonitoringService';

export interface AlertRule {
  id: string;
  name: string;
  metric: keyof PerformanceMetrics;
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownPeriod: number; // minutes
  description: string;
}

export interface AlertNotification {
  id: string;
  ruleId: string;
  ruleName: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
  resolvedAt?: number;
}

class PerformanceAlertsService {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, AlertNotification> = new Map();
  private alertHistory: AlertNotification[] = [];
  private lastAlertTimes: Map<string, number> = new Map();
  private subscribers: ((alert: AlertNotification) => void)[] = [];
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'lcp-critical',
        name: 'LCP Critical Threshold',
        metric: 'lcp',
        condition: 'greater_than',
        threshold: 4000,
        severity: 'critical',
        enabled: true,
        cooldownPeriod: 5,
        description: 'Largest Contentful Paint exceeds 4 seconds'
      },
      {
        id: 'lcp-warning',
        name: 'LCP Warning Threshold',
        metric: 'lcp',
        condition: 'greater_than',
        threshold: 2500,
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 10,
        description: 'Largest Contentful Paint exceeds 2.5 seconds'
      },
      {
        id: 'fid-critical',
        name: 'FID Critical Threshold',
        metric: 'fid',
        condition: 'greater_than',
        threshold: 300,
        severity: 'critical',
        enabled: true,
        cooldownPeriod: 5,
        description: 'First Input Delay exceeds 300ms'
      },
      {
        id: 'fid-warning',
        name: 'FID Warning Threshold',
        metric: 'fid',
        condition: 'greater_than',
        threshold: 100,
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 10,
        description: 'First Input Delay exceeds 100ms'
      },
      {
        id: 'cls-critical',
        name: 'CLS Critical Threshold',
        metric: 'cls',
        condition: 'greater_than',
        threshold: 0.25,
        severity: 'critical',
        enabled: true,
        cooldownPeriod: 5,
        description: 'Cumulative Layout Shift exceeds 0.25'
      },
      {
        id: 'cls-warning',
        name: 'CLS Warning Threshold',
        metric: 'cls',
        condition: 'greater_than',
        threshold: 0.1,
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 10,
        description: 'Cumulative Layout Shift exceeds 0.1'
      },
      {
        id: 'dashboard-slow',
        name: 'Dashboard Load Time Warning',
        metric: 'dashboardLoadTime',
        condition: 'greater_than',
        threshold: 5000,
        severity: 'high',
        enabled: true,
        cooldownPeriod: 5,
        description: 'Dashboard takes more than 5 seconds to load'
      },
      {
        id: 'api-slow',
        name: 'API Response Time Warning',
        metric: 'apiResponseTime',
        condition: 'greater_than',
        threshold: 2000,
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 10,
        description: 'API response time exceeds 2 seconds'
      },
      {
        id: 'cache-low',
        name: 'Low Cache Hit Rate',
        metric: 'cacheHitRate',
        condition: 'less_than',
        threshold: 50,
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 15,
        description: 'Cache hit rate is below 50%'
      },
      {
        id: 'error-high',
        name: 'High Error Rate',
        metric: 'errorRate',
        condition: 'greater_than',
        threshold: 10,
        severity: 'high',
        enabled: true,
        cooldownPeriod: 5,
        description: 'Error rate exceeds 10%'
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }

  /**
   * Start monitoring performance metrics
   */
  public startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.checkAlerts();
    }, intervalMs);

    console.log('Performance alerts monitoring started');
  }

  /**
   * Stop monitoring performance metrics
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Performance alerts monitoring stopped');
  }

  /**
   * Check current metrics against alert rules
   */
  private checkAlerts(): void {
    const currentMetrics = performanceMonitoringService.getMetrics();
    const now = Date.now();

    this.rules.forEach((rule) => {
      if (!rule.enabled) return;

      const value = currentMetrics[rule.metric];
      if (value === undefined) return;

      // Check cooldown period
      const lastAlertTime = this.lastAlertTimes.get(rule.id) || 0;
      const cooldownMs = rule.cooldownPeriod * 60 * 1000;
      if (now - lastAlertTime < cooldownMs) return;

      // Check if rule condition is met
      const conditionMet = this.evaluateCondition(value, rule.condition, rule.threshold);
      
      if (conditionMet) {
        this.triggerAlert(rule, value, now);
      } else {
        // Check if we should resolve an existing alert
        this.resolveAlert(rule.id, now);
      }
    });
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      default:
        return false;
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(rule: AlertRule, value: number, timestamp: number): void {
    const alertId = `${rule.id}-${timestamp}`;
    
    const alert: AlertNotification = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      severity: rule.severity,
      message: `${rule.description}. Current value: ${this.formatValue(value, rule.metric)}`,
      timestamp,
      acknowledged: false
    };

    this.activeAlerts.set(rule.id, alert);
    this.alertHistory.push(alert);
    this.lastAlertTimes.set(rule.id, timestamp);

    // Notify subscribers
    this.notifySubscribers(alert);

    // Log alert
    console.warn(`Performance Alert: ${alert.message}`);

    // Store in localStorage for persistence
    this.persistAlerts();
  }

  /**
   * Resolve an alert
   */
  private resolveAlert(ruleId: string, timestamp: number): void {
    const activeAlert = this.activeAlerts.get(ruleId);
    if (activeAlert && !activeAlert.resolvedAt) {
      activeAlert.resolvedAt = timestamp;
      this.activeAlerts.delete(ruleId);
      
      console.log(`Performance Alert Resolved: ${activeAlert.ruleName}`);
      this.persistAlerts();
    }
  }

  /**
   * Format metric value for display
   */
  private formatValue(value: number, metric: string): string {
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
  }

  /**
   * Subscribe to alert notifications
   */
  public subscribe(callback: (alert: AlertNotification) => void): () => void {
    this.subscribers.push(callback);
    
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Notify all subscribers
   */
  private notifySubscribers(alert: AlertNotification): void {
    this.subscribers.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error notifying alert subscriber:', error);
      }
    });
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): AlertNotification[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  public getAlertHistory(limit?: number): AlertNotification[] {
    const history = [...this.alertHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string): void {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.persistAlerts();
    }
  }

  /**
   * Add or update alert rule
   */
  public setRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.persistRules();
  }

  /**
   * Remove alert rule
   */
  public removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.activeAlerts.delete(ruleId);
    this.persistRules();
  }

  /**
   * Get all alert rules
   */
  public getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get alert statistics
   */
  public getStatistics(): any {
    const now = Date.now();
    const last24Hours = now - (24 * 60 * 60 * 1000);
    const last7Days = now - (7 * 24 * 60 * 60 * 1000);

    const recent24h = this.alertHistory.filter(a => a.timestamp > last24Hours);
    const recent7d = this.alertHistory.filter(a => a.timestamp > last7Days);

    const bySeverity = this.alertHistory.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byMetric = this.alertHistory.reduce((acc, alert) => {
      acc[alert.metric] = (acc[alert.metric] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: this.alertHistory.length,
      active: this.activeAlerts.size,
      last24Hours: recent24h.length,
      last7Days: recent7d.length,
      bySeverity,
      byMetric,
      acknowledgedRate: this.alertHistory.length > 0 ? 
        (this.alertHistory.filter(a => a.acknowledged).length / this.alertHistory.length) * 100 : 0
    };
  }

  /**
   * Persist alerts to localStorage
   */
  private persistAlerts(): void {
    try {
      const data = {
        activeAlerts: Array.from(this.activeAlerts.entries()),
        alertHistory: this.alertHistory.slice(-1000), // Keep last 1000 alerts
        lastAlertTimes: Array.from(this.lastAlertTimes.entries())
      };
      localStorage.setItem('performance-alerts', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to persist alerts:', error);
    }
  }

  /**
   * Persist rules to localStorage
   */
  private persistRules(): void {
    try {
      const rules = Array.from(this.rules.entries());
      localStorage.setItem('performance-alert-rules', JSON.stringify(rules));
    } catch (error) {
      console.error('Failed to persist alert rules:', error);
    }
  }

  /**
   * Load persisted data
   */
  public loadPersistedData(): void {
    try {
      // Load alerts
      const alertsData = localStorage.getItem('performance-alerts');
      if (alertsData) {
        const parsed = JSON.parse(alertsData);
        this.activeAlerts = new Map(parsed.activeAlerts || []);
        this.alertHistory = parsed.alertHistory || [];
        this.lastAlertTimes = new Map(parsed.lastAlertTimes || []);
      }

      // Load rules
      const rulesData = localStorage.getItem('performance-alert-rules');
      if (rulesData) {
        const parsed = JSON.parse(rulesData);
        this.rules = new Map(parsed);
      }
    } catch (error) {
      console.error('Failed to load persisted alert data:', error);
    }
  }

  /**
   * Clear all alert data
   */
  public clearAllData(): void {
    this.activeAlerts.clear();
    this.alertHistory = [];
    this.lastAlertTimes.clear();
    localStorage.removeItem('performance-alerts');
    console.log('All alert data cleared');
  }

  /**
   * Export alert data
   */
  public exportData(): string {
    const exportData = {
      rules: Array.from(this.rules.entries()),
      activeAlerts: Array.from(this.activeAlerts.entries()),
      alertHistory: this.alertHistory,
      statistics: this.getStatistics(),
      exportedAt: new Date().toISOString()
    };

    return JSON.stringify(exportData, null, 2);
  }
}

// Create singleton instance
export const performanceAlertsService = new PerformanceAlertsService();

// Auto-load persisted data and start monitoring
if (typeof window !== 'undefined') {
  performanceAlertsService.loadPersistedData();
  performanceAlertsService.startMonitoring();
}