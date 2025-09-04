export interface PerformanceBaseline {
  id: string;
  name: string;
  version: string;
  timestamp: number;
  metrics: BaselineMetrics;
  environment: TestEnvironment;
  testConfig: RegressionTestConfig;
}

export interface BaselineMetrics {
  // Lighthouse scores
  performanceScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
  
  // Core Web Vitals
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  totalBlockingTime: number;
  timeToInteractive: number;
  
  // Custom metrics
  dashboardLoadTime: number;
  apiResponseTime: number;
  bundleSize: number;
  memoryUsage: number;
  
  // Load test metrics
  throughput: number;
  errorRate: number;
  p95ResponseTime: number;
}

export interface TestEnvironment {
  browser: string;
  browserVersion: string;
  device: 'desktop' | 'mobile';
  networkCondition: string;
  cpuThrottling: number;
  memoryLimit: number;
}

export interface RegressionTestConfig {
  urls: string[];
  thresholds: PerformanceThresholds;
  testDuration: number;
  concurrentUsers: number;
  iterations: number;
}

export interface PerformanceThresholds {
  // Regression thresholds (percentage increase that triggers alert)
  performanceScore: number; // e.g., 10% decrease
  firstContentfulPaint: number; // e.g., 20% increase
  largestContentfulPaint: number; // e.g., 15% increase
  cumulativeLayoutShift: number; // e.g., 50% increase
  totalBlockingTime: number; // e.g., 25% increase
  dashboardLoadTime: number; // e.g., 30% increase
  bundleSize: number; // e.g., 10% increase
  memoryUsage: number; // e.g., 20% increase
  throughput: number; // e.g., 15% decrease
  errorRate: number; // e.g., 5% increase
}

export interface RegressionTestResult {
  id: string;
  baselineId: string;
  timestamp: number;
  version: string;
  currentMetrics: BaselineMetrics;
  baselineMetrics: BaselineMetrics;
  regressions: RegressionDetection[];
  improvements: ImprovementDetection[];
  overallStatus: 'pass' | 'warning' | 'fail';
  summary: RegressionSummary;
}

export interface RegressionDetection {
  metric: string;
  baseline: number;
  current: number;
  change: number; // percentage change
  threshold: number;
  severity: 'warning' | 'critical';
  impact: string;
}

export interface ImprovementDetection {
  metric: string;
  baseline: number;
  current: number;
  improvement: number; // percentage improvement
  impact: string;
}

export interface RegressionSummary {
  totalRegressions: number;
  criticalRegressions: number;
  warningRegressions: number;
  totalImprovements: number;
  overallPerformanceChange: number;
  recommendation: string;
}

class PerformanceRegressionService {
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private testResults: RegressionTestResult[] = [];
  private defaultThresholds: PerformanceThresholds = {
    performanceScore: 10, // 10% decrease triggers warning
    firstContentfulPaint: 20, // 20% increase triggers warning
    largestContentfulPaint: 15, // 15% increase triggers warning
    cumulativeLayoutShift: 50, // 50% increase triggers warning
    totalBlockingTime: 25, // 25% increase triggers warning
    dashboardLoadTime: 30, // 30% increase triggers warning
    bundleSize: 10, // 10% increase triggers warning
    memoryUsage: 20, // 20% increase triggers warning
    throughput: 15, // 15% decrease triggers warning
    errorRate: 5 // 5% increase triggers warning
  };

