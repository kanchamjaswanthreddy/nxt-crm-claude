"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { fetchAgentDirectory } from '@/app/actions/directory';
import { useRouter, useParams } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { db } from '@/lib/firebase/clientApp';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import CommissionWaterfall from '@/components/CommissionWaterfall';

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
      // Names and levels for the split view (display only). If a profile cannot be read, the ID is shown.
      if (oList.length > 0) {
        const dir = await fetchAgentDirectory();
        const byId = {}; (dir.success ? dir.agents : []).forEach(a => { byId[a.id] = a; });
        oList.forEach(o => { const b = byId[o.beneficiaryAgentId]; if (b) { o.beneficiaryName = dn(b); o.beneficiaryLevel = b.contractLevel || null; } });
      }
      oList.sort((a, b) => (b.beneficiaryHierarchyPath || '').length - (a.beneficiaryHierarchyPath || '').length);
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
            backgroundColor: commission.status === 'paid' ? 'rgba(47, 168, 79, 0.1)' : 'rgba(227, 169, 74, 0.1)',
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

      <CommissionWaterfall
        premium={commission.premiumAmount}
        needsReview={!!commission.needsRateReview}
        agent={{
          name: agent ? dn(agent) : 'Unknown',
          level: agent?.contractLevel || null,
          percent: commission.commissionRatePercent,
          amount: commission.commissionAmount,
          status: commission.status,
        }}
        overrides={overrides.map(o => ({
          id: o.id,
          name: o.beneficiaryName || o.beneficiaryAgentId,
          level: o.beneficiaryLevel || null,
          percent: o.overridePercent,
          amount: o.overrideAmount,
          status: o.status,
        }))}
      />
    </div>
  );
}
