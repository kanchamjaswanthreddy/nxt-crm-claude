"use client";

import React, { useState, useRef, useEffect } from 'react';

const dn = (a) => {
  if (typeof a === 'string') return a;
  return [a?.first_name, a?.middle_name, a?.last_name].filter(Boolean).join(' ') || a?.full_name || a?.name || a?.email || '';
};

/**
 * Searchable agent/item picker dropdown.
 *
 * @param {Object[]} items - Array of items to pick from. Each needs at least { id }.
 *   For simple {id: label} maps, convert first with Object.entries(map).map(([id, label]) => ({ id, label })).
 * @param {string} value - Currently selected item id.
 * @param {function} onChange - Called with item id on selection.
 * @param {string} [placeholder] - Input placeholder text.
 * @param {string} [emptyLabel] - Text for the "no selection" option. If set, a clear option appears.
 * @param {function} [renderItem] - Custom render for each dropdown row. Receives (item, isSelected).
 * @param {function} [displayValue] - Custom display for the input when an item is selected. Receives item.
 * @param {function} [searchFields] - Returns an array of searchable strings for an item. Defaults to name + nxt_id.
 * @param {boolean} [disabled] - Disable the input.
 * @param {object} [style] - Additional style for the wrapper div.
 */
export default function AgentSearchSelect({
  items = [],
  value,
  onChange,
  placeholder = 'Search by name or ID...',
  emptyLabel,
  renderItem,
  displayValue: displayValueFn,
  searchFields,
  disabled = false,
  style: wrapperStyle,
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selected = items.find(a => a.id === value);

  const filtered = items.filter(a => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const fields = searchFields
      ? searchFields(a)
      : [dn(a), a.nxt_id || '', a.email || ''];
    return fields.some(f => (f || '').toLowerCase().includes(q));
  });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id) => {
    onChange(id);
    setQuery('');
    setIsOpen(false);
  };

  const selectedDisplay = selected
    ? (displayValueFn ? displayValueFn(selected) : `${selected.nxt_id || '---'} — ${dn(selected)}`)
    : '';

  const defaultRenderItem = (a, isSel) => (
    <>
      <span style={{
        fontSize: '11px', fontWeight: 700, color: '#0C1022',
        backgroundColor: 'rgba(12, 16, 34, 0.08)',
        padding: '2px 8px', borderRadius: '6px',
        fontFamily: 'monospace', letterSpacing: '0.5px', flexShrink: 0,
      }}>
        {a.nxt_id || a.label || '---'}
      </span>
      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
        {dn(a)}
      </span>
      {a.role && (
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
          {a.is_owner ? 'Owner' : a.role}
        </span>
      )}
    </>
  );

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', ...wrapperStyle }}>
      <div style={{ position: 'relative' }}>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={isOpen ? query : selectedDisplay}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (disabled) return;
            setIsOpen(true);
            setQuery('');
          }}
          disabled={disabled}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '10px 12px 10px 36px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            backgroundColor: disabled ? 'rgba(0,0,0,0.03)' : 'var(--surface-card)',
            fontFamily: 'var(--font-base)',
            fontSize: '14px',
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            boxSizing: 'border-box',
            cursor: disabled ? 'not-allowed' : 'text',
          }}
          onBlur={() => {}}
        />
      </div>

      {isOpen && !disabled && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          backgroundColor: 'var(--surface-card, #fff)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxHeight: '220px',
          overflowY: 'auto',
          zIndex: 10001,
        }}>
          {emptyLabel && (
            <button
              type="button"
              onClick={() => handleSelect('')}
              style={{
                display: 'flex', alignItems: 'center', width: '100%',
                padding: '10px 14px', border: 'none',
                backgroundColor: !value ? 'rgba(12, 16, 34, 0.06)' : 'transparent',
                cursor: 'pointer', textAlign: 'left',
                fontFamily: 'var(--font-base)',
                fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(12, 16, 34, 0.04)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = !value ? 'rgba(12, 16, 34, 0.06)' : 'transparent'}
            >
              {emptyLabel}
            </button>
          )}
          {filtered.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
              No results found
            </div>
          ) : (
            filtered.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleSelect(a.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  width: '100%', padding: '9px 14px', border: 'none',
                  backgroundColor: a.id === value ? 'rgba(12, 16, 34, 0.06)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                  fontFamily: 'var(--font-base)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(12, 16, 34, 0.04)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = a.id === value ? 'rgba(12, 16, 34, 0.06)' : 'transparent'}
              >
                {renderItem ? renderItem(a, a.id === value) : defaultRenderItem(a, a.id === value)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
