interface ErrorReport {
  id: string;
  timestamp: number;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  context: {
    sectionId?: string;
    priority?: string;
    userId?: string;
    userAgent: string;
    url: string;
    retryCount?: number;
  };
  metadata?: Record<string, any>;
}

interface ErrorReportingConfig {
  enabled: boolean;
  maxReports: number;
  reportingEndpoint?: string;
  enableConsoleLogging: boolean;
  enableLocalStorage: boolean;
  sensitiveDataKeys: string[];
}

const DEFAULT_CONFIG: ErrorReportingConfig = {
  enabled: true,
  maxReports: 100,
  enableConsoleLogging: true,
  enableLocalStorage: true,
  sensitiveDataKeys: ['password', 'token', 'key', 'secret', 'auth']
};

export class ErrorReportingService {
  private static instance: ErrorReportingService;
  private config: ErrorReportingConfig;
  private reports: ErrorReport[] = [];
  private reportQueue: ErrorReport[] = [];
  private isProcessingQueue = false;

  private constructor(config: Partial<ErrorReportingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadStoredReports();
  }

  static getInstance(config?: Partial<ErrorReportingConfig>): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService(config);
    }
    return ErrorReportingService.instance;
  }

  private generateId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = Array.isArray(data) ? [] : {};
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = this.config.sensitiveDataKeys.some(sensitiveKey => 
        lowerKey.includes(sensitiveKey.toLowerCase())
      );

      if (isSensitive) {
        (sanitized as any)[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        (sanitized as any)[key] = this.sanitizeData(value);
      } else {
        (sanitized as any)[key] = value;
      }
    }

    return sanitized;
  }

  private loadStoredReports(): void {
    if (!this.config.enableLocalStorage) return;

    try {
      const stored = localStorage.getItem('error_reports');
      if (stored) {
        this.reports = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load stored error reports:', error);
    }
  }

  private saveReports(): void {
    if (!this.config.enableLocalStorage) return;

    try {
      // Keep only the most recent reports
      const reportsToSave = this.reports.slice(-this.config.maxReports);
      localStorage.setItem('error_reports', JSON.stringify(reportsToSave));
    } catch (error) {
      console.warn('Failed to save error reports:', error);
    }
  }

  private async processReportQueue(): Promise<void> {
    if (this.isProcessingQueue || this.reportQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.reportQueue.length > 0) {
        const report = this.reportQueue.shift()!;
        
        if (this.config.reportingEndpoint) {
          try {
            await fetch(this.config.reportingEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(report)
            });
          } catch (error) {
            console.warn('Failed to send error report to endpoint:', error);
            // Put the report back in the queue for retry
            this.reportQueue.unshift(report);
            break;
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  reportError(
    error: Error,
    context: {
      sectionId?: string;
      priority?: string;
      userId?: string;
      retryCount?: number;
    } = {},
    metadata: Record<string, any> = {}
  ): string {
    if (!this.config.enabled) {
      return '';
    }

    const report: ErrorReport = {
      id: this.generateId(),
      timestamp: Date.now(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context: {
        ...context,
        userAgent: navigator.userAgent,
        url: window.location.href
      },
      metadata: this.sanitizeData(metadata)
    };

    // Add to reports array
    this.reports.push(report);
    
    // Maintain max reports limit
    if (this.reports.length > this.config.maxReports) {
      this.reports = this.reports.slice(-this.config.maxReports);
    }

    // Console logging
    if (this.config.enableConsoleLogging) {
      console.group(`🚨 Error Report: ${report.id}`);
      console.error('Error:', error);
      console.log('Context:', report.context);
      console.log('Metadata:', report.metadata);
      console.groupEnd();
    }

    // Save to localStorage
    this.saveReports();

    // Queue for remote reporting
    if (this.config.reportingEndpoint) {
      this.reportQueue.push(report);
      this.processReportQueue();
    }

    return report.id;
  }

  reportRetryFailure(
    error: Error,
    sectionId: string,
    retryCount: number,
    metadata: Record<string, any> = {}
  ): string {
    return this.reportError(error, {
      sectionId,
      retryCount,
      priority: 'retry_failure'
    }, {
      ...metadata,
      type: 'retry_failure',
      maxRetriesReached: true
    });
  }

  reportPerformanceIssue(
    operation: string,
    duration: number,
    threshold: number,
    metadata: Record<string, any> = {}
  ): string {
    const error = new Error(`Performance issue: ${operation} took ${duration}ms (threshold: ${threshold}ms)`);
    error.name = 'PerformanceError';

    return this.reportError(error, {
      priority: 'performance'
    }, {
      ...metadata,
      type: 'performance_issue',
      operation,
      duration,
      threshold
    });
  }

  getReports(filters?: {
    sectionId?: string;
    priority?: string;
    since?: number;
    limit?: number;
  }): ErrorReport[] {
    let filteredReports = [...this.reports];

    if (filters) {
      if (filters.sectionId) {
        filteredReports = filteredReports.filter(r => r.context.sectionId === filters.sectionId);
      }
      
      if (filters.priority) {
        filteredReports = filteredReports.filter(r => r.context.priority === filters.priority);
      }
      
      if (filters.since) {
        filteredReports = filteredReports.filter(r => r.timestamp >= filters.since!);
      }
      
      if (filters.limit) {
        filteredReports = filteredReports.slice(-filters.limit);
      }
    }

    return filteredReports.sort((a, b) => b.timestamp - a.timestamp);
  }

  getErrorStats(): {
    totalErrors: number;
    errorsBySection: Record<string, number>;
    errorsByPriority: Record<string, number>;
    recentErrors: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const errorsBySection: Record<string, number> = {};
    const errorsByPriority: Record<string, number> = {};
    let recentErrors = 0;

    this.reports.forEach(report => {
      if (report.timestamp >= oneHourAgo) {
        recentErrors++;
      }

      const section = report.context.sectionId || 'unknown';
      const priority = report.context.priority || 'unknown';

      errorsBySection[section] = (errorsBySection[section] || 0) + 1;
      errorsByPriority[priority] = (errorsByPriority[priority] || 0) + 1;
    });

    return {
      totalErrors: this.reports.length,
      errorsBySection,
      errorsByPriority,
      recentErrors
    };
  }

  clearReports(): void {
    this.reports = [];
    this.saveReports();
  }

  exportReports(): string {
    return JSON.stringify(this.reports, null, 2);
  }

  updateConfig(newConfig: Partial<ErrorReportingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// React hook for error reporting
export const useErrorReporting = () => {
  const errorReporting = React.useMemo(() => ErrorReportingService.getInstance(), []);

  const reportError = React.useCallback((
    error: Error,
    context?: {
      sectionId?: string;
      priority?: string;
      retryCount?: number;
    },
    metadata?: Record<string, any>
  ) => {
    return errorReporting.reportError(error, context, metadata);
  }, [errorReporting]);

  const reportRetryFailure = React.useCallback((
    error: Error,
    sectionId: string,
    retryCount: number,
    metadata?: Record<string, any>
  ) => {
    return errorReporting.reportRetryFailure(error, sectionId, retryCount, metadata);
  }, [errorReporting]);

  const reportPerformanceIssue = React.useCallback((
    operation: string,
    duration: number,
    threshold: number,
    metadata?: Record<string, any>
  ) => {
    return errorReporting.reportPerformanceIssue(operation, duration, threshold, metadata);
  }, [errorReporting]);

  const getReports = React.useCallback((filters?: any) => {
    return errorReporting.getReports(filters);
  }, [errorReporting]);

  const getErrorStats = React.useCallback(() => {
    return errorReporting.getErrorStats();
  }, [errorReporting]);

  return {
    reportError,
    reportRetryFailure,
    reportPerformanceIssue,
    getReports,
    getErrorStats,
    clearReports: errorReporting.clearReports.bind(errorReporting),
    exportReports: errorReporting.exportReports.bind(errorReporting)
  };
};

export default ErrorReportingService;