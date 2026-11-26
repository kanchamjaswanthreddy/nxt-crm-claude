"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchLeads, bulkUpdateLeadStatus, bulkDeleteLeads } from '@/app/actions/leads';
import { useUser } from '@/context/UserContext';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import FilterBar from '@/components/ui/FilterBar';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import s from './leads.module.css';

const STATUS_MAP = {
  new: { label: 'New', status: 'gold' },
  contacted: { label: 'Contacted', status: 'info' },
  qualified: { label: 'Qualified', status: 'success' },
  proposal_sent: { label: 'Proposal Sent', status: 'warning' },
  client: { label: 'Client', status: 'success' },
  lost: { label: 'Lost', status: 'neutral' },
  unresponsive: { label: 'Unresponsive', status: 'neutral' },
};

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'client', label: 'Client' },
  { value: 'lost', label: 'Lost' },
  { value: 'unresponsive', label: 'Unresponsive' },
];

const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'referral', label: 'Referral' },
  { value: 'website', label: 'Website' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'import', label: 'Import' },
];

export default function LeadsPage() {
  const router = useRouter();
  const { userProfile } = useUser();
  const toast = useToast();
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const loadLeads = useCallback(async () => {
    setIsLoading(true);
    const res = await fetchLeads();
    if (res.success) {
      setLeads(res.leads);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (userProfile) {
      loadLeads();
    }
  }, [userProfile, loadLeads]);

  const filtered = useMemo(() => {
    let result = leads;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q))
      );
    }
    if (statusFilter) {
      result = result.filter(l => l.status === statusFilter);
    }
    if (sourceFilter) {
      result = result.filter(l => l.source === sourceFilter);
    }
    return result;
  }, [leads, search, statusFilter, sourceFilter]);

  const clearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('');
    setSourceFilter('');
  }, []);

  const handleBulkStatus = async (newStatus) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const res = await bulkUpdateLeadStatus([...selectedIds], newStatus);
    if (res.success) {
      toast.success(`Updated ${res.updated} lead(s) to ${newStatus.replace(/_/g, ' ')}`);
      setSelectedIds(new Set());
      loadLeads();
    } else {
      toast.error(res.error || 'Bulk update failed');
    }
    setBulkLoading(false);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} lead(s)? This cannot be undone.`)) return;
    setBulkLoading(true);
    const res = await bulkDeleteLeads([...selectedIds]);
    if (res.success) {
      toast.success(`Deleted ${res.deleted} lead(s)`);
      setSelectedIds(new Set());
      loadLeads();
    } else {
      toast.error(res.error || 'Bulk delete failed');
    }
    setBulkLoading(false);
  };

  const isPrivileged = userProfile?.role === 'admin' || userProfile?.role === 'it_engineer';

  const columns = useMemo(() => [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (_, row) => (
        <div className={s.nameCell}>
          <Link href={`/dashboard/leads/${row.id}`} className={s.nameLink}>
            {row.firstName} {row.lastName}
          </Link>
          {row.duplicateOfLeadId && (
            <StatusBadge status="warning" dot={false}>Merged</StatusBadge>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val) => {
        const mapped = STATUS_MAP[val] || { label: val, status: 'neutral' };
        return <StatusBadge status={mapped.status}>{mapped.label}</StatusBadge>;
      },
    },
    {
      key: 'source',
      label: 'Source',
      sortable: true,
      render: (val) => (
        <span className={s.secondaryText}>
          {val ? val.replace(/_/g, ' ') : '--'}
        </span>
      ),
    },
    {
      key: 'state',
      label: 'State',
      render: (_, row) => (
        <span className={s.secondaryText}>{row.address?.state || '--'}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date Added',
      sortable: true,
      render: (val) => (
        <span className={s.secondaryText}>
          {val ? new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
        </span>
      ),
    },
  ], []);

  const actions = (
    <div className={s.headerActions}>
      {isPrivileged && (
        <Button variant="secondary" onClick={() => router.push('/dashboard/leads/unassigned')}>
          Unassigned Pool
        </Button>
      )}
      <Button variant="secondary" onClick={() => router.push('/dashboard/leads/import')}>
        Import
      </Button>
      <Button onClick={() => router.push('/dashboard/leads/new')}>
        New Lead
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="Contacts & Leads"
          subtitle={`${leads.length} total`}
          actions={actions}
        />
        <div className={s.loadingWrap}>
          <LoadingSpinner label="Loading leads..." />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Contacts & Leads"
        subtitle={`${filtered.length} of ${leads.length} lead${leads.length !== 1 ? 's' : ''}`}
        actions={actions}
      />

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: 'Search by name, email, or phone...' }}
        filters={[
          { key: 'status', label: 'All Statuses', options: STATUS_OPTIONS, value: statusFilter, onChange: setStatusFilter },
          { key: 'source', label: 'All Sources', options: SOURCE_OPTIONS, value: sourceFilter, onChange: setSourceFilter },
        ]}
        onClear={clearFilters}
        className={s.filterBar}
      />

      {selectedIds.size > 0 && (
        <div className={s.bulkBar}>
          <span className={s.bulkCount}>{selectedIds.size} selected</span>
          <select
            onChange={(e) => { if (e.target.value) handleBulkStatus(e.target.value); e.target.value = ''; }}
            disabled={bulkLoading}
            style={{
              padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)',
              fontSize: '15px', cursor: 'pointer',
            }}
          >
            <option value="">Change status...</option>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={handleBulkDelete}
            disabled={bulkLoading}
            className={s.bulkDeleteBtn}
          >
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className={s.bulkClearBtn}
          >
            Clear
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => router.push(`/dashboard/leads/${row.id}`)}
        defaultSort={{ key: 'createdAt', dir: 'desc' }}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyState={
          <EmptyState
            variant="minimal"
            title={search || statusFilter || sourceFilter
              ? 'No leads match your filters'
              : 'No leads yet'}
            action={{
              label: search || statusFilter || sourceFilter ? 'Clear filters' : 'Create your first lead',
              onClick: search || statusFilter || sourceFilter ? clearFilters : () => router.push('/dashboard/leads/new'),
            }}
          />
        }
      />
    </div>
  );
}
