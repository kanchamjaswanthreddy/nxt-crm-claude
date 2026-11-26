"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/context/UserContext';
import { fetchAllAgencyDocuments } from '@/app/actions/documents';
import { getDocumentViewUrl } from '@/app/actions/documents';
import { approveDocument, rejectDocument } from '@/app/actions/agents';
import { fetchMyGroups } from '@/app/actions/groups';
import { getDocTypeLabel, HIDDEN_DOC_TYPES } from '@/lib/documentTypes';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_BADGE = {
  pending_review: { bg: '#FFF3CD', color: '#856404', label: 'Pending Review' },
  approved: { bg: '#D4EDDA', color: '#155724', label: 'Approved' },
  rejected: { bg: '#F8D7DA', color: '#721C24', label: 'Rejected' },
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminDocumentsPage() {
  const { userProfile } = useUser();
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const [searchQuery, setSearchQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('all');

  // Action states
  const [actionLoading, setActionLoading] = useState(null);
  const [viewLoading, setViewLoading] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const [isTeamLeader, setIsTeamLeader] = useState(false);
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'it_engineer' || userProfile?.is_owner;
  const canReview = isAdmin || isTeamLeader;

  // Check team leader status for non-admins
  useEffect(() => {
    if (!userProfile?.uid || isAdmin) return;
    (async () => {
      const res = await fetchMyGroups();
      if (res.success) {
        const groupIds = res.groups.map(g => g.groupId);
        setIsTeamLeader(groupIds.includes('team-leaders'));
      }
    })();
  }, [userProfile?.uid, isAdmin]);

  const loadDocuments = useCallback(async () => {
    if (!userProfile?.uid || !userProfile?.agency_id || !canReview) return;
    setIsLoading(true);
    setError(null);
    const result = await fetchAllAgencyDocuments();
    if (result.success) {
      setDocuments(result.documents);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  }, [userProfile?.uid, userProfile?.agency_id, canReview]);

  useEffect(() => {
    (async () => { await loadDocuments(); })();
  }, [loadDocuments]);

  // Derived: unique doc types for filter dropdown (exclude legacy hidden types)
  const docTypes = [...new Set(documents.map(d => d.docType))]
    .filter(dt => !HIDDEN_DOC_TYPES.includes(dt))
    .sort();

  // Filtered documents
  const filtered = documents.filter(doc => {
    if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
    if (docTypeFilter !== 'all' && doc.docType !== docTypeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = doc.agentName?.toLowerCase().includes(q);
      const matchesNxtId = doc.agentNxtId?.toLowerCase().includes(q);
      const matchesEmail = doc.agentEmail?.toLowerCase().includes(q);
      const matchesFile = doc.fileName?.toLowerCase().includes(q);
      if (!matchesName && !matchesNxtId && !matchesEmail && !matchesFile) return false;
    }
    return true;
  });

  // Counts
  const pendingCount = documents.filter(d => d.status === 'pending_review').length;
  const approvedCount = documents.filter(d => d.status === 'approved').length;
  const rejectedCount = documents.filter(d => d.status === 'rejected').length;

  async function handleView(docId) {
    setViewLoading(docId);
    const result = await getDocumentViewUrl(docId);
    if (result.success) {
      window.open(result.viewUrl, '_blank');
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to get document URL.' });
    }
    setViewLoading(null);
  }

  async function handleApprove(docId) {
    setActionLoading(docId);
    setMessage(null);
    const result = await approveDocument(docId);
    if (result.success) {
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: 'approved', reviewedBy: userProfile.uid } : d));
      setMessage({ type: 'success', text: 'Document approved.' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to approve.' });
    }
    setActionLoading(null);
  }

  async function handleReject(docId) {
    if (!rejectReason.trim()) {
      setMessage({ type: 'error', text: 'Please provide a rejection reason.' });
      return;
    }
    setActionLoading(docId);
    setMessage(null);
    const result = await rejectDocument(docId, rejectReason);
    if (result.success) {
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: 'rejected', rejectionReason: rejectReason } : d));
      setRejectingId(null);
      setRejectReason('');
      setMessage({ type: 'success', text: 'Document rejected.' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to reject.' });
    }
    setActionLoading(null);
  }

  if (!canReview) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--brand-navy)', fontSize: '20px', fontWeight: '700' }}>Access Denied</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Only admins, IT engineers, and team leaders can access this page.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Document Review"
        subtitle="Review all documents uploaded by agents across your agency."
      />

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <Card style={{ padding: '16px', textAlign: 'center', cursor: 'pointer', border: statusFilter === 'pending_review' ? '2px solid var(--brand-gold)' : undefined }}
          onClick={() => setStatusFilter('pending_review')}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#856404' }}>{pendingCount}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Pending Review</div>
        </Card>
        <Card style={{ padding: '16px', textAlign: 'center', cursor: 'pointer', border: statusFilter === 'approved' ? '2px solid var(--brand-gold)' : undefined }}
          onClick={() => setStatusFilter('approved')}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#155724' }}>{approvedCount}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Approved</div>
        </Card>
        <Card style={{ padding: '16px', textAlign: 'center', cursor: 'pointer', border: statusFilter === 'rejected' ? '2px solid var(--brand-gold)' : undefined }}
          onClick={() => setStatusFilter('rejected')}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#721C24' }}>{rejectedCount}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Rejected</div>
        </Card>
      </div>

      {/* Filters */}
      <Card style={{ padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search by agent name, NXT ID, email, or file name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              flex: '1 1 240px',
              padding: '8px 12px',
              border: '1px solid rgba(0,0,0,0.15)',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid rgba(0,0,0,0.15)',
              borderRadius: '6px',
              fontSize: '14px',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={docTypeFilter}
            onChange={e => setDocTypeFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid rgba(0,0,0,0.15)',
              borderRadius: '6px',
              fontSize: '14px',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Types</option>
            {docTypes.map(dt => (
              <option key={dt} value={dt}>{getDocTypeLabel(dt)}</option>
            ))}
          </select>
          <button
            onClick={() => { setStatusFilter('all'); setDocTypeFilter('all'); setSearchQuery(''); }}
            style={{
              padding: '8px 12px',
              border: '1px solid rgba(0,0,0,0.15)',
              borderRadius: '6px',
              fontSize: '13px',
              background: '#fff',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            Clear Filters
          </button>
        </div>
      </Card>

      {/* Messages */}
      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          backgroundColor: message.type === 'success' ? '#D4EDDA' : '#F8D7DA',
          color: message.type === 'success' ? '#155724' : '#721C24',
          fontSize: '14px',
        }}>
          {message.text}
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          backgroundColor: '#F8D7DA',
          color: '#721C24',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {/* Documents Table */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
          <LoadingSpinner label="Loading documents..." />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState variant="minimal" title={documents.length === 0 ? 'No documents uploaded yet.' : 'No documents match the current filters.'} />
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(0,0,0,0.03)', borderBottom: '2px solid rgba(0,0,0,0.08)' }}>
                  <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--brand-navy)', whiteSpace: 'nowrap' }}>Agent</th>
                  <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--brand-navy)', whiteSpace: 'nowrap' }}>Document Type</th>
                  <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--brand-navy)', whiteSpace: 'nowrap' }}>File</th>
                  <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--brand-navy)', whiteSpace: 'nowrap' }}>Status</th>
                  <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--brand-navy)', whiteSpace: 'nowrap' }}>Uploaded</th>
                  <th scope="col" style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: 'var(--brand-navy)', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(doc => {
                  const badge = STATUS_BADGE[doc.status] || { bg: '#eee', color: '#666', label: doc.status };
                  const isRejecting = rejectingId === doc.id;

                  return (
                    <React.Fragment key={doc.id}>
                      <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: '600', color: 'var(--brand-navy)' }}>{doc.agentName}</div>
                          {doc.agentNxtId && (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{doc.agentNxtId}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                          {getDocTypeLabel(doc.docType)}
                        </td>
                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                          <div style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.fileName}>
                            {doc.fileName}
                          </div>
                          {doc.fileSize && (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{formatFileSize(doc.fileSize)}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: badge.bg,
                            color: badge.color,
                          }}>
                            {badge.label}
                          </span>
                          {doc.rejectionReason && doc.status === 'rejected' && (
                            <div style={{ fontSize: '12px', color: '#721C24', marginTop: '4px' }}>
                              Reason: {doc.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          {formatDate(doc.uploadedAt)}
                        </td>
                        <td style={{ padding: '12px 16px', verticalAlign: 'top', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <Button
                              size="small"
                              variant="secondary"
                              onClick={() => handleView(doc.id)}
                              disabled={viewLoading === doc.id}
                            >
                              {viewLoading === doc.id ? 'Opening...' : 'View'}
                            </Button>
                            {doc.status === 'pending_review' && (
                              <>
                                <Button
                                  size="small"
                                  onClick={() => handleApprove(doc.id)}
                                  disabled={actionLoading === doc.id}
                                  style={{ backgroundColor: '#28a745', color: '#fff' }}
                                >
                                  {actionLoading === doc.id ? '...' : 'Approve'}
                                </Button>
                                <Button
                                  size="small"
                                  variant="secondary"
                                  onClick={() => { setRejectingId(isRejecting ? null : doc.id); setRejectReason(''); }}
                                  style={{ color: '#dc3545', borderColor: '#dc3545' }}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isRejecting && (
                        <tr style={{ backgroundColor: '#FFF8F8' }}>
                          <td colSpan={6} style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="text"
                                placeholder="Reason for rejection..."
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                style={{
                                  flex: 1,
                                  padding: '8px 12px',
                                  border: '1px solid #dc3545',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  outline: 'none',
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') handleReject(doc.id); }}
                              />
                              <Button
                                size="small"
                                onClick={() => handleReject(doc.id)}
                                disabled={actionLoading === doc.id}
                                style={{ backgroundColor: '#dc3545', color: '#fff' }}
                              >
                                {actionLoading === doc.id ? '...' : 'Confirm Reject'}
                              </Button>
                              <Button
                                size="small"
                                variant="secondary"
                                onClick={() => { setRejectingId(null); setRejectReason(''); }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Showing {filtered.length} of {documents.length} documents
          </div>
        </Card>
      )}
    </div>
  );
}
