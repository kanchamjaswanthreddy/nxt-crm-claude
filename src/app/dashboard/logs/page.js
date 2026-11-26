'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { fetchActivityLogs } from '@/app/actions/activityLogActions';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'auth', label: 'Authentication' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'admin', label: 'Admin Actions' },
  { value: 'documents', label: 'Documents' },
  { value: 'status', label: 'Status Changes' },
  { value: 'invite', label: 'Invites' },
];

const CATEGORY_COLORS = {
  auth: { bg: '#EBF5FB', color: '#1B4F72' },
  onboarding: { bg: '#F5EEF8', color: '#6C3483' },
  admin: { bg: '#FDEDEC', color: '#922B21' },
  documents: { bg: '#E8F8F5', color: '#0E6655' },
  status: { bg: '#FEF9E7', color: '#7D6608' },
  invite: { bg: '#EAF2F8', color: '#2471A3' },
};

function formatTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function LogsPage() {
  const { userProfile, isLoading: userLoading } = useUser();
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize] = useState(50);
  const [lastTimestamp, setLastTimestamp] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // M-23: Allow admins, IT engineers, and owners to access this page
  const canAccessLogs = userProfile?.role === 'admin' || userProfile?.role === 'it_engineer' || userProfile?.is_owner;

  useEffect(() => {
    if (!userLoading && !canAccessLogs) {
      router.push('/dashboard');
    }
  }, [userLoading, canAccessLogs, router]);

  const loadLogs = useCallback(async (reset = false) => {
    setIsLoading(true);
    try {
      const result = await fetchActivityLogs({
        category: category || null,
        limit: pageSize,
        beforeTimestamp: reset ? null : lastTimestamp,
      });
      if (result.success) {
        const newLogs = result.logs || [];
        setLogs(prev => reset ? newLogs : [...prev, ...newLogs]);
        setHasMore(newLogs.length === pageSize);
        if (newLogs.length > 0) {
          setLastTimestamp(newLogs[newLogs.length - 1].timestamp);
        }
      }
    } catch (err) {
      // silenced
    } finally {
      setIsLoading(false);
    }
  }, [category, pageSize, lastTimestamp]);

  useEffect(() => {
    if (canAccessLogs) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLogs([]);
      setLastTimestamp(null);
      setHasMore(true);
      loadLogs(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, canAccessLogs]);

  const filteredLogs = searchQuery
    ? logs.filter(l =>
        (l.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.actorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.targetName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.action || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : logs;

  if (userLoading || !canAccessLogs) {
    return null;
  }

  return (
    <div style={{ padding: '32px' }}>
      <PageHeader title="Activity Logs" subtitle="System-wide audit trail — visible only to you" />

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(0,0,0,0.15)',
            fontSize: '1rem',
            backgroundColor: '#fff',
            minWidth: '160px',
          }}
        >
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search logs..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(0,0,0,0.15)',
            fontSize: '1rem',
            flex: 1,
            minWidth: '200px',
            maxWidth: '400px',
          }}
        />

        <button
          onClick={() => { setLogs([]); setLastTimestamp(null); loadLogs(true); }}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(0,0,0,0.15)',
            backgroundColor: '#fff',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Logs Table */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        border: '1px solid rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--brand-navy)', color: '#fff' }}>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.9375rem', fontWeight: '600' }}>Time</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.9375rem', fontWeight: '600' }}>Category</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.9375rem', fontWeight: '600' }}>Action</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.9375rem', fontWeight: '600' }}>Actor</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.9375rem', fontWeight: '600' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 && !isLoading && (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No activity logs found
                </td>
              </tr>
            )}
            {filteredLogs.map((log, i) => {
              const catStyle = CATEGORY_COLORS[log.category] || { bg: '#f0f0f0', color: '#333' };
              return (
                <tr key={log.id || i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <td style={{ padding: '10px 16px', fontSize: '0.9375rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8125rem',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      backgroundColor: catStyle.bg,
                      color: catStyle.color,
                    }}>
                      {log.category}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '0.9375rem', fontWeight: '500' }}>
                    {(log.action || '').replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '0.9375rem' }}>
                    <div>{log.actorName || '—'}</div>
                    {log.actorNxtId && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{log.actorNxtId}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '0.9375rem', color: 'var(--text-secondary)', maxWidth: '400px' }}>
                    {log.description}
                    {log.targetName && (
                      <span style={{ fontWeight: '500', color: 'var(--brand-navy)' }}> — {log.targetName}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {hasMore && !isLoading && filteredLogs.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            onClick={() => loadLogs(false)}
            style={{
              padding: '8px 24px',
              borderRadius: '8px',
              border: '1px solid rgba(0,0,0,0.15)',
              backgroundColor: '#fff',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Load More
          </button>
        </div>
      )}

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
          <LoadingSpinner label="Loading..." />
        </div>
      )}
    </div>
  );
}
