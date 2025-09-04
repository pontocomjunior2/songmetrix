export interface PerformanceBudget {
  metric: string;
  budget: number;
  unit: 'ms' | 'score' | 'bytes' | 'count';
  threshold: 'error' | 'warn';
}

export interface PerformanceTestResult {
  id: string;
  url: string;
  timestamp: number;
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  metrics: {
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    cumulativeLayoutShift: number;
    totalBlockingTime: number;
    speedIndex: number;
    timeToInteractive: number;
  };
  budgetViolations: BudgetViolation[];
  passed: boolean;
  reportUrl?: string;
}

export interface BudgetViolation {
  metric: string;
  actual: number;
  budget: number;
  unit: string;
  severity: 'error' | 'warn';
}

export interface PerformanceTestConfig {
  urls: string[];
  budgets: PerformanceBudget[];
  numberOfRuns: number;
  device: 'desktop' | 'mobile';
  throttling: 'none' | 'slow-4g' | 'fast-3g';
}

class PerformanceTestingService {
  private defaultBudgets: PerformanceBudget[] = [
    { metric: 'performance', budget: 70, unit: 'score', threshold: 'error' },
    { metric: 'accessibility', budget: 90, unit: 'score', threshold: 'error' },
    { metric: 'best-practices', budget: 80, unit: 'score', threshold: 'error' },
    { metric: 'seo', budget: 80, unit: 'score', threshold: 'error' },
    { metric: 'first-contentful-paint', budget: 2000, unit: 'ms', threshold: 'error' },
    { metric: 'largest-contentful-paint', budget: 3000, unit: 'ms', threshold: 'error' },
    { metric: 'cumulative-layout-shift', budget: 0.1, unit: 'score', threshold: 'error' },
    { metric: 'total-blocking-time', budget: 300, unit: 'ms', threshold: 'error' },
    { metric: 'speed-index', budget: 4000, unit: 'ms', threshold: 'warn' },
    { metric: 'interactive', budget: 5000, unit: 'ms', threshold: 'warn' }
  ];

  private testHistory: PerformanceTestResult[] = [];

  /**
   * Run performance tests using Lighthouse
   */
  public async runPerformanceTests(config: Partial<PerformanceTestConfig> = {}): Promise<PerformanceTestResult[]> {
    const testConfig: PerformanceTestConfig = {
      urls: ['http://localhost:5173', 'http://localhost:5173/dashboard'],
      budgets: this.defaultBudgets,
      numberOfRuns: 3,
      device: 'desktop',
      throttling: 'none',
      ...config
    };

    console.log('Starting performance tests...', testConfig);

    const results: PerformanceTestResult[] = [];

    for (const url of testConfig.urls) {
      try {
        const result = await this.testUrl(url, testConfig);
        results.push(result);
        this.testHistory.push(result);
      } catch (error) {
        console.error(`Failed to test URL ${url}:`, error);
      }
    }

    // Keep only last 100 test results
    if (this.testHistory.length > 100) {
      this.testHistory = this.testHistory.slice(-100);
    }

    // Store results
    this.storeResults(results);

    return results;
  }

  /**
   * Test a single URL
   */
  private async testUrl(url: string, config: PerformanceTestConfig): Promise<PerformanceTestResult> {
    // In a real implementation, this would use Lighthouse programmatically
    // For now, we'll simulate the results based on current performance metrics
    
    const mockResult = await this.simulateLighthouseTest(url, config);
    return mockResult;
  }

  /**
   * Simulate Lighthouse test results
   * In production, this would be replaced with actual Lighthouse API calls
   */
  private async simulateLighthouseTest(url: string, config: PerformanceTestConfig): Promise<PerformanceTestResult> {
    // Simulate test delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate mock metrics based on current performance state
    const baseMetrics = {
      firstContentfulPaint: 1200 + Math.random() * 800,
      largestContentfulPaint: 2000 + Math.random() * 1500,
      cumulativeLayoutShift: Math.random() * 0.15,
      totalBlockingTime: 100 + Math.random() * 400,
      speedIndex: 2500 + Math.random() * 2000,
      timeToInteractive: 3000 + Math.random() * 2500
    };

    // Calculate scores based on metrics
    const scores = {
      performance: this.calculatePerformanceScore(baseMetrics),
      accessibility: 85 + Math.random() * 15,
      bestPractices: 80 + Math.random() * 20,
      seo: 85 + Math.random() * 15
    };

    // Check budget violations
    const budgetViolations = this.checkBudgetViolations(
      { ...baseMetrics, ...scores },
      config.budgets
    );

    const result: PerformanceTestResult = {
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url,
      timestamp: Date.now(),
      scores,
      metrics: baseMetrics,
      budgetViolations,
      passed: budgetViolations.filter(v => v.severity === 'error').length === 0
    };

    return result;
  }

