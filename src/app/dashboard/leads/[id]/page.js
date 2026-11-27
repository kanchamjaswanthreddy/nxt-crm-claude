"use client";

import React, { useState, useEffect } from 'react';
import { fetchAgentDirectory } from '@/app/actions/directory';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/clientApp';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { useUser } from '@/context/UserContext';
import { reassignLead, addLeadNote, updateLeadStatus, updateLeadFields, exportContactData, anonymizeContact } from '@/app/actions/leads';
import { createTask, updateTaskStatus } from '@/app/actions/tasks';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AgentSearchSelect from '@/components/AgentSearchSelect';
import TaskQuickAddModal from '@/components/TaskQuickAddModal';
import ActivityTimeline from '@/components/ui/ActivityTimeline';
import { useToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const dn = (a) => [a?.first_name, a?.middle_name, a?.last_name].filter(Boolean).join(' ') || a?.full_name || a?.name || a?.email || '';

export default function LeadDetailPage({ params }) {
  const { id } = React.use(params);
  const router = useRouter();
  const { userProfile } = useUser();
  const toast = useToast();

  const [lead, setLead] = useState(null);
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [isAnonymizing, setIsAnonymizing] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });

  useEffect(() => {
    if (!userProfile || !id) return;

    // Listen to Lead
    const leadRef = doc(db, 'leads', id);
    const unsubLead = onSnapshot(leadRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLead({ id: docSnap.id, ...data });
        setEditForm({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email || '',
          phone: data.phone || ''
        });
      } else {
        router.push('/dashboard/leads'); // Not found or no access
      }
      setIsLoading(false);
    }, (error) => {
      console.error('[LeadDetail] onSnapshot error:', error);
      setLoadError(error?.code === 'permission-denied'
        ? 'You do not have permission to view this lead.'
        : (error?.message || 'Failed to load lead.'));
      setIsLoading(false);
    });

    // Fetch notes
    const fetchNotes = async () => {
      try {
        const q = query(collection(db, 'leadNotes'), where('leadId', '==', id));
        const snap = await getDocs(q);
        const fetchedNotes = [];
        snap.forEach(d => {
          fetchedNotes.push({ id: d.id, ...d.data() });
        });
        // Sort newest first manually since we can't easily orderBy without composite index initially
        fetchedNotes.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        setNotes(fetchedNotes);
      } catch (e) {
        // silenced
      }
    };
    fetchNotes();

    return () => unsubLead();
  }, [id, userProfile, router]);

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await updateLeadStatus(id, newStatus);
      if (!res.success) throw new Error(res.error);
    } catch (error) {
      // silenced
    }
  };

  const handleSaveEdit = async () => {
    setEditError('');
    if (!editForm.firstName || !editForm.lastName) {
      setEditError('First name and last name are required.');
      return;
    }
    if (!editForm.email && !editForm.phone) {
      setEditError('At least one of email or phone is required.');
      return;
    }
    setIsSavingEdit(true);
    const res = await updateLeadFields(id, editForm);
    if (res.success) {
      setIsEditing(false);
    } else {
      setEditError(res.error || 'Failed to save changes.');
    }
    setIsSavingEdit(false);
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setIsAddingNote(true);
    
    const res = await addLeadNote(id, newNote);
    if (res.success) {
      setNotes([{
        id: res.id,
        leadId: id,
        authorAgentId: userProfile.uid,
        body: newNote,
        createdAt: { toMillis: () => Date.now(), toDate: () => new Date() } // optimistic
      }, ...notes]);
      setNewNote('');
    }
    setIsAddingNote(false);
  };

  const loadAgentsForReassign = async () => {
    try {
      const dir = await fetchAgentDirectory();
      const fetched = (dir.success ? dir.agents : []).filter(a => a.status === 'active');
      setAgents(fetched);
    } catch (e) {
      // silenced
    }
  };

  const handleOpenReassign = () => {
    setIsReassignModalOpen(true);
    if (agents.length === 0) loadAgentsForReassign();
  };

  const executeReassign = async () => {
    if (!selectedAgentId) return;
    const selectedAgent = agents.find(a => a.id === selectedAgentId);
    if (!selectedAgent) return;

    setIsReassigning(true);
    const res = await reassignLead(id, selectedAgent.id, selectedAgent.hierarchyPath);
    if (res.success) {
      setIsReassignModalOpen(false);
      setSelectedAgentId('');
    } else {
      toast.error("Failed to reassign: " + res.error);
    }
    setIsReassigning(false);
  };

  const handleExport = async () => {
    setIsExporting(true);
    const res = await exportContactData(id);
    if (res.success) {
      const blob = new Blob([res.payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lead_export_${id}.json`;
      a.click();
    } else {
      toast.error("Failed to export: " + res.error);
    }
    setIsExporting(false);
  };

  const handleAnonymize = () => {
    setConfirmState({
      open: true,
      title: 'Anonymize Contact',
      message: 'Are you sure you want to anonymize this contact? This will irreversibly remove their PII. Deals and financial records will be preserved without personal identifiers.',
      variant: 'danger',
      onConfirm: async () => {
        setIsAnonymizing(true);
        const res = await anonymizeContact(id);
        if (res.success) {
          toast.success("Contact anonymized successfully.");
          router.push('/dashboard/leads');
        } else {
          toast.error("Failed to anonymize: " + res.error);
          setIsAnonymizing(false);
        }
      },
    });
  };

  if (isLoading) return <div>Loading...</div>;
  if (loadError || !lead) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: '12px', padding: '32px' }}>
      <h2 style={{ color: 'var(--brand-navy)', fontSize: '20px' }}>Unable to load lead</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '16px', textAlign: 'center', maxWidth: '400px' }}>{loadError || 'Lead not found.'}</p>
      <button className="nxt-btn" onClick={() => router.push('/dashboard/leads')}>Back to Leads</button>
    </div>
  );

  const canReassign = userProfile?.role === 'admin' || userProfile?.role === 'it_engineer';

  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return 'var(--brand-gold)';
      case 'contacted': return 'var(--brand-blue)';
      case 'qualified': return 'var(--status-success, #2FA84F)';
      case 'client': return 'var(--brand-navy)';
      default: return 'var(--silver)';
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button className="nxt-back" onClick={() => router.push('/dashboard/leads')}>
            Back to Leads
          </button>
          <h1 data-plain style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-h1)', margin: 0 }}>
            {lead.firstName} {lead.lastName}
          </h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={lead.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            style={{
              backgroundColor: getStatusColor(lead.status),
              color: '#fff',
              border: 'none',
              borderRadius: '999px',
              height: '44px',
              padding: '0 24px',
              fontWeight: '600',
              fontSize: 'var(--text-secondary)',
              cursor: 'pointer',
              appearance: 'none',
              WebkitAppearance: 'none',
              textTransform: 'capitalize',
              lineHeight: '44px',
            }}
          >
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="no_answer">No Answer</option>
            <option value="qualified">Qualified</option>
            <option value="not_interested">Not Interested</option>
            <option value="client">Client</option>
            <option value="lost">Lost</option>
          </select>
          
          {canReassign && (
            <Button variant="secondary" onClick={handleOpenReassign}>
              Reassign
            </Button>
          )}
          <Button variant="secondary" onClick={() => setIsTaskModalOpen(true)}>
            + Task
          </Button>
          <Button variant="secondary" onClick={() => {
            const params = new URLSearchParams();
            if (lead.firstName) params.set('firstName', lead.firstName);
            if (lead.lastName) params.set('lastName', lead.lastName);
            if (lead.email) params.set('email', lead.email);
            if (lead.phone) params.set('phone', lead.phone);
            if (lead.dateOfBirth) params.set('dateOfBirth', lead.dateOfBirth);
            if (lead.address?.city) params.set('city', lead.address.city);
            if (lead.address?.state) params.set('state', lead.address.state);
            params.set('fromLead', id);
            router.push(`/dashboard/clients/new?${params.toString()}`);
          }}>
            Convert to Client
          </Button>
          <Button onClick={() => router.push(`/dashboard/deals/new?leadId=${id}`)}>
            Convert to Deal
          </Button>
        </div>
      </div>

      {isReassignModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <Card style={{ width: '400px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--brand-navy)' }}>Reassign Lead</h3>
            <p style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              Select an agent to reassign this lead to.
            </p>
            <AgentSearchSelect
              items={agents}
              value={selectedAgentId}
              onChange={(id) => setSelectedAgentId(id)}
              placeholder="Search agent by name..."
              style={{ marginBottom: 'var(--space-3)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => setIsReassignModalOpen(false)} disabled={isReassigning}>Cancel</Button>
              <Button onClick={executeReassign} isLoading={isReassigning} disabled={!selectedAgentId}>Confirm Reassign</Button>
            </div>
          </Card>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <h3 style={{ margin: 0, color: 'var(--brand-navy)' }}>Contact Info</h3>
            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
              <button className="nxt-btn nxt-btn-sm" 
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
              {(userProfile?.role === 'admin' || userProfile?.role === 'it_engineer') && (
                <>
                  <button className="nxt-btn nxt-btn-sm" onClick={handleExport} disabled={isExporting}>
                    {isExporting ? '...' : 'Export'}
                  </button>
                  <button className="nxt-btn nxt-btn-sm nxt-btn-danger" onClick={handleAnonymize} disabled={isAnonymizing}>
                    Anonymize
                  </button>
                </>
              )}
            </div>
          </div>
          
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Input label="First Name *" value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})} />
              <Input label="Last Name *" value={editForm.lastName} onChange={e => setEditForm({...editForm, lastName: e.target.value})} />
              <Input label="Email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
              <Input label="Phone" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
              {editError && <p style={{ color: 'var(--status-error, #D33F3F)', fontSize: 'var(--text-caption)', margin: 0 }}>{editError}</p>}
              <Button onClick={handleSaveEdit} isLoading={isSavingEdit}>Save Changes</Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>Email</span>
                <div style={{ fontWeight: '500' }}>{lead.email || '--'}</div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>Phone</span>
                <div style={{ fontWeight: '500' }}>{lead.phone || '--'}</div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>State</span>
                <div style={{ fontWeight: '500' }}>{lead.address?.state || '--'}</div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>Source</span>
                <div style={{ fontWeight: '500', textTransform: 'capitalize' }}>{lead.source?.replace('_', ' ')}</div>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h3 style={{ margin: '0 0 16px 0', color: 'var(--brand-navy)' }}>Activity</h3>

          <form onSubmit={handleAddNote} style={{ marginBottom: 'var(--space-3)' }}>
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Add a note..."
              style={{
                width: '100%',
                padding: 'var(--space-2)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--surface-page)',
                fontFamily: 'inherit',
                minHeight: '80px',
                resize: 'vertical',
                marginBottom: 'var(--space-1)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" isLoading={isAddingNote} disabled={!newNote.trim()}>
                Save Note
              </Button>
            </div>
          </form>

          <ActivityTimeline
            events={[
              ...notes.map(note => ({
                id: note.id,
                type: 'note',
                title: note.body,
                createdAt: note.createdAt?.toDate ? note.createdAt.toDate().toISOString() : new Date().toISOString(),
                actor: note.authorAgentId === 'system' ? 'System' : 'Agent',
              })),
              ...(lead.createdAt ? [{
                id: 'created',
                type: 'created',
                title: 'Lead created',
                description: lead.source ? `Source: ${lead.source.replace('_', ' ')}` : undefined,
                createdAt: lead.createdAt?.toDate ? lead.createdAt.toDate().toISOString() : null,
              }] : []),
            ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))}
          />
        </Card>
      </div>
      <TaskQuickAddModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        userProfile={userProfile}
        prefillLeadId={id}
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
