interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryCondition: (error) => {
    // Retry on network errors, 5xx errors, and timeouts
    if (error?.name === 'NetworkError') return true;
    if (error?.status >= 500) return true;
    if (error?.code === 'TIMEOUT') return true;
    if (error?.message?.includes('timeout')) return true;
    if (error?.message?.includes('network')) return true;
    return false;
  }
};

export class RetryService {
  private static calculateDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    backoffMultiplier: number,
    jitter: boolean
  ): number {
    let delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt), maxDelay);
    
    if (jitter) {
      // Add ±25% jitter to prevent thundering herd
      const jitterAmount = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }
    
    return Math.max(delay, 0);
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<RetryResult<T>> {
    const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
    const startTime = Date.now();
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const data = await operation();
        return {
          success: true,
          data,
          attempts: attempt + 1,
          totalTime: Date.now() - startTime
        };
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry if this is the last attempt
        if (attempt === config.maxRetries) {
          break;
        }
        
        // Check if we should retry this error
        if (config.retryCondition && !config.retryCondition(error)) {
          break;
        }
        
        // Call retry callback
        config.onRetry?.(attempt + 1, error);
        
        // Calculate delay and wait
        const delay = this.calculateDelay(
          attempt,
          config.baseDelay,
          config.maxDelay,
          config.backoffMultiplier,
          config.jitter
        );
        
        await this.sleep(delay);
      }
    }
    
    return {
      success: false,
      error: lastError,
      attempts: config.maxRetries + 1,
      totalTime: Date.now() - startTime
    };
  }

  // Specialized retry for API calls
  static async retryApiCall<T>(
    apiCall: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const apiRetryOptions: Partial<RetryOptions> = {
      maxRetries: 3,
      baseDelay: 1000,
      backoffMultiplier: 2,
      retryCondition: (error) => {
        // Retry on network errors and 5xx status codes
        if (error?.response?.status >= 500) return true;
        if (error?.code === 'NETWORK_ERROR') return true;
        if (error?.message?.includes('timeout')) return true;
        return false;
      },
      ...options
    };

    const result = await this.withRetry(apiCall, apiRetryOptions);
    
    if (result.success && result.data !== undefined) {
      return result.data;
    }
    
    throw result.error || new Error('API call failed after retries');
  }

  // Specialized retry for database operations
  static async retryDatabaseOperation<T>(
    dbOperation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const dbRetryOptions: Partial<RetryOptions> = {
      maxRetries: 2,
      baseDelay: 500,
      backoffMultiplier: 2,
      retryCondition: (error) => {
        // Retry on connection errors and timeouts
        if (error?.code === 'ECONNRESET') return true;
        if (error?.code === 'ETIMEDOUT') return true;
        if (error?.message?.includes('connection')) return true;
        return false;
      },
      ...options
    };

    const result = await this.withRetry(dbOperation, dbRetryOptions);
    
    if (result.success && result.data !== undefined) {
      return result.data;
    }
    
    throw result.error || new Error('Database operation failed after retries');
  }

  // Retry with circuit breaker pattern
  static createCircuitBreaker<T>(
    operation: () => Promise<T>,
    options: {
      failureThreshold: number;
      resetTimeout: number;
      retryOptions?: Partial<RetryOptions>;
    }
  ) {
    let failures = 0;
    let lastFailureTime = 0;
    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    return async (): Promise<T> => {
      const now = Date.now();

      // Check if circuit should be reset
      if (state === 'OPEN' && now - lastFailureTime > options.resetTimeout) {
        state = 'HALF_OPEN';
        failures = 0;
      }

      // Reject immediately if circuit is open
      if (state === 'OPEN') {
        throw new Error('Circuit breaker is OPEN');
      }

      try {
        const result = await this.withRetry(operation, options.retryOptions);
        
        if (result.success) {
          // Reset on success
          failures = 0;
          state = 'CLOSED';
          return result.data!;
        } else {
          throw result.error;
        }
      } catch (error) {
        failures++;
        lastFailureTime = now;

        if (failures >= options.failureThreshold) {
          state = 'OPEN';
        }

        throw error;
      }
    };
  }
}

// Hook for using retry service in React components
export const useRetry = () => {
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  const [lastError, setLastError] = React.useState<Error | null>(null);

  const retry = React.useCallback(async <T>(
    operation: () => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<T> => {
    setIsRetrying(true);
    setLastError(null);

    try {
      const result = await RetryService.withRetry(operation, {
        ...options,
        onRetry: (attempt, error) => {
          setRetryCount(attempt);
          options?.onRetry?.(attempt, error);
        }
      });

      if (result.success && result.data !== undefined) {
        setRetryCount(0);
        return result.data;
      } else {
        setLastError(result.error || new Error('Operation failed'));
        throw result.error;
      }
    } finally {
      setIsRetrying(false);
    }
  }, []);

  const reset = React.useCallback(() => {
    setIsRetrying(false);
    setRetryCount(0);
    setLastError(null);
  }, []);

  return {
    retry,
    isRetrying,
    retryCount,
    lastError,
    reset
  };
};

// Utility functions for common retry scenarios
export const retryUtils = {
  // Retry a fetch request
  async fetchWithRetry(url: string, options?: RequestInit, retryOptions?: Partial<RetryOptions>) {
    return RetryService.retryApiCall(
      () => fetch(url, options).then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
      }),
      retryOptions
    );
  },

  // Retry a JSON fetch
  async fetchJsonWithRetry<T>(url: string, options?: RequestInit, retryOptions?: Partial<RetryOptions>): Promise<T> {
    const response = await this.fetchWithRetry(url, options, retryOptions);
    return response.json();
  },

  // Retry with exponential backoff and jitter
  async exponentialBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    return RetryService.retryApiCall(operation, {
      maxRetries,
      baseDelay,
      backoffMultiplier: 2,
      jitter: true
    });
  }
};

export default RetryService;