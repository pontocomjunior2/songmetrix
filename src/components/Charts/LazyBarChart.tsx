import React, { lazy, Suspense } from 'react';
import { LazyWrapper } from '@/components/LazyWrapper';
import { SkeletonChart } from '@/components/ui/Skeleton';

// Lazy load Recharts components
const BarChart = lazy(() => import('recharts').then(module => ({ default: module.BarChart })));
const Bar = lazy(() => import('recharts').then(module => ({ default: module.Bar })));
const XAxis = lazy(() => import('recharts').then(module => ({ default: module.XAxis })));
const YAxis = lazy(() => import('recharts').then(module => ({ default: module.YAxis })));
const CartesianGrid = lazy(() => import('recharts').then(module => ({ default: module.CartesianGrid })));
const Tooltip = lazy(() => import('recharts').then(module => ({ default: module.Tooltip })));
const ResponsiveContainer = lazy(() => import('recharts').then(module => ({ default: module.ResponsiveContainer })));

interface LazyBarChartProps {
  data: any[];
  dataKey: string;
  xAxisKey: string;
  color?: string;
  height?: number;
  className?: string;
  title?: string;
}

export const LazyBarChart: React.FC<LazyBarChartProps> = ({
  data,
  dataKey,
  xAxisKey,
  color = '#3B82F6',
  height = 280,
  className = '',
  title,
}) => {
  return (
    <LazyWrapper
      threshold={0.1}
      rootMargin="100px"
      loadingMessage="Carregando gráfico..."
      minHeight={`${height}px`}
      className={className}
    >
      <div className="w-full">
        {title && (
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {title}
          </h3>
        )}
        <Suspense fallback={<SkeletonChart height={`${height}px`} />}>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey={xAxisKey}
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Bar 
                dataKey={dataKey} 
                fill={color}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Suspense>
      </div>
    </LazyWrapper>
  );
};

export default LazyBarChart;