"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useUser } from '@/context/UserContext';
import {
  fetchTrackerSettings,
  fetchTrackerContacts,
  createTrackerContact,
  updateTrackerContact,
  deleteTrackerContact,
  addTrackerActivity,
  fetchTrackerActivities,
  updateTrackerSettings,
} from '@/app/actions/tracker';
import { useToast } from '@/components/ui/Toast';

import SegTabs from '@/components/ui/SegTabs';
/* ── Constants ── */

const CONTACT_TYPES = [
  { value: 'recruit', label: 'Recruit', color: '#8B5CF6' },
  { value: 'prospect', label: 'Prospect', color: '#E3A94A' },
  { value: 'client', label: 'Client', color: '#16A34A' },
  { value: 'referral', label: 'Referral', color: '#F59E0B' },
  { value: 'dual', label: 'Dual (Recruit + Client)', color: '#EC4899' },
];

const PRIORITIES = [
  { value: 'hot', label: 'Hot', color: '#EF4444' },
  { value: 'warm', label: 'Warm', color: '#F59E0B' },
  { value: 'cold', label: 'Cold', color: '#5F5C56' },
];

const SOURCES = [
  { value: 'referral', label: 'Referral' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'community_event', label: 'Community Event' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'online_lead', label: 'Online Lead' },
  { value: 'existing_client', label: 'Existing Client' },
  { value: 'other', label: 'Other' },
];

const POSITIONS = [
  'Financial Associate (FA)',
  'Senior Financial Associate (SFA)',
  'Financial Director (FD)',
  'Senior Financial Director (SFD)',
  'Senior Regional Director (SRD)',
  'Senior Executive Vice President (SEVP)',
  'Senior National Vice President (SNVP)',
  'Senior Executive Partner (SEP)',
  'National Executive Partner (NEP)',
];

const PRODUCTS = [
  { value: 'life', label: 'Life Insurance' },
  { value: 'critical_illness', label: 'Critical Illness' },
  { value: 'disability', label: 'Disability' },
  { value: 'annuity', label: 'Annuity' },
  { value: 'iul', label: 'IUL' },
  { value: 'whole_life', label: 'Whole Life' },
  { value: 'term', label: 'Term Life' },
  { value: 'other', label: 'Other' },
];

const ACTIVITY_TYPES = [
  { value: 'called', label: 'Called', icon: '' },
  { value: 'texted', label: 'Texted', icon: '' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '' },
  { value: 'emailed', label: 'Emailed', icon: '' },
  { value: 'met_in_person', label: 'Met in Person', icon: '' },
  { value: 'zoom', label: 'Zoom / Video', icon: '' },
  { value: 'sent_presentation', label: 'Sent Presentation', icon: '' },
  { value: 'sent_documents', label: 'Sent Documents', icon: '' },
  { value: 'received_documents', label: 'Received Documents', icon: '' },
  { value: 'voicemail', label: 'Left Voicemail', icon: '' },
  { value: 'note', label: 'Note', icon: '' },
];

const US_STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'];

/* ── Helpers ── */

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/* ══════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════ */

