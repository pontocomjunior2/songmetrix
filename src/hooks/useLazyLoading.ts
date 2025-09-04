import { useState, useEffect, useRef, useCallback } from 'react';

interface UseLazyLoadingOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  enabled?: boolean;
}

interface UseLazyLoadingReturn {
  isVisible: boolean;
  hasLoaded: boolean;
  elementRef: React.RefObject<HTMLElement>;
  reset: () => void;
}

/**
 * Hook for managing lazy loading with Intersection Observer
 */
export const useLazyLoading = ({
  threshold = 0.1,
  rootMargin = '50px',
  triggerOnce = true,
  enabled = true,
}: UseLazyLoadingOptions = {}): UseLazyLoadingReturn => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const elementRef = useRef<HTMLElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const reset = useCallback(() => {
    setIsVisible(false);
    setHasLoaded(false);
    
    // Re-observe if element exists
    if (elementRef.current && observerRef.current && enabled) {
      observerRef.current.observe(elementRef.current);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setIsVisible(true);
      setHasLoaded(true);
      return;
    }

    const element = elementRef.current;
    if (!element) return;

    // Create intersection observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsVisible(true);
          
          // Disconnect observer if triggerOnce is true
          if (triggerOnce && observerRef.current) {
            observerRef.current.disconnect();
          }
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    // Start observing
    observerRef.current.observe(element);

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [threshold, rootMargin, triggerOnce, enabled]);

  useEffect(() => {
    if (isVisible && !hasLoaded) {
      setHasLoaded(true);
    }
  }, [isVisible, hasLoaded]);

  return {
    isVisible,
    hasLoaded,
    elementRef,
    reset,
  };
};

/**
 * Hook for preloading components when they're about to become visible
 */
export const usePreloadOnHover = (preloadFn: () => void, delay: number = 200) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleMouseEnter = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      preloadFn();
    }, delay);
  }, [preloadFn, delay]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };
};

export default useLazyLoading;