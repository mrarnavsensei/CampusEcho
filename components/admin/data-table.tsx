'use client';
import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { TableSkeleton } from './admin-skeleton';

export interface DataTableProps<T> {
  columns: Array<{
    key?: string;
    header?: string;
    label?: string;
    accessor?: string | ((row: T) => React.ReactNode);
    render?: (row: T) => React.ReactNode;
    sortable?: boolean;
    width?: string;
  }>;
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available',
  emptyState,
  onRowClick,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  if (loading) {
    return <TableSkeleton rows={5} />;
  }

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="rounded-lg border border-[#2A2A2A] overflow-hidden bg-[#111111]">
      <Table>
        <TableHeader className="bg-[#080808]">
          <TableRow className="border-[#2A2A2A] hover:bg-transparent">
            {columns.map((col, index) => {
              const key = col.key ?? (typeof col.accessor === 'string' ? col.accessor : `column-${index}`);
              return (
              <TableHead
                key={key}
                style={{ width: col.width }}
                className={cn(
                  "text-[#A3A3A3] font-medium h-10",
                  col.sortable && "cursor-pointer select-none hover:text-white transition-colors"
                )}
                onClick={() => col.sortable && handleSort(key)}
              >
                <div className="flex items-center space-x-1">
                  <span>{col.header ?? col.label}</span>
                  {col.sortable && sortKey === key && (
                    sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </div>
              </TableHead>
            )})}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow className="border-[#2A2A2A] hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-24 text-center text-[#A3A3A3]">
                {emptyState ?? emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((row, i) => (
              <TableRow
                key={row.id || i}
                onClick={() => onRowClick && onRowClick(row)}
                className={cn(
                  "border-[#2A2A2A] transition-colors duration-150",
                  i % 2 === 0 ? "bg-[#111111]" : "bg-[#141414]",
                  onRowClick ? "cursor-pointer hover:bg-[#202020]" : "hover:bg-[#181818]"
                )}
              >
                {columns.map((col, index) => {
                  const key = col.key ?? (typeof col.accessor === 'string' ? col.accessor : `column-${index}`);
                  return (
                  <TableCell key={key} className="text-white py-3">
                    {col.render ? col.render(row) : typeof col.accessor === 'function' ? col.accessor(row) : row[key]}
                  </TableCell>
                )})}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
