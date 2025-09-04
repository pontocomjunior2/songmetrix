import { LoadingState, ProgressiveLoadingState, LoadingPriority, LoadingSection } from '../types/progressive-loading';

export class LoadingStateManager {
  private state: ProgressiveLoadingState;
  private listeners: Set<(state: ProgressiveLoadingState) => void> = new Set();
  private sections: Map<string, LoadingSection> = new Map();

  constructor() {
    this.state = {
      essential: {
        isLoading: false,
        error: null,
        section: 'essential',
        data: null
      },
      secondary: {
        isLoading: false,
        error: null,
        section: 'secondary',
        data: null
      },
      optional: {
        isLoading: false,
        error: null,
        section: 'optional',
        data: null
      }
    };
  }

  public getState(): ProgressiveLoadingState {
    return { ...this.state };
  }

  public subscribe(listener: (state: ProgressiveLoadingState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public setSectionLoading(priority: LoadingPriority, isLoading: boolean, progress?: number): void {
    this.state[priority] = {
      ...this.state[priority],
      isLoading,
      progress,
      error: isLoading ? null : this.state[priority].error // Clear error when starting to load
    };
    this.notifyListeners();
  }

  public setSectionData(priority: LoadingPriority, data: any): void {
    this.state[priority] = {
      ...this.state[priority],
      isLoading: false,
      data,
      error: null,
      progress: 100
    };
    this.notifyListeners();
  }

  public setSectionError(priority: LoadingPriority, error: Error): void {
    this.state[priority] = {
      ...this.state[priority],
      isLoading: false,
      error,
      progress: 0
    };
    this.notifyListeners();
  }

  public resetSection(priority: LoadingPriority): void {
    this.state[priority] = {
      isLoading: false,
      error: null,
      section: priority,
      data: null,
      progress: 0
    };
    this.notifyListeners();
  }

  public resetAll(): void {
    Object.keys(this.state).forEach(priority => {
      this.resetSection(priority as LoadingPriority);
    });
  }

  public isComplete(): boolean {
    return Object.values(this.state).every(section => 
      !section.isLoading && (section.data !== null || section.error !== null)
    );
  }

  public hasErrors(): boolean {
    return Object.values(this.state).some(section => section.error !== null);
  }

  public getProgress(): number {
    const sections = Object.values(this.state);
    const totalProgress = sections.reduce((sum, section) => {
      if (section.data !== null) return sum + 100;
      if (section.error !== null) return sum + 100; // Count errors as "complete"
      return sum + (section.progress || 0);
    }, 0);
    
    return Math.round(totalProgress / (sections.length * 100) * 100);
  }

  public registerSection(section: LoadingSection): void {
    this.sections.set(section.id, section);
  }

  public getSection(id: string): LoadingSection | undefined {
    return this.sections.get(id);
  }

  public getSectionsByPriority(priority: LoadingPriority): LoadingSection[] {
    return Array.from(this.sections.values()).filter(section => section.priority === priority);
  }

  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach(listener => listener(currentState));
  }
}