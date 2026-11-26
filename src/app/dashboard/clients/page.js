"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { fetchClients } from '@/app/actions/clients';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

export default function ClientsPage() {
  const router = useRouter();
  const { userProfile } = useUser();
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadClients = useCallback(async () => {
    if (!userProfile?.agency_id) return;
    setIsLoading(true);
    const res = await fetchClients();
    if (res.success) {
      setClients(res.clients);
    } else {
      setError(res.error || 'Failed to load clients.');
    }
    setIsLoading(false);
  }, [userProfile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadClients();
  }, [loadClients]);

  const filtered = clients.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = `${c.firstName} ${c.lastName}`.toLowerCase();
    return (
      name.includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  });

  const totalPolicies = clients.reduce((sum, c) => sum + (c.policyCount || 0), 0);
  const clientsWithPolicies = clients.filter(c => c.policyCount > 0).length;

  if (isLoading) {
    return <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'40vh'}}><LoadingSpinner label="Loading..." /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Manage your client book and policies"
        actions={<Button onClick={() => router.push('/dashboard/clients/new')}>+ Add Client</Button>}
      />

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px', marginBottom: '24px',
      }}>
        {[
          { label: 'Total Clients', value: clients.length, color: 'var(--brand-navy)' },
          { label: 'With Policies', value: clientsWithPolicies, color: '#16a34a' },
          { label: 'Total Policies', value: totalPolicies, color: 'var(--brand-gold)' },
        ].map(stat => (
          <Card key={stat.label}>
            <div style={{ padding: '4px 0' }}>
              <div style={{
                fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px',
              }}>{stat.label}</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: stat.color }}>{stat.value}</div>
            </div>
          </Card>
        ))}
      </div>

      {error && (
        <div style={{
          backgroundColor: 'rgba(220,38,38,0.06)', color: '#dc2626',
          padding: '12px 16px', borderRadius: '10px', marginBottom: '20px',
          fontSize: '16px', border: '1px solid rgba(220,38,38,0.15)',
        }}>
          {error}
        </div>
      )}

      {/* Search & Table */}
      <Card>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-secondary)', opacity: 0.5, display: 'flex',
            }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '12px 16px 12px 42px',
                borderRadius: '10px', border: '1px solid var(--border-color)',
                fontSize: '16px', backgroundColor: 'var(--surface-page)',
                transition: 'border-color 0.15s',
              }}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          clients.length === 0 ? (
            <EmptyState
              variant="rich"
              title="No clients yet"
              description="Add your first client to start tracking their policies and coverage."
              action={{ label: '+ Add Your First Client', onClick: () => router.push('/dashboard/clients/new') }}
            />
          ) : (
            <EmptyState variant="minimal" title={`No clients match "${search}"`} />
          )
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th scope="col" style={thStyle}>Client</th>
                  <th scope="col" style={thStyle}>Contact</th>
                  <th scope="col" style={{ ...thStyle, textAlign: 'center' }}>Policies</th>
                  <th scope="col" style={thStyle}>Added</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => {
                  const initials = `${client.firstName?.[0] || ''}${client.lastName?.[0] || ''}`.toUpperCase();
                  return (
                    <tr
                      key={client.id}
                      onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer', transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(27,43,75,0.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '38px', height: '38px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--brand-navy) 0%, #1B2A4E 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: '15px', fontWeight: 700,
                            flexShrink: 0, letterSpacing: '0.5px',
                          }}>
                            {initials}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--brand-navy)', fontSize: '16px' }}>
                            {client.firstName} {client.lastName}
                          </span>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: '15px' }}>
                          {client.email && <div style={{ color: 'var(--text-primary)', marginBottom: '2px' }}>{client.email}</div>}
                          {client.phone && <div style={{ color: 'var(--text-secondary)' }}>{client.phone}</div>}
                          {!client.email && !client.phone && <span style={{ color: 'var(--text-secondary)' }}>--</span>}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          minWidth: '28px', height: '28px', padding: '0 10px',
                          borderRadius: '999px',
                          backgroundColor: client.policyCount > 0 ? 'rgba(22,163,74,0.08)' : 'rgba(0,0,0,0.04)',
                          color: client.policyCount > 0 ? '#16a34a' : 'var(--text-secondary)',
                          fontSize: '15px', fontWeight: 700,
                        }}>
                          {client.policyCount}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: '15px' }}>
                        {client.createdAt ? new Date(client.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const thStyle = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: '13px',
  color: 'var(--text-secondary)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const tdStyle = {
  padding: '14px 16px',
  fontSize: '16px',
};
