import React, { lazy, Suspense } from 'react';
import { LazyWrapper } from '@/components/LazyWrapper';
import Loading from '@/components/Common/Loading';

// Lazy load table components
const Table = lazy(() => import('@/components/ui/table').then(module => ({ default: module.Table })));
const TableHeader = lazy(() => import('@/components/ui/table').then(module => ({ default: module.TableHeader })));
const TableBody = lazy(() => import('@/components/ui/table').then(module => ({ default: module.TableBody })));
const TableRow = lazy(() => import('@/components/ui/table').then(module => ({ default: module.TableRow })));
const TableHead = lazy(() => import('@/components/ui/table').then(module => ({ default: module.TableHead })));
const TableCell = lazy(() => import('@/components/ui/table').then(module => ({ default: module.TableCell })));

interface Column {
  id: string;
  header: string;
  accessorKey?: string;
  cell?: (row: any) => React.ReactNode;
  className?: string;
}

interface LazyDataTableProps {
  data: any[];
  columns: Column[];
  className?: string;
  emptyMessage?: string;
  loading?: boolean;
  onRowClick?: (row: any) => void;
  rowClassName?: (row: any) => string;
}

const TableSkeleton: React.FC<{ columns: number; rows?: number }> = ({ 
  columns, 
  rows = 5 
}) => (
  <div className="animate-pulse">
    <div className="border rounded-lg overflow-hidden">
      {/* Header skeleton */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
      
      {/* Rows skeleton */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={colIndex} className="h-4 bg-gray-100 dark:bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const LazyDataTable: React.FC<LazyDataTableProps> = ({
  data,
  columns,
  className = '',
  emptyMessage = 'Nenhum dado encontrado',
  loading = false,
  onRowClick,
  rowClassName,
}) => {
  const renderTableContent = () => {
    if (loading) {
      return <TableSkeleton columns={columns.length} />;
    }

    return (
      <Suspense fallback={<TableSkeleton columns={columns.length} />}>
        <Table className={className}>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.id} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-gray-500">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow
                  key={index}
                  className={`${rowClassName ? rowClassName(row) : ''} ${
                    onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''
                  }`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <TableCell key={column.id} className={column.className}>
                      {column.cell 
                        ? column.cell(row)
                        : column.accessorKey 
                          ? row[column.accessorKey]
                          : ''
                      }
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Suspense>
    );
  };

  return (
    <LazyWrapper
      threshold={0.1}
      rootMargin="50px"
      loadingMessage="Carregando tabela..."
      minHeight="200px"
    >
      {renderTableContent()}
    </LazyWrapper>
  );
};

export default LazyDataTable;