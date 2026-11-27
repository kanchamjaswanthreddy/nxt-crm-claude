"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchPipelineStages, seedDefaultStages } from '@/app/actions/pipeline';
import { useUser } from '@/context/UserContext';
import { createDeal } from '@/app/actions/deals';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

function NewDealForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillLeadId = searchParams.get('leadId');
  const { userProfile } = useUser();

  const toast = useToast();

  const [stages, setStages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    stageId: '',
    policyType: 'other',
    premiumAmount: '',
    expectedCloseDate: '',
    isRenewal: false,
  });

  const loadStages = useCallback(async (profile) => {
    try {
      let res = await fetchPipelineStages();
      let currentStages = res.success ? res.stages : [];

      // Seed default stages if none exist for this agent
      if (currentStages.length === 0) {
        await seedDefaultStages();
        res = await fetchPipelineStages();
        currentStages = res.success ? res.stages : [];
      }

      const active = currentStages.filter(s => !s.archived);
      setStages(active);
      if (active.length > 0) {
        setForm(prev => ({ ...prev, stageId: active[0].id }));
      }
    } catch (err) {
      // silenced
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (userProfile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadStages(userProfile);
    }
  }, [userProfile, loadStages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (!form.stageId) {
      toast.info("Please select a stage.");
      setIsSubmitting(false);
      return;
    }

    const data = {
      leadId: prefillLeadId || null,
      stageId: form.stageId,
      policyType: form.policyType,
      premiumAmount: form.premiumAmount ? parseFloat(form.premiumAmount) : null,
      expectedCloseDate: form.expectedCloseDate || null,
      isRenewal: form.isRenewal || false,
      status: 'open'
    };

    const res = await createDeal(data);
    if (res.success) {
      router.push(`/dashboard/deals/${res.id}`);
    } else {
      toast.error("Error creating deal: " + res.error);
      setIsSubmitting(false);
    }
  };

  const selectStyle = {
    width: '100%',
    padding: 'var(--space-2) 16px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--surface-card)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-secondary)',
    fontFamily: 'var(--font-base)',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 16px center',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease-in-out',
    cursor: 'pointer',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: 'var(--space-1)',
    fontSize: 'var(--text-secondary)',
    fontWeight: '500',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-base)',
  };

  if (isLoading) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'40vh'}}><LoadingSpinner label="Loading..." /></div>;

  return (
    <div>
      <button className="nxt-back" onClick={() => router.push(prefillLeadId ? `/dashboard/leads/${prefillLeadId}` : '/dashboard/deals')}>
        Back
      </button>

      <PageHeader title="Add Deal" />
      <Card>

        {prefillLeadId && (
          <div style={{ padding: 'var(--space-2)', backgroundColor: 'rgba(227, 169, 74,0.1)', color: 'var(--brand-navy)', borderRadius: '12px', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)' }}>
            This deal will be automatically linked to Lead ID: {prefillLeadId}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>

          <div style={{ marginBottom: 'var(--space-2)' }}>
            <label style={labelStyle}>Initial Stage *</label>
            <select
              value={form.stageId}
              onChange={e => setForm({...form, stageId: e.target.value})}
              style={selectStyle}
              required
            >
              <option value="" disabled>Select Stage</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 'var(--space-2)' }}>
            <label style={labelStyle}>Policy Type</label>
            <select
              value={form.policyType}
              onChange={e => setForm({...form, policyType: e.target.value})}
              style={selectStyle}
            >
              <option value="life">Life</option>
              <option value="health">Health</option>
              <option value="annuity">Annuity</option>
              <option value="disability">Disability</option>
              <option value="final_expense">Final Expense</option>
              <option value="other">Other</option>
            </select>
          </div>

          <Input
            label="Expected Premium Amount"
            type="number"
            value={form.premiumAmount}
            onChange={e => setForm({...form, premiumAmount: e.target.value})}
          />

          <Input
            label="Expected Close Date"
            type="date"
            value={form.expectedCloseDate}
            onChange={e => setForm({...form, expectedCloseDate: e.target.value})}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-secondary)', cursor: 'pointer', margin: 'var(--space-1) 0' }}>
            <input
              type="checkbox"
              checked={form.isRenewal}
              onChange={e => setForm({...form, isRenewal: e.target.checked})}
              style={{ width: '16px', height: '16px' }}
            />
            This is a renewal of an existing policy
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
            <Button type="button" variant="secondary" onClick={() => router.push(prefillLeadId ? `/dashboard/leads/${prefillLeadId}` : '/dashboard/deals')}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Create Deal</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function NewDealPage() {
  return (
    <Suspense fallback={<div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'40vh'}}><LoadingSpinner label="Loading..." /></div>}>
      <NewDealForm />
    </Suspense>
  );
}
