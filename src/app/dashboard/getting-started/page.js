"use client";

import React, { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import PageHeader from '@/components/ui/PageHeader';

/* ───── Reusable Primitives ───── */

const Callout = ({ variant = 'note', children }) => {
  const styles = {
    note: { bg: '#F0F4F8', accent: 'var(--brand-navy)', icon: 'i' },
    caution: { bg: '#FFF8E5', accent: 'var(--brand-gold)', icon: '!' },
    critical: { bg: '#FEF0F0', accent: '#D33F3F', icon: '!!' },
  };
  const s = styles[variant];
  return (
    <div style={{ display: 'flex', gap: '14px', padding: '16px 20px', borderRadius: '12px', backgroundColor: s.bg, marginBottom: 'var(--space-3)' }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
        backgroundColor: s.accent, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', fontWeight: '800', marginTop: '1px',
      }}>{s.icon}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>{children}</div>
    </div>
  );
};

const Expandable = ({ heading, children }) => (
  <details style={{ border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '10px', overflow: 'hidden' }}>
    <summary style={{
      padding: '14px 20px', fontWeight: '600', cursor: 'pointer',
      color: 'var(--brand-navy)', listStyle: 'none',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: 'var(--text-secondary)', backgroundColor: 'rgba(0,0,0,0.015)',
    }}>
      {heading}
      <span style={{ fontSize: '20px', color: 'var(--brand-gold)', fontWeight: '700' }}>+</span>
    </summary>
    <div style={{ padding: '4px 20px 20px', color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: 'var(--text-secondary)' }}>
      {children}
    </div>
    <style jsx>{`details > summary::-webkit-details-marker { display: none; }`}</style>
  </details>
);

const StepCard = ({ num, title, children }) => (
  <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
    <div style={{
      width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
      background: 'linear-gradient(135deg, var(--brand-navy), #1a3d6e)',
      color: 'var(--brand-gold)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '18px', fontWeight: '800',
    }}>{num}</div>
    <div style={{ flex: 1 }}>
      <h3 style={{ fontSize: 'var(--text-h2)', fontWeight: '700', color: 'var(--brand-navy)', marginBottom: '12px' }}>{title}</h3>
      {children}
    </div>
  </div>
);

const Dot = () => (
  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--brand-gold)', marginRight: '10px', verticalAlign: 'middle' }} />
);

/* ───── Onboarding Checklist Banner ───── */

function SetupChecklist({ agentData }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDismissed(localStorage.getItem('nxt_getting_started_dismissed') === 'true');
    }
  }, []);

  if (!agentData) return null;

  const compliance = agentData.compliance || {};
  const address = agentData.address || {};

  const items = [
    { label: 'Legal name on file', done: !!(agentData.first_name || agentData.full_name), link: '/dashboard/settings/profile' },
    { label: 'Phone added', done: !!agentData.phone, link: '/dashboard/settings/profile' },
    { label: 'Mailing address', done: !!address.line1, link: '/dashboard/settings/profile' },
    { label: 'NPN entered', done: !!agentData.npn, link: '/dashboard/settings/profile' },
    { label: 'Licensed states', done: agentData.licensedStates?.length > 0, link: '/dashboard/settings/profile' },
    { label: 'E&O coverage', done: !!compliance.has_eo, link: '/dashboard/settings/profile' },
    { label: 'AML training', done: !!compliance.aml_certified, link: '/dashboard/settings/profile' },
  ];

  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);
  const allDone = done === items.length;

  if (allDone && dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem('nxt_getting_started_dismissed', 'true');
    setDismissed(true);
  };

  return (
    <div style={{
      marginBottom: 'var(--space-4)', padding: 'var(--space-3)',
      borderRadius: '16px',
      background: allDone
        ? 'linear-gradient(135deg, rgba(47,168,79,0.06), rgba(47,168,79,0.02))'
        : 'linear-gradient(135deg, rgba(227, 169, 74,0.08), rgba(227, 169, 74,0.02))',
      border: `1px solid ${allDone ? 'rgba(47,168,79,0.15)' : 'rgba(227, 169, 74,0.12)'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: 0 }}>
            {allDone ? 'All Set -- You\'re Ready' : 'Profile Completion'}
          </h3>
          <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {allDone ? 'Every item is checked off. Time to start writing business.' : `${done} of ${items.length} done -- wrap these up to get fully operational.`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {allDone && (
            <button
              onClick={handleDismiss}
              style={{
                padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(47,168,79,0.2)',
                background: 'rgba(47,168,79,0.08)', color: 'var(--status-success)',
                fontSize: 'var(--text-caption)', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          )}
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: `conic-gradient(${allDone ? 'var(--status-success)' : 'var(--brand-gold)'} ${pct * 3.6}deg, rgba(0,0,0,0.06) 0deg)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--text-caption)', fontWeight: '800', color: allDone ? 'var(--status-success)' : 'var(--brand-gold)',
            }}>{pct}%</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {items.map((item) => (
          <Link key={item.label} href={item.link} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '5px 12px', borderRadius: '999px',
            fontSize: 'var(--text-caption)', fontWeight: 500,
            color: item.done ? 'var(--status-success)' : 'var(--text-secondary)',
            backgroundColor: item.done ? 'rgba(47,168,79,0.08)' : 'rgba(0,0,0,0.04)',
            textDecoration: 'none', transition: 'opacity 0.15s',
          }}>
            {item.done ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid var(--border-color)' }} />
            )}
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ───── Main Page ───── */