export default function BusinessPipelinePage() {
  const { userProfile } = useUser();

  const [settings, setSettings] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState('board'); // board | table
  const [stageType, setStageType] = useState('recruiting'); // recruiting | sales

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailContact, setDetailContact] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Drag state
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const loadData = useCallback(async () => {
    if (!userProfile?.agency_id) return;
    setIsLoading(true);
    const [settingsRes, contactsRes] = await Promise.all([
      fetchTrackerSettings(userProfile.agency_id),
      fetchTrackerContacts(userProfile.agency_id, userProfile.uid),
    ]);
    if (settingsRes.success) setSettings(settingsRes.settings);
    if (contactsRes.success) setContacts(contactsRes.contacts);
    setIsLoading(false);
  }, [userProfile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const stages = useMemo(() => {
    if (!settings) return [];
    return stageType === 'recruiting' ? settings.recruitingStages : settings.salesStages;
  }, [settings, stageType]);

  const filtered = useMemo(() => {
    let result = contacts.filter(c => {
      const matchesStageType = c.stageType === stageType;
      if (!matchesStageType) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const haystack = `${c.fullName} ${c.phone} ${c.email} ${c.city} ${c.notes}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filterType && c.type !== filterType) return false;
      if (filterPriority && c.priority !== filterPriority) return false;
      if (filterState && c.state !== filterState) return false;
      if (filterSource && c.source !== filterSource) return false;
      return true;
    });
    return result;
  }, [contacts, stageType, searchTerm, filterType, filterPriority, filterState, filterSource]);

  const activeFilterCount = [filterType, filterPriority, filterState, filterSource].filter(Boolean).length;

  /* ── Drag & Drop ── */
  const handleDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e, stageName) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggedId) return;
    const contact = contacts.find(c => c.id === draggedId);
    if (!contact || contact.stage === stageName) { setDraggedId(null); return; }

    // Optimistic update
    setContacts(prev => prev.map(c => c.id === draggedId ? { ...c, stage: stageName } : c));
    setDraggedId(null);

    const res = await updateTrackerContact(contact.id, { stage: stageName });
    if (!res.success) {
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, stage: contact.stage } : c));
    } else {
      await addTrackerActivity(contact.id, {
        type: 'note',
        note: `Stage changed to "${stageName}"`,
        createdBy: userProfile.uid,
        createdByName: [userProfile.first_name, userProfile.middle_name, userProfile.last_name].filter(Boolean).join(' ') || userProfile.full_name || '',
      });
    }
  };

  /* ── Contact CRUD callbacks ── */
  const handleContactCreated = (newContact) => {
    setContacts(prev => [newContact, ...prev]);
    setAddModalOpen(false);
  };

  const handleContactUpdated = (updated) => {
    setContacts(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
  };

  const handleContactDeleted = (id) => {
    setContacts(prev => prev.filter(c => c.id !== id));
    setDetailContact(null);
  };

  /* ── Render ── */

  if (isLoading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--brand-gold, #E3A94A)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        Loading pipeline...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 96px)', minHeight: 520, overflow: 'hidden' }}>

      {/* ── Top Bar ── */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ margin: 0 }}>Pipeline Board</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', marginTop: '2px' }}>
              {filtered.length} contact{filtered.length !== 1 ? 's' : ''}
              {activeFilterCount > 0 && ` (${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active)`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>

            {/* Stage Type Toggle */}
            <SegTabs label="Pipeline type" value={stageType} onChange={setStageType} tabs={[{ key: 'recruiting', label: 'Recruiting' }, { key: 'sales', label: 'Sales' }]} />

            {/* View Toggle */}
            <SegTabs label="Layout" value={view} onChange={setView} tabs={[{ key: 'board', label: 'Board' }, { key: 'table', label: 'Table' }]} />

            {/* Filter Toggle */}
            <button className="nxt-btn" onClick={() => setShowFilters(!showFilters)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              {' '}Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
            </button>

            {/* Settings */}
            <button className="nxt-btn nxt-btn-icon" onClick={() => setSettingsOpen(true)} title="Customize stages & fields" aria-label="Pipeline settings"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>

            {/* Add Contact */}
            <button className="nxt-btn nxt-btn-primary" onClick={() => setAddModalOpen(true)}>+ Add Contact</button>
          </div>
        </div>

        {/* ── Search Bar ── */}
        <div style={{ marginBottom: showFilters ? '12px' : '16px' }}>
          <input
            type="text"
            placeholder="Search by name, phone, email, city, or notes..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.12)',
              fontSize: '1.0625rem', outline: 'none', background: '#fafafa',
            }}
          />
        </div>

        {/* ── Filter Bar ── */}
        {showFilters && (
          <div style={{
            display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', padding: '12px 16px',
            background: '#F7F5F0', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.06)',
          }}>
            <FilterSelect label="Type" value={filterType} onChange={setFilterType} options={CONTACT_TYPES.map(t => ({ value: t.value, label: t.label }))} />
            <FilterSelect label="Priority" value={filterPriority} onChange={setFilterPriority} options={PRIORITIES.map(p => ({ value: p.value, label: p.label }))} />
            <FilterSelect label="State" value={filterState} onChange={setFilterState} options={US_STATES.map(s => ({ value: s, label: s }))} />
            <FilterSelect label="Source" value={filterSource} onChange={setFilterSource} options={SOURCES} />
            {activeFilterCount > 0 && (
              <button className="nxt-btn nxt-btn-sm" onClick={() => { setFilterType(''); setFilterPriority(''); setFilterState(''); setFilterSource(''); }}>Clear All</button>
            )}
          </div>
        )}
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 0 8px' }}>
        {view === 'board' ? (
          <BoardView
            stages={stages}
            contacts={filtered}
            draggedId={draggedId}
            dragOverStage={dragOverStage}
            onDragStart={handleDragStart}
            onDragOver={(e, s) => { e.preventDefault(); setDragOverStage(s); }}
            onDragLeave={() => setDragOverStage(null)}
            onDrop={handleDrop}
            onCardClick={setDetailContact}
          />
        ) : (
          <TableView
            contacts={filtered}
            stages={stages}
            onRowClick={setDetailContact}
          />
        )}
      </div>

      {/* ── Modals ── */}
      {addModalOpen && (
        <AddContactModal
          stageType={stageType}
          stages={stages}
          userProfile={userProfile}
          onClose={() => setAddModalOpen(false)}
          onCreated={handleContactCreated}
        />
      )}
      {detailContact && (
        <ContactDetailPanel
          contact={detailContact}
          stages={stages}
          stageType={stageType}
          userProfile={userProfile}
          onClose={() => setDetailContact(null)}
          onUpdated={handleContactUpdated}
          onDeleted={handleContactDeleted}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          agencyId={userProfile.agency_id}
          stageType={stageType}
          onClose={() => setSettingsOpen(false)}
          onSaved={(newSettings) => { setSettings(newSettings); setSettingsOpen(false); }}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   FILTER SELECT
   ══════════════════════════════════════════════════ */

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '1rem', background: '#fff', minWidth: '130px', cursor: 'pointer',
      }}>
        <option value="">All</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   BOARD VIEW (Kanban)
   ══════════════════════════════════════════════════ */

function BoardView({ stages, contacts, draggedId, dragOverStage, onDragStart, onDragOver, onDragLeave, onDrop, onCardClick }) {
  return (
    <div style={{
      display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '16px', minHeight: '400px',
    }}>
      {stages.map(stage => {
        const stageContacts = contacts.filter(c => c.stage === stage.name);
        const isDragOver = dragOverStage === stage.name;
        return (
          <div
            key={stage.name}
            onDragOver={(e) => onDragOver(e, stage.name)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, stage.name)}
            style={{
              minWidth: '280px', maxWidth: '280px', flexShrink: 0,
              background: isDragOver ? 'rgba(227, 169, 74,0.08)' : '#F7F5F0',
              borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column',
              border: isDragOver ? '2px dashed var(--brand-gold, #E3A94A)' : '2px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            {/* Column Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '0 4px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
              <span style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>{stage.name}</span>
              <span style={{
                fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-secondary)',
                background: '#e2e8f0', borderRadius: '10px', padding: '2px 8px', minWidth: '22px', textAlign: 'center',
              }}>{stageContacts.length}</span>
            </div>

            {/* Cards */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
              {stageContacts.map(contact => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onDragStart={onDragStart}
                  onClick={() => onCardClick(contact)}
                  isDragging={draggedId === contact.id}
                />
              ))}
              {stageContacts.length === 0 && (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: '#cbd5e1', fontSize: '1rem' }}>
                  Drop contacts here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Contact Card ── */

function ContactCard({ contact, onDragStart, onClick, isDragging }) {
  const typeInfo = CONTACT_TYPES.find(t => t.value === contact.type) || CONTACT_TYPES[1];
  const priorityInfo = PRIORITIES.find(p => p.value === contact.priority) || PRIORITIES[1];

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${contact.fullName}, ${typeInfo.label}, ${priorityInfo.label} priority`}
      draggable
      onDragStart={(e) => onDragStart(e, contact.id)}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      style={{
        background: '#fff', borderRadius: '10px', padding: '12px 14px', cursor: 'grab',
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.06)',
        opacity: isDragging ? 0.5 : 1,
        border: '1px solid rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.15s ease',
      }}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { if (!isDragging) e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
    >
      {/* Top row: name + priority */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)' }}>{contact.fullName}</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: priorityInfo.color, flexShrink: 0 }} title={priorityInfo.label} />
      </div>

      {/* Type badge */}
      <span style={{
        display: 'inline-block', fontSize: '0.9375rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
        background: typeInfo.color + '18', color: typeInfo.color, textTransform: 'uppercase', letterSpacing: '0.3px',
        marginBottom: '8px',
      }}>{typeInfo.label}</span>

      {/* Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {contact.phone && (
          <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{contact.phone}</span>
        )}
        {contact.state && (
          <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{contact.city ? `${contact.city}, ` : ''}{contact.state}</span>
        )}
        {contact.introducedBy && (
          <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>via {contact.introducedBy}</span>
        )}
        {contact.productInterest?.length > 0 && (
          <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
            {contact.productInterest.map(p => PRODUCTS.find(pr => pr.value === p)?.label || p).join(', ')}
          </span>
        )}
      </div>

      {/* Footer */}
      {(contact.lastContactedAt || contact.nextFollowupAt) && (
        <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #F1EFEA', display: 'flex', justifyContent: 'space-between' }}>
          {contact.lastContactedAt && (
            <span style={{ fontSize: '1rem', color: '#94a3b8' }}>Last: {timeAgo(contact.lastContactedAt)}</span>
          )}
          {contact.nextFollowupAt && (
            <span style={{ fontSize: '1rem', color: new Date(contact.nextFollowupAt) < new Date() ? '#EF4444' : '#E3A94A', fontWeight: 600 }}>
              Follow-up: {formatDate(contact.nextFollowupAt)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   TABLE VIEW
   ══════════════════════════════════════════════════ */

function TableView({ contacts, stages, onRowClick }) {
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    return [...contacts].sort((a, b) => {
      const av = a[sortKey] || '';
      const bv = b[sortKey] || '';
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [contacts, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const thStyle = {
    padding: '10px 14px', fontSize: '0.9375rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
    color: 'var(--text-secondary)', textAlign: 'left', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
    borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#fff', zIndex: 2,
  };

  const tdStyle = {
    padding: '10px 14px', fontSize: '1.0625rem', color: 'var(--text-primary)', borderBottom: '1px solid #F1EFEA',
    whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis',
  };

  const sortIcon = (col) => sortKey === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
  const ariaSort = (col) => sortKey === col ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';

  const sortableTh = (col, label) => (
    <th
      scope="col"
      style={thStyle}
      onClick={() => toggleSort(col)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(col); } }}
      tabIndex={0}
      role="columnheader"
      aria-sort={ariaSort(col)}
    >
      {label}{sortIcon(col)}
    </th>
  );

  return (
    <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)', background: '#fff' }} role="region" aria-label="Pipeline contacts table">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {sortableTh('fullName', 'Name')}
            {sortableTh('type', 'Type')}
            {sortableTh('stage', 'Stage')}
            {sortableTh('priority', 'Priority')}
            {sortableTh('phone', 'Phone')}
            {sortableTh('state', 'Location')}
            {sortableTh('introducedBy', 'Introduced By')}
            {sortableTh('source', 'Source')}
            {sortableTh('lastContactedAt', 'Last Contact')}
            {sortableTh('nextFollowupAt', 'Follow-up')}
            {sortableTh('createdAt', 'Added')}
          </tr>
        </thead>
        <tbody>
          {sorted.map(contact => {
            const typeInfo = CONTACT_TYPES.find(t => t.value === contact.type) || CONTACT_TYPES[1];
            const priorityInfo = PRIORITIES.find(p => p.value === contact.priority) || PRIORITIES[1];
            const stageInfo = stages.find(s => s.name === contact.stage);
            return (
              <tr key={contact.id} onClick={() => onRowClick(contact)} style={{ cursor: 'pointer' }}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(contact); } }}
                aria-label={`${contact.fullName}, ${typeInfo.label}`}
                onMouseEnter={e => e.currentTarget.style.background = '#fafbfd'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ ...tdStyle, fontWeight: 600 }}>{contact.fullName}</td>
                <td style={tdStyle}>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: typeInfo.color + '18', color: typeInfo.color }}>{typeInfo.label}</span>
                </td>
                <td style={tdStyle}>
                  {stageInfo && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '1rem' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: stageInfo.color }} />
                    {contact.stage}
                  </span>}
                </td>
                <td style={tdStyle}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '1rem' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: priorityInfo.color }} />
                    {priorityInfo.label}
                  </span>
                </td>
                <td style={tdStyle}>{contact.phone}</td>
                <td style={tdStyle}>{contact.city ? `${contact.city}, ` : ''}{contact.state}</td>
                <td style={tdStyle}>{contact.introducedBy}</td>
                <td style={tdStyle}>{SOURCES.find(s => s.value === contact.source)?.label || contact.source}</td>
                <td style={tdStyle}>{contact.lastContactedAt ? timeAgo(contact.lastContactedAt) : '—'}</td>
                <td style={{ ...tdStyle, color: contact.nextFollowupAt && new Date(contact.nextFollowupAt) < new Date() ? '#EF4444' : undefined }}>
                  {contact.nextFollowupAt ? formatDate(contact.nextFollowupAt) : '—'}
                </td>
                <td style={tdStyle}>{formatDate(contact.createdAt)}</td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr><td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '1rem' }}>
              No contacts found. Click &quot;+ Add Contact&quot; to get started.
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   ADD CONTACT MODAL
   ══════════════════════════════════════════════════ */

function AddContactModal({ stageType, stages, userProfile, onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({
    type: stageType === 'recruiting' ? 'recruit' : 'prospect',
    fullName: '', phone: '', email: '', dateOfBirth: '',
    city: '', state: '', ethnicity: '', language: '', occupation: '',
    introducedBy: '', relationshipNotes: '', familyDetails: '',
    position: '', pace: '',
    productInterest: [], carrier: '',
    policyAmount: '', monthlyPremium: '', annualPremium: '', potentialIncome: '',
    stage: stages[0]?.name || '',
    priority: 'warm', source: '', notes: '',
    nextFollowupAt: '',
  });
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('basic');

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const toggleProduct = (val) => {
    setForm(prev => ({
      ...prev,
      productInterest: prev.productInterest.includes(val)
        ? prev.productInterest.filter(p => p !== val)
        : [...prev.productInterest, val],
    }));
  };

  const handleSubmit = async () => {
    if (!form.fullName.trim()) { toast.info('Name is required'); return; }
    setSaving(true);
    const res = await createTrackerContact({
      ...form,
      agencyId: userProfile.agency_id,
      stageType,
      assignedAgentId: userProfile.uid,
      assignedAgentName: [userProfile.first_name, userProfile.middle_name, userProfile.last_name].filter(Boolean).join(' ') || userProfile.full_name || '',
      createdBy: userProfile.uid,
    });
    setSaving(false);
    if (res.success) onCreated(res.contact);
    else toast.error('Error: ' + res.error);
  };

  const sections = [
    { key: 'basic', label: 'Basic Info' },
    { key: 'relationship', label: 'Relationship' },
    stageType === 'recruiting' ? { key: 'recruiting', label: 'Recruiting' } : null,
    { key: 'sales', label: 'Product / Sales' },
    { key: 'tracking', label: 'Tracking' },
  ].filter(Boolean);

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)',
    fontSize: '1rem', outline: 'none', background: '#fafafa',
  };
  const labelStyle = { fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' };
  const fieldStyle = { marginBottom: '12px' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.15s ease' }} role="dialog" aria-modal="true" aria-label="Add new contact">
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} aria-hidden="true" />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: '16px', width: '580px', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Add New Contact</h2>
            <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          {/* Section Tabs */}
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '12px', borderBottom: '1px solid #F1EFEA' }}>
            {sections.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)} style={{
                padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                background: activeSection === s.key ? 'var(--brand-navy, #1B2A4A)' : '#F1EFEA',
                color: activeSection === s.key ? '#fff' : 'var(--text-secondary)',
              }}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {activeSection === 'basic' && <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Full Name *</label>
              <input style={inputStyle} value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="John Doe" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Phone</label>
                <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 123-4567" />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@email.com" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>City</label>
                <input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>State</label>
                <select style={inputStyle} value={form.state} onChange={e => set('state', e.target.value)}>
                  <option value="">Select...</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Date of Birth</label>
                <input style={inputStyle} type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Occupation</label>
                <input style={inputStyle} value={form.occupation} onChange={e => set('occupation', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Ethnicity / Community</label>
                <input style={inputStyle} value={form.ethnicity} onChange={e => set('ethnicity', e.target.value)} placeholder="e.g. Asian - Nepalese" />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Language</label>
                <input style={inputStyle} value={form.language} onChange={e => set('language', e.target.value)} placeholder="e.g. English, Nepali" />
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Contact Type</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {CONTACT_TYPES.map(t => (
                  <button key={t.value} onClick={() => set('type', t.value)} style={{
                    padding: '6px 14px', borderRadius: '6px', border: '2px solid', fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
                    borderColor: form.type === t.value ? t.color : 'transparent',
                    background: form.type === t.value ? t.color + '18' : '#F1EFEA',
                    color: form.type === t.value ? t.color : 'var(--text-secondary)',
                  }}>{t.label}</button>
                ))}
              </div>
            </div>
          </>}

          {activeSection === 'relationship' && <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Introduced By / Referred By</label>
              <input style={inputStyle} value={form.introducedBy} onChange={e => set('introducedBy', e.target.value)} placeholder="Who referred this person?" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Relationship Notes</label>
              <input style={inputStyle} value={form.relationshipNotes} onChange={e => set('relationshipNotes', e.target.value)} placeholder="e.g. Friend of Rigo, met at community event" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Family Details</label>
              <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={form.familyDetails} onChange={e => set('familyDetails', e.target.value)} placeholder="Married, 2 kids, spouse name..." />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Source</label>
              <select style={inputStyle} value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="">Select...</option>
                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </>}

          {activeSection === 'recruiting' && <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Position</label>
              <select style={inputStyle} value={form.position} onChange={e => set('position', e.target.value)}>
                <option value="">Select...</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Pace</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['High', 'Medium', 'Low'].map(v => (
                  <button key={v} onClick={() => set('pace', v)} style={{
                    padding: '6px 14px', borderRadius: '6px', border: '2px solid', fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
                    borderColor: form.pace === v ? '#8B5CF6' : 'transparent',
                    background: form.pace === v ? 'rgba(139,92,246,0.1)' : '#F1EFEA',
                    color: form.pace === v ? '#8B5CF6' : 'var(--text-secondary)',
                  }}>{v}</button>
                ))}
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Licensed States</label>
              <input style={inputStyle} value={form.licensedStates} onChange={e => set('licensedStates', e.target.value)} placeholder="e.g. MA, TX, CA" />
            </div>
          </>}

          {activeSection === 'sales' && <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Product Interest</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {PRODUCTS.map(p => (
                  <button key={p.value} onClick={() => toggleProduct(p.value)} style={{
                    padding: '6px 12px', borderRadius: '6px', border: '2px solid', fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
                    borderColor: form.productInterest.includes(p.value) ? '#16A34A' : 'transparent',
                    background: form.productInterest.includes(p.value) ? 'rgba(22,163,74,0.1)' : '#F1EFEA',
                    color: form.productInterest.includes(p.value) ? '#16A34A' : 'var(--text-secondary)',
                  }}>{p.label}</button>
                ))}
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Carrier</label>
              <input style={inputStyle} value={form.carrier} onChange={e => set('carrier', e.target.value)} placeholder="e.g. F&G, Transamerica" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Policy Amount / Face Value</label>
                <input style={inputStyle} type="number" value={form.policyAmount} onChange={e => set('policyAmount', e.target.value)} placeholder="500000" />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Monthly Premium</label>
                <input style={inputStyle} type="number" value={form.monthlyPremium} onChange={e => set('monthlyPremium', e.target.value)} placeholder="265" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Annual Premium</label>
                <input style={inputStyle} type="number" value={form.annualPremium} onChange={e => set('annualPremium', e.target.value)} placeholder="3180" />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Potential Income</label>
                <input style={inputStyle} type="number" value={form.potentialIncome} onChange={e => set('potentialIncome', e.target.value)} placeholder="2003" />
              </div>
            </div>
          </>}

          {activeSection === 'tracking' && <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Stage</label>
              <select style={inputStyle} value={form.stage} onChange={e => set('stage', e.target.value)}>
                {stages.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Priority</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {PRIORITIES.map(p => (
                  <button key={p.value} onClick={() => set('priority', p.value)} style={{
                    padding: '6px 14px', borderRadius: '6px', border: '2px solid', fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
                    borderColor: form.priority === p.value ? p.color : 'transparent',
                    background: form.priority === p.value ? p.color + '18' : '#F1EFEA',
                    color: form.priority === p.value ? p.color : 'var(--text-secondary)',
                  }}>{p.label}</button>
                ))}
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Next Follow-up Date</label>
              <input style={inputStyle} type="date" value={form.nextFollowupAt} onChange={e => set('nextFollowupAt', e.target.value)} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any important notes..." />
            </div>
          </>}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #F1EFEA', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
          <button className="nxt-btn" onClick={onClose}>Cancel</button>
          <button className="nxt-btn nxt-btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : 'Add Contact'}</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   CONTACT DETAIL PANEL (slide-in from right)
   ══════════════════════════════════════════════════ */

function ContactDetailPanel({ contact, stages, stageType, userProfile, onClose, onUpdated, onDeleted }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...contact });
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [activityType, setActivityType] = useState('note');
  const [activityNote, setActivityNote] = useState('');
  const [addingActivity, setAddingActivity] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadActivities = useCallback(async () => {
    setLoadingActivities(true);
    const res = await fetchTrackerActivities(contact.id);
    if (res.success) setActivities(res.activities);
    setLoadingActivities(false);
  }, [contact.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({ ...contact });
    setEditing(false);
    loadActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact.id]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const toggleProduct = (val) => {
    setForm(prev => ({
      ...prev,
      productInterest: (prev.productInterest || []).includes(val)
        ? prev.productInterest.filter(p => p !== val)
        : [...(prev.productInterest || []), val],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { id, createdAt, createdBy, agencyId, ...updates } = form;
    const res = await updateTrackerContact(contact.id, updates);
    setSaving(false);
    if (res.success) { onUpdated({ ...contact, ...updates }); setEditing(false); }
    else toast.error('Error: ' + res.error);
  };

  const handleDelete = async () => {
    const res = await deleteTrackerContact(contact.id);
    if (res.success) onDeleted(contact.id);
    else toast.error('Error: ' + res.error);
  };

  const handleAddActivity = async () => {
    if (!activityNote.trim() && activityType === 'note') return;
    setAddingActivity(true);
    const res = await addTrackerActivity(contact.id, {
      type: activityType,
      note: activityNote,
      createdBy: userProfile.uid,
      createdByName: [userProfile.first_name, userProfile.middle_name, userProfile.last_name].filter(Boolean).join(' ') || userProfile.full_name || '',
    });
    setAddingActivity(false);
    if (res.success) {
      setActivityNote('');
      loadActivities();
      if (['called', 'texted', 'emailed', 'met_in_person', 'zoom', 'whatsapp'].includes(activityType)) {
        onUpdated({ ...contact, lastContactedAt: new Date().toISOString() });
      }
    }
  };

  const typeInfo = CONTACT_TYPES.find(t => t.value === contact.type) || CONTACT_TYPES[1];
  const priorityInfo = PRIORITIES.find(p => p.value === contact.priority) || PRIORITIES[1];

  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)',
    fontSize: '0.9375rem', outline: 'none', background: '#fafafa',
  };
  const labelStyle = { fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px', display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }} role="dialog" aria-modal="true" aria-label="Contact details">
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', animation: 'fadeIn 0.15s ease' }} aria-hidden="true" />
      <div style={{
        position: 'relative', background: '#fff', width: '520px', maxWidth: '95vw', height: '100%',
        display: 'flex', flexDirection: 'column', animation: 'slideIn 0.2s ease',
        boxShadow: '-10px 0 40px rgba(0,0,0,0.1)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1EFEA', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 4px' }}>{contact.fullName}</h2>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '1rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: typeInfo.color + '18', color: typeInfo.color, textTransform: 'uppercase' }}>{typeInfo.label}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.9375rem', color: priorityInfo.color, fontWeight: 600 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: priorityInfo.color }} />{priorityInfo.label}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {!editing && (
                <button className="nxt-btn nxt-btn-sm" onClick={() => setEditing(true)}>Edit</button>
              )}
              <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {editing ? (
            /* ── Edit Mode ── */
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div><label style={labelStyle}>Full Name</label><input style={inputStyle} value={form.fullName} onChange={e => set('fullName', e.target.value)} /></div>
                <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
                <div><label style={labelStyle}>Email</label><input style={inputStyle} value={form.email} onChange={e => set('email', e.target.value)} /></div>
                <div><label style={labelStyle}>City</label><input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} /></div>
                <div><label style={labelStyle}>State</label><select style={inputStyle} value={form.state} onChange={e => set('state', e.target.value)}><option value="">Select...</option>{US_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label style={labelStyle}>DOB</label><input style={inputStyle} type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} /></div>
                <div><label style={labelStyle}>Occupation</label><input style={inputStyle} value={form.occupation} onChange={e => set('occupation', e.target.value)} /></div>
                <div><label style={labelStyle}>Ethnicity</label><input style={inputStyle} value={form.ethnicity} onChange={e => set('ethnicity', e.target.value)} /></div>
                <div><label style={labelStyle}>Language</label><input style={inputStyle} value={form.language} onChange={e => set('language', e.target.value)} /></div>
                <div><label style={labelStyle}>Introduced By</label><input style={inputStyle} value={form.introducedBy} onChange={e => set('introducedBy', e.target.value)} /></div>
                <div><label style={labelStyle}>Source</label><select style={inputStyle} value={form.source} onChange={e => set('source', e.target.value)}><option value="">Select...</option>{SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
                <div><label style={labelStyle}>Position</label><select style={inputStyle} value={form.position} onChange={e => set('position', e.target.value)}><option value="">Select...</option>{POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                <div><label style={labelStyle}>Pace</label><select style={inputStyle} value={form.pace} onChange={e => set('pace', e.target.value)}><option value="">Select...</option>{['High','Medium','Low'].map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                <div><label style={labelStyle}>Carrier</label><input style={inputStyle} value={form.carrier} onChange={e => set('carrier', e.target.value)} /></div>
                <div><label style={labelStyle}>Policy Amount</label><input style={inputStyle} type="number" value={form.policyAmount} onChange={e => set('policyAmount', e.target.value)} /></div>
                <div><label style={labelStyle}>Monthly Premium</label><input style={inputStyle} type="number" value={form.monthlyPremium} onChange={e => set('monthlyPremium', e.target.value)} /></div>
                <div><label style={labelStyle}>Annual Premium</label><input style={inputStyle} type="number" value={form.annualPremium} onChange={e => set('annualPremium', e.target.value)} /></div>
                <div><label style={labelStyle}>Potential Income</label><input style={inputStyle} type="number" value={form.potentialIncome} onChange={e => set('potentialIncome', e.target.value)} /></div>
                <div><label style={labelStyle}>Next Follow-up</label><input style={inputStyle} type="date" value={form.nextFollowupAt} onChange={e => set('nextFollowupAt', e.target.value)} /></div>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Stage</label>
                <select style={inputStyle} value={form.stage} onChange={e => set('stage', e.target.value)}>
                  {stages.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Priority</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {PRIORITIES.map(p => (
                    <button key={p.value} onClick={() => set('priority', p.value)} style={{
                      padding: '5px 12px', borderRadius: '6px', border: '2px solid', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
                      borderColor: form.priority === p.value ? p.color : 'transparent',
                      background: form.priority === p.value ? p.color + '18' : '#F1EFEA',
                      color: form.priority === p.value ? p.color : 'var(--text-secondary)',
                    }}>{p.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Type</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {CONTACT_TYPES.map(t => (
                    <button key={t.value} onClick={() => set('type', t.value)} style={{
                      padding: '5px 12px', borderRadius: '6px', border: '2px solid', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
                      borderColor: form.type === t.value ? t.color : 'transparent',
                      background: form.type === t.value ? t.color + '18' : '#F1EFEA',
                      color: form.type === t.value ? t.color : 'var(--text-secondary)',
                    }}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Product Interest</label>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {PRODUCTS.map(p => (
                    <button key={p.value} onClick={() => toggleProduct(p.value)} style={{
                      padding: '4px 10px', borderRadius: '5px', border: '2px solid', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
                      borderColor: (form.productInterest || []).includes(p.value) ? '#16A34A' : 'transparent',
                      background: (form.productInterest || []).includes(p.value) ? 'rgba(22,163,74,0.1)' : '#F1EFEA',
                      color: (form.productInterest || []).includes(p.value) ? '#16A34A' : 'var(--text-secondary)',
                    }}>{p.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Family Details</label>
                <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={form.familyDetails} onChange={e => set('familyDetails', e.target.value)} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
                <button className="nxt-btn nxt-btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="nxt-btn" onClick={() => setEditing(false)}>Cancel</button>
                  <button className="nxt-btn nxt-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                </div>
              </div>
              {confirmDelete && (
                <div style={{ marginTop: '12px', padding: '12px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <p style={{ fontSize: '0.9375rem', color: '#DC2626', margin: '0 0 8px', fontWeight: 600 }}>Are you sure? This cannot be undone.</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="nxt-btn nxt-btn-danger" onClick={handleDelete}>Yes, Delete</button>
                    <button className="nxt-btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── View Mode ── */
            <div>
              {/* Quick Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <InfoField label="Phone" value={contact.phone} link={contact.phone ? `tel:${contact.phone}` : null} />
                <InfoField label="Email" value={contact.email} link={contact.email ? `mailto:${contact.email}` : null} />
                <InfoField label="Location" value={[contact.city, contact.state].filter(Boolean).join(', ')} />
                <InfoField label="Introduced By" value={contact.introducedBy} />
                <InfoField label="Stage" value={contact.stage} />
                <InfoField label="Source" value={SOURCES.find(s => s.value === contact.source)?.label || contact.source} />
                <InfoField label="Occupation" value={contact.occupation} />
                <InfoField label="Ethnicity" value={contact.ethnicity} />
                <InfoField label="Language" value={contact.language} />
                <InfoField label="DOB" value={contact.dateOfBirth} />
                {contact.position && <InfoField label="Position" value={contact.position} />}
                {contact.pace && <InfoField label="Pace" value={contact.pace} />}
                {contact.carrier && <InfoField label="Carrier" value={contact.carrier} />}
                {contact.policyAmount && <InfoField label="Policy Amount" value={`$${Number(contact.policyAmount).toLocaleString()}`} />}
                {contact.monthlyPremium && <InfoField label="Monthly Premium" value={`$${contact.monthlyPremium}`} />}
                {contact.annualPremium && <InfoField label="Annual Premium" value={`$${contact.annualPremium}`} />}
                {contact.potentialIncome && <InfoField label="Potential Income" value={`$${contact.potentialIncome}`} />}
                {contact.policyNumber && <InfoField label="Policy #" value={contact.policyNumber} />}
                {contact.licensedStates && <InfoField label="Licensed States" value={contact.licensedStates} />}
                <InfoField label="Next Follow-up" value={contact.nextFollowupAt ? formatDate(contact.nextFollowupAt) : '—'} />
                <InfoField label="Last Contact" value={contact.lastContactedAt ? timeAgo(contact.lastContactedAt) : '—'} />
              </div>

              {contact.productInterest?.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Product Interest</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {contact.productInterest.map(p => (
                      <span key={p} style={{ padding: '3px 10px', borderRadius: '5px', background: 'rgba(22,163,74,0.1)', color: '#16A34A', fontSize: '0.9375rem', fontWeight: 600 }}>
                        {PRODUCTS.find(pr => pr.value === p)?.label || p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(contact.familyDetails || contact.relationshipNotes || contact.notes) && (
                <div style={{ marginBottom: '20px', padding: '12px', background: '#F7F5F0', borderRadius: '8px' }}>
                  {contact.familyDetails && <p style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', margin: '0 0 6px' }}><strong>Family:</strong> {contact.familyDetails}</p>}
                  {contact.relationshipNotes && <p style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', margin: '0 0 6px' }}><strong>Relationship:</strong> {contact.relationshipNotes}</p>}
                  {contact.notes && <p style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', margin: 0 }}><strong>Notes:</strong> {contact.notes}</p>}
                </div>
              )}

              {/* ── Quick Actions (Data Continuity) ── */}
              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '10px' }}>Quick Actions</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(() => {
                    const nameParts = (contact.fullName || '').trim().split(' ');
                    const firstName = nameParts[0] || '';
                    const lastName = nameParts.slice(1).join(' ') || '';
                    const params = new URLSearchParams();
                    if (firstName) params.set('firstName', firstName);
                    if (lastName) params.set('lastName', lastName);
                    if (contact.email) params.set('email', contact.email);
                    if (contact.phone) params.set('phone', contact.phone);
                    if (contact.dateOfBirth) params.set('dateOfBirth', contact.dateOfBirth);
                    if (contact.city) params.set('city', contact.city);
                    if (contact.state) params.set('state', contact.state);
                    if (contact.occupation) params.set('occupation', contact.occupation);
                    params.set('fromPipeline', contact.id);
                    const qs = params.toString();

                    const leadParams = new URLSearchParams();
                    if (firstName) leadParams.set('firstName', firstName);
                    if (lastName) leadParams.set('lastName', lastName);
                    if (contact.email) leadParams.set('email', contact.email);
                    if (contact.phone) leadParams.set('phone', contact.phone);
                    if (contact.dateOfBirth) leadParams.set('dateOfBirth', contact.dateOfBirth);
                    if (contact.city) leadParams.set('city', contact.city);
                    if (contact.state) leadParams.set('state', contact.state);
                    leadParams.set('fromPipeline', contact.id);
                    const leadQs = leadParams.toString();

                    const dealParams = new URLSearchParams();
                    dealParams.set('fromPipeline', contact.id);
                    if (contact.fullName) dealParams.set('contactName', contact.fullName);
                    if (contact.carrier) dealParams.set('carrier', contact.carrier);
                    if (contact.monthlyPremium) dealParams.set('premiumAmount', contact.monthlyPremium);
                    const dealQs = dealParams.toString();

                    const actionBtnStyle = {
                      padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)',
                      background: '#fff', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
                      color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px',
                      transition: 'all 0.15s ease',
                    };

                    return (
                      <>
                        <a href={`/dashboard/clients/new?${qs}`} style={{ textDecoration: 'none' }}>
                          <button style={{ ...actionBtnStyle, borderColor: '#bbf7d0', background: '#f0fdf4', color: '#16A34A' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                            Create Client
                          </button>
                        </a>
                        <a href={`/dashboard/leads/new?${leadQs}`} style={{ textDecoration: 'none' }}>
                          <button style={{ ...actionBtnStyle, borderColor: '#bfdbfe', background: '#eff6ff', color: '#2563EB' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                            Create Lead
                          </button>
                        </a>
                        <a href={`/dashboard/deals/new?${dealQs}`} style={{ textDecoration: 'none' }}>
                          <button style={{ ...actionBtnStyle, borderColor: '#fde68a', background: '#fffbeb', color: '#D97706' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                            Create Deal
                          </button>
                        </a>
                        {contact.stageType === 'recruiting' && (
                          <a href={`/dashboard/team?inviteName=${encodeURIComponent(contact.fullName || '')}&inviteEmail=${encodeURIComponent(contact.email || '')}&invitePhone=${encodeURIComponent(contact.phone || '')}&fromPipeline=${contact.id}`} style={{ textDecoration: 'none' }}>
                            <button style={{ ...actionBtnStyle, borderColor: '#e9d5ff', background: '#faf5ff', color: '#7C3AED' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11l-3 3-3-3"/><path d="M19 8v6"/></svg>
                              Invite as Agent
                            </button>
                          </a>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* ── Add Activity ── */}
              <div style={{ marginBottom: '20px', padding: '14px', background: '#F7F5F0', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '10px' }}>Log Activity</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {ACTIVITY_TYPES.map(a => (
                    <button key={a.value} onClick={() => setActivityType(a.value)} style={{
                      padding: '4px 10px', borderRadius: '6px', border: '2px solid', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
                      borderColor: activityType === a.value ? '#E3A94A' : 'transparent',
                      background: activityType === a.value ? 'rgba(227, 169, 74,0.1)' : '#fff',
                      color: activityType === a.value ? '#E3A94A' : 'var(--text-secondary)',
                    }}>{a.label}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.9375rem', outline: 'none' }}
                    placeholder="Add a note..."
                    value={activityNote}
                    onChange={e => setActivityNote(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddActivity(); }}
                  />
                  <button className="nxt-btn nxt-btn-primary" onClick={handleAddActivity} disabled={addingActivity}>{addingActivity ? '...' : 'Log'}</button>
                </div>
              </div>

              {/* ── Activity Timeline ── */}
              <div>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '12px' }}>Activity Timeline</span>
                {loadingActivities ? (
                  <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>Loading...</p>
                ) : activities.length === 0 ? (
                  <p style={{ fontSize: '0.9375rem', color: '#94a3b8' }}>No activities yet. Log your first interaction above.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    {activities.map(a => {
                      const atInfo = ACTIVITY_TYPES.find(t => t.value === a.type) || ACTIVITY_TYPES[10];
                      return (
                        <div key={a.id} style={{ display: 'flex', gap: '10px', padding: '10px 0', borderBottom: '1px solid #F1EFEA' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E3A94A', flexShrink: 0, marginTop: '6px' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{atInfo.label}</span>
                              <span style={{ fontSize: '1rem', color: '#94a3b8' }}>{timeAgo(a.createdAt)}</span>
                            </div>
                            {a.note && <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', margin: 0 }}>{a.note}</p>}
                            {a.createdByName && <span style={{ fontSize: '1rem', color: '#94a3b8' }}>by {a.createdByName}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value, link }) {
  if (!value) return (
    <div>
      <span style={{ fontSize: '1rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '2px' }}>{label}</span>
      <span style={{ fontSize: '0.9375rem', color: '#cbd5e1' }}>—</span>
    </div>
  );
  return (
    <div>
      <span style={{ fontSize: '1rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '2px' }}>{label}</span>
      {link ? (
        <a href={link} style={{ fontSize: '0.9375rem', color: '#E3A94A', textDecoration: 'none' }}>{value}</a>
      ) : (
        <span style={{ fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{value}</span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SETTINGS MODAL (customize stages)
   ══════════════════════════════════════════════════ */

function SettingsModal({ settings, agencyId, stageType, onClose, onSaved }) {
  const toast = useToast();
  const key = stageType === 'recruiting' ? 'recruitingStages' : 'salesStages';
  const [localStages, setLocalStages] = useState([...(settings[key] || [])]);
  const [saving, setSaving] = useState(false);
  const [newStageName, setNewStageName] = useState('');

  const addStage = () => {
    if (!newStageName.trim()) return;
    const colors = ['#5F5C56','#E3A94A','#8B5CF6','#F59E0B','#F97316','#0EA5E9','#14B8A6','#10B981','#16A34A','#EF4444','#EC4899'];
    setLocalStages(prev => [...prev, { name: newStageName.trim(), order: prev.length, color: colors[prev.length % colors.length] }]);
    setNewStageName('');
  };

  const removeStage = (idx) => {
    setLocalStages(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })));
  };

  const moveStage = (idx, dir) => {
    const arr = [...localStages];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setLocalStages(arr.map((s, i) => ({ ...s, order: i })));
  };

  const renameStageFn = (idx, newName) => {
    setLocalStages(prev => prev.map((s, i) => i === idx ? { ...s, name: newName } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await updateTrackerSettings(agencyId, { [key]: localStages });
    setSaving(false);
    if (res.success) onSaved({ ...settings, [key]: localStages });
    else toast.error('Error: ' + res.error);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.15s ease' }} role="dialog" aria-modal="true" aria-label="Customize stages">
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} aria-hidden="true" />
      <div style={{ position: 'relative', background: '#fff', borderRadius: '16px', width: '480px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1EFEA', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Customize {stageType === 'recruiting' ? 'Recruiting' : 'Sales'} Stages</h2>
            <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>Add, rename, reorder, or remove stages.</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {localStages.map((stage, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid #F7F5F0' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
              <input
                value={stage.name}
                onChange={e => renameStageFn(idx, e.target.value)}
                style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '0.9375rem', outline: 'none' }}
              />
              <button onClick={() => moveStage(idx, -1)} disabled={idx === 0} aria-label="Move stage up" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9375rem', opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
              <button onClick={() => moveStage(idx, 1)} disabled={idx === localStages.length - 1} aria-label="Move stage down" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9375rem', opacity: idx === localStages.length - 1 ? 0.3 : 1 }}>↓</button>
              <button onClick={() => removeStage(idx)} aria-label="Remove stage" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#EF4444', display: 'flex', alignItems: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <input
              value={newStageName}
              onChange={e => setNewStageName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addStage(); }}
              placeholder="New stage name..."
              style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.9375rem', outline: 'none' }}
            />
            <button className="nxt-btn nxt-btn-primary" onClick={addStage}>Add</button>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #F1EFEA', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
          <button className="nxt-btn" onClick={onClose}>Cancel</button>
          <button className="nxt-btn nxt-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}
