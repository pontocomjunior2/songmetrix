export interface MonitoringConfig {
  enabled: boolean;
  interval: number; // in milliseconds
  endpoints: MonitoringEndpoint[];
  thresholds: MonitoringThresholds;
  alerting: AlertingConfig;
  retention: RetentionConfig;
}

export interface MonitoringEndpoint {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout: number;
  critical: boolean;
}

export interface MonitoringThresholds {
  responseTime: {
    warning: number;
    critical: number;
  };
  errorRate: {
    warning: number; // percentage
    critical: number; // percentage
  };
  availability: {
    warning: number; // percentage
    critical: number; // percentage
  };
  throughput: {
    warning: number; // requests per second
    critical: number; // requests per second
  };
}

export interface AlertingConfig {
  enabled: boolean;
  channels: AlertChannel[];
  cooldown: number; // milliseconds between alerts
  escalation: EscalationConfig;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'console';
  config: any;
  enabled: boolean;
}

export interface EscalationConfig {
  enabled: boolean;
  levels: EscalationLevel[];
}

export interface EscalationLevel {
  threshold: number; // minutes
  channels: string[];
  message: string;
}

export interface RetentionConfig {
  metrics: number; // days
  alerts: number; // days
  reports: number; // days
}

export interface PerformanceMetric {
  timestamp: number;
  endpoint: string;
  responseTime: number;
  statusCode: number;
  success: boolean;
  errorMessage?: string;
  size: number;
  ttfb: number; // Time to First Byte
}

export interface MonitoringAlert {
  id: string;
  timestamp: number;
  level: 'warning' | 'critical';
  type: 'response_time' | 'error_rate' | 'availability' | 'throughput';
  endpoint: string;
  message: string;
  value: number;
  threshold: number;
  resolved: boolean;
  resolvedAt?: number;
}

export interface MonitoringReport {
  id: string;
  timestamp: number;
  period: {
    start: number;
    end: number;
  };
  summary: ReportSummary;
  endpoints: EndpointReport[];
  alerts: MonitoringAlert[];
  trends: TrendAnalysis;
}

export interface ReportSummary {
  totalRequests: number;
  successfulRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  availability: number;
  throughput: number;
}

export interface EndpointReport {
  name: string;
  url: string;
  metrics: ReportSummary;
  status: 'healthy' | 'degraded' | 'down';
  incidents: number;
}

export interface TrendAnalysis {
  responseTimeTrend: 'improving' | 'stable' | 'degrading';
  errorRateTrend: 'improving' | 'stable' | 'degrading';
  availabilityTrend: 'improving' | 'stable' | 'degrading';
  recommendations: string[];
}

