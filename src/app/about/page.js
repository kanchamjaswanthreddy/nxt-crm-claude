import React from 'react';
import Image from 'next/image';

export const metadata = {
  title: 'NXT CRM — Agent Management Platform | NXT Financial Group',
  description: 'NXT CRM is an internal SaaS platform for NXT Financial Group agents. Subscription-based access for lead management, commission tracking, compliance, and business operations.',
};

const FEATURES = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E3A94A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Lead & Pipeline Management',
    desc: 'Track prospective clients through customizable sales pipelines with automated stage progression, follow-up reminders, and conversion analytics.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E3A94A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: 'Commission & Earnings Tracking',
    desc: 'Real-time visibility into personal commissions, team overrides, split arrangements, and payment history with automated reconciliation.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E3A94A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: 'Client & Policy Management',
    desc: 'Centralized client records with policy details, beneficiary tracking, communication logs, and document storage.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E3A94A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    title: 'Compliance & Licensing',
    desc: 'Automated tracking of state insurance licenses, E&O insurance status, AML certification, and regulatory compliance requirements.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E3A94A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: 'Secure Document Management',
    desc: 'Digital signing of agreements (ICA, AOA, Business Standards), secure document uploads, and admin review workflows with audit trails.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E3A94A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    title: 'Performance & Team Analytics',
    desc: 'Scoreboard rankings, production dashboards, team hierarchy views, and detailed reporting for agents and managers.',
  },
];

