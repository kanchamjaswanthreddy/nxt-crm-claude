"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import AgentSearchSelect from '@/components/AgentSearchSelect';
import { useUser } from '@/context/UserContext';

const dn = (a) => [a?.first_name, a?.middle_name, a?.last_name].filter(Boolean).join(' ') || a?.full_name || a?.name || a?.email || '';
import { db } from '@/lib/firebase/clientApp';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { deleteAgent, approveDocument, rejectDocument, updateAgentRole, updateAgentContractLevel, updateAgentStatus } from '@/app/actions/agents';
import { moveAgent } from '@/app/actions/hierarchy';
import { getDocumentViewUrl, getUploadUrl, finalizeDocumentUpload, fetchAgentDocumentsAdmin } from '@/app/actions/documents';
import { adminUpdateAgentProfile } from '@/app/actions/profile';
import { getDocTypeLabel as getSharedDocTypeLabel, requiresW9, getW9Status, DOCUMENT_TYPES } from '@/lib/documentTypes';
import { createAgentRequest, fetchAgentRequests, dismissAgentRequest } from '@/app/actions/agentRequests';
import { getOverridesForAgent, setOverridesBulk } from '@/app/actions/overrides';
import { AGENT_LEVELS } from '@/lib/constants';
import CommissionSplitBar from '@/components/CommissionSplitBar';
import Avatar from '@/components/Avatar';

function StatusBadge({ status, size = 'default' }) {
  const config = {
    active: { bg: 'rgba(47, 168, 79, 0.1)', color: 'var(--status-success)', label: 'Active' },
    invited: { bg: 'rgba(227, 169, 74, 0.1)', color: 'var(--brand-blue-accent)', label: 'Invited' },
    onboarding: { bg: 'rgba(227, 169, 74, 0.1)', color: 'var(--brand-gold)', label: 'Onboarding' },
    docs_pending_review: { bg: 'rgba(224, 142, 43, 0.1)', color: 'var(--status-warning)', label: 'Docs Pending Review' },
    pending_licensing: { bg: 'rgba(227, 169, 74, 0.1)', color: 'var(--brand-gold)', label: 'Pending License' },
    suspended: { bg: 'rgba(211, 63, 63, 0.1)', color: 'var(--status-error)', label: 'Suspended' },
    inactive: { bg: 'rgba(0, 0, 0, 0.06)', color: 'var(--text-secondary)', label: 'Inactive' },
  };
  const c = config[status] || { bg: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)', label: status || 'Unknown' };
  const isLarge = size === 'large';
  return (
    <span style={{
      padding: isLarge ? '6px 16px' : '4px 12px',
      borderRadius: '999px',
      fontSize: isLarge ? 'var(--text-secondary)' : 'var(--text-caption)',
      fontWeight: 600,
      backgroundColor: c.bg,
      color: c.color,
      display: 'inline-block',
    }}>
      {c.label}
    </span>
  );
}

function ComplianceIndicator({ label, isComplete, detail }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: 'var(--space-2) 0',
      borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          backgroundColor: isComplete ? 'rgba(47, 168, 79, 0.1)' : 'rgba(227, 169, 74, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {isComplete ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
        </div>
        <div>
          <span style={{ fontWeight: 600, fontSize: 'var(--text-secondary)', color: 'var(--brand-navy)', display: 'block' }}>{label}</span>
          {detail && <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>{detail}</span>}
        </div>
      </div>
      <span style={{
        fontSize: 'var(--text-caption)', fontWeight: 600,
        color: isComplete ? 'var(--status-success)' : 'var(--brand-gold)',
      }}>
        {isComplete ? 'Complete' : 'Pending'}
      </span>
    </div>
  );
}

function InfoRow({ label, value, editing, editValue, onChange, type = 'text', placeholder }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-1) 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
      <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>{label}</span>
      {editing ? (
        <input
          type={type}
          value={editValue ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || label}
          style={{
            width: '60%', padding: '4px 8px', borderRadius: '6px',
            border: '1px solid var(--border-color)', fontSize: 'var(--text-secondary)',
            color: 'var(--text-primary)', textAlign: 'right', backgroundColor: 'var(--bg-primary)',
          }}
        />
      ) : (
        <span style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={value || ''}>{value || '—'}</span>
      )}
    </div>
  );
}

