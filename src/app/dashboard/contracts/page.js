"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase/clientApp';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { useUser } from '@/context/UserContext';
import { fetchContracts, createContract, updateContract } from '@/app/actions/contracts';
import { fetchCarriers } from '@/app/actions/commissions';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import AgentSearchSelect from '@/components/AgentSearchSelect';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

const STATUS_COLORS = {
  active: { bg: 'rgba(47,168,79,0.1)', text: '#2FA84F' },
  pending: { bg: 'rgba(224,142,43,0.1)', text: '#E08E2B' },
  terminated: { bg: 'rgba(211,63,63,0.1)', text: '#D33F3F' },
  suspended: { bg: 'rgba(107,114,128,0.1)', text: '#5F5C56' },
};

export default function ContractsPage() {
  const { userProfile } = useUser();
  const [contracts, setContracts] = useState([]);
  const [carriers, setCarriers] = useState({});
  const [agents, setAgents] = useState({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCarrier, setFilterCarrier] = useState('all');

  // Form state
  const [formAgentId, setFormAgentId] = useState('');
  const [formCarrierId, setFormCarrierId] = useState('');
  const [formContractNumber, setFormContractNumber] = useState('');
  const [formContractLevel, setFormContractLevel] = useState('');
  const [formStatus, setFormStatus] = useState('pending');
  const [formEffectiveDate, setFormEffectiveDate] = useState('');
  const [formProductLines, setFormProductLines] = useState('');
  const [formAppointedStates, setFormAppointedStates] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'it_engineer';

  const loadData = useCallback(async () => {
    try {
      const [contractsRes, carriersRes] = await Promise.all([
        fetchContracts(userProfile.agency_id, userProfile.uid, userProfile.role, userProfile.hierarchyPath),
        fetchCarriers(),
      ]);

      if (contractsRes.success) setContracts(contractsRes.contracts);
      if (carriersRes.success) {
        const map = {};
        carriersRes.carriers.forEach(c => { map[c.id] = c.name; });
        setCarriers(map);
      }

      if (userProfile.role === 'admin' || userProfile.role === 'it_engineer') {
        try {
          const agentsSnap = await getDocs(query(collection(db, 'agents'), where('agency_id', '==', userProfile.agency_id)));
          const map = {};
          agentsSnap.forEach(d => {
            const data = d.data();
            map[d.id] = [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(' ') || data.full_name || `${data.firstName || ''} ${data.lastName || ''}`.trim();
          });
          setAgents(map);
        } catch (e) { /* ignore */ }
      }
    } catch (e) {
      // silenced
    }
    setDataLoaded(true);
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [userProfile, loadData]);

  const resetForm = () => {
    setFormAgentId('');
    setFormCarrierId('');
    setFormContractNumber('');
    setFormContractLevel('');
    setFormStatus('pending');
    setFormEffectiveDate('');
    setFormProductLines('');
    setFormAppointedStates('');
    setFormNotes('');
    setEditingContract(null);
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditingContract(c);
    setFormAgentId(c.agentId || '');
    setFormCarrierId(c.carrierId || '');
    setFormContractNumber(c.contractNumber || '');
    setFormContractLevel(c.contractLevel || '');
    setFormStatus(c.status || 'pending');
    setFormEffectiveDate(c.effectiveDate || '');
    setFormProductLines((c.productLines || []).join(', '));
    setFormAppointedStates((c.appointedStates || []).join(', '));
    setFormNotes(c.notes || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formCarrierId || !formAgentId) return;
    setIsSaving(true);

    const payload = {
      agencyId: userProfile.agency_id,
      agentId: formAgentId,
      carrierId: formCarrierId,
      contractNumber: formContractNumber,
      contractLevel: formContractLevel,
      status: formStatus,
      effectiveDate: formEffectiveDate,
      productLines: formProductLines.split(',').map(s => s.trim()).filter(Boolean),
      appointedStates: formAppointedStates.split(',').map(s => s.trim()).filter(Boolean),
      notes: formNotes,
    };

    let res;
    if (editingContract) {
      res = await updateContract(editingContract.id, payload);
    } else {
      res = await createContract(payload);
    }

    if (res.success) {
      setShowModal(false);
      resetForm();
      await loadData();
    }
    setIsSaving(false);
  };

  const filtered = contracts.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterCarrier !== 'all' && c.carrierId !== filterCarrier) return false;
    return true;
  });

  if (!userProfile) {
    return <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'40vh'}}><LoadingSpinner label="Loading..." /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Contracts & Appointments"
        actions={isAdmin ? <Button onClick={openAdd}>+ Add Contract</Button> : null}
      />

      {/* Loading indicator */}
      {!dataLoaded && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
          <LoadingSpinner label="Loading contracts..." />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px', backgroundColor: '#fff' }}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="terminated">Terminated</option>
          <option value="suspended">Suspended</option>
        </select>
        <select value={filterCarrier} onChange={e => setFilterCarrier(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px', backgroundColor: '#fff' }}>
          <option value="all">All Carriers</option>
          {Object.entries(carriers).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            variant="minimal"
            title="No contracts found"
            description={dataLoaded ? (isAdmin ? 'Add your first carrier contract above.' : 'No contracts assigned yet.') : undefined}
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                {isAdmin && <th scope="col" style={thStyle}>AGENT</th>}
                <th scope="col" style={thStyle}>CARRIER</th>
                <th scope="col" style={thStyle}>CONTRACT #</th>
                <th scope="col" style={thStyle}>LEVEL</th>
                <th scope="col" style={thStyle}>STATUS</th>
                <th scope="col" style={thStyle}>EFFECTIVE</th>
                <th scope="col" style={thStyle}>PRODUCT LINES</th>
                {isAdmin && <th scope="col" style={thStyle}>ACTIONS</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const sc = STATUS_COLORS[c.status] || STATUS_COLORS.pending;
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {isAdmin && <td style={tdStyle}>{agents[c.agentId] || c.agentId}</td>}
                    <td style={{ ...tdStyle, fontWeight: '500' }}>{carriers[c.carrierId] || c.carrierId}</td>
                    <td style={tdStyle}>{c.contractNumber || '--'}</td>
                    <td style={tdStyle}>{c.contractLevel || '--'}</td>
                    <td style={tdStyle}>
                      <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', backgroundColor: sc.bg, color: sc.text }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={tdStyle}>{c.effectiveDate || '--'}</td>
                    <td style={tdStyle}>{(c.productLines || []).join(', ') || '--'}</td>
                    {isAdmin && (
                      <td style={tdStyle}>
                        <button onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', color: 'var(--brand-blue-accent)', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Edit</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); resetForm(); } }}>
          <Card>
            <div style={{ width: '480px', maxHeight: '80vh', overflowY: 'auto' }}>
              <h2 style={{ color: 'var(--brand-navy)', marginTop: 0, marginBottom: 'var(--space-3)' }}>
                {editingContract ? 'Edit Contract' : 'Add Contract'}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label style={labelStyle}>
                  Agent
                  <AgentSearchSelect
                    items={Object.entries(agents).map(([id, name]) => ({ id, label: name }))}
                    value={formAgentId}
                    onChange={(id) => setFormAgentId(id)}
                    placeholder="Search agent..."
                    displayValue={(item) => item.label}
                    renderItem={(item) => (
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{item.label}</span>
                    )}
                    searchFields={(item) => [item.label]}
                  />
                </label>

                <label style={labelStyle}>
                  Carrier
                  <select value={formCarrierId} onChange={e => setFormCarrierId(e.target.value)} style={inputStyle}>
                    <option value="">Select Carrier</option>
                    {Object.entries(carriers).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </label>

                <label style={labelStyle}>
                  Contract Number
                  <input value={formContractNumber} onChange={e => setFormContractNumber(e.target.value)} style={inputStyle} placeholder="e.g. CT-12345" />
                </label>

                <label style={labelStyle}>
                  Contract Level
                  <input value={formContractLevel} onChange={e => setFormContractLevel(e.target.value)} style={inputStyle} placeholder="e.g. Senior, Associate" />
                </label>

                <label style={labelStyle}>
                  Status
                  <select value={formStatus} onChange={e => setFormStatus(e.target.value)} style={inputStyle}>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="terminated">Terminated</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  Effective Date
                  <input type="date" value={formEffectiveDate} onChange={e => setFormEffectiveDate(e.target.value)} style={inputStyle} />
                </label>

                <label style={labelStyle}>
                  Product Lines (comma-separated)
                  <input value={formProductLines} onChange={e => setFormProductLines(e.target.value)} style={inputStyle} placeholder="life, annuity, health" />
                </label>

                <label style={labelStyle}>
                  Appointed States (comma-separated)
                  <input value={formAppointedStates} onChange={e => setFormAppointedStates(e.target.value)} style={inputStyle} placeholder="TX, CA, FL" />
                </label>

                <label style={labelStyle}>
                  Notes
                  <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button>
                <Button onClick={handleSave} isLoading={isSaving} disabled={!formCarrierId || !formAgentId}>
                  {editingContract ? 'Save Changes' : 'Add Contract'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' };
const tdStyle = { padding: '10px 12px', fontSize: '14px', color: 'var(--text-primary)' };
const labelStyle = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' };
const inputStyle = { padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px', color: 'var(--text-primary)' };
