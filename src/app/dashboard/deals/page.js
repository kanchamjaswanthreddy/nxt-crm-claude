"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchDealsPageData } from '@/app/actions/deals-data';
import { useUser } from '@/context/UserContext';
import Avatar from '@/components/Avatar';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const STATUS_MAP = {
  open: { label: 'Submitted', color: '#2D6FC4', bg: 'rgba(45,111,196,0.08)' },
  pending: { label: 'Under Review', color: '#E08E2B', bg: 'rgba(224,142,43,0.08)' },
  won: { label: 'Approved', color: '#2FA84F', bg: 'rgba(47,168,79,0.08)' },
  lost: { label: 'Declined', color: '#D33F3F', bg: 'rgba(211,63,63,0.08)' },
};

const POLICY_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'life', label: 'Life' },
  { value: 'annuity', label: 'Annuity' },
  { value: 'health', label: 'Health' },
  { value: 'disability', label: 'Disability' },
  { value: 'final_expense', label: 'Final Expense' },
  { value: 'group', label: 'Group' },
  { value: 'other', label: 'Other' },
];

const DATE_RANGES = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'ytd', label: 'Year to Date' },
];

function getDateRangeStart(range) {
  const now = new Date();
  switch (range) {
    case 'today': {
      const d = new Date(now); d.setHours(0,0,0,0); return d;
    }
    case 'week': {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d;
    }
    case 'month': {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    case 'quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), qMonth, 1);
    }
    case 'ytd': {
      return new Date(now.getFullYear(), 0, 1);
    }
    default: return null;
  }
}

