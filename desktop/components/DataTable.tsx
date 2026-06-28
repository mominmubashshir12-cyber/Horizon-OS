// DataTable — generic sortable data table with dark theme styling and custom cell renderers
'use client';

import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
}

export default function DataTable<T>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data available',
  pagination,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortKey as keyof T] as any;
      const bVal = b[sortKey as keyof T] as any;

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDirection]);

  const getSortIcon = (key: string) => {
    if (sortKey !== key) return <ChevronsUpDown size={14} className="text-[#52525b]" />;
    return sortDirection === 'asc' ? (
      <ChevronUp size={14} className="text-[#0070f3]" />
    ) : (
      <ChevronDown size={14} className="text-[#0070f3]" />
    );
  };

  return (
    <div className="overflow-hidden rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-base)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--color-border-base)', background: 'var(--color-surface-highlight)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${
                    col.sortable ? 'cursor-pointer select-none' : ''
                  }`}
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && getSortIcon(col.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b transition-colors duration-100 ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                  style={{ borderColor: 'var(--color-border-base)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col, colIdx) => (
                    <td 
                      key={col.key} 
                      className={`px-4 py-3 text-sm ${colIdx === 0 ? 'font-medium' : ''}`}
                      style={{ color: colIdx === 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                    >
                      {col.render
                        ? col.render(row[col.key as keyof T], row)
                        : (row[col.key as keyof T] as React.ReactNode) ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--color-border-base)', background: 'var(--color-surface-highlight)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage <= 1}
              className="px-3 py-1 text-sm rounded-md border disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ borderColor: 'var(--color-border-base)', color: 'var(--color-text-primary)' }}
            >
              Previous
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage >= pagination.totalPages}
              className="px-3 py-1 text-sm rounded-md border disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ borderColor: 'var(--color-border-base)', color: 'var(--color-text-primary)' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
