"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { fetchCommissions, fetchCommissionOverrides, fetchCarriers } from '@/app/actions/commissions';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import st from './commissions.module.css';

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

  // Display-only figures, built from the same totals as above.
  const pendingBase = totalBase - commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
  const pendingOverride = totalOverride - overrides.filter(o => o.status === 'paid').reduce((sum, o) => sum + (o.overrideAmount || 0), 0);
  const earned = totalBase + totalOverride;
  const baseShare = earned > 0 ? (totalBase / earned) * 100 : 0;
  const pendingCount = (list) => list.filter(x => x.status !== 'paid').length;
  const StatusPill = ({ status }) => (
    <span className={st.pill} data-paid={status === 'paid' || undefined}>{status === 'paid' ? 'Paid' : 'Pending'}</span>
  );

  return (
    <div className={st.page}>
      <PageHeader title="Commissions" subtitle="What you have earned from your own sales and from your team" />

      <div className={st.hero}>
        <section className={st.paid}>
          <span className={st.paidGlow} aria-hidden="true" />
          <p className={st.label}>Paid to you so far</p>
          <div className={st.paidValue}>{formatCurrency(totalPaid)}</div>
          <p className={st.mixTitle}>Everything earned, paid and pending</p>
          <div className={st.mix} role="img" aria-label={`${Math.round(baseShare)}% of your earnings come from your own sales`}>
            <span style={{ flexGrow: baseShare || 1 }} data-kind="base" />
            {totalOverride > 0 && <span style={{ flexGrow: 100 - baseShare }} data-kind="over" />}
          </div>
          <div className={st.mixKey}>
            <span><i data-kind="base" />Own sales {formatCurrency(totalBase)}</span>
            <span><i data-kind="over" />Team overrides {formatCurrency(totalOverride)}</span>
          </div>
        </section>

        <section className={st.tile}>
          <p className={st.label}>Waiting to be paid, own sales</p>
          <div className={st.tileValue}>{formatCurrency(pendingBase)}</div>
          <p className={st.tileNote}>{pendingCount(commissions)} {pendingCount(commissions) === 1 ? 'policy' : 'policies'} pending</p>
        </section>

        <section className={st.tile} data-tone="amber">
          <p className={st.label}>Waiting to be paid, overrides</p>
          <div className={st.tileValue}>{formatCurrency(pendingOverride)}</div>
          <p className={st.tileNote}>{pendingCount(overrides)} from your team pending</p>
        </section>
      </div>

      <div className={st.tabs} role="tablist" aria-label="Commission type">
        <button type="button" role="tab" aria-selected={activeTab === 'my'} className={st.tab} onClick={() => setActiveTab('my')}>
          My sales <b>{commissions.length}</b>
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'overrides'} className={st.tab} onClick={() => setActiveTab('overrides')}>
          My overrides <b>{overrides.length}</b>
        </button>
      </div>

      {activeTab === 'my' && (
        commissions.length === 0 ? (
          <div className={st.empty}><b>No commissions yet</b><span>When one of your deals is won, its commission appears here.</span></div>
        ) : (
          <ul className={st.list}>
            {commissions.map((c, i) => (
              <li key={c.id} style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}>
                <button type="button" className={st.row} onClick={() => router.push(`/dashboard/commissions/${c.id}`)}>
                  <span className={st.cellMain}>
                    <b>{getCarrierName(c.carrierId)}</b>
                    <small>Premium {formatCurrency(c.premiumAmount)}</small>
                  </span>
                  <span className={st.cellRate}>
                    {c.needsRateReview ? (
                      <em className={st.review}>Needs review</em>
                    ) : (
                      <>
                        <span className={st.meter}><span style={{ width: `${Math.min(100, c.commissionRatePercent || 0)}%` }} /></span>
                        <small>{c.commissionRatePercent}% rate</small>
                      </>
                    )}
                  </span>
                  <span className={st.cellAmt}>{c.needsRateReview ? '--' : formatCurrency(c.commissionAmount)}</span>
                  <StatusPill status={c.status} />
                  <span className={st.go}>See the split</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {activeTab === 'overrides' && (
        overrides.length === 0 ? (
          <div className={st.empty}><b>No overrides yet</b><span>When someone on your team wins a deal at a lower rate than yours, your share appears here.</span></div>
        ) : (
          <ul className={st.list}>
            {overrides.map((o, i) => (
              <li key={o.id} style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}>
                <button type="button" className={st.row} disabled={!o.originatingCommissionId} onClick={() => o.originatingCommissionId && router.push(`/dashboard/commissions/${o.originatingCommissionId}`)}>
                  <span className={st.cellMain}>
                    <b>Team sale</b>
                    <small>Deal {o.dealId}</small>
                  </span>
                  <span className={st.cellRate}>
                    <span className={st.meter} data-tone="amber"><span style={{ width: `${Math.min(100, o.overridePercent || 0)}%` }} /></span>
                    <small>+{o.overridePercent}% difference</small>
                  </span>
                  <span className={st.cellAmt}>{formatCurrency(o.overrideAmount)}</span>
                  <StatusPill status={o.status} />
                  <span className={st.go}>{o.originatingCommissionId ? 'See the split' : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
