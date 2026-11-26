"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCarriers } from '@/app/actions/commissions';
import { useUser } from '@/context/UserContext';
import { fetchDealsForUser, fetchAgentNameMap } from '@/app/actions/deals-data';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

const STATUS_STYLES = {
  open: { bg: 'rgba(45,111,196,0.1)', text: '#2D6FC4', label: 'Open' },
  won: { bg: 'rgba(47,168,79,0.1)', text: '#2FA84F', label: 'Renewed' },
  lost: { bg: 'rgba(211,63,63,0.1)', text: '#D33F3F', label: 'Lost' },
  pending: { bg: 'rgba(224,142,43,0.1)', text: '#E08E2B', label: 'Pending' },
};

export default function RenewalsPage() {
  const router = useRouter();
  const { userProfile } = useUser();
  const [renewals, setRenewals] = useState([]);
  const [carriers, setCarriers] = useState({});
  const [agents, setAgents] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!userProfile) return;
    setIsLoading(true);

    const [cRes, agentRes, dealsRes] = await Promise.all([
      fetchCarriers(),
      fetchAgentNameMap(),
      fetchDealsForUser({ isRenewal: true }),
    ]);

    if (cRes.success) {
      const map = {};
      cRes.carriers.forEach(c => { map[c.id] = c.name; });
      setCarriers(map);
    }
    if (agentRes.success) {
      const map = {};
      for (const [id, a] of Object.entries(agentRes.agentMap)) {
        map[id] = [a.first_name, a.middle_name, a.last_name].filter(Boolean).join(' ') || a.full_name || `${a.firstName} ${a.lastName}`.trim();
      }
      setAgents(map);
    }
    if (dealsRes.success) {
      setRenewals(dealsRes.deals);
    }
    setIsLoading(false);
  }, [userProfile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const totalPremium = renewals.reduce((sum, d) => sum + (d.premiumAmount || 0), 0);
  const wonCount = renewals.filter(d => d.status === 'won').length;

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}><LoadingSpinner label="Loading Renewals..." /></div>;

  return (
    <div>
      <PageHeader
        title="Renewals"
        actions={<button onClick={loadData} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-secondary)' }}>Refresh</button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--space-1)' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--brand-navy)' }}>{renewals.length}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Renewals</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--space-1)' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#2FA84F' }}>{wonCount}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Renewed</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--space-1)' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--brand-gold)' }}>${totalPremium.toLocaleString()}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Premium</div>
          </div>
        </Card>
      </div>

      {renewals.length === 0 ? (
        <Card>
          <EmptyState variant="minimal" title="No renewals yet" />
        </Card>
      ) : (
        <Card>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th scope="col" style={thStyle}>POLICY TYPE</th>
                <th scope="col" style={thStyle}>CARRIER</th>
                <th scope="col" style={thStyle}>AGENT</th>
                <th scope="col" style={thStyle}>PREMIUM</th>
                <th scope="col" style={thStyle}>STATUS</th>
                <th scope="col" style={thStyle}>POLICY #</th>
              </tr>
            </thead>
            <tbody>
              {renewals.map(d => {
                const st = STATUS_STYLES[d.status] || STATUS_STYLES.open;
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                    onClick={() => router.push(`/dashboard/deals/${d.id}`)}>
                    <td style={{ ...tdStyle, fontWeight: '500', textTransform: 'capitalize' }}>{d.policyType || '—'}</td>
                    <td style={tdStyle}>{carriers[d.carrierId] || '—'}</td>
                    <td style={tdStyle}>{agents[d.ownerAgentId] || '—'}</td>
                    <td style={tdStyle}>${(d.premiumAmount || 0).toLocaleString()}</td>
                    <td style={tdStyle}>
                      <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                    </td>
                    <td style={tdStyle}>{d.policyNumber || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' };
const tdStyle = { padding: '10px 12px', fontSize: '14px', color: 'var(--text-primary)' };
