export interface UserJourney {
  id: string;
  name: string;
  description: string;
  steps: JourneyStep[];
  expectedDuration: number; // in milliseconds
  criticalPath: boolean;
}

export interface JourneyStep {
  id: string;
  name: string;
  action: JourneyAction;
  selector?: string;
  url?: string;
  data?: any;
  waitFor?: string | number;
  expectedDuration: number;
  validation?: JourneyValidation;
  screenshot?: boolean;
}

export interface JourneyAction {
  type: 'navigate' | 'click' | 'type' | 'wait' | 'scroll' | 'api-call' | 'custom';
  target?: string;
  value?: any;
  options?: any;
}

export interface JourneyValidation {
  type: 'element-exists' | 'text-contains' | 'url-matches' | 'api-response' | 'performance-metric';
  target: string;
  expected: any;
  timeout?: number;
}

export interface JourneyTestResult {
  id: string;
  journeyId: string;
  journeyName: string;
  startTime: number;
  endTime: number;
  totalDuration: number;
  success: boolean;
  stepResults: StepResult[];
  performanceMetrics: JourneyPerformanceMetrics;
  screenshots: string[];
  errors: JourneyError[];
  networkRequests: NetworkRequest[];
}

export interface StepResult {
  stepId: string;
  stepName: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  validationResults: ValidationResult[];
  performanceMetrics: StepPerformanceMetrics;
}

export interface ValidationResult {
  type: string;
  target: string;
  expected: any;
  actual: any;
  success: boolean;
  error?: string;
}

export interface JourneyPerformanceMetrics {
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  totalBlockingTime: number;
  timeToInteractive: number;
  domContentLoaded: number;
  loadComplete: number;
  memoryUsage: number;
  jsHeapSize: number;
}

export interface StepPerformanceMetrics {
  duration: number;
  domChanges: number;
  networkRequests: number;
  jsExecutionTime: number;
  renderTime: number;
}

export interface JourneyError {
  stepId: string;
  stepName: string;
  timestamp: number;
  error: string;
  stack?: string;
  screenshot?: string;
}

export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  duration: number;
  size: number;
  timestamp: number;
  stepId: string;
}

class UserJourneyTestingService {
  private testResults: JourneyTestResult[] = [];
  private activeTests: Map<string, AbortController> = new Map();

