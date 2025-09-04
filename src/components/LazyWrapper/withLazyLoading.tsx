import React, { ComponentType, forwardRef } from 'react';
import { LazyWrapper } from './LazyWrapper';

interface WithLazyLoadingOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  loadingMessage?: string;
  minHeight?: string;
  fallback?: React.ComponentType;
}

/**
 * Higher-order component that wraps a component with lazy loading functionality
 */
export function withLazyLoading<P extends object>(
  Component: ComponentType<P>,
  options: WithLazyLoadingOptions = {}
) {
  const {
    threshold = 0.1,
    rootMargin = '50px',
    triggerOnce = true,
    loadingMessage,
    minHeight,
    fallback: FallbackComponent,
  } = options;

  const LazyComponent = forwardRef<any, P>((props, ref) => {
    const fallback = FallbackComponent ? <FallbackComponent /> : undefined;

    return (
      <LazyWrapper
        threshold={threshold}
        rootMargin={rootMargin}
        triggerOnce={triggerOnce}
        loadingMessage={loadingMessage}
        minHeight={minHeight}
        fallback={fallback}
      >
        <Component {...props} ref={ref} />
      </LazyWrapper>
    );
  });

  LazyComponent.displayName = `withLazyLoading(${Component.displayName || Component.name})`;

  return LazyComponent;
}

/**
 * Utility function to create lazy-loaded versions of components with specific configurations
 */
export const createLazyComponent = <P extends object>(
  Component: ComponentType<P>,
  options?: WithLazyLoadingOptions
) => {
  return withLazyLoading(Component, options);
};

export default withLazyLoading;