import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Loading from '@/components/Common/Loading';
import { recordIntersection, recordLoadStart, recordLoadEnd } from '@/utils/lazyLoadingMonitor';

interface LazyWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  className?: string;
  loadingMessage?: string;
  minHeight?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  componentName?: string; // For monitoring purposes
}

interface IntersectionObserverEntry {
  isIntersecting: boolean;
  target: Element;
}

/**
 * LazyWrapper component that uses Intersection Observer to lazy load content
 * when it becomes visible in the viewport
 */
export const LazyWrapper: React.FC<LazyWrapperProps> = ({
  children,
  fallback,
  threshold = 0.1,
  rootMargin = '50px',
  triggerOnce = true,
  className = '',
  loadingMessage = 'Carregando componente...',
  minHeight = '200px',
  onLoad,
  onError,
  componentName = 'UnknownComponent',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Create intersection observer
    observerRef.current = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          // Record intersection for monitoring
          recordIntersection(componentName);
          
          setIsVisible(true);
          
          // Trigger onLoad callback
          if (onLoad) {
            try {
              onLoad();
            } catch (err) {
              const error = err instanceof Error ? err : new Error('Unknown error in onLoad callback');
              setError(error);
              onError?.(error);
            }
          }

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
  }, [threshold, rootMargin, triggerOnce, onLoad, onError]);

  useEffect(() => {
    if (isVisible && !hasLoaded) {
      recordLoadStart(componentName);
      setHasLoaded(true);
    }
  }, [isVisible, hasLoaded, componentName]);

  useEffect(() => {
    if (hasLoaded) {
      recordLoadEnd(componentName);
    }
  }, [hasLoaded, componentName]);

  const handleError = (error: Error) => {
    setError(error);
    onError?.(error);
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center p-4 text-center">
          <div className="text-red-500 mb-2">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-sm text-gray-600 mb-2">Erro ao carregar componente</p>
          <button
            onClick={() => {
              setError(null);
              setIsVisible(false);
              setHasLoaded(false);
              // Re-trigger intersection observer
              if (elementRef.current && observerRef.current) {
                observerRef.current.observe(elementRef.current);
              }
            }}
            className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    if (!isVisible || !hasLoaded) {
      return fallback || <Loading message={loadingMessage} />;
    }

    return (
      <ErrorBoundary onError={handleError}>
        {children}
      </ErrorBoundary>
    );
  };

  return (
    <div
      ref={elementRef}
      className={`lazy-wrapper ${className}`}
      style={{ minHeight: !isVisible ? minHeight : 'auto' }}
      data-lazy-loaded={hasLoaded}
      data-lazy-visible={isVisible}
    >
      {renderContent()}
    </div>
  );
};

export default LazyWrapper;