'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/context/UserContext';
// Using API routes instead of server actions
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'billing', label: 'Billing' },
  { value: 'technical', label: 'Technical' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_STYLES = {
  open: { bg: '#FEF3C7', color: '#92400E', label: 'Open' },
  in_progress: { bg: '#DBEAFE', color: '#1E40AF', label: 'In Progress' },
  resolved: { bg: '#D1FAE5', color: '#065F46', label: 'Resolved' },
  closed: { bg: '#F3F4F6', color: '#374151', label: 'Closed' },
};

const PRIORITY_STYLES = {
  low: { bg: '#F3F4F6', color: '#6B7280' },
  medium: { bg: '#FEF3C7', color: '#92400E' },
  high: { bg: '#FEE2E2', color: '#991B1B' },
  urgent: { bg: '#FEE2E2', color: '#7F1D1D', border: '1px solid #FCA5A5' },
};

function Badge({ style: s, children }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
      fontSize: '13px', fontWeight: 600, backgroundColor: s.bg, color: s.color,
      border: s.border || 'none',
    }}>
      {children}
    </span>
  );
}

export default function HelpDeskPage() {
  const { userProfile } = useUser();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [members, setMembers] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssigned, setFilterAssigned] = useState('all');

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'it_engineer' || userProfile?.is_owner;

  // Check access
  useEffect(() => {
    if (!userProfile?.uid) return;
    if (isAdmin) return;
    const checkAccess = async () => {
      try {
        const res = await fetch('/api/groups/mine').then(r => r.json());
        if (res.success && res.groupIds.includes('help-desk')) return;
      } catch {}
      setAccessDenied(true);
      setLoading(false);
    };
    checkAccess();
  }, [userProfile?.uid, isAdmin]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/help/tickets/all').then(r => r.json());
      if (res.success) {
        setTickets(res.tickets);
      } else if (res.error === 'Permission denied') {
        setAccessDenied(true);
      }
    } catch {}
    setLoading(false);
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/help/members').then(r => r.json());
      if (res.success) setMembers(res.members);
    } catch {}
  }, []);

  useEffect(() => {
    if (accessDenied) return;
    loadTickets();
    loadMembers();
  }, [loadTickets, loadMembers, accessDenied]);

  const handleStatusChange = async (ticketId, status) => {
    const res = await fetch('/api/help/tickets/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, status }),
    }).then(r => r.json());
    if (res.success) {
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
      await loadTickets();
    }
  };

  const handleAssign = async (ticketId, memberId) => {
    const member = members.find(m => m.id === memberId);
    const res = await fetch('/api/help/tickets/assign', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId,
        assignedTo: memberId || null,
        assignedToName: member?.name || null,
      }),
    }).then(r => r.json());
    if (res.success) {
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, assignedTo: memberId || null, assignedToName: member?.name || null });
      }
      await loadTickets();
    }
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

  if (accessDenied) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--border-color)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
          <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <h2 style={{ color: 'var(--brand-navy)', fontSize: 20, margin: '0 0 8px' }}>Access Denied</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>You need to be a Help Desk member or admin to access this page.</p>
      </div>
    );
  }

  // Filtered tickets
  const filtered = tickets.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterAssigned === 'unassigned' && t.assignedTo) return false;
    if (filterAssigned === 'mine' && t.assignedTo !== userProfile?.uid) return false;
    if (filterAssigned !== 'all' && filterAssigned !== 'unassigned' && filterAssigned !== 'mine' && t.assignedTo !== filterAssigned) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSubject = (t.subject || '').toLowerCase().includes(q);
      const matchesNumber = (t.ticketNumber || '').toLowerCase().includes(q);
      const matchesName = (t.createdByName || '').toLowerCase().includes(q);
      if (!matchesSubject && !matchesNumber && !matchesName) return false;
    }
    return true;
  });

  // Stats
  const stats = {
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    unassigned: tickets.filter(t => !t.assignedTo).length,
    urgent: tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed' && t.status !== 'resolved').length,
    total: tickets.length,
  };

  // Category breakdown
  const categoryBreakdown = CATEGORIES.map(c => ({
    ...c,
    count: tickets.filter(t => t.category === c.value && t.status !== 'closed').length,
  }));

  // Detail view
  if (selectedTicket) {
    const ss = STATUS_STYLES[selectedTicket.status] || STATUS_STYLES.open;
    const ps = PRIORITY_STYLES[selectedTicket.priority] || PRIORITY_STYLES.medium;
    return (
      <div>
        <button onClick={() => setSelectedTicket(null)} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
          fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          ← Back to all tickets
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
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{selectedTicket.ticketNumber}</span>
                  <h2 style={{ margin: '4px 0 8px', fontSize: 20, color: 'var(--brand-navy)' }}>{selectedTicket.subject}</h2>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Badge style={ps}>{selectedTicket.priority}</Badge>
                  <Badge style={ss}>{ss.label}</Badge>
                </div>
              </div>

              <p style={{ color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '12px 0' }}>
                {selectedTicket.description}
              </p>

              <div style={{ fontSize: 13, color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: 12, marginTop: 12 }}>
                <div>Submitted by: <strong>{selectedTicket.createdByName}</strong> ({selectedTicket.createdByEmail})</div>
                <div>Created: {new Date(selectedTicket.createdAt).toLocaleString()}</div>
                <div>Category: {CATEGORIES.find(c => c.value === selectedTicket.category)?.label || selectedTicket.category}</div>
              </div>
            </div>

            {/* Comments */}
            <div style={{
              backgroundColor: '#fff', borderRadius: 12, border: '1px solid var(--border-color)', padding: 24,
            }}>
              <h3 style={{ fontSize: 16, color: 'var(--brand-navy)', margin: '0 0 16px' }}>
                Comments ({(selectedTicket.comments || []).length})
              </h3>

              {(selectedTicket.comments || []).length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No comments yet.</p>
              )}

              {(selectedTicket.comments || []).map((c, i) => (
                <div key={i} style={{
                  padding: '12px 0', borderBottom: i < (selectedTicket.comments.length - 1) ? '1px solid var(--border-color)' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-navy)' }}>{c.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>{c.text}</p>
                </div>
              ))}

              {selectedTicket.status !== 'closed' && (<div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                  style={{
                    flex: 1, padding: '8px 12px', border: '1px solid var(--border-color)',
                    borderRadius: 6, fontSize: 14, outline: 'none',
                  }}
                />
                <button onClick={handleAddComment} disabled={commentLoading || !commentText.trim()} style={{
                  padding: '8px 16px', backgroundColor: 'var(--brand-gold)', color: 'var(--brand-navy)',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  opacity: commentLoading || !commentText.trim() ? 0.5 : 1,
                }}>
                  {commentLoading ? 'Sending...' : 'Send'}
                </button>
              </div>)}
            </div>
          </div>

          {/* Sidebar controls */}
          <div style={{ flex: 1, minWidth: 250 }}>
            <div style={{
              backgroundColor: '#fff', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20, marginBottom: 16,
            }}>
              <h4 style={{ fontSize: 14, color: 'var(--brand-navy)', margin: '0 0 16px', fontWeight: 600 }}>Manage Ticket</h4>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Status</label>
                <select
                  value={selectedTicket.status}
                  onChange={e => handleStatusChange(selectedTicket.id, e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)',
                    borderRadius: 8, fontSize: 13, outline: 'none', backgroundColor: '#fff',
                  }}
                >
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Assign To</label>
                <select
                  value={selectedTicket.assignedTo || ''}
                  onChange={e => handleAssign(selectedTicket.id, e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)',
                    borderRadius: 8, fontSize: 13, outline: 'none', backgroundColor: '#fff',
                  }}
                >
                  <option value="">Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              {/* Quick status buttons */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {STATUS_OPTIONS.filter(s => s.value !== selectedTicket.status).map(s => {
                  const style = STATUS_STYLES[s.value];
                  return (
                    <button key={s.value} onClick={() => handleStatusChange(selectedTicket.id, s.value)} style={{
                      padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      backgroundColor: style.bg, color: style.color, border: 'none', cursor: 'pointer',
                    }}>
                      Mark {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{
              backgroundColor: '#fff', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20,
            }}>
              <h4 style={{ fontSize: 14, color: 'var(--brand-navy)', margin: '0 0 12px', fontWeight: 600 }}>Ticket Info</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Submitted By</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedTicket.createdByName}</span>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: 12 }}>{selectedTicket.createdByEmail}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Category</span>
                  <span style={{ color: 'var(--text-primary)' }}>{CATEGORIES.find(c => c.value === selectedTicket.category)?.label}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Created</span>
                  <span style={{ color: 'var(--text-primary)' }}>{new Date(selectedTicket.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Last Updated</span>
                  <span style={{ color: 'var(--text-primary)' }}>{new Date(selectedTicket.updatedAt).toLocaleString()}</span>
                </div>
                {selectedTicket.resolvedAt && (
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Resolved</span>
                    <span style={{ color: '#065F46' }}>{new Date(selectedTicket.resolvedAt).toLocaleString()}</span>
                  </div>
                )}
                {selectedTicket.closedAt && (
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Closed</span>
                    <span style={{ color: 'var(--text-primary)' }}>{new Date(selectedTicket.closedAt).toLocaleString()}</span>
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
        title="Help Desk"
        subtitle="Manage and resolve agent support tickets"
        actions={<div style={{ display: 'flex', gap: '8px' }}><span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{members.length} team member{members.length !== 1 ? 's' : ''}</span></div>}
      />

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total', count: stats.total, color: 'var(--brand-navy)', bg: 'linear-gradient(135deg, #F8F9FA 0%, #E9ECEF 100%)', iconPath: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z' },
          { label: 'Open', count: stats.open, color: '#92400E', bg: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', iconPath: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z' },
          { label: 'In Progress', count: stats.in_progress, color: '#1E40AF', bg: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)', iconPath: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99' },
          { label: 'Resolved', count: stats.resolved, color: '#065F46', bg: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)', iconPath: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Unassigned', count: stats.unassigned, color: '#9333EA', bg: 'linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%)', iconPath: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
          { label: 'Urgent', count: stats.urgent, color: '#DC2626', bg: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)', iconPath: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '18px 22px', borderRadius: 12, background: s.bg,
            border: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer',
          }}
            onClick={() => {
              if (s.label === 'Unassigned') { setFilterAssigned('unassigned'); setFilterStatus('all'); }
              else if (s.label === 'Urgent') { setFilterPriority('urgent'); setFilterStatus('all'); }
              else if (s.label === 'Total') { setFilterStatus('all'); setFilterPriority('all'); setFilterAssigned('all'); setFilterCategory('all'); }
              else { setFilterStatus(s.label.toLowerCase().replace(' ', '_')); }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.count}</div>
                <div style={{ fontSize: 15, color: s.color, marginTop: 6, opacity: 0.8 }}>{s.label}</div>
              </div>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                <path d={s.iconPath} />
              </svg>
            </div>
          </div>
        ))}
      </div>

      {/* Two column: ticket list + sidebar */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Left: main ticket list */}
        <div style={{ flex: 3, minWidth: 400 }}>
          {/* Search and filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tickets by number, subject, or name..."
                style={{
                  width: '100%', padding: '10px 14px 10px 36px', border: '1px solid var(--border-color)',
                  borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{
              padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 14, outline: 'none', backgroundColor: '#fff',
            }}>
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{
              padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 14, outline: 'none', backgroundColor: '#fff',
            }}>
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{
              padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 14, outline: 'none', backgroundColor: '#fff',
            }}>
              <option value="all">All Priorities</option>
              {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)} style={{
              padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 14, outline: 'none', backgroundColor: '#fff',
            }}>
              <option value="all">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              <option value="mine">Assigned to Me</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {/* Active filters indicator */}
          {(filterStatus !== 'all' || filterCategory !== 'all' || filterPriority !== 'all' || filterAssigned !== 'all' || searchQuery.trim()) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Showing {filtered.length} of {tickets.length} tickets</span>
              <button onClick={() => { setFilterStatus('all'); setFilterCategory('all'); setFilterPriority('all'); setFilterAssigned('all'); setSearchQuery(''); }} style={{
                padding: '4px 12px', borderRadius: 999, fontSize: 13, backgroundColor: '#FEE2E2', color: '#991B1B',
                border: 'none', cursor: 'pointer', fontWeight: 600,
              }}>
                Clear Filters
              </button>
            </div>
          )}

          {/* Ticket table */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
              <LoadingSpinner label="Loading tickets..." />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState variant="minimal" title={tickets.length === 0 ? 'No tickets yet.' : 'No tickets match the current filters.'} />
          ) : (
            <div style={{
              backgroundColor: '#fff', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: '#FAFAFA' }}>
                    <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Ticket</th>
                    <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Subject</th>
                    <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Submitted By</th>
                    <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Priority</th>
                    <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                    <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Assigned</th>
                    <th scope="col" style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(ticket => {
                    const ss = STATUS_STYLES[ticket.status] || STATUS_STYLES.open;
                    const ps = PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.medium;
                    return (
                      <tr key={ticket.id}
                        onClick={() => setSelectedTicket(ticket)}
                        style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--brand-navy)' }}>{ticket.ticketNumber}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.subject}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{ticket.createdByName}</td>
                        <td style={{ padding: '12px 16px' }}><Badge style={ps}>{ticket.priority}</Badge></td>
                        <td style={{ padding: '12px 16px' }}><Badge style={ss}>{ss.label}</Badge></td>
                        <td style={{ padding: '12px 16px', color: ticket.assignedToName ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{ticket.assignedToName || 'Unassigned'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>{new Date(ticket.createdAt).toLocaleDateString('en-US')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ flex: 1, minWidth: 250 }}>
          {/* Category breakdown */}
          <div style={{
            backgroundColor: '#fff', borderRadius: 12, border: '1px solid var(--border-color)',
            padding: 20, marginBottom: 16,
          }}>
            <h4 style={{ fontSize: 16, color: 'var(--brand-navy)', margin: '0 0 14px', fontWeight: 600 }}>By Category</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {categoryBreakdown.map(cat => (
                <div key={cat.value}
                  onClick={() => setFilterCategory(filterCategory === cat.value ? 'all' : cat.value)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                    backgroundColor: filterCategory === cat.value ? 'rgba(201,154,61,0.1)' : 'transparent',
                    border: filterCategory === cat.value ? '1px solid rgba(201,154,61,0.3)' : '1px solid transparent',
                  }}
                >
                  <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{cat.label}</span>
                  <span style={{
                    fontSize: 13, fontWeight: 600, padding: '2px 9px', borderRadius: 999,
                    backgroundColor: cat.count > 0 ? 'rgba(201,154,61,0.15)' : '#F3F4F6',
                    color: cat.count > 0 ? 'var(--brand-navy)' : 'var(--text-secondary)',
                  }}>{cat.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Team members */}
          <div style={{
            backgroundColor: '#fff', borderRadius: 12, border: '1px solid var(--border-color)',
            padding: 20, marginBottom: 16,
          }}>
            <h4 style={{ fontSize: 16, color: 'var(--brand-navy)', margin: '0 0 14px', fontWeight: 600 }}>Help Desk Team</h4>
            {members.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>No members yet. Add members via Groups.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.map(m => {
                  const assignedCount = tickets.filter(t => t.assignedTo === m.id && t.status !== 'closed').length;
                  return (
                    <div key={m.id}
                      onClick={() => setFilterAssigned(filterAssigned === m.id ? 'all' : m.id)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                        backgroundColor: filterAssigned === m.id ? 'rgba(201,154,61,0.1)' : 'transparent',
                      }}
                    >
                      <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{m.name}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                        backgroundColor: assignedCount > 0 ? '#DBEAFE' : '#F3F4F6',
                        color: assignedCount > 0 ? '#1E40AF' : 'var(--text-secondary)',
                      }}>{assignedCount}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent urgent/high */}
          {stats.urgent > 0 && (
            <div style={{
              backgroundColor: '#fff', borderRadius: 12, border: '1px solid #FCA5A5',
              padding: 20,
            }}>
              <h4 style={{ fontSize: 16, color: '#991B1B', margin: '0 0 12px', fontWeight: 600 }}>Needs Attention</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tickets
                  .filter(t => t.priority === 'urgent' && t.status !== 'closed' && t.status !== 'resolved')
                  .slice(0, 5)
                  .map(t => (
                    <div key={t.id} role="button" tabIndex={0} onClick={() => setSelectedTicket(t)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTicket(t); } }} style={{ cursor: 'pointer', fontSize: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#991B1B', fontWeight: 600 }}>{t.ticketNumber}</span>
                        <Badge style={STATUS_STYLES[t.status]}>{STATUS_STYLES[t.status]?.label}</Badge>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
