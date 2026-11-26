"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { fetchCommissions, fetchCommissionOverrides, fetchCarriers } from '@/app/actions/commissions';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

export default function CommissionsHub() {
  const router = useRouter();
  const { userProfile } = useUser();
  const toast = useToast();

  const [commissions, setCommissions] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('my'); // 'my' or 'overrides'

  const loadData = useCallback(async () => {
    if (!userProfile) return;
    setIsLoading(true);
    try {
      const [cRes, oRes, carRes] = await Promise.all([
        fetchCommissions(userProfile.hierarchyPath, 'my'),
        fetchCommissionOverrides(userProfile.hierarchyPath, 'my'),
        fetchCarriers()
      ]);
      if (cRes.success) setCommissions(cRes.commissions);
      if (oRes.success) setOverrides(oRes.overrides);
      if (carRes.success) setCarriers(carRes.carriers);
    } catch (err) {
      toast.error('Failed to load commission data. Please refresh the page.');
    }
    setIsLoading(false);
  }, [userProfile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const formatCurrency = (val) => {
    if (val == null) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const getCarrierName = (id) => {
    const c = carriers.find(x => x.id === id);
    return c ? c.name : 'Unknown';
  };

  if (isLoading) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'40vh'}}><LoadingSpinner label="Loading..." /></div>;

  // Calculate YTD totals
  const totalBase = commissions.reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
  const totalOverride = overrides.reduce((sum, o) => sum + (o.overrideAmount || 0), 0);
  const totalPaid = commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.actualPaidAmount || 0), 0) +
                    overrides.filter(o => o.status === 'paid').reduce((sum, o) => sum + (o.overrideAmount || 0), 0); // Assuming override paid matches calculated

  return (
    <div>
      <PageHeader title="Commissions" subtitle="Track your personal sales and team overrides" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <Card style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-caption)', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Pending Base</p>
          <div style={{ fontSize: 'var(--text-h1)', fontWeight: '700', color: 'var(--brand-navy)' }}>
            {formatCurrency(totalBase - commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.commissionAmount || 0), 0))}
          </div>
        </Card>
        <Card style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-caption)', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Pending Overrides</p>
          <div style={{ fontSize: 'var(--text-h1)', fontWeight: '700', color: 'var(--brand-navy)' }}>
            {formatCurrency(totalOverride - overrides.filter(o => o.status === 'paid').reduce((sum, o) => sum + (o.overrideAmount || 0), 0))}
          </div>
        </Card>
        <Card style={{ textAlign: 'center', backgroundColor: 'var(--brand-navy)', color: 'white' }}>
          <p style={{ color: 'var(--brand-silver)', fontSize: 'var(--text-caption)', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Total Paid (YTD)</p>
          <div style={{ fontSize: 'var(--text-h1)', fontWeight: '700', color: 'var(--brand-gold)' }}>
            {formatCurrency(totalPaid)}
          </div>
        </Card>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-color)' }}>
        <div 
          onClick={() => setActiveTab('my')}
          style={{ padding: 'var(--space-2) 16px', cursor: 'pointer', borderBottom: activeTab === 'my' ? '2px solid var(--brand-navy)' : '2px solid transparent', fontWeight: activeTab === 'my' ? '600' : '500', color: activeTab === 'my' ? 'var(--brand-navy)' : 'var(--text-secondary)' }}
        >
          My Sales
        </div>
        <div 
          onClick={() => setActiveTab('overrides')}
          style={{ padding: 'var(--space-2) 16px', cursor: 'pointer', borderBottom: activeTab === 'overrides' ? '2px solid var(--brand-navy)' : '2px solid transparent', fontWeight: activeTab === 'overrides' ? '600' : '500', color: activeTab === 'overrides' ? 'var(--brand-navy)' : 'var(--text-secondary)' }}
        >
          My Overrides
        </div>
      </div>

      {activeTab === 'my' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Carrier</th>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Premium</th>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Rate</th>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Commission</th>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Status</th>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {commissions.length === 0 ? (
                <EmptyState variant="tableRow" colSpan={6} title="No commissions found" />
              ) : commissions.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: 'var(--space-2)', fontWeight: '500' }}>{getCarrierName(c.carrierId)}</td>
                  <td style={{ padding: 'var(--space-2)' }}>{formatCurrency(c.premiumAmount)}</td>
                  <td style={{ padding: 'var(--space-2)' }}>{c.needsRateReview ? 'Needs Review' : `${c.commissionRatePercent}%`}</td>
                  <td style={{ padding: 'var(--space-2)', fontWeight: '600' }}>
                    {c.needsRateReview ? '--' : formatCurrency(c.commissionAmount)}
                  </td>
                  <td style={{ padding: 'var(--space-2)' }}>
                    <span style={{ 
                      backgroundColor: c.status === 'paid' ? 'rgba(47, 168, 79, 0.1)' : 'rgba(227, 169, 74, 0.1)', 
                      color: c.status === 'paid' ? 'var(--status-success, #2FA84F)' : 'var(--brand-gold)', 
                      padding: '4px 12px', borderRadius: '999px', fontSize: 'var(--text-caption)', fontWeight: '600' 
                    }}>
                      {c.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={() => router.push(`/dashboard/commissions/${c.id}`)}>View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'overrides' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Deal / Commission</th>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Differential %</th>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Override Amount</th>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {overrides.length === 0 ? (
                <EmptyState variant="tableRow" colSpan={4} title="No overrides found" />
              ) : overrides.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: 'var(--space-2)', fontWeight: '500' }}>{o.dealId}</td>
                  <td style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--brand-gold)' }}>{o.overridePercent}%</td>
                  <td style={{ padding: 'var(--space-2)', fontWeight: '600' }}>{formatCurrency(o.overrideAmount)}</td>
                  <td style={{ padding: 'var(--space-2)' }}>
                    <span style={{ 
                      backgroundColor: o.status === 'paid' ? 'rgba(47, 168, 79, 0.1)' : 'rgba(227, 169, 74, 0.1)', 
                      color: o.status === 'paid' ? 'var(--status-success, #2FA84F)' : 'var(--brand-gold)', 
                      padding: '4px 12px', borderRadius: '999px', fontSize: 'var(--text-caption)', fontWeight: '600' 
                    }}>
                      {o.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
