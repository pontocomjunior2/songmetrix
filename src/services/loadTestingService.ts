export interface LoadTestConfig {
  url: string;
  concurrentUsers: number;
  duration: number; // in seconds
  rampUpTime: number; // in seconds
  requestsPerSecond?: number;
  headers?: Record<string, string>;
  scenarios: LoadTestScenario[];
}

export interface LoadTestScenario {
  name: string;
  weight: number; // percentage of users running this scenario
  steps: LoadTestStep[];
}

export interface LoadTestStep {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  expectedStatus?: number;
  thinkTime?: number; // pause in ms before next step
  validation?: (response: Response) => boolean;
}

export interface LoadTestResult {
  id: string;
  config: LoadTestConfig;
  startTime: number;
  endTime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  errors: LoadTestError[];
  scenarioResults: ScenarioResult[];
  resourceUsage: ResourceUsage;
}

export interface LoadTestError {
  timestamp: number;
  scenario: string;
  step: string;
  error: string;
  responseTime: number;
  statusCode?: number;
}

export interface ScenarioResult {
  name: string;
  totalRequests: number;
  successfulRequests: number;
  averageResponseTime: number;
  errorRate: number;
}

export interface ResourceUsage {
  peakMemoryUsage: number;
  averageCpuUsage: number;
  networkBytesReceived: number;
  networkBytesSent: number;
}

class LoadTestingService {
  private activeTests: Map<string, AbortController> = new Map();
  private testResults: LoadTestResult[] = [];

