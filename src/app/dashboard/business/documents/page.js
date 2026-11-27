"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import StatTiles from '@/components/ui/StatTiles';
import { useUser } from '@/context/UserContext';
import { getUploadUrl, finalizeDocumentUpload, fetchDocuments, getDocumentViewUrl } from '@/app/actions/documents';
import { DOCUMENTS_MANAGER_TYPES, TAX_FORM_TYPES, getDocTypeLabel, computeDocChecklist } from '@/lib/documentTypes';
import ck from './checklist.module.css';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

const DOC_TYPES = DOCUMENTS_MANAGER_TYPES;

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const STATUS_STYLES = {
  pending_review: { bg: 'rgba(224,142,43,0.1)', text: '#E08E2B', label: 'Pending Review' },
  approved: { bg: 'rgba(47,168,79,0.1)', text: '#2FA84F', label: 'Approved' },
  rejected: { bg: 'rgba(211,63,63,0.1)', text: '#D33F3F', label: 'Rejected' },
};

export default function DocumentsManagerPage() {
  const { userProfile } = useUser();
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const xhrRef = useRef(null);

  const loadDocuments = useCallback(async () => {
    if (!userProfile) return;
    setIsLoading(true);
    const res = await fetchDocuments();
    if (res.success) {
      setDocuments(res.documents);
    }
    setIsLoading(false);
  }, [userProfile]);

  useEffect(() => {
    (async () => { await loadDocuments(); })();
  }, [loadDocuments]);

  // Open the upload box for one document type: used by the checklist below and by links like
  // /dashboard/business/documents?upload=w9 from the dashboard card.
  const openUploadFor = useCallback((type) => {
    setUploadDocType(DOCUMENTS_MANAGER_TYPES.some(t => t.value === type) ? type : '');
    setUploadFile(null); setUploadError(''); setUploadSuccess(''); setShowUpload(true);
  }, []);
  useEffect(() => {
    const type = new URLSearchParams(window.location.search).get('upload');
    if (type) openUploadFor(type);
  }, [openUploadFor]);

  const validateFile = (file) => {
    if (!file) return 'Please select a file.';
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return 'File type not allowed. Only PDF, JPG, and PNG files are accepted.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.`;
    }
    if (file.size < 1) {
      return 'File is empty.';
    }
    return null;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setUploadFile(file);
    setUploadError('');
    if (file) {
      const err = validateFile(file);
      if (err) setUploadError(err);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadDocType || !userProfile) return;

    const fileErr = validateFile(uploadFile);
    if (fileErr) { setUploadError(fileErr); return; }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError('');
    setUploadSuccess('');

    try {
      // Step 1: Get signed upload URL from server
      const urlRes = await getUploadUrl({
        callerUid: userProfile.uid,
        docType: uploadDocType,
        fileName: uploadFile.name,
        contentType: uploadFile.type || 'application/octet-stream',
        size: uploadFile.size,
      });

      if (!urlRes.success) {
        setUploadError(urlRes.error);
        setIsUploading(false);
        return;
      }

      // Step 2: PUT the file to the signed URL with progress tracking
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed (HTTP ${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.onabort = () => reject(new Error('Upload was cancelled.'));

        xhr.open('PUT', urlRes.uploadUrl);
        xhr.setRequestHeader('Content-Type', uploadFile.type || 'application/octet-stream');
        xhr.send(uploadFile);
      });

      // Step 3: Finalize — server verifies and writes Firestore record
      const finalRes = await finalizeDocumentUpload({
        callerUid: userProfile.uid,
        docType: uploadDocType,
        storagePath: urlRes.storagePath,
        fileName: uploadFile.name,
        size: uploadFile.size,
      });

      if (!finalRes.success) {
        setUploadError(finalRes.error);
        setIsUploading(false);
        return;
      }

      setUploadSuccess('Document uploaded successfully.');
      setUploadFile(null);
      setUploadDocType('');
      setUploadProgress(0);

      // Refresh the list
      await loadDocuments();

      // Close modal after a moment
      setTimeout(() => {
        setShowUpload(false);
        setUploadSuccess('');
      }, 1500);
    } catch (err) {
      setUploadError(err.message || 'Upload failed. Please try again.');
    }

    setIsUploading(false);
    xhrRef.current = null;
  };

  const handleViewDocument = async (doc) => {
    const res = await getDocumentViewUrl(userProfile.uid, doc.id);
    if (res.success) {
      window.open(res.viewUrl, '_blank');
    } else {
      // Fallback for legacy docs
      const legacyUrl = doc.fileURL || doc.storageUrl;
      if (legacyUrl) {
        window.open(legacyUrl, '_blank');
      }
    }
  };

  const taxDocs = documents.filter(d => TAX_FORM_TYPES.includes(d.docType));
  const otherDocs = documents.filter(d => !TAX_FORM_TYPES.includes(d.docType));
  const hasW9 = documents.some(d => d.docType === 'w9');

  const approvedCount = documents.filter(d => d.status === 'approved').length;
  const pendingCount = documents.filter(d => d.status === 'pending_review').length;
  const rejectedCount = documents.filter(d => d.status === 'rejected').length;

  // The signed-in person's own onboarding checklist (not shown to owners, admins or IT).
  const showChecklist = !!userProfile && !userProfile.is_owner && !['admin', 'it_engineer'].includes(userProfile.role);
  const checklist = showChecklist ? computeDocChecklist(userProfile, documents.filter(d => !d.agentId || d.agentId === userProfile.uid)) : null;
  const CHECK_WORD = { missing: 'Not uploaded', rejected: 'Rejected, upload again', pending_review: 'In review', approved: 'Approved' };

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}><LoadingSpinner label="Loading Documents..." /></div>;

  return (
    <div>
      <PageHeader
        title="Documents Manager"
        actions={
          <>
            <button className="nxt-btn" onClick={loadDocuments}>Refresh</button>
            <Button onClick={() => { setShowUpload(true); setUploadError(''); setUploadSuccess(''); }}>+ Upload Document</Button>
          </>
        }
      />

      {checklist && (
        <section className={ck.wrap} aria-label="Your onboarding documents">
          <header className={ck.head}>
            <div>
              <h2 className={ck.title}>{checklist.complete ? 'Onboarding complete' : checklist.toUpload > 0 ? 'Onboarding pending' : 'Documents in review'}</h2>
              <p className={ck.sub}>
                {checklist.complete ? 'Every document is uploaded and approved.' : checklist.toUpload > 0
                  ? `${checklist.toUpload} of ${checklist.total} still to upload. Accepted files: PDF, JPG or PNG, up to 20 MB.`
                  : 'Everything is uploaded. Each one turns to Approved once it has been reviewed.'}
              </p>
            </div>
            <div className={ck.meter} role="img" aria-label={`${checklist.uploaded} of ${checklist.total} uploaded`}>
              <b>{checklist.uploaded}<small> of {checklist.total}</small></b>
              <span><i style={{ width: `${(checklist.uploaded / checklist.total) * 100}%` }} /></span>
            </div>
          </header>
          <ul className={ck.list}>
            {checklist.items.map(item => (
              <li key={item.key} data-status={item.status}>
                <span className={ck.mark} aria-hidden="true">{item.status === 'approved' ? '✓' : item.status === 'pending_review' ? '…' : ''}</span>
                <span className={ck.text}><b>{item.label}</b><small>{item.description}</small></span>
                <span className={ck.pill}>{CHECK_WORD[item.status]}</span>
                {(item.status === 'missing' || item.status === 'rejected') ? (
                  <button type="button" className={ck.btn} onClick={() => openUploadFor(item.uploadType)}>Upload</button>
                ) : <span className={ck.done} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Summary cards */}
      <StatTiles lead={false} items={[
        { label: 'Approved', value: approvedCount, tone: 'good' },
        { label: 'Waiting for review', value: pendingCount, tone: pendingCount > 0 ? 'amber' : undefined },
        { label: 'Rejected', value: rejectedCount, tone: rejectedCount > 0 ? 'warn' : undefined },
      ]} />

      {/* ── Tax Forms Section ── */}
      <Card style={{ marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--brand-navy)' }}>Tax Forms</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '15px', color: 'var(--text-secondary)' }}>
              IRS W-9 is required for all agents. Download the blank form, complete it, and upload.
            </p>
          </div>
          <a className="nxt-btn"
            href="/documents/W9.pdf"
            download
           
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Blank W-9
          </a>
        </div>

        {taxDocs.length === 0 ? (
          <div style={{
            padding: 'var(--space-3)', borderRadius: '12px',
            border: '1px dashed var(--status-warning)',
            backgroundColor: 'rgba(224, 142, 43, 0.04)', textAlign: 'center',
          }}>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: 'var(--status-warning)' }}>
              No W-9 uploaded yet
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '15px', color: 'var(--text-secondary)' }}>
              Download the blank form above, fill it out, then click &quot;Upload Document&quot; to submit.
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th scope="col" style={thStyle}>FORM</th>
                <th scope="col" style={thStyle}>FILE NAME</th>
                <th scope="col" style={thStyle}>STATUS</th>
                <th scope="col" style={thStyle}>UPLOADED</th>
              </tr>
            </thead>
            <tbody>
              {taxDocs.map(d => {
                const st = STATUS_STYLES[d.status] || STATUS_STYLES.pending_review;
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ ...tdStyle, fontWeight: '500' }}>{getDocTypeLabel(d.docType)}</td>
                    <td style={tdStyle}>
                      <button className="nxt-btn nxt-btn-sm" onClick={() => handleViewDocument(d)}
                       >
                        {d.fileName || 'View'}
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '14px', fontWeight: '600', backgroundColor: st.bg, color: st.text }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={tdStyle}>{d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString('en-US') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* ── Other Documents ── */}
      {otherDocs.length === 0 && taxDocs.length === 0 ? (
        <Card>
          <EmptyState variant="minimal" title="No other documents uploaded yet" />
        </Card>
      ) : otherDocs.length > 0 && (
        <Card>
          <h2 style={{ margin: '0 0 var(--space-2) 0', fontSize: '18px', fontWeight: 600, color: 'var(--brand-navy)' }}>Other Documents</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th scope="col" style={thStyle}>DOCUMENT TYPE</th>
                <th scope="col" style={thStyle}>FILE NAME</th>
                <th scope="col" style={thStyle}>STATUS</th>
                <th scope="col" style={thStyle}>UPLOADED</th>
                <th scope="col" style={thStyle}>NOTES</th>
              </tr>
            </thead>
            <tbody>
              {otherDocs.map(d => {
                const st = STATUS_STYLES[d.status] || STATUS_STYLES.pending_review;
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ ...tdStyle, fontWeight: '500' }}>{getDocTypeLabel(d.docType)}</td>
                    <td style={tdStyle}>
                      <button className="nxt-btn nxt-btn-sm"
                        onClick={() => handleViewDocument(d)}
                      >
                        {d.fileName || 'View'}
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '14px', fontWeight: '600', backgroundColor: st.bg, color: st.text }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={tdStyle}>{d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString('en-US') : '—'}</td>
                    <td style={{ ...tdStyle, maxWidth: '200px' }}>
                      {d.status === 'rejected' && d.rejectionReason ? (
                        <span style={{ color: '#D33F3F', fontSize: '15px' }}>{d.rejectionReason}</span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget && !isUploading) setShowUpload(false); }}>
          <Card>
            <div style={{ width: '400px' }}>
              <h2 style={{ color: 'var(--brand-navy)', marginTop: 0, marginBottom: 'var(--space-3)' }}>Upload Document</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label style={labelStyle}>
                  Document Type
                  <select value={uploadDocType} onChange={e => setUploadDocType(e.target.value)} style={inputStyle} disabled={isUploading}>
                    <option value="">Select type</option>
                    {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>

                <label style={labelStyle}>
                  File (PDF, JPG, PNG — max 10 MB)
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} style={inputStyle} disabled={isUploading} />
                </label>
              </div>

              {/* Error message */}
              {uploadError && (
                <div style={{ marginTop: 'var(--space-2)', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(211,63,63,0.08)', color: '#D33F3F', fontSize: '15px' }}>
                  {uploadError}
                </div>
              )}

              {/* Success message */}
              {uploadSuccess && (
                <div style={{ marginTop: 'var(--space-2)', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(47,168,79,0.08)', color: '#2FA84F', fontSize: '15px' }}>
                  {uploadSuccess}
                </div>
              )}

              {/* Progress bar */}
              {isUploading && (
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    <span>{uploadProgress < 100 ? 'Uploading...' : 'Saving record...'}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '3px',
                      backgroundColor: uploadProgress === 100 ? '#2FA84F' : 'var(--brand-gold)',
                      width: `${uploadProgress}%`,
                      transition: 'width 0.2s ease',
                    }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                <Button variant="secondary" onClick={() => { if (!isUploading) { setShowUpload(false); setUploadError(''); } }} disabled={isUploading}>Cancel</Button>
                <Button onClick={handleUpload} isLoading={isUploading} disabled={!uploadDocType || !uploadFile || isUploading || !!uploadError}>
                  {isUploading ? `Uploading ${uploadProgress}%` : 'Upload'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' };
const tdStyle = { padding: '10px 12px', fontSize: '16px', color: 'var(--text-primary)' };
const labelStyle = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '15px', fontWeight: '500', color: 'var(--text-secondary)' };
const inputStyle = { padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '16px', color: 'var(--text-primary)' };
