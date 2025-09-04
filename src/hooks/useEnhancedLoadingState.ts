import { useState, useCallback, useRef, useEffect } from 'react';
import { LoadingState, LoadingPriority } from '../types/progressive-loading';

interface LoadingConfig {
  estimatedTime?: number;
  contextualMessage?: string;
  action?: string;
  autoProgress?: boolean;
}

interface EnhancedLoadingState extends LoadingState {
  estimatedTime?: number;
  contextualMessage?: string;
  action?: string;
  startTime?: number;
  elapsedTime?: number;
}

interface UseEnhancedLoadingStateReturn {
  loadingState: EnhancedLoadingState;
  startLoading: (config?: LoadingConfig) => void;
  updateProgress: (progress: number) => void;
  setSuccess: (data?: any) => void;
  setError: (error: Error) => void;
  reset: () => void;
  getEstimatedRemaining: () => number;
  isOverdue: () => boolean;
}

export const useEnhancedLoadingState = (
  section: string,
  defaultEstimatedTime: number = 3
): UseEnhancedLoadingStateReturn => {
  const [loadingState, setLoadingState] = useState<EnhancedLoadingState>({
    isLoading: false,
    error: null,
    section,
    progress: 0,
    estimatedTime: defaultEstimatedTime,
    startTime: undefined,
    elapsedTime: 0
  });

  const intervalRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>();

  // Update elapsed time while loading
  useEffect(() => {
    if (loadingState.isLoading && loadingState.startTime) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - loadingState.startTime!) / 1000;
        
        setLoadingState(prev => ({
          ...prev,
          elapsedTime: elapsed
        }));
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadingState.isLoading, loadingState.startTime]);

  const startLoading = useCallback((config?: LoadingConfig) => {
    const now = Date.now();
    startTimeRef.current = now;
    
    setLoadingState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      progress: 0,
      startTime: now,
      elapsedTime: 0,
      estimatedTime: config?.estimatedTime || defaultEstimatedTime,
      contextualMessage: config?.contextualMessage,
      action: config?.action
    }));

    // Auto-progress simulation if enabled
    if (config?.autoProgress) {
      const progressInterval = setInterval(() => {
        setLoadingState(current => {
          if (!current.isLoading || current.progress >= 95) {
            clearInterval(progressInterval);
            return current;
          }
          
          // Simulate realistic progress curve (fast start, slower end)
          const elapsed = (Date.now() - current.startTime!) / 1000;
          const estimatedTime = current.estimatedTime || defaultEstimatedTime;
          const baseProgress = Math.min((elapsed / estimatedTime) * 100, 95);
          
          // Add some randomness to make it feel more realistic
          const variance = Math.random() * 5 - 2.5; // ±2.5%
          const newProgress = Math.min(Math.max(baseProgress + variance, current.progress), 95);
          
          return {
            ...current,
            progress: newProgress
          };
        });
      }, 200);
    }
  }, [defaultEstimatedTime]);

  const updateProgress = useCallback((progress: number) => {
    setLoadingState(prev => ({
      ...prev,
      progress: Math.min(Math.max(progress, 0), 100)
    }));
  }, []);

  const setSuccess = useCallback((data?: any) => {
    setLoadingState(prev => ({
      ...prev,
      isLoading: false,
      progress: 100,
      data,
      error: null
    }));
  }, []);

  const setError = useCallback((error: Error) => {
    setLoadingState(prev => ({
      ...prev,
      isLoading: false,
      error,
      progress: 0
    }));
  }, []);

  const reset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
    
    setLoadingState({
      isLoading: false,
      error: null,
      section,
      progress: 0,
      estimatedTime: defaultEstimatedTime,
      startTime: undefined,
      elapsedTime: 0
    });
  }, [section, defaultEstimatedTime]);

  const getEstimatedRemaining = useCallback((): number => {
    if (!loadingState.isLoading || !loadingState.estimatedTime || loadingState.progress === 0) {
      return 0;
    }
    
    const remaining = (loadingState.estimatedTime * (100 - loadingState.progress)) / 100;
    return Math.max(remaining, 0);
  }, [loadingState.isLoading, loadingState.estimatedTime, loadingState.progress]);

  const isOverdue = useCallback((): boolean => {
    if (!loadingState.isLoading || !loadingState.estimatedTime || !loadingState.elapsedTime) {
      return false;
    }
    
    return loadingState.elapsedTime > loadingState.estimatedTime * 1.5; // 50% over estimate
  }, [loadingState.isLoading, loadingState.estimatedTime, loadingState.elapsedTime]);

  return {
    loadingState,
    startLoading,
    updateProgress,
    setSuccess,
    setError,
    reset,
    getEstimatedRemaining,
    isOverdue
  };
};

