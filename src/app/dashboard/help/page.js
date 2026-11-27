'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import StatTiles from '@/components/ui/StatTiles';
import { useUser } from '@/context/UserContext';
import { storage } from '@/lib/firebase/clientApp';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
// Using API routes instead of server actions to avoid POST-to-current-page issues
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

import SegTabs from '@/components/ui/SegTabs';
const CATEGORIES = [
  { value: 'general', label: 'General', icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z' },
  { value: 'billing', label: 'Billing', icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z' },
  { value: 'technical', label: 'Technical', icon: 'M11.42 15.17l-5.1-5.1m0 0L11.42 4.97m-5.1 5.1h13.36M4.5 19.5h15' },
  { value: 'compliance', label: 'Compliance', icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z' },
  { value: 'onboarding', label: 'Onboarding', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
  { value: 'marketing', label: 'Marketing', icon: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46' },
  { value: 'other', label: 'Other', icon: 'M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_STYLES = {
  open: { bg: '#FEF3C7', color: '#92400E', label: 'Open' },
  in_progress: { bg: '#DBEAFE', color: '#1E40AF', label: 'In Progress' },
  resolved: { bg: '#D1FAE5', color: '#065F46', label: 'Resolved' },
  closed: { bg: '#F0EDE6', color: '#374151', label: 'Closed' },
};

const PRIORITY_STYLES = {
  low: { bg: '#F0EDE6', color: '#5F5C56' },
  medium: { bg: '#FEF3C7', color: '#92400E' },
  high: { bg: '#FEE2E2', color: '#991B1B' },
  urgent: { bg: '#FEE2E2', color: '#7F1D1D', border: '1px solid #FCA5A5' },
};

function Badge({ style: s, children }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
      fontSize: '15px', fontWeight: 600, backgroundColor: s.bg, color: s.color,
      border: s.border || 'none',
    }}>
      {children}
    </span>
  );
}

function CategoryIcon({ path, size = 20, color = 'var(--brand-navy)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

export default function HelpPage() {
  const { userProfile } = useUser();
  const toast = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  // Form state
  const [form, setForm] = useState({ subject: '', description: '', category: 'general', priority: 'medium' });

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/help/tickets').then(r => r.json());
      if (res.success) setTickets(res.tickets);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Upload files first
      const attachments = [];
      for (const file of files) {
        const path = `help_tickets/${userProfile.agencyId}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        attachments.push({ name: file.name, url, size: file.size, type: file.type });
      }
      const res = await fetch('/api/help/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, attachments }),
      }).then(r => r.json());
      if (res.success) {
        setForm({ subject: '', description: '', category: 'general', priority: 'medium' });
        setFiles([]);
        setShowForm(false);
        setSelectedCategory(null);
        await loadTickets();
      } else {
        toast.error(res.error || 'Failed to create ticket');
      }
    } catch (err) {
      console.error('[Help] handleSubmit error:', err);
      toast.error('Something went wrong. Please try again.');
    }
    setSubmitting(false);
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedTicket) return;
    setCommentLoading(true);
    const res = await fetch('/api/help/tickets/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: selectedTicket.id, text: commentText }),
    }).then(r => r.json());
    if (res.success) {
      setSelectedTicket({
        ...selectedTicket,
        comments: [...(selectedTicket.comments || []), res.comment],
      });
      setCommentText('');
      await loadTickets();
    }
    setCommentLoading(false);
  };

  const handleReopen = async () => {
    if (!selectedTicket) return;
    const res = await fetch('/api/help/tickets/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: selectedTicket.id, status: 'open' }),
    }).then(r => r.json());
    if (res.success) {
      setSelectedTicket({ ...selectedTicket, status: 'open' });
      await loadTickets();
    }
  };

  const handleCategoryClick = (catValue) => {
    setSelectedCategory(catValue);
    setForm({ ...form, category: catValue });
    setShowForm(true);
  };

  const filtered = filterStatus === 'all' ? tickets : tickets.filter(t => t.status === filterStatus);

  // Stats
  const stats = {
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    total: tickets.length,
  };

  // Detail view
  if (selectedTicket) {
    const ss = STATUS_STYLES[selectedTicket.status] || STATUS_STYLES.open;
    const ps = PRIORITY_STYLES[selectedTicket.priority] || PRIORITY_STYLES.medium;
    return (
      <div>
        <button className="nxt-back" onClick={() => setSelectedTicket(null)}>
          Back to Tickets
        </button>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {/* Main content */}
          <div style={{ flex: 2, minWidth: 300 }}>
            <div style={{
              backgroundColor: '#fff', borderRadius: 12, border: '1px solid var(--border-color)',
              padding: 24, marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 16 }}>{selectedTicket.ticketNumber}</span>
                  <h2 style={{ margin: '4px 0 8px', fontSize: 22, color: 'var(--brand-navy)' }}>{selectedTicket.subject}</h2>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge style={ps}>{selectedTicket.priority}</Badge>
                  <Badge style={ss}>{ss.label}</Badge>
                </div>
              </div>

              <p style={{ color: 'var(--text-primary)', fontSize: 17, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '12px 0' }}>
                {selectedTicket.description}
              </p>

              {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Attachments</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selectedTicket.attachments.map((att, i) => (
                      <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                        background: 'var(--surface-inset)', borderRadius: 6, fontSize: 15, color: 'var(--text-link)',
                        textDecoration: 'none', border: '1px solid var(--border-color)',
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                        </svg>
                        {att.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 16, fontSize: 16, color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <span>Category: {CATEGORIES.find(c => c.value === selectedTicket.category)?.label || selectedTicket.category}</span>
                <span>Created: {new Date(selectedTicket.createdAt).toLocaleDateString('en-US')}</span>
                {selectedTicket.assignedToName && <span>Assigned to: {selectedTicket.assignedToName}</span>}
              </div>

              {selectedTicket.status === 'resolved' && (
                <button className="nxt-btn" onClick={handleReopen}>
                  Reopen Ticket
                </button>
              )}
            </div>

            {/* Comments */}
            <div style={{
              backgroundColor: '#fff', borderRadius: 12, border: '1px solid var(--border-color)', padding: 24,
            }}>
              <h3 style={{ fontSize: 16, color: 'var(--brand-navy)', margin: '0 0 16px' }}>
                Comments ({(selectedTicket.comments || []).length})
              </h3>

              {(selectedTicket.comments || []).length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>No comments yet.</p>
              )}

              {(selectedTicket.comments || []).map((c, i) => (
                <div key={i} style={{
                  padding: '12px 0', borderBottom: i < (selectedTicket.comments.length - 1) ? '1px solid var(--border-color)' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--brand-navy)' }}>{c.name}</span>
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ fontSize: 16, color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>{c.text}</p>
                </div>
              ))}

              {selectedTicket.status !== 'closed' && (
                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <input
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                    style={{
                      flex: 1, padding: '8px 12px', border: '1px solid var(--border-color)',
                      borderRadius: 6, fontSize: 16, outline: 'none',
                    }}
                  />
                  <button className="nxt-btn nxt-btn-primary" onClick={handleAddComment} disabled={commentLoading || !commentText.trim()}>
                    {commentLoading ? 'Sending...' : 'Send'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{
              backgroundColor: '#fff', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20,
            }}>
              <h4 style={{ fontSize: 16, color: 'var(--brand-navy)', margin: '0 0 16px' }}>Ticket Details</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 16 }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Status</span>
                  <Badge style={ss}>{ss.label}</Badge>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Priority</span>
                  <Badge style={ps}>{selectedTicket.priority}</Badge>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Category</span>
                  <span style={{ color: 'var(--text-primary)' }}>{CATEGORIES.find(c => c.value === selectedTicket.category)?.label}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Created</span>
                  <span style={{ color: 'var(--text-primary)' }}>{new Date(selectedTicket.createdAt).toLocaleString()}</span>
                </div>
                {selectedTicket.assignedToName && (
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Assigned To</span>
                    <span style={{ color: 'var(--text-primary)' }}>{selectedTicket.assignedToName}</span>
                  </div>
                )}
                {selectedTicket.resolvedAt && (
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Resolved</span>
                    <span style={{ color: 'var(--text-primary)' }}>{new Date(selectedTicket.resolvedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="NXT Help"
        subtitle="Submit and track your support requests"
        actions={
          <button className="nxt-btn nxt-btn-primary" onClick={() => { setSelectedCategory(null); setShowForm(true); }}>
            + New Ticket
          </button>
        }
      />

      {/* Stats cards */}
      <StatTiles items={[
        { label: 'Your tickets', value: stats.total },
        { label: 'Open', value: stats.open, tone: stats.open > 0 ? 'amber' : undefined },
        { label: 'In progress', value: stats.in_progress },
        { label: 'Resolved', value: stats.resolved, tone: 'good' },
        { label: 'Closed', value: stats.closed },
      ]} />

      {/* New Ticket Form */}
      {showForm && (
        <div style={{
          backgroundColor: '#fff', borderRadius: 12, border: '1px solid var(--border-color)',
          padding: 24, marginBottom: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, color: 'var(--brand-navy)', margin: 0 }}>Create New Ticket</h2>
            <button onClick={() => { setShowForm(false); setSelectedCategory(null); }} aria-label="Close form" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-secondary)', padding: '4px 8px' }}>x</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--brand-navy)', marginBottom: 4 }}>Subject</label>
                <input
                  value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })}
                  required
                  placeholder="Brief summary of your request"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--brand-navy)', marginBottom: 4 }}>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  required
                  rows={5}
                  placeholder="Provide details about your issue or request..."
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 16, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--brand-navy)', marginBottom: 4 }}>Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 16, outline: 'none', backgroundColor: '#fff' }}
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--brand-navy)', marginBottom: 4 }}>Priority</label>
                <select
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 16, outline: 'none', backgroundColor: '#fff' }}
                >
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            {/* File upload */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--brand-navy)', marginBottom: 6 }}>Attachments (optional)</label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files)])}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', border: '1.5px dashed var(--border-color)',
                  borderRadius: 8, background: 'none', cursor: 'pointer',
                  fontSize: 15, color: 'var(--text-secondary)', fontWeight: 500,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-blue-accent)'; e.currentTarget.style.background = 'rgba(227, 169, 74,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'none'; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
                Attach files
              </button>
              {files.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {files.map((f, i) => (
                    <span key={i} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 6,
                      backgroundColor: 'rgba(227, 169, 74, 0.08)', fontSize: 14, color: 'var(--brand-navy)',
                    }}>
                      {f.name}
                      <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)', padding: 0, lineHeight: 1,
                      }}>x</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="nxt-btn" type="button" onClick={() => { setShowForm(false); setSelectedCategory(null); setFiles([]); }}>
                Cancel
              </button>
              <button className="nxt-btn nxt-btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick actions - category cards (shown when no form open) */}
      {!showForm && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 17, color: 'var(--brand-navy)', margin: '0 0 12px', fontWeight: 600 }}>Quick Submit by Category</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.value} onClick={() => handleCategoryClick(cat.value)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '20px 16px', backgroundColor: '#fff', border: '1px solid var(--border-color)',
                borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-gold)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(227, 169, 74,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(227, 169, 74,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CategoryIcon path={cat.icon} size={20} color="var(--brand-gold)" />
                </div>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--brand-navy)' }}>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Two-column layout: tickets + sidebar */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Left: Ticket list */}
        <div style={{ flex: 2, minWidth: 300 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 17, color: 'var(--brand-navy)', margin: 0, fontWeight: 600 }}>My Tickets</h3>
            <span style={{ fontSize: 16, color: 'var(--text-secondary)' }}>{filtered.length} ticket{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Filter tabs */}
          <div style={{ marginBottom: 12 }}>
            <SegTabs size="sm" label="Ticket status" value={filterStatus} onChange={setFilterStatus} tabs={[{ key: 'all', label: 'All' }, ...Object.entries(STATUS_STYLES).map(([v, st]) => ({ key: v, label: st.label, count: stats[v] > 0 ? stats[v] : undefined }))]} />
          </div>

          {/* Ticket list */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
              <LoadingSpinner label="Loading tickets..." />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              variant="minimal"
              title={tickets.length === 0 ? 'No tickets yet.' : 'No tickets match this filter.'}
              action={tickets.length === 0 ? { label: 'Create Your First Ticket', onClick: () => setShowForm(true) } : undefined}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(ticket => {
                const ss = STATUS_STYLES[ticket.status] || STATUS_STYLES.open;
                const ps = PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.medium;
                return (
                  <div key={ticket.id} role="button" tabIndex={0} onClick={() => setSelectedTicket(ticket)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTicket(ticket); } }}
                    style={{
                    backgroundColor: '#fff', borderRadius: 10, border: '1px solid var(--border-color)',
                    padding: '14px 18px', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = 'rgba(227, 169, 74,0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 500 }}>{ticket.ticketNumber}</span>
                          <Badge style={ss}>{ss.label}</Badge>
                          <Badge style={ps}>{ticket.priority}</Badge>
                        </div>
                        <h3 style={{ fontSize: 16, color: 'var(--brand-navy)', margin: '0 0 4px', fontWeight: 600 }}>{ticket.subject}</h3>
                        <p style={{ fontSize: 16, color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ticket.description}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 15, color: 'var(--text-secondary)' }}>
                        <div>{new Date(ticket.createdAt).toLocaleDateString('en-US')}</div>
                        {(ticket.comments || []).length > 0 && (
                          <div style={{ marginTop: 2 }}>{ticket.comments.length} comment{ticket.comments.length !== 1 ? 's' : ''}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <div style={{ flex: 1, minWidth: 250 }}>
          {/* How it works */}
          <div style={{
            backgroundColor: '#fff', borderRadius: 12, border: '1px solid var(--border-color)',
            padding: 20, marginBottom: 16,
          }}>
            <h4 style={{ fontSize: 16, color: 'var(--brand-navy)', margin: '0 0 14px', fontWeight: 600 }}>How It Works</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { step: '1', title: 'Submit a Ticket', desc: 'Describe your issue or request with details' },
                { step: '2', title: 'Get Assigned', desc: 'A help desk team member picks up your ticket' },
                { step: '3', title: 'Stay Updated', desc: 'Track progress and communicate via comments' },
                { step: '4', title: 'Resolution', desc: 'Ticket is resolved - reopen if needed' },
              ].map(item => (
                <div key={item.step} style={{ display: 'flex', gap: 10 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', backgroundColor: 'rgba(227, 169, 74,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    fontSize: 15, fontWeight: 700, color: 'var(--brand-gold)',
                  }}>
                    {item.step}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--brand-navy)' }}>{item.title}</div>
                    <div style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Priority guide */}
          <div style={{
            backgroundColor: '#fff', borderRadius: 12, border: '1px solid var(--border-color)',
            padding: 20, marginBottom: 16,
          }}>
            <h4 style={{ fontSize: 16, color: 'var(--brand-navy)', margin: '0 0 12px', fontWeight: 600 }}>Priority Guide</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { priority: 'urgent', desc: 'System down, blocking issue' },
                { priority: 'high', desc: 'Major impact, needs quick fix' },
                { priority: 'medium', desc: 'Moderate impact, can wait' },
                { priority: 'low', desc: 'Minor issue or question' },
              ].map(p => (
                <div key={p.priority} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge style={PRIORITY_STYLES[p.priority]}>{p.priority}</Badge>
                  <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{p.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          {tickets.length > 0 && (
            <div style={{
              backgroundColor: '#fff', borderRadius: 12, border: '1px solid var(--border-color)',
              padding: 20,
            }}>
              <h4 style={{ fontSize: 16, color: 'var(--brand-navy)', margin: '0 0 12px', fontWeight: 600 }}>Recent Activity</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tickets.slice(0, 5).map(t => (
                  <div key={t.id} role="button" tabIndex={0} onClick={() => setSelectedTicket(t)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTicket(t); } }} style={{ cursor: 'pointer', fontSize: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--brand-navy)', fontWeight: 500 }}>{t.ticketNumber}</span>
                      <Badge style={STATUS_STYLES[t.status] || STATUS_STYLES.open}>{(STATUS_STYLES[t.status] || STATUS_STYLES.open).label}</Badge>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 15, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
