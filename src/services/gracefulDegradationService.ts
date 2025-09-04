import { LoadingPriority } from '../types/progressive-loading';

interface DegradationRule {
  id: string;
  condition: () => boolean;
  priority: LoadingPriority;
  fallbackStrategy: 'hide' | 'simplify' | 'cache' | 'placeholder';
  fallbackData?: any;
  message?: string;
}

interface DegradationState {
  isActive: boolean;
  activeRules: string[];
  reason: string;
  timestamp: number;
}

interface FeatureFlag {
  id: string;
  enabled: boolean;
  priority: LoadingPriority;
  conditions?: {
    minBandwidth?: number;
    maxLatency?: number;
    requiresOnline?: boolean;
    browserSupport?: string[];
  };
}

export class GracefulDegradationService {
  private static instance: GracefulDegradationService;
  private rules: Map<string, DegradationRule> = new Map();
  private featureFlags: Map<string, FeatureFlag> = new Map();
  private degradationState: DegradationState = {
    isActive: false,
    activeRules: [],
    reason: '',
    timestamp: 0
  };
  private listeners: Set<(state: DegradationState) => void> = new Set();

  private constructor() {
    this.setupDefaultRules();
    this.setupPerformanceMonitoring();
  }

  static getInstance(): GracefulDegradationService {
    if (!GracefulDegradationService.instance) {
      GracefulDegradationService.instance = new GracefulDegradationService();
    }
    return GracefulDegradationService.instance;
  }

  private setupDefaultRules() {
    // Offline rule
    this.addRule({
      id: 'offline',
      condition: () => !navigator.onLine,
      priority: 'optional',
      fallbackStrategy: 'cache',
      message: 'You are offline. Showing cached data when available.'
    });

    // Slow connection rule
    this.addRule({
      id: 'slow_connection',
      condition: () => {
        const connection = (navigator as any).connection;
        return connection && (
          connection.effectiveType === 'slow-2g' || 
          connection.effectiveType === '2g' ||
          (connection.downlink && connection.downlink < 0.5)
        );
      },
      priority: 'optional',
      fallbackStrategy: 'simplify',
      message: 'Slow connection detected. Some features are simplified.'
    });

    // Low memory rule
    this.addRule({
      id: 'low_memory',
      condition: () => {
        const memory = (navigator as any).deviceMemory;
        return memory && memory < 2; // Less than 2GB RAM
      },
      priority: 'optional',
      fallbackStrategy: 'hide',
      message: 'Limited device memory. Some features are disabled.'
    });

    // Old browser rule
    this.addRule({
      id: 'old_browser',
      condition: () => {
        const userAgent = navigator.userAgent;
        // Check for old browsers (simplified check)
        return /MSIE|Trident/.test(userAgent) || 
               /Chrome\/[1-5][0-9]\./.test(userAgent) ||
               /Firefox\/[1-5][0-9]\./.test(userAgent);
      },
      priority: 'optional',
      fallbackStrategy: 'simplify',
      message: 'Your browser may not support all features. Consider updating.'
    });

    // High CPU usage rule (estimated)
    this.addRule({
      id: 'high_cpu',
      condition: () => {
        // This is a simplified check - in reality you'd monitor actual CPU usage
        const cores = navigator.hardwareConcurrency || 1;
        return cores < 2;
      },
      priority: 'optional',
      fallbackStrategy: 'simplify',
      message: 'Device performance optimization active.'
    });
  }