  /**
   * Run load test with multiple concurrent users
   */
  public async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const testId = `load-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const abortController = new AbortController();
    this.activeTests.set(testId, abortController);

    console.log(`Starting load test: ${testId}`, config);

    const startTime = Date.now();
    const results: LoadTestResult = {
      id: testId,
      config,
      startTime,
      endTime: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      errors: [],
      scenarioResults: [],
      resourceUsage: {
        peakMemoryUsage: 0,
        averageCpuUsage: 0,
        networkBytesReceived: 0,
        networkBytesSent: 0
      }
    };

    try {
      // Start resource monitoring
      const resourceMonitor = this.startResourceMonitoring();

      // Create user sessions
      const userSessions = await this.createUserSessions(config, abortController.signal);

      // Wait for test completion
      await Promise.all(userSessions);

      // Stop resource monitoring
      results.resourceUsage = await resourceMonitor.stop();

      results.endTime = Date.now();
      
      // Calculate final metrics
      this.calculateFinalMetrics(results);
      
      this.testResults.push(results);
      
      console.log(`Load test completed: ${testId}`, {
        duration: (results.endTime - results.startTime) / 1000,
        totalRequests: results.totalRequests,
        successRate: ((results.successfulRequests / results.totalRequests) * 100).toFixed(2) + '%',
        avgResponseTime: results.averageResponseTime.toFixed(2) + 'ms'
      });

      return results;

    } catch (error) {
      console.error(`Load test failed: ${testId}`, error);
      results.endTime = Date.now();
      results.errors.push({
        timestamp: Date.now(),
        scenario: 'system',
        step: 'test-execution',
        error: error instanceof Error ? error.message : String(error),
        responseTime: 0
      });
      return results;
    } finally {
      this.activeTests.delete(testId);
    }
  }

  /**
   * Create concurrent user sessions
   */
  private async createUserSessions(config: LoadTestConfig, signal: AbortSignal): Promise<Promise<void>[]> {
    const sessions: Promise<void>[] = [];
    const usersPerSecond = config.concurrentUsers / config.rampUpTime;

    for (let i = 0; i < config.concurrentUsers; i++) {
      const delay = (i / usersPerSecond) * 1000; // Ramp up delay
      const scenario = this.selectScenario(config.scenarios);
      
      const session = this.createUserSession(i, scenario, config, delay, signal);
      sessions.push(session);
    }

    return sessions;
  }

  /**
   * Select scenario based on weight distribution
   */
  private selectScenario(scenarios: LoadTestScenario[]): LoadTestScenario {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const scenario of scenarios) {
      cumulative += scenario.weight;
      if (random <= cumulative) {
        return scenario;
      }
    }

    return scenarios[0]; // Fallback to first scenario
  }

  /**
   * Create individual user session
   */
  private async createUserSession(
    userId: number,
    scenario: LoadTestScenario,
    config: LoadTestConfig,
    delay: number,
    signal: AbortSignal
  ): Promise<void> {
    // Wait for ramp-up delay
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (signal.aborted) return;

    const sessionStartTime = Date.now();
    const sessionEndTime = sessionStartTime + (config.duration * 1000);

    while (Date.now() < sessionEndTime && !signal.aborted) {
      try {
        await this.executeScenario(userId, scenario, config, signal);
      } catch (error) {
        console.error(`User ${userId} scenario failed:`, error);
      }

      // Add think time between scenario iterations
      const thinkTime = 1000 + Math.random() * 2000; // 1-3 seconds
      await new Promise(resolve => setTimeout(resolve, thinkTime));
    }
  }

  /**
   * Execute scenario steps
   */
  private async executeScenario(
    userId: number,
    scenario: LoadTestScenario,
    config: LoadTestConfig,
    signal: AbortSignal
  ): Promise<void> {
    for (const step of scenario.steps) {
      if (signal.aborted) return;

      const stepStartTime = Date.now();

      try {
        const response = await this.executeStep(step, config, signal);
        const responseTime = Date.now() - stepStartTime;

        // Record successful request
        this.recordRequest(scenario.name, step.name, responseTime, true);

        // Validate response if validation function provided
        if (step.validation && !step.validation(response)) {
          throw new Error('Response validation failed');
        }

      } catch (error) {
        const responseTime = Date.now() - stepStartTime;
        
        // Record failed request
        this.recordRequest(scenario.name, step.name, responseTime, false, error);
      }

      // Think time before next step
      if (step.thinkTime && step.thinkTime > 0) {
        await new Promise(resolve => setTimeout(resolve, step.thinkTime));
      }
    }
  }

  /**
   * Execute individual step
   */
  private async executeStep(
    step: LoadTestStep,
    config: LoadTestConfig,
    signal: AbortSignal
  ): Promise<Response> {
    const url = step.url.startsWith('http') ? step.url : `${config.url}${step.url}`;
    
    const requestOptions: RequestInit = {
      method: step.method,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
        ...step.headers
      },
      signal
    };

    if (step.body && (step.method === 'POST' || step.method === 'PUT')) {
      requestOptions.body = JSON.stringify(step.body);
    }

    const response = await fetch(url, requestOptions);

    // Check expected status
    if (step.expectedStatus && response.status !== step.expectedStatus) {
      throw new Error(`Expected status ${step.expectedStatus}, got ${response.status}`);
    }

    return response;
  }

  /**
   * Record request metrics
   */
  private recordRequest(
    scenario: string,
    step: string,
    responseTime: number,
    success: boolean,
    error?: any
  ): void {
    // This would typically update shared metrics
    // For now, we'll use a simple in-memory approach
    const metrics = this.getOrCreateMetrics();
    
    metrics.totalRequests++;
    
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
      metrics.errors.push({
        timestamp: Date.now(),
        scenario,
        step,
        error: error instanceof Error ? error.message : String(error),
        responseTime
      });
    }

    metrics.responseTimes.push(responseTime);
    metrics.minResponseTime = Math.min(metrics.minResponseTime, responseTime);
    metrics.maxResponseTime = Math.max(metrics.maxResponseTime, responseTime);
  }

  /**
   * Get or create metrics object
   */
  private getOrCreateMetrics(): any {
    if (!this.currentTestMetrics) {
      this.currentTestMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responseTimes: [],
        minResponseTime: Infinity,
        maxResponseTime: 0,
        errors: []
      };
    }
    return this.currentTestMetrics;
  }

  private currentTestMetrics: any = null;

  /**
   * Calculate final metrics
   */
  private calculateFinalMetrics(results: LoadTestResult): void {
    const metrics = this.currentTestMetrics;
    if (!metrics) return;

    results.totalRequests = metrics.totalRequests;
    results.successfulRequests = metrics.successfulRequests;
    results.failedRequests = metrics.failedRequests;
    results.errors = metrics.errors;
    results.minResponseTime = metrics.minResponseTime === Infinity ? 0 : metrics.minResponseTime;
    results.maxResponseTime = metrics.maxResponseTime;

    if (metrics.responseTimes.length > 0) {
      const sortedTimes = metrics.responseTimes.sort((a: number, b: number) => a - b);
      results.averageResponseTime = sortedTimes.reduce((a: number, b: number) => a + b, 0) / sortedTimes.length;
      results.p95ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      results.p99ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
    }

    const durationSeconds = (results.endTime - results.startTime) / 1000;
    results.requestsPerSecond = results.totalRequests / durationSeconds;
    results.errorRate = (results.failedRequests / results.totalRequests) * 100;

    // Reset for next test
    this.currentTestMetrics = null;
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): { stop: () => Promise<ResourceUsage> } {
    const startTime = Date.now();
    let peakMemory = 0;
    let cpuSamples: number[] = [];
    let networkReceived = 0;
    let networkSent = 0;

    const monitor = setInterval(() => {
      // Monitor memory usage
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        peakMemory = Math.max(peakMemory, memInfo.usedJSHeapSize);
      }

      // Simulate CPU monitoring (in real implementation, use proper APIs)
      cpuSamples.push(Math.random() * 100);

      // Monitor network (simplified)
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        networkReceived += connection.downlink || 0;
        networkSent += connection.uplink || 0;
      }
    }, 1000);

    return {
      stop: async (): Promise<ResourceUsage> => {
        clearInterval(monitor);
        
        return {
          peakMemoryUsage: peakMemory,
          averageCpuUsage: cpuSamples.length > 0 ? 
            cpuSamples.reduce((a, b) => a + b, 0) / cpuSamples.length : 0,
          networkBytesReceived: networkReceived,
          networkBytesSent: networkSent
        };
      }
    };
  }

  /**
   * Stop active test
   */
  public stopTest(testId: string): boolean {
    const controller = this.activeTests.get(testId);
    if (controller) {
      controller.abort();
      this.activeTests.delete(testId);
      return true;
    }
    return false;
  }

  /**
   * Stop all active tests
   */
  public stopAllTests(): void {
    this.activeTests.forEach((controller, testId) => {
      controller.abort();
    });
    this.activeTests.clear();
  }

  /**
   * Get test results
   */
  public getTestResults(): LoadTestResult[] {
    return [...this.testResults];
  }

  /**
   * Get active tests
   */
  public getActiveTests(): string[] {
    return Array.from(this.activeTests.keys());
  }

  /**
   * Clear test history
   */
  public clearTestHistory(): void {
    this.testResults = [];
  }

  /**
   * Export test results
   */
  public exportResults(): string {
    return JSON.stringify({
      testResults: this.testResults,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Create dashboard load test scenario
   */
  public createDashboardLoadTest(): LoadTestConfig {
    return {
      url: 'http://localhost:5173',
      concurrentUsers: 50,
      duration: 300, // 5 minutes
      rampUpTime: 60, // 1 minute ramp up
      scenarios: [
        {
          name: 'Dashboard Heavy User',
          weight: 40,
          steps: [
            {
              name: 'Login',
              method: 'POST',
              url: '/api/auth/login',
              body: { email: 'test@example.com', password: 'password' },
              expectedStatus: 200,
              thinkTime: 2000
            },
            {
              name: 'Load Dashboard',
              method: 'GET',
              url: '/api/dashboard/batch',
              expectedStatus: 200,
              thinkTime: 5000
            },
            {
              name: 'Load Top Songs',
              method: 'GET',
              url: '/api/dashboard/top-songs',
              expectedStatus: 200,
              thinkTime: 3000
            },
            {
              name: 'Load Charts Data',
              method: 'GET',
              url: '/api/dashboard/charts',
              expectedStatus: 200,
              thinkTime: 4000
            }
          ]
        },
        {
          name: 'Dashboard Light User',
          weight: 60,
          steps: [
            {
              name: 'Login',
              method: 'POST',
              url: '/api/auth/login',
              body: { email: 'test@example.com', password: 'password' },
              expectedStatus: 200,
              thinkTime: 2000
            },
            {
              name: 'Load Dashboard',
              method: 'GET',
              url: '/api/dashboard/batch',
              expectedStatus: 200,
              thinkTime: 10000
            }
          ]
        }
      ]
    };
  }

  /**
   * Create API endpoint stress test
   */
  public createApiStressTest(): LoadTestConfig {
    return {
      url: 'http://localhost:3001',
      concurrentUsers: 100,
      duration: 180, // 3 minutes
      rampUpTime: 30, // 30 seconds ramp up
      scenarios: [
        {
          name: 'API Stress Test',
          weight: 100,
          steps: [
            {
              name: 'Dashboard Batch API',
              method: 'GET',
              url: '/api/dashboard/batch',
              expectedStatus: 200,
              thinkTime: 1000
            },
            {
              name: 'User Preferences API',
              method: 'GET',
              url: '/api/user/preferences',
              expectedStatus: 200,
              thinkTime: 500
            },
            {
              name: 'Radio Status API',
              method: 'GET',
              url: '/api/radio/status',
              expectedStatus: 200,
              thinkTime: 800
            }
          ]
        }
      ]
    };
  }
}

// Create singleton instance
export const loadTestingService = new LoadTestingService();