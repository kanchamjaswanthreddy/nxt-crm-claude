'use client';

import React from 'react';
import styles from './FilterBar.module.css';

/**
 * @param {{
 *   search?: { value: string, onChange: (val: string) => void, placeholder?: string },
 *   filters?: Array<{ key: string, label: string, options: Array<{ value: string, label: string }>, value: string, onChange: (val: string) => void }>,
 *   chips?: Array<{ key: string, label: string, active: boolean, onClick: () => void }>,
 *   onClear?: () => void,
 *   className?: string,
 * }} props
 */
export default function FilterBar({ search, filters, chips, onClear, className }) {
  const hasActiveFilters = filters?.some(f => f.value !== '') || chips?.some(c => c.active);

  return (
    <div className={`${styles.bar} ${className || ''}`}>
      {search && (
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            className={styles.searchInput}
            type="text"
            value={search.value}
            onChange={e => search.onChange(e.target.value)}
            placeholder={search.placeholder || 'Search...'}
          />
        </div>
      )}

      {filters && filters.length > 0 && (
        <div className={styles.filters}>
          {filters.map(filter => (
            <select
              key={filter.key}
              className={`${styles.select} ${filter.value ? styles.selectActive : ''}`}
              value={filter.value}
              onChange={e => filter.onChange(e.target.value)}
              aria-label={filter.label}
            >
              <option value="">{filter.label}</option>
              {filter.options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ))}
        </div>
      )}

      {chips && chips.length > 0 && (
        <div className={styles.filters}>
          {chips.map(chip => (
            <button
              key={chip.key}
              className={`${styles.chip} ${chip.active ? styles.chipActive : ''}`}
              onClick={chip.onClick}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {hasActiveFilters && onClear && (
        <button className={styles.clearBtn} onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  );
}
