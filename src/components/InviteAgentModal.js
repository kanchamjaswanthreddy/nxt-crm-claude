"use client";

import React, { useState, useEffect } from 'react';
import { createInvite } from '@/app/actions/invite';
import { getOrCreateReferralCode } from '@/app/actions/agents';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { AGENT_LEVELS } from '@/lib/constants';
import CommissionSplitBar from '@/components/CommissionSplitBar';


export default function InviteAgentModal({ isOpen, onClose, userProfile, agents = [], initialEmail = '' }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [referralLink, setReferralLink] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    email: '',
    role: 'agent',
    upline_id: userProfile?.uid || '',
    agentLevel: 1
  });
  const [overrides, setOverrides] = useState([]);

  // Load referral link when modal opens
  useEffect(() => {
    if (!isOpen || referralLink) return;
    getOrCreateReferralCode().then(res => {
      if (res.success) {
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        setReferralLink(`${base}/join?ref=${res.referralCode}`);
      }
    });
  }, [isOpen, referralLink]);

  // Opened from a link that already knows who to invite (Pipeline Board "Invite to team")
  useEffect(() => {
    if (isOpen && initialEmail) { setForm(prev => ({ ...prev, email: initialEmail })); setShowForm(true); }
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const inviterName = userProfile?.full_name || userProfile?.first_name || 'NXT Financial Group';

  const handleClose = () => {
    setForm({ email: '', role: 'agent', upline_id: userProfile?.uid || '', agentLevel: 1 });
    setOverrides([]);
    setResult(null);
    setCopied(false);
    setLinkCopied(false);
    setShowForm(false);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) return;

    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await createInvite({
        email: form.email.trim().toLowerCase(),
        role: 'agent',
        upline_id: form.upline_id || userProfile?.uid,
        invited_by_uid: userProfile?.uid,
        agency_id: userProfile?.agency_id,
        agentLevel: form.agentLevel,
        commissionOverrides: overrides.length > 0 ? overrides : undefined,
      });

      if (res.success) {
        setResult({ type: 'success', link: res.inviteLink, emailSent: res.emailSent, emailError: res.emailError });
      } else {
        setResult({ type: 'error', message: res.error || 'Failed to create invite.' });
      }
    } catch (err) {
      setResult({ type: 'error', message: 'Something went wrong. Please try again.' });
    }
    setIsSubmitting(false);
  };

  const handleCopyResult = async () => {
    if (result?.link) {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCopyLink = async () => {
    if (referralLink) {
      await navigator.clipboard.writeText(referralLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    }
  };

  const emailBody = (link) => encodeURIComponent(
`Hi,

You have been invited to join NXT Financial Group as a team member by ${inviterName}.

Click the link below to get started:

${link}

If you have any questions, feel free to reply to this email.

Best regards,
${inviterName}`
  );

  const emailSubject = encodeURIComponent("You're Invited to Join NXT Financial Group");

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 10000
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <Card style={{ width: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--brand-navy)', fontSize: 'var(--text-h2)', fontWeight: '600' }}>
              Invite Team Member
            </h3>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: 'var(--text-caption)' }}>
              Share your link or send a personalized invite
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              border: 'none', backgroundColor: 'rgba(0,0,0,0.05)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-secondary)', fontSize: '18px', transition: 'background-color 0.2s ease'
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {!result ? (
          <>
            {/* ── Quick Share Section ── */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(12, 16, 34, 0.04), rgba(227, 169, 74, 0.04))',
              borderRadius: '14px',
              padding: '16px',
              marginBottom: '16px',
              border: '1px solid rgba(12, 16, 34, 0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-blue-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
                <span style={{ fontSize: 'var(--text-body)', fontWeight: '600', color: 'var(--brand-navy)' }}>
                  Your Invite Link
                </span>
              </div>

              {/* Link box */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 6px 6px 14px',
                backgroundColor: '#fff',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                marginBottom: '10px'
              }}>
                <input
                  readOnly
                  value={referralLink || 'Loading...'}
                  style={{
                    flex: 1, border: 'none', background: 'transparent',
                    fontFamily: 'var(--font-base)', fontSize: '15px',
                    color: 'var(--text-primary)', outline: 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis'
                  }}
                />
                <button className="nxt-btn nxt-btn-sm nxt-btn-primary"
                  onClick={handleCopyLink}
                  disabled={!referralLink}
                >
                  {linkCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Email button */}
              <a
                href={referralLink ? `mailto:?subject=${emailSubject}&body=${emailBody(referralLink)}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  width: '100%', padding: '9px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#fff',
                  color: 'var(--brand-navy)', fontSize: 'var(--text-sm)', fontWeight: '600',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
                }}
                onMouseOver={e => { e.currentTarget.style.backgroundColor = 'var(--surface-page)'; e.currentTarget.style.borderColor = 'var(--brand-blue-accent)'; }}
                onMouseOut={e => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-10 7L2 7" />
                </svg>
                Send via Email
              </a>

              <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Anyone with this link can join your agency as an agent
              </p>
            </div>

            {/* ── Divider ── */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              margin: '4px 0 16px',
            }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>or send a personalized invite</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            </div>

            {/* ── Personalized Invite Form (collapsible) ── */}
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  width: '100%', padding: '12px',
                  borderRadius: '12px',
                  border: '1px dashed var(--border-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--brand-navy)', fontSize: 'var(--text-sm)', fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
                }}
                onMouseOver={e => { e.currentTarget.style.backgroundColor = 'var(--surface-page)'; e.currentTarget.style.borderColor = 'var(--brand-blue-accent)'; }}
                onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" />
                </svg>
                Set up a personalized invite with level and splits
              </button>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <Input
                  id="invite-email"
                  label="Email Address"
                  type="email"
                  value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                  placeholder="agent@example.com"
                  required
                />

                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-secondary)', fontWeight: '500', color: 'var(--text-primary)' }}>
                    Role
                  </label>
                  <div style={{
                    padding: 'var(--space-2) 16px', borderRadius: '12px',
                    border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-page)',
                    fontSize: 'var(--text-secondary)', color: 'var(--text-primary)',
                  }}>
                    Agent
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                    All new team members join as agents. An admin or IT engineer can promote them after onboarding.
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-secondary)', fontWeight: '500', color: 'var(--text-primary)' }}>
                    Position / Level
                  </label>
                  <select
                    value={form.agentLevel}
                    onChange={e => setForm({...form, agentLevel: Number(e.target.value)})}
                    style={{
                      width: '100%', padding: 'var(--space-2) 16px', borderRadius: '12px',
                      border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-card)',
                      fontFamily: 'var(--font-base)', fontSize: 'var(--text-secondary)', color: 'var(--text-primary)',
                      outline: 'none', transition: 'border-color 0.2s ease'
                    }}
                  >
                    {AGENT_LEVELS.map(lvl => (
                      <option key={lvl.level} value={lvl.level}>
                        Level {lvl.level} — {lvl.title} (${lvl.price}/mo)
                      </option>
                    ))}
                  </select>
                  <p style={{ margin: '4px 0 0 0', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                    This determines the agent&apos;s monthly subscription rate. First month is free.
                  </p>
                </div>

                {/* Recruiting Split */}
                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-secondary)', fontWeight: '500', color: 'var(--text-primary)' }}>
                    Recruiting Split
                  </label>
                  <p style={{ margin: '0 0 8px 0', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                    Set up who earns a share of this agent&apos;s recruiting split. The new agent keeps the remainder.
                  </p>
                  <CommissionSplitBar
                    overrides={overrides}
                    agents={agents}
                    agentId="__new_invite__"
                    agentName={form.email.split('@')[0] || 'New Agent'}
                    onChange={setOverrides}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  <Button variant="secondary" type="button" onClick={() => setShowForm(false)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={isSubmitting} disabled={!form.email.trim()}>
                    Send Invite
                  </Button>
                </div>
              </form>
            )}
          </>
        ) : result.type === 'success' ? (
          <div>
            {/* Success state */}
            <div style={{
              backgroundColor: 'rgba(47, 168, 79, 0.08)',
              borderRadius: '12px',
              padding: 'var(--space-3)',
              textAlign: 'center',
              marginBottom: 'var(--space-3)'
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                backgroundColor: 'var(--status-success)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto var(--space-2) auto'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h4 style={{ color: 'var(--brand-navy)', marginBottom: '4px', fontSize: 'var(--text-body)' }}>
                {result.emailSent ? 'Invite Sent' : 'Invite Created'}
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-caption)', margin: 0 }}>
                {result.emailSent
                  ? 'An email has been sent to the new team member. You can also share the link below.'
                  : 'Share this invite link with the new team member. It expires in 7 days.'}
              </p>
              {result.emailError && (
                <p style={{ color: 'var(--status-warning)', fontSize: 'var(--text-caption)', margin: '8px 0 0 0', fontWeight: 500 }}>
                  {result.emailError}
                </p>
              )}
            </div>

            {/* Invite link box */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 6px 6px 14px',
              backgroundColor: 'var(--surface-page)',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              marginBottom: '10px'
            }}>
              <input
                readOnly
                value={result.link}
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  fontFamily: 'var(--font-base)', fontSize: '15px',
                  color: 'var(--text-primary)', outline: 'none',
                  overflow: 'hidden', textOverflow: 'ellipsis'
                }}
              />
              <button className="nxt-btn nxt-btn-sm nxt-btn-primary"
                onClick={handleCopyResult}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* Send via Email */}
            <a
              href={`mailto:${form.email}?subject=${emailSubject}&body=${emailBody(result.link)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', padding: '9px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--surface-card)',
                color: 'var(--brand-navy)', fontSize: 'var(--text-sm)', fontWeight: '600',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
                marginBottom: 'var(--space-3)'
              }}
              onMouseOver={e => { e.currentTarget.style.backgroundColor = 'var(--surface-page)'; e.currentTarget.style.borderColor = 'var(--brand-blue-accent)'; }}
              onMouseOut={e => { e.currentTarget.style.backgroundColor = 'var(--surface-card)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 7l-10 7L2 7" />
              </svg>
              Send via Email
            </a>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                variant="secondary"
                size="small"
                onClick={() => { setResult(null); setOverrides([]); setShowForm(false); setForm({ email: '', role: 'agent', upline_id: userProfile?.uid || '', agentLevel: 1 }); }}
              >
                Invite Another
              </Button>
              <Button size="small" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {/* Error state */}
            <div style={{
              backgroundColor: 'rgba(211, 63, 63, 0.08)',
              borderLeft: '4px solid var(--status-error)',
              padding: 'var(--space-2)',
              borderRadius: '4px',
              marginBottom: 'var(--space-3)'
            }}>
              <p style={{ color: 'var(--status-error)', fontSize: 'var(--text-secondary)', margin: 0, fontWeight: '600' }}>
                {result.message}
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={handleClose}>Close</Button>
              <Button onClick={() => setResult(null)}>Try Again</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
