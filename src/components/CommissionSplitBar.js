"use client";

import React, { useState } from 'react';
import AgentSearchSelect from '@/components/AgentSearchSelect';
import { useToast } from '@/components/ui/Toast';

const COLORS = [
  '#0C1022', '#E3A94A', '#1B2A4E', '#2fa84f', '#e08e2b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

const dn = (a) => [a?.first_name, a?.middle_name, a?.last_name].filter(Boolean).join(' ') || a?.full_name || a?.name || a?.email || '';

/**
 * CommissionSplitBar
 *
 * Props:
 *   overrides: [{ beneficiaryId, beneficiaryName, percent }]
 *   agents: [{ id, first_name, last_name, full_name }] — available agents to pick from
 *   agentId: string — the agent whose commission is being split (excluded from beneficiary list)
 *   agentName: string — display name of that agent
 *   onChange: (overrides) => void
 *   readOnly: boolean
 */
export default function CommissionSplitBar({
  overrides = [],
  agents = [],
  agentId,
  agentName = 'Agent',
  onChange,
  readOnly = false,
}) {
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newBeneficiary, setNewBeneficiary] = useState('');
  const [newPercent, setNewPercent] = useState('');

  const totalOverride = overrides.reduce((sum, o) => sum + (parseFloat(o.percent) || 0), 0);
  const agentKeep = Math.max(0, 100 - totalOverride);

  const availableAgents = agents.filter(a =>
    a.id !== agentId && !overrides.some(o => o.beneficiaryId === a.id)
  );

  const handleAdd = () => {
    const p = parseFloat(newPercent);
    if (!newBeneficiary || isNaN(p) || p <= 0) return;
    if (totalOverride + p > 100) {
      toast.info(`Cannot add ${p}%. Total would exceed 100% (currently ${totalOverride}% assigned).`);
      return;
    }
    const agent = agents.find(a => a.id === newBeneficiary);
    const updated = [
      ...overrides,
      { beneficiaryId: newBeneficiary, beneficiaryName: dn(agent), percent: p },
    ];
    onChange(updated);
    setNewBeneficiary('');
    setNewPercent('');
    setShowAdd(false);
  };

  const handleRemove = (idx) => {
    const updated = overrides.filter((_, i) => i !== idx);
    onChange(updated);
  };

  const handlePercentChange = (idx, val) => {
    // Allow free typing — store raw string, validate on blur
    const updated = overrides.map((o, i) => i === idx ? { ...o, percent: val } : o);
    onChange(updated);
  };

  const handlePercentBlur = (idx, val) => {
    const p = parseFloat(val);
    if (isNaN(p) || p < 0) {
      const updated = overrides.map((o, i) => i === idx ? { ...o, percent: 0 } : o);
      onChange(updated);
      return;
    }
    const otherTotal = overrides.reduce((sum, o, i) => i === idx ? sum : sum + (parseFloat(o.percent) || 0), 0);
    const clamped = Math.min(p, 100 - otherTotal);
    const updated = overrides.map((o, i) => i === idx ? { ...o, percent: clamped } : o);
    onChange(updated);
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Visual bar */}
      <div style={{
        display: 'flex',
        height: '40px',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.1)',
        marginBottom: '16px',
      }}>
        {overrides.map((o, i) => {
          const pct = parseFloat(o.percent) || 0;
          if (pct <= 0) return null;
          return (
            <div
              key={o.beneficiaryId || i}
              title={`${o.beneficiaryName}: ${pct}%`}
              style={{
                width: `${pct}%`,
                backgroundColor: COLORS[i % COLORS.length],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 600,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transition: 'width 0.3s ease',
                cursor: 'default',
              }}
            >
              {pct >= 8 ? `${o.beneficiaryName?.split(' ')[0]} ${pct}%` : pct >= 4 ? `${pct}%` : ''}
            </div>
          );
        })}
        {agentKeep > 0 && (
          <div
            title={`${agentName} keeps: ${agentKeep}%`}
            style={{
              width: `${agentKeep}%`,
              backgroundColor: '#e8edf3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0C1022',
              fontSize: '11px',
              fontWeight: 600,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              transition: 'width 0.3s ease',
            }}
          >
            {agentKeep >= 10 ? `${agentName?.split(' ')[0]} keeps ${agentKeep}%` : `${agentKeep}%`}
          </div>
        )}
      </div>

      {/* Override list */}
      {overrides.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {overrides.map((o, i) => (
            <div key={o.beneficiaryId || i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              backgroundColor: '#F1EFEA',
              borderRadius: '8px',
              border: '1px solid rgba(0,0,0,0.06)',
            }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: COLORS[i % COLORS.length],
                flexShrink: 0,
              }} />
              <span style={{ flex: 1, fontSize: '14px', fontWeight: 500, color: '#0C1022' }}>
                {o.beneficiaryName || 'Unknown'}
              </span>
              {readOnly ? (
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#0C1022' }}>{o.percent}%</span>
              ) : (
                <>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={o.percent}
                    onChange={(e) => handlePercentChange(i, e.target.value)}
                    onBlur={(e) => handlePercentBlur(i, e.target.value)}
                    style={{
                      width: '70px',
                      padding: '4px 8px',
                      border: '1px solid rgba(0,0,0,0.15)',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 600,
                      textAlign: 'center',
                    }}
                  />
                  <span style={{ fontSize: '14px', color: '#5F5C56' }}>%</span>
                  <button
                    onClick={() => handleRemove(i)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      cursor: 'pointer',
                      fontSize: '18px',
                      padding: '0 4px',
                      lineHeight: 1,
                    }}
                    title="Remove split"
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary line */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '13px',
        color: '#5F5C56',
        marginBottom: '12px',
        padding: '0 4px',
      }}>
        <span>Total split: <strong style={{ color: totalOverride > 0 ? '#0C1022' : '#5F5C56' }}>{totalOverride}%</strong></span>
        <span>{agentName} keeps: <strong style={{ color: '#2fa84f' }}>{agentKeep}%</strong></span>
      </div>

      {/* Add button */}
      {!readOnly && (
        <>
          {showAdd ? (
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              padding: '12px',
              backgroundColor: '#f0f4f8',
              borderRadius: '10px',
              border: '1px solid rgba(0,0,0,0.08)',
            }}>
              <AgentSearchSelect
                items={availableAgents}
                value={newBeneficiary}
                onChange={(id) => setNewBeneficiary(id)}
                placeholder="Search agent..."
                style={{ flex: 1 }}
              />
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                placeholder="%"
                value={newPercent}
                onChange={(e) => setNewPercent(e.target.value)}
                style={{
                  width: '70px',
                  padding: '8px',
                  border: '1px solid rgba(0,0,0,0.15)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  textAlign: 'center',
                }}
              />
              <button
                onClick={handleAdd}
                disabled={!newBeneficiary || !newPercent}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#0C1022',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: newBeneficiary && newPercent ? 'pointer' : 'not-allowed',
                  opacity: newBeneficiary && newPercent ? 1 : 0.5,
                }}
              >
                Add
              </button>
              <button
                onClick={() => { setShowAdd(false); setNewBeneficiary(''); setNewPercent(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#5F5C56',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              disabled={totalOverride >= 100}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: 'transparent',
                border: '1px dashed rgba(0,0,0,0.2)',
                borderRadius: '8px',
                color: '#0C1022',
                fontSize: '13px',
                fontWeight: 500,
                cursor: totalOverride >= 100 ? 'not-allowed' : 'pointer',
                opacity: totalOverride >= 100 ? 0.5 : 1,
                width: '100%',
                justifyContent: 'center',
              }}
            >
              + Add Recruiting Split
            </button>
          )}
        </>
      )}
    </div>
  );
}
