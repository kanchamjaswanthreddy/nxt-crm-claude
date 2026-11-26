"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { fetchCommissions } from '@/app/actions/commissions';
import { useUser } from '@/context/UserContext';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

export default function TrailCommissionsPage() {
  const { userProfile } = useUser();
  const [commissions, setCommissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!userProfile) return;
    setIsLoading(true);
    const viewType = (userProfile.role === 'admin' || userProfile.role === 'it_engineer') ? 'admin' : 'my';
    const res = await fetchCommissions(userProfile.hierarchyPath, viewType);
    if (res.success) {
      // Filter for trail commissions (commissionType === 'trail')
      const trail = res.commissions.filter(c => c.commissionType === 'trail');
      setCommissions(trail);
    }
    setIsLoading(false);
  }, [userProfile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const totalTrail = commissions.reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
  const paidTrail = commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
  const pendingTrail = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.commissionAmount || 0), 0);

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}><LoadingSpinner label="Loading Trail Commissions..." /></div>;

  return (
    <div>
      <PageHeader title="Trail Commissions" />

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--space-1)' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--brand-navy)' }}>${totalTrail.toLocaleString()}</div>
            <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Total Trail</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--space-1)' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#2FA84F' }}>${paidTrail.toLocaleString()}</div>
            <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Paid</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--space-1)' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#E08E2B' }}>${pendingTrail.toLocaleString()}</div>
            <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Pending</div>
          </div>
        </Card>
      </div>

      {commissions.length === 0 ? (
        <Card>
          <EmptyState variant="minimal" title="No trail commissions yet" />
        </Card>
      ) : (
        <Card>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th scope="col" style={thStyle}>POLICY</th>
                <th scope="col" style={thStyle}>CARRIER</th>
                <th scope="col" style={thStyle}>PREMIUM</th>
                <th scope="col" style={thStyle}>RATE</th>
                <th scope="col" style={thStyle}>COMMISSION</th>
                <th scope="col" style={thStyle}>STATUS</th>
                <th scope="col" style={thStyle}>DATE</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ ...tdStyle, fontWeight: '500' }}>{c.policyType || '—'}</td>
                  <td style={tdStyle}>{c.carrierId || '—'}</td>
                  <td style={tdStyle}>${(c.premiumAmount || 0).toLocaleString()}</td>
                  <td style={tdStyle}>{c.commissionRatePercent || 0}%</td>
                  <td style={{ ...tdStyle, fontWeight: '600', color: 'var(--brand-navy)' }}>${(c.commissionAmount || 0).toLocaleString()}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '999px', fontSize: '14px', fontWeight: '600',
                      backgroundColor: c.status === 'paid' ? 'rgba(47,168,79,0.1)' : 'rgba(224,142,43,0.1)',
                      color: c.status === 'paid' ? '#2FA84F' : '#E08E2B',
                    }}>{c.status}</span>
                  </td>
                  <td style={tdStyle}>{c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' };
const tdStyle = { padding: '10px 12px', fontSize: '16px', color: 'var(--text-primary)' };
