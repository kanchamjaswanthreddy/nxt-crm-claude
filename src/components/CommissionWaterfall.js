"use client";

import React from 'react';
import s from './CommissionWaterfall.module.css';

const money = (v) => (v == null || Number.isNaN(Number(v)) ? '--' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v));
const pct = (v) => `${Math.round(Number(v) * 100) / 100}%`;

/**
 * Shows where a policy's premium goes: the writing agent's share first, then each upline's
 * differential in the order it was earned. Display only: every figure is read from the
 * commission and override records as they are stored; nothing is recalculated here.
 *
 * Props:
 *   premium        number
 *   agent          { name, level, percent, amount, status }
 *   overrides      [{ id, name, level, percent, amount, status }]  (nearest upline first)
 *   needsReview    boolean
 */
export default function CommissionWaterfall({ premium, agent, overrides = [], needsReview = false }) {
  const rows = [
    { key: 'agent', role: 'Writing agent', ...agent },
    ...overrides.map((o, i) => ({ key: o.id || `o${i}`, role: i === 0 ? 'Direct upline' : `Upline ${i + 1}`, ...o })),
  ];
  const paidPct = rows.reduce((t, r) => t + (Number(r.percent) || 0), 0);
  const paidAmt = rows.reduce((t, r) => t + (Number(r.amount) || 0), 0);
  const rest = Math.max(0, 100 - paidPct);
  let running = 0;

  return (
    <section className={s.wrap} aria-label="How this commission is split">
      <header className={s.head}>
        <div>
          <h3 className={s.title}>Where the premium goes</h3>
          <p className={s.sub}>The writing agent is paid first. Each upline earns the difference between their rate and the rate below them.</p>
        </div>
        <div className={s.total}>
          <span>Premium</span>
          <b>{money(premium)}</b>
        </div>
      </header>

      {needsReview ? (
        <p className={s.review}>This policy has no matching rate yet, so the split cannot be shown until an admin resolves it in Needs Review.</p>
      ) : (
        <>
          <div className={s.bar} role="img" aria-label={`${pct(paidPct)} of the premium is paid out as commission`}>
            {rows.map((r, i) => (
              <span key={r.key} className={s.seg} data-tone={Math.min(i, 4)} style={{ flexGrow: Number(r.percent) || 0, animationDelay: `${i * 120}ms` }}>
                {Number(r.percent) >= 6 && <em>{pct(r.percent)}</em>}
              </span>
            ))}
            {rest > 0 && <span className={`${s.seg} ${s.segRest}`} style={{ flexGrow: rest }}>{rest >= 6 && <em>{rest >= 30 ? `${pct(rest)} not paid out` : pct(rest)}</em>}</span>}
          </div>

          <ol className={s.chain}>
            {rows.map((r, i) => {
              running += Number(r.percent) || 0;
              return (
                <li key={r.key} className={s.step} style={{ animationDelay: `${150 + i * 110}ms` }}>
                  <span className={s.dot} data-tone={Math.min(i, 4)} aria-hidden="true" />
                  <div className={s.who}>
                    <span className={s.role}>{r.role}</span>
                    <b>{r.name || 'Unknown'}</b>
                    {r.level && <span className={s.level}>{r.level}</span>}
                  </div>
                  <div className={s.rate}>
                    <b>{i === 0 ? pct(r.percent) : `+${pct(r.percent)}`}</b>
                    <span>{i === 0 ? 'their rate' : `up to ${pct(running)}`}</span>
                  </div>
                  <div className={s.amt}>
                    <b>{money(r.amount)}</b>
                    {r.status && <span className={s.badge} data-paid={r.status === 'paid' || undefined}>{r.status === 'paid' ? 'Paid' : 'Pending'}</span>}
                  </div>
                </li>
              );
            })}
          </ol>

          {rest > 0 && <p className={s.note}>The striped part, {pct(rest)}, is not paid out as commission on this policy.</p>}

          <footer className={s.foot}>
            <span>Total paid out on this policy</span>
            <b>{money(paidAmt)}</b>
            <span className={s.footPct}>{pct(paidPct)} of premium</span>
          </footer>
        </>
      )}
    </section>
  );
}
