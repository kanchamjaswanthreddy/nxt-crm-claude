"use client";

import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import React, { useState, useEffect, useCallback, use } from 'react';
import { fetchAgentDirectory } from '@/app/actions/directory';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/clientApp';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useUser } from '@/context/UserContext';
import { updateDeal, fetchDealStageHistory, deleteDeal } from '@/app/actions/deals';
import { fetchPipelineStages } from '@/app/actions/pipeline';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import TaskQuickAddModal from '@/components/TaskQuickAddModal';
import Link from 'next/link';
import ExpectedCommission from '@/components/ExpectedCommission';

export default function DealDetailPage({ params }) {
  const router = useRouter();
  const { id } = use(params);
  const { userProfile } = useUser();

  const toast = useToast();

  const [deal, setDeal] = useState(null);
  const [lead, setLead] = useState(null);
  const [history, setHistory] = useState([]);
  const [stages, setStages] = useState({});
  const [agents, setAgents] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });

  const loadDeal = useCallback(async (profile) => {
    setIsLoading(true);
    try {
      const dealSnap = await getDoc(doc(db, 'deals', id));
      if (!dealSnap.exists()) {
        toast.error("Deal not found or permission denied.");
        router.push('/dashboard/deals');
        return;
      }
      
      const dData = dealSnap.data();
      setDeal({ id: dealSnap.id, ...dData });
      setEditForm({
        policyType: dData.policyType || 'other',
        premiumAmount: dData.premiumAmount || '',
        expectedCloseDate: dData.expectedCloseDate || '',
        policyNumber: dData.policyNumber || '',
        isRenewal: dData.isRenewal || false,
      });

      // Fetch Lead if attached
      if (dData.leadId) {
        const lSnap = await getDoc(doc(db, 'leads', dData.leadId));
        if (lSnap.exists()) setLead({ id: lSnap.id, ...lSnap.data() });
      }

      // Fetch History
      const hRes = await fetchDealStageHistory(id);
      if (hRes.success) setHistory(hRes.history);

      // Fetch Pipeline Stages for mapping names
      // Stages belong to each agent, so load the deal owner's stages (not the viewer's) to name them.
      const sRes = await fetchPipelineStages(dData.ownerAgentId || undefined);
      if (sRes.success) {
        const sMap = {};
        sRes.stages.forEach(s => sMap[s.id] = s.name);
        setStages(sMap);
      }

      // Fetch Agents for mapping names
      const dir = await fetchAgentDirectory();
      const aMap = {};
      (dir.success ? dir.agents : []).forEach(dd => { aMap[dd.id] = [dd.first_name, dd.middle_name, dd.last_name].filter(Boolean).join(' ') || dd.full_name || ''; });
      setAgents(aMap);

    } catch (e) {
      toast.error("Error loading deal");
    }
    setIsLoading(false);
  }, [id, router]);

  useEffect(() => {
    if (userProfile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadDeal(userProfile);
    }
  }, [id, userProfile, loadDeal]);

  const handleSave = async () => {
    const dataToSave = {
      policyType: editForm.policyType,
      premiumAmount: editForm.premiumAmount ? parseFloat(editForm.premiumAmount) : null,
      expectedCloseDate: editForm.expectedCloseDate || null,
      policyNumber: editForm.policyNumber || null,
      isRenewal: editForm.isRenewal || false
    };

    const res = await updateDeal(id, dataToSave);
    if (res.success) {
      setDeal(prev => ({ ...prev, ...dataToSave }));
      setIsEditing(false);
    } else {
      toast.error("Failed to update: " + res.error);
    }
  };

  const handleDelete = () => {
    setConfirmState({
      open: true,
      title: 'Delete Deal',
      message: 'Are you sure you want to delete this deal? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        setIsDeleting(true);
        const res = await deleteDeal(id);
        if (res.success) {
          router.push('/dashboard/deals');
        } else {
          toast.error('Failed to delete deal: ' + res.error);
          setIsDeleting(false);
        }
      },
    });
  };

  if (isLoading || !deal) return <LoadingSpinner label="Loading deal" />;

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button className="nxt-back" onClick={() => router.push('/dashboard/deals')}>
            Back to New Businesses
          </button>
          <h1 style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-h1)', margin: 0 }}>
            Deal Details
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          <Button variant="secondary" onClick={() => setIsTaskModalOpen(true)}>
            + Task
          </Button>
          <Button variant="danger"
           
            onClick={handleDelete}
            isLoading={isDeleting}
          >
            Delete
          </Button>
        </div>
      </div>

      <ExpectedCommission dealId={id} refreshKey={`${deal?.premiumAmount}|${deal?.carrierId}|${deal?.policyType}|${deal?.status}`} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginTop: '20px' }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <h2 style={{ fontSize: 'var(--text-body)', color: 'var(--brand-navy)', margin: 0 }}>Information</h2>
            {!isEditing ? (
              <Button variant="secondary" onClick={() => setIsEditing(true)}>Edit</Button>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={handleSave}>Save</Button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div>
              <label style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>Status</label>
              <div style={{ 
                display: 'inline-block', 
                marginTop: '4px',
                padding: '4px 12px', 
                borderRadius: '999px', 
                backgroundColor: deal.status === 'won' ? 'var(--status-success, #2FA84F)' : deal.status === 'lost' ? 'var(--status-error, #D33F3F)' : 'var(--brand-gold)',
                color: deal.status === 'won' || deal.status === 'lost' ? 'white' : '#0C1022',
                fontSize: 'var(--text-caption)',
                fontWeight: '600'
              }}>
                {deal.status.toUpperCase()}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>Current Stage</label>
              <div style={{ fontWeight: '500' }}>{stages[deal.stageId] || deal.stageName || 'Unknown'}</div>
            </div>

            {!isEditing ? (
              <>
                <div>
                  <label style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>Policy Type</label>
                  <div>{deal.policyType}</div>
                </div>
                <div>
                  <label style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>Premium Amount</label>
                  <div>{deal.premiumAmount ? `$${deal.premiumAmount}` : '-'}</div>
                </div>
                <div>
                  <label style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>Expected Close Date</label>
                  <div>{deal.expectedCloseDate || '-'}</div>
                </div>
                <div>
                  <label style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>Policy Number</label>
                  <div>{deal.policyNumber || '-'}</div>
                </div>
                <div>
                  <label style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>Renewal</label>
                  <div>{deal.isRenewal ? <span style={{ color: 'var(--status-success)', fontWeight: '500' }}>Yes — Renewal</span> : 'No'}</div>
                </div>
                {deal.status === 'lost' && (
                  <div>
                    <label style={{ fontSize: 'var(--text-caption)', color: 'var(--status-error, #D33F3F)' }}>Lost Reason</label>
                    <div>{deal.lostReason}</div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-caption)', fontWeight: '500' }}>Policy Type</label>
                  <select 
                    value={editForm.policyType} 
                    onChange={e => setEditForm({...editForm, policyType: e.target.value})}
                    style={{ width: '100%', padding: 'var(--space-2)', borderRadius: '12px', border: '1px solid var(--border-color)' }}
                  >
                    <option value="life">Life</option>
                    <option value="health">Health</option>
                    <option value="annuity">Annuity</option>
                    <option value="disability">Disability</option>
                    <option value="final_expense">Final Expense</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <Input label="Premium Amount" type="number" value={editForm.premiumAmount} onChange={e => setEditForm({...editForm, premiumAmount: e.target.value})} />
                <Input label="Expected Close Date" type="date" value={editForm.expectedCloseDate} onChange={e => setEditForm({...editForm, expectedCloseDate: e.target.value})} />
                <Input label="Policy Number" value={editForm.policyNumber} onChange={e => setEditForm({...editForm, policyNumber: e.target.value})} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editForm.isRenewal} onChange={e => setEditForm({...editForm, isRenewal: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                  This is a renewal of an existing policy
                </label>
              </>
            )}
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {lead && (
            <Card>
              <h2 style={{ fontSize: 'var(--text-body)', color: 'var(--brand-navy)', margin: '0 0 16px 0' }}>Associated Contact</h2>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{lead.firstName} {lead.lastName}</div>
                  <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>{lead.email || lead.phone}</div>
                </div>
                <Link className="nxt-btn nxt-btn-sm" href={`/dashboard/leads/${lead.id}`}>
                  View Lead
                </Link>
              </div>
            </Card>
          )}

          <Card>
            <h2 style={{ fontSize: 'var(--text-body)', color: 'var(--brand-navy)', margin: '0 0 16px 0' }}>Stage History</h2>
            {history.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No history available.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {history.map((h, i) => (
                  <div key={h.id} style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <div style={{ width: '2px', backgroundColor: 'var(--border-color)', position: 'relative' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: i === 0 ? 'var(--brand-gold)' : 'var(--silver)', position: 'absolute', left: '-3px', top: '4px' }}></div>
                    </div>
                    <div style={{ paddingBottom: i === history.length - 1 ? '0' : '16px' }}>
                      <div style={{ fontSize: 'var(--text-secondary)' }}>
                        {h.fromStageId ? (
                          <>Moved from <strong>{stages[h.fromStageId] || 'Unknown'}</strong> to <strong>{stages[h.toStageId] || 'Unknown'}</strong></>
                        ) : (
                          <>Created in <strong>{stages[h.toStageId] || 'Unknown'}</strong></>
                        )}
                      </div>
                      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                        by {agents[h.changedByAgentId] || 'Unknown'} • {new Date(h.changedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <TaskQuickAddModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        userProfile={userProfile}
        prefillDealId={id}
        prefillLeadId={lead?.id}
      />
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        confirmLabel={confirmState.confirmLabel || 'Confirm'}
        onConfirm={() => { setConfirmState(s => ({ ...s, open: false })); confirmState.onConfirm?.(); }}
        onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
      />
    </div>
  );
}