const TABS = [
  { key: 'welcome', label: 'Welcome', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
  { key: 'foundation', label: 'Foundation', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3" /></svg> },
  { key: 'licensing', label: 'Licensing', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg> },
  { key: 'launch', label: 'Launch', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" /></svg> },
];

export default function GettingStartedPage() {
  const [tab, setTab] = useState('welcome');
  const { userProfile } = useUser();
  const agentData = userProfile || null;

  const tabIdx = TABS.findIndex((t) => t.key === tab);

  return (
    <div style={{ paddingBottom: 'var(--space-6)' }}>

      <SetupChecklist agentData={agentData} />

      {/* Header + Horizontal Tabs */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <PageHeader title="Your Roadmap" subtitle={`Everything you need, in the order you need it. Step ${tabIdx + 1} of ${TABS.length}.`} />

        <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--border-color)', paddingBottom: '0' }}>
          {TABS.map((t, i) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '12px 20px', border: 'none', cursor: 'pointer',
                  fontSize: 'var(--text-secondary)', fontWeight: active ? '700' : '500',
                  color: active ? 'var(--brand-navy)' : 'var(--text-secondary)',
                  backgroundColor: 'transparent',
                  borderBottom: active ? '3px solid var(--brand-gold)' : '3px solid transparent',
                  marginBottom: '-2px', transition: 'all 0.2s',
                }}
              >
                <span style={{ opacity: active ? 1 : 0.5 }}>{t.icon}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '20px', height: '20px', borderRadius: '50%',
                    fontSize: '13px', fontWeight: '700',
                    backgroundColor: active ? 'var(--brand-gold)' : 'rgba(0,0,0,0.06)',
                    color: active ? 'var(--brand-navy)' : 'var(--text-secondary)',
                  }}>{i + 1}</span>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ────────── TAB: WELCOME ────────── */}
      {tab === 'welcome' && (
        <div style={{
          borderRadius: '20px', overflow: 'hidden',
          background: 'linear-gradient(145deg, #0B1D3A 0%, #163A6A 100%)',
          padding: '56px 48px', color: '#fff',
          boxShadow: '0 24px 48px rgba(11,29,58,0.18)',
        }}>
          <p style={{ fontSize: 'var(--text-caption)', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--brand-gold)', fontWeight: '700', marginBottom: '20px' }}>
            Welcome to NXT
          </p>

          <h2 style={{ fontSize: '36px', fontWeight: '800', lineHeight: '1.2', marginBottom: '16px', letterSpacing: '-0.02em', color: '#fff' }}>
            You chose the right platform.
          </h2>

          <p style={{ fontSize: 'var(--text-body)', color: 'rgba(255,255,255,0.65)', maxWidth: '580px', lineHeight: '1.7', marginBottom: '48px' }}>
            NXT CRM powers modern, independent agencies. As an agent here, everything you build belongs to you — your client relationships, your book of business, your long-term equity — starting immediately.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px 32px', marginBottom: '48px' }}>
            {[
              { title: 'Flexible schedule', desc: 'Dedicate as many or as few hours as you want — part-time, full-time, your call.' },
              { title: 'Industry-leading pay', desc: 'Earn commissions that genuinely reflect the effort you put in.' },
              { title: 'Rapid momentum', desc: 'Battle-tested playbooks and accelerating growth working in your favor.' },
              { title: 'True ownership', desc: 'Start accumulating real equity from your very first day.' },
              { title: 'Professional-grade resources', desc: 'Mentorship from seasoned leaders plus tools that actually move the needle.' },
              { title: 'Generational wealth', desc: 'Build something you can hand down to your family.' },
            ].map((item) => (
              <div key={item.title}>
                <div style={{ width: '36px', height: '3px', backgroundColor: 'var(--brand-gold)', borderRadius: '2px', marginBottom: '14px' }} />
                <h4 style={{ fontWeight: '700', fontSize: 'var(--text-secondary)', marginBottom: '6px', color: '#fff' }}>{item.title}</h4>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'var(--text-caption)', lineHeight: '1.5' }}>{item.desc}</p>
              </div>
            ))}
          </div>

          <p style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', fontSize: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '500px' }}>
            This is a genuine business, not a side hobby. The agents who thrive approach it with that mindset from the start.
          </p>

          <button onClick={() => { setTab('foundation'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{
            backgroundColor: 'var(--brand-gold)', color: 'var(--brand-navy)', border: 'none',
            padding: '14px 40px', borderRadius: '10px', fontSize: 'var(--text-secondary)',
            fontWeight: '700', cursor: 'pointer', letterSpacing: '0.04em',
          }}>
            BEGIN YOUR JOURNEY
          </button>
        </div>
      )}

      {/* ────────── TAB: FOUNDATION ────────── */}
      {tab === 'foundation' && (
        <div>
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h2 style={{ fontSize: '32px', color: 'var(--brand-navy)', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.02em' }}>
              Lay the Groundwork
            </h2>
            <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', maxWidth: '700px', lineHeight: '1.6' }}>
              Handle these essentials first. Once this stage is wrapped up, your account is fully configured and you can move into exam preparation.
            </p>
          </div>

          <Card style={{ padding: 'var(--space-4)', borderRadius: '16px', marginBottom: 'var(--space-4)' }}>
            <StepCard num="1" title="Fill Out Your Profile">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Everything else depends on this. Ensure your profile is thorough and precise before moving forward.
              </p>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)' }}>
                Head to <Link href="/dashboard/settings/profile" style={{ color: 'var(--brand-navy)', fontWeight: '600' }}>your profile</Link> and enter your full legal name, banking details, and preferred contact information.
              </p>

              <Callout variant="critical">
                <strong style={{ color: '#D33F3F' }}>Enter your name exactly as printed on your government-issued ID — include your middle name if it appears there.</strong>{' '}
                This name must stay consistent across every document in the licensing process, so accuracy here prevents delays later.
              </Callout>

              <Callout variant="caution">
                <strong style={{ color: 'var(--brand-navy)' }}>For managers:</strong> Name discrepancies are the leading cause of rejected applications — and they are entirely avoidable. Verify that your associate&apos;s profile name is a character-for-character match with their government ID before letting them proceed.
              </Callout>
            </StepCard>
          </Card>

          <Card style={{ padding: 'var(--space-4)', borderRadius: '16px', marginBottom: 'var(--space-4)' }}>
            <StepCard num="2" title="Verify Your Eligibility">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Spend a few minutes confirming you meet the baseline requirements and understanding what licensure entails.
              </p>

              <h4 style={{ fontWeight: 'bold', color: 'var(--brand-navy)', marginBottom: '10px' }}>Prerequisites</h4>
              <ul style={{ marginLeft: '20px', marginBottom: 'var(--space-3)', color: 'var(--text-secondary)', lineHeight: '2', fontSize: 'var(--text-secondary)' }}>
                <li><Dot />At least 18 years old</li>
                <li><Dot />Reside in the US state where you intend to apply for licensure</li>
                <li><Dot />Have a Social Security Number (SSN) — accepted universally — <em>or</em> an Individual Taxpayer Identification Number (ITIN), recognized by many states</li>
              </ul>

              <p style={{ color: 'var(--brand-navy)', fontWeight: '600', marginBottom: '10px', fontSize: 'var(--text-secondary)' }}>Regulations differ from state to state.</p>
              <button onClick={() => window.open('https://nipr.com/licensing-center/state-requirements', '_blank')} style={goldPillBtn}>
                Look up your state&apos;s rules &rarr;
              </button>

              <h4 style={{ fontWeight: 'bold', color: 'var(--brand-navy)', marginBottom: '10px', marginTop: 'var(--space-3)' }}>Plan ahead</h4>
              <ul style={{ marginLeft: '20px', marginBottom: '12px', color: 'var(--text-secondary)', lineHeight: '2', fontSize: 'var(--text-secondary)' }}>
                <li><Dot />Budget for the prep course, state examination fee, and licensing costs</li>
                <li><Dot />After licensure, expect periodic renewals and potential continuing education obligations</li>
              </ul>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-secondary)' }}>
                Unsure whether you qualify? Speak with your Manager before investing in courses or exam fees. Most concerns can be resolved upfront.
              </p>
            </StepCard>
          </Card>

          <Card style={{ padding: 'var(--space-4)', borderRadius: '16px' }}>
            <StepCard num="3" title="Your Agent Agreement">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                The NXT Agent Agreement is the formal contract between you and NXT — it&apos;s the document you executed during onboarding.
              </p>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                It outlines your CRM subscription, your independence as an agent, the working relationship, and the separation process should you ever choose to leave.
              </p>

              <Callout variant="note">
                <strong style={{ color: 'var(--brand-navy)' }}>Save for reference:</strong> The <span style={{ color: 'var(--brand-gold)', fontWeight: '600' }}>Sales Force Guidelines (PDF)</span> details the standards, protocols, and operational procedures for conducting business. Read it now and keep it bookmarked.
              </Callout>

              <h4 style={{ fontWeight: 'bold', color: 'var(--brand-navy)', marginTop: 'var(--space-4)', marginBottom: '12px', fontSize: 'var(--text-body)' }}>Your subscription includes</h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                NXT CRM is your operational hub. You begin on the Basic plan during your study period and upgrade to Professional after your state license is approved.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: '12px' }}>
                <div style={{ padding: 'var(--space-3)', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <strong style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-body)' }}>Basic</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-secondary)', fontWeight: '600' }}>$10/mo</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-caption)', marginBottom: '10px' }}>For the study and licensing phase</p>
                  <ul style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-caption)', lineHeight: '2.2', paddingLeft: '0', listStyle: 'none' }}>
                    <li><Dot />CRM workspace access</li>
                    <li><Dot />Document storage and uploads</li>
                    <li><Dot />Direct manager support</li>
                    <li><Dot />Training and onboarding materials</li>
                  </ul>
                </div>

                <div style={{ padding: 'var(--space-3)', borderRadius: '12px', border: '2px solid var(--brand-gold)', backgroundColor: 'rgba(227, 169, 74,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <strong style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-body)' }}>Professional</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-secondary)', fontWeight: '600' }}>$20/mo</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-caption)', marginBottom: '10px' }}>Unlocked once your license is active</p>
                  <ul style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-caption)', lineHeight: '2.2', paddingLeft: '0', listStyle: 'none' }}>
                    <li><Dot />All Basic features included</li>
                    <li><Dot />Carrier contracting and appointments</li>
                    <li><Dot />Commission tracking and reports</li>
                    <li><Dot />Complete pipeline management</li>
                  </ul>
                </div>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-caption)' }}>
                Tax may apply. Pricing may be adjusted with 60 days&apos; advance written notice.
              </p>
            </StepCard>
          </Card>

          <StepNav currentIdx={tabIdx} tabs={TABS} onChangeTab={setTab} />
        </div>
      )}

      {/* ────────── TAB: LICENSING ────────── */}
      {tab === 'licensing' && (
        <div>
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h2 style={{ fontSize: '32px', color: 'var(--brand-navy)', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.02em' }}>
              Earn Your License
            </h2>
            <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', maxWidth: '700px', lineHeight: '1.6' }}>
              Learn what your state demands, prepare for the examination, pass it, then file your application. This is the most intensive stage — it involves genuine study and a proctored exam. Everyone progresses at their own pace, and that is perfectly fine. Consistency, not speed, is what carries people through.
            </p>
          </div>

          <Card style={{ padding: 'var(--space-4)', borderRadius: '16px', marginBottom: 'var(--space-4)' }}>
            <StepCard num="1" title="Research Your State&apos;s Rules">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)' }}>
                Each US state governs insurance licensing independently. Understand your local requirements before spending anything.
              </p>
              <button onClick={() => window.open('https://nipr.com/licensing-center/state-requirements', '_blank')} style={goldPillBtn}>
                Check your state&apos;s requirements &rarr;
              </button>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', marginTop: '16px', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <strong style={{ color: 'var(--brand-navy)' }}>Start with Life insurance.</strong> That is our primary line of business. Some states issue Accident &amp; Health as a separate license; others bundle it into a combined &quot;Life, Accident &amp; Health&quot; credential. Verify which structure your state uses before enrolling in anything.
              </p>

              <h4 style={{ fontWeight: 'bold', color: 'var(--brand-navy)', marginBottom: '10px' }}>State-specific items to verify</h4>
              <ul style={{ marginLeft: '20px', color: 'var(--text-secondary)', lineHeight: '2', fontSize: 'var(--text-secondary)' }}>
                <li><Dot />Is a pre-licensing course mandatory? (Even where optional, one is strongly advised.)</li>
                <li><Dot />Does your state mandate fingerprinting? If yes, allow extra lead time.</li>
                <li><Dot />What are the application and filing fees for your license?</li>
              </ul>
            </StepCard>
          </Card>

          <Card style={{ padding: 'var(--space-4)', borderRadius: '16px', marginBottom: 'var(--space-4)' }}>
            <StepCard num="2" title="Enroll in Pre-Licensing Education">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                A pre-license course equips you for the state exam. Even where the state does not require one, it is highly recommended.
              </p>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                The exam is tougher than most newcomers anticipate, but entirely passable with disciplined preparation and a quality course.
              </p>

              <h4 style={{ fontWeight: 'bold', color: 'var(--brand-navy)', marginBottom: '10px' }}>NXT Partner: ExamFX</h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                NXT Financial Group has partnered with <strong style={{ color: 'var(--brand-navy)' }}>ExamFX</strong>, the market-share leader in insurance pre-licensing education. As an NXT agent, you receive <strong style={{ color: 'var(--brand-navy)' }}>85% off retail pricing</strong> — no promo code needed, just use our enrollment link below.
              </p>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', marginBottom: '16px', backgroundColor: 'rgba(227, 169, 74,0.03)' }}>
                <h4 style={{ fontWeight: 'bold', color: 'var(--brand-navy)', marginBottom: '12px', fontSize: 'var(--text-body)' }}>Study Packages (60 days access)</h4>
                <ul style={{ marginLeft: '20px', marginBottom: '12px', color: 'var(--text-secondary)', lineHeight: '2.2', fontSize: 'var(--text-secondary)' }}>
                  <li><Dot /><strong style={{ color: 'var(--brand-navy)' }}>Video Study Package — $34.99</strong> <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>$219.95</span></li>
                  <li style={{ marginLeft: '16px', listStyle: 'none', lineHeight: '1.6', marginBottom: '6px', fontSize: '15px' }}>
                    State-specific reading, chapter quizzes, practice exams, readiness exam with pass-or-money-back guarantee, on-demand video lectures, online flashcards, and instructor support.
                  </li>
                  <li><Dot /><strong style={{ color: 'var(--brand-navy)' }}>Live Online Study Package — $47.72</strong> <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>$299.95</span></li>
                  <li style={{ marginLeft: '16px', listStyle: 'none', lineHeight: '1.6', marginBottom: '6px', fontSize: '15px' }}>
                    Everything in the Video package <em>plus</em> weekly live online training review sessions with experienced instructors where you can ask questions in real time.
                  </li>
                </ul>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
                  Available for L/H, Life only, Health only, P&amp;C, and Personal Lines. Renewals available for purchase if you need more time.
                </p>
              </div>

              <button onClick={() => window.open('https://checkout.examfx.com/default.aspx?OrganizationId=shiv@nxtfinancialgroup.com', '_blank')} style={goldPillBtn}>
                Enroll with NXT Discount &rarr;
              </button>

              <Expandable heading="What's included in the ExamFX course?">
                <ul style={{ marginLeft: '16px', lineHeight: '2' }}>
                  <li><Dot /><strong>State-specific reading material</strong> tailored to your exam</li>
                  <li><Dot /><strong>Chapter quizzes</strong> after each section to reinforce concepts</li>
                  <li><Dot /><strong>Practice exams</strong> that mirror the real test format</li>
                  <li><Dot /><strong>Readiness Exam</strong> — pass it and you get a money-back guarantee if you fail the state exam</li>
                  <li><Dot /><strong>On-demand video lectures</strong> you can replay at your pace</li>
                  <li><Dot /><strong>Online flashcards</strong> for quick review</li>
                  <li><Dot /><strong>Instructor support</strong> when you get stuck</li>
                  <li><Dot /><strong>Live online sessions</strong> (Live Online package) — weekly interactive classes with real instructors</li>
                </ul>
              </Expandable>

              <Expandable heading="How do I check my state's pre-licensing requirements?">
                <p>Visit <a href="https://www.examfx.com/state-insurance-requirements" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-navy)', fontWeight: '600', textDecoration: 'underline' }}>ExamFX State Requirements</a> to see exactly what your state requires — course hours, exam format, and any additional steps.</p>
              </Expandable>

              <Callout variant="caution">
                <strong style={{ color: 'var(--brand-navy)' }}>Before you purchase:</strong> Confirm your state and license type (Life, L/H, P&amp;C, etc.) on the enrollment page. Course availability varies by state.
              </Callout>
            </StepCard>
          </Card>

          <Card style={{ padding: 'var(--space-4)', borderRadius: '16px', marginBottom: 'var(--space-4)' }}>
            <StepCard num="3" title="Prepare for the Exam">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                The hours you invest here directly determine how the exam goes. Target 20 to 40 hours of concentrated study.
              </p>

              <Callout variant="caution">
                <strong style={{ color: 'var(--brand-navy)' }}>For managers:</strong> Track your candidates&apos; progress through <a href="http://tracking.examfx.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-navy)', fontWeight: '600', textDecoration: 'underline' }}>ExamFX Elite Analytics</a>. It uses predictive data to show whether candidates are on track to pass, measuring their performance across quizzes and practice exams. Subscribe to daily or weekly summary reports. <a href="https://info.examfx.com/ea-userguide" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-navy)', textDecoration: 'underline', fontSize: '14px' }}>Manager guide</a>
              </Callout>

              <h4 style={{ fontWeight: 'bold', color: 'var(--brand-navy)', marginBottom: '10px', fontSize: 'var(--text-body)' }}>Effective study habits</h4>
              <ul style={{ marginLeft: '20px', marginBottom: 'var(--space-3)', color: 'var(--text-secondary)', lineHeight: '2', fontSize: 'var(--text-secondary)' }}>
                <li><Dot />Take practice tests that mirror the real exam — identical duration, structure, and scoring.</li>
                <li><Dot />Dedicate 20 to 40 hours of focused, distraction-free preparation.</li>
                <li><Dot />Study the exam content outline from your testing provider so you know exactly what is on the table.</li>
                <li><Dot />Go beyond rote memorization. Grasp <em>why</em> insurance principles function the way they do.</li>
                <li><Dot />Use the <strong style={{ color: 'var(--brand-navy)' }}>ExamFX Readiness Exam</strong> — if you pass it, ExamFX guarantees you will pass or your money back.</li>
              </ul>

              <Callout variant="note">
                <strong style={{ color: 'var(--brand-navy)' }}>Live online training available:</strong> If you enrolled in the Live Online package, attend the weekly instructor-led review sessions. Candidates who combine self-study with live sessions have higher first-time pass rates. Check the <a href="https://checkout.examfx.com/default.aspx?OrganizationId=shiv@nxtfinancialgroup.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-navy)', fontWeight: '600', textDecoration: 'underline' }}>ExamFX enrollment page</a> for the live session calendar.
              </Callout>
            </StepCard>
          </Card>

          <Card style={{ padding: 'var(--space-4)', borderRadius: '16px', marginBottom: 'var(--space-4)' }}>
            <StepCard num="4" title="File Your License Application">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Exam passed — time to make it official.
              </p>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Submit your application at <a href="https://nipr.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-navy)', fontWeight: '700', textDecoration: 'underline' }}>NIPR.com</a>, the centralized licensing portal recognized across the United States.
              </p>

              <h4 style={{ fontWeight: 'bold', color: 'var(--brand-navy)', marginBottom: '10px', fontSize: 'var(--text-body)' }}>Application steps</h4>
              <ul style={{ marginLeft: '20px', marginBottom: 'var(--space-3)', color: 'var(--text-secondary)', lineHeight: '2', fontSize: 'var(--text-secondary)' }}>
                <li><Dot />Sign in or register at nipr.com</li>
                <li><Dot />Choose <strong>New License Application</strong></li>
                <li><Dot />Select your resident state and line of authority: <strong>Life</strong></li>
                <li><Dot />Fill out the application, pay the state fee, and submit</li>
              </ul>

              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Fixed annuities typically fall under the Life line of authority. Certain states and carriers mandate additional suitability training before you may sell annuity products — your ED can clarify. Variable annuities require separate securities licensing.
              </p>

              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <strong style={{ color: 'var(--brand-navy)' }}>Processing time:</strong> Many states turn applications around in 7 to 10 days, though fingerprinting, background checks, incomplete information, or unique state procedures may extend the timeline. Look up your state&apos;s typical turnaround online.
              </p>

              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <strong style={{ color: 'var(--brand-navy)' }}>Fingerprinting:</strong> If required by your state, you will generally schedule through IdentoGO, Pearson VUE, or another approved vendor. The application process will include instructions.
              </p>

              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <strong style={{ color: 'var(--brand-navy)' }}>After approval:</strong> You may not need to manually upload anything. We receive license data directly from NIPR, so your license should appear automatically in your profile — provided your <strong>NPN (National Producer Number) is already entered there</strong>. If it does not show up within a few days, download the PDF from NIPR and upload it during the Launch stage.
              </p>

              <Callout variant="critical">
                <strong style={{ color: '#D33F3F' }}>Use your full legal name — it must match everywhere.</strong>{' '}
                Apply using the exact name on your government ID, and ensure it matches your CRM profile precisely. Name mismatches are the most frequent reason documents get rejected, causing downstream delays. If you have not already, verify your profile name before your application is processed.
              </Callout>
            </StepCard>
          </Card>

          <Card style={{ padding: 'var(--space-4)', borderRadius: '16px', marginBottom: 'var(--space-4)' }}>
            <Expandable heading="Continuing Education (CE) — After You're Licensed">
              <p style={{ marginBottom: '10px' }}>
                Every state requires licensed agents to complete continuing education credits to maintain their license. NXT agents get discounted access to the <strong style={{ color: 'var(--brand-navy)' }}>ExamFX CE Library</strong> — 365 days of access for <strong style={{ color: 'var(--brand-navy)' }}>$39.95</strong> <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>$49.95</span>.
              </p>
              <p style={{ marginBottom: '12px' }}>
                Check your state&apos;s CE requirements at <a href="https://www.examfx.com/ce-state-requirements" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-navy)', fontWeight: '600', textDecoration: 'underline' }}>ExamFX CE State Requirements</a>.
              </p>
              <button onClick={() => window.open('https://checkout.examfx.com/default.aspx?OrganizationId=shiv@nxtfinancialgroup.com', '_blank')} style={goldPillBtn}>
                Access CE Library &rarr;
              </button>
            </Expandable>
          </Card>

          {/* Stage complete banner */}
          <div style={{
            background: 'linear-gradient(145deg, #0B1D3A, #163A6A)', borderRadius: '16px',
            padding: 'var(--space-5) 32px', textAlign: 'center',
            boxShadow: '0 16px 40px rgba(11,29,58,0.15)',
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%',
              backgroundColor: 'var(--brand-gold)', color: 'var(--brand-navy)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h3 style={{ fontSize: '28px', fontWeight: '800', color: '#fff', marginBottom: '8px', letterSpacing: '-0.02em' }}>
              Licensing stage complete. You are officially a licensed insurance agent.
            </h3>
            <p style={{ fontSize: 'var(--text-body)', color: 'rgba(255,255,255,0.6)', maxWidth: '550px', margin: '0 auto 32px' }}>
              The toughest stretch is behind you. Next up: getting cleared to sell.
            </p>
            <button onClick={() => { setTab('launch'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{
              backgroundColor: 'var(--brand-gold)', color: 'var(--brand-navy)', border: 'none',
              padding: '14px 36px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer',
              fontSize: 'var(--text-secondary)', letterSpacing: '0.04em',
            }}>
              CONTINUE TO LAUNCH &rarr;
            </button>
          </div>

          <StepNav currentIdx={tabIdx} tabs={TABS} onChangeTab={setTab} />
        </div>
      )}

      {/* ────────── TAB: LAUNCH ────────── */}
      {tab === 'launch' && (
        <div>
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h2 style={{ fontSize: '32px', color: 'var(--brand-navy)', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.02em' }}>
              Prepare for Launch
            </h2>
            <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', maxWidth: '700px', lineHeight: '1.6' }}>
              Finish AML training, secure your E&amp;O policy, submit your paperwork, then get contracted with your first carriers. Once your license is in hand, this phase moves quickly — one to two weeks is standard.
            </p>
          </div>

          <Card style={{ padding: 'var(--space-4)', borderRadius: '16px', marginBottom: 'var(--space-4)' }}>
            <StepCard num="1" title="Finish AML Certification">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Anti-Money Laundering (AML) certification is a prerequisite every carrier requires before appointing you.
              </p>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)', lineHeight: '1.6', maxWidth: '65ch' }}>
                Complete it once, then renew every two years — though certain carriers may require annual refreshers.
              </p>

              <div style={{ backgroundColor: 'rgba(124, 58, 237, 0.06)', border: '1px solid rgba(124, 58, 237, 0.15)', borderRadius: '12px', padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--brand-navy)', fontSize: 'var(--text-body)' }}>Complete via SureLC</span>
                  <span style={{ backgroundColor: 'var(--brand-gold)', color: 'var(--brand-navy)', fontSize: 'var(--text-caption)', padding: '3px 8px', borderRadius: '999px', fontWeight: 'bold' }}>REQUIRED</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 12px' }}>
                  Use the SuranceBay AML portal to complete your certification online. Once finished, download your certificate as a PDF.
                </p>
                <a href="https://aml.surancebay.com/" target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  backgroundColor: 'var(--brand-navy)', color: '#fff', padding: '10px 20px',
                  borderRadius: '8px', fontSize: '16px', fontWeight: 600, textDecoration: 'none',
                  transition: 'opacity 0.15s',
                }}>
                  Start AML Certification &#x2192;
                </a>
              </div>

              <h4 style={{ fontWeight: 'bold', color: 'var(--brand-navy)', marginTop: 'var(--space-3)', marginBottom: '10px', fontSize: 'var(--text-body)' }}>Submit to your profile</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Navigate to <strong style={{ color: 'var(--brand-navy)' }}>Settings &rarr; Profile &rarr; Documents</strong>. Upload your certificate as a PDF. Your name on the certificate must match your profile. Allow 1 to 2 business days for review.
              </p>
            </StepCard>
          </Card>

          <Card style={{ padding: 'var(--space-4)', borderRadius: '16px', marginBottom: 'var(--space-4)' }}>
            <StepCard num="2" title="Obtain E&O Insurance">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Errors &amp; Omissions (E&amp;O) insurance is non-negotiable — no carrier will contract you without it.
              </p>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                It shields you professionally against allegations of errors or negligence.
              </p>

              <h4 style={{ fontWeight: 'bold', color: 'var(--brand-navy)', marginBottom: '10px', fontSize: 'var(--text-body)' }}>Minimum limits</h4>
              <ul style={{ marginLeft: '20px', marginBottom: 'var(--space-3)', color: 'var(--text-secondary)', lineHeight: '2', fontSize: 'var(--text-secondary)' }}>
                <li><Dot />$1,000,000 per occurrence</li>
                <li><Dot />$1,000,000 aggregate</li>
              </ul>

              <h4 style={{ fontWeight: 'bold', color: 'var(--brand-navy)', marginBottom: '10px', fontSize: 'var(--text-body)' }}>Get covered through NEXT Insurance</h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                NXT Financial Group has partnered with <strong style={{ color: 'var(--brand-navy)' }}>NEXT Insurance</strong> to provide fast, affordable E&amp;O coverage for our agents. Get a quote in minutes and purchase entirely online.
              </p>
              <ul style={{ marginLeft: '20px', marginBottom: '12px', color: 'var(--text-secondary)', lineHeight: '2', fontSize: 'var(--text-secondary)' }}>
                <li><Dot /><strong style={{ color: 'var(--brand-navy)' }}>Quick online application</strong> — coverage can start the same day</li>
                <li><Dot /><strong style={{ color: 'var(--brand-navy)' }}>Competitive pricing</strong> — tailored for independent insurance agents</li>
                <li><Dot /><strong style={{ color: 'var(--brand-navy)' }}>Certificate available instantly</strong> — download your PDF right after purchase</li>
              </ul>

              <button onClick={() => window.open('https://track.nextinsurance.com/links?agent_affiliation=hvgFpKsKeEKIC4Sz&serial=992855993&channel=affiliation', '_blank')} style={goldPillBtn}>
                Get Your E&amp;O Quote &rarr;
              </button>

              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                After purchasing, download your E&amp;O certificate as a PDF — you will upload it with your other documents.
              </p>

            </StepCard>
          </Card>

          <Card style={{ padding: 'var(--space-4)', borderRadius: '16px', marginBottom: 'var(--space-4)' }}>
            <StepCard num="3" title="Submit Your Required Documents">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                The Contracting team must review and approve your paperwork before any carrier will contract with you.
              </p>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Gather everything in advance. Uploading in one batch is the fastest path.
              </p>

              <h4 style={{ fontWeight: 'bold', color: 'var(--brand-navy)', marginBottom: '10px', fontSize: 'var(--text-body)' }}>Where to upload</h4>
              <ul style={{ marginLeft: '20px', marginBottom: 'var(--space-3)', color: 'var(--text-secondary)', lineHeight: '2', fontSize: 'var(--text-secondary)' }}>
                <li><Dot />Go to <strong style={{ color: 'var(--brand-navy)' }}>Settings &rarr; Profile &rarr; Documents</strong></li>
                <li><Dot />Upload each item as a PDF</li>
              </ul>

              <Callout variant="note">
                <strong style={{ color: 'var(--brand-navy)' }}>PDFs only.</strong> JPEGs and other image formats will be sent back. Also verify the expiration date you enter — incorrect format and wrong expiry dates are the two most common reasons submissions bounce.
              </Callout>

              <h4 style={{ fontWeight: 'bold', color: 'var(--brand-navy)', marginBottom: '10px', marginTop: 'var(--space-3)', fontSize: 'var(--text-body)' }}>Mandatory documents</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: 'var(--space-3)' }}>
                {[
                  'Resident License',
                  'E&O Certificate',
                  'Banking Info (voided check or bank letter with routing, account #, legal name)',
                  'AML Certificate',
                  'Signature Card (download template, sign, scan to PDF)',
                ].map((d) => (
                  <div key={d} style={{ padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ color: 'var(--status-success)', fontWeight: 'bold', flexShrink: 0 }}>&#10003;</span>
                    <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{d}</span>
                  </div>
                ))}
              </div>
            </StepCard>
          </Card>

          <Card style={{ padding: 'var(--space-4)', borderRadius: '16px', marginBottom: 'var(--space-4)' }}>
            <StepCard num="4" title="Select Your Carriers">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: 'var(--text-secondary)' }}>
                Determine which carriers to contract with before submitting anything.
              </p>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <strong style={{ color: 'var(--brand-navy)' }}>Step one: consult your Executive Director.</strong> New agents may hold up to 5 pending carrier contracts. Once you submit business through one, you can request another. Your ED will guide your selections based on your market and objectives. Do not skip this conversation.
              </p>

              <Callout variant="caution">
                <strong style={{ color: 'var(--brand-navy)' }}>For EDs:</strong> This discussion is worth facilitating well. Your knowledge of the local landscape and potential carrier conflicts helps your associate make strategic first picks without tying up contract slots before submitting business. A few deliberate choices outperform a scattered approach.
              </Callout>

              <Expandable heading="Looking for a framework? Carrier suggestions by client segment">
                <p style={{ marginBottom: '10px' }}>Use this as a starting point for your ED discussion. Your ED understands your territory and can steer you clear of conflicts.</p>
                <ul style={{ marginLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)' }}>
                  <li><strong style={{ color: 'var(--brand-navy)' }}>Term life focus &rarr;</strong> Carrier A, Carrier B, Carrier C</li>
                  <li><strong style={{ color: 'var(--brand-navy)' }}>IUL / cash value &rarr;</strong> Carrier D, Carrier E, Carrier F</li>
                  <li><strong style={{ color: 'var(--brand-navy)' }}>Final expense &rarr;</strong> Carrier G, Carrier H, Carrier I</li>
                </ul>
              </Expandable>
            </StepCard>
          </Card>

          <Card style={{ padding: 'var(--space-4)', borderRadius: '16px', marginBottom: 'var(--space-4)' }}>
            <StepCard num="5" title="Submit Carrier Contracts">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Carriers selected — now finalize and send your contract applications.
              </p>

              <ul style={{ marginLeft: '20px', marginBottom: 'var(--space-3)', color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: 'var(--text-secondary)' }}>
                <li><Dot />In the CRM, navigate to <strong style={{ color: 'var(--brand-navy)' }}>My Contracts</strong></li>
                <li><Dot />Complete each carrier&apos;s application (up to 5 simultaneously)</li>
                <li><Dot />Indicate the states where you need to be appointed</li>
              </ul>

              <Callout variant="note">
                <strong style={{ color: 'var(--brand-navy)' }}>The contracting tab will not be accessible until your documents are approved.</strong> If you cannot get in, check your document status first.
              </Callout>

              <Expandable heading="State and carrier-specific requirements (may apply)">
                <div style={{ backgroundColor: 'rgba(0,32,91,0.03)', padding: '14px', borderRadius: '8px', borderLeft: '4px solid var(--brand-navy)', marginBottom: 'var(--space-3)' }}>
                  <strong style={{ color: 'var(--brand-navy)' }}>Structured as an LLC?</strong> Upload your corporate paperwork (articles of incorporation, corporate E&amp;O, corporate license, EIN, corporate banking details) under the <strong>Corporate Information</strong> area of your Profile.
                </div>

                <h4 style={{ fontWeight: 'bold', color: 'var(--brand-navy)', marginBottom: '10px', fontSize: 'var(--text-body)' }}>Expected timelines after submission</h4>
                <ul style={{ marginLeft: '20px', marginBottom: '12px', lineHeight: '2', fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)' }}>
                  <li><Dot />Document review: <strong style={{ color: 'var(--brand-navy)' }}>1–2 business days</strong></li>
                  <li><Dot />Contract forwarded to carriers: <strong style={{ color: 'var(--brand-navy)' }}>up to 5 business days</strong> post-approval</li>
                  <li><Dot />Carrier appointment confirmation: <strong style={{ color: 'var(--brand-navy)' }}>up to 3 weeks</strong> after submission</li>
                </ul>
                <Callout variant="critical">
                  <strong style={{ color: 'var(--brand-navy)' }}>Top decline reason: name discrepancy.</strong> Every document — your CRM profile, license, E&amp;O, AML, and banking records — must display your complete legal name. Even minor variations trigger a rejection. Review every document before uploading.
                </Callout>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-secondary)', marginTop: '12px' }}>
                  Document questions? Reach out to the <strong>Contracting department</strong> (not Broker Support).
                </p>
              </Expandable>
            </StepCard>
          </Card>

          {/* FAQs */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-h2)', fontWeight: '800', color: 'var(--brand-navy)', marginBottom: 'var(--space-2)' }}>
              Contracting Q&amp;A
            </h3>
            <Expandable heading="Where can I learn about carrier products?">
              <p>Product training is available through the carriers directly after you are appointed. Our internal product guides in the Learn section are also a solid resource.</p>
            </Expandable>
            <Expandable heading="Who handles Quantum platform questions?">
              <p>For Quantum-related inquiries, contact Broker Support through the help desk.</p>
            </Expandable>
            <Expandable heading="I cannot add my National Producer Number (NPN).">
              <p>Confirm that your resident license is fully approved and that the legal name matches your profile exactly. If the problem continues, contact the Contracting department.</p>
            </Expandable>
          </div>

          {/* Final CTA */}
          <div style={{
            background: 'linear-gradient(135deg, var(--brand-gold), #D4A94E)', borderRadius: '16px',
            padding: 'var(--space-5) 40px', textAlign: 'center',
            boxShadow: '0 16px 40px rgba(227, 169, 74,0.2)',
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%',
              backgroundColor: 'var(--brand-navy)', color: 'var(--brand-gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h3 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--brand-navy)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
              Licensed. Contracted. Ready to sell.
            </h3>
            <p style={{ fontSize: 'var(--text-body)', color: 'var(--brand-navy)', opacity: 0.8, maxWidth: '580px', margin: '0 auto 32px', lineHeight: '1.6' }}>
              Three stages of real work — and you completed them all. From here, it is all about building: your clients, your team, your business.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)' }}>
              <button onClick={() => { setTab('licensing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{
                background: 'transparent', border: 'none', color: 'var(--brand-navy)',
                fontSize: 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer',
              }}>
                &larr; Previous
              </button>
              <Link href="/dashboard" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                backgroundColor: 'var(--brand-navy)', color: '#fff',
                padding: '14px 32px', borderRadius: '10px',
                fontWeight: 'bold', textDecoration: 'none',
                fontSize: 'var(--text-secondary)', letterSpacing: '0.04em',
              }}>
                GO TO YOUR DASHBOARD &rarr;
              </Link>
            </div>
          </div>

          <StepNav currentIdx={tabIdx} tabs={TABS} onChangeTab={setTab} />
        </div>
      )}

      {/* Support Footer */}
      <div style={{
        marginTop: 'var(--space-5)', padding: 'var(--space-3)',
        borderRadius: '12px', backgroundColor: '#F0F4F8',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <h4 style={{ fontSize: 'var(--text-secondary)', fontWeight: '700', color: 'var(--brand-navy)', margin: '0 0 4px' }}>Stuck on something?</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-caption)', margin: 0 }}>
            Your manager is your first point of contact, but our onboarding team is also available.
          </p>
        </div>
        <button
          onClick={() => window.location.href = 'mailto:support@nxtfinancialgroup.com?subject=Onboarding%20Support%20Request'}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', backgroundColor: 'var(--brand-navy)', color: '#fff',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            fontWeight: '600', fontSize: 'var(--text-caption)', flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
          Reach Out
        </button>
      </div>
    </div>
  );
}

