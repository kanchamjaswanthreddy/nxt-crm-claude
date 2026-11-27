'use client';

// Dashboard widgets. Display only: every figure comes from the data the dashboard already loads.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import w from './widgets.module.css';

const usd0 = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0);
const compact = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
  return `$${Math.round(n)}`;
};
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Counts up to `value` once, when it first appears. */
export function CountUp({ value, format = (v) => Math.round(v).toLocaleString('en-US'), duration = 1300 }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(reduced() ? target : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced()) { setShown(target); return undefined; }
    const start = performance.now(); const a = from.current; let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration); const e = 1 - Math.pow(1 - p, 4);
      setShown(a + (target - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return <span className={w.count}>{format(shown)}</span>;
}

/** Moving strip of live figures. Pauses on hover and for people who prefer less motion. */
export function Ticker({ items = [] }) {
  const list = items.filter(Boolean);
  if (list.length === 0) return null;
  const row = (hidden) => (
    <div className={w.tickerRow} aria-hidden={hidden || undefined}>
      {list.map((it, i) => (
        <span key={i} className={w.tick} data-tone={it.tone || undefined}>
          <i aria-hidden="true" />
          <b>{it.value}</b>
          {it.label}
        </span>
      ))}
    </div>
  );
  return (
    <div className={w.ticker} role="group" aria-label="Live figures">
      <div className={w.tickerTrack}>{row(false)}{row(true)}</div>
    </div>
  );
}

function monthLabels(n) {
  const now = new Date(); const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleString('en-US', { month: 'short' }));
  return out;
}

/** Six months of production and deals won, with a switch and hover read-out. */
export function TrendWidget({ production = [], deals = [], title = 'Six-month trend' }) {
  const [mode, setMode] = useState('production');
  const [hover, setHover] = useState(null);
  const series = mode === 'production' ? production : deals;
  const labels = useMemo(() => monthLabels(series.length), [series.length]);
  const max = Math.max(1, ...series);
  const total = series.reduce((t, v) => t + (v || 0), 0);
  const avg = series.length ? total / series.length : 0;
  const best = series.indexOf(Math.max(...series));
  const fmt = mode === 'production' ? usd0 : (v) => `${Math.round(v)}`;
  const active = hover == null ? series.length - 1 : hover;
  const prev = active > 0 ? series[active - 1] : null;
  const change = prev ? ((series[active] - prev) / prev) * 100 : null;

  return (
    <section className={w.card}>
      <header className={w.head}>
        <h3 className={w.title}>{title}</h3>
        <div className={w.seg} role="tablist" aria-label="Trend measure">
          <button type="button" role="tab" aria-selected={mode === 'production'} onClick={() => setMode('production')}>Production</button>
          <button type="button" role="tab" aria-selected={mode === 'deals'} onClick={() => setMode('deals')}>Deals won</button>
        </div>
      </header>

      <div className={w.trendTop}>
        <div>
          <p className={w.small}>{labels[active]}{hover == null ? ', this month' : ''}</p>
          <p className={w.big}>{fmt(series[active] || 0)}</p>
        </div>
        {change != null && Number.isFinite(change) && (
          <span className={w.delta} data-down={change < 0 || undefined}>{change >= 0 ? '▲' : '▼'} {Math.abs(Math.round(change))}% on {labels[active - 1]}</span>
        )}
      </div>

      <div className={w.bars} key={mode} onMouseLeave={() => setHover(null)}>
        <span className={w.avgLine} style={{ bottom: `calc(${(avg / max) * 100}% * 0.82 + 30px)` }}><em>avg {mode === 'production' ? compact(avg) : avg.toFixed(1)}</em></span>
        {series.map((v, i) => (
          <button key={i} type="button" className={w.barCol} data-on={i === active || undefined} data-best={i === best || undefined}
            onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            aria-label={`${labels[i]}: ${fmt(v || 0)}`}>
            <span className={w.barTrack}><span className={w.bar} style={{ height: `${Math.max(3, ((v || 0) / max) * 100)}%`, animationDelay: `${i * 90}ms` }} /></span>
            <span className={w.barLabel}>{labels[i]}</span>
          </button>
        ))}
      </div>

      <footer className={w.facts}>
        <div><span>Six-month total</span><b>{mode === 'production' ? compact(total) : total}</b></div>
        <div><span>Monthly average</span><b>{mode === 'production' ? compact(avg) : avg.toFixed(1)}</b></div>
        <div><span>Best month</span><b>{labels[best]}</b></div>
      </footer>
    </section>
  );
}

