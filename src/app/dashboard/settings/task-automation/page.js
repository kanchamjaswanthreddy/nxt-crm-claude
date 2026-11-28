"use client";

import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchTaskTemplates, createOrUpdateTemplate } from '@/app/actions/tasks';
import { fetchPipelineStages } from '@/app/actions/pipeline';
import { useUser } from '@/context/UserContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

export default function TaskAutomationSettings() {
  const router = useRouter();
  const { userProfile } = useUser();
  const toast = useToast();

  const [templates, setTemplates] = useState([]);
  const [stages, setStages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async (agencyId) => {
    setIsLoading(true);
    const [tRes, sRes] = await Promise.all([
      fetchTaskTemplates(agencyId),
      fetchPipelineStages()
    ]);

    if (tRes.success) setTemplates(tRes.templates);
    if (sRes.success) setStages(sRes.stages);

    setIsLoading(false);
  };

  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.role !== 'admin' && userProfile.role !== 'it_engineer') {
      router.push('/dashboard');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData(userProfile.agency_id);
  }, [userProfile, router]);

  const handleOpenEdit = (template = null) => {
    if (template) {
      setForm(template);
    } else {
      setForm({
        agencyId: userProfile.agency_id,
        triggerStageId: stages.length > 0 ? stages[0].id : '',
        taskTitle: '',
        daysUntilDue: 0,
        priority: 'medium',
        active: true
      });
    }
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    const res = await createOrUpdateTemplate(form);
    if (res.success) {
      setIsEditing(false);
      loadData(userProfile.agency_id);
    } else {
      toast.error("Failed to save template: " + res.error);
    }
    
    setIsSaving(false);
  };

  if (isLoading) return <LoadingSpinner label="Loading" />;

  const getStageName = (id) => {
    const stage = stages.find(s => s.id === id);
    return stage ? stage.name : 'Unknown Stage';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <h1 style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-h1)', margin: 0 }}>Task Automation Rules</h1>
        <Button onClick={() => handleOpenEdit()}>+ New Rule</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {templates.length === 0 ? (
          <Card style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No automation rules configured.
          </Card>
        ) : (
          templates.map(t => (
            <Card key={t.id} style={{ padding: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--brand-navy)' }}>
                  {t.taskTitle}
                </div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                  When deal enters <strong>{getStageName(t.triggerStageId)}</strong> &bull; Due in {t.daysUntilDue} days
                </div>
                {!t.active && (
                  <div style={{ marginTop: '4px', fontSize: 'var(--text-caption)', color: 'var(--status-error, #D33F3F)', fontWeight: '600' }}>
                    INACTIVE
                  </div>
                )}
              </div>
              <Button variant="secondary" onClick={() => handleOpenEdit(t)}>Edit</Button>
            </Card>
          ))
        )}
      </div>

      {isEditing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <Card style={{ width: '500px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--brand-navy)' }}>
              {form.id ? 'Edit Rule' : 'New Rule'}
            </h3>
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-caption)', fontWeight: '500' }}>Trigger Stage</label>
                <select 
                  value={form.triggerStageId} 
                  onChange={e => setForm({...form, triggerStageId: e.target.value})}
                  style={{ width: '100%', padding: 'var(--space-2)', borderRadius: '12px', border: '1px solid var(--border-color)' }}
                >
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <Input 
                label="Task Title"
                placeholder="e.g. Call {{contactName}} for follow-up"
                value={form.taskTitle}
                onChange={e => setForm({...form, taskTitle: e.target.value})}
                required
              />

              <Input 
                label="Days until due"
                type="number"
                min="0"
                value={form.daysUntilDue}
                onChange={e => setForm({...form, daysUntilDue: e.target.value})}
                required
              />

              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-caption)', fontWeight: '500' }}>Priority</label>
                <select 
                  value={form.priority} 
                  onChange={e => setForm({...form, priority: e.target.value})}
                  style={{ width: '100%', padding: 'var(--space-2)', borderRadius: '12px', border: '1px solid var(--border-color)' }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <input 
                  type="checkbox" 
                  id="active"
                  checked={form.active}
                  onChange={e => setForm({...form, active: e.target.checked})}
                />
                <label htmlFor="active" style={{ fontSize: 'var(--text-secondary)' }}>Rule is Active</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                <Button variant="secondary" onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</Button>
                <Button type="submit" isLoading={isSaving}>Save Rule</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
