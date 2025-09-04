import { LazyRoutes } from '@/config/lazyRoutes';
import { lazyLoadingConfig } from '@/config/lazyLoadingConfig';

/**
 * Preload a specific route component
 */
export const preloadRoute = async (routeName: keyof typeof LazyRoutes): Promise<void> => {
  try {
    const component = LazyRoutes[routeName];
    if (component) {
      // Trigger the lazy loading by calling the component function
      await component();
      
      if (lazyLoadingConfig.monitoring.enabled) {
        console.log(`[Preload] Successfully preloaded route: ${routeName}`);
      }
    }
  } catch (error) {
    if (lazyLoadingConfig.monitoring.enabled) {
      console.warn(`[Preload] Failed to preload route: ${routeName}`, error);
    }
  }
};

/**
 * Preload multiple routes
 */
export const preloadRoutes = async (routeNames: (keyof typeof LazyRoutes)[]): Promise<void> => {
  const preloadPromises = routeNames.map(routeName => preloadRoute(routeName));
  await Promise.allSettled(preloadPromises);
};

/**
 * Predictive preloading based on current route
 */
export const predictivePreload = (currentRoute: string): void => {
  if (!lazyLoadingConfig.preload.predictive.enabled) return;

  const predictions = lazyLoadingConfig.preload.predictive.routes
    .filter(route => route.from === currentRoute)
    .sort((a, b) => b.probability - a.probability);

  // Preload the most likely next route
  if (predictions.length > 0) {
    const nextRoute = predictions[0].to.replace('/', '') as keyof typeof LazyRoutes;
    if (LazyRoutes[nextRoute]) {
      setTimeout(() => {
        preloadRoute(nextRoute);
      }, 1000); // Delay to avoid interfering with current page load
    }
  }
};

/**
 * Create a preload function for navigation links
 */
export const createPreloadHandler = (routeName: keyof typeof LazyRoutes) => {
  let timeoutId: NodeJS.Timeout;

  return {
    onMouseEnter: () => {
      if (!lazyLoadingConfig.preload.onHover.enabled) return;
      
      timeoutId = setTimeout(() => {
        preloadRoute(routeName);
      }, lazyLoadingConfig.preload.onHover.delay);
    },
    
    onMouseLeave: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    },
  };
};

/**
 * Preload critical components for the current page
 */
export const preloadCriticalComponents = async (): Promise<void> => {
  // Preload commonly used components
  const criticalRoutes: (keyof typeof LazyRoutes)[] = ['Dashboard'];
  await preloadRoutes(criticalRoutes);
};

export default {
  preloadRoute,
  preloadRoutes,
  predictivePreload,
  createPreloadHandler,
  preloadCriticalComponents,
};