'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import SegTabs from '@/components/ui/SegTabs';
import { BROCHURES, EDUCATION_CATEGORIES } from '@/data/clientEducation';
import s from './clientEducation.module.css';

export default function ClientEducationPage() {
  const [category, setCategory] = useState('annuity');
  const current = EDUCATION_CATEGORIES.find(c => c.key === category);
  const list = BROCHURES.filter(b => b.category === category);
  const groups = category === 'disability'
    ? ['Individuals', 'Business owners'].map(a => ({ label: `For ${a.toLowerCase()}`, items: list.filter(b => b.audience === a) }))
    : [{ label: '', items: list }];

  return (
    <div>
      <PageHeader title="Client Education" subtitle="NXT brochures to share with clients. Open one to print it or save it as a PDF with your details on it." />

      <div className={s.tabs}>
        <SegTabs label="Brochure category" value={category} onChange={setCategory}
          tabs={EDUCATION_CATEGORIES.map(c => ({ key: c.key, label: c.label, count: BROCHURES.filter(b => b.category === c.key).length }))} />
      </div>
      <p className={s.blurb}>{current.blurb}</p>

      {groups.map(g => (
        <section key={g.label || 'all'}>
          {g.label && <h2 className={s.groupLabel}>{g.label}</h2>}
          <ul className={s.grid}>
            {g.items.map(b => (
              <li key={b.slug}>
                <Link href={`/dashboard/business/client-education/${b.slug}`} className={s.card}>
                  <span className={s.thumb} style={{ backgroundImage: `url(/flyers/photos/${b.photo}.jpg)` }} aria-hidden="true" />
                  <span className={s.cardBody}>
                    <span className={s.cardTitle}>{b.title}</span>
                    <span className={s.cardSummary}>{b.summary}</span>
                    <span className={s.cardOpen}>Open brochure</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
