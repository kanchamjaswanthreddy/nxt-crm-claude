import React from 'react';
import s from './StatTiles.module.css';

/**
 * Row of headline figures. The first tile leads (dark, larger) unless `lead={false}`.
 * items: [{ label, value, note, tone: 'amber' | 'good' | 'warn', share: 0..1, onClick, active }]
 */
export default function StatTiles({ items = [], lead = true, className = '' }) {
  return (
    <div className={`${s.row} ${className}`} data-count={items.length} data-lead={lead || undefined}>
      {items.map((it, i) => {
        const Tag = it.onClick ? 'button' : 'div';
        return (
          <Tag
            key={it.label}
            type={it.onClick ? 'button' : undefined}
            onClick={it.onClick}
            aria-pressed={it.onClick ? !!it.active : undefined}
            className={s.tile}
            data-lead={(lead && i === 0) || undefined}
            data-tone={it.tone || undefined}
            data-active={it.active || undefined}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span className={s.label}>{it.label}</span>
            <span className={s.value}>{it.value}</span>
            {typeof it.share === 'number' && (
              <span className={s.meter} aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(1, it.share)) * 100}%` }} /></span>
            )}
            {it.note && <span className={s.note}>{it.note}</span>}
          </Tag>
        );
      })}
    </div>
  );
}
