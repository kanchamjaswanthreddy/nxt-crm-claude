"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { fetchNeedsReviewCommissions, resolveNeedsReview } from '@/app/actions/commissions';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

const dn = (a) => [a?.first_name, a?.middle_name, a?.last_name].filter(Boolean).join(' ') || a?.full_name || a?.name || a?.email || '';

export default function NeedsReviewQueue() {
  const router = useRouter();
  const { userProfile } = useUser();

  const [commissions, setCommissions] = useState([]);
  const [agents, setAgents] = useState({});
  const [deals, setDeals] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolvingComm, setResolvingComm] = useState(null);
  const [resolvedPercent, setResolvedPercent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const loadData = useCallback(async () => {
    if (!userProfile) return;
    setIsLoading(true);
    try {
      const res = await fetchNeedsReviewCommissions(userProfile.agency_id);
      if (res.success) {
        setCommissions(res.commissions);
        setAgents(res.agents);
        setDeals(res.deals);
      }
    } catch (err) {
      // silenced
    }
    setIsLoading(false);
  }, [userProfile]);

  useEffect(() => {
    if (userProfile) {
      if (userProfile.role !== 'admin' && userProfile.role !== 'it_engineer') {
        router.push('/dashboard');
        return;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [userProfile, router, loadData]);

  const openResolveModal = (comm) => {
    setResolvingComm(comm);
    setResolvedPercent('');
    setResolveError('');
    setResolveModalOpen(true);
  };

  const handleResolve = async (e) => {
    e.preventDefault();
    setResolveError('');
    setIsSaving(true);

    const res = await resolveNeedsReview(resolvingComm.id, resolvedPercent);
    if (res.success) {
      setResolveModalOpen(false);
      loadData();
    } else {
      setResolveError(res.error || 'Failed to resolve commission.');
    }

    setIsSaving(false);
  };

  const formatCurrency = (val) => {
    if (val == null) return '--';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  if (isLoading) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'40vh'}}><LoadingSpinner label="Loading..." /></div>;

  return (
    <div>
      <PageHeader title="Needs Review Queue" subtitle="Commissions that could not automatically find a rate schedule when the deal was won." />

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
              <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Agent</th>
              <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Policy</th>
              <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Type</th>
              <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Premium</th>
              <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {commissions.length === 0 ? (
              <EmptyState variant="tableRow" colSpan={5} title="No commissions need review" />
            ) : commissions.map(c => {
              const agentName = dn(agents[c.agentId]) || 'Unknown';
              const deal = deals[c.dealId];
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: 'var(--space-2)', fontWeight: '500' }}>{agentName}</td>
                  <td style={{ padding: 'var(--space-2)' }}>{deal?.policyNumber || 'N/A'}</td>
                  <td style={{ padding: 'var(--space-2)', color: 'var(--text-secondary)' }}>{c.policyType}</td>
                  <td style={{ padding: 'var(--space-2)', fontWeight: '500' }}>{formatCurrency(c.premiumAmount)}</td>
                  <td style={{ padding: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={() => openResolveModal(c)}>Resolve</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {resolveModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <Card style={{ width: '400px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--brand-navy)' }}>
              Resolve Rate
            </h3>
            <p style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              Agent: {dn(agents[resolvingComm.agentId])}<br/>
              Premium: {formatCurrency(resolvingComm.premiumAmount)}
            </p>
            
            <form onSubmit={handleResolve} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Input
                label="Manual Commission %"
                type="number"
                step="0.01"
                value={resolvedPercent}
                onChange={e => setResolvedPercent(e.target.value)}
                required
              />
              {resolveError && <p style={{ color: 'var(--status-error, #D33F3F)', fontSize: 'var(--text-caption)', margin: 0 }}>{resolveError}</p>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                <Button variant="secondary" onClick={() => setResolveModalOpen(false)} disabled={isSaving}>Cancel</Button>
                <Button type="submit" isLoading={isSaving}>Resolve & Recalculate</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
