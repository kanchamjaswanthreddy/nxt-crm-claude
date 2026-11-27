"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripeClient';
import { useUser } from '@/context/UserContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { AGENT_LEVELS, isSubscriptionExempt } from '@/lib/constants';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { getBillingHistory, getAgencyBillingSummary, sendPaymentReminders, adminCreateSubscription } from '@/app/actions/billing';

export default function BillingPage() {
  const { userProfile, refreshProfile } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [agencySummary, setAgencySummary] = useState(null);
  const [agencyAgents, setAgencyAgents] = useState([]);
  const [showUpdateCard, setShowUpdateCard] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState(null);
  const [activatingAgentId, setActivatingAgentId] = useState(null);
  const [activateAllLoading, setActivateAllLoading] = useState(false);

  const loadBillingData = useCallback(async (profile) => {
    try {
      const [historyRes, summaryRes] = await Promise.all([
        getBillingHistory(),
        profile.role === 'admin' ? getAgencyBillingSummary() : Promise.resolve(null),
      ]);

      if (historyRes?.success) setTransactions(historyRes.transactions);
      if (summaryRes?.success) {
        setAgencySummary(summaryRes.summary);
        setAgencyAgents(summaryRes.agents);
      }
    } catch (err) {
      // silenced
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!userProfile) return;
    // Capture current timestamp for "days until charge" calculation
    setNow(Date.now()); // eslint-disable-line react-hooks/set-state-in-effect
    loadBillingData(userProfile);
  }, [userProfile, loadBillingData]);

  if (!userProfile || isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <LoadingSpinner label="Loading..." />
      </div>
    );
  }

  const isAdmin = userProfile.role === 'admin';
  const isExempt = isSubscriptionExempt(userProfile);
  const currentLevel = AGENT_LEVELS.find(l => l.level === (userProfile.agentLevel || 1));
  const subStatus = isExempt ? 'exempt' : (userProfile.subscriptionStatus || 'none');
  const trialStart = userProfile.trialStartDate ? new Date(userProfile.trialStartDate) : null;
  const nextCharge = !isExempt && userProfile.nextChargeDate ? new Date(userProfile.nextChargeDate) : null;
  const daysUntilCharge = nextCharge ? Math.max(0, Math.ceil((nextCharge - now) / (1000 * 60 * 60 * 24))) : null;
  const cardLast4 = userProfile.payment?.cardLastFour;

  // Calculate agency totals (exclude exempt agents)
  const agencyMonthlyTotal = agencyAgents.reduce((sum, a) => {
    if (a.is_owner || a.role === 'it_engineer') return sum;
    const lvl = AGENT_LEVELS.find(l => l.level === (a.agentLevel || 1));
    if (a.subscriptionStatus === 'active' || a.subscriptionStatus === 'trial') {
      return sum + (lvl?.price || 0);
    }
    return sum;
  }, 0);

  // Generate billing schedule (next 3 months)
  const billingSchedule = [];
  if (nextCharge) {
    for (let i = 0; i < 3; i++) {
      const d = new Date(nextCharge);
      d.setMonth(d.getMonth() + i);
      billingSchedule.push({
        date: d,
        amount: currentLevel?.price || 0,
        status: i === 0 ? 'upcoming' : 'scheduled',
      });
    }
  }

  const statusBadge = (status) => {
    const map = {
      exempt: { bg: 'rgba(47, 168, 79, 0.1)', color: '#2FA84F', label: 'No Charge' },
      trial: { bg: 'rgba(47, 168, 79, 0.1)', color: '#2FA84F', label: 'Free Trial' },
      active: { bg: 'rgba(10, 37, 64, 0.08)', color: 'var(--brand-navy)', label: 'Active' },
      past_due: { bg: 'rgba(211, 63, 63, 0.1)', color: '#D33F3F', label: 'Past Due' },
      cancelled: { bg: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', label: 'Cancelled' },
      none: { bg: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', label: 'Not Set' },
    };
    const s = map[status] || map.none;
    return (
      <span style={{
        padding: '3px 10px', borderRadius: '999px', fontSize: '13px', fontWeight: '700',
        textTransform: 'uppercase', backgroundColor: s.bg, color: s.color,
      }}>
        {s.label}
      </span>
    );
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  return (
    <div>
      <PageHeader
        title="Billing & Subscription"
        subtitle={isAdmin ? 'Manage agency subscriptions, view team billing, and track payments.' : 'View your subscription, payment schedule, and billing history.'}
      />

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>

        {/* My Plan */}
        <Card>
          <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
            {isAdmin ? 'Your Plan' : 'Current Plan'}
          </p>
          <p style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: 'var(--brand-navy)' }}>
            {currentLevel?.title}
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--brand-navy)' }}>${isExempt ? '0' : currentLevel?.price}</span>
            <span style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>/mo</span>
          </div>
          {statusBadge(subStatus)}
          {isExempt && (
            <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#2FA84F', fontWeight: '500' }}>
              {userProfile.is_owner ? 'Owners are not charged a subscription fee.' : 'IT Engineer accounts are not charged a subscription fee.'}
            </p>
          )}
        </Card>

        {/* Next Payment */}
        <Card>
          <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
            Next Payment
          </p>
          {nextCharge ? (
            <>
              <p style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: 'var(--brand-navy)' }}>
                {nextCharge.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <p style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '800', color: 'var(--brand-navy)' }}>
                {formatCurrency(currentLevel?.price)}
              </p>
              {daysUntilCharge !== null && daysUntilCharge <= 7 && (
                <span style={{
                  padding: '3px 10px', borderRadius: '999px', fontSize: '13px', fontWeight: '700',
                  backgroundColor: 'rgba(224, 142, 43, 0.1)', color: '#E08E2B',
                }}>
                  Due in {daysUntilCharge} day{daysUntilCharge !== 1 ? 's' : ''}
                </span>
              )}
            </>
          ) : (
            <p style={{ margin: 0, fontSize: '16px', color: 'var(--text-secondary)' }}>No upcoming payment</p>
          )}
        </Card>

        {/* Payment Method */}
        <Card>
          <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
            Payment Method
          </p>
          {cardLast4 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <svg width="24" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-navy)" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--brand-navy)' }}>•••• {cardLast4}</span>
              </div>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>ZIP: {userProfile.payment?.billingZip || '—'}</p>
            </>
          ) : (
            <p style={{ margin: '0 0 10px 0', fontSize: '16px', color: 'var(--text-secondary)' }}>No card on file</p>
          )}
          <Button variant="secondary" size="small" onClick={() => setShowUpdateCard(true)}>
            Update Card
          </Button>
        </Card>

        {/* Agency Total (admin only) */}
        {isAdmin && agencySummary && (
          <Card style={{ backgroundColor: 'var(--brand-navy)', color: '#fff' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: 'var(--brand-silver)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
              Agency Monthly Total
            </p>
            <p style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '800', color: 'var(--brand-gold)' }}>
              {formatCurrency(agencyMonthlyTotal)}
            </p>
            <div style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
              <span><strong style={{ color: '#fff' }}>{agencySummary.activeCount}</strong> <span style={{ color: 'var(--brand-silver)' }}>active</span></span>
              <span><strong style={{ color: '#fff' }}>{agencySummary.trialCount}</strong> <span style={{ color: 'var(--brand-silver)' }}>trial</span></span>
              <span><strong style={{ color: '#fff' }}>{agencySummary.totalAgents}</strong> <span style={{ color: 'var(--brand-silver)' }}>total</span></span>
            </div>
          </Card>
        )}
      </div>

      {/* Upcoming Payment Schedule */}
      {billingSchedule.length > 0 && (
        <Card style={{ marginBottom: 'var(--space-3)' }}>
          <h3 style={{ margin: '0 0 var(--space-2) 0', color: 'var(--brand-navy)', fontSize: '17px', fontWeight: '600' }}>
            Upcoming Payment Schedule
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {billingSchedule.map((item, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px', borderRadius: '8px',
                backgroundColor: i === 0 ? 'rgba(10, 37, 64, 0.03)' : 'transparent',
                borderLeft: i === 0 ? '3px solid var(--brand-navy)' : '3px solid transparent',
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: i === 0 ? '600' : '400', color: 'var(--brand-navy)' }}>
                    {item.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {currentLevel?.title} — Level {currentLevel?.level}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--brand-navy)' }}>
                    {formatCurrency(item.amount)}
                  </p>
                  <span style={{
                    fontSize: '13px', fontWeight: '700', textTransform: 'uppercase',
                    color: i === 0 ? '#E08E2B' : 'var(--text-secondary)',
                  }}>
                    {i === 0 ? 'Next' : 'Scheduled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Transaction History */}
      <Card style={{ marginBottom: 'var(--space-3)', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 0 16px' }}>
          <h3 style={{ margin: '0 0 var(--space-2) 0', color: 'var(--brand-navy)', fontSize: '17px', fontWeight: '600' }}>
            Transaction History
          </h3>
        </div>
        {transactions.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)' }}>
                <th scope="col" style={thStyle}>Date</th>
                <th scope="col" style={thStyle}>Description</th>
                <th scope="col" style={thStyle}>Amount</th>
                <th scope="col" style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={tdStyle}>{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td style={tdStyle}>{t.description || 'Monthly subscription'}</td>
                  <td style={{ ...tdStyle, fontWeight: '600' }}>{formatCurrency(t.amount)}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '999px', fontSize: '13px', fontWeight: '600',
                      backgroundColor: t.status === 'paid' ? 'rgba(47, 168, 79, 0.1)' : 'rgba(211, 63, 63, 0.1)',
                      color: t.status === 'paid' ? '#2FA84F' : '#D33F3F',
                    }}>
                      {(t.status || 'pending').toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            variant="minimal"
            title="No transactions yet."
            description={subStatus === 'trial' ? 'Your first charge will appear here after your free trial ends.' : 'Payments will appear here once Stripe billing is active.'}
          />
        )}
      </Card>

      {/* Agents Missing Subscription (admin only) */}
      {isAdmin && (() => {
        const noSub = agencyAgents.filter(a =>
          !a.is_owner && a.role !== 'it_engineer' && !a.billingExempt &&
          !a.stripe_subscription_id && !a.nextChargeDate &&
          (!a.subscriptionStatus || a.subscriptionStatus === 'none' || a.subscriptionStatus === 'trial')
        );
        if (noSub.length === 0) return null;

        const handleActivate = async (agentId) => {
          setActivatingAgentId(agentId);
          try {
            const res = await adminCreateSubscription(agentId);
            if (res.success) {
              const newStatus = res.trialDaysRemaining > 0 ? 'trial' : 'active';
              setAgencyAgents(prev => prev.map(a =>
                a.id === agentId
                  ? { ...a, subscriptionStatus: newStatus, nextChargeDate: res.trialEnd, stripe_subscription_id: res.subscriptionId }
                  : a
              ));
              const trialMsg = res.trialDaysRemaining > 0
                ? `${res.trialDaysRemaining} days trial remaining`
                : 'trial expired, billing starts now';
              setReminderResult({ type: 'success', message: `${res.agentName} — ${trialMsg}` });
            } else {
              setReminderResult({ type: 'error', message: res.error });
            }
          } catch {
            setReminderResult({ type: 'error', message: 'Failed to create subscription' });
          }
          setActivatingAgentId(null);
          setTimeout(() => setReminderResult(null), 6000);
        };

        const handleActivateAll = async () => {
          setActivateAllLoading(true);
          setReminderResult(null);
          let created = 0;
          let failed = 0;
          for (const agent of noSub) {
            try {
              const res = await adminCreateSubscription(agent.id);
              if (res.success) {
                created++;
                setAgencyAgents(prev => prev.map(a =>
                  a.id === agent.id
                    ? { ...a, subscriptionStatus: 'trial', nextChargeDate: res.trialEnd, stripe_subscription_id: res.subscriptionId, trialStartDate: new Date().toISOString() }
                    : a
                ));
              } else {
                failed++;
              }
            } catch {
              failed++;
            }
          }
          setActivateAllLoading(false);
          setReminderResult({
            type: failed === noSub.length ? 'error' : 'success',
            message: `Created ${created} subscription${created !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''} (30-day trial each)`,
          });
          setTimeout(() => setReminderResult(null), 8000);
        };

        return (
          <Card style={{ marginBottom: 'var(--space-3)', border: '1px solid rgba(211, 63, 63, 0.3)', backgroundColor: 'rgba(211, 63, 63, 0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ fontSize: '24px', lineHeight: 1 }}>&#9888;</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px 0', color: '#D33F3F', fontSize: '17px', fontWeight: '700' }}>
                  {noSub.length} Agent{noSub.length !== 1 ? 's' : ''} Without Subscription
                </h3>
                <p style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--text-secondary)' }}>
                  Create a subscription with 30-day free trial. Agents will need to add their card before the trial ends.
                </p>

                {/* Per-agent rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                  {noSub.map(a => {
                    const lvl = AGENT_LEVELS.find(l => l.level === (a.agentLevel || 1));
                    return (
                      <div key={a.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 12px', borderRadius: '10px',
                        backgroundColor: '#fff', border: '1px solid rgba(0,0,0,0.06)',
                      }}>
                        <span style={{ flex: 1, fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>{a.name}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          L{lvl?.level} &middot; {formatCurrency(lvl?.price)}/mo
                        </span>
                        <button className="nxt-btn nxt-btn-sm nxt-btn-primary"
                          onClick={() => handleActivate(a.id)}
                          disabled={activatingAgentId === a.id || activateAllLoading}
                        >
                          {activatingAgentId === a.id ? 'Creating...' : 'Activate'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Bulk actions */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {noSub.length > 1 && (
                    <Button
                      size="small"
                      onClick={handleActivateAll}
                      isLoading={activateAllLoading}
                      disabled={!!activatingAgentId}
                    >
                      Activate All ({noSub.length})
                    </Button>
                  )}
                  <Button variant="secondary"
                    size="small"
                   
                    onClick={async () => {
                      setIsSendingReminders(true);
                      setReminderResult(null);
                      try {
                        const res = await sendPaymentReminders();
                        if (res.success) {
                          setReminderResult({ type: 'success', message: `Sent ${res.sent.length} reminder${res.sent.length !== 1 ? 's' : ''}${res.skipped.length ? `, ${res.skipped.length} skipped (no email)` : ''}` });
                        } else {
                          setReminderResult({ type: 'error', message: res.error || 'Failed' });
                        }
                      } catch {
                        setReminderResult({ type: 'error', message: 'Failed to send reminders' });
                      }
                      setIsSendingReminders(false);
                      setTimeout(() => setReminderResult(null), 8000);
                    }}
                    isLoading={isSendingReminders}
                    disabled={!!activatingAgentId || activateAllLoading}
                  >
                    Send Email Reminders Instead
                  </Button>
                  {reminderResult && (
                    <span style={{
                      fontSize: '14px', fontWeight: 500,
                      color: reminderResult.type === 'success' ? '#2FA84F' : '#D33F3F',
                    }}>
                      {reminderResult.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Agency Team Billing (admin only) */}
      {isAdmin && agencyAgents.length > 0 && (
        <Card style={{ marginBottom: 'var(--space-3)', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 16px 0 16px' }}>
            <h3 style={{ margin: '0 0 4px 0', color: 'var(--brand-navy)', fontSize: '17px', fontWeight: '600' }}>
              Team Subscriptions
            </h3>
            <p style={{ margin: '0 0 var(--space-2) 0', fontSize: '15px', color: 'var(--text-secondary)' }}>
              All agents in your agency and their subscription status.
            </p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)' }}>
                <th scope="col" style={thStyle}>Agent</th>
                <th scope="col" style={thStyle}>Level</th>
                <th scope="col" style={thStyle}>Monthly</th>
                <th scope="col" style={thStyle}>Status</th>
                <th scope="col" style={thStyle}>Next Charge</th>
              </tr>
            </thead>
            <tbody>
              {agencyAgents
                .sort((a, b) => (b.is_owner ? 1 : 0) - (a.is_owner ? 1 : 0) || a.name.localeCompare(b.name))
                .map(agent => {
                  const lvl = AGENT_LEVELS.find(l => l.level === (agent.agentLevel || 1));
                  const agentExempt = agent.is_owner || agent.role === 'it_engineer' || agent.billingExempt;
                  return (
                    <tr key={agent.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: agentExempt ? 0.7 : 1 }}>
                      <td style={tdStyle}>
                        <div>
                          <span style={{ fontWeight: '500' }}>{agent.name}</span>
                          {agent.is_owner && (
                            <span style={{ marginLeft: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--brand-gold)' }}>OWNER</span>
                          )}
                          {agent.role === 'it_engineer' && (
                            <span style={{ marginLeft: '6px', fontSize: '13px', fontWeight: '700', color: '#1B2A4E' }}>IT</span>
                          )}
                          {agent.billingExempt && !agent.is_owner && agent.role !== 'it_engineer' && (
                            <span style={{ marginLeft: '6px', fontSize: '13px', fontWeight: '700', color: '#2FA84F' }}>EXEMPT</span>
                          )}
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{agent.role === 'it_engineer' ? 'IT Engineer' : agent.role}</div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '999px', fontSize: '13px', fontWeight: '600',
                          backgroundColor: 'rgba(10, 37, 64, 0.06)', color: 'var(--brand-navy)',
                        }}>
                          L{lvl?.level} — {lvl?.title}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: '600' }}>
                        {agentExempt ? (
                          <span style={{ color: '#2FA84F', fontSize: '14px', fontWeight: '600' }}>FREE</span>
                        ) : formatCurrency(lvl?.price)}
                      </td>
                      <td style={tdStyle}>{statusBadge(agentExempt ? 'exempt' : (agent.subscriptionStatus || 'none'))}</td>
                      <td style={{ ...tdStyle, fontSize: '15px', color: 'var(--text-secondary)' }}>
                        {(() => {
                          if (agentExempt) return '—';
                          if (agent.nextChargeDate) {
                            return new Date(agent.nextChargeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          }
                          // For trial agents, estimate from trialStartDate + 30 days
                          if (agent.subscriptionStatus === 'trial' && agent.trialStartDate) {
                            const trialEnd = new Date(agent.trialStartDate);
                            trialEnd.setDate(trialEnd.getDate() + 30);
                            return <span style={{ fontStyle: 'italic', opacity: 0.7 }}>~{trialEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>;
                          }
                          return <span style={{ color: 'var(--status-error, #D33F3F)', fontSize: '13px', fontWeight: 600 }}>No subscription</span>;
                        })()}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: 'rgba(10, 37, 64, 0.03)', borderTop: '2px solid var(--border-color)' }}>
                <td style={{ ...tdStyle, fontWeight: '700', color: 'var(--brand-navy)' }} colSpan={2}>
                  Total Monthly ({agencyAgents.length} agent{agencyAgents.length !== 1 ? 's' : ''})
                </td>
                <td style={{ ...tdStyle, fontWeight: '700', color: 'var(--brand-navy)', fontSize: '16px' }}>
                  {formatCurrency(agencyMonthlyTotal)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      {/* Update Card Modal */}
      {showUpdateCard && (
        <UpdateCardModal
          userProfile={userProfile}
          onClose={() => setShowUpdateCard(false)}
          onSuccess={async () => {
            setShowUpdateCard(false);
            await refreshProfile();
          }}
        />
      )}

      {/* Subscription Tiers Reference */}
      <Card>
        <h3 style={{ margin: '0 0 4px 0', color: 'var(--brand-navy)', fontSize: '17px', fontWeight: '600' }}>
          All Subscription Tiers
        </h3>
        <p style={{ margin: '0 0 var(--space-2) 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
          {isAdmin ? 'Assign levels to agents from the Team or Agent Levels settings page.' : 'Your level is assigned by your agency admin. Contact them for changes.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {AGENT_LEVELS.map(lvl => {
            const isCurrent = lvl.level === (userProfile.agentLevel || 1);
            return (
              <div key={lvl.level} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: '8px',
                backgroundColor: isCurrent ? 'rgba(10, 37, 64, 0.04)' : 'transparent',
                border: isCurrent ? '1.5px solid var(--brand-navy)' : '1px solid transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isCurrent ? 'var(--brand-navy)' : 'var(--surface-sunken, #f5f5f5)',
                    color: isCurrent ? '#fff' : 'var(--text-secondary)',
                    fontSize: '14px', fontWeight: '700',
                  }}>
                    {lvl.level}
                  </span>
                  <span style={{
                    fontSize: '16px', fontWeight: isCurrent ? '600' : '400',
                    color: isCurrent ? 'var(--brand-navy)' : 'var(--text-primary)',
                  }}>
                    {lvl.title}
                    {isCurrent && <span style={{ marginLeft: '8px', fontSize: '13px', color: '#2FA84F', fontWeight: '700' }}>YOUR PLAN</span>}
                  </span>
                </div>
                <span style={{
                  fontSize: '16px', fontWeight: '600',
                  color: isCurrent ? 'var(--brand-navy)' : 'var(--text-secondary)',
                }}>
                  ${lvl.price}/mo
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

const thStyle = { padding: '10px 16px', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.3px' };
const tdStyle = { padding: '10px 16px', fontSize: '16px' };

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      color: '#0C1022',
      '::placeholder': { color: 'rgba(0, 0, 0, 0.3)' },
      iconColor: '#0C1022',
    },
    invalid: {
      color: '#D33F3F',
      iconColor: '#D33F3F',
    },
  },
  hidePostalCode: false,
};

function UpdateCardFormInner({ userProfile, onClose, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [cardError, setCardError] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/stripe/setup-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userProfile.email,
        name: [userProfile.first_name, userProfile.middle_name, userProfile.last_name].filter(Boolean).join(' ') || userProfile.full_name,
        agentId: userProfile.uid,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.error) {
          setCardError(data.error);
        } else {
          setClientSecret(data.clientSecret);
          setCustomerId(data.customerId);
        }
        setIsInitializing(false);
      })
      .catch(() => {
        if (!cancelled) {
          setCardError('Failed to initialize payment. Please try again.');
          setIsInitializing(false);
        }
      });
    return () => { cancelled = true; };
  }, [userProfile]);

  const handleSubmit = async () => {
    if (!stripe || !elements || !clientSecret) return;

    setIsSubmitting(true);
    setCardError('');

    const cardElement = elements.getElement(CardElement);
    const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: [userProfile.first_name, userProfile.middle_name, userProfile.last_name].filter(Boolean).join(' ') || userProfile.full_name,
          email: userProfile.email,
        },
      },
    });

    if (error) {
      setCardError(error.message);
      setIsSubmitting(false);
      return;
    }

    // Update the payment method on the customer/subscription
    try {
      const res = await fetch('/api/stripe/update-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          paymentMethodId: setupIntent.payment_method,
          agentId: userProfile.uid,
        }),
      });
      const data = await res.json();

      if (data.error) {
        setCardError(data.error);
        setIsSubmitting(false);
        return;
      }

      onSuccess(data.cardLast4);
    } catch (err) {
      setCardError('Failed to update card. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
          New Card Details
        </label>
        <div style={{
          padding: '12px 16px', borderRadius: '10px',
          border: `1.5px solid ${cardError ? 'var(--status-error, #D33F3F)' : 'var(--border-color)'}`,
          backgroundColor: 'var(--surface-card, #fff)',
          transition: 'border-color 0.2s ease',
        }}>
          {isInitializing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
              <div style={{
                width: '14px', height: '14px',
                border: '2px solid var(--brand-blue-accent, #1B2A4E)', borderTopColor: 'transparent',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>Initializing secure payment...</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <CardElement
              options={CARD_ELEMENT_OPTIONS}
              onChange={(e) => {
                setCardComplete(e.complete);
                setCardError(e.error?.message || '');
              }}
            />
          )}
        </div>
        {cardError && (
          <span style={{ fontSize: '14px', color: 'var(--status-error, #D33F3F)', marginTop: '4px', display: 'block' }}>{cardError}</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Secured by <strong>Stripe</strong> — your card details are never stored on our servers
        </span>
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="small" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          size="small"
          onClick={handleSubmit}
          isLoading={isSubmitting}
          disabled={!cardComplete || isInitializing || isSubmitting}
        >
          Update Card
        </Button>
      </div>
    </div>
  );
}

function UpdateCardModal({ userProfile, onClose, onSuccess }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        backgroundColor: 'var(--surface-card, #fff)',
        borderRadius: '16px',
        padding: 'var(--space-4, 24px)',
        width: '100%',
        maxWidth: '460px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3, 16px)' }}>
          <h3 style={{ margin: 0, color: 'var(--brand-navy)', fontSize: '18px', fontWeight: '700' }}>
            Update Payment Method
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px', borderRadius: '6px', color: 'var(--text-secondary)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <Elements stripe={getStripe()}>
          <UpdateCardFormInner
            userProfile={userProfile}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        </Elements>
      </div>
    </div>
  );
}
