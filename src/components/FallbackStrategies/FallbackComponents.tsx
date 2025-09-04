import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingPriority } from '../../types/progressive-loading';
import { CompactLoader, SkeletonWithProgress } from '../LoadingStates/LoadingStateComponents';
import { useOfflineCache } from '../../hooks/useOfflineCache';

interface FallbackDataProps {
  queryKey: readonly unknown[];
  queryFn: () => Promise<any>;
  fallbackData?: any;
  priority: LoadingPriority;
  children: (data: any, status: FallbackStatus) => React.ReactNode;
  onFallback?: (reason: string) => void;
  gracefulDegradation?: boolean;
}

interface FallbackStatus {
  isUsingFallback: boolean;
  isOffline: boolean;
  isStale: boolean;
  lastUpdated?: number;
  fallbackReason?: string;
}

// Main fallback data component with graceful degradation
export const FallbackDataProvider: React.FC<FallbackDataProps> = ({
  queryKey,
  queryFn,
  fallbackData,
  priority,
  children,
  onFallback,
  gracefulDegradation = true
}) => {
  const [fallbackStatus, setFallbackStatus] = useState<FallbackStatus>({
    isUsingFallback: false,
    isOffline: false,
    isStale: false
  });

  const { isOffline, getCachedData } = useOfflineCache();

  const {
    data,
    error,
    isLoading,
    isError,
    dataUpdatedAt
  } = useQuery({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry if offline
      if (isOffline) return false;
      // Retry network errors up to 2 times
      return failureCount < 2 && (error as any)?.code === 'NETWORK_ERROR';
    },
    onError: (error) => {
      console.error('Query failed, attempting fallback:', error);
      handleFallback('query_error');
    }
  });

  const handleFallback = (reason: string) => {
    let fallbackDataToUse = fallbackData;
    let isStale = false;

    // Try to get cached data first
    if (!fallbackDataToUse) {
      const cachedData = getCachedData(queryKey);
      if (cachedData) {
        fallbackDataToUse = cachedData.data;
        isStale = Date.now() - cachedData.timestamp > 30 * 60 * 1000; // 30 minutes
      }
    }

    if (fallbackDataToUse) {
      setFallbackStatus({
        isUsingFallback: true,
        isOffline,
        isStale,
        lastUpdated: dataUpdatedAt,
        fallbackReason: reason
      });
      onFallback?.(reason);
    }
  };

  // Reset fallback status when data is successfully loaded
  useEffect(() => {
    if (data && !isError) {
      setFallbackStatus({
        isUsingFallback: false,
        isOffline,
        isStale: false,
        lastUpdated: dataUpdatedAt
      });
    }
  }, [data, isError, isOffline, dataUpdatedAt]);

  // Handle offline state
  useEffect(() => {
    if (isOffline && !data && !fallbackStatus.isUsingFallback) {
      handleFallback('offline');
    }
  }, [isOffline, data, fallbackStatus.isUsingFallback]);

  // Determine what data to show
  const dataToShow = data || (fallbackStatus.isUsingFallback ? fallbackData : null);

  if (isLoading && !dataToShow) {
    return (
      <div className="space-y-4">
        <CompactLoader message="Loading data..." />
        {gracefulDegradation && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            Preparing fallback if needed...
          </div>
        )}
      </div>
    );
  }

  if (isError && !dataToShow && !gracefulDegradation) {
    throw error; // Let error boundary handle it
  }

  if (!dataToShow && gracefulDegradation) {
    return <GracefulDegradationFallback priority={priority} error={error} />;
  }

  return (
    <>
      {children(dataToShow, fallbackStatus)}
      {fallbackStatus.isUsingFallback && (
        <FallbackIndicator status={fallbackStatus} priority={priority} />
      )}
    </>
  );
};

