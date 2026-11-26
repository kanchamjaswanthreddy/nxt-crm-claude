import React from 'react';
import s from './SegTabs.module.css';

/** Pill tabs. tabs: [{ key, label, count }] */
export default function SegTabs({ tabs = [], value, onChange, label = 'Views', size = 'md', className = '' }) {
  return (
    <div className={`${s.tabs} ${className}`} role="tablist" aria-label={label} data-size={size}>
      {tabs.map(t => (
        <button key={t.key} type="button" role="tab" aria-selected={value === t.key} className={s.tab} onClick={() => onChange(t.key)}>
          {t.label}{t.count != null && <b>{t.count}</b>}
        </button>
      ))}
    </div>
  );
}