export default function AgentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { userProfile } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [agent, setAgent] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [agentDocs, setAgentDocs] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rejectingDocId, setRejectingDocId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [isChangingLevel, setIsChangingLevel] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [allAgents, setAllAgents] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [assignManagerOpen, setAssignManagerOpen] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [isAssigningManager, setIsAssigningManager] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState('upload_document');
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDesc, setRequestDesc] = useState('');
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [agentRequests, setAgentRequests] = useState([]);
  const [commissionOverrides, setCommissionOverrides] = useState([]);
  const [overridesLoading, setOverridesLoading] = useState(true);
  const [isSavingOverrides, setIsSavingOverrides] = useState(false);
  const [showAdminUpload, setShowAdminUpload] = useState(false);
  const [adminUploadDocType, setAdminUploadDocType] = useState('');
  const [adminUploadFile, setAdminUploadFile] = useState(null);
  const [isAdminUploading, setIsAdminUploading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    if (!userProfile || !id) return;

    setCurrentUser(userProfile); // eslint-disable-line react-hooks/set-state-in-effect

    const loadAgentData = async () => {
      // Load agent profile first (critical)
      try {
        const agentSnap = await getDoc(doc(db, 'agents', id));
        if (agentSnap.exists()) {
          setAgent({ uid: id, ...agentSnap.data() });
        }
      } catch (err) {
        setErrorMsg('Failed to load agent profile. You may not have permission to view this agent.');
      }

      // Load supplementary data (non-critical — permission errors shouldn't block the profile)
      try {
        const [docsRes, allAgentsSnap] = await Promise.all([
          fetchAgentDocumentsAdmin(id),
          userProfile.agency_id ? getDocs(query(collection(db, 'agents'), where('agency_id', '==', userProfile.agency_id))) : Promise.resolve(null),
        ]);

        if (docsRes.success) {
          setAgentDocs(docsRes.documents);
        }

        if (allAgentsSnap) {
          const agList = [];
          allAgentsSnap.forEach(d => agList.push({ id: d.id, ...d.data() }));
          setAllAgents(agList);
          setTeamMembers(agList.filter(a => a.upline_id === id));
        }
      } catch (err) {
        // silenced
      }

      // Load requests for this agent
      try {
        if (userProfile.agency_id) {
          const reqRes = await fetchAgentRequests();
          if (reqRes.success) {
            setAgentRequests(reqRes.requests.filter(r => r.targetAgentId === id));
          }
        }
      } catch (err) {
        // silenced
      }

      // Load commission overrides
      try {
        const ovRes = await getOverridesForAgent(id);
        if (ovRes.success) {
          setCommissionOverrides(ovRes.overrides.map(o => ({
            beneficiaryId: o.beneficiaryId,
            beneficiaryName: o.beneficiaryName,
            percent: o.percent,
          })));
        }
      } catch (err) {
        // silenced
      }

      setOverridesLoading(false);
      setIsLoading(false);
    };

    loadAgentData();
  }, [userProfile, id]);

  const handleDelete = async () => {
    if (!currentUser) return;
    setIsDeleting(true);
    setErrorMsg(null);
    try {
      const res = await deleteAgent(id);
      if (res.success) {
        router.push('/dashboard/team');
      } else {
        setErrorMsg(res.error || 'Failed to delete agent.');
        setIsDeleting(false);
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      setErrorMsg('Something went wrong while deleting. Please try again.');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleApproveDoc = async (docId) => {
    if (!currentUser) return;
    setIsUpdating(true);
    const res = await approveDocument(docId);
    if (res.success) {
      setAgentDocs(prev => prev.map(d => d.id === docId ? { ...d, status: 'approved' } : d));
      setSuccessMsg('Document approved');
      // Check if all docs approved — refresh agent data
      const agentSnap = await getDoc(doc(db, 'agents', id));
      if (agentSnap.exists()) setAgent({ uid: id, ...agentSnap.data() });
    }
    setIsUpdating(false);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleRejectDoc = async (docId) => {
    if (!currentUser) return;
    setIsUpdating(true);
    const res = await rejectDocument(docId, rejectReason);
    if (res.success) {
      setAgentDocs(prev => prev.map(d => d.id === docId ? { ...d, status: 'rejected', rejectionReason: rejectReason } : d));
      setRejectingDocId(null);
      setRejectReason('');
      setSuccessMsg('Document rejected — agent notified');
    }
    setIsUpdating(false);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleAdminUpload = async () => {
    if (!currentUser || !adminUploadFile || !adminUploadDocType) return;
    setIsAdminUploading(true);
    setErrorMsg(null);
    try {
      const file = adminUploadFile;
      const urlRes = await getUploadUrl({
        callerUid: currentUser.uid,
        docType: adminUploadDocType,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        targetAgentId: id,
      });
      if (!urlRes.success) {
        setErrorMsg(urlRes.error);
        setIsAdminUploading(false);
        setTimeout(() => setErrorMsg(null), 5000);
        return;
      }
      const putRes = await fetch(urlRes.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) {
        setErrorMsg('File upload failed. Please try again.');
        setIsAdminUploading(false);
        setTimeout(() => setErrorMsg(null), 5000);
        return;
      }
      const finalRes = await finalizeDocumentUpload({
        callerUid: currentUser.uid,
        docType: adminUploadDocType,
        storagePath: urlRes.storagePath,
        fileName: file.name,
        size: file.size,
        targetAgentId: id,
      });
      if (finalRes.success) {
        setAgentDocs(prev => [...prev, finalRes.record]);
        setSuccessMsg(`Document uploaded on behalf of ${dn(agent) || 'agent'}`);
        setShowAdminUpload(false);
        setAdminUploadDocType('');
        setAdminUploadFile(null);
      } else {
        setErrorMsg(finalRes.error);
      }
    } catch (err) {
      setErrorMsg('Upload failed. Please try again.');
    }
    setIsAdminUploading(false);
    setTimeout(() => { setSuccessMsg(null); setErrorMsg(null); }, 5000);
  };

  const startEditing = () => {
    const addr = agent.address || {};
    setEditForm({
      first_name: agent.first_name || '',
      middle_name: agent.middle_name || '',
      last_name: agent.last_name || '',
      full_name: agent.full_name || '',
      email: agent.email || '',
      phone: agent.phone || '',
      date_of_birth: agent.date_of_birth || '',
      address_line1: addr.line1 || '',
      address_line2: addr.line2 || '',
      address_city: addr.city || '',
      address_state: addr.state || '',
      address_zip: addr.zip || '',
      npn: agent.npn || '',
      resident_state: agent.resident_state || '',
      license_expiry: agent.license_expiry || '',
      licensedStates: (agent.licensedStates || []).join(', '),
      eo_provider: agent.compliance?.eo_provider || '',
      eo_policy_number: agent.compliance?.eo_policy_number || '',
      eo_expiry: agent.compliance?.eo_expiry || '',
      aml_provider: agent.compliance?.aml_provider || '',
      aml_cert_date: agent.compliance?.aml_cert_date || '',
    });
    setIsEditMode(true);
  };

  const cancelEditing = () => {
    setIsEditMode(false);
    setEditForm({});
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setIsSavingProfile(true);
    setErrorMsg(null);

    const licensedArr = editForm.licensedStates
      ? editForm.licensedStates.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const updates = {
      first_name: editForm.first_name,
      middle_name: editForm.middle_name || null,
      last_name: editForm.last_name,
      full_name: [editForm.first_name, editForm.middle_name, editForm.last_name].filter(Boolean).join(' ') || editForm.full_name,
      email: editForm.email,
      phone: editForm.phone,
      date_of_birth: editForm.date_of_birth,
      address: {
        line1: editForm.address_line1,
        line2: editForm.address_line2,
        city: editForm.address_city,
        state: editForm.address_state,
        zip: editForm.address_zip,
      },
      npn: editForm.npn,
      resident_state: editForm.resident_state,
      license_expiry: editForm.license_expiry,
      licensedStates: licensedArr,
      compliance: {
        ...(agent.compliance || {}),
        eo_provider: editForm.eo_provider,
        eo_policy_number: editForm.eo_policy_number,
        eo_expiry: editForm.eo_expiry,
        has_eo: !!(editForm.eo_provider || editForm.eo_policy_number),
        aml_provider: editForm.aml_provider,
        aml_cert_date: editForm.aml_cert_date,
        aml_certified: !!(editForm.aml_provider || editForm.aml_cert_date),
      },
    };

    const res = await adminUpdateAgentProfile(id, updates);
    if (res.success) {
      setAgent(prev => ({ ...prev, ...updates }));
      setIsEditMode(false);
      setEditForm({});
      setSuccessMsg('Profile updated');
    } else {
      setErrorMsg(res.error || 'Failed to save changes.');
    }
    setIsSavingProfile(false);
    setTimeout(() => { setSuccessMsg(null); setErrorMsg(null); }, 4000);
  };

  const updateEditField = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleRoleChange = async (newRole) => {
    setIsChangingRole(true);
    const res = await updateAgentRole(id, newRole, currentUser.uid);
    if (res.success) {
      setAgent(prev => ({ ...prev, role: newRole }));
      setSuccessMsg(`Role updated to ${newRole}`);
    } else {
      setErrorMsg(res.error);
    }
    setIsChangingRole(false);
    setTimeout(() => { setSuccessMsg(null); setErrorMsg(null); }, 3000);
  };

  const handleStatusChange = async (newStatus) => {
    setIsUpdating(true);
    setErrorMsg(null);
    try {
      const res = await updateAgentStatus(id, newStatus, currentUser.uid);
      if (res.success) {
        setAgent(prev => ({ ...prev, status: newStatus }));
        setSuccessMsg(`Agent status updated to ${newStatus}${newStatus === 'active' ? '. Approval email sent.' : ''}`);
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(res.error || 'Failed to update status.');
        setTimeout(() => setErrorMsg(null), 5000);
      }
    } catch (err) {
      setErrorMsg('Failed to update status. Please try again.');
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendRequest = async () => {
    if (!requestTitle.trim()) return;
    setIsSendingRequest(true);
    const res = await createAgentRequest({
      agencyId: currentUser.agency_id,
      targetAgentId: id,
      requestType,
      title: requestTitle.trim(),
      description: requestDesc.trim(),
      createdBy: currentUser.uid,
    });
    if (res.success) {
      setShowRequestModal(false);
      setRequestTitle('');
      setRequestDesc('');
      setRequestType('upload_document');
      setSuccessMsg('Request sent to agent');
      // Reload requests
      const reqRes = await fetchAgentRequests();
      if (reqRes.success) setAgentRequests(reqRes.requests.filter(r => r.targetAgentId === id));
    } else {
      setErrorMsg(res.error);
    }
    setIsSendingRequest(false);
    setTimeout(() => { setSuccessMsg(null); setErrorMsg(null); }, 3000);
  };

  const handleDismissRequest = async (reqId) => {
    const res = await dismissAgentRequest(reqId, currentUser.uid);
    if (res.success) {
      setAgentRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'dismissed' } : r));
      setSuccessMsg('Request dismissed');
    }
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading agent profile...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '400px', gap: 'var(--space-2)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body)' }}>Agent not found.</p>
        <Button variant="secondary" size="small" onClick={() => router.push('/dashboard/team')}>Back to Team</Button>
      </div>
    );
  }

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'it_engineer';
  const isOwner = !!currentUser?.is_owner || currentUser?.role === 'it_engineer';
  const agentIsOwner = !!agent.is_owner;
  const compliance = agent.compliance || {};
  const address = agent.address || {};

  const hasNPN = !!agent.npn;
  const hasLicensedStates = agent.licensedStates?.length > 0;
  const hasEO = compliance.has_eo;
  const hasAML = compliance.aml_certified;
  const hasAddress = !!address.line1;
  const hasPhone = !!agent.phone;
  const agentW9Status = getW9Status(agent, agentDocs);
  const w9Doc = agentDocs.find(d => d.docType === 'w9');
  const hasW9 = agentW9Status === 'not_required' || agentW9Status === 'approved';
  const docsApproved = agent.onboardingProgress?.documentsApproved || false;
  const docsUploaded = agentDocs.length > 0;
  const allDocsApproved = docsUploaded && agentDocs.every(d => d.status === 'approved') && agentDocs.length >= 3;

  const completedChecks = [hasNPN, hasLicensedStates, hasEO, hasAML, hasAddress, hasPhone, hasW9, allDocsApproved].filter(Boolean).length;
  const totalChecks = 8;
  const completionPercent = Math.round((completedChecks / totalChecks) * 100);

  return (
    <div style={{ paddingBottom: 'var(--space-6)' }}>

      {/* Success toast */}
      {successMsg && (
        <div style={{
          position: 'fixed', top: 'var(--space-3)', right: 'var(--space-3)',
          backgroundColor: 'var(--status-success)', color: '#fff',
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: '12px', fontSize: 'var(--text-secondary)',
          fontWeight: 600, zIndex: 10000,
          boxShadow: '0 8px 24px rgba(47, 168, 79, 0.3)',
        }}>
          {successMsg}
        </div>
      )}

      {/* Error banner */}
      {errorMsg && !showDeleteConfirm && (
        <div style={{
          padding: 'var(--space-2) var(--space-3)', borderRadius: '12px',
          backgroundColor: 'rgba(211, 63, 63, 0.08)', border: '1px solid rgba(211, 63, 63, 0.2)',
          color: 'var(--status-error)', fontSize: 'var(--text-secondary)', fontWeight: 600,
          marginBottom: 'var(--space-2)',
        }}>
          {errorMsg}
        </div>
      )}

      {/* Back link */}
      <Link
        href="/dashboard/team"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)',
          textDecoration: 'none', marginBottom: 'var(--space-3)',
          fontWeight: 500, transition: 'color 0.2s ease',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to Team
      </Link>

      {/* Agent Header */}
      <Card style={{ marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Avatar name={dn(agent)} photoUrl={agent.photo_url} size={72} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 'var(--text-h1)', color: 'var(--brand-navy)', fontWeight: 700, margin: 0 }}>
              {dn(agent) || 'No name set'}
            </h1>
            <p style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>{agent.email}</p>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {agentIsOwner ? (
                <span style={{
                  padding: '2px 10px', borderRadius: '999px', fontSize: 'var(--text-caption)',
                  fontWeight: 700, background: 'linear-gradient(135deg, #0C1022, #1B2A4E)', color: '#E3A94A',
                  letterSpacing: '0.03em',
                }}>
                  Agency Owner
                </span>
              ) : (
                <span style={{
                  padding: '2px 10px', borderRadius: '999px', fontSize: 'var(--text-caption)',
                  fontWeight: 600, backgroundColor: 'rgba(12, 16, 34, 0.06)', color: 'var(--brand-navy)', textTransform: 'capitalize',
                }}>
                  {agent.role}
                </span>
              )}
              <StatusBadge status={agent.status} />
              {(() => {
                const lvl = AGENT_LEVELS.find(l => l.level === (agent.agentLevel || 1)) || AGENT_LEVELS[0];
                return (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '2px 10px', borderRadius: '999px', fontSize: 'var(--text-caption)',
                    fontWeight: 600, backgroundColor: 'rgba(10, 37, 64, 0.06)', color: 'var(--brand-navy)',
                  }}>
                    L{lvl.level} · {lvl.title}
                  </span>
                );
              })()}
            </div>
            {agent.upline_id && (() => {
              const mgr = allAgents.find(a => a.id === agent.upline_id);
              return mgr ? (
                <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Upline: <strong style={{ color: 'var(--brand-navy)' }}>{dn(mgr)}</strong>
                </p>
              ) : null;
            })()}
          </div>
        </div>

        {/* Admin actions — separate row below agent info */}
        {isAdmin && agent.uid !== currentUser?.uid && !agentIsOwner && (
          <div style={{
            display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap',
            marginTop: 'var(--space-3)', paddingTop: 'var(--space-2)',
            borderTop: '1px solid var(--border-color)',
          }}>
            {/* Level promote */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: 600 }}>Level:</span>
              <select
                value={agent.agentLevel || 1}
                onChange={async (e) => {
                  const newLevel = parseInt(e.target.value, 10);
                  setIsChangingLevel(true);
                  const res = await updateAgentContractLevel(agent.uid, newLevel);
                  if (res.success) {
                    const lvlInfo = AGENT_LEVELS.find(l => l.level === newLevel);
                    setAgent(prev => ({ ...prev, agentLevel: newLevel, contractLevel: lvlInfo?.title }));
                    setSuccessMsg(`Level updated to ${lvlInfo?.title}`);
                  } else {
                    setErrorMsg(res.error);
                  }
                  setIsChangingLevel(false);
                  setTimeout(() => { setSuccessMsg(null); setErrorMsg(null); }, 3000);
                }}
                disabled={isChangingLevel}
                style={{
                  padding: '5px 10px', borderRadius: '8px',
                  border: '1px solid var(--border-color)', backgroundColor: '#fff',
                  fontSize: 'var(--text-caption)', fontWeight: 500,
                  color: 'var(--text-primary)', cursor: 'pointer',
                }}
              >
                {AGENT_LEVELS.map(lvl => (
                  <option key={lvl.level} value={lvl.level}>L{lvl.level} · {lvl.title}</option>
                ))}
              </select>
            </div>

            {/* Role management — owner only */}
            {isOwner && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: 600 }}>Role:</span>
                <select
                  value={agent.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  disabled={isChangingRole}
                  style={{
                    padding: '5px 10px', borderRadius: '8px',
                    border: '1px solid var(--border-color)', backgroundColor: '#fff',
                    fontSize: 'var(--text-caption)', fontWeight: 500,
                    color: 'var(--text-primary)', cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  <option value="admin">Admin</option>
                  <option value="agent">Agent</option>
                </select>
              </div>
            )}

            <button
              onClick={() => { setAssignManagerOpen(true); setSelectedManagerId(agent.upline_id || ''); }}
              style={{
                padding: '5px 12px', borderRadius: '8px',
                border: '1px solid var(--brand-gold)', backgroundColor: 'rgba(227, 169, 74, 0.06)',
                color: 'var(--brand-navy)', fontSize: 'var(--text-caption)',
                fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              Assign Upline
            </button>

            <button
              onClick={() => setShowRequestModal(true)}
              style={{
                padding: '5px 12px', borderRadius: '8px',
                border: '1px solid var(--brand-blue-accent)', backgroundColor: 'rgba(227, 169, 74, 0.06)',
                color: 'var(--brand-navy)', fontSize: 'var(--text-caption)',
                fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              Send Request
            </button>

            <div style={{ flex: 1 }} />

            {agent.status === 'active' && (
              <Button variant="secondary" size="small" onClick={() => handleStatusChange('suspended')} isLoading={isUpdating}>
                Suspend
              </Button>
            )}
            {agent.status === 'suspended' && (
              <Button size="small" onClick={() => handleStatusChange('active')} isLoading={isUpdating}>
                Reactivate
              </Button>
            )}
            {agent.status === 'invited' && (
              <Button size="small" onClick={() => handleStatusChange('active')} isLoading={isUpdating}>
                Activate
              </Button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                padding: '5px 12px', borderRadius: '8px',
                border: '1px solid var(--status-error)', backgroundColor: 'transparent',
                color: 'var(--status-error)', fontSize: 'var(--text-caption)',
                fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--status-error)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--status-error)'; }}
            >
              Delete
            </button>
          </div>
        )}
      </Card>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>

        {/* Left: Personal & Licensing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

          {/* Personal Info */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: 0 }}>
                Personal Information
              </h3>
              {(isAdmin || isOwner) && !isEditMode && (
                <button
                  onClick={startEditing}
                  style={{
                    padding: '3px 12px', borderRadius: '999px',
                    border: '1.5px solid var(--brand-navy)', backgroundColor: 'transparent',
                    fontSize: 'var(--text-caption)', color: 'var(--brand-navy)', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Edit Profile
                </button>
              )}
              {isEditMode && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={cancelEditing}
                    style={{
                      padding: '3px 12px', borderRadius: '999px',
                      border: '1px solid var(--border-color)', backgroundColor: 'transparent',
                      fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    style={{
                      padding: '3px 12px', borderRadius: '999px',
                      border: 'none', backgroundColor: isSavingProfile ? 'rgba(0,0,0,0.1)' : 'var(--brand-navy)',
                      fontSize: 'var(--text-caption)', color: '#fff', fontWeight: 600,
                      cursor: isSavingProfile ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isSavingProfile ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
            <InfoRow label="First Name" value={agent.first_name} editing={isEditMode} editValue={editForm.first_name} onChange={v => updateEditField('first_name', v)} />
            <InfoRow label="Middle Name" value={agent.middle_name} editing={isEditMode} editValue={editForm.middle_name} onChange={v => updateEditField('middle_name', v)} />
            <InfoRow label="Last Name" value={agent.last_name} editing={isEditMode} editValue={editForm.last_name} onChange={v => updateEditField('last_name', v)} />
            <InfoRow label="Email" value={agent.email} editing={isEditMode} editValue={editForm.email} onChange={v => updateEditField('email', v)} type="email" />
            <InfoRow label="Phone" value={agent.phone} editing={isEditMode} editValue={editForm.phone} onChange={v => updateEditField('phone', v)} type="tel" />
            <InfoRow label="Date of Birth" value={agent.date_of_birth} editing={isEditMode} editValue={editForm.date_of_birth} onChange={v => updateEditField('date_of_birth', v)} type="date" />
            {isEditMode ? (
              <>
                <InfoRow label="Street" editing editValue={editForm.address_line1} onChange={v => updateEditField('address_line1', v)} placeholder="Street address" />
                <InfoRow label="Apt/Suite" editing editValue={editForm.address_line2} onChange={v => updateEditField('address_line2', v)} placeholder="Apt, suite, etc." />
                <InfoRow label="City" editing editValue={editForm.address_city} onChange={v => updateEditField('address_city', v)} />
                <InfoRow label="State" editing editValue={editForm.address_state} onChange={v => updateEditField('address_state', v)} />
                <InfoRow label="ZIP" editing editValue={editForm.address_zip} onChange={v => updateEditField('address_zip', v)} />
              </>
            ) : (
              <InfoRow
                label="Address"
                value={address.line1 ? `${address.line1}${address.line2 ? `, ${address.line2}` : ''}, ${address.city}, ${address.state} ${address.zip}` : null}
              />
            )}
            <InfoRow label="Member Since" value={agent.created_at ? new Date(agent.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null} />
          </Card>

          {/* Licensing */}
          <Card>
            <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-2) 0' }}>
              Insurance Licensing
            </h3>
            <InfoRow label="NPN" value={agent.npn} editing={isEditMode} editValue={editForm.npn} onChange={v => updateEditField('npn', v)} />
            <InfoRow label="Resident State" value={agent.resident_state} editing={isEditMode} editValue={editForm.resident_state} onChange={v => updateEditField('resident_state', v)} />
            <InfoRow label="License Expiry" value={agent.license_expiry} editing={isEditMode} editValue={editForm.license_expiry} onChange={v => updateEditField('license_expiry', v)} type="date" />
            <div style={{ padding: 'var(--space-1) 0' }}>
              <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 'var(--space-1)' }}>Licensed States</span>
              {isEditMode ? (
                <input
                  type="text"
                  value={editForm.licensedStates ?? ''}
                  onChange={e => updateEditField('licensedStates', e.target.value)}
                  placeholder="TX, CA, FL (comma-separated)"
                  style={{
                    width: '100%', padding: '4px 8px', borderRadius: '6px',
                    border: '1px solid var(--border-color)', fontSize: 'var(--text-secondary)',
                    color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)',
                  }}
                />
              ) : agent.licensedStates?.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {agent.licensedStates.map(s => (
                    <span key={s} style={{
                      padding: '2px 8px', borderRadius: '999px', fontSize: 'var(--text-caption)',
                      fontWeight: 500, backgroundColor: 'rgba(12, 16, 34, 0.06)', color: 'var(--brand-navy)',
                    }}>{s}</span>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)' }}>—</span>
              )}
            </div>
          </Card>

          {/* Compliance & Coverage */}
          <Card>
            <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-2) 0' }}>
              Compliance & Coverage
            </h3>

            {isEditMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <InfoRow label="E&O Provider" editing editValue={editForm.eo_provider} onChange={v => updateEditField('eo_provider', v)} placeholder="Provider name" />
                <InfoRow label="E&O Policy #" editing editValue={editForm.eo_policy_number} onChange={v => updateEditField('eo_policy_number', v)} placeholder="Policy number" />
                <InfoRow label="E&O Expiry" editing editValue={editForm.eo_expiry} onChange={v => updateEditField('eo_expiry', v)} type="date" />
                <InfoRow label="AML Provider" editing editValue={editForm.aml_provider} onChange={v => updateEditField('aml_provider', v)} placeholder="Provider name" />
                <InfoRow label="AML Cert Date" editing editValue={editForm.aml_cert_date} onChange={v => updateEditField('aml_cert_date', v)} type="date" />
              </div>
            ) : (
              <>
                {/* E&O */}
                <div style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-secondary)', color: 'var(--brand-navy)' }}>E&O Insurance</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                      backgroundColor: hasEO ? 'rgba(47, 168, 79, 0.1)' : 'rgba(227, 169, 74, 0.1)',
                      color: hasEO ? 'var(--status-success)' : 'var(--brand-gold)',
                    }}>
                      {hasEO ? 'Active' : 'Missing'}
                    </span>
                  </div>
                  {hasEO ? (
                    <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <div>Provider: {compliance.eo_provider || '—'}</div>
                      <div>Policy: {compliance.eo_policy_number || '—'}</div>
                      <div>Expires: {compliance.eo_expiry || '—'}</div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', margin: 0 }}>Agent has not provided E&O coverage details.</p>
                  )}
                </div>

                {/* AML */}
                <div style={{ padding: 'var(--space-2) 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-secondary)', color: 'var(--brand-navy)' }}>AML Certification</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                      backgroundColor: hasAML ? 'rgba(47, 168, 79, 0.1)' : 'rgba(227, 169, 74, 0.1)',
                      color: hasAML ? 'var(--status-success)' : 'var(--brand-gold)',
                    }}>
                      {hasAML ? 'Certified' : 'Missing'}
                    </span>
                  </div>
                  {hasAML ? (
                    <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <div>Provider: {compliance.aml_provider || '—'}</div>
                      <div>Certified: {compliance.aml_cert_date || '—'}</div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', margin: 0 }}>Agent has not completed AML certification.</p>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Right: Onboarding Progress */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

          {/* Onboarding Progress */}
          <Card style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: 0 }}>
                Onboarding Progress
              </h3>
              <span style={{ fontSize: 'var(--text-h2)', fontWeight: 700, color: completionPercent === 100 ? 'var(--status-success)' : 'var(--brand-navy)' }}>
                {completionPercent}%
              </span>
            </div>
            <div style={{ height: '8px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '999px', overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
              <div style={{
                height: '100%', borderRadius: '999px',
                width: `${completionPercent}%`,
                backgroundColor: completionPercent === 100 ? 'var(--status-success)' : 'var(--brand-gold)',
                transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
              {completedChecks} of {totalChecks} items complete
            </span>

            <div style={{ marginTop: 'var(--space-2)' }}>
              <ComplianceIndicator label="Phone Number" isComplete={hasPhone} detail={agent.phone || 'Not provided'} />
              <ComplianceIndicator label="Mailing Address" isComplete={hasAddress} detail={hasAddress ? `${address.city}, ${address.state}` : 'Not provided'} />
              <ComplianceIndicator label="NPN Number" isComplete={hasNPN} detail={agent.npn || 'Not provided'} />
              <ComplianceIndicator label="Licensed States" isComplete={hasLicensedStates} detail={hasLicensedStates ? `${agent.licensedStates.length} states` : 'Not provided'} />
              <ComplianceIndicator label="E&O Insurance" isComplete={hasEO} detail={hasEO ? `${compliance.eo_provider || 'Provider not specified'}` : 'Not provided'} />
              <ComplianceIndicator label="AML Certification" isComplete={hasAML} detail={hasAML ? `${compliance.aml_provider || 'Provider not specified'}` : 'Not provided'} />
              <ComplianceIndicator label="W-9 Tax Form" isComplete={hasW9} detail={
                agentW9Status === 'not_required' ? 'Not required'
                : agentW9Status === 'approved' ? 'Approved'
                : agentW9Status === 'rejected' ? 'Rejected — needs re-upload'
                : agentW9Status === 'pending_review' ? 'Pending review'
                : 'Not uploaded'
              } />
              <ComplianceIndicator
                label="Documents"
                isComplete={allDocsApproved}
                detail={
                  !docsUploaded ? 'No documents uploaded'
                    : allDocsApproved ? `${agentDocs.length} documents approved`
                    : `${agentDocs.filter(d => d.status === 'approved').length} of ${agentDocs.length} approved`
                }
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Document Review Section */}
      {agentDocs.length > 0 && (
        <Card style={{ marginTop: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: 0 }}>
              Uploaded Documents
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {(isAdmin || isOwner) && (
                <button
                  onClick={() => setShowAdminUpload(true)}
                  style={{
                    padding: '3px 12px', borderRadius: '999px',
                    border: '1.5px solid var(--brand-navy)', backgroundColor: 'transparent',
                    fontSize: 'var(--text-caption)', color: 'var(--brand-navy)', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Upload
                </button>
              )}
            <span style={{
              padding: '3px 12px', borderRadius: '999px', fontSize: 'var(--text-caption)', fontWeight: 600,
              backgroundColor: allDocsApproved ? 'rgba(47, 168, 79, 0.1)' : 'rgba(224, 142, 43, 0.1)',
              color: allDocsApproved ? 'var(--status-success)' : 'var(--status-warning)',
            }}>
              {allDocsApproved ? 'All Approved' : `${agentDocs.filter(d => d.status === 'approved').length}/${agentDocs.length} Approved`}
            </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {agentDocs.map(adoc => {
              const statusConfig = {
                pending_review: { label: 'Pending Review', color: 'var(--status-warning)', bg: 'rgba(224, 142, 43, 0.1)' },
                approved: { label: 'Approved', color: 'var(--status-success)', bg: 'rgba(47, 168, 79, 0.1)' },
                rejected: { label: 'Rejected', color: 'var(--status-error)', bg: 'rgba(211, 63, 63, 0.1)' },
              };

              const sc = statusConfig[adoc.status] || statusConfig.pending_review;

              return (
                <div key={adoc.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 'var(--space-2)', borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: adoc.status === 'approved' ? 'rgba(47, 168, 79, 0.02)' : adoc.status === 'rejected' ? 'rgba(211, 63, 63, 0.02)' : 'transparent',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-secondary)', color: 'var(--brand-navy)' }}>
                        {getSharedDocTypeLabel(adoc.docType)}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                        backgroundColor: sc.bg, color: sc.color,
                      }}>
                        {sc.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                      {adoc.fileName} · Uploaded {adoc.uploadedAt ? new Date(adoc.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </div>
                    {adoc.status === 'rejected' && adoc.rejectionReason && (
                      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--status-error)', marginTop: '4px', fontWeight: 500 }}>
                        Reason: {adoc.rejectionReason}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                    {/* View button — fetches signed URL */}
                    <button
                      onClick={async () => {
                        const res = await getDocumentViewUrl(adoc.id);
                        if (res.success) {
                          window.open(res.viewUrl, '_blank');
                        } else {
                          // Fallback for legacy docs
                          const legacy = adoc.fileURL || adoc.storageUrl;
                          if (legacy) window.open(legacy, '_blank');
                        }
                      }}
                      style={{
                        padding: '4px 12px', borderRadius: '999px',
                        border: '1px solid var(--border-color)', backgroundColor: 'transparent',
                        fontSize: 'var(--text-caption)', color: 'var(--brand-navy)', fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.2s ease',
                      }}
                    >
                      View
                    </button>

                    {/* Admin approve/reject */}
                    {isAdmin && adoc.status === 'pending_review' && (
                      <>
                        <button
                          onClick={() => handleApproveDoc(adoc.id)}
                          disabled={isUpdating}
                          style={{
                            padding: '4px 12px', borderRadius: '999px',
                            border: '1.5px solid var(--status-success)', backgroundColor: 'transparent',
                            fontSize: 'var(--text-caption)', color: 'var(--status-success)', fontWeight: 600,
                            cursor: 'pointer', transition: 'all 0.2s ease',
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectingDocId(adoc.id)}
                          disabled={isUpdating}
                          style={{
                            padding: '4px 12px', borderRadius: '999px',
                            border: '1.5px solid var(--status-error)', backgroundColor: 'transparent',
                            fontSize: 'var(--text-caption)', color: 'var(--status-error)', fontWeight: 600,
                            cursor: 'pointer', transition: 'all 0.2s ease',
                          }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {agentDocs.length === 0 && (
        <Card style={{ marginTop: 'var(--space-3)', textAlign: 'center', padding: 'var(--space-4)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-secondary)', margin: 0 }}>
            No documents uploaded yet.
          </p>
          {(isAdmin || isOwner) && (
            <button
              onClick={() => setShowAdminUpload(true)}
              style={{
                marginTop: 'var(--space-2)', padding: '6px 16px', borderRadius: '999px',
                border: '1.5px solid var(--brand-navy)', backgroundColor: 'transparent',
                fontSize: 'var(--text-caption)', color: 'var(--brand-navy)', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Upload on behalf of agent
            </button>
          )}
        </Card>
      )}

      {/* Admin Upload Panel */}
      {showAdminUpload && (isAdmin || isOwner) && (
        <Card style={{ marginTop: 'var(--space-3)', border: '1.5px solid var(--brand-navy)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: 0 }}>
              Upload Document for {dn(agent) || 'Agent'}
            </h3>
            <button
              onClick={() => { setShowAdminUpload(false); setAdminUploadDocType(''); setAdminUploadFile(null); }}
              style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              aria-label="Close upload panel"
            >
              &times;
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Document Type
              </label>
              <select
                value={adminUploadDocType}
                onChange={e => setAdminUploadDocType(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '8px',
                  border: '1px solid var(--border-color)', fontSize: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
                }}
              >
                <option value="">Select document type...</option>
                {Object.entries(DOCUMENT_TYPES).map(([key, dt]) => (
                  <option key={key} value={key}>{dt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                File (PDF, JPG, or PNG, max 10 MB)
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setAdminUploadFile(e.target.files?.[0] || null)}
                style={{ fontSize: 'var(--text-secondary)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: 'var(--space-1)' }}>
              <button
                onClick={() => { setShowAdminUpload(false); setAdminUploadDocType(''); setAdminUploadFile(null); }}
                style={{
                  padding: '6px 16px', borderRadius: '999px',
                  border: '1px solid var(--border-color)', backgroundColor: 'transparent',
                  fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdminUpload}
                disabled={!adminUploadDocType || !adminUploadFile || isAdminUploading}
                style={{
                  padding: '6px 16px', borderRadius: '999px',
                  border: 'none', backgroundColor: (!adminUploadDocType || !adminUploadFile || isAdminUploading) ? 'rgba(0,0,0,0.1)' : 'var(--brand-navy)',
                  fontSize: 'var(--text-caption)', color: (!adminUploadDocType || !adminUploadFile || isAdminUploading) ? 'var(--text-secondary)' : '#fff', fontWeight: 600,
                  cursor: (!adminUploadDocType || !adminUploadFile || isAdminUploading) ? 'not-allowed' : 'pointer',
                }}
              >
                {isAdminUploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Signed Agreements Section */}
      {agent?.agreement && (
        <Card style={{ marginTop: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-2)' }}>
            Signed Agreements
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {agent.agreement.ica ? (
              <>
                {/* ICA */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--brand-navy)' }}>ICA (Independent Contractor Agreement)</div>
                    <div style={{ fontSize: '12px', color: agent.agreement.ica.signatureName ? 'var(--status-success)' : 'var(--text-secondary)', marginTop: '2px' }}>
                      {agent.agreement.ica.signatureName ? `Signed by ${agent.agreement.ica.signatureName}` : 'Not signed'}
                      {agent.agreement.ica.signed_at && ` · ${new Date(agent.agreement.ica.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </div>
                    {agent.agreement.ica.entityName && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Entity: {agent.agreement.ica.entityName}{agent.agreement.ica.entityTitle ? ` — ${agent.agreement.ica.entityTitle}` : ''}</div>
                    )}
                  </div>
                  <a href={`/api/documents/filled?agentId=${id}&doc=ica`} target="_blank" rel="noopener noreferrer" style={{ padding: '4px 12px', borderRadius: '999px', border: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--brand-navy)', fontWeight: 500, textDecoration: 'none' }}>View PDF</a>
                </div>

                {/* AOA */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--brand-navy)' }}>AOA (Agent Ownership Agreement)</div>
                    <div style={{ fontSize: '12px', color: agent.agreement.aoa?.signatureName ? 'var(--status-success)' : 'var(--text-secondary)', marginTop: '2px' }}>
                      {agent.agreement.aoa?.signatureName ? `Signed by ${agent.agreement.aoa.signatureName}` : 'Not signed'}
                      {agent.agreement.aoa?.signed_at && ` · ${new Date(agent.agreement.aoa.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </div>
                    {agent.agreement.aoa?.assignedLevel && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Assigned Level: Level {agent.agreement.aoa.assignedLevel}</div>
                    )}
                  </div>
                  <a href={`/api/documents/filled?agentId=${id}&doc=aoa`} target="_blank" rel="noopener noreferrer" style={{ padding: '4px 12px', borderRadius: '999px', border: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--brand-navy)', fontWeight: 500, textDecoration: 'none' }}>View PDF</a>
                </div>

                {/* Business Standards */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--brand-navy)' }}>Business Standards</div>
                    <div style={{ fontSize: '12px', color: agent.agreement.businessStandards?.signatureName ? 'var(--status-success)' : 'var(--text-secondary)', marginTop: '2px' }}>
                      {agent.agreement.businessStandards?.signatureName ? `Signed by ${agent.agreement.businessStandards.signatureName}` : 'Not signed'}
                      {agent.agreement.businessStandards?.signed_at && ` · ${new Date(agent.agreement.businessStandards.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </div>
                  </div>
                  <a href={`/api/documents/filled?agentId=${id}&doc=businessStandards`} target="_blank" rel="noopener noreferrer" style={{ padding: '4px 12px', borderRadius: '999px', border: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--brand-navy)', fontWeight: 500, textDecoration: 'none' }}>View PDF</a>
                </div>

                {/* Summary row */}
                <div style={{ display: 'flex', gap: '16px', padding: '8px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {agent.agreement.all_signed_at && <span>All signed: {new Date(agent.agreement.all_signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                  {agent.agreement.esign_consent && <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>ESIGN Consent Granted</span>}
                </div>
              </>
            ) : (
              <>
                {/* Old checkbox format */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <InfoRow label="Background Auth" value={agent.agreement.background_auth_consent ? 'Authorized' : 'Pending'} />
                  <InfoRow label="Agent Agreement" value={agent.agreement.agent_agreement_consent ? 'Agreed' : 'Pending'} />
                  <InfoRow label="Business Standards" value={agent.agreement.business_standards_consent ? 'Agreed' : 'Pending'} />
                  <InfoRow label="Signature" value={agent.agreement.signature_name || '—'} />
                  <InfoRow label="Signed At" value={agent.agreement.signed_at ? new Date(agent.agreement.signed_at).toLocaleString() : '—'} />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                  <a href="/documents/NXT_Independent_Contractor_Agreement_Revised.pdf" target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--brand-blue-accent)', textDecoration: 'none', fontWeight: 600 }}>View ICA PDF</a>
                  <a href="/documents/NXT_Agent_Ownership_Agreement_Revised.pdf" target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--brand-blue-accent)', textDecoration: 'none', fontWeight: 600 }}>View AOA PDF</a>
                  <a href="/documents/NXT_Business_Standards_Revised.pdf" target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--brand-blue-accent)', textDecoration: 'none', fontWeight: 600 }}>View Standards PDF</a>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Reject Reason Modal */}
      {rejectingDocId && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3)',
        }}
          onClick={() => setRejectingDocId(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#fff', borderRadius: '16px', padding: 'var(--space-4)',
              maxWidth: '420px', width: '100%', boxShadow: '0 24px 48px rgba(0,0,0,0.15)',
            }}>
            <h3 style={{ color: 'var(--brand-navy)', margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-body)', fontWeight: 700 }}>
              Reject Document
            </h3>
            <p style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)', margin: '0 0 var(--space-2) 0' }}>
              Provide a reason so the agent knows what to fix.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Image is blurry, please re-upload a clearer copy"
              rows={3}
              style={{
                width: '100%', padding: 'var(--space-2)', borderRadius: '10px',
                border: '1.5px solid var(--border-color)', fontSize: 'var(--text-secondary)',
                resize: 'vertical', fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
              <Button variant="secondary" size="small" onClick={() => { setRejectingDocId(null); setRejectReason(''); }}>
                Cancel
              </Button>
              <button
                onClick={() => handleRejectDoc(rejectingDocId)}
                disabled={!rejectReason.trim()}
                style={{
                  padding: '8px 20px', borderRadius: '999px', border: 'none',
                  backgroundColor: rejectReason.trim() ? 'var(--status-error)' : 'rgba(0,0,0,0.1)',
                  color: '#fff', fontWeight: 600, fontSize: 'var(--text-secondary)',
                  cursor: rejectReason.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Reject Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Members (if this agent is a manager) */}
      {agent.role === 'admin' && teamMembers.length > 0 && (
        <Card style={{ marginTop: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-2) 0' }}>
            Team Members ({teamMembers.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {teamMembers.map(m => {
              const lvl = AGENT_LEVELS.find(l => l.level === (m.agentLevel || 1)) || AGENT_LEVELS[0];
              return (
                <div key={m.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Avatar name={dn(m)} photoUrl={m.photo_url} size={32} />
                    <div>
                      <div style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: 'var(--text-secondary)' }}>
                        {dn(m)}
                      </div>
                      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                        L{lvl.level} — {lvl.title}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/dashboard/team/${m.id}`)}
                    style={{
                      padding: '4px 12px', borderRadius: '999px', border: '1px solid var(--border-color)',
                      backgroundColor: 'transparent', cursor: 'pointer', fontSize: 'var(--text-caption)',
                      color: 'var(--brand-navy)', fontWeight: '500'
                    }}
                  >
                    View
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Commission Overrides */}
      <Card style={{ marginTop: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: 0 }}>
            Commission Splits
          </h3>
          {isSavingOverrides && (
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: 500 }}>Saving...</span>
          )}
        </div>
        <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', margin: '0 0 var(--space-2) 0' }}>
          People earning a share of {agent.first_name || agent.full_name?.split(' ')[0] || 'this agent'}&apos;s commissions.
        </p>
        {overridesLoading ? (
          <p style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)' }}>Loading...</p>
        ) : (
          <CommissionSplitBar
            overrides={commissionOverrides}
            agents={allAgents}
            agentId={id}
            agentName={dn(agent) || 'Agent'}
            readOnly={!isAdmin}
            onChange={async (newOverrides) => {
              setCommissionOverrides(newOverrides);
              setIsSavingOverrides(true);
              const res = await setOverridesBulk({
                agentId: id,
                agentName: dn(agent),
                overrides: newOverrides,
                agencyId: currentUser?.agency_id,
                actorUid: currentUser?.uid,
              });
              if (res.success) {
                setSuccessMsg('Commission splits saved');
              } else {
                setErrorMsg(res.error || 'Failed to save splits');
              }
              setIsSavingOverrides(false);
              setTimeout(() => { setSuccessMsg(null); setErrorMsg(null); }, 3000);
            }}
          />
        )}
      </Card>

      {/* Requests Section */}
      {isAdmin && (
        <Card style={{ marginTop: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: 0 }}>
              Requests
            </h3>
            <button
              onClick={() => setShowRequestModal(true)}
              style={{
                padding: '4px 12px', borderRadius: '8px', border: '1px solid var(--brand-blue-accent)',
                backgroundColor: 'rgba(227, 169, 74, 0.06)', color: 'var(--brand-navy)',
                fontSize: 'var(--text-caption)', fontWeight: 600, cursor: 'pointer',
              }}
            >
              + New Request
            </button>
          </div>
          {agentRequests.filter(r => r.status !== 'dismissed').length === 0 ? (
            <p style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)', margin: 0 }}>
              No requests sent to this agent yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {agentRequests.filter(r => r.status !== 'dismissed').map(req => {
                const typeLabels = {
                  upload_document: 'Upload Document',
                  provide_info: 'Provide Info',
                  update_profile: 'Update Profile',
                  complete_training: 'Complete Training',
                  other: 'Other',
                };
                const statusColors = {
                  pending: { bg: 'rgba(224, 142, 43, 0.1)', color: '#E08E2B', label: 'Pending' },
                  completed: { bg: 'rgba(47, 168, 79, 0.1)', color: '#2FA84F', label: 'Completed' },
                };
                const st = statusColors[req.status] || statusColors.pending;
                return (
                  <div key={req.id} style={{
                    padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)',
                    backgroundColor: req.status === 'pending' ? 'rgba(224, 142, 43, 0.03)' : 'rgba(47, 168, 79, 0.03)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                            backgroundColor: 'rgba(227, 169, 74, 0.1)', color: '#1B2A4E',
                          }}>
                            {typeLabels[req.requestType] || req.requestType}
                          </span>
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                            backgroundColor: st.bg, color: st.color,
                          }}>
                            {st.label}
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--brand-navy)' }}>{req.title}</div>
                        {req.description && (
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{req.description}</div>
                        )}
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Sent {req.createdAt ? new Date(req.createdAt).toLocaleDateString('en-US') : ''}
                          {req.completedAt && ` · Completed ${new Date(req.completedAt).toLocaleDateString('en-US')}`}
                        </div>
                      </div>
                      {req.status === 'pending' && (
                        <button
                          onClick={() => handleDismissRequest(req.id)}
                          style={{
                            background: 'none', border: 'none', color: 'var(--text-secondary)',
                            cursor: 'pointer', fontSize: '12px', flexShrink: 0,
                          }}
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Send Request Modal */}
      {showRequestModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3)',
        }}
          onClick={() => setShowRequestModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: '#fff', borderRadius: '16px', padding: 'var(--space-4)',
            maxWidth: '460px', width: '100%', boxShadow: '0 24px 48px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ color: 'var(--brand-navy)', margin: '0 0 4px 0', fontSize: 'var(--text-body)', fontWeight: 700 }}>
              Send Request to {dn(agent) || 'Agent'}
            </h3>
            <p style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)', margin: '0 0 var(--space-2) 0' }}>
              The agent will see this request on their dashboard and can act on it.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Request Type
                <select
                  value={requestType}
                  onChange={e => setRequestType(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px', color: 'var(--text-primary)' }}
                >
                  <option value="upload_document">Upload Document</option>
                  <option value="provide_info">Provide Information</option>
                  <option value="update_profile">Update Profile</option>
                  <option value="complete_training">Complete Training</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Title
                <input
                  value={requestTitle}
                  onChange={e => setRequestTitle(e.target.value)}
                  placeholder="e.g. Upload your E&O Certificate"
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px', color: 'var(--text-primary)' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Description (optional)
                <textarea
                  value={requestDesc}
                  onChange={e => setRequestDesc(e.target.value)}
                  placeholder="Additional details or instructions..."
                  rows={3}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
              <Button variant="secondary" size="small" onClick={() => setShowRequestModal(false)} disabled={isSendingRequest}>Cancel</Button>
              <Button size="small" onClick={handleSendRequest} isLoading={isSendingRequest} disabled={!requestTitle.trim()}>Send Request</Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Manager Modal */}
      {assignManagerOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3)',
          }}
          onClick={() => setAssignManagerOpen(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: '#fff', borderRadius: '16px', padding: 'var(--space-4)',
            maxWidth: '420px', width: '100%', boxShadow: '0 24px 48px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ color: 'var(--brand-navy)', margin: '0 0 4px 0', fontSize: 'var(--text-body)', fontWeight: 700 }}>
              Assign Upline
            </h3>
            <p style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)', margin: '0 0 var(--space-3) 0' }}>
              Assign <strong>{dn(agent)}</strong> to an upline.
            </p>
            <AgentSearchSelect
              items={allAgents.filter(a => (a.role === 'admin' || a.role === 'it_engineer') && a.id !== id)}
              value={selectedManagerId}
              onChange={(val) => setSelectedManagerId(val)}
              placeholder="Search agent by name or NXT ID..."
              emptyLabel="— No Upline —"
              renderItem={(mgr) => (
                <>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#0C1022', backgroundColor: 'rgba(12, 16, 34,0.08)', padding: '2px 8px', borderRadius: '6px', fontFamily: 'monospace', flexShrink: 0 }}>
                    {mgr.nxt_id || '---'}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{dn(mgr)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                    {mgr.is_owner ? 'Owner' : mgr.role === 'it_engineer' ? 'IT Engineer' : mgr.role}
                  </span>
                </>
              )}
              style={{ marginBottom: 'var(--space-3)' }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
              <Button variant="secondary" size="small" onClick={() => setAssignManagerOpen(false)} disabled={isAssigningManager}>Cancel</Button>
              <Button
                size="small"
                onClick={async () => {
                  setIsAssigningManager(true);
                  const res = await moveAgent(currentUser.uid, id, selectedManagerId || null);
                  if (res.success) {
                    setAgent(prev => ({ ...prev, upline_id: selectedManagerId || null }));
                    setAssignManagerOpen(false);
                    setSuccessMsg(res.noChange ? 'No change needed' : (selectedManagerId ? 'Upline assigned' : 'Upline removed') + (res.descendantsUpdated > 0 ? ` (${res.descendantsUpdated} paths updated)` : ''));
                  } else {
                    setErrorMsg(res.error);
                  }
                  setIsAssigningManager(false);
                  setTimeout(() => { setSuccessMsg(null); setErrorMsg(null); }, 3000);
                }}
                isLoading={isAssigningManager}
              >
                {selectedManagerId ? 'Assign' : 'Remove Upline'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3)',
        }}
          onClick={() => setShowDeleteConfirm(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#fff', borderRadius: '16px', padding: 'var(--space-4)',
              maxWidth: '420px', width: '100%', boxShadow: '0 24px 48px rgba(0,0,0,0.15)',
            }}>
            <h3 style={{ color: 'var(--status-error)', margin: '0 0 var(--space-1) 0', fontSize: 'var(--text-body)', fontWeight: 700 }}>
              Permanently Delete Agent?
            </h3>
            <p style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)', margin: '0 0 var(--space-1) 0', lineHeight: 1.5 }}>
              This will permanently delete <strong>{dn(agent)}</strong> and remove their Firebase account, all uploaded documents, and access. This action cannot be undone.
            </p>
            {errorMsg && (
              <p style={{ color: 'var(--status-error)', fontSize: 'var(--text-caption)', fontWeight: 600, margin: '0 0 var(--space-2) 0' }}>
                {errorMsg}
              </p>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
              <Button variant="secondary" size="small" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                Cancel
              </Button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  padding: '8px 20px', borderRadius: '999px', border: 'none',
                  backgroundColor: 'var(--status-error)', color: '#fff',
                  fontWeight: 600, fontSize: 'var(--text-secondary)',
                  cursor: isDeleting ? 'wait' : 'pointer',
                  opacity: isDeleting ? 0.6 : 1,
                }}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
