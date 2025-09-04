import React from 'react';
import { EnhancedErrorBoundary } from './EnhancedErrorBoundary';
import { LoadingPriority } from '../../types/progressive-loading';
import { CompactLoader, SkeletonWithProgress } from '../LoadingStates/LoadingStateComponents';

interface SectionErrorBoundaryProps {
  children: React.ReactNode;
  sectionId: string;
  priority: LoadingPriority;
  onError?: (error: Error, sectionId: string) => void;
  onRetry?: (attempt: number, sectionId: string) => void;
  onMaxRetriesReached?: (sectionId: string) => void;
}

// Dashboard Metrics Error Boundary
export const MetricsErrorBoundary: React.FC<SectionErrorBoundaryProps> = ({
  children,
  sectionId,
  onError,
  onRetry,
  onMaxRetriesReached
}) => {
  const fallback = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-red-200 dark:border-red-800">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Metric Unavailable</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Failed to load metric data</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <EnhancedErrorBoundary
      sectionId={sectionId}
      priority="essential"
      fallback={fallback}
      enableAutoRetry={true}
      retryConfig={{ maxRetries: 3, baseDelay: 2000 }}
      onError={(error, errorInfo) => onError?.(error, sectionId)}
      onRetry={(attempt) => onRetry?.(attempt, sectionId)}
      onMaxRetriesReached={() => onMaxRetriesReached?.(sectionId)}
    >
      {children}
    </EnhancedErrorBoundary>
  );
};

// Chart Error Boundary
export const ChartErrorBoundary: React.FC<SectionErrorBoundaryProps> = ({
  children,
  sectionId,
  onError,
  onRetry,
  onMaxRetriesReached
}) => {
  const fallback = (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-orange-200 dark:border-orange-800">
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Chart Unavailable</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Unable to load chart data at this time</p>
        </div>
      </div>
    </div>
  );

  return (
    <EnhancedErrorBoundary
      sectionId={sectionId}
      priority="secondary"
      fallback={fallback}
      enableAutoRetry={true}
      retryConfig={{ maxRetries: 2, baseDelay: 3000 }}
      onError={(error, errorInfo) => onError?.(error, sectionId)}
      onRetry={(attempt) => onRetry?.(attempt, sectionId)}
      onMaxRetriesReached={() => onMaxRetriesReached?.(sectionId)}
    >
      {children}
    </EnhancedErrorBoundary>
  );
};

// List Error Boundary (for top songs, radios, etc.)
export const ListErrorBoundary: React.FC<SectionErrorBoundaryProps> = ({
  children,
  sectionId,
  onError,
  onRetry,
  onMaxRetriesReached
}) => {
  const fallback = (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-yellow-200 dark:border-yellow-800">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">List Unavailable</h3>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Data unavailable</span>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">--</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <EnhancedErrorBoundary
      sectionId={sectionId}
      priority="secondary"
      fallback={fallback}
      enableAutoRetry={true}
      retryConfig={{ maxRetries: 2, baseDelay: 1500 }}
      onError={(error, errorInfo) => onError?.(error, sectionId)}
      onRetry={(attempt) => onRetry?.(attempt, sectionId)}
      onMaxRetriesReached={() => onMaxRetriesReached?.(sectionId)}
    >
      {children}
    </EnhancedErrorBoundary>
  );
};

// Optional Features Error Boundary
export const OptionalErrorBoundary: React.FC<SectionErrorBoundaryProps> = ({
  children,
  sectionId,
  onError,
  onRetry,
  onMaxRetriesReached
}) => {
  const fallback = (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 opacity-75">
      <div className="flex items-center justify-center h-32 space-x-3">
        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Optional feature unavailable</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">This section will be hidden</p>
        </div>
      </div>
    </div>
  );

  return (
    <EnhancedErrorBoundary
      sectionId={sectionId}
      priority="optional"
      fallback={fallback}
      enableAutoRetry={false} // Don't auto-retry optional features
      retryConfig={{ maxRetries: 1, baseDelay: 5000 }}
      onError={(error, errorInfo) => onError?.(error, sectionId)}
      onRetry={(attempt) => onRetry?.(attempt, sectionId)}
      onMaxRetriesReached={() => onMaxRetriesReached?.(sectionId)}
    >
      {children}
    </EnhancedErrorBoundary>
  );
};

// Query Error Boundary with retry logic
export const QueryErrorBoundary: React.FC<{
  children: React.ReactNode;
  queryKey: string;
  onRetry?: () => void;
  fallbackComponent?: React.ComponentType<{ onRetry: () => void; error: Error }>;
}> = ({ children, queryKey, onRetry, fallbackComponent: FallbackComponent }) => {
  const [error, setError] = React.useState<Error | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);

  const handleRetry = React.useCallback(() => {
    setError(null);
    setRetryCount(prev => prev + 1);
    onRetry?.();
  }, [onRetry]);

  const handleError = React.useCallback((error: Error) => {
    console.error(`Query error for ${queryKey}:`, error);
    setError(error);
  }, [queryKey]);

  // Reset error when children change (successful retry)
  React.useEffect(() => {
    if (error) {
      setError(null);
    }
  }, [children]);

  if (error) {
    if (FallbackComponent) {
      return <FallbackComponent onRetry={handleRetry} error={error} />;
    }

    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-red-200 dark:border-red-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Failed to load data</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {retryCount > 0 ? `Retry attempt ${retryCount}` : 'Click to retry'}
              </p>
            </div>
          </div>
          <button
            onClick={handleRetry}
            className="px-3 py-1 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundaryWrapper onError={handleError}>
      {children}
    </ErrorBoundaryWrapper>
  );
};

// Simple wrapper to catch errors and pass them to parent
class ErrorBoundaryWrapper extends React.Component<{
  children: React.ReactNode;
  onError: (error: Error) => void;
}, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return null; // Let parent handle the error display
    }
    return this.props.children;
  }
}