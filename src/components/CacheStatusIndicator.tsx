import React, { useState } from 'react';
import { useCacheStatus } from '../hooks/useOfflineCache';

/**
 * Cache Status Indicator Component
 * Shows current cache status with visual indicators
 */
export function CacheStatusIndicator({ 
  showDetails = false,
  position = 'bottom-right',
  className = ''
}: {
  showDetails?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}) {
  const { status, getStatusIndicator, forceUpdate, isOnline, hasErrors, cacheHealth } = useCacheStatus();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const indicator = getStatusIndicator();
  
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };
  
  const colorClasses = {
    green: 'bg-green-500 text-white',
    blue: 'bg-blue-500 text-white',
    yellow: 'bg-yellow-500 text-black',
    orange: 'bg-orange-500 text-white',
    red: 'bg-red-500 text-white',
    gray: 'bg-gray-500 text-white',
  };
  
  if (!status) {
    return null;
  }
  
  return (
    <div className={`fixed ${positionClasses[position]} z-50 ${className}`}>
      <div className="relative">
        {/* Main Status Indicator */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            flex items-center space-x-2 px-3 py-2 rounded-lg shadow-lg transition-all duration-200
            ${colorClasses[indicator.color as keyof typeof colorClasses]}
            hover:shadow-xl transform hover:scale-105
          `}
          title={indicator.message}
        >
          {/* Status Icon */}
          <div className="flex items-center">
            {indicator.type === 'online' && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {indicator.type === 'offline' && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.366zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
              </svg>
            )}
            {indicator.type === 'loading' && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {indicator.type === 'error' && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            {indicator.type === 'stale' && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          
          {/* Status Text */}
          {showDetails && (
            <span className="text-sm font-medium">
              {indicator.message}
            </span>
          )}
          
          {/* Expand Arrow */}
          <svg 
            className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        
        {/* Expanded Details Panel */}
        {isExpanded && (
          <div className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 min-w-80 z-10">
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Cache Status
                </h3>
                <button
                  onClick={forceUpdate}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                  title="Refresh status"
                >
                  Refresh
                </button>
              </div>
              
              {/* Status Overview */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Connection:</span>
                    <span className={`font-medium ${isOnline ? 'text-green-600' : 'text-orange-600'}`}>
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Health:</span>
                    <span className={`font-medium ${
                      cacheHealth > 80 ? 'text-green-600' : 
                      cacheHealth > 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {cacheHealth}%
                    </span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Queries:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {status.totalQueries}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Errors:</span>
                    <span className={`font-medium ${hasErrors ? 'text-red-600' : 'text-green-600'}`}>
                      {status.errorQueries}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Detailed Stats */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <div>Successful: {status.successfulQueries}</div>
                  <div>Loading: {status.loadingQueries}</div>
                  <div>Stale: {status.staleQueries}</div>
                  <div>Offline Data: {status.offlineDataQueries}</div>
                  {!isOnline && (
                    <>
                      <div>Queued: {status.queuedQueries}</div>
                      <div>Fallback: {status.fallbackDataEntries}</div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Additional Details */}
              {indicator.details && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {indicator.details}
                  </p>
                </div>
              )}
              
              {/* Last Updated */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Last updated: {new Date(status.lastUpdated).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Simple Cache Health Badge
 */
export function CacheHealthBadge({ className = '' }: { className?: string }) {
  const { cacheHealth, isOnline, hasErrors } = useCacheStatus();
  
  const getHealthColor = () => {
    if (!isOnline) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (hasErrors) return 'bg-red-100 text-red-800 border-red-200';
    if (cacheHealth > 80) return 'bg-green-100 text-green-800 border-green-200';
    if (cacheHealth > 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };
  
  const getHealthText = () => {
    if (!isOnline) return 'Offline';
    if (hasErrors) return 'Errors';
    if (cacheHealth > 80) return 'Excellent';
    if (cacheHealth > 60) return 'Good';
    return 'Poor';
  };
  
  return (
    <span className={`
      inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
      ${getHealthColor()} ${className}
    `}>
      <div className={`w-2 h-2 rounded-full mr-1.5 ${
        !isOnline ? 'bg-orange-400' :
        hasErrors ? 'bg-red-400' :
        cacheHealth > 80 ? 'bg-green-400' :
        cacheHealth > 60 ? 'bg-yellow-400' : 'bg-red-400'
      }`} />
      {getHealthText()}
    </span>
  );
}

/**
 * Offline Mode Banner
 */
export function OfflineModeBanner() {
  const { isOnline, status } = useCacheStatus();
  
  if (isOnline || !status) {
    return null;
  }
  
  return (
    <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-orange-700">
            <strong>You're currently offline.</strong> 
            {status.offlineDataQueries > 0 && (
              <span> Showing cached data from your last session.</span>
            )}
            {status.queuedQueries > 0 && (
              <span> {status.queuedQueries} updates will sync when you're back online.</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Cache Error Alert
 */
export function CacheErrorAlert({ 
  onRetry,
  onDismiss 
}: { 
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  const { hasErrors, status } = useCacheStatus();
  
  if (!hasErrors || !status) {
    return null;
  }
  
  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            Cache Errors Detected
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>
              {status.errorQueries} queries failed to load. This might be due to network issues or server problems.
            </p>
          </div>
          {(onRetry || onDismiss) && (
            <div className="mt-4 flex space-x-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Retry Failed Queries
                </button>
              )}
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="bg-white px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 border border-red-300"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}