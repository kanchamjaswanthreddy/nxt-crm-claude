"use client";

import React, { useState, useEffect, useCallback } from 'react';
import StatTiles from '@/components/ui/StatTiles';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { getClient, updateClient, addPolicy, fetchPolicies, updatePolicy, deletePolicy, addClientNote, fetchClientNotes } from '@/app/actions/clients';
import { fetchCarriers } from '@/app/actions/commissions';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

import SegTabs from '@/components/ui/SegTabs';
function CarrierCombobox({ value, onChange, carriers }) {
  const [open, setOpen] = useState(false);
  const filtered = carriers.filter(n => !value || n.toLowerCase().includes(value.toLowerCase()));

  return (
    <div style={{ position: 'relative' }}>
      <label style={{ display: 'block', fontFamily: 'var(--font-base)', fontSize: '17px', color: 'var(--text-primary)', marginBottom: '8px', fontWeight: '500' }}>Carrier *</label>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 250)}
        placeholder="Select or type carrier name"
        autoComplete="off"
        style={{
          width: '100%', padding: '16px 16px', borderRadius: '12px',
          border: '1px solid var(--border-color)', fontSize: '17px',
          fontFamily: 'var(--font-base)', backgroundColor: 'var(--surface-card)',
          color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
        }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
          backgroundColor: '#fff', border: '1px solid var(--border-color)',
          borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          maxHeight: '220px', overflowY: 'auto', marginTop: '4px',
        }}>
          {filtered.slice(0, 50).map(name => (
            <div
              key={name}
              onMouseDown={(e) => { e.preventDefault(); onChange(name); setOpen(false); }}
              style={{
                padding: '12px 16px', cursor: 'pointer', fontSize: '16px',
                borderBottom: '1px solid rgba(0,0,0,0.04)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(12, 16, 34,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const POLICY_TYPES = [
  'Term Life', 'Whole Life', 'Universal Life', 'Indexed Universal Life', 'Variable Life',
  'Final Expense', 'Medicare Supplement', 'Medicare Advantage', 'Health', 'Dental', 'Vision',
  'Homeowners', 'Auto', 'Umbrella', 'Disability', 'Long-Term Care', 'Annuity', 'Other'
];

const POLICY_STATUSES = [
  { value: 'active', label: 'Active', color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
  { value: 'pending', label: 'Pending', color: '#ca8a04', bg: 'rgba(202,138,4,0.08)' },
  { value: 'lapsed', label: 'Lapsed', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
  { value: 'cancelled', label: 'Cancelled', color: '#5F5C56', bg: 'rgba(107,114,128,0.08)' },
  { value: 'expired', label: 'Expired', color: '#5F5C56', bg: 'rgba(107,114,128,0.08)' },
];

function PolicyTypeIcon({ type }) {
  const iconMap = {
    'Term Life': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    'Whole Life': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg>,
    'Universal Life': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    'Indexed Universal Life': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    'Variable Life': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    'Final Expense': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
    'Medicare Supplement': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3z"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>,
    'Medicare Advantage': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3z"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>,
    'Health': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
    'Dental': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    'Vision': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    'Homeowners': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    'Auto': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    'Umbrella': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"/></svg>,
    'Disability': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>,
    'Long-Term Care': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    'Annuity': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    'Other': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  };
  return iconMap[type] || iconMap['Other'];
}

export default function ClientDetailPage({ params }) {
  const { id } = React.use(params);
  const router = useRouter();
  const { userProfile } = useUser();
  const [client, setClient] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Policy modal
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [policyForm, setPolicyForm] = useState(defaultPolicyForm());
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [policyError, setPolicyError] = useState('');

  // Beneficiary
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryRelation, setBeneficiaryRelation] = useState('');
  const [beneficiaryPercent, setBeneficiaryPercent] = useState('');

  // Notes
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Carriers list for dropdown
  const [carrierNames, setCarrierNames] = useState([]);
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });

  function defaultPolicyForm() {
    return {
      carrier: '', policyNumber: '', type: 'Term Life', status: 'active',
      premium: '', premiumFrequency: 'monthly', coverageAmount: '',
      effectiveDate: '', expiryDate: '', beneficiaries: [], notes: '',
    };
  }

  const loadClient = useCallback(async () => {
    if (!id) return;
    const res = await getClient(id);
    if (res.success) {
      setClient(res.client);
      setEditForm({
        firstName: res.client.firstName,
        lastName: res.client.lastName,
        email: res.client.email || '',
        phone: res.client.phone || '',
        dateOfBirth: res.client.dateOfBirth || '',
        gender: res.client.gender || '',
        maritalStatus: res.client.maritalStatus || '',
        ssn4: res.client.ssn4 || '',
        employer: res.client.employer || '',
        occupation: res.client.occupation || '',
        annualIncome: res.client.annualIncome || '',
        preferredContact: res.client.preferredContact || 'email',
        street: res.client.address?.street || '',
        city: res.client.address?.city || '',
        state: res.client.address?.state || '',
        zip: res.client.address?.zip || '',
      });
    } else {
      router.push('/dashboard/clients');
    }
    setIsLoading(false);
  }, [id, router]);

  const loadPolicies = useCallback(async () => {
    if (!id) return;
    const res = await fetchPolicies(id);
    if (res.success) setPolicies(res.policies);
  }, [id]);

  const loadNotes = useCallback(async () => {
    if (!id) return;
    const res = await fetchClientNotes(id);
    if (res.success) setNotes(res.notes);
  }, [id]);

  useEffect(() => {
    if (!userProfile || !id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadClient();
    loadPolicies();
    loadNotes();
    // Load carrier names for policy form dropdown
    const loadCarriers = async () => {
      try {
        const res = await fetchCarriers();
        if (res.success && res.carriers?.length) {
          const names = res.carriers
            .filter(c => c.active !== false && c.name)
            .map(c => c.name)
            .sort();
          setCarrierNames(names);
        }
      } catch (err) {
        // silenced
      }
    };
    loadCarriers();
  }, [userProfile, id, loadClient, loadPolicies, loadNotes]);

  const handleSaveEdit = async () => {
    setEditError('');
    setIsSavingEdit(true);
    const res = await updateClient(id, {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      email: editForm.email || null,
      phone: editForm.phone || null,
      dateOfBirth: editForm.dateOfBirth || null,
      gender: editForm.gender || null,
      maritalStatus: editForm.maritalStatus || null,
      ssn4: editForm.ssn4 || null,
      employer: editForm.employer || null,
      occupation: editForm.occupation || null,
      annualIncome: editForm.annualIncome ? Number(editForm.annualIncome) : null,
      preferredContact: editForm.preferredContact,
      address: {
        street: editForm.street,
        city: editForm.city,
        state: editForm.state,
        zip: editForm.zip,
      },
    });
    if (res.success) {
      setIsEditing(false);
      loadClient();
    } else {
      setEditError(res.error || 'Failed to save changes.');
    }
    setIsSavingEdit(false);
  };

  const openAddPolicy = () => {
    setEditingPolicy(null);
    setPolicyForm(defaultPolicyForm());
    setBeneficiaryName('');
    setBeneficiaryRelation('');
    setBeneficiaryPercent('');
    setPolicyError('');
    setIsPolicyModalOpen(true);
  };

  const openEditPolicy = (policy) => {
    setEditingPolicy(policy);
    setPolicyError('');
    setPolicyForm({
      carrier: policy.carrier,
      policyNumber: policy.policyNumber,
      type: policy.type,
      status: policy.status,
      premium: policy.premium || '',
      premiumFrequency: policy.premiumFrequency || 'monthly',
      coverageAmount: policy.coverageAmount || '',
      effectiveDate: policy.effectiveDate || '',
      expiryDate: policy.expiryDate || '',
      beneficiaries: policy.beneficiaries || [],
      notes: policy.notes || '',
    });
    setIsPolicyModalOpen(true);
  };

  const addBeneficiary = () => {
    if (!beneficiaryName) return;
    setPolicyForm({
      ...policyForm,
      beneficiaries: [
        ...policyForm.beneficiaries,
        { name: beneficiaryName, relationship: beneficiaryRelation, percentage: Number(beneficiaryPercent) || 0 },
      ],
    });
    setBeneficiaryName('');
    setBeneficiaryRelation('');
    setBeneficiaryPercent('');
  };

  const removeBeneficiary = (idx) => {
    setPolicyForm({
      ...policyForm,
      beneficiaries: policyForm.beneficiaries.filter((_, i) => i !== idx),
    });
  };

  const handleSavePolicy = async () => {
    if (!policyForm.carrier || !policyForm.policyNumber || !policyForm.type) return;
    setPolicyError('');
    setIsSavingPolicy(true);

    let res;
    if (editingPolicy) {
      res = await updatePolicy(id, editingPolicy.id, policyForm);
    } else {
      res = await addPolicy(id, policyForm);
    }

    if (res.success) {
      setIsPolicyModalOpen(false);
      loadPolicies();
      if (!editingPolicy) loadClient();
    } else {
      setPolicyError(res.error || 'Failed to save policy.');
    }
    setIsSavingPolicy(false);
  };

  const handleDeletePolicy = (policyId) => {
    setConfirmState({
      open: true,
      title: 'Delete Policy',
      message: 'Delete this policy? This cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        const res = await deletePolicy(id, policyId);
        if (res.success) {
          loadPolicies();
          loadClient();
        }
      },
    });
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setIsAddingNote(true);
    const res = await addClientNote(id, newNote);
    if (res.success) {
      setNotes([
        { id: res.id, clientId: id, authorAgentId: userProfile.uid, body: newNote, createdAt: new Date().toISOString() },
        ...notes,
      ]);
      setNewNote('');
    }
    setIsAddingNote(false);
  };

  if (isLoading || !client) {
    return (
      <div style={{ padding: '40px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '20px', height: '20px', border: '2px solid var(--brand-gold)',
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '17px' }}>Loading client...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const fmt = (v) => v ? `$${Number(v).toLocaleString()}` : '--';
  const activePolicies = policies.filter(p => p.status === 'active');
  const totalPremium = policies.reduce((sum, p) => sum + (p.premium ? Number(p.premium) : 0), 0);
  const totalCoverage = policies.reduce((sum, p) => sum + (p.coverageAmount ? Number(p.coverageAmount) : 0), 0);
  const initials = `${client.firstName?.[0] || ''}${client.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div>
      {/* Back button */}
      <button className="nxt-back"
        onClick={() => router.push('/dashboard/clients')}
      >
        Back to Clients
      </button>

      {/* Client Header Card */}
      <Card>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '24px',
          padding: '8px 0', flexWrap: 'wrap',
        }}>
          {/* Avatar */}
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--brand-navy) 0%, #1B2A4E 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '24px', fontWeight: 800,
            flexShrink: 0, letterSpacing: '1px',
          }}>
            {initials}
          </div>

          {/* Name & contact */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h1 data-plain style={{ margin: '0 0 6px', color: 'var(--brand-navy)', fontSize: '24px', fontWeight: 800 }}>
              {client.firstName} {client.lastName}
            </h1>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '16px', color: 'var(--text-secondary)' }}>
              {client.email && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> {client.email}
                </span>
              )}
              {client.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> {client.phone}
                </span>
              )}
              {client.address?.city && client.address?.state && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> {client.address.city}, {client.address.state}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
            <Button variant="secondary" onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? 'Cancel Edit' : 'Edit Client'}
            </Button>
            <Button variant="secondary" onClick={() => {
              const params = new URLSearchParams();
              params.set('fromClient', id);
              if (client.firstName && client.lastName) params.set('contactName', `${client.firstName} ${client.lastName}`);
              router.push(`/dashboard/deals/new?${params.toString()}`);
            }}>
              Create Deal
            </Button>
            <Button onClick={openAddPolicy}>+ Add Policy</Button>
          </div>
        </div>
      </Card>

      {/* Stats row */}
      <StatTiles items={[
        { label: 'Monthly premium', value: fmt(totalPremium) },
        { label: 'Total coverage', value: fmt(totalCoverage) },
        { label: 'Policies', value: policies.length },
        { label: 'Active policies', value: activePolicies.length, tone: 'good', share: policies.length ? activePolicies.length / policies.length : 0 },
      ]} />

      {/* Tab navigation */}
      <div style={{ marginBottom: '24px' }}>
        <SegTabs label="Client sections" value={activeTab} onChange={setActiveTab} tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'policies', label: 'Policies', count: policies.length },
          { key: 'notes', label: 'Notes', count: notes.length },
        ]} />
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Personal Info */}
          <Card>
            <h3 style={{ margin: '0 0 20px', color: 'var(--brand-navy)', fontSize: '16px', fontWeight: 700 }}>Personal Information</h3>
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <Input label="First Name" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
                  <Input label="Last Name" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
                </div>
                <Input label="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                <Input label="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                <Input label="Date of Birth" type="date" value={editForm.dateOfBirth} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} />
                <Input label="Employer" value={editForm.employer} onChange={(e) => setEditForm({ ...editForm, employer: e.target.value })} />
                <Input label="Occupation" value={editForm.occupation} onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })} />
                <Input label="Annual Income" type="number" value={editForm.annualIncome} onChange={(e) => setEditForm({ ...editForm, annualIncome: e.target.value })} />
                {editError && <p style={{ color: 'var(--status-error, #D33F3F)', fontSize: '15px', margin: 0 }}>{editError}</p>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                  <Button variant="secondary" onClick={() => setIsEditing(false)} disabled={isSavingEdit}>Cancel</Button>
                  <Button onClick={handleSaveEdit} isLoading={isSavingEdit}>Save Changes</Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                <DetailRow label="Email" value={client.email} />
                <DetailRow label="Phone" value={client.phone} />
                <DetailRow label="Date of Birth" value={client.dateOfBirth} />
                <DetailRow label="Gender" value={client.gender} capitalize />
                <DetailRow label="Marital Status" value={client.maritalStatus?.replace('_', ' ')} capitalize />
                <DetailRow label="SSN (Last 4)" value={client.ssn4 ? `***-**-${client.ssn4}` : null} />
                <DetailRow label="Preferred Contact" value={client.preferredContact} capitalize />
              </div>
            )}
          </Card>

          {/* Employment & Address */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Card>
              <h3 style={{ margin: '0 0 20px', color: 'var(--brand-navy)', fontSize: '16px', fontWeight: 700 }}>Employment & Income</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                <DetailRow label="Employer" value={client.employer} />
                <DetailRow label="Occupation" value={client.occupation} />
                <DetailRow label="Annual Income" value={client.annualIncome ? fmt(client.annualIncome) : null} />
              </div>
              {!client.employer && !client.occupation && !client.annualIncome && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, fontStyle: 'italic' }}>No employment info on file</p>
              )}
            </Card>

            <Card>
              <h3 style={{ margin: '0 0 20px', color: 'var(--brand-navy)', fontSize: '16px', fontWeight: 700 }}>Address</h3>
              {client.address?.street || client.address?.city ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  <DetailRow label="Street" value={client.address?.street} />
                  <DetailRow label="City" value={client.address?.city} />
                  <DetailRow label="State" value={client.address?.state} />
                  <DetailRow label="ZIP" value={client.address?.zip} />
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, fontStyle: 'italic' }}>No address on file</p>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Policies Tab */}
      {activeTab === 'policies' && (
        <div>
          {policies.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ marginBottom: '16px', opacity: 0.4, display: 'flex', justifyContent: 'center', color: 'var(--brand-navy)' }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
                <h3 style={{ margin: '0 0 8px', color: 'var(--brand-navy)', fontSize: '18px' }}>No policies yet</h3>
                <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px', fontSize: '16px' }}>
                  Add this client&apos;s first insurance policy to start tracking coverage.
                </p>
                <Button onClick={openAddPolicy}>+ Add First Policy</Button>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {policies.map((policy) => {
                const statusObj = POLICY_STATUSES.find((s) => s.value === policy.status) || POLICY_STATUSES[0];
                return (
                  <Card key={policy.id}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                      {/* Icon */}
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '12px',
                        background: 'rgba(27,43,75,0.06)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, color: 'var(--brand-navy)',
                      }}>
                        <PolicyTypeIcon type={policy.type} />
                      </div>

                      {/* Policy info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: 'var(--brand-navy)', fontSize: '16px' }}>{policy.type}</span>
                          <span style={{
                            padding: '3px 10px', borderRadius: '999px', fontSize: '13px',
                            fontWeight: 700, color: statusObj.color, backgroundColor: statusObj.bg,
                            textTransform: 'uppercase', letterSpacing: '0.3px',
                          }}>
                            {statusObj.label}
                          </span>
                        </div>
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                          gap: '12px', fontSize: '15px',
                        }}>
                          <PolicyDetail label="Carrier" value={policy.carrier} />
                          <PolicyDetail label="Policy #" value={policy.policyNumber} />
                          {policy.premium && <PolicyDetail label="Premium" value={`${fmt(policy.premium)} / ${policy.premiumFrequency}`} />}
                          {policy.coverageAmount && <PolicyDetail label="Coverage" value={fmt(policy.coverageAmount)} />}
                          {policy.effectiveDate && <PolicyDetail label="Effective" value={policy.effectiveDate} />}
                          {policy.expiryDate && <PolicyDetail label="Expires" value={policy.expiryDate} />}
                        </div>
                        {policy.beneficiaries?.length > 0 && (
                          <div style={{ marginTop: '10px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                            <span style={{ fontWeight: 600 }}>Beneficiaries:</span>{' '}
                            {policy.beneficiaries.map((b) => `${b.name} (${b.percentage}%)`).join(', ')}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button className="nxt-btn nxt-btn-sm" onClick={() => openEditPolicy(policy)}>Edit</button>
                        <button className="nxt-btn nxt-btn-sm nxt-btn-danger" onClick={() => handleDeletePolicy(policy.id)}>Delete</button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div>
          <Card>
            <form onSubmit={handleAddNote} style={{ marginBottom: notes.length > 0 ? '24px' : '0' }}>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write a note about this client..."
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: '12px',
                  border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-page)',
                  fontFamily: 'inherit', minHeight: '100px', resize: 'vertical',
                  marginBottom: '12px', fontSize: '16px', lineHeight: '1.6',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="submit" isLoading={isAddingNote} disabled={!newNote.trim()}>Save Note</Button>
              </div>
            </form>
            {notes.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {notes.map((note) => (
                    <div key={note.id} style={{
                      padding: '16px', backgroundColor: 'var(--surface-page)',
                      borderRadius: '12px', borderLeft: '3px solid var(--brand-gold)',
                    }}>
                      <p style={{ margin: '0 0 10px', fontSize: '16px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                        {note.body}
                      </p>
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        {note.createdAt ? new Date(note.createdAt).toLocaleString() : 'Just now'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {notes.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)', fontSize: '16px' }}>
                No notes yet. Add the first note above.
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Policy Modal */}
      {isPolicyModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 10000,
          backdropFilter: 'blur(4px)',
        }}>
          <Card style={{ width: '90vw', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 24px', color: 'var(--brand-navy)', fontSize: '20px', fontWeight: 800 }}>
              {editingPolicy ? 'Edit Policy' : 'Add New Policy'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <CarrierCombobox
                value={policyForm.carrier}
                onChange={(val) => setPolicyForm({ ...policyForm, carrier: val })}
                carriers={carrierNames}
              />
              <div>
                <label style={fieldLabelStyle}>Policy Number *</label>
                <input value={policyForm.policyNumber} onChange={(e) => setPolicyForm({ ...policyForm, policyNumber: e.target.value })} placeholder="e.g. POL-12345" style={fieldInputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={fieldLabelStyle}>Policy Type *</label>
                <select value={policyForm.type} onChange={(e) => setPolicyForm({ ...policyForm, type: e.target.value })} style={fieldInputStyle}>
                  {POLICY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={fieldLabelStyle}>Status</label>
                <select value={policyForm.status} onChange={(e) => setPolicyForm({ ...policyForm, status: e.target.value })} style={fieldInputStyle}>
                  {POLICY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={fieldLabelStyle}>Premium ($)</label>
                <input type="number" value={policyForm.premium} onChange={(e) => setPolicyForm({ ...policyForm, premium: e.target.value })} placeholder="0.00" style={fieldInputStyle} />
              </div>
              <div>
                <label style={fieldLabelStyle}>Premium Frequency</label>
                <select value={policyForm.premiumFrequency} onChange={(e) => setPolicyForm({ ...policyForm, premiumFrequency: e.target.value })} style={fieldInputStyle}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="semi-annual">Semi-Annual</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div>
                <label style={fieldLabelStyle}>Coverage Amount ($)</label>
                <input type="number" value={policyForm.coverageAmount} onChange={(e) => setPolicyForm({ ...policyForm, coverageAmount: e.target.value })} placeholder="0.00" style={fieldInputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={fieldLabelStyle}>Effective Date</label>
                <input type="date" value={policyForm.effectiveDate} onChange={(e) => setPolicyForm({ ...policyForm, effectiveDate: e.target.value })} style={fieldInputStyle} />
              </div>
              <div>
                <label style={fieldLabelStyle}>Expiry Date</label>
                <input type="date" value={policyForm.expiryDate} onChange={(e) => setPolicyForm({ ...policyForm, expiryDate: e.target.value })} style={fieldInputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={fieldLabelStyle}>Notes</label>
              <textarea
                value={policyForm.notes}
                onChange={(e) => setPolicyForm({ ...policyForm, notes: e.target.value })}
                placeholder="Any notes about this policy..."
                style={{
                  ...fieldInputStyle, minHeight: '70px', resize: 'vertical',
                }}
              />
            </div>

            {/* Beneficiaries */}
            <div style={{ marginBottom: '24px' }}>
              <label style={fieldLabelStyle}>Beneficiaries</label>
              {policyForm.beneficiaries.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                  {policyForm.beneficiaries.map((b, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', fontSize: '15px',
                      backgroundColor: 'var(--surface-page)', borderRadius: '8px',
                      marginBottom: '6px',
                    }}>
                      <span style={{ flex: 1 }}>{b.name} — {b.relationship} ({b.percentage}%)</span>
                      <button className="nxt-btn nxt-btn-sm nxt-btn-danger" onClick={() => removeBeneficiary(i)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
                <div>
                  <label style={fieldLabelStyle}>Name</label>
                  <input value={beneficiaryName} onChange={(e) => setBeneficiaryName(e.target.value)} placeholder="Full name" style={fieldInputStyle} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Relationship</label>
                  <input value={beneficiaryRelation} onChange={(e) => setBeneficiaryRelation(e.target.value)} placeholder="Spouse" style={fieldInputStyle} />
                </div>
                <div>
                  <label style={fieldLabelStyle}>%</label>
                  <input type="number" value={beneficiaryPercent} onChange={(e) => setBeneficiaryPercent(e.target.value)} placeholder="100" style={fieldInputStyle} />
                </div>
                <Button variant="secondary" onClick={addBeneficiary} disabled={!beneficiaryName} type="button">Add</Button>
              </div>
            </div>

            {policyError && <p style={{ color: 'var(--status-error, #D33F3F)', fontSize: '15px', margin: '0 0 12px' }}>{policyError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <Button variant="secondary" onClick={() => setIsPolicyModalOpen(false)} disabled={isSavingPolicy}>Cancel</Button>
              <Button onClick={handleSavePolicy} isLoading={isSavingPolicy} disabled={!policyForm.carrier || !policyForm.policyNumber}>
                {editingPolicy ? 'Update Policy' : 'Add Policy'}
              </Button>
            </div>
          </Card>
        </div>
      )}

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

function DetailRow({ label, value, capitalize }) {
  if (!value) return null;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.04)',
    }}>
      <span style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      <span style={{
        fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)',
        textTransform: capitalize ? 'capitalize' : 'none',
      }}>{value}</span>
    </div>
  );
}

function PolicyDetail({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

const fieldLabelStyle = {
  display: 'block', fontFamily: 'var(--font-base)', fontSize: '17px',
  color: 'var(--text-primary)', marginBottom: '8px', fontWeight: '500',
};

const fieldInputStyle = {
  width: '100%', padding: '16px 16px', borderRadius: '12px',
  border: '1px solid var(--border-color)', fontSize: '17px',
  fontFamily: 'var(--font-base)', backgroundColor: 'var(--surface-card)',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  transition: 'all 0.2s ease-in-out', WebkitAppearance: 'none',
};

const actionBtnStyle = {
  background: 'none', border: 'none', color: 'var(--brand-blue-accent)',
  cursor: 'pointer', fontSize: '15px', fontWeight: '600',
  padding: '6px 12px', borderRadius: '6px',
  transition: 'background-color 0.15s',
};
