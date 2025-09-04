import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
  animate?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  rounded = false,
  animate = true
}) => {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700';
  const animationClasses = animate ? 'animate-pulse' : '';
  const roundedClasses = rounded ? 'rounded-full' : 'rounded';
  
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${animationClasses} ${roundedClasses} ${className}`}
      style={style}
    />
  );
};

// Skeleton variants for common use cases
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 1, 
  className = '' 
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton
        key={index}
        height="1rem"
        width={index === lines - 1 ? '75%' : '100%'}
        className="rounded"
      />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm ${className}`}>
    <div className="animate-pulse">
      <Skeleton height="1.5rem" width="60%" className="mb-4" />
      <div className="space-y-3">
        <Skeleton height="1rem" width="100%" />
        <Skeleton height="1rem" width="85%" />
        <Skeleton height="1rem" width="70%" />
      </div>
    </div>
  </div>
);

export const SkeletonMetricCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm flex items-center space-x-4 ${className}`}>
    <div className="animate-pulse flex items-center space-x-4 w-full">
      <Skeleton width="3rem" height="3rem" rounded className="flex-shrink-0" />
      <div className="flex-1">
        <Skeleton height="0.875rem" width="60%" className="mb-2" />
        <Skeleton height="1.5rem" width="40%" />
      </div>
    </div>
  </div>
);

export const SkeletonChart: React.FC<{ className?: string; height?: string }> = ({ 
  className = '', 
  height = '280px' 
}) => (
  <div className={`bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm ${className}`}>
    <div className="animate-pulse">
      <Skeleton height="1.5rem" width="50%" className="mb-4" />
      <div className="flex items-end justify-between space-x-2" style={{ height }}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton
            key={index}
            width="100%"
            height={`${Math.random() * 60 + 40}%`}
            className="flex-1"
          />
        ))}
      </div>
    </div>
  </div>
);

export const SkeletonPieChart: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm ${className}`}>
    <div className="animate-pulse">
      <Skeleton height="1.5rem" width="50%" className="mb-4" />
      <div className="flex items-center justify-center" style={{ height: '320px' }}>
        <Skeleton width="200px" height="200px" rounded />
      </div>
    </div>
  </div>
);

export const SkeletonList: React.FC<{ 
  items?: number; 
  className?: string;
  showAvatar?: boolean;
}> = ({ 
  items = 5, 
  className = '',
  showAvatar = false 
}) => (
  <div className={`space-y-4 ${className}`}>
    {Array.from({ length: items }).map((_, index) => (
      <div key={index} className="flex items-center justify-between animate-pulse">
        <div className="flex items-center space-x-3 flex-1">
          {showAvatar && (
            <Skeleton width="2.5rem" height="2.5rem" rounded />
          )}
          <div className="flex-1">
            <Skeleton height="1rem" width="70%" className="mb-1" />
            <Skeleton height="0.875rem" width="50%" />
          </div>
        </div>
        <Skeleton height="1rem" width="3rem" />
      </div>
    ))}
  </div>
);