  /**
   * Create performance baseline
   */
  public async createBaseline(
    name: string,
    version: string,
    config?: Partial<RegressionTestConfig>
  ): Promise<PerformanceBaseline> {
    console.log(`Creating performance baseline: ${name} v${version}`);

    const testConfig: RegressionTestConfig = {
      urls: ['http://localhost:5173', 'http://localhost:5173/dashboard'],
      thresholds: this.defaultThresholds,
      testDuration: 300, // 5 minutes
      concurrentUsers: 20,
      iterations: 3,
      ...config
    };

    const environment: TestEnvironment = {
      browser: this.getBrowserInfo().name,
      browserVersion: this.getBrowserInfo().version,
      device: 'desktop',
      networkCondition: 'fast-3g',
      cpuThrottling: 1,
      memoryLimit: 4096
    };

    // Run comprehensive performance tests
    const metrics = await this.collectBaselineMetrics(testConfig);

    const baseline: PerformanceBaseline = {
      id: `baseline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      version,
      timestamp: Date.now(),
      metrics,
      environment,
      testConfig
    };

    this.baselines.set(baseline.id, baseline);
    this.storeBaseline(baseline);

    console.log(`Baseline created: ${baseline.id}`, {
      performanceScore: metrics.performanceScore,
      dashboardLoadTime: metrics.dashboardLoadTime,
      bundleSize: metrics.bundleSize
    });

    return baseline;
  }

  /**
   * Run regression test against baseline
   */
  public async runRegressionTest(
    baselineId: string,
    currentVersion: string
  ): Promise<RegressionTestResult> {
    const baseline = this.baselines.get(baselineId);
    if (!baseline) {
      throw new Error(`Baseline not found: ${baselineId}`);
    }

    console.log(`Running regression test against baseline: ${baseline.name} v${baseline.version}`);

    // Collect current metrics using same configuration
    const currentMetrics = await this.collectBaselineMetrics(baseline.testConfig);

    // Detect regressions and improvements
    const regressions = this.detectRegressions(baseline.metrics, currentMetrics, baseline.testConfig.thresholds);
    const improvements = this.detectImprovements(baseline.metrics, currentMetrics);

    // Determine overall status
    const overallStatus = this.determineOverallStatus(regressions);

    // Generate summary
    const summary = this.generateRegressionSummary(regressions, improvements, baseline.metrics, currentMetrics);

    const result: RegressionTestResult = {
      id: `regression-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      baselineId,
      timestamp: Date.now(),
      version: currentVersion,
      currentMetrics,
      baselineMetrics: baseline.metrics,
      regressions,
      improvements,
      overallStatus,
      summary
    };

    this.testResults.push(result);
    this.storeRegressionResult(result);

    console.log(`Regression test completed:`, {
      status: result.overallStatus,
      regressions: result.regressions.length,
      improvements: result.improvements.length
    });

    return result;
  }

  /**
   * Collect baseline metrics
   */
  private async collectBaselineMetrics(config: RegressionTestConfig): Promise<BaselineMetrics> {
    console.log('Collecting baseline metrics...');

    // Import services
    const { performanceTestingService } = await import('./performanceTestingService');
    const { loadTestingService } = await import('./loadTestingService');

    // Run Lighthouse tests
    const lighthouseResults = await performanceTestingService.runPerformanceTests({
      urls: config.urls,
      numberOfRuns: config.iterations
    });

    // Calculate average Lighthouse metrics
    const avgLighthouse = this.calculateAverageLighthouseMetrics(lighthouseResults);

    // Run load tests
    const loadTestConfig = loadTestingService.createDashboardLoadTest();
    loadTestConfig.concurrentUsers = config.concurrentUsers;
    loadTestConfig.duration = config.testDuration;
    
    const loadTestResult = await loadTestingService.runLoadTest(loadTestConfig);

    // Collect bundle size
    const bundleSize = await this.getBundleSize();

    // Collect memory usage
    const memoryUsage = this.getMemoryUsage();

    // Collect dashboard load time
    const dashboardLoadTime = await this.measureDashboardLoadTime();

    // Collect API response time
    const apiResponseTime = await this.measureApiResponseTime();

    return {
      // Lighthouse scores
      performanceScore: avgLighthouse.performanceScore,
      accessibilityScore: avgLighthouse.accessibilityScore,
      bestPracticesScore: avgLighthouse.bestPracticesScore,
      seoScore: avgLighthouse.seoScore,
      
      // Core Web Vitals
      firstContentfulPaint: avgLighthouse.firstContentfulPaint,
      largestContentfulPaint: avgLighthouse.largestContentfulPaint,
      cumulativeLayoutShift: avgLighthouse.cumulativeLayoutShift,
      firstInputDelay: avgLighthouse.firstInputDelay,
      totalBlockingTime: avgLighthouse.totalBlockingTime,
      timeToInteractive: avgLighthouse.timeToInteractive,
      
      // Custom metrics
      dashboardLoadTime,
      apiResponseTime,
      bundleSize,
      memoryUsage,
      
      // Load test metrics
      throughput: loadTestResult.requestsPerSecond,
      errorRate: loadTestResult.errorRate,
      p95ResponseTime: loadTestResult.p95ResponseTime
    };
  }

