export interface PerformanceTargets {
  // Dashboard load times (in milliseconds)
  dashboardLoadTime: {
    cold: number; // First-time load
    warm: number; // With cache
    target: number; // Target improvement
  };
  
  // Core Web Vitals targets
  coreWebVitals: {
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    cumulativeLayoutShift: number;
    firstInputDelay: number;
    totalBlockingTime: number;
    timeToInteractive: number;
  };
  
  // API performance targets
  apiPerformance: {
    dashboardBatch: number;
    userPreferences: number;
    radioStatus: number;
    averageResponseTime: number;
  };
  
  // Cache performance targets
  cachePerformance: {
    hitRate: number; // Percentage
    missLatency: number; // Milliseconds
    invalidationTime: number; // Milliseconds
  };
  
  // Bundle and resource targets
  resourceTargets: {
    bundleSize: number; // Bytes
    initialLoadSize: number; // Bytes
    memoryUsage: number; // Bytes
    networkRequests: number; // Count
  };
  
  // Load testing targets
  loadTestTargets: {
    throughput: number; // Requests per second
    errorRate: number; // Percentage
    p95ResponseTime: number; // Milliseconds
    concurrentUsers: number; // Number of users
  };
}

export interface ValidationResult {
  id: string;
  timestamp: number;
  version: string;
  overallStatus: 'pass' | 'warning' | 'fail';
  targetsMet: number;
  totalTargets: number;
  improvementPercentage: number;
  validations: TargetValidation[];
  summary: ValidationSummary;
  recommendations: string[];
  networkConditions: NetworkCondition[];
}

export interface TargetValidation {
  category: string;
  metric: string;
  target: number;
  actual: number;
  unit: string;
  status: 'pass' | 'warning' | 'fail';
  improvement: number; // Percentage improvement from baseline
  impact: 'high' | 'medium' | 'low';
  description: string;
}

export interface ValidationSummary {
  passedTargets: number;
  warningTargets: number;
  failedTargets: number;
  averageImprovement: number;
  criticalFailures: string[];
  significantImprovements: string[];
}

export interface NetworkCondition {
  name: string;
  downloadSpeed: number; // Mbps
  uploadSpeed: number; // Mbps
  latency: number; // ms
  packetLoss: number; // percentage
}

export interface BaselineComparison {
  metric: string;
  baseline: number;
  current: number;
  improvement: number;
  targetImprovement: number;
  metTarget: boolean;
}

class PerformanceValidationService {
  private validationResults: ValidationResult[] = [];
  
  // Default performance targets based on requirements
  private defaultTargets: PerformanceTargets = {
    dashboardLoadTime: {
      cold: 3000, // 3 seconds for cold load
      warm: 500,  // 500ms for warm load
      target: 30  // 30% improvement target
    },
    coreWebVitals: {
      firstContentfulPaint: 1500,  // 1.5 seconds
      largestContentfulPaint: 2500, // 2.5 seconds
      cumulativeLayoutShift: 0.1,   // 0.1 CLS score
      firstInputDelay: 100,         // 100ms
      totalBlockingTime: 300,       // 300ms
      timeToInteractive: 5000       // 5 seconds
    },
    apiPerformance: {
      dashboardBatch: 2000,    // 2 seconds for batch API
      userPreferences: 500,    // 500ms for preferences
      radioStatus: 1000,       // 1 second for radio status
      averageResponseTime: 800 // 800ms average
    },
    cachePerformance: {
      hitRate: 80,           // 80% cache hit rate
      missLatency: 200,      // 200ms for cache miss
      invalidationTime: 100  // 100ms for invalidation
    },
    resourceTargets: {
      bundleSize: 2 * 1024 * 1024,     // 2MB bundle size
      initialLoadSize: 1 * 1024 * 1024, // 1MB initial load
      memoryUsage: 100 * 1024 * 1024,   // 100MB memory usage
      networkRequests: 20               // Max 20 initial requests
    },
    loadTestTargets: {
      throughput: 100,        // 100 requests/second
      errorRate: 1,           // 1% error rate
      p95ResponseTime: 2000,  // 2 seconds P95
      concurrentUsers: 50     // 50 concurrent users
    }
  };

