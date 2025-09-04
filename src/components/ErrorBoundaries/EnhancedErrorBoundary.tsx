import React, { Component, ErrorInfo, ReactNode } from 'react';
import { LoadingPriority } from '../../types/progressive-loading';

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  sectionId?: string;
  priority?: LoadingPriority;
  fallback?: ReactNode;
  retryConfig?: Partial<RetryConfig>;
  onError?: (error: Error, errorInfo: ErrorInfo, sectionId?: string) => void;
  onRetry?: (attempt: number, sectionId?: string) => void;
  onMaxRetriesReached?: (sectionId?: string) => void;
  enableAutoRetry?: boolean;
  showErrorDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
  isRetrying: boolean;
  lastRetryTime?: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2
};

export class EnhancedErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId?: NodeJS.Timeout;
  private retryConfig: RetryConfig;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0,
      isRetrying: false
    };
    
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...props.retryConfig };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary caught an error in section ${this.props.sectionId}:`, error, errorInfo);
    
    this.setState({ errorInfo });
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo, this.props.sectionId);
    
    // Start auto-retry if enabled
    if (this.props.enableAutoRetry && this.state.retryCount < this.retryConfig.maxRetries) {
      this.scheduleRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private calculateRetryDelay = (attempt: number): number => {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
      this.retryConfig.maxDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return delay + jitter;
  };

  private scheduleRetry = () => {
    const delay = this.calculateRetryDelay(this.state.retryCount);
    
    this.setState({ isRetrying: true });
    
    this.retryTimeoutId = setTimeout(() => {
      this.handleRetry();
    }, delay);
  };

  private handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1;
    
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: newRetryCount,
      isRetrying: false,
      lastRetryTime: Date.now()
    });
    
    this.props.onRetry?.(newRetryCount, this.props.sectionId);
    
    if (newRetryCount >= this.retryConfig.maxRetries) {
      this.props.onMaxRetriesReached?.(this.props.sectionId);
    }
  };

  private handleManualRetry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
    
    this.handleRetry();
  };

  private handleReset = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
    
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0,
      isRetrying: false,
      lastRetryTime: undefined
    });
  };

  private getPriorityColor = (): string => {
    switch (this.props.priority) {
      case 'essential':
        return 'red';
      case 'secondary':
        return 'orange';
      case 'optional':
        return 'yellow';
      default:
        return 'red';
    }
  };

  private getPriorityMessage = (): string => {
    switch (this.props.priority) {
      case 'essential':
        return 'This is a critical component that affects core functionality.';
      case 'secondary':
        return 'This component provides important features but the app can continue without it.';
      case 'optional':
        return 'This is an optional enhancement that can be loaded later.';
      default:
        return 'An error occurred in this component.';
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const color = this.getPriorityColor();
      const canRetry = this.state.retryCount < this.retryConfig.maxRetries;
      const isAutoRetrying = this.props.enableAutoRetry && canRetry && this.state.isRetrying;

      // Section-specific error UI
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
          <div className="flex items-start space-x-4">
            {/* Error Icon */}
            <div className={`flex-shrink-0 w-10 h-10 bg-${color}-100 dark:bg-${color}-900 rounded-full flex items-center justify-center`}>
              <svg
                className={`w-5 h-5 text-${color}-600 dark:text-${color}-400`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              {/* Error Header */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {this.props.sectionId ? `Error in ${this.props.sectionId}` : 'Component Error'}
                </h3>
                {this.props.priority && (
                  <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${color}-100 text-${color}-800 dark:bg-${color}-900 dark:text-${color}-200`}>
                    {this.props.priority}
                  </span>
                )}
              </div>

              {/* Error Message */}
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                {this.getPriorityMessage()}
              </p>

              {/* Retry Information */}
              {this.state.retryCount > 0 && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Retry attempts: {this.state.retryCount} / {this.retryConfig.maxRetries}
                  </p>
                  {this.state.lastRetryTime && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Last retry: {new Date(this.state.lastRetryTime).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              )}

              {/* Auto-retry indicator */}
              {isAutoRetrying && (
                <div className="mb-4 flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
                  <span>Retrying automatically...</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                {canRetry && !isAutoRetrying && (
                  <button
                    onClick={this.handleManualRetry}
                    className={`px-4 py-2 text-sm font-medium text-white bg-${color}-600 hover:bg-${color}-700 rounded-md transition-colors`}
                  >
                    Retry Now
                  </button>
                )}
                
                <button
                  onClick={this.handleReset}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md transition-colors"
                >
                  Reset
                </button>

                {this.props.priority !== 'essential' && (
                  <button
                    onClick={() => {
                      // Hide this section and continue
                      this.setState({ hasError: false });
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    Continue Without This Section
                  </button>
                )}
              </div>

              {/* Error Details (Development) */}
              {(this.props.showErrorDetails || process.env.NODE_ENV === 'development') && this.state.error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
                    Error Details
                  </summary>
                  <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                      {this.state.error.name}: {this.state.error.message}
                    </p>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-32">
                      {this.state.error.stack}
                    </pre>
                    {this.state.errorInfo && (
                      <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-32">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for handling errors in functional components
export const useErrorRecovery = (sectionId?: string) => {
  const [error, setError] = React.useState<Error | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleError = React.useCallback((error: Error) => {
    console.error(`Error in section ${sectionId}:`, error);
    setError(error);
  }, [sectionId]);

  const retry = React.useCallback(async (retryFn?: () => Promise<void>) => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    
    try {
      if (retryFn) {
        await retryFn();
      }
      setError(null);
    } catch (newError) {
      setError(newError as Error);
    } finally {
      setIsRetrying(false);
    }
  }, []);

  const reset = React.useCallback(() => {
    setError(null);
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  return {
    error,
    retryCount,
    isRetrying,
    handleError,
    retry,
    reset,
    hasError: error !== null
  };
};