  /**
   * Calculate average Lighthouse metrics
   */
  private calculateAverageLighthouseMetrics(results: any[]): any {
    if (results.length === 0) {
      throw new Error('No Lighthouse results available');
    }

    const totals = results.reduce((acc, result) => {
      acc.performanceScore += result.scores.performance;
      acc.accessibilityScore += result.scores.accessibility;
      acc.bestPracticesScore += result.scores.bestPractices;
      acc.seoScore += result.scores.seo;
      acc.firstContentfulPaint += result.metrics.firstContentfulPaint;
      acc.largestContentfulPaint += result.metrics.largestContentfulPaint;
      acc.cumulativeLayoutShift += result.metrics.cumulativeLayoutShift;
      acc.totalBlockingTime += result.metrics.totalBlockingTime;
      acc.timeToInteractive += result.metrics.timeToInteractive;
      return acc;
    }, {
      performanceScore: 0,
      accessibilityScore: 0,
      bestPracticesScore: 0,
      seoScore: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      cumulativeLayoutShift: 0,
      firstInputDelay: 0,
      totalBlockingTime: 0,
      timeToInteractive: 0
    });

    const count = results.length;
    return {
      performanceScore: totals.performanceScore / count,
      accessibilityScore: totals.accessibilityScore / count,
      bestPracticesScore: totals.bestPracticesScore / count,
      seoScore: totals.seoScore / count,
      firstContentfulPaint: totals.firstContentfulPaint / count,
      largestContentfulPaint: totals.largestContentfulPaint / count,
      cumulativeLayoutShift: totals.cumulativeLayoutShift / count,
      firstInputDelay: 0, // Would need real FID measurement
      totalBlockingTime: totals.totalBlockingTime / count,
      timeToInteractive: totals.timeToInteractive / count
    };
  }

  /**
   * Detect regressions
   */
  private detectRegressions(
    baseline: BaselineMetrics,
    current: BaselineMetrics,
    thresholds: PerformanceThresholds
  ): RegressionDetection[] {
    const regressions: RegressionDetection[] = [];

    // Check each metric for regressions
    const checks = [
      {
        metric: 'performanceScore',
        baseline: baseline.performanceScore,
        current: current.performanceScore,
        threshold: thresholds.performanceScore,
        isDecreaseBad: true, // Lower score is worse
        impact: 'Overall performance degradation affects user experience'
      },
      {
        metric: 'firstContentfulPaint',
        baseline: baseline.firstContentfulPaint,
        current: current.firstContentfulPaint,
        threshold: thresholds.firstContentfulPaint,
        isDecreaseBad: false, // Higher time is worse
        impact: 'Slower initial content rendering affects perceived performance'
      },
      {
        metric: 'largestContentfulPaint',
        baseline: baseline.largestContentfulPaint,
        current: current.largestContentfulPaint,
        threshold: thresholds.largestContentfulPaint,
        isDecreaseBad: false,
        impact: 'Slower main content loading affects user engagement'
      },
      {
        metric: 'cumulativeLayoutShift',
        baseline: baseline.cumulativeLayoutShift,
        current: current.cumulativeLayoutShift,
        threshold: thresholds.cumulativeLayoutShift,
        isDecreaseBad: false,
        impact: 'Increased layout instability affects user experience'
      },
      {
        metric: 'totalBlockingTime',
        baseline: baseline.totalBlockingTime,
        current: current.totalBlockingTime,
        threshold: thresholds.totalBlockingTime,
        isDecreaseBad: false,
        impact: 'Increased blocking time affects interactivity'
      },
      {
        metric: 'dashboardLoadTime',
        baseline: baseline.dashboardLoadTime,
        current: current.dashboardLoadTime,
        threshold: thresholds.dashboardLoadTime,
        isDecreaseBad: false,
        impact: 'Slower dashboard loading affects user productivity'
      },
      {
        metric: 'bundleSize',
        baseline: baseline.bundleSize,
        current: current.bundleSize,
        threshold: thresholds.bundleSize,
        isDecreaseBad: false,
        impact: 'Larger bundle size affects initial load time'
      },
      {
        metric: 'memoryUsage',
        baseline: baseline.memoryUsage,
        current: current.memoryUsage,
        threshold: thresholds.memoryUsage,
        isDecreaseBad: false,
        impact: 'Higher memory usage affects device performance'
      },
      {
        metric: 'throughput',
        baseline: baseline.throughput,
        current: current.throughput,
        threshold: thresholds.throughput,
        isDecreaseBad: true,
        impact: 'Lower throughput affects system scalability'
      },
      {
        metric: 'errorRate',
        baseline: baseline.errorRate,
        current: current.errorRate,
        threshold: thresholds.errorRate,
        isDecreaseBad: false,
        impact: 'Higher error rate affects system reliability'
      }
    ];

    checks.forEach(check => {
      const change = check.isDecreaseBad ? 
        ((check.baseline - check.current) / check.baseline) * 100 : // Decrease is bad
        ((check.current - check.baseline) / check.baseline) * 100;   // Increase is bad

      if (change > check.threshold) {
        const severity = change > check.threshold * 2 ? 'critical' : 'warning';
        
        regressions.push({
          metric: check.metric,
          baseline: check.baseline,
          current: check.current,
          change,
          threshold: check.threshold,
          severity,
          impact: check.impact
        });
      }
    });

    return regressions;
  }

