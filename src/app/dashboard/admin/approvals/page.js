"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/context/UserContext';
import { fetchPendingApprovals, approveAgent, rejectAgent } from '@/app/actions/profile';
import { fetchMyGroups } from '@/app/actions/groups';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Avatar from '@/components/Avatar';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

const dn = (a) => [a?.first_name, a?.middle_name, a?.last_name].filter(Boolean).join(' ') || a?.full_name || a?.name || a?.email || '';

export default function AdminApprovalsPage() {
  const { userProfile } = useUser();
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [expandedAgent, setExpandedAgent] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [isTeamLeader, setIsTeamLeader] = useState(false);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'it_engineer' || userProfile?.is_owner;
  const canApprove = isAdmin || isTeamLeader;

  const loadPending = useCallback(async () => {
    setIsLoading(true);
    const result = await fetchPendingApprovals();
    if (result.success) {
      setAgents(result.agents);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!userProfile?.agency_id) return;

    const init = async () => {
      // Check if user is a team leader (even if not admin)
      if (!isAdmin) {
        const groupRes = await fetchMyGroups();
        if (groupRes.success && groupRes.groupIds.includes('team-leaders')) {
          setIsTeamLeader(true);
        } else {
          return; // Not admin and not team leader — don't load
        }
      }
      await loadPending();
    };
    init();
  }, [userProfile?.agency_id, isAdmin, loadPending]);

  async function handleApprove(agentId) {
    setActionLoading(agentId);
    setMessage(null);
    const result = await approveAgent(agentId);
    if (result.success) {
      setAgents(prev => prev.filter(a => a.id !== agentId));
      setMessage({ type: 'success', text: 'Agent approved successfully. They will receive an email notification.' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to approve agent.' });
    }
    setActionLoading(null);
  }

  async function handleReject(agentId) {
    setActionLoading(agentId);
    setMessage(null);
    const result = await rejectAgent(agentId, rejectReason);
    if (result.success) {
      setAgents(prev => prev.filter(a => a.id !== agentId));
      setRejectingId(null);
      setRejectReason('');
      setMessage({ type: 'success', text: 'Agent application rejected.' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to reject agent.' });
    }
    setActionLoading(null);
  }

  if (!canApprove) {
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
        title="Agent Approvals"
        subtitle="Review and approve agents who have completed onboarding."
      />

      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px', marginBottom: '16px',
          backgroundColor: message.type === 'success' ? 'rgba(47, 168, 79, 0.08)' : 'rgba(211, 63, 63, 0.08)',
          border: `1px solid ${message.type === 'success' ? 'rgba(47, 168, 79, 0.2)' : 'rgba(211, 63, 63, 0.2)'}`,
          color: message.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
          fontSize: '16px', fontWeight: '500',
        }}>
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
          <LoadingSpinner label="Loading pending approvals..." />
        </div>
      ) : agents.length === 0 ? (
        <EmptyState variant="minimal" title="No agents are waiting for approval right now." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {agents.map(agent => (
            <Card key={agent.id}>
              <div style={{ padding: '20px 24px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <Avatar name={dn(agent)} photoUrl={agent.photo_url} size={44} />
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--brand-navy)' }}>
                        {dn(agent)}
                      </h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: '15px', color: 'var(--text-secondary)' }}>
                        {agent.email} &middot; {agent.role === 'it_engineer' ? 'IT Engineer' : agent.role?.charAt(0).toUpperCase() + agent.role?.slice(1)}
                        {agent.nxt_id && <span style={{ marginLeft: '8px', fontFamily: 'monospace', backgroundColor: 'rgba(10,37,64,0.06)', padding: '1px 6px', borderRadius: '4px', fontSize: '14px' }}>{agent.nxt_id}</span>}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button className="nxt-btn"
                      onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                    >
                      {expandedAgent === agent.id ? 'Hide Details' : 'View Details'}
                    </button>
                    {rejectingId !== agent.id && (
                      <>
                        <button className="nxt-btn nxt-btn-danger"
                          onClick={() => { setRejectingId(agent.id); setRejectReason(''); }}
                          disabled={actionLoading === agent.id}
                        >
                          Reject
                        </button>
                        <Button
                          onClick={() => handleApprove(agent.id)}
                          isLoading={actionLoading === agent.id}
                        >
                          Approve
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Reject reason input */}
                {rejectingId === agent.id && (
                  <div style={{
                    marginTop: '12px', padding: '16px', borderRadius: '10px',
                    backgroundColor: 'rgba(211, 63, 63, 0.04)', border: '1px solid rgba(211, 63, 63, 0.15)',
                  }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '600', color: '#B42318' }}>Rejection Reason</p>
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Provide a reason for rejection (optional)..."
                      rows={2}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '8px',
                        border: '1px solid var(--border-color)', fontSize: '16px',
                        resize: 'vertical', fontFamily: 'inherit',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
                      <button className="nxt-btn nxt-btn-sm"
                        onClick={() => { setRejectingId(null); setRejectReason(''); }}
                      >
                        Cancel
                      </button>
                      <button className="nxt-btn nxt-btn-sm nxt-btn-danger"
                        onClick={() => handleReject(agent.id)}
                        disabled={actionLoading === agent.id}
                      >
                        {actionLoading === agent.id ? 'Rejecting...' : 'Confirm Reject'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded details */}
                {expandedAgent === agent.id && (
                  <div style={{
                    marginTop: '16px', padding: '20px', borderRadius: '12px',
                    backgroundColor: 'var(--surface-page)', border: '1px solid var(--border-color)',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <DetailSection title="Personal Information">
                        <DetailRow label="Legal Name" value={dn(agent)} />
                        <DetailRow label="Preferred Name" value={agent.preferred_name} />
                        <DetailRow label="Date of Birth" value={agent.date_of_birth} />
                        <DetailRow label="Phone" value={agent.phone} />
                        <DetailRow label="SSN (last 4)" value={agent.ssn_last4 ? `***-**-${agent.ssn_last4}` : '—'} />
                        <DetailRow label="Email" value={agent.email} />
                        {agent.address && (
                          <DetailRow
                            label="Address"
                            value={`${agent.address.line1 || ''}${agent.address.line2 ? `, ${agent.address.line2}` : ''}, ${agent.address.city || ''}, ${agent.address.state || ''} ${agent.address.zip || ''}`}
                          />
                        )}
                        <DetailRow label="Recruited By" value={agent.recruited_by} />
                      </DetailSection>

                      <DetailSection title="Employment">
                        {Array.isArray(agent.employment) && agent.employment.length > 0 ? (
                          agent.employment.map((emp, idx) => (
                            <div key={idx} style={{ marginBottom: idx < agent.employment.length - 1 ? '12px' : 0, paddingBottom: idx < agent.employment.length - 1 ? '12px' : 0, borderBottom: idx < agent.employment.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
                              <DetailRow label="Employer" value={emp.employer} />
                              <DetailRow label="Position" value={emp.position} />
                              <DetailRow label="Work Phone" value={emp.work_phone} />
                              <DetailRow label="Start Date" value={emp.start_date} />
                              {emp.end_date && <DetailRow label="End Date" value={emp.end_date} />}
                              {emp.current && <DetailRow label="Current" value="Yes" />}
                            </div>
                          ))
                        ) : agent.employment && !Array.isArray(agent.employment) ? (
                          <>
                            <DetailRow label="Employer" value={agent.employment.employer} />
                            <DetailRow label="Position" value={agent.employment.position} />
                            <DetailRow label="Work Phone" value={agent.employment.work_phone} />
                            <DetailRow label="Start Date" value={agent.employment.start_date} />
                          </>
                        ) : (
                          <DetailRow label="Employer" value="—" />
                        )}
                      </DetailSection>

                      <DetailSection title="Background Check">
                        {agent.qualification && Object.entries(agent.qualification).map(([key, val]) => (
                          <DetailRow key={key} label={key.replace(/_/g, ' ')} value={val === true ? 'Yes' : val === false ? 'No' : '—'} />
                        ))}
                      </DetailSection>

                      <DetailSection title="Signed Documents">
                        {agent.agreement?.ica ? (
                          <>
                            {/* New per-document format */}
                            <DetailRow
                              label="ICA (Independent Contractor Agreement)"
                              value={agent.agreement.ica.signatureName ? `Signed by ${agent.agreement.ica.signatureName}` : 'Not signed'}
                              good={!!agent.agreement.ica.signatureName}
                            />
                            {agent.agreement.ica.signed_at && (
                              <DetailRow label="ICA Signed At" value={new Date(agent.agreement.ica.signed_at).toLocaleString()} />
                            )}
                            {agent.agreement.ica.entityName && (
                              <DetailRow label="ICA Entity" value={`${agent.agreement.ica.entityName} — ${agent.agreement.ica.entityTitle || ''}`} />
                            )}

                            <DetailRow
                              label="AOA (Agent Ownership Agreement)"
                              value={agent.agreement?.aoa?.signatureName ? `Signed by ${agent.agreement.aoa.signatureName}` : 'Not signed'}
                              good={!!agent.agreement?.aoa?.signatureName}
                            />
                            {agent.agreement?.aoa?.signed_at && (
                              <DetailRow label="AOA Signed At" value={new Date(agent.agreement.aoa.signed_at).toLocaleString()} />
                            )}
                            {agent.agreement?.aoa?.assignedLevel && (
                              <DetailRow label="AOA Assigned Level" value={`Level ${agent.agreement.aoa.assignedLevel}`} />
                            )}

                            <DetailRow
                              label="Business Standards"
                              value={agent.agreement?.businessStandards?.signatureName ? `Signed by ${agent.agreement.businessStandards.signatureName}` : 'Not signed'}
                              good={!!agent.agreement?.businessStandards?.signatureName}
                            />
                            {agent.agreement?.businessStandards?.signed_at && (
                              <DetailRow label="Standards Signed At" value={new Date(agent.agreement.businessStandards.signed_at).toLocaleString()} />
                            )}

                            <DetailRow label="All Documents Signed" value={agent.agreement?.all_signed_at ? new Date(agent.agreement.all_signed_at).toLocaleString() : '—'} good={!!agent.agreement?.all_signed_at} />
                            <DetailRow label="ESIGN Consent" value={agent.agreement?.esign_consent ? 'Granted' : 'Pending'} good={agent.agreement?.esign_consent} />
                          </>
                        ) : (
                          <>
                            {/* Old checkbox-based format */}
                            <DetailRow label="Background Auth" value={agent.agreement?.background_auth_consent ? 'Authorized' : 'Pending'} good={agent.agreement?.background_auth_consent} />
                            <DetailRow label="Agent Agreement" value={agent.agreement?.agent_agreement_consent ? 'Agreed' : 'Pending'} good={agent.agreement?.agent_agreement_consent} />
                            <DetailRow label="Business Standards" value={agent.agreement?.business_standards_consent ? 'Agreed' : 'Pending'} good={agent.agreement?.business_standards_consent} />
                            <DetailRow label="Signature" value={agent.agreement?.signature_name || '—'} />
                            <DetailRow label="Signed At" value={agent.agreement?.signed_at ? new Date(agent.agreement.signed_at).toLocaleString() : '—'} />
                          </>
                        )}

                        {/* PDF links — signed (filled) if new format, blank if old */}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                          {agent.agreement?.ica ? (
                            <>
                              <a className="nxt-btn nxt-btn-sm" href={`/api/documents/filled?agentId=${agent.id}&doc=ica`} target="_blank" rel="noopener noreferrer">
                                View Signed ICA
                              </a>
                              <a className="nxt-btn nxt-btn-sm" href={`/api/documents/filled?agentId=${agent.id}&doc=aoa`} target="_blank" rel="noopener noreferrer">
                                View Signed AOA
                              </a>
                              <a className="nxt-btn nxt-btn-sm" href={`/api/documents/filled?agentId=${agent.id}&doc=businessStandards`} target="_blank" rel="noopener noreferrer">
                                View Signed Standards
                              </a>
                            </>
                          ) : (
                            <>
                              <a className="nxt-btn nxt-btn-sm" href="/documents/NXT_Independent_Contractor_Agreement_Revised.pdf" target="_blank" rel="noopener noreferrer">
                                View ICA PDF
                              </a>
                              <a className="nxt-btn nxt-btn-sm" href="/documents/NXT_Agent_Ownership_Agreement_Revised.pdf" target="_blank" rel="noopener noreferrer">
                                View AOA PDF
                              </a>
                              <a className="nxt-btn nxt-btn-sm" href="/documents/NXT_Business_Standards_Revised.pdf" target="_blank" rel="noopener noreferrer">
                                View Standards PDF
                              </a>
                            </>
                          )}
                        </div>
                      </DetailSection>

                      {agent.payment && (
                        <DetailSection title="Payment">
                          <DetailRow label="Card" value={agent.payment.cardLastFour ? `**** ${agent.payment.cardLastFour}` : '—'} />
                          <DetailRow label="Billing ZIP" value={agent.payment.billingZip} />
                        </DetailSection>
                      )}

                      <DetailSection title="Metadata">
                        <DetailRow label="Agent Level" value={agent.agentLevel ? `Level ${agent.agentLevel}` : '—'} />
                        <DetailRow label="Contract Level" value={agent.contractLevel} />
                        <DetailRow label="Onboarding Completed" value={agent.onboarding_completed_at ? new Date(agent.onboarding_completed_at).toLocaleString() : '—'} />
                      </DetailSection>
                    </div>
                  </div>
                )}

                {/* Submitted time */}
                {agent.onboarding_completed_at && (
                  <p style={{ margin: '12px 0 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    Submitted {timeAgo(agent.onboarding_completed_at)}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div>
      <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--brand-navy)', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {title}
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value, good }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{
        fontWeight: '500',
        color: good === true ? 'var(--status-success)' : good === false ? 'var(--status-error)' : 'var(--text-primary)',
      }}>
        {value || '—'}
      </span>
    </div>
  );
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