// Graceful degradation fallback for when no data is available
export const GracefulDegradationFallback: React.FC<{
  priority: LoadingPriority;
  error?: Error;
}> = ({ priority, error }) => {
  const getMessage = () => {
    switch (priority) {
      case 'essential':
        return 'Core functionality is temporarily unavailable. Please try refreshing the page.';
      case 'secondary':
        return 'Some features are temporarily unavailable. The main functionality continues to work.';
      case 'optional':
        return 'This optional feature is currently unavailable.';
      default:
        return 'This section is temporarily unavailable.';
    }
  };

  const getIcon = () => {
    switch (priority) {
      case 'essential':
        return (
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'secondary':
        return (
          <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'optional':
        return (
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (priority === 'optional') {
    // For optional features, just hide them gracefully
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center space-x-4">
        {getIcon()}
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Temporarily Unavailable
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {getMessage()}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
};

// Indicator to show when fallback data is being used
export const FallbackIndicator: React.FC<{
  status: FallbackStatus;
  priority: LoadingPriority;
}> = ({ status, priority }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!status.isUsingFallback || !isVisible) {
    return null;
  }

  const getIndicatorColor = () => {
    if (status.isOffline) return 'bg-red-100 text-red-800 border-red-200';
    if (status.isStale) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getIndicatorMessage = () => {
    if (status.isOffline) return 'Showing offline data';
    if (status.isStale) return 'Showing cached data (may be outdated)';
    return 'Showing fallback data';
  };

  return (
    <div className={`mt-2 p-2 rounded-md border text-sm flex items-center justify-between ${getIndicatorColor()}`}>
      <div className="flex items-center space-x-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{getIndicatorMessage()}</span>
        {status.lastUpdated && (
          <span className="text-xs opacity-75">
            (Last updated: {new Date(status.lastUpdated).toLocaleTimeString()})
          </span>
        )}
      </div>
      <button
        onClick={() => setIsVisible(false)}
        className="ml-2 text-xs opacity-75 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
};

// Partial loading state for when some data is available but not all
export const PartialLoadingState: React.FC<{
  availableData: any;
  missingDataSections: string[];
  children: (data: any) => React.ReactNode;
}> = ({ availableData, missingDataSections, children }) => {
  return (
    <div className="space-y-4">
      {children(availableData)}
      
      {missingDataSections.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Partial Data Available
            </h4>
          </div>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
            Some sections are still loading or unavailable:
          </p>
          <ul className="text-sm text-yellow-600 dark:text-yellow-400 list-disc list-inside">
            {missingDataSections.map((section, index) => (
              <li key={index}>{section}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Offline mode indicator
export const OfflineModeIndicator: React.FC<{
  isOffline: boolean;
  onRetry?: () => void;
}> = ({ isOffline, onRetry }) => {
  if (!isOffline) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-3">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728" />
      </svg>
      <span className="text-sm font-medium">You're offline</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs bg-red-700 hover:bg-red-800 px-2 py-1 rounded transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
};

// Progressive enhancement wrapper
export const ProgressiveEnhancement: React.FC<{
  children: React.ReactNode;
  fallback: React.ReactNode;
  condition: boolean;
  priority: LoadingPriority;
}> = ({ children, fallback, condition, priority }) => {
  // For essential features, always try to render
  if (priority === 'essential') {
    return <>{condition ? children : fallback}</>;
  }

  // For secondary features, show fallback if condition fails
  if (priority === 'secondary') {
    return <>{condition ? children : fallback}</>;
  }

  // For optional features, hide completely if condition fails
  if (priority === 'optional' && !condition) {
    return null;
  }

  return <>{children}</>;
};

// Smart fallback wrapper that automatically handles different scenarios
export const SmartFallback: React.FC<{
  children: React.ReactNode;
  queryKey: readonly unknown[];
  priority: LoadingPriority;
  fallbackComponent?: React.ComponentType;
  enableGracefulDegradation?: boolean;
}> = ({
  children,
  queryKey,
  priority,
  fallbackComponent: FallbackComponent,
  enableGracefulDegradation = true
}) => {
  const { isOffline, getCachedData } = useOfflineCache();
  const [hasError, setHasError] = useState(false);
  const [fallbackData, setFallbackData] = useState(null);

  useEffect(() => {
    // Try to get cached data when offline or on error
    if (isOffline || hasError) {
      const cached = getCachedData(queryKey);
      if (cached) {
        setFallbackData(cached.data);
      }
    }
  }, [isOffline, hasError, queryKey, getCachedData]);

  const handleError = () => {
    setHasError(true);
  };

  if (hasError || isOffline) {
    if (fallbackData) {
      return (
        <div>
          {children}
          <FallbackIndicator
            status={{
              isUsingFallback: true,
              isOffline,
              isStale: true,
              fallbackReason: isOffline ? 'offline' : 'error'
            }}
            priority={priority}
          />
        </div>
      );
    }

    if (FallbackComponent) {
      return <FallbackComponent />;
    }

    if (enableGracefulDegradation) {
      return <GracefulDegradationFallback priority={priority} />;
    }

    // Let error boundary handle it
    throw new Error('Component failed and no fallback available');
  }

  return (
    <ErrorBoundaryWrapper onError={handleError}>
      {children}
    </ErrorBoundaryWrapper>
  );
};

// Simple error boundary wrapper
class ErrorBoundaryWrapper extends React.Component<{
  children: React.ReactNode;
  onError: () => void;
}, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null; // Let parent handle the error display
    }
    return this.props.children;
  }
}