  /**
   * Detect improvements
   */
  private detectImprovements(
    baseline: BaselineMetrics,
    current: BaselineMetrics
  ): ImprovementDetection[] {
    const improvements: ImprovementDetection[] = [];

    const checks = [
      {
        metric: 'performanceScore',
        baseline: baseline.performanceScore,
        current: current.performanceScore,
        isIncreaseGood: true,
        impact: 'Overall performance improvement enhances user experience'
      },
      {
        metric: 'firstContentfulPaint',
        baseline: baseline.firstContentfulPaint,
        current: current.firstContentfulPaint,
        isIncreaseGood: false,
        impact: 'Faster initial content rendering improves perceived performance'
      },
      {
        metric: 'largestContentfulPaint',
        baseline: baseline.largestContentfulPaint,
        current: current.largestContentfulPaint,
        isIncreaseGood: false,
        impact: 'Faster main content loading improves user engagement'
      },
      {
        metric: 'dashboardLoadTime',
        baseline: baseline.dashboardLoadTime,
        current: current.dashboardLoadTime,
        isIncreaseGood: false,
        impact: 'Faster dashboard loading improves user productivity'
      },
      {
        metric: 'bundleSize',
        baseline: baseline.bundleSize,
        current: current.bundleSize,
        isIncreaseGood: false,
        impact: 'Smaller bundle size improves initial load time'
      }
    ];

    checks.forEach(check => {
      const improvement = check.isIncreaseGood ? 
        ((check.current - check.baseline) / check.baseline) * 100 : // Increase is good
        ((check.baseline - check.current) / check.baseline) * 100;   // Decrease is good

      if (improvement > 5) { // 5% improvement threshold
        improvements.push({
          metric: check.metric,
          baseline: check.baseline,
          current: check.current,
          improvement,
          impact: check.impact
        });
      }
    });

    return improvements;
  }

  /**
   * Determine overall status
   */
  private determineOverallStatus(regressions: RegressionDetection[]): 'pass' | 'warning' | 'fail' {
    const criticalRegressions = regressions.filter(r => r.severity === 'critical');
    const warningRegressions = regressions.filter(r => r.severity === 'warning');

    if (criticalRegressions.length > 0) {
      return 'fail';
    } else if (warningRegressions.length > 0) {
      return 'warning';
    } else {
      return 'pass';
    }
  }

