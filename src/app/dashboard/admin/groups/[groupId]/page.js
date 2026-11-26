"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { fetchGroupMembers, addGroupMember, removeGroupMember, searchAgentsForGroup, seedBillingExemptGroup } from '@/app/actions/groups';
import { getGroupById } from '@/lib/groups';
import Card from '@/components/ui/Card';
import Avatar from '@/components/Avatar';

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const router = useRouter();
  const { userProfile } = useUser();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const searchTimeout = useRef(null);
  const searchBoxRef = useRef(null);

  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.role !== 'admin' && userProfile.role !== 'it_engineer') {
      router.push('/dashboard');
      return;
    }

    const groupDef = getGroupById(groupId);
    if (!groupDef) {
      setError('Group not found');
      setIsLoading(false);
      return;
    }

    const load = async () => {
      // Auto-seed billing-exempt group with currently exempt agents on first load
      if (groupDef.billingExempt) {
        await seedBillingExemptGroup();
      }
      const res = await fetchGroupMembers(groupId);
      if (res.success) {
        setGroup(groupDef);
        setMembers(res.members);
      } else {
        setError(res.error || 'Failed to load group');
      }
      setIsLoading(false);
    };
    load();
  }, [userProfile, router, groupId]);

  // Debounced search
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      const res = await searchAgentsForGroup(query);
      if (res.success) {
        // Filter out agents already in the group
        const memberIds = new Set(members.map(m => m.agentId));
        setSearchResults(res.agents.filter(a => !memberIds.has(a.id)));
      }
      setIsSearching(false);
    }, 300);
  }, [members]);

  const handleAdd = async (agentId) => {
    setIsAdding(agentId);
    setError('');
    const res = await addGroupMember(groupId, agentId);
    if (res.success) {
      setMembers(prev => [...prev, { agentId, ...res.member }]);
      setSearchQuery('');
      setSearchResults([]);
      setSuccessMsg(`${res.member.name} added to group`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } else {
      setError(res.error || 'Failed to add member');
      setTimeout(() => setError(''), 4000);
    }
    setIsAdding(null);
  };

  const handleRemove = async (agentId) => {
    setRemovingId(agentId);
    setError('');
    const res = await removeGroupMember(groupId, agentId);
    if (res.success) {
      setMembers(prev => prev.filter(m => m.agentId !== agentId));
    } else {
      setError(res.error || 'Failed to remove member');
      setTimeout(() => setError(''), 4000);
    }
    setRemovingId(null);
  };

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading group...
      </div>
    );
  }

  if (error && !group) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: 'var(--space-6)' }}>
        <p style={{ color: 'var(--status-error)', fontWeight: 600 }}>{error}</p>
        <button
          onClick={() => router.push('/dashboard/admin/groups')}
          style={{ background: 'none', border: 'none', color: 'var(--brand-blue)', cursor: 'pointer', fontSize: 'var(--text-secondary)' }}
        >
          ← Back to Groups
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <button
        onClick={() => router.push('/dashboard/admin/groups')}
        style={{
          background: 'none', border: 'none', color: 'var(--brand-blue)',
          cursor: 'pointer', marginBottom: 'var(--space-2)', padding: 0,
          fontSize: 'var(--text-secondary)',
        }}
      >
        ← Back to Groups
      </button>

      {/* Group header */}
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <h1 style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-h1)', margin: 0 }}>
            {group.name}
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 8px 0', fontSize: 'var(--text-secondary)' }}>
          {group.description}
        </p>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontSize: '12px', fontWeight: '600', color: 'var(--brand-navy)',
          backgroundColor: 'rgba(10, 37, 64, 0.06)',
          padding: '4px 12px', borderRadius: '999px',
        }}>
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </span>
      </div>

      {/* Feedback messages */}
      {error && (
        <div style={{
          padding: '10px 16px', borderRadius: '8px', marginBottom: 'var(--space-2)',
          backgroundColor: 'rgba(211, 63, 63, 0.08)', color: 'var(--status-error)',
          fontSize: 'var(--text-secondary)', fontWeight: 500,
        }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: '8px', marginBottom: 'var(--space-2)',
          backgroundColor: 'rgba(39, 174, 96, 0.08)', color: 'var(--status-success)',
          fontSize: 'var(--text-secondary)', fontWeight: 500,
        }}>
          {successMsg}
        </div>
      )}

      {/* Add member search */}
      <Card style={{ marginBottom: 'var(--space-3)', padding: '20px 24px' }}>
        <h3 style={{ margin: '0 0 12px 0', color: 'var(--brand-navy)', fontSize: '14px', fontWeight: 700 }}>
          Add Members
        </h3>
        <div ref={searchBoxRef} style={{ position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by name or NXT ID..."
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1.5px solid var(--border-color)',
              borderRadius: '10px',
              fontSize: 'var(--text-secondary)',
              outline: 'none',
              transition: 'border-color 0.2s ease',
              boxSizing: 'border-box',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--brand-navy)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; }}
          />
          {isSearching && (
            <div style={{
              position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-secondary)', fontSize: '12px',
            }}>
              Searching...
            </div>
          )}

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              marginTop: '4px', backgroundColor: '#fff',
              border: '1px solid var(--border-color)', borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
              maxHeight: '280px', overflowY: 'auto', zIndex: 50,
            }}>
              {searchResults.map(agent => (
                <div
                  key={agent.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(10, 37, 64, 0.03)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <Avatar name={agent.name} photoUrl={agent.photo_url} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {agent.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {agent.nxtId && <span>{agent.nxtId} · </span>}
                        {agent.email}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAdd(agent.id)}
                    disabled={isAdding === agent.id}
                    style={{
                      padding: '4px 14px', borderRadius: '999px',
                      border: '1.5px solid var(--brand-navy)',
                      backgroundColor: isAdding === agent.id ? 'var(--brand-navy)' : 'transparent',
                      color: isAdding === agent.id ? '#fff' : 'var(--brand-navy)',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.15s ease', flexShrink: 0,
                    }}
                  >
                    {isAdding === agent.id ? 'Adding...' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              marginTop: '4px', backgroundColor: '#fff',
              border: '1px solid var(--border-color)', borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
              padding: '16px', textAlign: 'center', color: 'var(--text-secondary)',
              fontSize: '13px', zIndex: 50,
            }}>
              No agents found matching &ldquo;{searchQuery}&rdquo;
            </div>
          )}
        </div>
      </Card>

      {/* Members list */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'rgba(0,0,0,0.015)',
        }}>
          <h3 style={{ margin: 0, color: 'var(--brand-navy)', fontSize: '14px', fontWeight: 700 }}>
            Members ({members.length})
          </h3>
        </div>

        {members.length === 0 ? (
          <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--text-secondary)' }}>
            No members yet. Use the search above to add agents to this group.
          </div>
        ) : (
          <div>
            {members.map((member, idx) => (
              <div
                key={member.agentId}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 24px',
                  borderBottom: idx < members.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.015)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <Avatar name={member.name} photoUrl={member.photo_url} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                      {member.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {member.nxtId && <span>{member.nxtId}</span>}
                      <span>{member.email}</span>
                      {member.addedAt && (
                        <span>· Added {new Date(member.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleRemove(member.agentId)}
                  disabled={removingId === member.agentId}
                  style={{
                    padding: '4px 12px', borderRadius: '999px',
                    border: '1.5px solid var(--status-error, #D33F3F)',
                    backgroundColor: 'transparent',
                    color: 'var(--status-error, #D33F3F)',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s ease', flexShrink: 0,
                    opacity: removingId === member.agentId ? 0.5 : 1,
                  }}
                >
                  {removingId === member.agentId ? 'Removing...' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Group policies info */}
      {(group.menuLinks?.length > 0 || group.billingExempt || group.teamLeader) && (
        <Card style={{ marginTop: 'var(--space-3)', padding: '20px 24px' }}>
          <h3 style={{ margin: '0 0 12px 0', color: 'var(--brand-navy)', fontSize: '14px', fontWeight: 700 }}>
            Group Policies
          </h3>
          <p style={{ margin: '0 0 12px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
            Members of this group get access to the following:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {group.teamLeader && (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(201, 154, 61, 0.06)',
                  borderRadius: '8px',
                  border: '1px solid rgba(201, 154, 61, 0.15)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C99A3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <div>
                  <div style={{ fontWeight: 600, color: '#C99A3D', fontSize: '13px' }}>
                    Team Leader (Sub-Admin)
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Can approve agents, review documents, and manage their downline team
                  </div>
                </div>
              </div>
            )}
            {group.billingExempt && (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(47, 168, 79, 0.06)',
                  borderRadius: '8px',
                  border: '1px solid rgba(47, 168, 79, 0.15)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2FA84F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <div>
                  <div style={{ fontWeight: 600, color: '#2FA84F', fontSize: '13px' }}>
                    Billing Exemption
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Members are exempt from monthly subscription charges
                  </div>
                </div>
              </div>
            )}
            {group.menuLinks?.map((link, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(10, 37, 64, 0.03)',
                  borderRadius: '8px',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                    {link.label}
                    {link.external && <span style={{ marginLeft: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>↗</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Appears in: <strong style={{ textTransform: 'capitalize' }}>{link.menu}</strong> menu
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
