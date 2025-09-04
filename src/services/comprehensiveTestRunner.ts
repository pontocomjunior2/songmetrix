import { performanceTestingService } from './performanceTestingService';
import { loadTestingService } from './loadTestingService';
import { userJourneyTestingService } from './userJourneyTestingService';
import { performanceRegressionService } from './performanceRegressionService';

export interface ComprehensiveTestSuite {
  id: string;
  name: string;
  description: string;
  tests: TestConfiguration[];
  schedule?: TestSchedule;
}

export interface TestConfiguration {
  type: 'lighthouse' | 'load' | 'journey' | 'regression';
  name: string;
  enabled: boolean;
  config: any;
  priority: 'high' | 'medium' | 'low';
  timeout: number;
}

export interface TestSchedule {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'on-demand';
  time?: string; // HH:MM format
  days?: string[]; // ['monday', 'tuesday', ...]
}

export interface ComprehensiveTestResult {
  id: string;
  suiteId: string;
  suiteName: string;
  startTime: number;
  endTime: number;
  totalDuration: number;
  overallStatus: 'pass' | 'warning' | 'fail';
  testResults: IndividualTestResult[];
  summary: TestSummary;
  recommendations: string[];
}

export interface IndividualTestResult {
  testName: string;
  testType: string;
  status: 'pass' | 'warning' | 'fail' | 'skipped';
  duration: number;
  result: any;
  error?: string;
}

export interface TestSummary {
  totalTests: number;
  passedTests: number;
  warningTests: number;
  failedTests: number;
  skippedTests: number;
  passRate: number;
  averageDuration: number;
  criticalIssues: string[];
  performanceScore: number;
}

