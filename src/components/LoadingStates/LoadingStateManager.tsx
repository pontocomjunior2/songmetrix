import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { useMultiSectionLoading, useContextualMessages } from '../../hooks/useEnhancedLoadingState';
import { LoadingPriority } from '../../types/progressive-loading';

interface LoadingStateContextType {
  startSection: (sectionId: string, priority: LoadingPriority, config?: {
    estimatedTime?: number;
    contextualMessage?: string;
    action?: string;
  }) => void;
  updateSectionProgress: (sectionId: string, progress: number) => void;
  completeSection: (sectionId: string, data?: any) => void;
  errorSection: (sectionId: string, error: Error) => void;
  getSectionState: (sectionId: string) => any;
  getOverallProgress: () => number;
  hasErrors: () => boolean;
  isComplete: () => boolean;
  reset: () => void;
  sections: any[];
}

const LoadingStateContext = createContext<LoadingStateContextType | null>(null);

export const useLoadingStateContext = () => {
  const context = useContext(LoadingStateContext);
  if (!context) {
    throw new Error('useLoadingStateContext must be used within a LoadingStateProvider');
  }
  return context;
};

interface LoadingStateProviderProps {
  children: React.ReactNode;
  onSectionComplete?: (sectionId: string, data: any) => void;
  onSectionError?: (sectionId: string, error: Error) => void;
  onAllComplete?: () => void;
}

export const LoadingStateProvider: React.FC<LoadingStateProviderProps> = ({
  children,
  onSectionComplete,
  onSectionError,
  onAllComplete
}) => {
  const {
    sections,
    updateSection,
    startSection: startSectionInternal,
    completeSection: completeSectionInternal,
    errorSection: errorSectionInternal,
    getSection,
    getOverallProgress,
    hasErrors,
    isComplete,
    reset
  } = useMultiSectionLoading();

  const { getMessageForAction } = useContextualMessages();

  const startSection = useCallback((
    sectionId: string,
    priority: LoadingPriority,
    config?: {
      estimatedTime?: number;
      contextualMessage?: string;
      action?: string;
    }
  ) => {
    const contextualMessage = config?.contextualMessage || 
      getMessageForAction(config?.action || 'default', priority);
    
    startSectionInternal(sectionId, {
      ...config,
      contextualMessage
    });
  }, [startSectionInternal, getMessageForAction]);

  const updateSectionProgress = useCallback((sectionId: string, progress: number) => {
    updateSection(sectionId, { progress });
  }, [updateSection]);

  const completeSection = useCallback((sectionId: string, data?: any) => {
    completeSectionInternal(sectionId, data);
    onSectionComplete?.(sectionId, data);
  }, [completeSectionInternal, onSectionComplete]);

  const errorSection = useCallback((sectionId: string, error: Error) => {
    errorSectionInternal(sectionId, error);
    onSectionError?.(sectionId, error);
  }, [errorSectionInternal, onSectionError]);

  const getSectionState = useCallback((sectionId: string) => {
    return getSection(sectionId);
  }, [getSection]);

  // Trigger onAllComplete when all sections are done
  useEffect(() => {
    if (isComplete() && sections.length > 0) {
      onAllComplete?.();
    }
  }, [isComplete, sections.length, onAllComplete]);

  const contextValue: LoadingStateContextType = {
    startSection,
    updateSectionProgress,
    completeSection,
    errorSection,
    getSectionState,
    getOverallProgress,
    hasErrors,
    isComplete,
    reset,
    sections
  };

  return (
    <LoadingStateContext.Provider value={contextValue}>
      {children}
    </LoadingStateContext.Provider>
  );
};

// Higher-order component for sections that need loading states
export const withLoadingState = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  sectionId: string,
  priority: LoadingPriority = 'secondary'
) => {
  return React.forwardRef<any, P>((props, ref) => {
    const loadingContext = useLoadingStateContext();
    const sectionState = loadingContext.getSectionState(sectionId);

    const enhancedProps = {
      ...props,
      loadingState: sectionState,
      startLoading: (config?: any) => loadingContext.startSection(sectionId, priority, config),
      updateProgress: (progress: number) => loadingContext.updateSectionProgress(sectionId, progress),
      completeLoading: (data?: any) => loadingContext.completeSection(sectionId, data),
      errorLoading: (error: Error) => loadingContext.errorSection(sectionId, error)
    };

    return <WrappedComponent {...enhancedProps} ref={ref} />;
  });
};

// Hook for individual components to manage their loading state
export const useSectionLoadingState = (
  sectionId: string,
  priority: LoadingPriority = 'secondary'
) => {
  const context = useLoadingStateContext();
  
  const startLoading = useCallback((config?: {
    estimatedTime?: number;
    contextualMessage?: string;
    action?: string;
  }) => {
    context.startSection(sectionId, priority, config);
  }, [context, sectionId, priority]);

  const updateProgress = useCallback((progress: number) => {
    context.updateSectionProgress(sectionId, progress);
  }, [context, sectionId]);

  const completeLoading = useCallback((data?: any) => {
    context.completeSection(sectionId, data);
  }, [context, sectionId]);

  const errorLoading = useCallback((error: Error) => {
    context.errorSection(sectionId, error);
  }, [context, sectionId]);

  const sectionState = context.getSectionState(sectionId);

  return {
    loadingState: sectionState,
    startLoading,
    updateProgress,
    completeLoading,
    errorLoading,
    isLoading: sectionState?.isLoading || false,
    hasError: sectionState?.error !== null,
    progress: sectionState?.progress || 0
  };
};

// Component for displaying overall loading progress
export const OverallLoadingProgress: React.FC<{
  className?: string;
  showDetails?: boolean;
}> = ({ className = '', showDetails = false }) => {
  const { getOverallProgress, hasErrors, sections } = useLoadingStateContext();
  
  const progress = getOverallProgress();
  const errors = hasErrors();
  
  if (sections.length === 0) return null;

  return (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Overall Progress
        </span>
        <span className={`text-sm ${errors ? 'text-red-600' : 'text-gray-500'} dark:text-gray-400`}>
          {progress}% {errors && '(with errors)'}
        </span>
      </div>
      
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            errors ? 'bg-red-500' : 'bg-blue-600'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {showDetails && (
        <div className="mt-3 space-y-1">
          {sections.map((section) => (
            <div key={section.section} className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">
                {section.section}
              </span>
              <span className={`${
                section.error ? 'text-red-500' : 
                section.isLoading ? 'text-blue-500' : 'text-green-500'
              }`}>
                {section.error ? 'Error' : 
                 section.isLoading ? `${section.progress || 0}%` : 'Complete'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};