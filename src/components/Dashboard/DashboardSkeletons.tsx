import React from 'react';
import { 
  Skeleton, 
  SkeletonMetricCard, 
  SkeletonChart, 
  SkeletonPieChart, 
  SkeletonList,
  SkeletonCard 
} from '../ui/Skeleton';

// Skeleton for the metrics row
export const MetricsRowSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <SkeletonMetricCard />
    <SkeletonMetricCard />
    <SkeletonMetricCard />
  </div>
);

// Skeleton for top songs section
export const TopSongsSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm">
    <div className="animate-pulse">
      <div className="flex items-center mb-4">
        <Skeleton width="1.25rem" height="1.25rem" className="mr-2" />
        <Skeleton height="1.5rem" width="60%" />
      </div>
      <SkeletonList items={5} />
    </div>
  </div>
);

// Skeleton for radios list section
export const RadioListSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm">
    <div className="animate-pulse">
      <div className="flex items-center mb-4">
        <Skeleton width="1.25rem" height="1.25rem" className="mr-2" />
        <Skeleton height="1.5rem" width="70%" />
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <Skeleton height="0.875rem" width="75%" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Skeleton for artist bar chart
export const ArtistChartSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm flex flex-col flex-1 md:w-1/2">
    <div className="animate-pulse">
      <div className="flex items-center mb-4">
        <Skeleton height="1.5rem" width="60%" />
      </div>
      <div className="h-96 md:flex-grow md:min-h-[280px] flex items-end justify-between space-x-2 px-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex flex-col items-center flex-1">
            <Skeleton
              width="100%"
              height={`${Math.random() * 150 + 50}px`}
              className="mb-2"
            />
            <Skeleton height="0.75rem" width="80%" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Skeleton for genre pie chart
export const GenreChartSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm flex flex-col flex-1 md:w-1/2">
    <div className="animate-pulse">
      <div className="flex items-center mb-4">
        <Skeleton height="1.5rem" width="60%" />
      </div>
      <div className="h-96 md:flex-grow md:min-h-[320px] flex items-center justify-center">
        <div className="relative">
          <Skeleton width="200px" height="200px" rounded />
          {/* Legend skeleton */}
          <div className="absolute -right-20 top-1/2 transform -translate-y-1/2 space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Skeleton width="0.75rem" height="0.75rem" />
                <Skeleton height="0.75rem" width="4rem" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Skeleton for the entire dashboard
export const DashboardSkeleton: React.FC = () => (
  <div className="dashboard-container p-4 md:p-6 space-y-6">
    {/* Header skeleton */}
    <div className="flex justify-end items-center mb-4">
      <div className="flex items-center gap-2">
        <Skeleton height="1rem" width="8rem" />
        <Skeleton width="2.5rem" height="2.5rem" rounded />
      </div>
    </div>

    {/* Progress indicator skeleton */}
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
      <div className="animate-pulse">
        <div className="flex items-center justify-between mb-2">
          <Skeleton height="0.875rem" width="8rem" />
          <Skeleton height="0.875rem" width="2rem" />
        </div>
        <Skeleton height="0.5rem" width="100%" className="rounded-full" />
      </div>
    </div>

    {/* Metrics row skeleton */}
    <MetricsRowSkeleton />

    {/* Songs and radios row skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <TopSongsSkeleton />
      <RadioListSkeleton />
    </div>

    {/* Charts row skeleton */}
    <div className="flex flex-col md:flex-row gap-6">
      <ArtistChartSkeleton />
      <GenreChartSkeleton />
    </div>
  </div>
);

// Progressive loading skeletons for different sections
export const EssentialDataSkeleton: React.FC = () => (
  <div className="dashboard-container p-4 md:p-6 space-y-6">
    <div className="flex justify-center items-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <Skeleton height="1rem" width="10rem" className="mx-auto mb-2" />
        <div className="w-48 mx-auto">
          <Skeleton height="0.5rem" width="100%" className="rounded-full" />
        </div>
      </div>
    </div>
  </div>
);

export const SecondaryDataSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm">
      <div className="animate-pulse text-center py-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <Skeleton height="0.875rem" width="8rem" className="mx-auto" />
      </div>
    </div>
    <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm">
      <div className="h-96 md:flex-grow md:min-h-[280px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <Skeleton height="0.875rem" width="8rem" className="mx-auto" />
        </div>
      </div>
    </div>
  </div>
);

export const OptionalDataSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm flex flex-col flex-1">
    <div className="h-96 md:flex-grow md:min-h-[320px] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <Skeleton height="0.875rem" width="8rem" className="mx-auto" />
      </div>
    </div>
  </div>
);