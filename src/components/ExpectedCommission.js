'use client';

import React, { useEffect, useState } from 'react';
import { previewDealCommission } from '@/app/actions/commissionPreview';
import s from './ExpectedCommission.module.css';

const money = (v) => (v == null ? '--' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v));

/** Estimate of what a deal pays, and how the agent's commission is divided by their split percentages. Display only. */
export default function ExpectedCommission({ dealId, refreshKey }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let live = true;
    previewDealCommission(dealId).then(res => { if (live) setState(res.success ? { preview: res.preview } : { error: res.error }); });
    return () => { live = false; };
  }, [dealId, refreshKey]);

  if (state.loading) return <section className={s.wrap} aria-busy="true"><div className={s.skeleton} /></section>;
  if (state.error || !state.preview) return null;
  const p = state.preview;
  const rows = [{ key: 'keep', name: p.agentName, role: p.splits.length ? 'Writing agent keeps' : 'Writing agent', percent: p.keepPercent, amount: p.keepAmount },
    ...p.splits.map(x => ({ key: x.id, name: x.name, role: 'Split', percent: x.percent, amount: x.amount }))];
  const noRate = p.ratePercent == null;
  const why = p.missing.premium ? 'Add a premium to this deal to see an amount.'
    : p.missing.carrier || p.missing.policyType ? 'Choose a carrier and policy type on this deal to see an amount.'
    : p.missing.level ? 'This agent has no level set, so no rate applies yet.'
    : 'No commission rate is set for this carrier, policy type and agent level. Add one in Carriers & Rates.';

  return (
    <section className={s.wrap} aria-label="Expected commission">
      <header className={s.head}>
        <div>
          <h2 className={s.title}>{p.status === 'won' ? 'Commission on this deal' : 'Expected commission if won'}</h2>
          <p className={s.sub}>An estimate from today&rsquo;s rate and split settings. It is not a payment record.</p>
        </div>
        <div className={s.total}>
          <span>{noRate ? 'Rate not set' : `${p.ratePercent}% of ${money(p.premium)}`}</span>
          <b>{money(p.commissionAmount)}</b>
        </div>
      </header>

      {noRate && <p className={s.note}>{why}{p.splits.length > 0 ? ' The split percentages below still apply.' : ''}</p>}

      <div className={s.bar} role="img" aria-label={rows.map(r => `${r.name} ${r.percent}%`).join(', ')}>
        {rows.filter(r => r.percent > 0).map((r, i) => (
          <span key={r.key} className={s.seg} data-tone={Math.min(i, 4)} style={{ flexGrow: r.percent, animationDelay: `${i * 110}ms` }}>
            {r.percent >= 9 && <em>{r.percent}%</em>}
          </span>
        ))}
      </div>

      <ul className={s.rows}>
        {rows.map((r, i) => (
          <li key={r.key} style={{ animationDelay: `${120 + i * 90}ms` }}>
            <i data-tone={Math.min(i, 4)} aria-hidden="true" />
            <span className={s.who}><small>{r.role}</small><b>{r.name}</b></span>
            <span className={s.pct}>{r.percent}%</span>
            <span className={s.amt}>{money(r.amount)}</span>
          </li>
        ))}
      </ul>
      {p.splits.length === 0 && <p className={s.note}>No split is set for this agent, so they keep the full commission.</p>}
    </section>
  );
}