function StepNav({ currentIdx, tabs, onChangeTab }) {
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < tabs.length - 1;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 'var(--space-4)', padding: 'var(--space-3)',
      borderTop: '2px solid var(--border-color)',
    }}>
      {hasPrev ? (
        <button
          onClick={() => { onChangeTab(tabs[currentIdx - 1].key); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 24px', borderRadius: '10px',
            border: '1.5px solid var(--border-color)', backgroundColor: 'transparent',
            cursor: 'pointer', fontSize: 'var(--text-secondary)', fontWeight: '600',
            color: 'var(--brand-navy)', transition: 'all 0.2s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          {tabs[currentIdx - 1].label}
        </button>
      ) : <div />}

      <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: '600' }}>
        Step {currentIdx + 1} of {tabs.length}
      </span>

      {hasNext ? (
        <button
          onClick={() => { onChangeTab(tabs[currentIdx + 1].key); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 24px', borderRadius: '10px',
            border: 'none', backgroundColor: 'var(--brand-navy)',
            cursor: 'pointer', fontSize: 'var(--text-secondary)', fontWeight: '600',
            color: '#fff', transition: 'all 0.2s',
          }}
        >
          {tabs[currentIdx + 1].label}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      ) : <div />}
    </div>
  );
}

const goldPillBtn = {
  backgroundColor: 'var(--brand-gold)', color: 'var(--brand-navy)',
  border: 'none', padding: '12px 24px', borderRadius: '999px',
  fontSize: 'var(--text-secondary)', fontWeight: '700', cursor: 'pointer',
  marginBottom: 'var(--space-3)',
};
