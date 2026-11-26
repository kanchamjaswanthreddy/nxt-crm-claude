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

const POLICY_TYPES = ['life', 'critical', 'disability'];
const STATUS_STYLES = {
  open: { bg: 'rgba(45,111,196,0.1)', text: '#2D6FC4', label: 'Open' },
  won: { bg: 'rgba(47,168,79,0.1)', text: '#2FA84F', label: 'Completed' },
  lost: { bg: 'rgba(211,63,63,0.1)', text: '#D33F3F', label: 'Declined' },
  pending: { bg: 'rgba(224,142,43,0.1)', text: '#E08E2B', label: 'Pending' },
};

export default function InsurancePage() {
  const router = useRouter();
  const { userProfile } = useUser();
  const [deals, setDeals] = useState([]);
  const [carriers, setCarriers] = useState({});
  const [agents, setAgents] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = useCallback(async () => {
    if (!userProfile) return;
    setIsLoading(true);

    const [cRes, agentRes, dealsRes] = await Promise.all([
      fetchCarriers(),
      fetchAgentNameMap(),
      fetchDealsForUser({ policyTypes: POLICY_TYPES }),
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
      setDeals(dealsRes.deals);
    }
    setIsLoading(false);
  }, [userProfile]);

  useEffect(() => {
    (async () => { await loadData(); })();
  }, [loadData]);

  const filtered = deals.filter(deal => {
    if (statusFilter !== 'All' && deal.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const agentName = (agents[deal.ownerAgentId] || '').toLowerCase();
      const carrierName = (carriers[deal.carrierId] || '').toLowerCase();
      const policyNum = (deal.policyNumber || '').toLowerCase();
      if (!agentName.includes(term) && !carrierName.includes(term) && !policyNum.includes(term) && !deal.id.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const totalPremium = deals.reduce((s, d) => s + (d.premiumAmount || 0), 0);
  const openCount = deals.filter(d => d.status === 'open').length;
  const wonCount = deals.filter(d => d.status === 'won').length;

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}><LoadingSpinner label="Loading Insurance Deals..." /></div>;

  return (
    <div>
      <PageHeader
        title="Insurance"
        subtitle="Life, Critical Illness & Disability insurance deals"
        breadcrumbs={[{ label: 'All Deals', href: '/dashboard/deals' }, { label: 'Insurance' }]}
        actions={<button onClick={loadData} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-secondary)' }}>Refresh</button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--space-1)' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--brand-navy)' }}>{deals.length}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Deals</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--space-1)' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#2D6FC4' }}>{openCount}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Open</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--space-1)' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#2FA84F' }}>{wonCount}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Completed</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--space-1)' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--brand-gold)' }}>${totalPremium.toLocaleString()}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Premium</div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {['All', 'open', 'won', 'lost', 'pending'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '6px 16px', borderRadius: '999px', border: '1px solid var(--border-color)',
              backgroundColor: statusFilter === s ? 'var(--brand-navy)' : 'transparent',
              color: statusFilter === s ? '#fff' : 'var(--text-secondary)',
              fontSize: '13px', fontWeight: '500', cursor: 'pointer'
            }}>{s === 'All' ? 'All' : (STATUS_STYLES[s]?.label || s)}</button>
          ))}
        </div>
        <input
          type="text" placeholder="Search deals..." value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px', width: '240px' }}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState variant="minimal" title="No insurance deals found" />
        </Card>
      ) : (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th scope="col" style={thStyle}>DEAL #</th>
                  <th scope="col" style={thStyle}>POLICY TYPE</th>
                  <th scope="col" style={thStyle}>AGENT</th>
                  <th scope="col" style={thStyle}>CARRIER</th>
                  <th scope="col" style={thStyle}>PREMIUM</th>
                  <th scope="col" style={thStyle}>POLICY #</th>
                  <th scope="col" style={thStyle}>STATUS</th>
                  <th scope="col" style={thStyle}>CREATED</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(deal => {
                  const st = STATUS_STYLES[deal.status] || STATUS_STYLES.open;
                  return (
                    <tr key={deal.id} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                      onClick={() => router.push(`/dashboard/deals/${deal.id}`)}>
                      <td style={{ ...tdStyle, color: 'var(--brand-blue)', fontWeight: '500' }}>{deal.id.substring(0, 8)}</td>
                      <td style={{ ...tdStyle, textTransform: 'capitalize', fontWeight: '500' }}>{deal.policyType || '—'}</td>
                      <td style={tdStyle}>{agents[deal.ownerAgentId] || '—'}</td>
                      <td style={tdStyle}>{carriers[deal.carrierId] || '—'}</td>
                      <td style={{ ...tdStyle, fontWeight: '600' }}>${(deal.premiumAmount || 0).toLocaleString()}</td>
                      <td style={tdStyle}>{deal.policyNumber || '—'}</td>
                      <td style={tdStyle}>
                        <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                      </td>
                      <td style={tdStyle}>{deal.createdAt ? new Date(deal.createdAt).toLocaleDateString('en-US') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div style={{ marginTop: 'var(--space-2)', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
        Showing {filtered.length} of {deals.length} insurance deals
      </div>
    </div>
  );
}

const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' };
const tdStyle = { padding: '10px 12px', fontSize: '14px', color: 'var(--text-primary)' };
