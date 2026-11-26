"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { fetchGroups } from '@/app/actions/groups';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

const GROUP_ICONS = {
  medical: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-navy)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A2 2 0 0 0 3 4.3v15.4a2 2 0 0 0 1.8 2h4.4a2 2 0 0 0 1.8-2V4.3a2 2 0 0 0-1.8-2H4.8z" />
      <path d="M14 2.3a2 2 0 0 0-2 2v6.4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V4.3a2 2 0 0 0-2-2h-4z" />
      <path d="M14 15.3a2 2 0 0 0-2 2v2.4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.4a2 2 0 0 0-2-2h-4z" />
    </svg>
  ),
  'billing-exempt': (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-navy)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  'team-leader': (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-navy)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  default: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-navy)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

export default function GroupsDashboard() {
  const router = useRouter();
  const { userProfile } = useUser();
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.role !== 'admin' && userProfile.role !== 'it_engineer') {
      router.push('/dashboard');
      return;
    }

    const load = async () => {
      const res = await fetchGroups();
      if (res.success) setGroups(res.groups);
      setIsLoading(false);
    };
    load();
  }, [userProfile, router]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <LoadingSpinner label="Loading groups..." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Groups"
        subtitle="Manage access groups and their members. Groups control which tools and links agents can see."
      />

      {groups.length === 0 ? (
        <EmptyState variant="minimal" title="No groups configured yet." />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 'var(--space-3)',
        }}>
          {groups.map(group => (
            <div
              key={group.id}
              onClick={() => router.push(`/dashboard/admin/groups/${group.id}`)}
              style={{
                position: 'relative',
                backgroundColor: '#fff',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '28px 24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--brand-navy)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(10, 37, 64, 0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Subtle accent strip at top */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'linear-gradient(90deg, var(--brand-navy), var(--brand-gold, #C99A3D))',
                borderRadius: '16px 16px 0 0',
              }} />

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(10, 37, 64, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {GROUP_ICONS[group.icon] || GROUP_ICONS.default}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    margin: '0 0 2px 0',
                    color: 'var(--brand-navy)',
                    fontSize: '16px',
                    fontWeight: '700',
                    lineHeight: 1.3,
                  }}>
                    {group.name}
                  </h3>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: 'var(--brand-navy)',
                    backgroundColor: 'rgba(10, 37, 64, 0.06)',
                    padding: '2px 10px',
                    borderRadius: '999px',
                  }}>
                    {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </div>

              <p style={{
                margin: 0,
                color: 'var(--text-secondary)',
                fontSize: '13px',
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {group.description}
              </p>

              {/* Arrow indicator */}
              <div style={{
                position: 'absolute',
                bottom: '16px',
                right: '20px',
                color: 'var(--text-secondary)',
                fontSize: '18px',
                opacity: 0.4,
              }}>
                →
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