  /**
   * Calculate performance score based on metrics
   */
  private calculatePerformanceScore(metrics: any): number {
    let score = 100;

    // LCP scoring
    if (metrics.largestContentfulPaint > 4000) score -= 30;
    else if (metrics.largestContentfulPaint > 2500) score -= 15;

    // FCP scoring
    if (metrics.firstContentfulPaint > 3000) score -= 20;
    else if (metrics.firstContentfulPaint > 1800) score -= 10;

    // CLS scoring
    if (metrics.cumulativeLayoutShift > 0.25) score -= 20;
    else if (metrics.cumulativeLayoutShift > 0.1) score -= 10;

    // TBT scoring
    if (metrics.totalBlockingTime > 600) score -= 15;
    else if (metrics.totalBlockingTime > 300) score -= 8;

    // Speed Index scoring
    if (metrics.speedIndex > 5800) score -= 10;
    else if (metrics.speedIndex > 3400) score -= 5;

    // TTI scoring
    if (metrics.timeToInteractive > 7300) score -= 5;
    else if (metrics.timeToInteractive > 3800) score -= 3;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check budget violations
   */
  private checkBudgetViolations(
    results: Record<string, number>,
    budgets: PerformanceBudget[]
  ): BudgetViolation[] {
    const violations: BudgetViolation[] = [];

    budgets.forEach(budget => {
      const actual = results[budget.metric.replace(/-/g, '')];
      if (actual === undefined) return;

      const violated = budget.unit === 'score' ? 
        actual < budget.budget : 
        actual > budget.budget;

      if (violated) {
        violations.push({
          metric: budget.metric,
          actual,
          budget: budget.budget,
          unit: budget.unit,
          severity: budget.threshold
        });
      }
    });

    return violations;
  }

  /**
   * Run continuous performance monitoring
   */
  public async startContinuousMonitoring(intervalMinutes: number = 60): Promise<void> {
    console.log(`Starting continuous performance monitoring (every ${intervalMinutes} minutes)`);

    const runTests = async () => {
      try {
        const results = await this.runPerformanceTests();
        const failedTests = results.filter(r => !r.passed);
        
        if (failedTests.length > 0) {
          console.warn(`Performance tests failed for ${failedTests.length} URLs:`, 
            failedTests.map(t => t.url));
          
          // Trigger alerts for failed tests
          this.triggerPerformanceAlerts(failedTests);
        } else {
          console.log('All performance tests passed');
        }
      } catch (error) {
        console.error('Continuous performance monitoring failed:', error);
      }
    };

    // Run initial test
    await runTests();

    // Schedule recurring tests
    setInterval(runTests, intervalMinutes * 60 * 1000);
  }

  /**
   * Trigger performance alerts
   */
  private triggerPerformanceAlerts(failedTests: PerformanceTestResult[]): void {
    failedTests.forEach(test => {
      test.budgetViolations.forEach(violation => {
        if (violation.severity === 'error') {
          console.error(`Performance Budget Violation: ${violation.metric} = ${violation.actual}${violation.unit} (budget: ${violation.budget}${violation.unit}) for ${test.url}`);
        }
      });
    });

    // In a real implementation, this would integrate with alerting systems
    // like Slack, email, or monitoring platforms
  }

  /**
   * Generate performance report
   */
  public generatePerformanceReport(): any {
    if (this.testHistory.length === 0) {
      return { message: 'No test data available' };
    }

    const recentTests = this.testHistory.slice(-10);
    const passRate = (recentTests.filter(t => t.passed).length / recentTests.length) * 100;

    const averageScores = recentTests.reduce((acc, test) => {
      acc.performance += test.scores.performance;
      acc.accessibility += test.scores.accessibility;
      acc.bestPractices += test.scores.bestPractices;
      acc.seo += test.scores.seo;
      return acc;
    }, { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 });

    Object.keys(averageScores).forEach(key => {
      averageScores[key as keyof typeof averageScores] /= recentTests.length;
    });

    const averageMetrics = recentTests.reduce((acc, test) => {
      acc.firstContentfulPaint += test.metrics.firstContentfulPaint;
      acc.largestContentfulPaint += test.metrics.largestContentfulPaint;
      acc.cumulativeLayoutShift += test.metrics.cumulativeLayoutShift;
      acc.totalBlockingTime += test.metrics.totalBlockingTime;
      acc.speedIndex += test.metrics.speedIndex;
      acc.timeToInteractive += test.metrics.timeToInteractive;
      return acc;
    }, {
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      cumulativeLayoutShift: 0,
      totalBlockingTime: 0,
      speedIndex: 0,
      timeToInteractive: 0
    });

    Object.keys(averageMetrics).forEach(key => {
      averageMetrics[key as keyof typeof averageMetrics] /= recentTests.length;
    });

    const commonViolations = this.getCommonViolations(recentTests);

    return {
      summary: {
        totalTests: this.testHistory.length,
        recentTests: recentTests.length,
        passRate: Math.round(passRate),
        averageScores: Object.fromEntries(
          Object.entries(averageScores).map(([k, v]) => [k, Math.round(v)])
        ),
        averageMetrics: Object.fromEntries(
          Object.entries(averageMetrics).map(([k, v]) => [k, Math.round(v)])
        )
      },
      trends: this.calculateTrends(),
      violations: commonViolations,
      recommendations: this.generateRecommendations(commonViolations)
    };
  }

  /**
   * Get common budget violations
   */
  private getCommonViolations(tests: PerformanceTestResult[]): any[] {
    const violationCounts: Record<string, { count: number; severity: string; examples: any[] }> = {};

    tests.forEach(test => {
      test.budgetViolations.forEach(violation => {
        const key = violation.metric;
        if (!violationCounts[key]) {
          violationCounts[key] = { count: 0, severity: violation.severity, examples: [] };
        }
        violationCounts[key].count++;
        violationCounts[key].examples.push({
          url: test.url,
          actual: violation.actual,
          budget: violation.budget,
          timestamp: test.timestamp
        });
      });
    });

    return Object.entries(violationCounts)
      .map(([metric, data]) => ({ metric, ...data }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(): any {
    if (this.testHistory.length < 5) return null;

    const recent = this.testHistory.slice(-10);
    const older = this.testHistory.slice(-20, -10);

    if (older.length === 0) return null;

    const recentAvg = this.calculateAverageScores(recent);
    const olderAvg = this.calculateAverageScores(older);

    const trends: Record<string, number> = {};
    Object.keys(recentAvg).forEach(key => {
      const change = ((recentAvg[key] - olderAvg[key]) / olderAvg[key]) * 100;
      trends[key] = Math.round(change * 100) / 100;
    });

    return trends;
  }

  /**
   * Calculate average scores
   */
  private calculateAverageScores(tests: PerformanceTestResult[]): Record<string, number> {
    const totals = tests.reduce((acc, test) => {
      acc.performance += test.scores.performance;
      acc.accessibility += test.scores.accessibility;
      acc.bestPractices += test.scores.bestPractices;
      acc.seo += test.scores.seo;
      return acc;
    }, { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 });

    Object.keys(totals).forEach(key => {
      totals[key as keyof typeof totals] /= tests.length;
    });

    return totals;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(violations: any[]): string[] {
    const recommendations: string[] = [];

    violations.forEach(violation => {
      switch (violation.metric) {
        case 'largest-contentful-paint':
          recommendations.push('Optimize images and implement lazy loading to improve LCP');
          recommendations.push('Reduce server response times and implement CDN');
          break;
        case 'first-contentful-paint':
          recommendations.push('Minimize render-blocking resources');
          recommendations.push('Optimize critical rendering path');
          break;
        case 'cumulative-layout-shift':
          recommendations.push('Set explicit dimensions for images and videos');
          recommendations.push('Avoid inserting content above existing content');
          break;
        case 'total-blocking-time':
          recommendations.push('Reduce JavaScript execution time');
          recommendations.push('Split large JavaScript bundles');
          break;
        case 'performance':
          recommendations.push('Focus on Core Web Vitals optimization');
          recommendations.push('Implement performance monitoring and budgets');
          break;
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Store test results
   */
  private storeResults(results: PerformanceTestResult[]): void {
    try {
      const existingResults = JSON.parse(localStorage.getItem('performance-test-results') || '[]');
      const allResults = [...existingResults, ...results];
      
      // Keep only last 1000 results
      const limitedResults = allResults.slice(-1000);
      
      localStorage.setItem('performance-test-results', JSON.stringify(limitedResults));
    } catch (error) {
      console.error('Failed to store performance test results:', error);
    }
  }

  /**
   * Get test history
   */
  public getTestHistory(): PerformanceTestResult[] {
    return [...this.testHistory];
  }

  /**
   * Clear test history
   */
  public clearTestHistory(): void {
    this.testHistory = [];
    localStorage.removeItem('performance-test-results');
  }

  /**
   * Export test results
   */
  public exportResults(): string {
    const exportData = {
      testHistory: this.testHistory,
      report: this.generatePerformanceReport(),
      exportedAt: new Date().toISOString()
    };

    return JSON.stringify(exportData, null, 2);
  }
}

// Create singleton instance
export const performanceTestingService = new PerformanceTestingService();