class ContinuousPerformanceMonitoring {
  private config: MonitoringConfig;
  private metrics: PerformanceMetric[] = [];
  private alerts: MonitoringAlert[] = [];
  private reports: MonitoringReport[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private reportingInterval?: NodeJS.Timeout;
  private isRunning = false;
  private lastAlertTime: Map<string, number> = new Map();

  constructor(config?: Partial<MonitoringConfig>) {
    this.config = {
      enabled: true,
      interval: 60000, // 1 minute
      endpoints: this.getDefaultEndpoints(),
      thresholds: this.getDefaultThresholds(),
      alerting: this.getDefaultAlertingConfig(),
      retention: {
        metrics: 30, // 30 days
        alerts: 90,  // 90 days
        reports: 365 // 1 year
      },
      ...config
    };
  }

  /**
   * Start continuous monitoring
   */
  public start(): void {
    if (this.isRunning) {
      console.log('Performance monitoring is already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('Performance monitoring is disabled');
      return;
    }

    console.log('Starting continuous performance monitoring...');
    console.log(`Monitoring ${this.config.endpoints.length} endpoints every ${this.config.interval / 1000} seconds`);

    this.isRunning = true;

    // Start monitoring loop
    this.monitoringInterval = setInterval(() => {
      this.runMonitoringCycle();
    }, this.config.interval);

    // Start reporting loop (every hour)
    this.reportingInterval = setInterval(() => {
      this.generateHourlyReport();
    }, 60 * 60 * 1000);

    // Run initial monitoring cycle
    this.runMonitoringCycle();

    console.log('Performance monitoring started successfully');
  }

  /**
   * Stop continuous monitoring
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log('Performance monitoring is not running');
      return;
    }

    console.log('Stopping continuous performance monitoring...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
      this.reportingInterval = undefined;
    }

    this.isRunning = false;
    console.log('Performance monitoring stopped');
  }

  /**
   * Run single monitoring cycle
   */
  private async runMonitoringCycle(): Promise<void> {
    try {
      console.log(`Running monitoring cycle at ${new Date().toISOString()}`);

      // Monitor all endpoints in parallel
      const monitoringPromises = this.config.endpoints.map(endpoint => 
        this.monitorEndpoint(endpoint)
      );

      const results = await Promise.allSettled(monitoringPromises);

      // Process results
      results.forEach((result, index) => {
        const endpoint = this.config.endpoints[index];
        
        if (result.status === 'fulfilled' && result.value) {
          this.metrics.push(result.value);
          this.analyzeMetric(result.value, endpoint);
        } else if (result.status === 'rejected') {
          console.error(`Failed to monitor endpoint ${endpoint.name}:`, result.reason);
          
          // Create error metric
          const errorMetric: PerformanceMetric = {
            timestamp: Date.now(),
            endpoint: endpoint.name,
            responseTime: 0,
            statusCode: 0,
            success: false,
            errorMessage: result.reason?.message || 'Unknown error',
            size: 0,
            ttfb: 0
          };
          
          this.metrics.push(errorMetric);
          this.analyzeMetric(errorMetric, endpoint);
        }
      });

      // Clean up old metrics
      this.cleanupOldData();

    } catch (error) {
      console.error('Monitoring cycle failed:', error);
    }
  }

  /**
   * Monitor single endpoint
   */
  private async monitorEndpoint(endpoint: MonitoringEndpoint): Promise<PerformanceMetric> {
    const startTime = performance.now();
    let ttfbTime = 0;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), endpoint.timeout);

      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: endpoint.headers,
        body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Estimate TTFB (simplified)
      ttfbTime = responseTime * 0.3; // Rough estimation

      // Get response size
      const contentLength = response.headers.get('content-length');
      const size = contentLength ? parseInt(contentLength) : 0;

      const metric: PerformanceMetric = {
        timestamp: Date.now(),
        endpoint: endpoint.name,
        responseTime,
        statusCode: response.status,
        success: response.ok,
        size,
        ttfb: ttfbTime
      };

      if (!response.ok) {
        metric.errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }

      return metric;

    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      return {
        timestamp: Date.now(),
        endpoint: endpoint.name,
        responseTime,
        statusCode: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        size: 0,
        ttfb: 0
      };
    }
  }

  /**
   * Analyze metric and trigger alerts if needed
   */
  private analyzeMetric(metric: PerformanceMetric, endpoint: MonitoringEndpoint): void {
    const now = Date.now();
    const alertKey = `${endpoint.name}-${metric.timestamp}`;

    // Check response time thresholds
    if (metric.responseTime > this.config.thresholds.responseTime.critical) {
      this.createAlert('critical', 'response_time', endpoint.name, 
        `Response time ${metric.responseTime.toFixed(2)}ms exceeds critical threshold`,
        metric.responseTime, this.config.thresholds.responseTime.critical);
    } else if (metric.responseTime > this.config.thresholds.responseTime.warning) {
      this.createAlert('warning', 'response_time', endpoint.name,
        `Response time ${metric.responseTime.toFixed(2)}ms exceeds warning threshold`,
        metric.responseTime, this.config.thresholds.responseTime.warning);
    }

    // Check for errors
    if (!metric.success && endpoint.critical) {
      this.createAlert('critical', 'availability', endpoint.name,
        `Endpoint is down: ${metric.errorMessage}`,
        0, 100);
    }

    // Calculate error rate over last 5 minutes
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => 
      m.endpoint === endpoint.name && m.timestamp >= fiveMinutesAgo
    );

    if (recentMetrics.length >= 5) { // Only check if we have enough data
      const errorRate = (recentMetrics.filter(m => !m.success).length / recentMetrics.length) * 100;
      
      if (errorRate > this.config.thresholds.errorRate.critical) {
        this.createAlert('critical', 'error_rate', endpoint.name,
          `Error rate ${errorRate.toFixed(2)}% exceeds critical threshold`,
          errorRate, this.config.thresholds.errorRate.critical);
      } else if (errorRate > this.config.thresholds.errorRate.warning) {
        this.createAlert('warning', 'error_rate', endpoint.name,
          `Error rate ${errorRate.toFixed(2)}% exceeds warning threshold`,
          errorRate, this.config.thresholds.errorRate.warning);
      }
    }
  }

  /**
   * Create and send alert
   */
  private createAlert(
    level: 'warning' | 'critical',
    type: 'response_time' | 'error_rate' | 'availability' | 'throughput',
    endpoint: string,
    message: string,
    value: number,
    threshold: number
  ): void {
    const alertKey = `${endpoint}-${type}`;
    const now = Date.now();
    const lastAlert = this.lastAlertTime.get(alertKey);

    // Check cooldown period
    if (lastAlert && (now - lastAlert) < this.config.alerting.cooldown) {
      return; // Skip alert due to cooldown
    }

    const alert: MonitoringAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: now,
      level,
      type,
      endpoint,
      message,
      value,
      threshold,
      resolved: false
    };

    this.alerts.push(alert);
    this.lastAlertTime.set(alertKey, now);

    console.log(`🚨 ${level.toUpperCase()} ALERT: ${message}`);

    // Send alert through configured channels
    if (this.config.alerting.enabled) {
      this.sendAlert(alert);
    }
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(alert: MonitoringAlert): Promise<void> {
    const enabledChannels = this.config.alerting.channels.filter(c => c.enabled);

    for (const channel of enabledChannels) {
      try {
        switch (channel.type) {
          case 'console':
            this.sendConsoleAlert(alert);
            break;
          case 'email':
            await this.sendEmailAlert(alert, channel.config);
            break;
          case 'slack':
            await this.sendSlackAlert(alert, channel.config);
            break;
          case 'webhook':
            await this.sendWebhookAlert(alert, channel.config);
            break;
        }
      } catch (error) {
        console.error(`Failed to send alert via ${channel.type}:`, error);
      }
    }
  }

  /**
   * Send console alert
   */
  private sendConsoleAlert(alert: MonitoringAlert): void {
    const icon = alert.level === 'critical' ? '🔴' : '🟡';
    console.log(`${icon} PERFORMANCE ALERT`);
    console.log(`Endpoint: ${alert.endpoint}`);
    console.log(`Type: ${alert.type}`);
    console.log(`Message: ${alert.message}`);
    console.log(`Time: ${new Date(alert.timestamp).toISOString()}`);
    console.log('---');
  }

  /**
   * Send email alert (placeholder)
   */
  private async sendEmailAlert(alert: MonitoringAlert, config: any): Promise<void> {
    // In a real implementation, this would integrate with an email service
    console.log(`📧 Email alert sent: ${alert.message}`);
  }

  /**
   * Send Slack alert (placeholder)
   */
  private async sendSlackAlert(alert: MonitoringAlert, config: any): Promise<void> {
    // In a real implementation, this would integrate with Slack API
    console.log(`💬 Slack alert sent: ${alert.message}`);
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: MonitoringAlert, config: any): Promise<void> {
    try {
      await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        body: JSON.stringify({
          alert,
          timestamp: new Date().toISOString(),
          service: 'performance-monitoring'
        })
      });
      console.log(`🔗 Webhook alert sent: ${alert.message}`);
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
    }
  }

  /**
   * Generate hourly report
   */
  private generateHourlyReport(): void {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const hourlyMetrics = this.metrics.filter(m => m.timestamp >= oneHourAgo);
    const hourlyAlerts = this.alerts.filter(a => a.timestamp >= oneHourAgo);

    if (hourlyMetrics.length === 0) {
      return; // No data to report
    }

    const report = this.generateReport(oneHourAgo, now, hourlyMetrics, hourlyAlerts);
    this.reports.push(report);

    console.log(`📊 Hourly Performance Report Generated`);
    console.log(`- Period: ${new Date(oneHourAgo).toISOString()} to ${new Date(now).toISOString()}`);
    console.log(`- Total Requests: ${report.summary.totalRequests}`);
    console.log(`- Success Rate: ${((report.summary.successfulRequests / report.summary.totalRequests) * 100).toFixed(2)}%`);
    console.log(`- Average Response Time: ${report.summary.averageResponseTime.toFixed(2)}ms`);
    console.log(`- Alerts: ${report.alerts.length}`);
  }

  /**
   * Generate performance report
   */
  private generateReport(
    startTime: number,
    endTime: number,
    metrics: PerformanceMetric[],
    alerts: MonitoringAlert[]
  ): MonitoringReport {
    const summary = this.calculateSummary(metrics);
    const endpointReports = this.generateEndpointReports(metrics);
    const trends = this.analyzeTrends(metrics);

    return {
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      period: { start: startTime, end: endTime },
      summary,
      endpoints: endpointReports,
      alerts,
      trends
    };
  }

  /**
   * Calculate summary metrics
   */
  private calculateSummary(metrics: PerformanceMetric[]): ReportSummary {
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        availability: 0,
        throughput: 0
      };
    }

    const successfulRequests = metrics.filter(m => m.success).length;
    const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b);
    
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    return {
      totalRequests: metrics.length,
      successfulRequests,
      averageResponseTime: responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length,
      p95ResponseTime: responseTimes[p95Index] || 0,
      p99ResponseTime: responseTimes[p99Index] || 0,
      errorRate: ((metrics.length - successfulRequests) / metrics.length) * 100,
      availability: (successfulRequests / metrics.length) * 100,
      throughput: metrics.length / ((metrics[metrics.length - 1]?.timestamp - metrics[0]?.timestamp) / 1000 || 1)
    };
  }

  /**
   * Generate endpoint-specific reports
   */
  private generateEndpointReports(metrics: PerformanceMetric[]): EndpointReport[] {
    const endpointGroups = new Map<string, PerformanceMetric[]>();
    
    metrics.forEach(metric => {
      if (!endpointGroups.has(metric.endpoint)) {
        endpointGroups.set(metric.endpoint, []);
      }
      endpointGroups.get(metric.endpoint)!.push(metric);
    });

    return Array.from(endpointGroups.entries()).map(([endpointName, endpointMetrics]) => {
      const summary = this.calculateSummary(endpointMetrics);
      const endpoint = this.config.endpoints.find(e => e.name === endpointName);
      
      let status: 'healthy' | 'degraded' | 'down' = 'healthy';
      if (summary.availability < 95) {
        status = 'down';
      } else if (summary.errorRate > 5 || summary.averageResponseTime > this.config.thresholds.responseTime.warning) {
        status = 'degraded';
      }

      return {
        name: endpointName,
        url: endpoint?.url || '',
        metrics: summary,
        status,
        incidents: this.alerts.filter(a => a.endpoint === endpointName).length
      };
    });
  }

  /**
   * Analyze performance trends
   */
  private analyzeTrends(metrics: PerformanceMetric[]): TrendAnalysis {
    // Simple trend analysis - in production, this would be more sophisticated
    const recommendations: string[] = [];
    
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
    const errorRate = (metrics.filter(m => !m.success).length / metrics.length) * 100;
    const availability = (metrics.filter(m => m.success).length / metrics.length) * 100;

    if (avgResponseTime > this.config.thresholds.responseTime.warning) {
      recommendations.push('Response times are elevated. Consider optimizing slow endpoints.');
    }
    
    if (errorRate > this.config.thresholds.errorRate.warning) {
      recommendations.push('Error rate is high. Investigate failing requests and improve error handling.');
    }
    
    if (availability < 99) {
      recommendations.push('Availability is below target. Review system reliability and implement redundancy.');
    }

    return {
      responseTimeTrend: 'stable', // Simplified
      errorRateTrend: 'stable',
      availabilityTrend: 'stable',
      recommendations
    };
  }

  /**
   * Clean up old data based on retention policy
   */
  private cleanupOldData(): void {
    const now = Date.now();
    
    // Clean up metrics
    const metricsRetentionTime = now - (this.config.retention.metrics * 24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp >= metricsRetentionTime);
    
    // Clean up alerts
    const alertsRetentionTime = now - (this.config.retention.alerts * 24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(a => a.timestamp >= alertsRetentionTime);
    
    // Clean up reports
    const reportsRetentionTime = now - (this.config.retention.reports * 24 * 60 * 60 * 1000);
    this.reports = this.reports.filter(r => r.timestamp >= reportsRetentionTime);
  }

  /**
   * Default configuration methods
   */
  private getDefaultEndpoints(): MonitoringEndpoint[] {
    return [
      {
        name: 'Dashboard API',
        url: 'http://localhost:3001/api/dashboard/batch',
        method: 'GET',
        timeout: 10000,
        critical: true
      },
      {
        name: 'User Preferences API',
        url: 'http://localhost:3001/api/user/preferences',
        method: 'GET',
        timeout: 5000,
        critical: false
      },
      {
        name: 'Radio Status API',
        url: 'http://localhost:3001/api/radio/status',
        method: 'GET',
        timeout: 5000,
        critical: false
      },
      {
        name: 'Frontend Health',
        url: 'http://localhost:5173',
        method: 'GET',
        timeout: 10000,
        critical: true
      }
    ];
  }

  private getDefaultThresholds(): MonitoringThresholds {
    return {
      responseTime: {
        warning: 2000,  // 2 seconds
        critical: 5000  // 5 seconds
      },
      errorRate: {
        warning: 5,     // 5%
        critical: 10    // 10%
      },
      availability: {
        warning: 99,    // 99%
        critical: 95    // 95%
      },
      throughput: {
        warning: 10,    // 10 req/s
        critical: 5     // 5 req/s
      }
    };
  }

  private getDefaultAlertingConfig(): AlertingConfig {
    return {
      enabled: true,
      cooldown: 5 * 60 * 1000, // 5 minutes
      channels: [
        {
          type: 'console',
          config: {},
          enabled: true
        }
      ],
      escalation: {
        enabled: false,
        levels: []
      }
    };
  }

  /**
   * Public methods
   */
  public getMetrics(endpointName?: string, since?: number): PerformanceMetric[] {
    let filteredMetrics = [...this.metrics];
    
    if (endpointName) {
      filteredMetrics = filteredMetrics.filter(m => m.endpoint === endpointName);
    }
    
    if (since) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp >= since);
    }
    
    return filteredMetrics;
  }

  public getAlerts(resolved?: boolean, since?: number): MonitoringAlert[] {
    let filteredAlerts = [...this.alerts];
    
    if (resolved !== undefined) {
      filteredAlerts = filteredAlerts.filter(a => a.resolved === resolved);
    }
    
    if (since) {
      filteredAlerts = filteredAlerts.filter(a => a.timestamp >= since);
    }
    
    return filteredAlerts;
  }

  public getReports(since?: number): MonitoringReport[] {
    let filteredReports = [...this.reports];
    
    if (since) {
      filteredReports = filteredReports.filter(r => r.timestamp >= since);
    }
    
    return filteredReports;
  }

  public getStatus(): {
    isRunning: boolean;
    uptime: number;
    metricsCount: number;
    alertsCount: number;
    reportsCount: number;
  } {
    return {
      isRunning: this.isRunning,
      uptime: this.isRunning ? Date.now() - (this.metrics[0]?.timestamp || Date.now()) : 0,
      metricsCount: this.metrics.length,
      alertsCount: this.alerts.length,
      reportsCount: this.reports.length
    };
  }

  public updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.isRunning) {
      console.log('Configuration updated. Restarting monitoring...');
      this.stop();
      this.start();
    }
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      console.log(`Alert resolved: ${alert.message}`);
      return true;
    }
    return false;
  }

  public exportData(): string {
    return JSON.stringify({
      config: this.config,
      metrics: this.metrics,
      alerts: this.alerts,
      reports: this.reports,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }
}

// Create singleton instance
export const continuousPerformanceMonitoring = new ContinuousPerformanceMonitoring();