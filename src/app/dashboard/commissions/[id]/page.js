"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { db } from '@/lib/firebase/clientApp';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

const dn = (a) => [a?.first_name, a?.middle_name, a?.last_name].filter(Boolean).join(' ') || a?.full_name || a?.name || a?.email || '';

export default function CommissionDetail() {
  const router = useRouter();
  const params = useParams();
  const { userProfile } = useUser();

  const [commission, setCommission] = useState(null);
  const [overrides, setOverrides] = useState([]);
  const [deal, setDeal] = useState(null);
  const [carrier, setCarrier] = useState(null);
  const [agent, setAgent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!userProfile || !params.id) return;
    setIsLoading(true);
    try {
      const commissionId = params.id;
      const commRef = doc(db, 'commissions', commissionId);
      const commSnap = await getDoc(commRef);

      if (!commSnap.exists()) {
        router.push('/dashboard/commissions');
        return;
      }

      const commData = commSnap.data();
      // Security check: Must be admin OR the agent OR in agent's upline
      if (
        userProfile.role !== 'admin' && userProfile.role !== 'it_engineer' &&
        commData.agentId !== userProfile.uid &&
        !(commData.agentHierarchyPath && commData.agentHierarchyPath.startsWith(userProfile.hierarchyPath + '/'))
      ) {
        router.push('/dashboard/commissions');
        return;
      }

      setCommission({ id: commSnap.id, ...commData });

      // Fetch Deal
      if (commData.dealId) {
        const dealSnap = await getDoc(doc(db, 'deals', commData.dealId));
        if (dealSnap.exists()) setDeal({ id: dealSnap.id, ...dealSnap.data() });
      }

      // Fetch Carrier
      if (commData.carrierId) {
        const carSnap = await getDoc(doc(db, 'carriers', commData.carrierId));
        if (carSnap.exists()) setCarrier({ id: carSnap.id, ...carSnap.data() });
      }

      // Fetch Agent
      if (commData.agentId) {
        const agSnap = await getDoc(doc(db, 'agents', commData.agentId));
        if (agSnap.exists()) setAgent({ id: agSnap.id, ...agSnap.data() });
      }

      // Fetch Overrides linked to this commission
      const overrideQuery = query(collection(db, 'commissionOverrides'), where('originatingCommissionId', '==', commissionId));
      const overrideSnap = await getDocs(overrideQuery);
      let oList = [];
      overrideSnap.forEach(d => oList.push({ id: d.id, ...d.data() }));
      setOverrides(oList);

    } catch (err) {
      // silenced
    }
    setIsLoading(false);
  }, [userProfile, params.id, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const formatCurrency = (val) => {
    if (val == null) return '--';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  if (isLoading) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'40vh'}}><LoadingSpinner label="Loading..." /></div>;
  if (!commission) return null;

  return (
    <div>
      <Button variant="secondary" onClick={() => router.back()} style={{ marginBottom: 'var(--space-3)' }}>
        ← Back
      </Button>

      <PageHeader
        title="Commission Details"
        subtitle="Transaction break-down and override tree"
        actions={
          <span style={{
            backgroundColor: commission.status === 'paid' ? 'rgba(47, 168, 79, 0.1)' : 'rgba(201, 154, 61, 0.1)',
            color: commission.status === 'paid' ? 'var(--status-success, #2FA84F)' : 'var(--brand-gold)',
            padding: '6px 16px', borderRadius: '999px', fontSize: 'var(--text-secondary)', fontWeight: '600'
          }}>
            {commission.needsRateReview ? 'NEEDS REVIEW' : commission.status.toUpperCase()}
          </span>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <Card>
          <h3 style={{ margin: '0 0 16px 0', color: 'var(--brand-navy)', fontSize: 'var(--text-body)', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-2)' }}>
            Base Commission
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Writing Agent</span>
              <span style={{ fontWeight: '500' }}>{agent ? dn(agent) : 'Unknown'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Premium Amount</span>
              <span style={{ fontWeight: '500' }}>{formatCurrency(commission.premiumAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Rate</span>
              <span style={{ fontWeight: '500' }}>{commission.needsRateReview ? 'Review Required' : `${commission.commissionRatePercent}%`}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-2)', marginTop: '4px' }}>
              <span style={{ color: 'var(--brand-navy)', fontWeight: '600' }}>Calculated Payout</span>
              <span style={{ fontWeight: '700', color: 'var(--status-success, #2FA84F)', fontSize: 'var(--text-body)' }}>
                {commission.needsRateReview ? '--' : formatCurrency(commission.commissionAmount)}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ margin: '0 0 16px 0', color: 'var(--brand-navy)', fontSize: 'var(--text-body)', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-2)' }}>
            Policy Context
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Carrier</span>
              <span style={{ fontWeight: '500' }}>{carrier ? carrier.name : 'Unknown'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Policy Number</span>
              <span style={{ fontWeight: '500' }}>{deal?.policyNumber || 'N/A'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Policy Type</span>
              <span style={{ fontWeight: '500' }}>{commission.policyType || 'N/A'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Client Name</span>
              <span style={{ fontWeight: '500' }}>{deal?.title || 'Unknown'}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: 0, color: 'var(--brand-navy)', fontSize: 'var(--text-body)' }}>Override Chain</h3>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: 'var(--text-secondary)' }}>Upline commission splits for this policy</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
              <th scope="col" style={{ padding: 'var(--space-2) 24px', fontWeight: '600', color: 'var(--text-secondary)' }}>Upline Agent ID</th>
              <th scope="col" style={{ padding: 'var(--space-2) 24px', fontWeight: '600', color: 'var(--text-secondary)' }}>Differential %</th>
              <th scope="col" style={{ padding: 'var(--space-2) 24px', fontWeight: '600', color: 'var(--text-secondary)' }}>Payout Amount</th>
              <th scope="col" style={{ padding: 'var(--space-2) 24px', fontWeight: '600', color: 'var(--text-secondary)' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {overrides.length === 0 ? (
              <EmptyState variant="tableRow" colSpan={4} title="No upline overrides generated for this policy" />
            ) : overrides.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: 'var(--space-2) 24px', fontWeight: '500' }}>{o.beneficiaryAgentId}</td>
                <td style={{ padding: 'var(--space-2) 24px', fontWeight: '600', color: 'var(--brand-gold)' }}>{o.overridePercent}%</td>
                <td style={{ padding: 'var(--space-2) 24px', fontWeight: '600' }}>{formatCurrency(o.overrideAmount)}</td>
                <td style={{ padding: 'var(--space-2) 24px' }}>
                  <span style={{ 
                    backgroundColor: o.status === 'paid' ? 'rgba(47, 168, 79, 0.1)' : 'rgba(201, 154, 61, 0.1)', 
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
    </div>
  );
}
