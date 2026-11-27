'use client';

import React from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import BackLink from '@/components/ui/BackLink';
import { BROCHURES, EDUCATION_CATEGORIES, DISCLOSURE, CONTACT } from '@/data/clientEducation';
import s from '../clientEducation.module.css';

export default function BrochurePage() {
  const { slug } = useParams();
  const b = BROCHURES.find(x => x.slug === slug);

  if (!b) {
    return (
      <div>
        <BackLink href="/dashboard/business/client-education">Back to Client Education</BackLink>
        <div className={s.missing}><p>This brochure could not be found.</p></div>
      </div>
    );
  }

  const category = EDUCATION_CATEGORIES.find(c => c.key === b.category);
  return (
    <div>
      <div className={s.toolbar}>
        <BackLink href="/dashboard/business/client-education">Back to Client Education</BackLink>
        <button type="button" className="nxt-btn nxt-btn-primary" onClick={() => window.print()}>Print or Save as PDF</button>
      </div>

      <article className={s.sheet} id="brochure">
        <div className={s.watermark} aria-hidden="true"><Image src="/new-nxt-logo.png" alt="" width={900} height={290} /></div>

        <header className={s.hero}>
          <div className={s.heroText}>
            <div className={s.heroLogo}><Image src="/new-nxt-logo.png" alt="NXT Financial Group" width={186} height={60} style={{ width: 'auto', height: '100%' }} /></div>
            <p className={s.kicker}>{category?.label}{b.audience ? `, for ${b.audience.toLowerCase()}` : ''}</p>
            <h1 data-plain className={s.title}>{b.title}</h1>
            <p className={s.summary}>{b.summary}</p>
          </div>
          <div className={s.heroPhoto} style={{ backgroundImage: `url(/flyers/photos/${b.photo}.jpg)` }} aria-hidden="true" />
        </header>

        <div className={s.body}>
          <p className={s.intro}>{b.intro}</p>

          <div className={s.columns}>
            {b.sections.map(sec => (
              <section key={sec.heading} className={s.section}>
                <h2>{sec.heading}</h2>
                {sec.body?.map((p, i) => <p key={i}>{p}</p>)}
                {sec.bullets && <ul>{sec.bullets.map((x, i) => <li key={i}>{x}</li>)}</ul>}
              </section>
            ))}
          </div>

          <div className={s.lower}>
            <section className={s.questions}>
              <h2>Questions to bring to our conversation</h2>
              <ol>{b.questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
            </section>
            <aside className={s.takeaway}>
              <p className={s.takeawayLabel}>The short version</p>
              <p className={s.takeawayText}>{b.takeaway}</p>
            </aside>
          </div>
        </div>

        <footer className={s.foot}>
          <div className={s.contact}>
            <p className={s.contactLabel}>Your NXT professional</p>
            <p className={s.contactName}>{CONTACT.name}</p>
            <p className={s.contactLine}>{CONTACT.company}</p>
            <p className={s.contactLine}>{CONTACT.phone}</p>
            <p className={s.contactLine}>{CONTACT.email}</p>
          </div>
          <p className={s.disclosure}>{DISCLOSURE}</p>
        </footer>
      </article>
    </div>
  );
}
