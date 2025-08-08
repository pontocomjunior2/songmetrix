"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

export function ResponsiveDataTable<TData>(props: ResponsiveDataTableProps<TData>) {
  const {
    data,
    columns,
    getRowKey,
    emptyState = (
      <div className="text-sm text-muted-foreground p-6 text-center">Nenhum item encontrado.</div>
    ),
    className,
    tableClassName,
    mobileCardClassName,
  } = props;

  const resolvedKey = (row: TData, index: number) => {
    if (getRowKey) return getRowKey(row, index);
    // @ts-expect-error tentativa de usar id se existir
    return row?.id ?? index;
  };

  const primaryColumn = React.useMemo(() => {
    return (
      columns.find((c) => c.isPrimaryMobileField) ||
      columns.find((c) => !c.hideOnMobile) ||
      columns[0]
    );
  }, [columns]);

  return (
    <div className={cn("w-full", className)}>
      {/* Desktop / Tablets >= sm */}
      <div className="hidden sm:block overflow-x-auto rounded-md border">
        <Table className={cn("min-w-full", tableClassName)}>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.id} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>{emptyState}</TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow key={resolvedKey(row, index)}>
                  {columns.map((col) => {
                    const value =
                      col.render?.(row) ??
                      (col.accessorKey ? (row as any)[col.accessorKey] : undefined);
                    return (
                      <TableCell key={col.id} className={col.className}>
                        {value as React.ReactNode}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile < sm */}
      <div className="sm:hidden space-y-3">
        {data.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-4">{emptyState}</CardContent>
          </Card>
        )}

        {data.map((row, index) => {
          const key = resolvedKey(row, index);
          const titleValue =
            primaryColumn?.render?.(row) ??
            (primaryColumn?.accessorKey ? (row as any)[primaryColumn.accessorKey] : undefined);

          return (
            <Card key={key} className={cn("", mobileCardClassName)} role="listitem">
              <CardContent className="p-4">
                {primaryColumn && (
                  <div className="text-sm font-medium mb-2">{titleValue}</div>
                )}

                <div className="grid grid-cols-1 gap-2">
                  {columns
                    .filter((c) => c.id !== primaryColumn?.id && !c.hideOnMobile)
                    .map((col) => {
                      const value =
                        col.render?.(row) ??
                        (col.accessorKey ? (row as any)[col.accessorKey] : undefined);
                      return (
                        <div key={col.id} className="flex items-start justify-between">
                          <span className="text-xs text-muted-foreground pr-3">
                            {col.header}
                          </span>
                          <span className="text-sm text-foreground text-right break-words">
                            {value as React.ReactNode}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default ResponsiveDataTable;

// Tipos (declarados ao final do arquivo)
export interface ResponsiveColumn<TData> {
  id: string;
  header: React.ReactNode;
  className?: string;
  hideOnMobile?: boolean;
  render?: (row: TData) => React.ReactNode;
  accessorKey?: keyof TData;
  isPrimaryMobileField?: boolean;
}

interface ResponsiveDataTableProps<TData> {
  data: TData[];
  columns: ResponsiveColumn<TData>[];
  getRowKey?: (row: TData, index: number) => string | number;
  emptyState?: React.ReactNode;
  className?: string;
  tableClassName?: string;
  mobileCardClassName?: string;
}