function formatCurrency(val) {
  if (val == null || isNaN(val)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

function formatDate(ts) {
  if (!ts) return '--';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DealsPage() {
  const router = useRouter();
  const { userProfile } = useUser();

  const [deals, setDeals] = useState([]);
  const [carriers, setCarriers] = useState({});
  const [agents, setAgents] = useState({});
  const [agentPhotos, setAgentPhotos] = useState({});
  const [stages, setStages] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusTab, setStatusTab] = useState('all');
  const [policyType, setPolicyType] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');

  // Detail panel
  const [selectedDeal, setSelectedDeal] = useState(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  const loadData = useCallback(async (profile) => {
    setIsLoading(true);

    const res = await fetchDealsPageData();

    if (res.success) {
      const carriersMap = {};
      res.carriers.forEach(c => { carriersMap[c.id] = c.name; });
      setCarriers(carriersMap);

      const agentsMap = {};
      const photosMap = {};
      for (const [id, a] of Object.entries(res.agentMap)) {
        agentsMap[id] = [a.first_name, a.middle_name, a.last_name].filter(Boolean).join(' ') || a.full_name || `${a.firstName || ''} ${a.lastName || ''}`.trim();
        if (a.photo_url) photosMap[id] = a.photo_url;
      }
      setAgents(agentsMap);
      setAgentPhotos(photosMap);

      const stagesMap = {};
      res.stages.forEach(s => { stagesMap[s.id] = s.name; });
      setStages(stagesMap);

      setDeals(res.deals);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (userProfile) loadData(userProfile);
  }, [userProfile, loadData]);

  // Filtered + sorted deals
  const filteredDeals = useMemo(() => {
    let result = [...deals];

    // Status tab
    if (statusTab !== 'all') {
      result = result.filter(d => d.status === statusTab);
    }

    // Policy type
    if (policyType !== 'all') {
      result = result.filter(d => (d.policyType || '').toLowerCase() === policyType);
    }

    // Date range
    const rangeStart = getDateRangeStart(dateRange);
    if (rangeStart) {
      result = result.filter(d => {
        const created = d.createdAt ? new Date(d.createdAt) : null;
        return created && created >= rangeStart;
      });
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d => {
        const agentName = (agents[d.ownerAgentId] || '').toLowerCase();
        const carrierName = (carriers[d.carrierId] || '').toLowerCase();
        const dealId = d.id.toLowerCase();
        const pType = (d.policyType || '').toLowerCase();
        const stage = (stages[d.stageId] || '').toLowerCase();
        return agentName.includes(q) || carrierName.includes(q) || dealId.includes(q) || pType.includes(q) || stage.includes(q);
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal, bVal;
      if (sortField === 'createdAt') {
        aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      } else if (sortField === 'premiumAmount') {
        aVal = a.premiumAmount || 0;
        bVal = b.premiumAmount || 0;
      } else if (sortField === 'policyType') {
        aVal = a.policyType || '';
        bVal = b.policyType || '';
      } else if (sortField === 'status') {
        aVal = a.status || '';
        bVal = b.status || '';
      } else if (sortField === 'agent') {
        aVal = agents[a.ownerAgentId] || '';
        bVal = agents[b.ownerAgentId] || '';
      }
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [deals, statusTab, policyType, dateRange, searchQuery, sortField, sortDir, agents, carriers, stages]);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const totalPremium = deals.reduce((sum, d) => sum + (d.premiumAmount || 0), 0);
    const activeDeals = deals.filter(d => d.status === 'open' || d.status === 'pending').length;
    const approvedThisMonth = deals.filter(d => {
      if (d.status !== 'won') return false;
      const created = d.createdAt ? new Date(d.createdAt) : null;
      return created && created >= monthStart;
    }).length;
    const approvedLastMonth = deals.filter(d => {
      if (d.status !== 'won') return false;
      const created = d.createdAt ? new Date(d.createdAt) : null;
      return created && created >= lastMonthStart && created <= lastMonthEnd;
    }).length;
    const pendingReview = deals.filter(d => d.status === 'pending').length;

    return { totalPremium, activeDeals, approvedThisMonth, approvedLastMonth, pendingReview };
  }, [deals]);

  const handleSort = useCallback((field) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }, [sortField]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDeals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDeals.map(d => d.id)));
    }
  };

  const statusCounts = useMemo(() => {
    const counts = { all: deals.length, open: 0, pending: 0, won: 0, lost: 0 };
    deals.forEach(d => { if (counts[d.status] !== undefined) counts[d.status]++; });
    return counts;
  }, [deals]);

  const handleExport = () => {
    const headers = ['Deal #', 'Type', 'Agent', 'Carrier', 'Premium', 'Status', 'Stage', 'Created'];
    const rows = filteredDeals.map(d => [
      d.id.substring(0, 8),
      d.policyType || '--',
      agents[d.ownerAgentId] || '--',
      carriers[d.carrierId] || '--',
      d.premiumAmount || 0,
      STATUS_MAP[d.status]?.label || d.status,
      stages[d.stageId] || '--',
      formatDate(d.createdAt),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deals_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'40vh'}}><LoadingSpinner label="Loading..." /></div>;
  }

  return (
    <div>
      <PageHeader
        title="New Businesses"
        subtitle="Track and manage all submitted deals"
        actions={
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => { if (userProfile) loadData(userProfile); }}
              style={{
                background: '#fff',
                color: 'var(--brand-navy)',
                border: '1px solid var(--brand-navy)',
                padding: '10px 20px',
                borderRadius: '999px',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-navy)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = 'var(--brand-navy)'; }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Refresh
            </button>
            <button
              onClick={() => router.push('/dashboard/deals/new')}
              style={{
                background: 'linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-navy-light) 100%)',
                color: '#fff',
                border: 'none',
                padding: '12px 28px',
                borderRadius: '999px',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px -4px rgba(15,42,82,0.4)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px -4px rgba(15,42,82,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px -4px rgba(15,42,82,0.4)'; }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M8 2v12M2 8h12" /></svg>
              New Deal
            </button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard
          label="Total Premium"
          value={formatCurrency(stats.totalPremium)}
          icon={<svg width="20" height="20" fill="none" stroke="var(--brand-navy)" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          accent="var(--brand-navy)"
        />
        <StatCard
          label="Active Deals"
          value={stats.activeDeals}
          icon={<svg width="20" height="20" fill="none" stroke="#2D6FC4" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          accent="#2D6FC4"
        />
        <StatCard
          label="Approved This Month"
          value={stats.approvedThisMonth}
          subtitle={stats.approvedLastMonth > 0 ? `${stats.approvedLastMonth} last month` : null}
          icon={<svg width="20" height="20" fill="none" stroke="#2FA84F" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          accent="#2FA84F"
        />
        <StatCard
          label="Pending Review"
          value={stats.pendingReview}
          icon={<svg width="20" height="20" fill="none" stroke="#E08E2B" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          accent="#E08E2B"
        />
      </div>

      {/* Status Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid #E5E7EB', paddingBottom: '0' }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'open', label: 'Submitted' },
          { key: 'pending', label: 'Under Review' },
          { key: 'won', label: 'Approved' },
          { key: 'lost', label: 'Declined' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusTab(tab.key)}
            style={{
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: statusTab === tab.key ? '600' : '500',
              color: statusTab === tab.key ? 'var(--brand-navy)' : 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              borderBottom: statusTab === tab.key ? '2px solid var(--brand-navy)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'color 0.15s ease, border-color 0.15s ease',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
            <span style={{
              fontSize: '11px',
              fontWeight: '600',
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: statusTab === tab.key ? 'rgba(15,42,82,0.08)' : '#F3F4F6',
              color: statusTab === tab.key ? 'var(--brand-navy)' : 'var(--text-secondary)',
            }}>
              {statusCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '320px' }}>
          <svg width="16" height="16" fill="none" stroke="#9CA3AF" strokeWidth="2" viewBox="0 0 24 24" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search deals..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              fontSize: '13px',
              outline: 'none',
              transition: 'border-color 0.15s ease',
              backgroundColor: '#fff',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--brand-navy)'}
            onBlur={e => e.target.style.borderColor = '#E5E7EB'}
          />
        </div>

        {/* Policy Type */}
        <select
          value={policyType}
          onChange={e => setPolicyType(e.target.value)}
          style={{
            padding: '9px 32px 9px 12px',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            fontSize: '13px',
            backgroundColor: '#fff',
            cursor: 'pointer',
            outline: 'none',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
          }}
        >
          {POLICY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {/* Date Range */}
        <select
          value={dateRange}
          onChange={e => setDateRange(e.target.value)}
          style={{
            padding: '9px 32px 9px 12px',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            fontSize: '13px',
            backgroundColor: '#fff',
            cursor: 'pointer',
            outline: 'none',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
          }}
        >
          {DATE_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {/* Export */}
          <button
            onClick={handleExport}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '9px 16px', border: '1px solid #E5E7EB', borderRadius: '8px',
              fontSize: '13px', fontWeight: '500', backgroundColor: '#fff', cursor: 'pointer',
              color: 'var(--text-primary)', transition: 'border-color 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand-navy)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Export
          </button>
        </div>
      </div>

      {/* Showing count */}
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
        Showing {filteredDeals.length} of {deals.length} deals
        {selectedIds.size > 0 && <span style={{ marginLeft: '12px', color: 'var(--brand-navy)', fontWeight: '600' }}>{selectedIds.size} selected</span>}
      </div>

      {/* Table */}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #E5E7EB' }}>
                <th scope="col" style={{ padding: '12px 16px', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredDeals.length && filteredDeals.length > 0}
                    onChange={toggleSelectAll}
                    style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--brand-navy)' }}
                  />
                </th>
                <SortHeader label="Deal #" field="createdAt" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Type" field="policyType" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Agent" field="agent" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <th scope="col" style={thStyle}>Carrier</th>
                <th scope="col" style={thStyle}>Stage</th>
                <SortHeader label="Premium" field="premiumAmount" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Created" field="createdAt" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {filteredDeals.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '60px 24px', textAlign: 'center' }}>
                    <div style={{ maxWidth: '320px', margin: '0 auto' }}>
                      <div style={{
                        width: '64px', height: '64px', borderRadius: '16px',
                        background: 'linear-gradient(135deg, rgba(15,42,82,0.06), rgba(201,154,61,0.08))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                      }}>
                        <svg width="28" height="28" fill="none" stroke="var(--brand-navy)" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--brand-navy)', margin: '0 0 6px' }}>No deals found</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: '1.5' }}>
                        {searchQuery || statusTab !== 'all' || policyType !== 'all' || dateRange !== 'all'
                          ? 'Try adjusting your filters to see more results.'
                          : 'Submit your first deal to get started.'}
                      </p>
                      {!searchQuery && statusTab === 'all' && (
                        <button
                          onClick={() => router.push('/dashboard/deals/new')}
                          style={{
                            background: 'var(--brand-navy)', color: '#fff', border: 'none',
                            padding: '10px 24px', borderRadius: '999px', fontSize: '13px',
                            fontWeight: '600', cursor: 'pointer',
                          }}
                        >
                          + New Deal
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDeals.map((deal, i) => {
                  const statusInfo = STATUS_MAP[deal.status] || { label: deal.status, color: '#6B7280', bg: '#F3F4F6' };
                  return (
                    <tr
                      key={deal.id}
                      onClick={() => setSelectedDeal(selectedDeal?.id === deal.id ? null : deal)}
                      style={{
                        borderBottom: i < filteredDeals.length - 1 ? '1px solid #F3F4F6' : 'none',
                        cursor: 'pointer',
                        backgroundColor: selectedDeal?.id === deal.id ? 'rgba(15,42,82,0.03)' : 'transparent',
                        transition: 'background-color 0.12s ease',
                      }}
                      onMouseEnter={e => { if (selectedDeal?.id !== deal.id) e.currentTarget.style.backgroundColor = '#FAFAFA'; }}
                      onMouseLeave={e => { if (selectedDeal?.id !== deal.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(deal.id)}
                          onChange={() => toggleSelect(deal.id)}
                          style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--brand-navy)' }}
                        />
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: '600', color: 'var(--brand-navy)', fontSize: '12px', fontFamily: 'monospace' }}>
                        #{deal.id.substring(0, 8).toUpperCase()}
                      </td>
                      <td style={{ padding: '14px 16px', textTransform: 'capitalize', fontWeight: '500' }}>
                        {(deal.policyType || '--').replace('_', ' ')}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar name={agents[deal.ownerAgentId]} photoUrl={agentPhotos[deal.ownerAgentId]} size={28} goldText={false} />
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>{agents[deal.ownerAgentId] || 'Unknown'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                        {carriers[deal.carrierId] || '--'}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                        {stages[deal.stageId] || '--'}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
                        {deal.premiumAmount ? formatCurrency(deal.premiumAmount) : '--'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '4px 10px', borderRadius: '999px',
                          fontSize: '11px', fontWeight: '600',
                          color: statusInfo.color, backgroundColor: statusInfo.bg,
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusInfo.color }} />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {formatDate(deal.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Detail Panel */}
      {selectedDeal && (
        <DealDetailPanel
          deal={selectedDeal}
          agents={agents}
          carriers={carriers}
          stages={stages}
          onClose={() => setSelectedDeal(null)}
          onViewFull={() => router.push(`/dashboard/deals/${selectedDeal.id}`)}
        />
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

const thStyle = { padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'left', letterSpacing: '0.02em' };

function SortHeader({ label, field, sortField, sortDir, onSort }) {
  const isActive = sortField === field;
  return (
    <th
      onClick={() => onSort(field)}
      style={{
        ...thStyle,
        cursor: 'pointer',
        userSelect: 'none',
        color: isActive ? 'var(--brand-navy)' : 'var(--text-secondary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {label}
        <span style={{ fontSize: '10px', opacity: isActive ? 1 : 0.3 }}>
          {isActive && sortDir === 'asc' ? '▲' : '▼'}
        </span>
      </div>
    </th>
  );
}

function StatCard({ label, value, subtitle, icon, accent }) {
  return (
    <div style={{
      padding: '20px',
      borderRadius: '12px',
      border: '1px solid #E5E7EB',
      backgroundColor: '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.2s ease, transform 0.2s ease',
      cursor: 'default',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>{label}</span>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          backgroundColor: `${accent}10`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--brand-navy)', lineHeight: 1.1 }}>{value}</div>
      {subtitle && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{subtitle}</div>}
    </div>
  );
}

function DealDetailPanel({ deal, agents, carriers, stages, onClose, onViewFull }) {
  const statusInfo = STATUS_MAP[deal.status] || { label: deal.status, color: '#6B7280', bg: '#F3F4F6' };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.2)',
          zIndex: 999, animation: 'fadeIn 0.15s ease',
        }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px',
        backgroundColor: '#fff', zIndex: 1000,
        boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.2s ease',
        overflowY: 'auto',
      }}>
        <style>{`
          @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
        `}</style>

        {/* Panel Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace', marginBottom: '2px' }}>#{deal.id.substring(0, 8).toUpperCase()}</div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--brand-navy)', margin: 0 }}>Deal Details</h2>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-secondary)' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        {/* Panel Body */}
        <div style={{ padding: '24px', flex: 1 }}>
          {/* Status */}
          <div style={{ marginBottom: '24px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: '600',
              color: statusInfo.color, backgroundColor: statusInfo.bg,
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: statusInfo.color }} />
              {statusInfo.label}
            </span>
          </div>

          {/* Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <DetailRow label="Policy Type" value={(deal.policyType || '--').replace('_', ' ')} capitalize />
            <DetailRow label="Agent" value={agents[deal.ownerAgentId] || 'Unknown'} />
            <DetailRow label="Carrier" value={carriers[deal.carrierId] || '--'} />
            <DetailRow label="Stage" value={stages[deal.stageId] || '--'} />
            <DetailRow label="Premium Amount" value={deal.premiumAmount ? formatCurrency(deal.premiumAmount) : '--'} highlight />
            <DetailRow label="Policy Number" value={deal.policyNumber || '--'} />
            <DetailRow label="Expected Close" value={deal.expectedCloseDate || '--'} />
            <DetailRow label="Renewal" value={deal.isRenewal ? 'Yes' : 'No'} />
            <DetailRow label="Created" value={formatDate(deal.createdAt)} />
            <DetailRow label="Last Updated" value={formatDate(deal.updatedAt)} />
            {deal.status === 'lost' && deal.lostReason && (
              <DetailRow label="Declined Reason" value={deal.lostReason} />
            )}
          </div>
        </div>

        {/* Panel Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB' }}>
          <button
            onClick={onViewFull}
            style={{
              width: '100%', padding: '12px', borderRadius: '10px',
              background: 'var(--brand-navy)', color: '#fff', border: 'none',
              fontSize: '14px', fontWeight: '600', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            View Full Details
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value, highlight, capitalize }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{
        fontSize: '13px', fontWeight: highlight ? '700' : '500',
        color: highlight ? 'var(--brand-navy)' : 'var(--text-primary)',
        textTransform: capitalize ? 'capitalize' : 'none',
      }}>
        {value}
      </span>
    </div>
  );
}