  private setupPerformanceMonitoring() {
    // Monitor performance metrics
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          
          entries.forEach((entry) => {
            // Monitor long tasks
            if (entry.entryType === 'longtask' && entry.duration > 50) {
              this.checkRule('performance_degradation', () => true);
            }
            
            // Monitor layout shifts
            if (entry.entryType === 'layout-shift' && (entry as any).value > 0.1) {
              this.checkRule('layout_instability', () => true);
            }
          });
        });

        observer.observe({ entryTypes: ['longtask', 'layout-shift'] });
      } catch (error) {
        console.warn('Performance monitoring not available:', error);
      }
    }

    // Monitor memory usage
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        if (memory && memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.9) {
          this.checkRule('high_memory_usage', () => true);
        }
      }, 10000); // Check every 10 seconds
    }
  }

  addRule(rule: DegradationRule) {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string) {
    this.rules.delete(ruleId);
  }

  addFeatureFlag(flag: FeatureFlag) {
    this.featureFlags.set(flag.id, flag);
  }

  checkRule(ruleId: string, condition?: () => boolean) {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    const shouldActivate = condition ? condition() : rule.condition();
    
    if (shouldActivate && !this.degradationState.activeRules.includes(ruleId)) {
      this.activateRule(ruleId);
      return true;
    } else if (!shouldActivate && this.degradationState.activeRules.includes(ruleId)) {
      this.deactivateRule(ruleId);
      return false;
    }

    return shouldActivate;
  }

  private activateRule(ruleId: string) {
    const rule = this.rules.get(ruleId);
    if (!rule) return;

    this.degradationState.activeRules.push(ruleId);
    this.degradationState.isActive = true;
    this.degradationState.reason = rule.message || `Rule ${ruleId} activated`;
    this.degradationState.timestamp = Date.now();

    console.log(`Graceful degradation rule activated: ${ruleId}`);
    this.notifyListeners();
  }

  private deactivateRule(ruleId: string) {
    this.degradationState.activeRules = this.degradationState.activeRules.filter(id => id !== ruleId);
    
    if (this.degradationState.activeRules.length === 0) {
      this.degradationState.isActive = false;
      this.degradationState.reason = '';
    }

    console.log(`Graceful degradation rule deactivated: ${ruleId}`);
    this.notifyListeners();
  }

  checkAllRules() {
    this.rules.forEach((rule, ruleId) => {
      this.checkRule(ruleId);
    });
  }

  isFeatureEnabled(featureId: string): boolean {
    const flag = this.featureFlags.get(featureId);
    if (!flag) return true; // Default to enabled if no flag

    if (!flag.enabled) return false;

    // Check conditions
    if (flag.conditions) {
      const { minBandwidth, maxLatency, requiresOnline, browserSupport } = flag.conditions;

      // Check online requirement
      if (requiresOnline && !navigator.onLine) {
        return false;
      }

      // Check bandwidth
      const connection = (navigator as any).connection;
      if (minBandwidth && connection && connection.downlink < minBandwidth) {
        return false;
      }

      // Check latency
      if (maxLatency && connection && connection.rtt > maxLatency) {
        return false;
      }

      // Check browser support
      if (browserSupport && browserSupport.length > 0) {
        const userAgent = navigator.userAgent;
        const isSupported = browserSupport.some(browser => 
          userAgent.toLowerCase().includes(browser.toLowerCase())
        );
        if (!isSupported) return false;
      }
    }

    // Check if feature should be disabled due to active degradation rules
    const activeRules = this.getActiveRules();
    const shouldDisable = activeRules.some(rule => 
      rule.priority === flag.priority && 
      (rule.fallbackStrategy === 'hide' || rule.fallbackStrategy === 'simplify')
    );

    return !shouldDisable;
  }

  getFallbackStrategy(priority: LoadingPriority): 'hide' | 'simplify' | 'cache' | 'placeholder' | null {
    const activeRules = this.getActiveRules();
    const relevantRule = activeRules.find(rule => rule.priority === priority);
    return relevantRule ? relevantRule.fallbackStrategy : null;
  }

  getFallbackData(ruleId: string): any {
    const rule = this.rules.get(ruleId);
    return rule?.fallbackData || null;
  }

  getActiveRules(): DegradationRule[] {
    return this.degradationState.activeRules
      .map(ruleId => this.rules.get(ruleId))
      .filter(rule => rule !== undefined) as DegradationRule[];
  }

  getDegradationState(): DegradationState {
    return { ...this.degradationState };
  }

  subscribe(listener: (state: DegradationState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.getDegradationState());
      } catch (error) {
        console.error('Error in degradation listener:', error);
      }
    });
  }

  // Utility methods for common scenarios
  shouldSimplifyUI(): boolean {
    return this.getActiveRules().some(rule => 
      rule.fallbackStrategy === 'simplify'
    );
  }

  shouldHideOptionalFeatures(): boolean {
    return this.getActiveRules().some(rule => 
      rule.priority === 'optional' && rule.fallbackStrategy === 'hide'
    );
  }

  shouldUseCachedData(): boolean {
    return this.getActiveRules().some(rule => 
      rule.fallbackStrategy === 'cache'
    );
  }

  getPerformanceMode(): 'normal' | 'optimized' | 'minimal' {
    const activeRules = this.getActiveRules();
    
    if (activeRules.length === 0) return 'normal';
    
    const hasHighImpactRules = activeRules.some(rule => 
      rule.id === 'low_memory' || rule.id === 'high_cpu' || rule.id === 'old_browser'
    );
    
    if (hasHighImpactRules) return 'minimal';
    
    return 'optimized';
  }

  // Manual override methods
  enableFeature(featureId: string) {
    const flag = this.featureFlags.get(featureId);
    if (flag) {
      flag.enabled = true;
    }
  }

  disableFeature(featureId: string) {
    const flag = this.featureFlags.get(featureId);
    if (flag) {
      flag.enabled = false;
    }
  }

  reset() {
    this.degradationState = {
      isActive: false,
      activeRules: [],
      reason: '',
      timestamp: 0
    };
    this.notifyListeners();
  }
}

// React hook for using graceful degradation
export const useGracefulDegradation = () => {
  const [degradationState, setDegradationState] = React.useState<DegradationState>(
    GracefulDegradationService.getInstance().getDegradationState()
  );

  React.useEffect(() => {
    const service = GracefulDegradationService.getInstance();
    
    // Initial check
    service.checkAllRules();
    
    const unsubscribe = service.subscribe(setDegradationState);
    
    // Periodic checks
    const interval = setInterval(() => {
      service.checkAllRules();
    }, 30000); // Check every 30 seconds
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const service = GracefulDegradationService.getInstance();

  return {
    degradationState,
    isFeatureEnabled: service.isFeatureEnabled.bind(service),
    getFallbackStrategy: service.getFallbackStrategy.bind(service),
    shouldSimplifyUI: service.shouldSimplifyUI.bind(service),
    shouldHideOptionalFeatures: service.shouldHideOptionalFeatures.bind(service),
    shouldUseCachedData: service.shouldUseCachedData.bind(service),
    getPerformanceMode: service.getPerformanceMode.bind(service),
    enableFeature: service.enableFeature.bind(service),
    disableFeature: service.disableFeature.bind(service)
  };
};

export default GracefulDegradationService;