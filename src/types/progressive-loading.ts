export interface LoadingState {
  isLoading: boolean;
  error: Error | null;
  progress?: number;
  section: string;
  data?: any;
  estimatedTime?: number;
  contextualMessage?: string;
  action?: string;
  startTime?: number;
  elapsedTime?: number;
}

export interface ProgressiveLoadingState {
  essential: LoadingState;
  secondary: LoadingState;
  optional: LoadingState;
}

export type LoadingPriority = 'essential' | 'secondary' | 'optional';

export interface LoadingSection {
  id: string;
  priority: LoadingPriority;
  name: string;
  fetchFn: () => Promise<any>;
  dependencies?: string[];
}

export interface ProgressiveLoadingConfig {
  sections: LoadingSection[];
  onSectionComplete?: (sectionId: string, data: any) => void;
  onSectionError?: (sectionId: string, error: Error) => void;
  onAllComplete?: () => void;
}

export interface UseProgressiveLoadingReturn {
  loadingState: ProgressiveLoadingState;
  startLoading: () => void;
  retrySection: (priority: LoadingPriority) => void;
  isComplete: boolean;
  hasErrors: boolean;
  progress: number;
}