// Hook for managing multiple section loading states
export const useMultiSectionLoading = () => {
  const [sections, setSections] = useState<Map<string, EnhancedLoadingState>>(new Map());

  const updateSection = useCallback((sectionId: string, updates: Partial<EnhancedLoadingState>) => {
    setSections(prev => {
      const newSections = new Map(prev);
      const current = newSections.get(sectionId) || {
        isLoading: false,
        error: null,
        section: sectionId,
        progress: 0
      };
      
      newSections.set(sectionId, { ...current, ...updates });
      return newSections;
    });
  }, []);

  const startSection = useCallback((sectionId: string, config?: LoadingConfig) => {
    const now = Date.now();
    updateSection(sectionId, {
      isLoading: true,
      error: null,
      progress: 0,
      startTime: now,
      elapsedTime: 0,
      estimatedTime: config?.estimatedTime || 3,
      contextualMessage: config?.contextualMessage,
      action: config?.action
    });
  }, [updateSection]);

  const completeSection = useCallback((sectionId: string, data?: any) => {
    updateSection(sectionId, {
      isLoading: false,
      progress: 100,
      data,
      error: null
    });
  }, [updateSection]);

  const errorSection = useCallback((sectionId: string, error: Error) => {
    updateSection(sectionId, {
      isLoading: false,
      error,
      progress: 0
    });
  }, [updateSection]);

  const getSection = useCallback((sectionId: string): EnhancedLoadingState | undefined => {
    return sections.get(sectionId);
  }, [sections]);

  const getAllSections = useCallback((): EnhancedLoadingState[] => {
    return Array.from(sections.values());
  }, [sections]);

  const getOverallProgress = useCallback((): number => {
    const allSections = Array.from(sections.values());
    if (allSections.length === 0) return 0;
    
    const totalProgress = allSections.reduce((sum, section) => {
      if (section.data !== null || section.error !== null) return sum + 100;
      return sum + (section.progress || 0);
    }, 0);
    
    return Math.round(totalProgress / allSections.length);
  }, [sections]);

  const hasErrors = useCallback((): boolean => {
    return Array.from(sections.values()).some(section => section.error !== null);
  }, [sections]);

  const isComplete = useCallback((): boolean => {
    const allSections = Array.from(sections.values());
    return allSections.length > 0 && allSections.every(section => 
      !section.isLoading && (section.data !== null || section.error !== null)
    );
  }, [sections]);

  const reset = useCallback(() => {
    setSections(new Map());
  }, []);

  return {
    sections: Array.from(sections.values()),
    updateSection,
    startSection,
    completeSection,
    errorSection,
    getSection,
    getAllSections,
    getOverallProgress,
    hasErrors,
    isComplete,
    reset
  };
};

// Hook for contextual loading messages based on user actions
export const useContextualMessages = () => {
  const getMessageForAction = useCallback((
    action: string,
    priority: LoadingPriority,
    progress?: number
  ): string => {
    const messages: Record<string, Record<LoadingPriority, string[]>> = {
      login: {
        essential: [
          'Welcome back! Setting up your dashboard...',
          'Authenticating your session...',
          'Loading your profile...'
        ],
        secondary: [
          'Fetching your latest music data...',
          'Updating your listening statistics...',
          'Preparing your charts...'
        ],
        optional: [
          'Loading personalized recommendations...',
          'Syncing advanced analytics...',
          'Preparing detailed insights...'
        ]
      },
      refresh: {
        essential: [
          'Refreshing core data...',
          'Updating essential metrics...',
          'Syncing latest changes...'
        ],
        secondary: [
          'Updating charts and visualizations...',
          'Refreshing music analytics...',
          'Loading updated statistics...'
        ],
        optional: [
          'Refreshing advanced features...',
          'Updating recommendations...',
          'Syncing detailed reports...'
        ]
      },
      navigation: {
        essential: [
          'Loading page essentials...',
          'Preparing navigation...',
          'Setting up page structure...'
        ],
        secondary: [
          'Loading page content...',
          'Fetching data for this section...',
          'Preparing interactive elements...'
        ],
        optional: [
          'Loading additional features...',
          'Preparing enhanced functionality...',
          'Loading supplementary content...'
        ]
      }
    };

    const actionMessages = messages[action] || messages.login;
    const priorityMessages = actionMessages[priority];
    
    // Select message based on progress
    if (progress !== undefined) {
      const messageIndex = Math.floor((progress / 100) * priorityMessages.length);
      return priorityMessages[Math.min(messageIndex, priorityMessages.length - 1)];
    }
    
    return priorityMessages[0];
  }, []);

  const getTimeBasedMessage = useCallback((
    elapsedTime: number,
    estimatedTime: number
  ): string => {
    const ratio = elapsedTime / estimatedTime;
    
    if (ratio < 0.5) {
      return 'Just getting started...';
    } else if (ratio < 0.8) {
      return 'Making good progress...';
    } else if (ratio < 1.2) {
      return 'Almost there...';
    } else if (ratio < 2) {
      return 'Taking a bit longer than expected...';
    } else {
      return 'This is taking longer than usual. Please wait...';
    }
  }, []);

  return {
    getMessageForAction,
    getTimeBasedMessage
  };
};