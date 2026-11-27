'use client';

import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { fetchCarrierOptions, fetchCarrierContacts } from '@/app/actions/carrierDirectory';
import s from './carrierResources.module.css';

const telHref = (v) => `tel:${String(v).split(/,|ext|option|x/i)[0].replace(/[^0-9+]/g, '')}`;

function Entry({ e }) {
  return (
    <li className={s.entry}>
      <div className={s.who}>
        <span className={s.avatar} aria-hidden="true">{e.name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '•'}</span>
        <div>
          <p className={s.name}>{e.name}</p>
          {e.title && <p className={s.title}>{e.title}</p>}
        </div>
      </div>
      <dl className={s.lines}>
        {e.phone && <div><dt>Phone</dt><dd><a href={telHref(e.phone)}>{e.phone}</a></dd></div>}
        {e.mobile && <div><dt>Mobile</dt><dd><a href={telHref(e.mobile)}>{e.mobile}</a></dd></div>}
        {e.fax && <div><dt>Fax</dt><dd>{e.fax}</dd></div>}
        {e.email && <div><dt>Email</dt><dd><a href={`mailto:${e.email}`}>{e.email}</a></dd></div>}
      </dl>
      {e.notes && <p className={s.notes}>{e.notes}</p>}
    </li>
  );
}

export default function CarrierResourcesPage() {
  const [options, setOptions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [category, setCategory] = useState('');
  const [carrier, setCarrier] = useState('');
  const [department, setDepartment] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCarrierOptions().then(r => { if (r.success) setOptions(r.categories); else setLoadError(r.error || 'Could not load the carrier list.'); })
      .catch(() => setLoadError('Could not load the carrier list.'));
  }, []);

  const carriers = useMemo(() => options?.find(c => c.name === category)?.carriers || [], [options, category]);
  const departments = useMemo(() => carriers.find(c => c.name === carrier)?.departments || [], [carriers, carrier]);

  // Results only load once all three are chosen.
  useEffect(() => {
    if (!category || !carrier || !department) { setResult(null); setError(''); return undefined; }
    let live = true; setLoading(true); setError('');
    fetchCarrierContacts(category, carrier, department)
      .then(r => { if (!live) return; if (r.success) setResult(r); else { setResult(null); setError(r.error || 'Could not load the contacts.'); } })
      .catch(() => { if (live) { setResult(null); setError('Could not load the contacts.'); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [category, carrier, department]);

  const step = !category ? 1 : !carrier ? 2 : !department ? 3 : 4;
  const reset = () => { setCategory(''); setCarrier(''); setDepartment(''); };

  return (
    <div>
      <PageHeader title="Carrier Resources" subtitle="Find the right person at any carrier. Choose a category, a carrier and a department." />

      <section className={s.filters} aria-label="Find a carrier contact">
        <label className={s.field} data-active={step === 1 || undefined} data-done={category ? 'true' : undefined}>
          <span className={s.stepNo}>1</span>
          <span className={s.fieldLabel}>Select category</span>
          <select value={category} disabled={!options} onChange={(e) => { setCategory(e.target.value); setCarrier(''); setDepartment(''); }}>
            <option value="">{options ? 'Choose a category' : 'Loading…'}</option>
            {(options || []).map(c => <option key={c.name} value={c.name}>{c.name} ({c.carriers.length})</option>)}
          </select>
        </label>
        <label className={s.field} data-active={step === 2 || undefined} data-done={carrier ? 'true' : undefined}>
          <span className={s.stepNo}>2</span>
          <span className={s.fieldLabel}>Select carrier</span>
          <select value={carrier} disabled={!category} onChange={(e) => { setCarrier(e.target.value); setDepartment(''); }}>
            <option value="">{category ? 'Choose a carrier' : 'Choose a category first'}</option>
            {carriers.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </label>
        <label className={s.field} data-active={step === 3 || undefined} data-done={department ? 'true' : undefined}>
          <span className={s.stepNo}>3</span>
          <span className={s.fieldLabel}>Select department</span>
          <select value={department} disabled={!carrier} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">{carrier ? 'Choose a department' : 'Choose a carrier first'}</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <button type="button" className="nxt-btn" onClick={reset} disabled={!category}>Clear</button>
      </section>

      {loadError && <p className={s.error} role="alert">{loadError}</p>}
      {error && <p className={s.error} role="alert">{error}</p>}

      {step < 4 && !loadError && (
        <div className={s.empty}>
          <p className={s.emptyTitle}>{step === 1 ? 'Start with a category' : step === 2 ? 'Now choose a carrier' : 'Last step: choose a department'}</p>
          <p className={s.emptyText}>The contacts appear here once all three are selected.</p>
        </div>
      )}

      {step === 4 && loading && !result && <div className={s.empty}><p className={s.emptyText}>Loading contacts…</p></div>}

      {step === 4 && result && (
        <div className={s.result} aria-live="polite">
          <section className={s.carrierCard}>
            <div>
              <p className={s.eyebrow}>{result.carrier.category} carrier</p>
              <h2 className={s.carrierName}>{result.carrier.name}</h2>
              {result.carrier.note && <p className={s.carrierNote}>{result.carrier.note}</p>}
            </div>
            <dl className={s.carrierFacts}>
              {result.carrier.phone && <div><dt>Main phone</dt><dd><a href={telHref(result.carrier.phone)}>{result.carrier.phone}</a></dd></div>}
              {result.carrier.website && <div><dt>Website</dt><dd><a href={result.carrier.website} target="_blank" rel="noopener noreferrer">{result.carrier.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></dd></div>}
              {result.carrier.mail && <div><dt>Regular mail</dt><dd>{result.carrier.mail}</dd></div>}
              {result.carrier.overnight && <div><dt>Overnight mail</dt><dd>{result.carrier.overnight}</dd></div>}
            </dl>
          </section>

          <div className={s.listHead}>
            <h3>{result.department}</h3>
            <span>{result.departments.length + result.contacts.length} listed</span>
          </div>

          {result.departments.length > 0 && (
            <>
              <p className={s.groupLabel}>Department lines</p>
              <ul className={s.grid}>{result.departments.map((e, i) => <Entry key={`d${i}`} e={e} />)}</ul>
            </>
          )}
          {result.contacts.length > 0 && (
            <>
              <p className={s.groupLabel}>People</p>
              <ul className={s.grid}>{result.contacts.map((e, i) => <Entry key={`c${i}`} e={e} />)}</ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
