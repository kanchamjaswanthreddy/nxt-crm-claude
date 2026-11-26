'use client';

import React, { useState, useCallback } from 'react';
import styles from './DataTable.module.css';

/**
 * Semantic, sortable data table with responsive card layout and optional bulk selection.
 *
 * @param {{
 *   columns: Array<{ key: string, label: string, sortable?: boolean, render?: (value: any, row: object) => React.ReactNode }>,
 *   data: Array<object>,
 *   onRowClick?: (row: object) => void,
 *   defaultSort?: { key: string, dir: 'asc' | 'desc' },
 *   responsive?: boolean,
 *   emptyState?: React.ReactNode,
 *   className?: string,
 *   selectable?: boolean,
 *   selectedIds?: Set<string>,
 *   onSelectionChange?: (ids: Set<string>) => void,
 * }} props
 */
export default function DataTable({
  columns,
  data,
  onRowClick,
  defaultSort,
  responsive = true,
  emptyState,
  className,
  selectable = false,
  selectedIds,
  onSelectionChange,
}) {
  const [sort, setSort] = useState(defaultSort || null);

  const handleSort = useCallback((key) => {
    setSort(prev => {
      if (prev?.key === key) {
        return prev.dir === 'asc' ? { key, dir: 'desc' } : null;
      }
      return { key, dir: 'asc' };
    });
  }, []);

  const sorted = sort
    ? [...data].sort((a, b) => {
        const aVal = a[sort.key];
        const bVal = b[sort.key];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        const cmp = typeof aVal === 'string'
          ? aVal.localeCompare(bVal, undefined, { sensitivity: 'base' })
          : aVal - bVal;
        return sort.dir === 'asc' ? cmp : -cmp;
      })
    : data;

  const allSelected = selectable && sorted.length > 0 && sorted.every(r => selectedIds?.has(r.id));
  const someSelected = selectable && sorted.some(r => selectedIds?.has(r.id));

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(sorted.map(r => r.id)));
    }
  };

  const handleSelectRow = (id, e) => {
    e.stopPropagation();
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  return (
    <div className={`${styles.wrapper} ${className || ''}`}>
      <table className={`${styles.table} ${responsive ? styles.responsive : ''}`}>
        <thead className={styles.thead}>
          <tr>
            {selectable && (
              <th className={styles.th} style={{ width: '40px', textAlign: 'center' }} scope="col">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={handleSelectAll}
                  aria-label="Select all rows"
                  className={styles.checkbox}
                />
              </th>
            )}
            {columns.map(col => (
              <th
                key={col.key}
                className={`${styles.th} ${col.sortable ? styles.sortable : ''} ${sort?.key === col.key ? styles.sortActive : ''}`}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                onKeyDown={col.sortable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(col.key); } } : undefined}
                tabIndex={col.sortable ? 0 : undefined}
                aria-sort={sort?.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                scope="col"
              >
                {col.label}
                {col.sortable && (
                  <span className={styles.sortIcon} aria-hidden="true">
                    {sort?.key === col.key
                      ? (sort.dir === 'asc' ? '\u2191' : '\u2193')
                      : '\u2195'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && emptyState ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)}>{emptyState}</td>
            </tr>
          ) : (
            sorted.map((row, i) => {
              const isSelected = selectable && selectedIds?.has(row.id);
              return (
                <tr
                  key={row.id || i}
                  className={`${styles.tr} ${onRowClick ? styles.trClickable : ''} ${isSelected ? styles.trSelected : ''}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); } } : undefined}
                >
                  {selectable && (
                    <td className={styles.td} style={{ width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected || false}
                        onChange={(e) => handleSelectRow(row.id, e)}
                        aria-label={`Select row ${row.id}`}
                        className={styles.checkbox}
                      />
                    </td>
                  )}
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={styles.td}
                      data-label={col.label}
                    >
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '--')}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