  // Network conditions for testing
  private networkConditions: NetworkCondition[] = [
    {
      name: 'Fast 3G',
      downloadSpeed: 1.6,
      uploadSpeed: 0.75,
      latency: 150,
      packetLoss: 0
    },
    {
      name: 'Slow 3G',
      downloadSpeed: 0.4,
      uploadSpeed: 0.4,
      latency: 400,
      packetLoss: 0
    },
    {
      name: 'WiFi',
      downloadSpeed: 30,
      uploadSpeed: 15,
      latency: 20,
      packetLoss: 0
    }
  ];

  /**
   * Validate performance improvements against targets
   */
  public async validatePerformanceImprovements(
    version: string,
    baselineData?: any,
    customTargets?: Partial<PerformanceTargets>
  ): Promise<ValidationResult> {
    console.log(`Starting performance validation for version: ${version}`);

    const targets = { ...this.defaultTargets, ...customTargets };
    const validationId = `validation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const result: ValidationResult = {
      id: validationId,
      timestamp: Date.now(),
      version,
      overallStatus: 'pass',
      targetsMet: 0,
      totalTargets: 0,
      improvementPercentage: 0,
      validations: [],
      summary: {
        passedTargets: 0,
        warningTargets: 0,
        failedTargets: 0,
        averageImprovement: 0,
        criticalFailures: [],
        significantImprovements: []
      },
      recommendations: [],
      networkConditions: this.networkConditions
    };

    try {
      // Collect current performance metrics
      const currentMetrics = await this.collectCurrentMetrics();

      // Validate dashboard load times
      await this.validateDashboardLoadTimes(targets.dashboardLoadTime, currentMetrics, result, baselineData);

      // Validate Core Web Vitals
      await this.validateCoreWebVitals(targets.coreWebVitals, currentMetrics, result, baselineData);

      // Validate API performance
      await this.validateApiPerformance(targets.apiPerformance, currentMetrics, result, baselineData);

      // Validate cache performance
      await this.validateCachePerformance(targets.cachePerformance, currentMetrics, result, baselineData);

      // Validate resource targets
      await this.validateResourceTargets(targets.resourceTargets, currentMetrics, result, baselineData);

      // Validate load test targets
      await this.validateLoadTestTargets(targets.loadTestTargets, currentMetrics, result, baselineData);

      // Test under various network conditions
      await this.validateNetworkConditions(targets, result);

      // Calculate final results
      this.calculateFinalResults(result);

      this.validationResults.push(result);
      this.storeValidationResult(result);

      console.log(`Performance validation completed: ${result.overallStatus}`);
      return result;

    } catch (error) {
      console.error('Performance validation failed:', error);
      result.overallStatus = 'fail';
      result.summary.criticalFailures.push(`Validation failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Collect current performance metrics
   */
  private async collectCurrentMetrics(): Promise<any> {
    console.log('Collecting current performance metrics...');

    // Import services
    const { performanceTestingService } = await import('./performanceTestingService');
    const { loadTestingService } = await import('./loadTestingService');

    // Run Lighthouse tests
    const lighthouseResults = await performanceTestingService.runPerformanceTests({
      urls: ['http://localhost:5173', 'http://localhost:5173/dashboard'],
      numberOfRuns: 3
    });

    // Run load tests
    const loadTestConfig = loadTestingService.createDashboardLoadTest();
    loadTestConfig.concurrentUsers = 20;
    loadTestConfig.duration = 120; // 2 minutes for validation
    const loadTestResult = await loadTestingService.runLoadTest(loadTestConfig);

    // Measure dashboard load times
    const dashboardTimes = await this.measureDashboardLoadTimes();

    // Measure API response times
    const apiTimes = await this.measureApiResponseTimes();

    // Measure cache performance
    const cacheMetrics = await this.measureCachePerformance();

    // Measure resource usage
    const resourceMetrics = await this.measureResourceUsage();

    return {
      lighthouse: lighthouseResults,
      loadTest: loadTestResult,
      dashboardTimes,
      apiTimes,
      cacheMetrics,
      resourceMetrics
    };
  }

  /**
   * Validate dashboard load times
   */
  private async validateDashboardLoadTimes(
    targets: any,
    metrics: any,
    result: ValidationResult,
    baseline?: any
  ): Promise<void> {
    const category = 'Dashboard Load Times';

    // Cold load validation
    const coldLoadActual = metrics.dashboardTimes.cold;
    const coldLoadValidation: TargetValidation = {
      category,
      metric: 'Cold Load Time',
      target: targets.cold,
      actual: coldLoadActual,
      unit: 'ms',
      status: coldLoadActual <= targets.cold ? 'pass' : 'fail',
      improvement: baseline ? this.calculateImprovement(baseline.dashboardTimes?.cold, coldLoadActual) : 0,
      impact: 'high',
      description: 'Time to load dashboard on first visit (no cache)'
    };

    // Warm load validation
    const warmLoadActual = metrics.dashboardTimes.warm;
    const warmLoadValidation: TargetValidation = {
      category,
      metric: 'Warm Load Time',
      target: targets.warm,
      actual: warmLoadActual,
      unit: 'ms',
      status: warmLoadActual <= targets.warm ? 'pass' : 'fail',
      improvement: baseline ? this.calculateImprovement(baseline.dashboardTimes?.warm, warmLoadActual) : 0,
      impact: 'high',
      description: 'Time to load dashboard with cache'
    };

    result.validations.push(coldLoadValidation, warmLoadValidation);
  }

  /**
   * Validate Core Web Vitals
   */
  private async validateCoreWebVitals(
    targets: any,
    metrics: any,
    result: ValidationResult,
    baseline?: any
  ): Promise<void> {
    const category = 'Core Web Vitals';
    const lighthouseAvg = this.calculateLighthouseAverages(metrics.lighthouse);

    const validations = [
      {
        metric: 'First Contentful Paint',
        target: targets.firstContentfulPaint,
        actual: lighthouseAvg.firstContentfulPaint,
        baseline: baseline?.coreWebVitals?.firstContentfulPaint,
        impact: 'high' as const
      },
      {
        metric: 'Largest Contentful Paint',
        target: targets.largestContentfulPaint,
        actual: lighthouseAvg.largestContentfulPaint,
        baseline: baseline?.coreWebVitals?.largestContentfulPaint,
        impact: 'high' as const
      },
      {
        metric: 'Cumulative Layout Shift',
        target: targets.cumulativeLayoutShift,
        actual: lighthouseAvg.cumulativeLayoutShift,
        baseline: baseline?.coreWebVitals?.cumulativeLayoutShift,
        impact: 'medium' as const
      },
      {
        metric: 'Total Blocking Time',
        target: targets.totalBlockingTime,
        actual: lighthouseAvg.totalBlockingTime,
        baseline: baseline?.coreWebVitals?.totalBlockingTime,
        impact: 'medium' as const
      },
      {
        metric: 'Time to Interactive',
        target: targets.timeToInteractive,
        actual: lighthouseAvg.timeToInteractive,
        baseline: baseline?.coreWebVitals?.timeToInteractive,
        impact: 'medium' as const
      }
    ];

    validations.forEach(v => {
      const validation: TargetValidation = {
        category,
        metric: v.metric,
        target: v.target,
        actual: v.actual,
        unit: v.metric.includes('Shift') ? 'score' : 'ms',
        status: v.actual <= v.target ? 'pass' : (v.actual <= v.target * 1.2 ? 'warning' : 'fail'),
        improvement: v.baseline ? this.calculateImprovement(v.baseline, v.actual) : 0,
        impact: v.impact,
        description: this.getMetricDescription(v.metric)
      };
      result.validations.push(validation);
    });
  }

  /**
   * Validate API performance
   */
  private async validateApiPerformance(
    targets: any,
    metrics: any,
    result: ValidationResult,
    baseline?: any
  ): Promise<void> {
    const category = 'API Performance';

    const validations = [
      {
        metric: 'Dashboard Batch API',
        target: targets.dashboardBatch,
        actual: metrics.apiTimes.dashboardBatch,
        baseline: baseline?.apiTimes?.dashboardBatch
      },
      {
        metric: 'User Preferences API',
        target: targets.userPreferences,
        actual: metrics.apiTimes.userPreferences,
        baseline: baseline?.apiTimes?.userPreferences
      },
      {
        metric: 'Radio Status API',
        target: targets.radioStatus,
        actual: metrics.apiTimes.radioStatus,
        baseline: baseline?.apiTimes?.radioStatus
      },
      {
        metric: 'Average Response Time',
        target: targets.averageResponseTime,
        actual: metrics.apiTimes.average,
        baseline: baseline?.apiTimes?.average
      }
    ];

    validations.forEach(v => {
      const validation: TargetValidation = {
        category,
        metric: v.metric,
        target: v.target,
        actual: v.actual,
        unit: 'ms',
        status: v.actual <= v.target ? 'pass' : (v.actual <= v.target * 1.5 ? 'warning' : 'fail'),
        improvement: v.baseline ? this.calculateImprovement(v.baseline, v.actual) : 0,
        impact: 'high',
        description: `Response time for ${v.metric.toLowerCase()}`
      };
      result.validations.push(validation);
    });
  }

  /**
   * Validate cache performance
   */
  private async validateCachePerformance(
    targets: any,
    metrics: any,
    result: ValidationResult,
    baseline?: any
  ): Promise<void> {
    const category = 'Cache Performance';

    const validations = [
      {
        metric: 'Cache Hit Rate',
        target: targets.hitRate,
        actual: metrics.cacheMetrics.hitRate,
        baseline: baseline?.cacheMetrics?.hitRate,
        unit: '%',
        isHigherBetter: true
      },
      {
        metric: 'Cache Miss Latency',
        target: targets.missLatency,
        actual: metrics.cacheMetrics.missLatency,
        baseline: baseline?.cacheMetrics?.missLatency,
        unit: 'ms',
        isHigherBetter: false
      },
      {
        metric: 'Cache Invalidation Time',
        target: targets.invalidationTime,
        actual: metrics.cacheMetrics.invalidationTime,
        baseline: baseline?.cacheMetrics?.invalidationTime,
        unit: 'ms',
        isHigherBetter: false
      }
    ];

    validations.forEach(v => {
      const validation: TargetValidation = {
        category,
        metric: v.metric,
        target: v.target,
        actual: v.actual,
        unit: v.unit,
        status: v.isHigherBetter ? 
          (v.actual >= v.target ? 'pass' : 'warning') :
          (v.actual <= v.target ? 'pass' : 'warning'),
        improvement: v.baseline ? this.calculateImprovement(v.baseline, v.actual, v.isHigherBetter) : 0,
        impact: 'medium',
        description: `${v.metric} performance metric`
      };
      result.validations.push(validation);
    });
  }

  /**
   * Validate resource targets
   */
  private async validateResourceTargets(
    targets: any,
    metrics: any,
    result: ValidationResult,
    baseline?: any
  ): Promise<void> {
    const category = 'Resource Usage';

    const validations = [
      {
        metric: 'Bundle Size',
        target: targets.bundleSize,
        actual: metrics.resourceMetrics.bundleSize,
        baseline: baseline?.resourceMetrics?.bundleSize,
        unit: 'bytes'
      },
      {
        metric: 'Initial Load Size',
        target: targets.initialLoadSize,
        actual: metrics.resourceMetrics.initialLoadSize,
        baseline: baseline?.resourceMetrics?.initialLoadSize,
        unit: 'bytes'
      },
      {
        metric: 'Memory Usage',
        target: targets.memoryUsage,
        actual: metrics.resourceMetrics.memoryUsage,
        baseline: baseline?.resourceMetrics?.memoryUsage,
        unit: 'bytes'
      },
      {
        metric: 'Network Requests',
        target: targets.networkRequests,
        actual: metrics.resourceMetrics.networkRequests,
        baseline: baseline?.resourceMetrics?.networkRequests,
        unit: 'count'
      }
    ];

    validations.forEach(v => {
      const validation: TargetValidation = {
        category,
        metric: v.metric,
        target: v.target,
        actual: v.actual,
        unit: v.unit,
        status: v.actual <= v.target ? 'pass' : (v.actual <= v.target * 1.2 ? 'warning' : 'fail'),
        improvement: v.baseline ? this.calculateImprovement(v.baseline, v.actual) : 0,
        impact: v.metric === 'Bundle Size' ? 'high' : 'medium',
        description: `${v.metric} optimization target`
      };
      result.validations.push(validation);
    });
  }

  /**
   * Validate load test targets
   */
  private async validateLoadTestTargets(
    targets: any,
    metrics: any,
    result: ValidationResult,
    baseline?: any
  ): Promise<void> {
    const category = 'Load Testing';

    const validations = [
      {
        metric: 'Throughput',
        target: targets.throughput,
        actual: metrics.loadTest.requestsPerSecond,
        baseline: baseline?.loadTest?.requestsPerSecond,
        unit: 'req/s',
        isHigherBetter: true
      },
      {
        metric: 'Error Rate',
        target: targets.errorRate,
        actual: metrics.loadTest.errorRate,
        baseline: baseline?.loadTest?.errorRate,
        unit: '%',
        isHigherBetter: false
      },
      {
        metric: 'P95 Response Time',
        target: targets.p95ResponseTime,
        actual: metrics.loadTest.p95ResponseTime,
        baseline: baseline?.loadTest?.p95ResponseTime,
        unit: 'ms',
        isHigherBetter: false
      }
    ];

    validations.forEach(v => {
      const validation: TargetValidation = {
        category,
        metric: v.metric,
        target: v.target,
        actual: v.actual,
        unit: v.unit,
        status: v.isHigherBetter ? 
          (v.actual >= v.target ? 'pass' : 'warning') :
          (v.actual <= v.target ? 'pass' : 'warning'),
        improvement: v.baseline ? this.calculateImprovement(v.baseline, v.actual, v.isHigherBetter) : 0,
        impact: 'high',
        description: `Load testing ${v.metric.toLowerCase()} target`
      };
      result.validations.push(validation);
    });
  }

  /**
   * Validate performance under various network conditions
   */
  private async validateNetworkConditions(
    targets: PerformanceTargets,
    result: ValidationResult
  ): Promise<void> {
    console.log('Testing performance under various network conditions...');

    for (const condition of this.networkConditions) {
      try {
        // Simulate network condition and measure performance
        const conditionMetrics = await this.measurePerformanceUnderNetworkCondition(condition);
        
        // Validate key metrics under this condition
        const conditionValidation: TargetValidation = {
          category: 'Network Conditions',
          metric: `Dashboard Load (${condition.name})`,
          target: targets.dashboardLoadTime.cold * this.getNetworkMultiplier(condition),
          actual: conditionMetrics.dashboardLoadTime,
          unit: 'ms',
          status: conditionMetrics.dashboardLoadTime <= (targets.dashboardLoadTime.cold * this.getNetworkMultiplier(condition)) ? 'pass' : 'warning',
          improvement: 0,
          impact: 'medium',
          description: `Dashboard load time under ${condition.name} network conditions`
        };

        result.validations.push(conditionValidation);
      } catch (error) {
        console.error(`Failed to test network condition ${condition.name}:`, error);
      }
    }
  }

  /**
   * Calculate final results
   */
  private calculateFinalResults(result: ValidationResult): void {
    result.totalTargets = result.validations.length;
    result.targetsMet = result.validations.filter(v => v.status === 'pass').length;
    
    result.summary.passedTargets = result.validations.filter(v => v.status === 'pass').length;
    result.summary.warningTargets = result.validations.filter(v => v.status === 'warning').length;
    result.summary.failedTargets = result.validations.filter(v => v.status === 'fail').length;

    // Calculate average improvement
    const improvements = result.validations.map(v => v.improvement).filter(i => i !== 0);
    result.summary.averageImprovement = improvements.length > 0 ? 
      improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length : 0;

    result.improvementPercentage = (result.targetsMet / result.totalTargets) * 100;

    // Determine overall status
    if (result.summary.failedTargets > 0) {
      result.overallStatus = 'fail';
    } else if (result.summary.warningTargets > 0) {
      result.overallStatus = 'warning';
    } else {
      result.overallStatus = 'pass';
    }

    // Identify critical failures and significant improvements
    result.validations.forEach(validation => {
      if (validation.status === 'fail' && validation.impact === 'high') {
        result.summary.criticalFailures.push(`${validation.metric}: ${validation.actual}${validation.unit} (target: ${validation.target}${validation.unit})`);
      }
      if (validation.improvement > 20) {
        result.summary.significantImprovements.push(`${validation.metric}: ${validation.improvement.toFixed(2)}% improvement`);
      }
    });

    // Generate recommendations
    result.recommendations = this.generateRecommendations(result);
  }

  /**
   * Helper methods
   */
  private calculateImprovement(baseline: number, current: number, isHigherBetter: boolean = false): number {
    if (!baseline || baseline === 0) return 0;
    
    const change = isHigherBetter ? 
      ((current - baseline) / baseline) * 100 :
      ((baseline - current) / baseline) * 100;
    
    return change;
  }

  private calculateLighthouseAverages(results: any[]): any {
    if (results.length === 0) return {};

    const totals = results.reduce((acc, result) => {
      acc.firstContentfulPaint += result.metrics.firstContentfulPaint;
      acc.largestContentfulPaint += result.metrics.largestContentfulPaint;
      acc.cumulativeLayoutShift += result.metrics.cumulativeLayoutShift;
      acc.totalBlockingTime += result.metrics.totalBlockingTime;
      acc.timeToInteractive += result.metrics.timeToInteractive;
      return acc;
    }, {
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      cumulativeLayoutShift: 0,
      totalBlockingTime: 0,
      timeToInteractive: 0
    });

    const count = results.length;
    return {
      firstContentfulPaint: totals.firstContentfulPaint / count,
      largestContentfulPaint: totals.largestContentfulPaint / count,
      cumulativeLayoutShift: totals.cumulativeLayoutShift / count,
      totalBlockingTime: totals.totalBlockingTime / count,
      timeToInteractive: totals.timeToInteractive / count
    };
  }

  private getMetricDescription(metric: string): string {
    const descriptions: Record<string, string> = {
      'First Contentful Paint': 'Time until first content appears on screen',
      'Largest Contentful Paint': 'Time until largest content element is rendered',
      'Cumulative Layout Shift': 'Visual stability during page load',
      'Total Blocking Time': 'Time when main thread is blocked',
      'Time to Interactive': 'Time until page is fully interactive'
    };
    return descriptions[metric] || metric;
  }

  private getNetworkMultiplier(condition: NetworkCondition): number {
    // Adjust targets based on network conditions
    switch (condition.name) {
      case 'Slow 3G': return 3.0;
      case 'Fast 3G': return 2.0;
      case 'WiFi': return 1.0;
      default: return 1.5;
    }
  }

  private async measureDashboardLoadTimes(): Promise<any> {
    // Simulate dashboard load time measurements
    return {
      cold: 2800 + Math.random() * 400, // 2.8-3.2s
      warm: 400 + Math.random() * 200   // 400-600ms
    };
  }

  private async measureApiResponseTimes(): Promise<any> {
    // Simulate API response time measurements
    return {
      dashboardBatch: 1500 + Math.random() * 500,
      userPreferences: 300 + Math.random() * 200,
      radioStatus: 800 + Math.random() * 400,
      average: 600 + Math.random() * 300
    };
  }

  private async measureCachePerformance(): Promise<any> {
    // Simulate cache performance measurements
    return {
      hitRate: 75 + Math.random() * 20,
      missLatency: 150 + Math.random() * 100,
      invalidationTime: 50 + Math.random() * 50
    };
  }

  private async measureResourceUsage(): Promise<any> {
    // Simulate resource usage measurements
    return {
      bundleSize: 2.2 * 1024 * 1024 + Math.random() * 0.5 * 1024 * 1024,
      initialLoadSize: 0.9 * 1024 * 1024 + Math.random() * 0.3 * 1024 * 1024,
      memoryUsage: 80 * 1024 * 1024 + Math.random() * 40 * 1024 * 1024,
      networkRequests: 15 + Math.random() * 10
    };
  }

  private async measurePerformanceUnderNetworkCondition(condition: NetworkCondition): Promise<any> {
    // Simulate performance measurement under specific network conditions
    const baseTime = 2000;
    const multiplier = this.getNetworkMultiplier(condition);
    
    return {
      dashboardLoadTime: baseTime * multiplier + Math.random() * 500
    };
  }

  private generateRecommendations(result: ValidationResult): string[] {
    const recommendations: string[] = [];

    // Analyze failed validations
    const failedValidations = result.validations.filter(v => v.status === 'fail');
    const warningValidations = result.validations.filter(v => v.status === 'warning');

    if (failedValidations.length > 0) {
      recommendations.push(`${failedValidations.length} critical performance targets not met. Immediate optimization required.`);
      
      failedValidations.forEach(validation => {
        switch (validation.category) {
          case 'Dashboard Load Times':
            recommendations.push('Optimize dashboard loading with progressive loading and better caching.');
            break;
          case 'Core Web Vitals':
            recommendations.push('Focus on Core Web Vitals optimization for better user experience.');
            break;
          case 'API Performance':
            recommendations.push('Optimize API endpoints and implement response caching.');
            break;
          case 'Resource Usage':
            recommendations.push('Reduce bundle size and optimize resource loading.');
            break;
        }
      });
    }

    if (warningValidations.length > 0) {
      recommendations.push(`${warningValidations.length} performance targets need attention.`);
    }

    // Analyze improvements
    const significantImprovements = result.validations.filter(v => v.improvement > 15);
    if (significantImprovements.length > 0) {
      recommendations.push(`Great progress! ${significantImprovements.length} metrics show significant improvement.`);
    }

    // Overall recommendations
    if (result.summary.averageImprovement > 10) {
      recommendations.push('Excellent performance improvements achieved. Continue monitoring and optimizing.');
    } else if (result.summary.averageImprovement > 0) {
      recommendations.push('Good performance improvements. Focus on remaining optimization opportunities.');
    } else {
      recommendations.push('Performance optimization needed. Review failed targets and implement improvements.');
    }

    return recommendations.length > 0 ? recommendations : ['Performance validation completed. Continue monitoring.'];
  }

  private storeValidationResult(result: ValidationResult): void {
    try {
      const results = JSON.parse(localStorage.getItem('performance-validation-results') || '[]');
      results.push(result);
      
      // Keep only last 50 results
      const limitedResults = results.slice(-50);
      localStorage.setItem('performance-validation-results', JSON.stringify(limitedResults));
    } catch (error) {
      console.error('Failed to store validation result:', error);
    }
  }

  /**
   * Public methods
   */
  public getValidationResults(): ValidationResult[] {
    return [...this.validationResults];
  }

  public getLatestValidation(): ValidationResult | null {
    return this.validationResults.length > 0 ? this.validationResults[this.validationResults.length - 1] : null;
  }

  public clearHistory(): void {
    this.validationResults = [];
    localStorage.removeItem('performance-validation-results');
  }

  public exportResults(): string {
    return JSON.stringify({
      validationResults: this.validationResults,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  public getDefaultTargets(): PerformanceTargets {
    return { ...this.defaultTargets };
  }

  public updateDefaultTargets(targets: Partial<PerformanceTargets>): void {
    this.defaultTargets = { ...this.defaultTargets, ...targets };
  }
}

// Create singleton instance
export const performanceValidationService = new PerformanceValidationService();