class ComprehensiveTestRunner {
  private testSuites: Map<string, ComprehensiveTestSuite> = new Map();
  private testResults: ComprehensiveTestResult[] = [];
  private activeTests: Map<string, AbortController> = new Map();
  private scheduledTests: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Create comprehensive test suite
   */
  public createTestSuite(
    name: string,
    description: string,
    tests: TestConfiguration[],
    schedule?: TestSchedule
  ): ComprehensiveTestSuite {
    const suite: ComprehensiveTestSuite = {
      id: `suite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      tests,
      schedule
    };

    this.testSuites.set(suite.id, suite);

    // Schedule tests if configured
    if (schedule?.enabled) {
      this.scheduleTestSuite(suite);
    }

    console.log(`Created test suite: ${name} with ${tests.length} tests`);
    return suite;
  }

  /**
   * Run comprehensive test suite
   */
  public async runTestSuite(suiteId: string): Promise<ComprehensiveTestResult> {
    const suite = this.testSuites.get(suiteId);
    if (!suite) {
      throw new Error(`Test suite not found: ${suiteId}`);
    }

    const testId = `test-run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const abortController = new AbortController();
    this.activeTests.set(testId, abortController);

    console.log(`Starting comprehensive test suite: ${suite.name}`);

    const result: ComprehensiveTestResult = {
      id: testId,
      suiteId,
      suiteName: suite.name,
      startTime: Date.now(),
      endTime: 0,
      totalDuration: 0,
      overallStatus: 'pass',
      testResults: [],
      summary: this.initializeTestSummary(),
      recommendations: []
    };

    try {
      // Sort tests by priority
      const sortedTests = suite.tests.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // Run tests sequentially to avoid resource conflicts
      for (const testConfig of sortedTests) {
        if (abortController.signal.aborted) break;
        if (!testConfig.enabled) {
          result.testResults.push({
            testName: testConfig.name,
            testType: testConfig.type,
            status: 'skipped',
            duration: 0,
            result: null
          });
          continue;
        }

        const testResult = await this.runIndividualTest(testConfig, abortController.signal);
        result.testResults.push(testResult);
      }

      result.endTime = Date.now();
      result.totalDuration = result.endTime - result.startTime;

      // Calculate summary and overall status
      result.summary = this.calculateTestSummary(result.testResults);
      result.overallStatus = this.determineOverallStatus(result.testResults);
      result.recommendations = this.generateRecommendations(result.testResults);

      this.testResults.push(result);
      this.storeTestResult(result);

      console.log(`Test suite completed: ${suite.name}`, {
        status: result.overallStatus,
        duration: result.totalDuration,
        passRate: result.summary.passRate
      });

      return result;

    } catch (error) {
      console.error(`Test suite failed: ${suite.name}`, error);
      result.endTime = Date.now();
      result.totalDuration = result.endTime - result.startTime;
      result.overallStatus = 'fail';
      return result;
    } finally {
      this.activeTests.delete(testId);
    }
  }

  /**
   * Run individual test
   */
  private async runIndividualTest(
    testConfig: TestConfiguration,
    signal: AbortSignal
  ): Promise<IndividualTestResult> {
    const startTime = Date.now();
    
    console.log(`Running test: ${testConfig.name} (${testConfig.type})`);

    try {
      let result: any;

      switch (testConfig.type) {
        case 'lighthouse':
          result = await performanceTestingService.runPerformanceTests(testConfig.config);
          break;

        case 'load':
          result = await loadTestingService.runLoadTest(testConfig.config);
          break;

        case 'journey':
          if (testConfig.config.journey) {
            result = await userJourneyTestingService.runJourneyTest(testConfig.config.journey);
          } else if (testConfig.config.journeys) {
            result = await userJourneyTestingService.runMultipleJourneys(testConfig.config.journeys);
          } else {
            throw new Error('Journey test configuration missing');
          }
          break;

        case 'regression':
          if (testConfig.config.baselineId && testConfig.config.version) {
            result = await performanceRegressionService.runRegressionTest(
              testConfig.config.baselineId,
              testConfig.config.version
            );
          } else {
            throw new Error('Regression test configuration missing baselineId or version');
          }
          break;

        default:
          throw new Error(`Unknown test type: ${testConfig.type}`);
      }

      const duration = Date.now() - startTime;
      const status = this.determineTestStatus(testConfig.type, result);

      return {
        testName: testConfig.name,
        testType: testConfig.type,
        status,
        duration,
        result
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        testName: testConfig.name,
        testType: testConfig.type,
        status: 'fail',
        duration,
        result: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Determine test status based on result
   */
  private determineTestStatus(testType: string, result: any): 'pass' | 'warning' | 'fail' {
    switch (testType) {
      case 'lighthouse':
        if (Array.isArray(result)) {
          const failedTests = result.filter(r => !r.passed);
          if (failedTests.length === 0) return 'pass';
          if (failedTests.some(r => r.budgetViolations.some((v: any) => v.severity === 'error'))) return 'fail';
          return 'warning';
        }
        return 'pass';

      case 'load':
        if (result.errorRate > 5) return 'fail';
        if (result.errorRate > 1 || result.averageResponseTime > 2000) return 'warning';
        return 'pass';

      case 'journey':
        if (Array.isArray(result)) {
          const failedJourneys = result.filter(r => !r.success);
          if (failedJourneys.length === 0) return 'pass';
          if (failedJourneys.some(r => r.errors.length > 0)) return 'fail';
          return 'warning';
        } else {
          if (result.success) return 'pass';
          if (result.errors.length > 0) return 'fail';
          return 'warning';
        }

      case 'regression':
        return result.overallStatus;

      default:
        return 'pass';
    }
  }

  /**
   * Calculate test summary
   */
  private calculateTestSummary(testResults: IndividualTestResult[]): TestSummary {
    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.status === 'pass').length;
    const warningTests = testResults.filter(r => r.status === 'warning').length;
    const failedTests = testResults.filter(r => r.status === 'fail').length;
    const skippedTests = testResults.filter(r => r.status === 'skipped').length;

    const passRate = totalTests > 0 ? (passedTests / (totalTests - skippedTests)) * 100 : 0;
    const averageDuration = totalTests > 0 ? 
      testResults.reduce((sum, r) => sum + r.duration, 0) / totalTests : 0;

    // Extract critical issues
    const criticalIssues: string[] = [];
    testResults.forEach(test => {
      if (test.status === 'fail' && test.error) {
        criticalIssues.push(`${test.testName}: ${test.error}`);
      }
    });

    // Calculate overall performance score
    const performanceScore = this.calculateOverallPerformanceScore(testResults);

    return {
      totalTests,
      passedTests,
      warningTests,
      failedTests,
      skippedTests,
      passRate: Math.round(passRate),
      averageDuration: Math.round(averageDuration),
      criticalIssues,
      performanceScore
    };
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallPerformanceScore(testResults: IndividualTestResult[]): number {
    const lighthouseResults = testResults.filter(r => r.testType === 'lighthouse' && r.result);
    
    if (lighthouseResults.length === 0) return 0;

    let totalScore = 0;
    let count = 0;

    lighthouseResults.forEach(test => {
      if (Array.isArray(test.result)) {
        test.result.forEach(result => {
          totalScore += result.scores.performance;
          count++;
        });
      }
    });

    return count > 0 ? Math.round(totalScore / count) : 0;
  }

  /**
   * Determine overall status
   */
  private determineOverallStatus(testResults: IndividualTestResult[]): 'pass' | 'warning' | 'fail' {
    const failedTests = testResults.filter(r => r.status === 'fail');
    const warningTests = testResults.filter(r => r.status === 'warning');

    if (failedTests.length > 0) return 'fail';
    if (warningTests.length > 0) return 'warning';
    return 'pass';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(testResults: IndividualTestResult[]): string[] {
    const recommendations: string[] = [];

    // Analyze failed tests
    const failedTests = testResults.filter(r => r.status === 'fail');
    if (failedTests.length > 0) {
      recommendations.push(`${failedTests.length} tests failed. Review and fix critical issues.`);
    }

    // Analyze performance tests
    const lighthouseTests = testResults.filter(r => r.testType === 'lighthouse');
    if (lighthouseTests.length > 0) {
      const avgPerformanceScore = this.calculateOverallPerformanceScore(testResults);
      if (avgPerformanceScore < 70) {
        recommendations.push('Performance score is below 70. Focus on Core Web Vitals optimization.');
      }
    }

    // Analyze load tests
    const loadTests = testResults.filter(r => r.testType === 'load' && r.result);
    loadTests.forEach(test => {
      if (test.result.errorRate > 1) {
        recommendations.push(`Load test "${test.testName}" shows ${test.result.errorRate}% error rate. Investigate server stability.`);
      }
      if (test.result.averageResponseTime > 1000) {
        recommendations.push(`Load test "${test.testName}" shows slow response times (${test.result.averageResponseTime}ms). Optimize backend performance.`);
      }
    });

    // Analyze journey tests
    const journeyTests = testResults.filter(r => r.testType === 'journey' && r.result);
    journeyTests.forEach(test => {
      if (test.status === 'warning' || test.status === 'fail') {
        recommendations.push(`User journey "${test.testName}" has issues. Review user experience flow.`);
      }
    });

    // Analyze regression tests
    const regressionTests = testResults.filter(r => r.testType === 'regression' && r.result);
    regressionTests.forEach(test => {
      if (test.result.regressions && test.result.regressions.length > 0) {
        recommendations.push(`Performance regressions detected in "${test.testName}". Review recent changes.`);
      }
    });

    return recommendations.length > 0 ? recommendations : ['All tests passed successfully. Continue monitoring performance.'];
  }

  /**
   * Schedule test suite
   */
  private scheduleTestSuite(suite: ComprehensiveTestSuite): void {
    if (!suite.schedule?.enabled) return;

    const scheduleId = `schedule-${suite.id}`;
    
    // Clear existing schedule
    const existingSchedule = this.scheduledTests.get(scheduleId);
    if (existingSchedule) {
      clearInterval(existingSchedule);
    }

    let intervalMs: number;
    
    switch (suite.schedule.frequency) {
      case 'hourly':
        intervalMs = 60 * 60 * 1000; // 1 hour
        break;
      case 'daily':
        intervalMs = 24 * 60 * 60 * 1000; // 24 hours
        break;
      case 'weekly':
        intervalMs = 7 * 24 * 60 * 60 * 1000; // 7 days
        break;
      default:
        return; // on-demand only
    }

    const schedule = setInterval(async () => {
      try {
        console.log(`Running scheduled test suite: ${suite.name}`);
        await this.runTestSuite(suite.id);
      } catch (error) {
        console.error(`Scheduled test suite failed: ${suite.name}`, error);
      }
    }, intervalMs);

    this.scheduledTests.set(scheduleId, schedule);
    console.log(`Scheduled test suite: ${suite.name} (${suite.schedule.frequency})`);
  }

  /**
   * Initialize test summary
   */
  private initializeTestSummary(): TestSummary {
    return {
      totalTests: 0,
      passedTests: 0,
      warningTests: 0,
      failedTests: 0,
      skippedTests: 0,
      passRate: 0,
      averageDuration: 0,
      criticalIssues: [],
      performanceScore: 0
    };
  }

  /**
   * Store test result
   */
  private storeTestResult(result: ComprehensiveTestResult): void {
    try {
      const results = JSON.parse(localStorage.getItem('comprehensive-test-results') || '[]');
      results.push(result);
      
      // Keep only last 50 results
      const limitedResults = results.slice(-50);
      localStorage.setItem('comprehensive-test-results', JSON.stringify(limitedResults));
    } catch (error) {
      console.error('Failed to store test result:', error);
    }
  }

  /**
   * Create predefined test suites
   */
  public createDashboardPerformanceTestSuite(): ComprehensiveTestSuite {
    const tests: TestConfiguration[] = [
      {
        type: 'lighthouse',
        name: 'Dashboard Lighthouse Audit',
        enabled: true,
        priority: 'high',
        timeout: 60000,
        config: {
          urls: ['http://localhost:5173/dashboard'],
          numberOfRuns: 3
        }
      },
      {
        type: 'load',
        name: 'Dashboard Load Test',
        enabled: true,
        priority: 'high',
        timeout: 300000,
        config: loadTestingService.createDashboardLoadTest()
      },
      {
        type: 'journey',
        name: 'Dashboard User Journey',
        enabled: true,
        priority: 'medium',
        timeout: 30000,
        config: {
          journey: userJourneyTestingService.createDashboardJourney()
        }
      }
    ];

    return this.createTestSuite(
      'Dashboard Performance Suite',
      'Comprehensive performance testing for dashboard functionality',
      tests,
      {
        enabled: true,
        frequency: 'daily',
        time: '02:00'
      }
    );
  }

  public createRegressionTestSuite(baselineId: string, version: string): ComprehensiveTestSuite {
    const tests: TestConfiguration[] = [
      {
        type: 'regression',
        name: 'Performance Regression Test',
        enabled: true,
        priority: 'high',
        timeout: 600000,
        config: {
          baselineId,
          version
        }
      },
      {
        type: 'lighthouse',
        name: 'Current Performance Audit',
        enabled: true,
        priority: 'high',
        timeout: 60000,
        config: {
          urls: ['http://localhost:5173', 'http://localhost:5173/dashboard'],
          numberOfRuns: 3
        }
      }
    ];

    return this.createTestSuite(
      'Performance Regression Suite',
      'Detect performance regressions against baseline',
      tests
    );
  }

  /**
   * Public methods
   */
  public getTestSuites(): ComprehensiveTestSuite[] {
    return Array.from(this.testSuites.values());
  }

  public getTestResults(): ComprehensiveTestResult[] {
    return [...this.testResults];
  }

  public stopTestSuite(suiteId: string): boolean {
    const activeTest = Array.from(this.activeTests.entries())
      .find(([_, controller]) => controller);
    
    if (activeTest) {
      activeTest[1].abort();
      this.activeTests.delete(activeTest[0]);
      return true;
    }
    return false;
  }

  public stopAllTests(): void {
    this.activeTests.forEach((controller, testId) => {
      controller.abort();
    });
    this.activeTests.clear();
  }

  public clearSchedules(): void {
    this.scheduledTests.forEach((schedule, scheduleId) => {
      clearInterval(schedule);
    });
    this.scheduledTests.clear();
  }

  public clearHistory(): void {
    this.testResults = [];
    localStorage.removeItem('comprehensive-test-results');
  }

  public exportResults(): string {
    return JSON.stringify({
      testSuites: this.getTestSuites(),
      testResults: this.testResults,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }
}

// Create singleton instance
export const comprehensiveTestRunner = new ComprehensiveTestRunner();