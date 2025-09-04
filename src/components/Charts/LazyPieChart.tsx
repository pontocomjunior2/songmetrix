import React, { lazy, Suspense } from 'react';
import { LazyWrapper } from '@/components/LazyWrapper';
import { SkeletonPieChart } from '@/components/ui/Skeleton';

// Lazy load Recharts components
const PieChart = lazy(() => import('recharts').then(module => ({ default: module.PieChart })));
const Pie = lazy(() => import('recharts').then(module => ({ default: module.Pie })));
const Cell = lazy(() => import('recharts').then(module => ({ default: module.Cell })));
const Tooltip = lazy(() => import('recharts').then(module => ({ default: module.Tooltip })));
const Legend = lazy(() => import('recharts').then(module => ({ default: module.Legend })));
const ResponsiveContainer = lazy(() => import('recharts').then(module => ({ default: module.ResponsiveContainer })));

interface LazyPieChartProps {
  data: any[];
  dataKey: string;
  nameKey: string;
  colors?: string[];
  height?: number;
  className?: string;
  title?: string;
  showLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
}

const defaultColors = ['#1E3A8A', '#3B82F6', '#60A5FA', '#38BDF8', '#7DD3FC'];

export const LazyPieChart: React.FC<LazyPieChartProps> = ({
  data,
  dataKey,
  nameKey,
  colors = defaultColors,
  height = 280,
  className = '',
  title,
  showLegend = true,
  innerRadius = 0,
  outerRadius = 80,
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
        <Suspense fallback={<SkeletonPieChart />}>
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                paddingAngle={2}
                dataKey={dataKey}
                nameKey={nameKey}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={colors[index % colors.length]} 
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              {showLegend && (
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  wrapperStyle={{ fontSize: '12px' }}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
        </Suspense>
      </div>
    </LazyWrapper>
  );
};

export default LazyPieChart;