const PRICING = [
  { level: 1, title: 'Unlicensed Associate', price: 10 },
  { level: 2, title: 'Financial Associate', price: 20 },
  { level: 3, title: 'Senior Financial Associate', price: 25 },
  { level: 4, title: 'Financial Director', price: 30 },
  { level: 5, title: 'Senior Financial Director', price: 40 },
];

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7f8fb', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>

      {/* ── HEADER ── */}
      <header style={{
        backgroundColor: '#fff',
        borderBottom: '3px solid #E3A94A',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto', padding: '14px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Image src="/new-nxt-logo.png" alt="NXT Financial Group" width={180} height={60} style={{ objectFit: 'contain' }} />
          <a href="/auth/login" style={{
            padding: '10px 28px', borderRadius: '8px',
            backgroundColor: '#0C1022', color: '#fff',
            fontSize: '14px', fontWeight: 700, textDecoration: 'none',
          }}>
            Agent Login
          </a>
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={{
        background: 'linear-gradient(180deg, #0C1022 0%, #1B2A4E 60%, #f7f8fb 100%)',
        padding: '72px 32px 96px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-block', padding: '6px 16px', borderRadius: '999px',
            backgroundColor: 'rgba(227, 169, 74, 0.15)', border: '1px solid rgba(227, 169, 74, 0.3)',
            fontSize: '13px', fontWeight: 600, color: '#E3A94A',
            marginBottom: '24px', letterSpacing: '0.5px',
          }}>
            Internal SaaS Platform
          </div>
          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, color: '#fff',
            margin: '0 0 20px', lineHeight: 1.15, letterSpacing: '-1px',
          }}>
            The Operating System for <br />
            <span style={{ color: '#E3A94A' }}>NXT Financial Agents</span>
          </h1>
          <p style={{
            fontSize: '18px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7,
            margin: '0 auto', maxWidth: '560px',
          }}>
            NXT CRM is a proprietary software-as-a-service platform that powers daily operations
            for our insurance agents — from onboarding and compliance through commissions and client management.
          </p>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ maxWidth: '1100px', margin: '-48px auto 0', padding: '0 32px 64px', position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px',
        }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              backgroundColor: '#fff',
              border: '1px solid #e8ecf1',
              borderRadius: '14px',
              padding: '28px',
              transition: 'box-shadow 0.25s ease, transform 0.25s ease',
              boxShadow: '0 1px 3px rgba(12, 16, 34,0.04)',
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                backgroundColor: 'rgba(227, 169, 74, 0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '16px',
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0C1022', margin: '0 0 8px' }}>{f.title}</h3>
              <p style={{ fontSize: '14px', color: '#5F5C56', margin: 0, lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ backgroundColor: '#fff', borderTop: '1px solid #e8ecf1', borderBottom: '1px solid #e8ecf1', padding: '64px 32px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0C1022', margin: '0 0 12px', textAlign: 'center', letterSpacing: '-0.5px' }}>
            How It Works
          </h2>
          <p style={{ fontSize: '16px', color: '#5F5C56', textAlign: 'center', margin: '0 auto 40px', maxWidth: '500px' }}>
            Agents access the platform through a secure subscription-based model.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '32px' }}>
            {[
              { step: '01', title: 'Agent Onboarding', desc: 'New agents complete a guided onboarding flow — personal info, background check consent, and digital document signing.' },
              { step: '02', title: 'Subscription Setup', desc: 'Agents enter payment details via Stripe. A 30-day free trial begins immediately — no charge until day 31.' },
              { step: '03', title: 'Admin Approval', desc: 'Agency admins review the application, verify documents, and approve the agent for full platform access.' },
              { step: '04', title: 'Monthly Billing', desc: 'After the trial, Stripe automatically charges the monthly fee. Agents can manage billing from their dashboard.' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0C1022, #1a3f6e)',
                  color: '#E3A94A', fontSize: '18px', fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px',
                }}>
                  {s.step}
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0C1022', margin: '0 0 6px' }}>{s.title}</h3>
                <p style={{ fontSize: '13px', color: '#5F5C56', margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section style={{ padding: '64px 32px', maxWidth: '700px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0C1022', margin: '0 0 12px', textAlign: 'center', letterSpacing: '-0.5px' }}>
          Subscription Pricing
        </h2>
        <p style={{ fontSize: '16px', color: '#5F5C56', textAlign: 'center', margin: '0 auto 32px', maxWidth: '480px' }}>
          Monthly SaaS fees based on agent level. All plans include full platform access with a 30-day free trial.
        </p>

        <div style={{
          backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e8ecf1',
          overflow: 'hidden', boxShadow: '0 2px 8px rgba(12, 16, 34,0.06)',
        }}>
          {/* Table header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', padding: '14px 24px',
            backgroundColor: '#0C1022', color: '#fff', fontSize: '13px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.8px',
          }}>
            <span>Agent Level</span>
            <span>Monthly Fee</span>
          </div>
          {PRICING.map((row, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 24px',
              borderBottom: i < PRICING.length - 1 ? '1px solid #F1EFEA' : 'none',
              backgroundColor: i % 2 === 1 ? '#fafbfc' : '#fff',
            }}>
              <div>
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#0C1022' }}>
                  Level {row.level}
                </span>
                <span style={{ fontSize: '14px', color: '#5F5C56', marginLeft: '8px' }}>
                  {row.title}
                </span>
              </div>
              <span style={{
                fontSize: '16px', fontWeight: 700, color: '#0C1022',
                backgroundColor: 'rgba(227, 169, 74, 0.1)',
                padding: '4px 14px', borderRadius: '8px',
              }}>
                ${row.price}<span style={{ fontSize: '12px', color: '#5F5C56', fontWeight: 500 }}>/mo</span>
              </span>
            </div>
          ))}
        </div>

        {/* Trial note */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center',
          marginTop: '16px', padding: '12px 20px', borderRadius: '10px',
          backgroundColor: 'rgba(47, 168, 79, 0.06)', border: '1px solid rgba(47, 168, 79, 0.15)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2FA84F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span style={{ fontSize: '14px', color: '#2FA84F', fontWeight: 600 }}>
            All plans include a 30-day free trial — no charge until day 31
          </span>
        </div>
      </section>

      {/* ── STRIPE CLARIFICATION ── */}
      <section style={{ padding: '0 32px 64px' }}>
        <div style={{
          maxWidth: '700px', margin: '0 auto',
          backgroundColor: '#fff',
          borderRadius: '16px', padding: '40px',
          border: '2px solid #0C1022',
          boxShadow: '0 2px 12px rgba(12, 16, 34,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0C1022" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#0C1022' }}>Payment Processing Disclosure</h2>
          </div>
          <p style={{ fontSize: '15px', color: '#334155', lineHeight: 1.75, margin: '0 0 16px' }}>
            Stripe is used <strong style={{ color: '#0C1022' }}>exclusively</strong> to collect monthly SaaS subscription fees from
            agents for access to the NXT CRM platform. The following types of transactions are
            <strong style={{ color: '#0C1022' }}> never</strong> processed through Stripe:
          </p>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#475569', lineHeight: 2.2 }}>
            <li>Insurance premiums or policy payments</li>
            <li>Client-facing financial transactions</li>
            <li>Insurance reimbursements or claims</li>
            <li>Commission payouts or agent compensation</li>
          </ul>
          <p style={{ fontSize: '14px', color: '#5F5C56', marginTop: '20px', marginBottom: 0, borderTop: '1px solid #e8ecf1', paddingTop: '16px' }}>
            All payment processing is limited to recurring B2B software subscription billing
            between NXT Financial Group (the platform operator) and its contracted agents (the platform users).
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        backgroundColor: '#0a1929',
        padding: '48px 32px 32px',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          {/* Top row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexWrap: 'wrap', gap: '20px',
          }}>
            <div>
              <Image src="/new-nxt-logo.png" alt="NXT Financial Group" width={160} height={53} style={{ objectFit: 'contain' }} />
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                A subsidiary of NXT World Holdings, Inc.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '24px', fontSize: '14px' }}>
              <a href="https://www.nxtfinancialgroup.com" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Main Website</a>
              <a href="/auth/login" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Agent Portal</a>
              <a href="/privacy" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Privacy Policy</a>
              <a href="/terms" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Terms</a>
            </div>
          </div>
          {/* Bottom row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: '20px', flexWrap: 'wrap', gap: '12px',
          }}>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
              &copy; {new Date().getFullYear()} NXT Financial Group, NXT World Holdings, Inc. All Rights Reserved.
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', margin: 0 }}>
              Internal CRM Platform — Not a consumer-facing product.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
