"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { fetchPipelineStages, seedDefaultStages } from '@/app/actions/pipeline';
import { moveDealStage } from '@/app/actions/deals';
import { fetchCarriers } from '@/app/actions/commissions';
import { fetchMyDeals } from '@/app/actions/deals-data';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

export default function PipelinePage() {
  const router = useRouter();
  const { userProfile } = useUser();
  
  const [stages, setStages] = useState([]);
  const [deals, setDeals] = useState([]);
  // Coming from a stage bar on the dashboard: bring that stage's column into view.
  useEffect(() => {
    const stageId = new URLSearchParams(window.location.search).get('stage');
    if (!stageId || stages.length === 0) return;
    const col = document.querySelector(`[data-stage-id="${stageId}"]`);
    if (col) { col.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); col.style.boxShadow = '0 0 0 3px #E3A94A'; setTimeout(() => { col.style.boxShadow = ''; }, 2600); }
  }, [stages]);
  const [carriers, setCarriers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Drag and Drop state
  const [draggedDealId, setDraggedDealId] = useState(null);
  const [dragOverStageId, setDragOverStageId] = useState(null);
  const [dealsSnapshot, setDealsSnapshot] = useState(null);

  // Modals for Won/Lost
  const [wonModalOpen, setWonModalOpen] = useState(false);
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState(null); // { dealId, targetStageId, originalStageId }
  
  // Modal forms
  const [policyNumber, setPolicyNumber] = useState('');
  const [premiumAmount, setPremiumAmount] = useState('');
  const [carrierId, setCarrierId] = useState('');
  const [lostReason, setLostReason] = useState('price');
  const [lostReasonOther, setLostReasonOther] = useState('');

  const loadPipeline = useCallback(async (profile) => {
    setIsLoading(true);

    // 1. Fetch this agent's personal stages
    let res = await fetchPipelineStages();
    let currentStages = res.stages || [];

    // Seed personal stages if this agent has none yet
    if (currentStages.length === 0) {
      await seedDefaultStages();
      const refetch = await fetchPipelineStages();
      currentStages = refetch.stages || [];
    }
    setStages(currentStages.filter(s => !s.archived));

    // 2. Fetch Carriers + only MY deals in parallel
    const [cRes, dealsRes] = await Promise.all([
      fetchCarriers(),
      fetchMyDeals(),
    ]);

    if (cRes.success) {
      setCarriers(cRes.carriers.filter(c => c.active));
    }
    if (dealsRes.success) {
      setDeals(dealsRes.deals);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (userProfile) loadPipeline(userProfile);
  }, [userProfile, loadPipeline]);

  // Drag Handlers
  const handleDragStart = (e, dealId) => {
    setDraggedDealId(dealId);
    e.dataTransfer.setData('dealId', dealId);
  };

  const handleDragOver = (e, stageId) => {
    e.preventDefault(); // Necessary to allow dropping
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleDragLeave = () => {
    setDragOverStageId(null);
  };

  const handleDrop = async (e, targetStageId) => {
    e.preventDefault();
    setDragOverStageId(null);
    const dealId = draggedDealId;
    if (!dealId) return;

    const deal = deals.find(d => d.id === dealId);
    const targetStage = stages.find(s => s.id === targetStageId);
    if (!deal || !targetStage || deal.stageId === targetStageId) return;

    const originalStageId = deal.stageId;

    // Snapshot for rollback, then optimistic UI update
    const snapshot = structuredClone(deals);
    setDealsSnapshot(snapshot);
    setError(null);
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stageId: targetStageId } : d));

    // Handle Gated Stages
    if (targetStage.isWonStage) {
      setPendingMove({ dealId, targetStageId, originalStageId, deal });
      setPolicyNumber(deal.policyNumber || '');
      setPremiumAmount(deal.premiumAmount || '');
      setCarrierId(deal.carrierId || (carriers.length > 0 ? carriers[0].id : ''));
      setWonModalOpen(true);
      return;
    }
    
    if (targetStage.isLostStage) {
      setPendingMove({ dealId, targetStageId, originalStageId, deal });
      setLostReason(deal.lostReason || 'price');
      setLostReasonOther('');
      setLostModalOpen(true);
      return;
    }

    // Normal Move
    await executeMove(dealId, targetStageId, originalStageId, {});
  };

  const executeMove = async (dealId, targetStageId, originalStageId, updateData) => {
    const res = await moveDealStage(dealId, targetStageId, updateData);
    if (!res.success) {
      // Rollback to full snapshot on failure
      if (dealsSnapshot) {
        setDeals(dealsSnapshot);
        setDealsSnapshot(null);
      } else {
        setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stageId: originalStageId } : d));
      }
      setError(res.error || 'Failed to update deal stage');
    } else {
      setDealsSnapshot(null);
    }
  };

  const confirmWon = async () => {
    if (!policyNumber.trim() || !premiumAmount || !carrierId) {
      setError("Policy Number, Premium Amount, and Carrier are required for Won deals.");
      return;
    }
    const { dealId, targetStageId, originalStageId } = pendingMove;
    setWonModalOpen(false);
    
    await executeMove(dealId, targetStageId, originalStageId, {
      status: 'won',
      policyNumber,
      premiumAmount: premiumAmount ? parseFloat(premiumAmount) : null,
      carrierId
    });
    setPendingMove(null);
  };

  const confirmLost = async () => {
    const reason = lostReason === 'other' ? lostReasonOther : lostReason;
    if (!reason.trim()) {
      setError("Lost Reason is required");
      return;
    }
    const { dealId, targetStageId, originalStageId } = pendingMove;
    setLostModalOpen(false);
    
    await executeMove(dealId, targetStageId, originalStageId, {
      status: 'lost',
      lostReason: reason
    });
    setPendingMove(null);
  };

  const cancelMove = () => {
    if (dealsSnapshot) {
      setDeals(dealsSnapshot);
      setDealsSnapshot(null);
    } else if (pendingMove) {
      setDeals(prev => prev.map(d => d.id === pendingMove.dealId ? { ...d, stageId: pendingMove.originalStageId } : d));
    }
    setWonModalOpen(false);
    setLostModalOpen(false);
    setPendingMove(null);
  };

  if (isLoading) return <div>Loading pipeline...</div>;

  return (
    <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h1 style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-h1)', margin: '0 0 8px 0' }}>Deals Board</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Your deals by stage. Drag a card to move it to another stage.</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="secondary" onClick={() => { if (userProfile) loadPipeline(userProfile); }}>
            Refresh
          </Button>
          {(userProfile?.role === 'admin' || userProfile?.role === 'it_engineer') && (
            <Button variant="secondary" onClick={() => router.push('/dashboard/settings/pipeline')}>
              Pipeline Settings
            </Button>
          )}
          <Button onClick={() => router.push('/dashboard/deals/new')}>
            + New Deal
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          backgroundColor: 'var(--status-error-bg, #FEF2F2)',
          color: 'var(--status-error, #D33F3F)',
          padding: 'var(--space-2)',
          borderRadius: '12px',
          marginBottom: 'var(--space-2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '1px solid var(--status-error, #D33F3F)',
          flexShrink: 0
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-error, #D33F3F)', fontWeight: '600', fontSize: '16px' }}
          >
            X
          </button>
        </div>
      )}

      {/* Kanban Board Container */}
      <div style={{ 
        display: 'flex', 
        gap: 'var(--space-2)', 
        overflowX: 'auto', 
        flex: 1,
        paddingBottom: 'var(--space-2)' }}>
        {stages.map(stage => {
          const stageDeals = deals.filter(d => d.stageId === stage.id);
          const totalPremium = stageDeals.reduce((sum, d) => sum + (Number(d.premiumAmount) || 0), 0);
          
          return (
            <div 
              key={stage.id} 
              data-stage-id={stage.id}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
              style={{
                width: '320px',
                minWidth: '320px',
                backgroundColor: dragOverStageId === stage.id ? 'rgba(227, 169, 74, 0.05)' : 'var(--surface-card)',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                border: dragOverStageId === stage.id ? '2px dashed var(--brand-blue)' : '1px solid var(--border-color)',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              {/* Column Header */}
              <div style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                  <h3 style={{ margin: 0, fontSize: 'var(--text-secondary)', color: 'var(--brand-navy)', fontWeight: '600' }}>
                    {stage.name}
                  </h3>
                  <span style={{ fontSize: 'var(--text-caption)', backgroundColor: 'var(--surface-page)', padding: '2px 8px', borderRadius: '999px', color: 'var(--text-secondary)' }}>
                    {stageDeals.length}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--brand-gold)', fontWeight: '500' }}>
                  ${totalPremium.toLocaleString()}
                </div>
              </div>

              {/* Cards Container */}
              <div style={{ flex: 1, padding: 'var(--space-2)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {stageDeals.map(deal => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, deal.id)}
                    style={{
                      backgroundColor: 'var(--surface-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: 'var(--space-2)',
                      cursor: 'grab',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                  >
                    <Link href={`/dashboard/deals/${deal.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ fontWeight: '600', color: 'var(--brand-navy)', marginBottom: 'var(--space-1)' }}>
                        {deal.policyType ? deal.policyType.toUpperCase() : 'DEAL'}
                      </div>
                      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                        Premium: ${deal.premiumAmount || 0}
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-caption)', color: 'var(--silver)' }}>
                        <span>Status: {deal.status}</span>
                        <span>
                          {deal.stageChangedAt ? Math.floor((Date.now() - new Date(deal.stageChangedAt).getTime()) / (1000 * 3600 * 24)) : 0} days
                        </span>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Won Modal */}
      {wonModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <Card style={{ width: '400px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--status-success, #2FA84F)' }}>Mark as Won</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-caption)', fontWeight: '500' }}>Carrier *</label>
                <select 
                  value={carrierId} 
                  onChange={e => setCarrierId(e.target.value)}
                  style={{ width: '100%', padding: 'var(--space-2)', borderRadius: '12px', border: '1px solid var(--border-color)' }}
                  required
                >
                  {carriers.length === 0 && <option value="">No carriers found</option>}
                  {carriers.length > 0 && !carrierId && <option value="">-- Select a Carrier --</option>}
                  {carriers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <Input label="Policy Number *" value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} required />
              <Input label="Final Premium Amount" type="number" value={premiumAmount} onChange={e => setPremiumAmount(e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={cancelMove}>Cancel</Button>
              <Button onClick={confirmWon} disabled={!policyNumber.trim() || !carrierId}>Confirm Won</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Lost Modal */}
      {lostModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <Card style={{ width: '400px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--status-error, #D33F3F)' }}>Mark as Lost</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-caption)', fontWeight: '500' }}>Reason *</label>
                <select 
                  value={lostReason}
                  onChange={e => setLostReason(e.target.value)}
                  style={{ width: '100%', padding: 'var(--space-2)', borderRadius: '12px', border: '1px solid var(--border-color)' }}
                >
                  <option value="price">Price</option>
                  <option value="went_with_competitor">Went with Competitor</option>
                  <option value="unqualified">Unqualified</option>
                  <option value="unresponsive">Unresponsive</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {lostReason === 'other' && (
                <Input label="Please specify *" value={lostReasonOther} onChange={e => setLostReasonOther(e.target.value)} />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={cancelMove}>Cancel</Button>
              <Button variant="danger" onClick={confirmLost}>Confirm Lost</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
