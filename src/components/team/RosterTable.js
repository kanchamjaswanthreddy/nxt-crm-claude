'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Avatar from '@/components/Avatar';
import Button from '@/components/ui/Button';
import { AGENT_LEVELS } from '@/lib/constants';
import { requiresW9, getW9Status } from '@/lib/documentTypes';
import { deleteAgent, updateAgentContractLevel } from '@/app/actions/agents';
import { createAgentRequest } from '@/app/actions/agentRequests';
import styles from './RosterTable.module.css';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const dn = (a) => [a?.first_name, a?.middle_name, a?.last_name].filter(Boolean).join(' ') || a?.full_name || a?.name || a?.email || '';

const PAGE_SIZE = 25;

const STATUS_LABELS = {
  invited:              { label: 'Invited',             color: 'var(--brand-blue-accent)', bg: 'rgba(227, 169, 74, 0.1)' },
  active:              { label: 'Active',              color: 'var(--status-success)',     bg: 'rgba(47, 168, 79, 0.08)' },
  onboarding:          { label: 'Onboarding',          color: 'var(--status-warning)',     bg: 'rgba(224, 142, 43, 0.1)' },
  pending_licensing:   { label: 'Pending License',     color: 'var(--brand-gold)',         bg: 'rgba(227, 169, 74, 0.1)' },
  docs_pending_review: { label: 'Docs Pending Review', color: 'var(--status-warning)',     bg: 'rgba(224, 142, 43, 0.1)' },
  docs_pending:        { label: 'Docs Pending',        color: 'var(--brand-gold)',         bg: 'rgba(227, 169, 74, 0.1)' },
  licensed:            { label: 'Licensed',            color: 'var(--status-success)',     bg: 'rgba(47, 168, 79, 0.08)' },
  contracted:          { label: 'Contracted',          color: 'var(--brand-navy)',         bg: 'rgba(12, 16, 34, 0.08)' },
  inactive:            { label: 'Inactive',            color: 'var(--brand-silver)',       bg: 'rgba(169, 172, 177, 0.15)' },
};

const W9_LABEL = {
  not_required:   { text: 'Not required', className: 'w9NA' },
  missing:        { text: 'Missing',   className: 'w9Missing' },
  pending_review: { text: 'Pending',   className: 'w9Pending' },
  approved:       { text: 'Approved',  className: 'w9Approved' },
  rejected:       { text: 'Rejected',  className: 'w9Rejected' },
};

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] || { label: status, color: 'var(--brand-silver)', bg: 'rgba(169, 172, 177, 0.15)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 12px', borderRadius: '999px',
      backgroundColor: s.bg, color: s.color,
      fontSize: 'var(--text-caption)', fontWeight: '600',
      textTransform: 'capitalize',
    }}>
      {s.label}
    </span>
  );
}

function W9Badge({ status }) {
  const cfg = W9_LABEL[status] || W9_LABEL.not_required;
  return <span className={styles[cfg.className]}>{cfg.text}</span>;
}

