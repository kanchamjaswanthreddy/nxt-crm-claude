"use client";

import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchPipelineStages, createPipelineStage, updatePipelineStage, archivePipelineStage } from '@/app/actions/pipeline';
import { useUser } from '@/context/UserContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function PipelineSettingsPage() {
  const router = useRouter();
  const { userProfile } = useUser();
  const toast = useToast();

  const [stages, setStages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });

  // New stage form
  const [newStageName, setNewStageName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const loadStages = async (profile) => {
    setIsLoading(true);
    const res = await fetchPipelineStages();
    if (res.success) {
      setStages(res.stages.filter(s => !s.archived));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.role !== 'admin' && userProfile.role !== 'it_engineer') {
      router.push('/dashboard');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStages(userProfile);
  }, [userProfile, router]);

  const handleAddStage = async (e) => {
    e.preventDefault();
    if (!newStageName.trim()) return;
    setAddError('');
    setIsAdding(true);

    const res = await createPipelineStage(userProfile.agency_id, newStageName.trim(), stages.length);
    if (res.success) {
      setNewStageName('');
      await loadStages(userProfile);
    } else {
      setAddError(res.error || 'Failed to add stage.');
    }
    setIsAdding(false);
  };

  const handleArchive = (stageId) => {
    setConfirmState({
      open: true,
      title: 'Archive Stage',
      message: 'Are you sure you want to archive this stage? It will be hidden from the board.',
      variant: 'warning',
      onConfirm: async () => {
        const res = await archivePipelineStage(stageId, userProfile.agency_id);
        if (res.success) {
          setStages(prev => prev.filter(s => s.id !== stageId));
        } else {
          toast.error(res.error);
        }
      },
    });
  };

  const moveUp = async (index) => {
    if (index === 0) return;
    const newStages = [...stages];
    const temp = newStages[index];
    newStages[index] = newStages[index - 1];
    newStages[index - 1] = temp;
    setStages(newStages);
    
    // Save orders
    await updatePipelineStage(newStages[index].id, { order: index });
    await updatePipelineStage(newStages[index - 1].id, { order: index - 1 });
  };

  const moveDown = async (index) => {
    if (index === stages.length - 1) return;
    const newStages = [...stages];
    const temp = newStages[index];
    newStages[index] = newStages[index + 1];
    newStages[index + 1] = temp;
    setStages(newStages);
    
    // Save orders
    await updatePipelineStage(newStages[index].id, { order: index });
    await updatePipelineStage(newStages[index + 1].id, { order: index + 1 });
  };

  const toggleFlag = async (stage, flagField) => {
    const newValue = !stage[flagField];
    setStages(prev => prev.map(s => s.id === stage.id ? { ...s, [flagField]: newValue } : s));
    await updatePipelineStage(stage.id, { [flagField]: newValue });
  };

  if (isLoading) return <LoadingSpinner label="Loading settings" />;

  return (
    <div>
      <button className="nxt-back" onClick={() => router.push('/dashboard/pipeline')}>
        Back to Deals Board
      </button>

      <h1 style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-h1)', margin: '0 0 24px 0' }}>Pipeline Settings</h1>
      
      <Card style={{ marginBottom: 'var(--space-3)' }}>
        <h2 style={{ fontSize: 'var(--text-body)', color: 'var(--brand-navy)', margin: '0 0 16px 0' }}>Stages</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {stages.map((stage, index) => (
            <div key={stage.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2)', border: '1px solid var(--border-color)', borderRadius: '12px', backgroundColor: 'var(--surface-page)' }}>
              <div>
                <div style={{ fontWeight: '600', color: 'var(--brand-navy)', marginBottom: '4px' }}>{stage.name}</div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={stage.isWonStage} 
                      onChange={() => toggleFlag(stage, 'isWonStage')}
                    />
                    Is Won Stage
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={stage.isLostStage} 
                      onChange={() => toggleFlag(stage, 'isLostStage')}
                    />
                    Is Lost Stage
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                <Button size="small" variant="secondary" onClick={() => moveUp(index)} disabled={index === 0}>&uarr;</Button>
                <Button size="small" variant="secondary" onClick={() => moveDown(index)} disabled={index === stages.length - 1}>&darr;</Button>
                <Button size="small" variant="danger" onClick={() => handleArchive(stage.id)}>Archive</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 style={{ fontSize: 'var(--text-body)', color: 'var(--brand-navy)', margin: '0 0 16px 0' }}>Add New Stage</h2>
        <form onSubmit={handleAddStage} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Input label="Stage Name" value={newStageName} onChange={e => setNewStageName(e.target.value)} required />
          </div>
          <Button type="submit" isLoading={isAdding}>Add</Button>
        </form>
        {addError && <p style={{ color: 'var(--status-error, #D33F3F)', fontSize: 'var(--text-caption)', marginTop: 'var(--space-1)', marginBottom: 0 }}>{addError}</p>}
      </Card>
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
