import { useState, useEffect, useCallback, useRef } from 'react';
import { LoadingStateManager } from '../lib/LoadingStateManager';
import { 
  ProgressiveLoadingState, 
  LoadingPriority, 
  LoadingSection, 
  ProgressiveLoadingConfig,
  UseProgressiveLoadingReturn 
} from '../types/progressive-loading';

export const useProgressiveLoading = (config: ProgressiveLoadingConfig): UseProgressiveLoadingReturn => {
  const managerRef = useRef<LoadingStateManager>(new LoadingStateManager());
  const [loadingState, setLoadingState] = useState<ProgressiveLoadingState>(
    managerRef.current.getState()
  );
  const [isStarted, setIsStarted] = useState(false);

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = managerRef.current.subscribe(setLoadingState);
    return unsubscribe;
  }, []);

  // Register sections
  useEffect(() => {
    config.sections.forEach(section => {
      managerRef.current.registerSection(section);
    });
  }, [config.sections]);

  const executeSection = useCallback(async (section: LoadingSection) => {
    const manager = managerRef.current;
    
    try {
      manager.setSectionLoading(section.priority, true, 0);
      
      // Check dependencies
      if (section.dependencies) {
        const dependenciesReady = section.dependencies.every(depId => {
          const depSection = manager.getSection(depId);
          if (!depSection) return false;
          const depState = loadingState[depSection.priority];
          return depState.data !== null && depState.error === null;
        });
        
        if (!dependenciesReady) {
          throw new Error(`Dependencies not ready for section ${section.id}`);
        }
      }

      const data = await section.fetchFn();
      manager.setSectionData(section.priority, data);
      
      config.onSectionComplete?.(section.id, data);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      manager.setSectionError(section.priority, errorObj);
      config.onSectionError?.(section.id, errorObj);
    }
  }, [config, loadingState]);

  const executePriorityGroup = useCallback(async (priority: LoadingPriority) => {
    const manager = managerRef.current;
    const sections = manager.getSectionsByPriority(priority);
    
    if (sections.length === 0) return;

    // Execute all sections of this priority in parallel
    await Promise.allSettled(
      sections.map(section => executeSection(section))
    );
  }, [executeSection]);

  const startLoading = useCallback(async () => {
    if (isStarted) return;
    
    setIsStarted(true);
    managerRef.current.resetAll();

    try {
      // Execute in priority order: essential -> secondary -> optional
      await executePriorityGroup('essential');
      await executePriorityGroup('secondary');
      await executePriorityGroup('optional');
      
      config.onAllComplete?.();
    } catch (error) {
      console.error('Progressive loading failed:', error);
    }
  }, [isStarted, executePriorityGroup, config]);

  const retrySection = useCallback(async (priority: LoadingPriority) => {
    const manager = managerRef.current;
    manager.resetSection(priority);
    await executePriorityGroup(priority);
  }, [executePriorityGroup]);

  const isComplete = managerRef.current.isComplete();
  const hasErrors = managerRef.current.hasErrors();
  const progress = managerRef.current.getProgress();

  return {
    loadingState,
    startLoading,
    retrySection,
    isComplete,
    hasErrors,
    progress
  };
};