/* ── Sort icon arrow ── */
function SortArrow({ field, sortConfig }) {
  if (sortConfig.key !== field) return null;
  return <span style={{ marginLeft: 4 }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
}

/* ── Dropdown menu for a single row ── */
function RowMenu({ agent, userProfile, onRefresh, onToast, agents }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setLevelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isAdmin = userProfile?.is_owner || ['admin', 'it_engineer'].includes(userProfile?.role);
  const canManage = isAdmin && !agent.is_owner && agent.id !== userProfile?.uid;

  const handleRequestW9 = async () => {
    setOpen(false);
    const res = await createAgentRequest({
      agencyId: userProfile.agency_id,
      targetAgentId: agent.id,
      requestType: 'w9',
      title: 'W-9 Required',
      description: `Please upload your completed W-9 form.`,
      createdBy: userProfile.uid,
    });
    onToast(res.success
      ? { type: 'success', message: `W-9 request sent to ${dn(agent)}` }
      : { type: 'error', message: res.error || 'Failed to send request' });
  };

  const handleChangeLevel = async (newLevel) => {
    setOpen(false);
    setLevelOpen(false);
    const res = await updateAgentContractLevel(agent.id, newLevel);
    if (res.success) {
      onToast({ type: 'success', message: `Level updated to L${newLevel}` });
      onRefresh();
    } else {
      onToast({ type: 'error', message: res.error || 'Failed to update level' });
    }
  };

  const handleRemove = () => {
    setOpen(false);
    setConfirmState({
      open: true,
      title: 'Remove Agent',
      message: `Remove ${dn(agent)}? This will delete their account and invite.`,
      variant: 'danger',
      onConfirm: async () => {
        const res = await deleteAgent(agent.id);
        onToast(res.success
          ? { type: 'success', message: `Removed ${dn(agent)}` }
          : { type: 'error', message: res.error || 'Failed to remove' });
        if (res.success) onRefresh();
      },
    });
  };

  return (
    <div className={styles.menuAnchor} ref={ref}>
      <button
        className={styles.menuBtn}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Actions for ${dn(agent)}`}
      >
        ⋯
      </button>

      {open && (
        <div className={styles.menuDropdown} role="menu">
          <button className={styles.menuItem} role="menuitem" onClick={() => { setOpen(false); router.push(`/dashboard/team/${agent.id}`); }}>
            View profile
          </button>
          {agents.some(a => a.upline_id === agent.id) && (
            <button className={styles.menuItem} role="menuitem" onClick={() => { setOpen(false); router.push(`/dashboard/team/${agent.id}#team`); }}>
              View team
            </button>
          )}

          {canManage && (
            <>
              <div className={styles.menuDivider} />

              {/* Change level sub-menu */}
              <div style={{ position: 'relative' }}>
                <button className={styles.menuItem} role="menuitem" onClick={() => setLevelOpen(v => !v)}>
                  Change level {levelOpen ? '▾' : '▸'}
                </button>
                {levelOpen && (
                  <div style={{ paddingLeft: 16 }}>
                    {AGENT_LEVELS.map(lvl => (
                      <button
                        key={lvl.level}
                        className={styles.menuItem}
                        role="menuitem"
                        style={{ fontWeight: (agent.agentLevel || 1) === lvl.level ? 700 : 400 }}
                        onClick={() => handleChangeLevel(lvl.level)}
                      >
                        L{lvl.level} — {lvl.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {requiresW9(agent) && (
                <button className={styles.menuItem} role="menuitem" onClick={handleRequestW9}>
                  Request W-9
                </button>
              )}

              <div className={styles.menuDivider} />
              <button className={styles.menuItemDanger} role="menuitem" onClick={handleRemove}>
                Remove agent
              </button>
            </>
          )}
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

/* ════════════════════════════════════════════════
   RosterTable — main export
   ════════════════════════════════════════════════ */

/* ── CSV Export helper ── */
function buildCsv(rows, getOnboardingStatus, getMetrics, agents, w9Map) {
  const header = ['Name', 'Email', 'NXT ID', 'Role', 'Level', 'Upline', 'Status', 'W-9', 'MTD Production'];
  const lines = rows.map(agent => {
    const lvl = AGENT_LEVELS.find(l => l.level === (agent.agentLevel || 1)) || AGENT_LEVELS[0];
    const metrics = getMetrics(agent.id);
    const prod = (metrics.commissionPaid || 0) + (metrics.overrideEarnedPaid || 0);
    const upline = agent.upline_id ? agents.find(a => a.id === agent.upline_id) : null;
    const w9Status = getW9Status(agent, w9Map[agent.id] ? [{ docType: 'w9', status: w9Map[agent.id] }] : []);
    return [
      dn(agent),
      agent.email || '',
      agent.nxt_id || '',
      agent.is_owner ? 'Owner' : (agent.role || ''),
      `L${lvl.level} ${lvl.title}`,
      upline ? dn(upline) : '',
      getOnboardingStatus(agent),
      w9Status,
      prod.toFixed(2),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  return [header.join(','), ...lines].join('\n');
}

/* ── Multi-select filter chip ── */
function FilterChip({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (val) => {
    const next = selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val];
    onChange(next);
  };

  return (
    <div className={styles.chipAnchor} ref={ref}>
      <button
        className={`${styles.chip} ${selected.length > 0 ? styles.chipActive : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        {label}{selected.length > 0 && ` (${selected.length})`} ▾
      </button>
      {open && (
        <div className={styles.chipDropdown}>
          {options.map(opt => (
            <label key={opt.value} className={styles.chipOption}>
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <button className={styles.chipClear} onClick={() => onChange([])}>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function RosterTable({
  agents,
  w9Map,
  teamMetrics,
  userProfile,
  onAssignUpline,
  onRefresh,
  onToast,
  onInvite,
  getOnboardingStatus,
  pendingInviteCount = 0,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /* ── URL-persisted filter state ── */
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [roleFilter, setRoleFilter] = useState(() => {
    const r = searchParams.get('role');
    return r ? r.split(',') : [];
  });
  const [levelFilter, setLevelFilter] = useState(() => {
    const l = searchParams.get('level');
    return l ? l.split(',').map(Number) : [];
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    const s = searchParams.get('status');
    return s ? s.split(',') : [];
  });
  const [missingW9Only, setMissingW9Only] = useState(searchParams.get('w9') === 'missing');

  const [sortConfig, setSortConfig] = useState({ key: 'display_name', direction: 'asc' });
  const [page, setPage] = useState(0);

  const isAdmin = userProfile?.is_owner || ['admin', 'it_engineer'].includes(userProfile?.role);

  /* ── Debounce search ── */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(t);
  }, [search]);

  /* ── Persist filters to URL ── */
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (roleFilter.length) params.set('role', roleFilter.join(','));
    if (levelFilter.length) params.set('level', levelFilter.join(','));
    if (statusFilter.length) params.set('status', statusFilter.join(','));
    if (missingW9Only) params.set('w9', 'missing');
    const qs = params.toString();
    const target = qs ? `${pathname}?${qs}` : pathname;
    router.replace(target, { scroll: false });
  }, [debouncedSearch, roleFilter, levelFilter, statusFilter, missingW9Only, pathname, router]);

  const getMetrics = useCallback(
    (agentId) => teamMetrics.find(m => m.agentId === agentId) || {},
    [teamMetrics],
  );

  /* ── Compute W-9 status for an agent ── */
  const agentW9Status = useCallback(
    (agent) => getW9Status(agent, w9Map[agent.id] ? [{ docType: 'w9', status: w9Map[agent.id] }] : []),
    [w9Map],
  );

  /* ── Count missing W-9s ── */
  const missingW9Count = useMemo(
    () => agents.filter(a => agentW9Status(a) === 'missing').length,
    [agents, agentW9Status],
  );

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    let list = agents;

    // Search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(a =>
        dn(a).toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.nxt_id || '').toLowerCase().includes(q)
      );
    }

    // Role filter
    if (roleFilter.length) {
      list = list.filter(a => {
        const role = a.is_owner ? 'owner' : (a.role || 'agent');
        return roleFilter.includes(role);
      });
    }

    // Level filter
    if (levelFilter.length) {
      list = list.filter(a => levelFilter.includes(a.agentLevel || 1));
    }

    // Status filter
    if (statusFilter.length) {
      list = list.filter(a => statusFilter.includes(getOnboardingStatus(a)));
    }

    // Missing W-9 toggle
    if (missingW9Only) {
      list = list.filter(a => agentW9Status(a) === 'missing');
    }

    return list;
  }, [agents, debouncedSearch, roleFilter, levelFilter, statusFilter, missingW9Only, getOnboardingStatus, agentW9Status]);

  /* ── Sorting ── */
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(0);
  };

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let valA, valB;
    const { key, direction } = sortConfig;

    if (key === 'display_name') {
      valA = dn(a).toLowerCase();
      valB = dn(b).toLowerCase();
    } else if (key === 'production') {
      const mA = getMetrics(a.id);
      const mB = getMetrics(b.id);
      valA = (mA.commissionPaid || 0) + (mA.overrideEarnedPaid || 0);
      valB = (mB.commissionPaid || 0) + (mB.overrideEarnedPaid || 0);
    } else if (key === 'status') {
      valA = getOnboardingStatus(a);
      valB = getOnboardingStatus(b);
    } else if (key === 'level') {
      valA = a.agentLevel || 1;
      valB = b.agentLevel || 1;
    } else {
      valA = a[key] || '';
      valB = b[key] || '';
    }

    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  }), [filtered, sortConfig, getMetrics, getOnboardingStatus]);

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const showingFrom = sorted.length > 0 ? safePage * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min((safePage + 1) * PAGE_SIZE, sorted.length);

  /* ── CSV Export ── */
  const handleExportCsv = () => {
    const csv = buildCsv(sorted, getOnboardingStatus, getMetrics, agents, w9Map);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `roster-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ── Filter options ── */
  const roleOptions = [
    { value: 'owner', label: 'Owner' },
    { value: 'admin', label: 'Admin' },
    { value: 'agent', label: 'Agent' },
    { value: 'it_engineer', label: 'IT Engineer' },
  ];
  const levelOptions = AGENT_LEVELS.map(l => ({ value: l.level, label: `L${l.level} ${l.title}` }));
  const statusOptions = Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v.label }));

  const hasActiveFilters = roleFilter.length > 0 || levelFilter.length > 0 || statusFilter.length > 0 || missingW9Only;

  /* ── Empty state ── */
  if (agents.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.empty}>
          <p className={styles.emptyText}>No team members yet.</p>
          {isAdmin && <Button onClick={onInvite}>Invite Your First Agent</Button>}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden="true">&#x2315;</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by name, email, or NXT ID…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
            {search && (
              <button className={styles.searchClear} onClick={() => { setSearch(''); setPage(0); }} aria-label="Clear search">×</button>
            )}
          </div>

          {isAdmin && (
            <div className={styles.filterRow}>
              <FilterChip label="Role" options={roleOptions} selected={roleFilter} onChange={(v) => { setRoleFilter(v); setPage(0); }} />
              <FilterChip label="Level" options={levelOptions} selected={levelFilter} onChange={(v) => { setLevelFilter(v); setPage(0); }} />
              <FilterChip label="Status" options={statusOptions} selected={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(0); }} />

              <button
                className={`${styles.chip} ${missingW9Only ? styles.chipActive : ''}`}
                onClick={() => { setMissingW9Only(v => !v); setPage(0); }}
              >
                Missing W-9{missingW9Count > 0 && <span className={styles.chipBadge}>{missingW9Count}</span>}
              </button>

              {hasActiveFilters && (
                <button
                  className={styles.chipClearAll}
                  onClick={() => { setRoleFilter([]); setLevelFilter([]); setStatusFilter([]); setMissingW9Only(false); setPage(0); }}
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className={styles.toolbarRight}>
            <button className={styles.exportBtn} onClick={handleExportCsv}>
              Export CSV
            </button>
          </div>
        )}
      </div>

      {/* ── Summary line ── */}
      <div className={styles.summaryBar}>
        {agents.length} member{agents.length !== 1 ? 's' : ''}
        {isAdmin && pendingInviteCount > 0 && <> · {pendingInviteCount} pending invite{pendingInviteCount !== 1 ? 's' : ''}</>}
        {isAdmin && missingW9Count > 0 && <> · <span className={styles.summaryWarn}>{missingW9Count} missing W-9</span></>}
        {isAdmin && filtered.length !== agents.length && <> · showing {filtered.length} filtered</>}
      </div>

      <div className={styles.scrollOuter} tabIndex={0} role="region" aria-label="Agent roster">
      <table className={styles.table} role="table">
        <colgroup>
          <col className={isAdmin ? styles.colMember : styles.colMemberWide} />
          <col className={isAdmin ? styles.colLevel : styles.colLevelWide} />
          {isAdmin && <col className={styles.colUpline} />}
          {isAdmin && <col className={styles.colStatus} />}
          {isAdmin && <col className={styles.colW9} />}
          {isAdmin && <col className={styles.colProd} />}
          {isAdmin && <col className={styles.colActions} />}
        </colgroup>

        <thead className={styles.thead}>
          <tr>
            <th scope="col" className={styles.th} data-sortable="true" tabIndex={0} aria-sort={sortConfig.key === 'display_name' ? sortConfig.direction === 'asc' ? 'ascending' : 'descending' : 'none'} onClick={() => handleSort('display_name')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('display_name'); } }}>
              Member<SortArrow field="display_name" sortConfig={sortConfig} />
            </th>
            <th scope="col" className={styles.th} data-sortable="true" tabIndex={0} aria-sort={sortConfig.key === 'level' ? sortConfig.direction === 'asc' ? 'ascending' : 'descending' : 'none'} onClick={() => handleSort('level')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('level'); } }}>
              Level<SortArrow field="level" sortConfig={sortConfig} />
            </th>
            {isAdmin && <th scope="col" className={styles.th}>Upline</th>}
            {isAdmin && (
              <th scope="col" className={styles.th} data-sortable="true" tabIndex={0} aria-sort={sortConfig.key === 'status' ? sortConfig.direction === 'asc' ? 'ascending' : 'descending' : 'none'} onClick={() => handleSort('status')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('status'); } }}>
                Status<SortArrow field="status" sortConfig={sortConfig} />
              </th>
            )}
            {isAdmin && <th scope="col" className={styles.th}>W-9</th>}
            {isAdmin && (
              <th scope="col" className={styles.thProd} data-sortable="true" tabIndex={0} aria-sort={sortConfig.key === 'production' ? sortConfig.direction === 'asc' ? 'ascending' : 'descending' : 'none'} onClick={() => handleSort('production')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('production'); } }}>
                MTD Prod<SortArrow field="production" sortConfig={sortConfig} />
              </th>
            )}
            {isAdmin && <th scope="col" className={styles.thRight}>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {paged.map((agent) => {
            const metrics = getMetrics(agent.id);
            const prod = (metrics.commissionPaid || 0) + (metrics.overrideEarnedPaid || 0);
            const onbStatus = getOnboardingStatus(agent);
            const lvl = AGENT_LEVELS.find(l => l.level === (agent.agentLevel || 1)) || AGENT_LEVELS[0];
            const w9Status = getW9Status(agent, w9Map[agent.id] ? [{ docType: 'w9', status: w9Map[agent.id] }] : []);
            const uplineAgent = agent.upline_id ? agents.find(a => a.id === agent.upline_id) : null;
            const canAssign = isAdmin && !agent.is_owner && agent.id !== userProfile?.uid;

            return (
              <tr key={agent.id} className={styles.row}>
                {/* Member */}
                <td className={styles.td}>
                  <div className={styles.memberCell}>
                    <Avatar name={dn(agent)} photoUrl={agent.photo_url} size={36} />
                    <div className={styles.memberInfo}>
                      <div className={styles.memberNameRow}>
                        <span className={styles.memberName}>{dn(agent) || 'Name not set'}</span>
                        {agent.nxt_id && <span className={styles.nxtId}>{agent.nxt_id}</span>}
                      </div>
                      <div className={styles.memberMeta}>{agent.email}</div>
                    </div>
                  </div>
                </td>

                {/* Level */}
                <td className={styles.td}>
                  {agent.is_owner ? (
                    <span className={styles.ownerBadge}>Owner</span>
                  ) : (
                    <span className={styles.levelPill}>
                      <span className={styles.levelCircle}>{lvl.level}</span>
                      {lvl.title}
                    </span>
                  )}
                </td>

                {/* Upline */}
                {isAdmin && (
                  <td className={styles.td}>
                    <span className={styles.uplineName}>
                      {uplineAgent ? dn(uplineAgent) : '—'}
                    </span>
                  </td>
                )}

                {/* Status */}
                {isAdmin && (
                  <td className={styles.td}>
                    <StatusBadge status={onbStatus} />
                  </td>
                )}

                {/* W-9 */}
                {isAdmin && (
                  <td className={styles.td}>
                    <W9Badge status={w9Status} />
                  </td>
                )}

                {/* MTD Prod */}
                {isAdmin && (
                  <td className={styles.tdProd}>
                    <span className={prod > 0 ? styles.prodPositive : styles.prodZero}>
                      ${prod.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                )}

                {/* Actions */}
                {isAdmin && (
                  <td className={styles.tdRight}>
                    <div className={styles.actionsCell}>
                      {canAssign && (
                        <button
                          className={styles.assignBtn}
                          onClick={() => onAssignUpline(agent)}
                        >
                          Assign
                        </button>
                      )}
                      <RowMenu
                        agent={agent}
                        userProfile={userProfile}
                        onRefresh={onRefresh}
                        onToast={onToast}
                        agents={agents}
                      />
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      {/* Footer — pagination */}
      {sorted.length > PAGE_SIZE && (
        <div className={styles.footer}>
          <span className={styles.pageInfo}>
            {showingFrom}–{showingTo} of {sorted.length}
          </span>
          <div className={styles.pageControls}>
            <button
              className={styles.pageBtn}
              disabled={safePage === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              aria-label="Previous page"
            >
              ‹
            </button>
            <span className={styles.pageCurrent}>{safePage + 1} / {totalPages}</span>
            <button
              className={styles.pageBtn}
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