  /**
   * Generate regression summary
   */
  private generateRegressionSummary(
    regressions: RegressionDetection[],
    improvements: ImprovementDetection[],
    baseline: BaselineMetrics,
    current: BaselineMetrics
  ): RegressionSummary {
    const criticalRegressions = regressions.filter(r => r.severity === 'critical').length;
    const warningRegressions = regressions.filter(r => r.severity === 'warning').length;

    // Calculate overall performance change
    const overallPerformanceChange = ((current.performanceScore - baseline.performanceScore) / baseline.performanceScore) * 100;

    // Generate recommendation
    let recommendation = '';
    if (criticalRegressions > 0) {
      recommendation = 'Critical performance regressions detected. Immediate action required.';
    } else if (warningRegressions > 0) {
      recommendation = 'Performance regressions detected. Review and optimize affected areas.';
    } else if (improvements.length > 0) {
      recommendation = 'Performance improvements detected. Good work!';
    } else {
      recommendation = 'Performance is stable with no significant changes.';
    }

    return {
      totalRegressions: regressions.length,
      criticalRegressions,
      warningRegressions,
      totalImprovements: improvements.length,
      overallPerformanceChange,
      recommendation
    };
  }

  /**
   * Utility methods
   */
  private getBrowserInfo(): { name: string; version: string } {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Chrome')) {
      const match = userAgent.match(/Chrome\/(\d+)/);
      return { name: 'Chrome', version: match ? match[1] : 'unknown' };
    } else if (userAgent.includes('Firefox')) {
      const match = userAgent.match(/Firefox\/(\d+)/);
      return { name: 'Firefox', version: match ? match[1] : 'unknown' };
    } else if (userAgent.includes('Safari')) {
      const match = userAgent.match(/Safari\/(\d+)/);
      return { name: 'Safari', version: match ? match[1] : 'unknown' };
    }
    
    return { name: 'Unknown', version: 'unknown' };
  }

  private async getBundleSize(): Promise<number> {
    try {
      // In a real implementation, this would analyze the built bundle
      // For now, we'll return a simulated value
      return 1024 * 1024 * 2.5; // 2.5MB
    } catch (error) {
      console.error('Failed to get bundle size:', error);
      return 0;
    }
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  private async measureDashboardLoadTime(): Promise<number> {
    try {
      const startTime = performance.now();
      
      // Simulate dashboard load measurement
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return performance.now() - startTime;
    } catch (error) {
      console.error('Failed to measure dashboard load time:', error);
      return 0;
    }
  }

  private async measureApiResponseTime(): Promise<number> {
    try {
      const startTime = performance.now();
      
      // Test API endpoint
      await fetch('/api/dashboard/batch');
      
      return performance.now() - startTime;
    } catch (error) {
      console.error('Failed to measure API response time:', error);
      return 0;
    }
  }

  /**
   * Storage methods
   */
  private storeBaseline(baseline: PerformanceBaseline): void {
    try {
      const baselines = JSON.parse(localStorage.getItem('performance-baselines') || '[]');
      baselines.push(baseline);
      localStorage.setItem('performance-baselines', JSON.stringify(baselines));
    } catch (error) {
      console.error('Failed to store baseline:', error);
    }
  }

  private storeRegressionResult(result: RegressionTestResult): void {
    try {
      const results = JSON.parse(localStorage.getItem('regression-test-results') || '[]');
      results.push(result);
      
      // Keep only last 100 results
      const limitedResults = results.slice(-100);
      localStorage.setItem('regression-test-results', JSON.stringify(limitedResults));
    } catch (error) {
      console.error('Failed to store regression result:', error);
    }
  }

  /**
   * Public methods
   */
  public getBaselines(): PerformanceBaseline[] {
    return Array.from(this.baselines.values());
  }

  public getRegressionResults(): RegressionTestResult[] {
    return [...this.testResults];
  }

  public getLatestBaseline(): PerformanceBaseline | null {
    const baselines = this.getBaselines();
    return baselines.length > 0 ? baselines[baselines.length - 1] : null;
  }

  public clearHistory(): void {
    this.baselines.clear();
    this.testResults = [];
    localStorage.removeItem('performance-baselines');
    localStorage.removeItem('regression-test-results');
  }

  public exportData(): string {
    return JSON.stringify({
      baselines: this.getBaselines(),
      regressionResults: this.testResults,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }
}

// Create singleton instance
export const performanceRegressionService = new PerformanceRegressionService();