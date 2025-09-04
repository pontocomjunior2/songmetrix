import React from 'react';
import { Skeleton } from '../ui/Skeleton';
import { LoadingState, LoadingPriority } from '../../types/progressive-loading';

interface LoadingStateProps {
  state: LoadingState;
  priority: LoadingPriority;
  estimatedTime?: number;
  contextualMessage?: string;
}

interface ProgressIndicatorProps {
  progress: number;
  estimatedTime?: number;
  showTime?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'circular' | 'linear';
}

// Enhanced progress indicator with estimated completion times
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  estimatedTime,
  showTime = true,
  size = 'md',
  variant = 'linear'
}) => {
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const circularSizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getEstimatedRemaining = (): string => {
    if (!estimatedTime || progress === 0) return '';
    const remaining = (estimatedTime * (100 - progress)) / 100;
    return formatTime(remaining);
  };

  if (variant === 'circular') {
    const circumference = 2 * Math.PI * 16; // radius = 16
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <div className="flex flex-col items-center space-y-2">
        <div className={`relative ${circularSizeClasses[size]}`}>
          <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 36 36">
            <path
              className="text-gray-200 dark:text-gray-700"
              stroke="currentColor"
              strokeWidth="3"
              fill="transparent"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-blue-600 transition-all duration-300 ease-in-out"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
        {showTime && estimatedTime && (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            <div>{getEstimatedRemaining()} remaining</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-700 dark:text-gray-300">
          {Math.round(progress)}% complete
        </span>
        {showTime && estimatedTime && (
          <span className="text-gray-500 dark:text-gray-400">
            {getEstimatedRemaining()} remaining
          </span>
        )}
      </div>
      <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full ${sizeClasses[size]}`}>
        <div
          className="bg-blue-600 rounded-full transition-all duration-300 ease-out h-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

// Contextual loading messages based on user actions and section
export const ContextualLoadingMessage: React.FC<{
  priority: LoadingPriority;
  action?: string;
  customMessage?: string;
}> = ({ priority, action, customMessage }) => {
  const getDefaultMessage = (): string => {
    if (customMessage) return customMessage;

    const actionMessages: Record<string, Record<LoadingPriority, string>> = {
      login: {
        essential: 'Setting up your dashboard...',
        secondary: 'Loading your music data...',
        optional: 'Preparing detailed analytics...'
      },
      refresh: {
        essential: 'Refreshing core data...',
        secondary: 'Updating charts and metrics...',
        optional: 'Syncing latest insights...'
      },
      navigation: {
        essential: 'Loading page essentials...',
        secondary: 'Fetching content...',
        optional: 'Loading additional features...'
      },
      default: {
        essential: 'Loading essential data...',
        secondary: 'Loading additional content...',
        optional: 'Loading enhanced features...'
      }
    };

    const messages = actionMessages[action || 'default'] || actionMessages.default;
    return messages[priority];
  };

  return (
    <div className="text-center text-gray-600 dark:text-gray-400">
      <p className="text-sm font-medium">{getDefaultMessage()}</p>
    </div>
  );
};

// Enhanced loading state component for dashboard sections
export const DashboardSectionLoader: React.FC<LoadingStateProps> = ({
  state,
  priority,
  estimatedTime,
  contextualMessage
}) => {
  const priorityConfig = {
    essential: {
      title: 'Loading Dashboard',
      color: 'blue',
      estimatedTime: estimatedTime || 2
    },
    secondary: {
      title: 'Loading Charts & Data',
      color: 'indigo',
      estimatedTime: estimatedTime || 3
    },
    optional: {
      title: 'Loading Additional Features',
      color: 'purple',
      estimatedTime: estimatedTime || 5
    }
  };

  const config = priorityConfig[priority];
  const progress = state.progress || 0;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {config.title}
        </h3>
        <div className={`px-2 py-1 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-800 dark:bg-${config.color}-900 dark:text-${config.color}-200`}>
          {priority}
        </div>
      </div>

      <div className="space-y-4">
        <ContextualLoadingMessage
          priority={priority}
          customMessage={contextualMessage}
        />

        <ProgressIndicator
          progress={progress}
          estimatedTime={config.estimatedTime}
          size="md"
          variant="linear"
        />

        {/* Animated loading indicator */}
        <div className="flex justify-center">
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 bg-${config.color}-600 rounded-full animate-pulse`}
                style={{
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: '1s'
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Compact loading state for smaller sections
export const CompactLoader: React.FC<{
  message?: string;
  progress?: number;
  size?: 'sm' | 'md';
}> = ({ message = 'Loading...', progress, size = 'sm' }) => {
  return (
    <div className="flex items-center space-x-3 p-4">
      <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${
        size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'
      }`} />
      <div className="flex-1">
        <p className={`text-gray-600 dark:text-gray-400 ${
          size === 'sm' ? 'text-sm' : 'text-base'
        }`}>
          {message}
        </p>
        {progress !== undefined && (
          <div className="mt-1">
            <ProgressIndicator
              progress={progress}
              showTime={false}
              size="sm"
              variant="linear"
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Skeleton loader with progress indication
export const SkeletonWithProgress: React.FC<{
  type: 'card' | 'chart' | 'list' | 'metrics';
  progress?: number;
  message?: string;
}> = ({ type, progress, message }) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <div className="animate-pulse space-y-4">
              <Skeleton height="1.5rem" width="60%" />
              <Skeleton height="1rem" width="100%" />
              <Skeleton height="1rem" width="80%" />
              <Skeleton height="1rem" width="70%" />
            </div>
          </div>
        );
      case 'chart':
        return (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <div className="animate-pulse">
              <Skeleton height="1.5rem" width="50%" className="mb-4" />
              <div className="h-64 flex items-end justify-between space-x-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    width="100%"
                    height={`${Math.random() * 60 + 40}%`}
                    className="flex-1"
                  />
                ))}
              </div>
            </div>
          </div>
        );
      case 'list':
        return (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <div className="animate-pulse">
              <Skeleton height="1.5rem" width="40%" className="mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <Skeleton width="2rem" height="2rem" rounded />
                      <div className="flex-1">
                        <Skeleton height="1rem" width="70%" className="mb-1" />
                        <Skeleton height="0.75rem" width="50%" />
                      </div>
                    </div>
                    <Skeleton height="1rem" width="3rem" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'metrics':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                <div className="animate-pulse flex items-center space-x-4">
                  <Skeleton width="3rem" height="3rem" rounded />
                  <div className="flex-1">
                    <Skeleton height="0.875rem" width="60%" className="mb-2" />
                    <Skeleton height="1.5rem" width="40%" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      default:
        return <Skeleton height="200px" width="100%" />;
    }
  };

  return (
    <div className="relative">
      {renderSkeleton()}
      
      {/* Progress overlay */}
      {progress !== undefined && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center rounded-lg">
          <div className="text-center space-y-3">
            <ProgressIndicator
              progress={progress}
              showTime={false}
              size="md"
              variant="circular"
            />
            {message && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Loading state for entire dashboard with section-specific progress
export const DashboardLoadingState: React.FC<{
  essentialProgress?: number;
  secondaryProgress?: number;
  optionalProgress?: number;
  currentAction?: string;
}> = ({
  essentialProgress = 0,
  secondaryProgress = 0,
  optionalProgress = 0,
  currentAction = 'login'
}) => {
  return (
    <div className="dashboard-container p-4 md:p-6 space-y-6">
      {/* Overall progress header */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Loading Your Dashboard
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {Math.round((essentialProgress + secondaryProgress + optionalProgress) / 3)}% complete
          </span>
        </div>
        <ProgressIndicator
          progress={(essentialProgress + secondaryProgress + optionalProgress) / 3}
          estimatedTime={8}
          size="md"
          variant="linear"
        />
      </div>

      {/* Section-specific loading states */}
      <div className="space-y-4">
        {essentialProgress < 100 && (
          <DashboardSectionLoader
            state={{
              isLoading: true,
              error: null,
              section: 'essential',
              progress: essentialProgress
            }}
            priority="essential"
            contextualMessage={`Setting up your dashboard after ${currentAction}...`}
          />
        )}

        {essentialProgress >= 50 && secondaryProgress < 100 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SkeletonWithProgress
              type="chart"
              progress={secondaryProgress}
              message="Loading music analytics..."
            />
            <SkeletonWithProgress
              type="list"
              progress={secondaryProgress}
              message="Fetching your top tracks..."
            />
          </div>
        )}

        {secondaryProgress >= 50 && optionalProgress < 100 && (
          <SkeletonWithProgress
            type="metrics"
            progress={optionalProgress}
            message="Loading detailed insights..."
          />
        )}
      </div>
    </div>
  );
};