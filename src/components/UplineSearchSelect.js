"use client";

import React, { useState, useRef, useEffect } from 'react';

const dn = (a) => [a?.first_name, a?.middle_name, a?.last_name].filter(Boolean).join(' ') || a?.full_name || a?.name || a?.email || '';

export default function UplineSearchSelect({ agents = [], value, onChange }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selected = agents.find(a => a.id === value);

  const filtered = agents.filter(a => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const name = dn(a).toLowerCase();
    const nxtId = (a.nxt_id || '').toLowerCase();
    return name.includes(q) || nxtId.includes(q);
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

  const handleSelect = (agentId) => {
    onChange(agentId);
    setQuery('');
    setIsOpen(false);
  };

  const displayValue = selected
    ? `${selected.nxt_id || '---'} — ${dn(selected)}`
    : '';

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={isOpen ? query : displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => {
          setIsOpen(true);
          setQuery('');
        }}
        placeholder="Search by NXT ID or name..."
        style={{
          width: '100%',
          padding: 'var(--space-2) 16px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--surface-card)',
          fontFamily: 'var(--font-base)',
          fontSize: 'var(--text-secondary)',
          color: 'var(--text-primary)',
          outline: 'none',
          transition: 'border-color 0.2s ease',
          boxSizing: 'border-box',
        }}
      />

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          backgroundColor: 'var(--surface-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 100,
        }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: '12px 16px',
              fontSize: '16px',
              color: 'var(--text-secondary)',
              textAlign: 'center',
            }}>
              No results found
            </div>
          ) : (
            filtered.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleSelect(a.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 16px',
                  border: 'none',
                  backgroundColor: a.id === value ? 'rgba(12, 16, 34, 0.06)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                  fontFamily: 'var(--font-base)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(12, 16, 34, 0.04)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = a.id === value ? 'rgba(12, 16, 34, 0.06)' : 'transparent'}
              >
                <span style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#0C1022',
                  backgroundColor: 'rgba(12, 16, 34, 0.08)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  letterSpacing: '0.5px',
                  flexShrink: 0,
                }}>
                  {a.nxt_id || '---'}
                </span>
                <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {dn(a)}
                </span>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                  {a.role}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
