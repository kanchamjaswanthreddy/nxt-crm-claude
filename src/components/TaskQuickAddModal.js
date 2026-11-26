"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { createTask, fetchAgentsForTaskAssignment } from '@/app/actions/tasks';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const dn = (a) => [a?.first_name, a?.middle_name, a?.last_name].filter(Boolean).join(' ') || a?.full_name || a?.name || a?.email || '';

export default function TaskQuickAddModal({ isOpen, onClose, userProfile, prefillLeadId = '', prefillDealId = '' }) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueAt: '',
    priority: 'medium',
    assigneeId: '',
    relatedLeadId: prefillLeadId,
    relatedDealId: prefillDealId,
  });

  const [agents, setAgents] = useState([]);
  const [agentSearch, setAgentSearch] = useState('');
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'warning' });

  const isAdmin = userProfile?.is_owner || ['admin', 'it_engineer'].includes(userProfile?.role);

  const loadAgents = useCallback(async () => {
    setAgentsLoading(true);
    try {
      const res = await fetchAgentsForTaskAssignment();
      if (res.success) setAgents(res.agents);
    } catch (e) {
      console.error('Error loading agents:', e);
    }
    setAgentsLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen && userProfile) {
      (async () => {
        setForm({
          title: '',
          description: '',
          dueAt: '',
          priority: 'medium',
          assigneeId: userProfile.uid,
          relatedLeadId: prefillLeadId,
          relatedDealId: prefillDealId,
        });
        setAgentSearch(dn(userProfile) || 'Me');
        await loadAgents();
      })();
    }
  }, [isOpen, prefillLeadId, prefillDealId, userProfile, loadAgents]);

  if (!isOpen) return null;

  const selectedAgent = agents.find(a => a.id === form.assigneeId);

  const doSubmit = async () => {
    setIsSubmitting(true);
    try {
      const assignee = agents.find(a => a.id === form.assigneeId);

      const data = {
        ownerAgentId: form.assigneeId,
        ownerAgentName: dn(assignee) || null,
        ownerHierarchyPath: assignee?.hierarchyPath || null,
        relatedLeadId: form.relatedLeadId || null,
        relatedDealId: form.relatedDealId || null,
        title: form.title,
        description: form.description,
        dueAt: form.dueAt,
        priority: form.priority,
      };

      const res = await createTask(data);
      if (res.success) {
        onClose();
      } else {
        toast.error("Error: " + res.error);
      }
    } catch (err) {
      console.error('[TaskQuickAdd] submit error:', err);
      toast.error('Something went wrong. Please try again.');
    }
    setIsSubmitting(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.dueAt) {
      toast.info("Title and Due Date are required.");
      return;
    }
    if (!form.assigneeId) {
      toast.info("Please select who this task is assigned to.");
      return;
    }

    const dueDateObj = new Date(form.dueAt);
    if (dueDateObj < new Date()) {
      setConfirmState({
        open: true,
        title: 'Past Due Date',
        message: 'The due date is in the past. Are you sure you want to create this task?',
        variant: 'warning',
        onConfirm: doSubmit,
      });
      return;
    }

    doSubmit();
  };

  const filteredAgents = agents.filter(a =>
    dn(a).toLowerCase().includes(agentSearch.toLowerCase()) ||
    a.email.toLowerCase().includes(agentSearch.toLowerCase()) ||
    a.nxt_id.toLowerCase().includes(agentSearch.toLowerCase())
  );

  const selectStyle = {
    width: '100%', padding: 'var(--space-2)', borderRadius: '12px',
    border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-card)',
    fontFamily: 'inherit', fontSize: 'var(--text-secondary)', color: 'var(--text-primary)',
  };

  const labelStyle = {
    display: 'block', marginBottom: 'var(--space-1)',
    fontSize: 'var(--text-caption)', fontWeight: '500', color: 'var(--text-primary)',
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 10000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <Card style={{ width: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--brand-navy)', fontSize: 'var(--text-h2)', fontWeight: '600' }}>
              New Task
            </h3>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: 'var(--text-caption)' }}>
              Create and assign a task to a team member
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              border: 'none', backgroundColor: 'rgba(0,0,0,0.05)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-secondary)', fontSize: '18px',
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Input
            label="Title *"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Follow up with client"
            required
          />

          {/* Assign To */}
          <div>
            <label style={labelStyle}>Assign To *</label>
            {!isAdmin ? (
              <div style={{
                ...selectStyle,
                backgroundColor: 'var(--surface-page)',
                color: 'var(--text-primary)',
              }}>
                {dn(userProfile) || 'Me'} (You)
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Search by name, email, or NXT ID..."
                  value={agentSearch}
                  onChange={e => { setAgentSearch(e.target.value); if (form.assigneeId && e.target.value !== dn(selectedAgent)) setForm({ ...form, assigneeId: '' }); }}
                  style={{ ...selectStyle, marginBottom: '4px' }}
                />
                {!form.assigneeId && agentSearch && (
                  <div style={{
                    maxHeight: '140px', overflowY: 'auto',
                    border: '1px solid var(--border-color)', borderRadius: '8px',
                    backgroundColor: 'var(--surface-card)',
                  }}>
                    {agentsLoading ? (
                      <div style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 'var(--text-caption)' }}>Loading...</div>
                    ) : filteredAgents.length === 0 ? (
                      <div style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 'var(--text-caption)' }}>No agents found</div>
                    ) : filteredAgents.map(a => (
                      <div
                        key={a.id}
                        onClick={() => { setForm({ ...form, assigneeId: a.id }); setAgentSearch(dn(a)); }}
                        style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: 'var(--text-secondary)',
                          borderBottom: '1px solid rgba(0,0,0,0.04)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}
                      >
                        <span style={{ fontWeight: '500' }}>{dn(a)}</span>
                        <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>{a.nxt_id}</span>
                      </div>
                    ))}
                  </div>
                )}
                {form.assigneeId && selectedAgent && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 12px', borderRadius: '8px',
                    backgroundColor: 'rgba(47, 168, 79, 0.08)', marginTop: '4px',
                    fontSize: 'var(--text-caption)', color: 'var(--brand-navy)',
                  }}>
                    <span style={{ fontWeight: '600' }}>{dn(selectedAgent)}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>({selectedAgent.nxt_id})</span>
                    <button
                      type="button"
                      onClick={() => { setForm({ ...form, assigneeId: '' }); setAgentSearch(''); }}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '16px' }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Due Date & Time *"
                type="datetime-local"
                value={form.dueAt}
                onChange={e => setForm({ ...form, dueAt: e.target.value })}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value })}
                style={selectStyle}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Description (Optional)</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Add details about this task..."
              style={{
                width: '100%', padding: 'var(--space-2)', borderRadius: '12px',
                border: '1px solid var(--border-color)', minHeight: '80px',
                fontFamily: 'inherit', fontSize: 'var(--text-secondary)',
                resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting} disabled={!form.assigneeId}>Create Task</Button>
          </div>
        </form>
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
