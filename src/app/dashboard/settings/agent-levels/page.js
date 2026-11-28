"use client";

import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAgents, updateAgentContractLevel } from '@/app/actions/agents';
import { useUser } from '@/context/UserContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { AGENT_LEVELS } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';

const dn = (a) => [a?.first_name, a?.middle_name, a?.last_name].filter(Boolean).join(' ') || a?.full_name || a?.name || a?.email || '';

export default function AgentLevelsSettings() {
  const router = useRouter();
  const { userProfile } = useUser();
  const toast = useToast();
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAgent, setEditingAgent] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    const res = await fetchAgents();
    if (res.success) {
      setAgents(res.agents);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.role !== 'admin' && userProfile.role !== 'it_engineer') {
      router.push('/dashboard');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [userProfile, router]);

  const handleOpenEdit = (agent) => {
    setEditingAgent(agent);
    setSelectedLevel(agent.agentLevel || 1);
  };

  const handleSave = async () => {
    if (!editingAgent) return;
    setIsSaving(true);

    const res = await updateAgentContractLevel(editingAgent.id, selectedLevel);
    if (res.success) {
      const levelInfo = AGENT_LEVELS.find(l => l.level === selectedLevel);
      setAgents(prev => prev.map(a =>
        a.id === editingAgent.id
          ? { ...a, agentLevel: selectedLevel, contractLevel: levelInfo?.title }
          : a
      ));
      setEditingAgent(null);
    } else {
      toast.error("Failed to update: " + res.error);
    }

    setIsSaving(false);
  };

  if (isLoading) return <LoadingSpinner label="Loading" />;

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <h1 style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-h1)', margin: '0 0 8px 0' }}>Agent Levels & Subscriptions</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Manage agent positions and monthly subscription tiers. Only admin/owner can promote agents.</p>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
              <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)', fontSize: 'var(--text-caption)' }}>Name</th>
              <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)', fontSize: 'var(--text-caption)' }}>Email</th>
              <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)', fontSize: 'var(--text-caption)' }}>Current Level</th>
              <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)', fontSize: 'var(--text-caption)' }}>Monthly Price</th>
              <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)', fontSize: 'var(--text-caption)' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {agents.filter(a => a.role !== 'admin').map(agent => {
              const levelInfo = AGENT_LEVELS.find(l => l.level === (agent.agentLevel || 1)) || AGENT_LEVELS[0];
              return (
                <tr key={agent.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: 'var(--space-2)', fontWeight: '500', color: 'var(--text-primary)' }}>{dn(agent)}</td>
                  <td style={{ padding: 'var(--space-2)', color: 'var(--text-secondary)', fontSize: 'var(--text-caption)' }}>{agent.email}</td>
                  <td style={{ padding: 'var(--space-2)' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      backgroundColor: 'rgba(10, 37, 64, 0.06)', color: 'var(--brand-navy)',
                      padding: '4px 12px', borderRadius: '999px', fontWeight: '600', fontSize: 'var(--text-caption)'
                    }}>
                      <span style={{
                        width: '18px', height: '18px', borderRadius: '50%',
                        backgroundColor: 'var(--brand-navy)', color: '#fff',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '13px', fontWeight: '700'
                      }}>
                        {levelInfo.level}
                      </span>
                      {levelInfo.title}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--brand-navy)' }}>
                    ${levelInfo.price}/mo
                  </td>
                  <td style={{ padding: 'var(--space-2)' }}>
                    <Button variant="secondary" size="small" onClick={() => handleOpenEdit(agent)}>
                      Change Level
                    </Button>
                  </td>
                </tr>
              );
            })}
            {agents.filter(a => a.role !== 'admin').length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No agents found. Invite agents to see them here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Edit Modal */}
      {editingAgent && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 10000
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingAgent(null); }}
        >
          <Card style={{ width: '440px' }}>
            <h3 style={{ margin: '0 0 4px 0', color: 'var(--brand-navy)', fontSize: 'var(--text-h2)' }}>
              Change Level
            </h3>
            <p style={{ margin: '0 0 var(--space-3) 0', color: 'var(--text-secondary)', fontSize: 'var(--text-caption)' }}>
              Promoting <strong>{dn(editingAgent)}</strong> to a new subscription tier.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: 'var(--space-3)' }}>
              {AGENT_LEVELS.map(lvl => (
                <label
                  key={lvl.level}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                    backgroundColor: selectedLevel === lvl.level ? 'rgba(10, 37, 64, 0.06)' : 'transparent',
                    border: selectedLevel === lvl.level ? '1.5px solid var(--brand-navy)' : '1px solid var(--border-color)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="radio"
                      name="agentLevel"
                      checked={selectedLevel === lvl.level}
                      onChange={() => setSelectedLevel(lvl.level)}
                      style={{ accentColor: 'var(--brand-navy)' }}
                    />
                    <div>
                      <span style={{ fontSize: 'var(--text-secondary)', fontWeight: selectedLevel === lvl.level ? '600' : '400', color: 'var(--text-primary)' }}>
                        Level {lvl.level} — {lvl.title}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: 'var(--text-secondary)', fontWeight: '600', color: selectedLevel === lvl.level ? 'var(--brand-navy)' : 'var(--text-secondary)' }}>
                    ${lvl.price}/mo
                  </span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => setEditingAgent(null)} disabled={isSaving}>Cancel</Button>
              <Button onClick={handleSave} isLoading={isSaving}>Save Level</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
