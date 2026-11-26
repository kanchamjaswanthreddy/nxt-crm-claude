"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase/clientApp';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useUser } from '@/context/UserContext';
import { assignLead } from '@/app/actions/leads';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import AgentSearchSelect from '@/components/AgentSearchSelect';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

const dn = (a) => [a?.first_name, a?.middle_name, a?.last_name].filter(Boolean).join(' ') || a?.full_name || a?.name || a?.email || '';

export default function UnassignedLeadsPage() {
  const router = useRouter();
  const { userProfile } = useUser();
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [assigningLeadId, setAssigningLeadId] = useState(null);
  const [assignError, setAssignError] = useState('');

  const loadUnassignedLeads = useCallback(async (agencyId) => {
    try {
      const q = query(collection(db, 'leads'), where('agencyId', '==', agencyId), where('ownerAgentId', '==', null));
      const snap = await getDocs(q);
      const fetched = [];
      snap.forEach(d => {
        fetched.push({ id: d.id, ...d.data() });
      });
      setLeads(fetched);
    } catch (e) {
      // silenced
    }
    setIsLoading(false);
  }, []);

  const loadAgents = useCallback(async (agencyId) => {
    try {
      const q = query(collection(db, 'agents'), where('agency_id', '==', agencyId), where('status', '==', 'active'));
      const snap = await getDocs(q);
      const fetched = [];
      snap.forEach(d => {
        fetched.push({ id: d.id, ...d.data() });
      });
      setAgents(fetched);
    } catch (e) {
      // silenced
    }
  }, []);

  useEffect(() => {
    if (userProfile) {
      if (userProfile.role !== 'admin' && userProfile.role !== 'it_engineer') {
        router.push('/dashboard/leads');
        return;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadUnassignedLeads(userProfile.agency_id);
      loadAgents(userProfile.agency_id);
    }
  }, [userProfile, router, loadUnassignedLeads, loadAgents]);

  const handleAssign = async (leadId, agentId) => {
    if (!agentId) return;
    const selectedAgent = agents.find(a => a.id === agentId);
    if (!selectedAgent) return;

    setAssignError('');
    setAssigningLeadId(leadId);
    const res = await assignLead(leadId, selectedAgent.id, selectedAgent.hierarchyPath);
    if (res.success) {
      setLeads(leads.filter(l => l.id !== leadId));
    } else {
      setAssignError(res.error || 'Failed to assign lead');
    }
    setAssigningLeadId(null);
  };

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
      <LoadingSpinner label="Loading..." />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Unassigned Pool"
        subtitle="Leads that could not be auto-assigned."
        breadcrumbs={[{ label: '\u2190 Back to Leads', href: '/dashboard/leads' }]}
      />

      {assignError && (
        <p style={{ color: 'var(--status-error, #D33F3F)', fontSize: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>{assignError}</p>
      )}
      <Card style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-page)' }}>
              <th scope="col" style={{ padding: 'var(--space-2) 24px', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: '600' }}>Name</th>
              <th scope="col" style={{ padding: 'var(--space-2) 24px', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: '600' }}>State</th>
              <th scope="col" style={{ padding: 'var(--space-2) 24px', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: '600' }}>Source</th>
              <th scope="col" style={{ padding: 'var(--space-2) 24px', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: '600' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <EmptyState variant="tableRow" title="No unassigned leads" colSpan={4} />
            ) : (
              leads.map(lead => (
                <tr key={lead.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: 'var(--space-2) 24px' }}>
                    <Link href={`/dashboard/leads/${lead.id}`} style={{ color: 'var(--brand-navy)', fontWeight: '500', textDecoration: 'none' }}>
                      {lead.firstName} {lead.lastName}
                    </Link>
                    {lead.flagged && (
                      <span style={{ marginLeft: 'var(--space-1)', fontSize: 'var(--text-caption)', backgroundColor: 'var(--status-error, #D33F3F)', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
                        License Mismatch
                      </span>
                    )}
                  </td>
                  <td style={{ padding: 'var(--space-2) 24px', color: 'var(--text-secondary)', fontSize: 'var(--text-secondary)' }}>
                    {lead.address?.state || '--'}
                  </td>
                  <td style={{ padding: 'var(--space-2) 24px', color: 'var(--text-secondary)', fontSize: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                    {lead.source?.replace('_', ' ')}
                  </td>
                  <td style={{ padding: 'var(--space-2) 24px', minWidth: '220px' }}>
                    <AgentSearchSelect
                      items={agents}
                      value=""
                      onChange={(id) => { if (id) handleAssign(lead.id, id); }}
                      disabled={assigningLeadId === lead.id}
                      placeholder="Assign to..."
                      renderItem={(agent) => (
                        <>
                          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{dn(agent)}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                            {agent.licensedStates?.join(', ') || 'No licenses'}
                          </span>
                        </>
                      )}
                      searchFields={(a) => [dn(a), a.nxt_id || '', ...(a.licensedStates || [])]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