/** Ring split into parts. parts: [{ label, value, tone }] */
export function RingWidget({ title, parts = [], centerValue, centerLabel, footer, action }) {
  const total = parts.reduce((t, p) => t + (p.value || 0), 0);
  const R = 54; const C = 2 * Math.PI * R; let offset = 0;
  return (
    <section className={w.card}>
      <header className={w.head}><h3 className={w.title}>{title}</h3>{action}</header>
      <div className={w.ringWrap}>
        <svg viewBox="0 0 140 140" className={w.ring} role="img" aria-label={parts.map(p => `${p.label} ${p.value}`).join(', ')}>
          <circle cx="70" cy="70" r={R} className={w.ringBase} />
          {total > 0 && parts.map((p, i) => {
            const len = (p.value / total) * C; const gap = parts.filter(x => x.value > 0).length > 1 ? 3 : 0;
            const el = <circle key={p.label} cx="70" cy="70" r={R} className={w.ringSeg} data-tone={p.tone || i}
              strokeDasharray={`${Math.max(0, len - gap)} ${C}`} strokeDashoffset={-offset} style={{ animationDelay: `${i * 160}ms`, '--len': `${Math.max(0, len - gap)}`, '--c': `${C}` }} />;
            offset += len; return el;
          })}
        </svg>
        <div className={w.ringCenter}><b>{centerValue}</b><span>{centerLabel}</span></div>
      </div>
      <ul className={w.legend}>
        {parts.map((p, i) => (
          <li key={p.label}><i data-tone={p.tone || i} /><span>{p.label}</span><b>{p.display != null ? p.display : p.value}</b><em>{total > 0 ? Math.round((p.value / total) * 100) : 0}%</em></li>
        ))}
      </ul>
      {footer && <p className={w.note}>{footer}</p>}
    </section>
  );
}

/** Ranked producers with bars and each person's share of the total shown. */
export function Leaderboard({ producers = [], total = 0, onOpen, onAll }) {
  const max = Math.max(1, ...producers.map(p => p.production || 0));
  return (
    <section className={w.card}>
      <header className={w.head}><h3 className={w.title}>Top producers this month</h3><button type="button" className={w.link} onClick={onAll}>Scoreboard</button></header>
      {producers.length === 0 ? <p className={w.empty}>No production recorded yet this month.</p> : (
        <ol className={w.board}>
          {producers.map((p, i) => (
            <li key={p.id} style={{ animationDelay: `${i * 80}ms` }}>
              <button type="button" className={w.boardRow} onClick={() => onOpen && onOpen(p)}>
                <span className={w.rank} data-top={i === 0 || undefined}>{i + 1}</span>
                <Avatar name={p.name} photoUrl={p.photoUrl} size={40} />
                <span className={w.who}><b>{p.name}</b><small>{p.level || 'Agent'}</small></span>
                <span className={w.boardBar}><span style={{ width: `${Math.max(4, (p.production / max) * 100)}%`, animationDelay: `${200 + i * 90}ms` }} data-top={i === 0 || undefined} /></span>
                <span className={w.amt}><b>{compact(p.production)}</b>{total > 0 && <small>{Math.round((p.production / total) * 100)}% of agency</small>}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const ago = (iso) => {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return 'Today'; if (d === 1) return 'Yesterday'; if (d < 30) return `${d} days ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const KIND = { deal_created: 'deal', agent_invited: 'invite', agent_approved: 'ok', agent_activated: 'ok' };

/** Recent activity as a timeline. */
export function ActivityTimeline({ activity = [] }) {
  return (
    <section className={w.card}>
      <header className={w.head}><h3 className={w.title}>Recent activity</h3><span className={w.live}><i />Last 30 days</span></header>
      {activity.length === 0 ? <p className={w.empty}>Nothing yet. New deals and team changes appear here.</p> : (
        <ol className={w.timeline}>
          {activity.map((a, i) => (
            <li key={i} data-kind={KIND[a.type] || 'deal'} style={{ animationDelay: `${i * 70}ms` }}>
              <span className={w.node} aria-hidden="true" />
              <p><b>{a.actor}</b> {a.text}</p>
              <time>{ago(a.timestamp)}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Small tiles of derived figures. items: [{ label, value, note }] */
export function FactGrid({ title, items = [] }) {
  return (
    <section className={w.card}>
      <header className={w.head}><h3 className={w.title}>{title}</h3></header>
      <div className={w.factGrid}>
        {items.map((it, i) => (
          <div key={it.label} className={w.fact} style={{ animationDelay: `${i * 80}ms` }}>
            <span>{it.label}</span><b>{it.value}</b>{it.note && <small>{it.note}</small>}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Cursor-following glow for cards inside the element this is attached to. */
export function useSpotlight() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el || reduced()) return undefined;
    const move = (e) => {
      const card = e.target.closest('[data-spot], section, button');
      if (!card || !el.contains(card)) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`); card.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    el.addEventListener('pointermove', move);
    return () => el.removeEventListener('pointermove', move);
  }, []);
  return ref;
}
