'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import s from './FlyerCarousel.module.css';

// The company flyers, shown as a slideshow on the dashboard. Text is live (not baked into pictures),
// so it stays sharp at any size and can be edited here.
const VALUES = [
  { letter: 'P', name: 'Partnership', line: 'We win together.', points: ['Your goals are our goals.', 'Shared success is our standard.', 'Stronger together for what’s next.'], photo: 'partnership', cta: { label: 'Open my team', href: '/dashboard/team' } },
  { letter: 'R', name: 'Responsibility', line: 'We hold ourselves accountable.', points: ['We act with integrity in every decision.', 'We put clients’ best interests first.', 'We do what’s right, every time.'], photo: 'responsibility', cta: { label: 'See my tasks', href: '/dashboard/tasks' } },
  { letter: 'O', name: 'Ownership', line: 'Advisors own their book, their team, and their future.', points: ['You build it. You lead it. You keep it.', 'The rewards of your work stay where they belong: with you.'], photo: 'ownership', cta: { label: 'Open my pipeline', href: '/dashboard/pipeline' } },
  { letter: 'T', name: 'Transparency', line: 'No surprises. No fine print.', points: ['Everything we recommend, explained clearly.', 'Every fee, every split, every detail.'], photo: 'transparency', cta: { label: 'See my commissions', href: '/dashboard/commissions' } },
  { letter: 'E', name: 'Education', line: 'Knowledge empowers better decisions.', points: ['We educate advisors to grow with confidence and integrity.', 'We build stronger futures through continuous learning.'], photo: 'education', cta: { label: 'Open NXT University', href: '/dashboard/learn' } },
  { letter: 'C', name: 'Commitment', line: 'We show up fully, every single time.', points: ['To our clients.', 'To our advisors.', 'To the communities we serve.'], photo: 'commitment', cta: { label: 'Open Get Started', href: '/dashboard/getting-started' } },
  { letter: 'T', name: 'Trust', line: 'We build confidence through consistency.', points: ['We act with integrity in every decision.', 'We deliver on our commitments.', 'We protect what matters most.'], photo: 'trust', cta: { label: 'See my clients', href: '/dashboard/clients' } },
];

const SLIDES = [
  { kind: 'lead', key: 'vision', label: 'Our vision', title: 'Where advisors own their future and every family is protected', text: 'To be a financial services company built on integrity and purpose.', photo: 'our-vision' },
  { kind: 'lead', key: 'mission', label: 'Our mission', title: 'Careers worth having, agencies worth owning, legacies worth leaving', text: 'While giving every family access to financial protection they can trust.', photo: 'our-mission' },
  { kind: 'protect', key: 'protect', label: 'What we stand for', title: 'Our values spell PROTECT', text: 'Seven commitments behind every career we build and every family we serve. Pick a letter.' },
  ...VALUES.map((v, i) => ({ kind: 'value', key: `v${i}`, valueIndex: i, label: `Value ${i + 1} of 7`, title: v.name, text: v.line, points: v.points, photo: v.photo, cta: v.cta })),
];
const FIRST_VALUE = 3;
const AUTO_MS = 7000;

export default function FlyerCarousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [hidden, setHidden] = useState(false);
  const touch = useRef(null);
  const total = SLIDES.length;

  useEffect(() => { try { if (localStorage.getItem('nxt_flyers_min') === '1') setHidden(true); } catch { /* storage unavailable */ } }, []);
  const setMin = (v) => { setHidden(v); try { localStorage.setItem('nxt_flyers_min', v ? '1' : '0'); } catch { /* storage unavailable */ } };

  const go = useCallback((n) => setI(((n % total) + total) % total), [total]);

  useEffect(() => {
    if (paused || hover || hidden) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setTimeout(() => go(i + 1), AUTO_MS);
    return () => clearTimeout(t);
  }, [i, paused, hover, hidden, go]);

  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
  };

  if (hidden) {
    return (
      <button type="button" className={s.restore} onClick={() => setMin(false)}>
        <span className={s.restoreLetters} aria-hidden="true">{'PROTECT'.split('').map((l, k) => <i key={k}>{l}</i>)}</span>
        Show our vision and values
      </button>
    );
  }

  const slide = SLIDES[i];
  const running = !paused && !hover;

  return (
    <section
      className={s.wrap}
      aria-roledescription="carousel"
      aria-label="NXT vision, mission and values"
      tabIndex={0}
      onKeyDown={onKey}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current == null) return; const d = e.changedTouches[0].clientX - touch.current; if (Math.abs(d) > 50) go(i + (d < 0 ? 1 : -1)); touch.current = null; }}
    >
      {SLIDES.map((sl, n) => sl.photo && (
        <div key={sl.key} className={s.photo} data-on={n === i || undefined} style={{ backgroundImage: `url(/flyers/photos/${sl.photo}.jpg)` }} aria-hidden="true" />
      ))}
      <span className={s.shade} aria-hidden="true" />
      {slide.kind === 'value' && <span key={`big${i}`} className={s.bigLetter} aria-hidden="true">{VALUES[slide.valueIndex].letter}</span>}

      <div key={slide.key} className={s.body} data-kind={slide.kind} aria-live={running ? 'off' : 'polite'}>
        <p className={s.label}>{slide.label}</p>
        <h2 className={s.title}>{slide.title}<span className={s.stop}>.</span></h2>
        <p className={s.text}>{slide.text}</p>

        {slide.points && (
          <ul className={s.points}>
            {slide.points.map((p, k) => <li key={p} style={{ animationDelay: `${260 + k * 90}ms` }}>{p}</li>)}
          </ul>
        )}

        {slide.kind === 'protect' && (
          <div className={s.letters}>
            {VALUES.map((v, k) => (
              <button key={k} type="button" className={s.letterBtn} style={{ animationDelay: `${200 + k * 70}ms` }} onClick={() => go(FIRST_VALUE + k)}>
                <b>{v.letter}</b><span>{v.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className={s.actions}>
          {slide.cta && <Link href={slide.cta.href} className={s.cta}>{slide.cta.label}</Link>}
          {slide.kind === 'lead' && <button type="button" className={s.cta} onClick={() => go(2)}>See our values</button>}
        </div>
      </div>

      <div className={s.bar}>
        <div className={s.rail} role="tablist" aria-label="Slides">
          {SLIDES.map((sl, n) => (
            <button key={sl.key} type="button" role="tab" aria-selected={n === i} aria-label={sl.kind === 'value' ? sl.title : sl.label} className={s.dot} data-letter={sl.kind === 'value' || undefined} onClick={() => go(n)}>
              {sl.kind === 'value' ? VALUES[sl.valueIndex].letter : ''}
              {n === i && running && <span className={s.fill} style={{ animationDuration: `${AUTO_MS}ms` }} />}
            </button>
          ))}
        </div>
        <div className={s.controls}>
          <button type="button" className={s.ctrl} onClick={() => setPaused(p => !p)} aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}>
            {paused
              ? <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor" /></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2h3v10H3zM8 2h3v10H8z" fill="currentColor" /></svg>}
          </button>
          <button type="button" className={s.ctrl} onClick={() => go(i - 1)} aria-label="Previous slide">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className={s.ctrl} onClick={() => go(i + 1)} aria-label="Next slide">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className={s.hide} onClick={() => setMin(true)}>Hide</button>
        </div>
      </div>
    </section>
  );
}