  /**
   * Run user journey test
   */
  public async runJourneyTest(journey: UserJourney): Promise<JourneyTestResult> {
    const testId = `journey-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const abortController = new AbortController();
    this.activeTests.set(testId, abortController);

    console.log(`Starting user journey test: ${journey.name}`);

    const result: JourneyTestResult = {
      id: testId,
      journeyId: journey.id,
      journeyName: journey.name,
      startTime: Date.now(),
      endTime: 0,
      totalDuration: 0,
      success: false,
      stepResults: [],
      performanceMetrics: this.initializePerformanceMetrics(),
      screenshots: [],
      errors: [],
      networkRequests: []
    };

    try {
      // Start performance monitoring
      const performanceMonitor = this.startPerformanceMonitoring();
      
      // Start network monitoring
      const networkMonitor = this.startNetworkMonitoring();

      // Execute journey steps
      for (const step of journey.steps) {
        if (abortController.signal.aborted) break;

        const stepResult = await this.executeJourneyStep(step, result, abortController.signal);
        result.stepResults.push(stepResult);

        if (!stepResult.success && journey.criticalPath) {
          result.errors.push({
            stepId: step.id,
            stepName: step.name,
            timestamp: Date.now(),
            error: stepResult.error || 'Step failed'
          });
          break;
        }
      }

      // Stop monitoring
      result.performanceMetrics = await performanceMonitor.stop();
      result.networkRequests = await networkMonitor.stop();

      result.endTime = Date.now();
      result.totalDuration = result.endTime - result.startTime;
      result.success = result.stepResults.every(step => step.success) && result.errors.length === 0;

      // Validate overall journey performance
      this.validateJourneyPerformance(journey, result);

      this.testResults.push(result);

      console.log(`Journey test completed: ${journey.name}`, {
        success: result.success,
        duration: result.totalDuration,
        steps: result.stepResults.length
      });

      return result;

    } catch (error) {
      console.error(`Journey test failed: ${journey.name}`, error);
      result.endTime = Date.now();
      result.totalDuration = result.endTime - result.startTime;
      result.errors.push({
        stepId: 'system',
        stepName: 'test-execution',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      });
      return result;
    } finally {
      this.activeTests.delete(testId);
    }
  }

  /**
   * Execute individual journey step
   */
  private async executeJourneyStep(
    step: JourneyStep,
    journeyResult: JourneyTestResult,
    signal: AbortSignal
  ): Promise<StepResult> {
    const stepResult: StepResult = {
      stepId: step.id,
      stepName: step.name,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      success: false,
      validationResults: [],
      performanceMetrics: {
        duration: 0,
        domChanges: 0,
        networkRequests: 0,
        jsExecutionTime: 0,
        renderTime: 0
      }
    };

    try {
      console.log(`Executing step: ${step.name}`);

      // Start step performance monitoring
      const stepMonitor = this.startStepMonitoring();

      // Execute the action
      await this.executeAction(step.action, step, signal);

      // Wait for completion if specified
      if (step.waitFor) {
        await this.waitForCondition(step.waitFor, step);
      }

      // Take screenshot if requested
      if (step.screenshot) {
        const screenshot = await this.takeScreenshot(step.name);
        if (screenshot) {
          journeyResult.screenshots.push(screenshot);
        }
      }

      // Run validations
      if (step.validation) {
        const validationResult = await this.runValidation(step.validation, step);
        stepResult.validationResults.push(validationResult);
        
        if (!validationResult.success) {
          stepResult.error = `Validation failed: ${validationResult.error}`;
        }
      }

      // Stop step monitoring
      stepResult.performanceMetrics = await stepMonitor.stop();

      stepResult.endTime = Date.now();
      stepResult.duration = stepResult.endTime - stepResult.startTime;
      stepResult.success = stepResult.validationResults.every(v => v.success) && !stepResult.error;

      // Check if step exceeded expected duration
      if (stepResult.duration > step.expectedDuration * 1.5) {
        console.warn(`Step ${step.name} took ${stepResult.duration}ms, expected ${step.expectedDuration}ms`);
      }

      return stepResult;

    } catch (error) {
      stepResult.endTime = Date.now();
      stepResult.duration = stepResult.endTime - stepResult.startTime;
      stepResult.error = error instanceof Error ? error.message : String(error);
      stepResult.success = false;
      
      console.error(`Step failed: ${step.name}`, error);
      return stepResult;
    }
  }

  /**
   * Execute journey action
   */
  private async executeAction(action: JourneyAction, step: JourneyStep, signal: AbortSignal): Promise<void> {
    switch (action.type) {
      case 'navigate':
        if (step.url) {
          window.location.href = step.url;
          await this.waitForPageLoad();
        }
        break;

      case 'click':
        if (action.target) {
          const element = document.querySelector(action.target);
          if (element) {
            (element as HTMLElement).click();
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for click processing
          } else {
            throw new Error(`Element not found: ${action.target}`);
          }
        }
        break;

      case 'type':
        if (action.target && action.value) {
          const element = document.querySelector(action.target) as HTMLInputElement;
          if (element) {
            element.value = action.value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            throw new Error(`Input element not found: ${action.target}`);
          }
        }
        break;

      case 'wait':
        const waitTime = typeof action.value === 'number' ? action.value : 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        break;

      case 'scroll':
        if (action.target) {
          const element = document.querySelector(action.target);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } else {
          window.scrollTo({ top: action.value || 0, behavior: 'smooth' });
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        break;

      case 'api-call':
        if (step.url) {
          const response = await fetch(step.url, {
            method: action.value?.method || 'GET',
            headers: action.value?.headers || {},
            body: action.value?.body ? JSON.stringify(action.value.body) : undefined,
            signal
          });
          
          if (!response.ok) {
            throw new Error(`API call failed: ${response.status} ${response.statusText}`);
          }
        }
        break;

      case 'custom':
        // Allow custom action execution
        if (action.options?.customFunction) {
          await action.options.customFunction(step, signal);
        }
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Wait for condition
   */
  private async waitForCondition(condition: string | number, step: JourneyStep): Promise<void> {
    if (typeof condition === 'number') {
      await new Promise(resolve => setTimeout(resolve, condition));
      return;
    }

    // Wait for element to appear
    const timeout = 10000; // 10 seconds timeout
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(condition);
      if (element) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for condition: ${condition}`);
  }

  /**
   * Run validation
   */
  private async runValidation(validation: JourneyValidation, step: JourneyStep): Promise<ValidationResult> {
    const result: ValidationResult = {
      type: validation.type,
      target: validation.target,
      expected: validation.expected,
      actual: null,
      success: false
    };

    try {
      switch (validation.type) {
        case 'element-exists':
          const element = document.querySelector(validation.target);
          result.actual = !!element;
          result.success = result.actual === validation.expected;
          break;

        case 'text-contains':
          const textElement = document.querySelector(validation.target);
          result.actual = textElement?.textContent || '';
          result.success = result.actual.includes(validation.expected);
          break;

        case 'url-matches':
          result.actual = window.location.href;
          result.success = result.actual.includes(validation.expected);
          break;

        case 'performance-metric':
          // Validate performance metrics
          const metric = await this.getPerformanceMetric(validation.target);
          result.actual = metric;
          result.success = metric <= validation.expected;
          break;

        default:
          result.error = `Unknown validation type: ${validation.type}`;
      }

      if (!result.success && !result.error) {
        result.error = `Expected ${validation.expected}, got ${result.actual}`;
      }

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.success = false;
    }

    return result;
  }

  /**
   * Get performance metric
   */
  private async getPerformanceMetric(metricName: string): Promise<number> {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    switch (metricName) {
      case 'domContentLoaded':
        return navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
      case 'loadComplete':
        return navigation.loadEventEnd - navigation.loadEventStart;
      case 'firstContentfulPaint':
        const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
        return fcpEntry ? fcpEntry.startTime : 0;
      default:
        return 0;
    }
  }

  /**
   * Take screenshot (simulated)
   */
  private async takeScreenshot(stepName: string): Promise<string | null> {
    try {
      // In a real implementation, this would capture actual screenshots
      // For now, we'll return a placeholder
      return `screenshot-${stepName}-${Date.now()}.png`;
    } catch (error) {
      console.error('Failed to take screenshot:', error);
      return null;
    }
  }

  /**
   * Wait for page load
   */
  private async waitForPageLoad(): Promise<void> {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', () => resolve(), { once: true });
      }
    });
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): { stop: () => Promise<JourneyPerformanceMetrics> } {
    const startTime = performance.now();
    
    return {
      stop: async (): Promise<JourneyPerformanceMetrics> => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paintEntries = performance.getEntriesByType('paint');
        
        const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        const lcp = paintEntries.find(entry => entry.name === 'largest-contentful-paint');

        return {
          firstContentfulPaint: fcp ? fcp.startTime : 0,
          largestContentfulPaint: lcp ? lcp.startTime : 0,
          cumulativeLayoutShift: 0, // Would need Layout Instability API
          firstInputDelay: 0, // Would need Event Timing API
          totalBlockingTime: 0, // Would need Long Tasks API
          timeToInteractive: navigation.domInteractive - navigation.navigationStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
          jsHeapSize: (performance as any).memory?.totalJSHeapSize || 0
        };
      }
    };
  }

  /**
   * Start step monitoring
   */
  private startStepMonitoring(): { stop: () => Promise<StepPerformanceMetrics> } {
    const startTime = performance.now();
    const initialDomNodes = document.querySelectorAll('*').length;
    
    return {
      stop: async (): Promise<StepPerformanceMetrics> => {
        const endTime = performance.now();
        const finalDomNodes = document.querySelectorAll('*').length;
        
        return {
          duration: endTime - startTime,
          domChanges: Math.abs(finalDomNodes - initialDomNodes),
          networkRequests: 0, // Would be tracked by network monitor
          jsExecutionTime: 0, // Would need User Timing API
          renderTime: 0 // Would need Paint Timing API
        };
      }
    };
  }

  /**
   * Start network monitoring
   */
  private startNetworkMonitoring(): { stop: () => Promise<NetworkRequest[]> } {
    const requests: NetworkRequest[] = [];
    const startTime = Date.now();

    // In a real implementation, this would intercept network requests
    // For now, we'll return empty array
    
    return {
      stop: async (): Promise<NetworkRequest[]> => {
        return requests;
      }
    };
  }

  /**
   * Initialize performance metrics
   */
  private initializePerformanceMetrics(): JourneyPerformanceMetrics {
    return {
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      cumulativeLayoutShift: 0,
      firstInputDelay: 0,
      totalBlockingTime: 0,
      timeToInteractive: 0,
      domContentLoaded: 0,
      loadComplete: 0,
      memoryUsage: 0,
      jsHeapSize: 0
    };
  }

  /**
   * Validate journey performance
   */
  private validateJourneyPerformance(journey: UserJourney, result: JourneyTestResult): void {
    // Check if journey exceeded expected duration
    if (result.totalDuration > journey.expectedDuration * 1.2) {
      result.errors.push({
        stepId: 'performance',
        stepName: 'journey-duration',
        timestamp: Date.now(),
        error: `Journey took ${result.totalDuration}ms, expected ${journey.expectedDuration}ms`
      });
    }

    // Check Core Web Vitals
    if (result.performanceMetrics.largestContentfulPaint > 2500) {
      result.errors.push({
        stepId: 'performance',
        stepName: 'lcp-threshold',
        timestamp: Date.now(),
        error: `LCP ${result.performanceMetrics.largestContentfulPaint}ms exceeds 2500ms threshold`
      });
    }

    if (result.performanceMetrics.cumulativeLayoutShift > 0.1) {
      result.errors.push({
        stepId: 'performance',
        stepName: 'cls-threshold',
        timestamp: Date.now(),
        error: `CLS ${result.performanceMetrics.cumulativeLayoutShift} exceeds 0.1 threshold`
      });
    }
  }

  /**
   * Create predefined user journeys
   */
  public createDashboardJourney(): UserJourney {
    return {
      id: 'dashboard-journey',
      name: 'Dashboard Load Journey',
      description: 'Complete user journey from login to dashboard interaction',
      expectedDuration: 10000, // 10 seconds
      criticalPath: true,
      steps: [
        {
          id: 'navigate-home',
          name: 'Navigate to Home',
          action: { type: 'navigate' },
          url: 'http://localhost:5173',
          expectedDuration: 2000,
          validation: {
            type: 'element-exists',
            target: 'body',
            expected: true
          },
          screenshot: true
        },
        {
          id: 'wait-for-auth',
          name: 'Wait for Authentication Check',
          action: { type: 'wait', value: 1000 },
          expectedDuration: 1000
        },
        {
          id: 'navigate-dashboard',
          name: 'Navigate to Dashboard',
          action: { type: 'navigate' },
          url: 'http://localhost:5173/dashboard',
          expectedDuration: 3000,
          validation: {
            type: 'url-matches',
            target: 'url',
            expected: '/dashboard'
          },
          screenshot: true
        },
        {
          id: 'wait-dashboard-load',
          name: 'Wait for Dashboard Load',
          action: { type: 'wait', value: 2000 },
          expectedDuration: 2000,
          validation: {
            type: 'element-exists',
            target: '[data-testid="dashboard-content"]',
            expected: true
          }
        },
        {
          id: 'validate-performance',
          name: 'Validate Dashboard Performance',
          action: { type: 'wait', value: 500 },
          expectedDuration: 500,
          validation: {
            type: 'performance-metric',
            target: 'domContentLoaded',
            expected: 3000
          }
        }
      ]
    };
  }

  public createUserInteractionJourney(): UserJourney {
    return {
      id: 'user-interaction-journey',
      name: 'User Interaction Journey',
      description: 'User interactions with dashboard components',
      expectedDuration: 15000, // 15 seconds
      criticalPath: false,
      steps: [
        {
          id: 'navigate-dashboard',
          name: 'Navigate to Dashboard',
          action: { type: 'navigate' },
          url: 'http://localhost:5173/dashboard',
          expectedDuration: 3000,
          validation: {
            type: 'element-exists',
            target: '[data-testid="dashboard-content"]',
            expected: true
          }
        },
        {
          id: 'click-top-songs',
          name: 'Click Top Songs Section',
          action: { type: 'click', target: '[data-testid="top-songs-section"]' },
          expectedDuration: 1000,
          validation: {
            type: 'element-exists',
            target: '[data-testid="top-songs-expanded"]',
            expected: true
          }
        },
        {
          id: 'scroll-to-charts',
          name: 'Scroll to Charts',
          action: { type: 'scroll', target: '[data-testid="charts-section"]' },
          expectedDuration: 1000
        },
        {
          id: 'interact-with-chart',
          name: 'Interact with Chart',
          action: { type: 'click', target: '[data-testid="chart-legend"]' },
          expectedDuration: 500
        },
        {
          id: 'navigate-ranking',
          name: 'Navigate to Ranking',
          action: { type: 'navigate' },
          url: 'http://localhost:5173/ranking',
          expectedDuration: 2000,
          validation: {
            type: 'url-matches',
            target: 'url',
            expected: '/ranking'
          }
        }
      ]
    };
  }

  /**
   * Run multiple journeys
   */
  public async runMultipleJourneys(journeys: UserJourney[]): Promise<JourneyTestResult[]> {
    const results: JourneyTestResult[] = [];
    
    for (const journey of journeys) {
      try {
        const result = await this.runJourneyTest(journey);
        results.push(result);
      } catch (error) {
        console.error(`Failed to run journey ${journey.name}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Get test results
   */
  public getTestResults(): JourneyTestResult[] {
    return [...this.testResults];
  }

  /**
   * Clear test history
   */
  public clearTestHistory(): void {
    this.testResults = [];
  }

  /**
   * Export results
   */
  public exportResults(): string {
    return JSON.stringify({
      journeyResults: this.testResults,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }
}

// Create singleton instance
export const userJourneyTestingService = new UserJourneyTestingService();