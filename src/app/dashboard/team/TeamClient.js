"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';

const dn = (a) => [a?.first_name, a?.middle_name, a?.last_name].filter(Boolean).join(' ') || a?.full_name || a?.name || a?.email || '';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import AgentSearchSelect from '@/components/AgentSearchSelect';
import InviteAgentModal from '@/components/InviteAgentModal';
import { resendInvite, markInviteAcceptedByEmail, linkInviteToAgent } from '@/app/actions/invite';
import { cleanupOrphanAgents, deleteAgent, deleteInvite } from '@/app/actions/agents';
import { moveAgent, fetchHierarchyMoves, undoMove, backfillHierarchyPaths, diagnoseAgentVisibility } from '@/app/actions/hierarchy';
import { getAgentsMissingPayment, sendPaymentReminders } from '@/app/actions/billing';
import { fetchTeamData } from '@/app/actions/profile';
import { sendWorkAuthorizationTasks } from '@/app/actions/tasks';
import { fetchAgencyW9Status } from '@/app/actions/documents';
import { getAllOverridesForAgency } from '@/app/actions/overrides';
import Avatar from '@/components/Avatar';
// dnd-kit removed — PointerSensor in v6 conflicts with React 19 event delegation,
// blocking all clicks on the page. Drag-to-reorganize replaced by manual drag below.

import { AGENT_LEVELS } from '@/lib/constants';
import RosterTable from '@/components/team/RosterTable';
import { useToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const STATUS_LABELS = {
  invited: { label: 'Invited', color: 'var(--brand-blue-accent)', bg: 'rgba(227, 169, 74, 0.1)' },
  active: { label: 'Active', color: 'var(--status-success)', bg: 'rgba(47, 168, 79, 0.08)' },
  onboarding: { label: 'Onboarding', color: 'var(--status-warning)', bg: 'rgba(224, 142, 43, 0.1)' },
  pending_licensing: { label: 'Pending License', color: 'var(--brand-gold)', bg: 'rgba(227, 169, 74, 0.1)' },
  docs_pending_review: { label: 'Docs Pending Review', color: 'var(--status-warning)', bg: 'rgba(224, 142, 43, 0.1)' },
  docs_pending: { label: 'Docs Pending', color: 'var(--brand-gold)', bg: 'rgba(227, 169, 74, 0.1)' },
  licensed: { label: 'Licensed', color: 'var(--status-success)', bg: 'rgba(47, 168, 79, 0.08)' },
  contracted: { label: 'Contracted', color: 'var(--brand-navy)', bg: 'rgba(12, 16, 34, 0.08)' },
  inactive: { label: 'Inactive', color: 'var(--brand-silver)', bg: 'rgba(169, 172, 177, 0.15)' }
};

const INVITE_STATUS = {
  pending: { label: 'Pending', color: 'var(--status-warning)', bg: 'rgba(224, 142, 43, 0.1)' },
  accepted: { label: 'Accepted', color: 'var(--status-success)', bg: 'rgba(47, 168, 79, 0.08)' },
  expired: { label: 'Expired', color: 'var(--brand-silver)', bg: 'rgba(169, 172, 177, 0.15)' }
};

function StatusBadge({ status, map }) {
  const s = map[status] || { label: status, color: 'var(--brand-silver)', bg: 'rgba(169, 172, 177, 0.15)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 12px', borderRadius: '999px',
      backgroundColor: s.bg, color: s.color,
      fontSize: 'var(--text-caption)', fontWeight: '600',
      textTransform: 'capitalize'
    }}>
      {s.label}
    </span>
  );
}

function rolePriority(a) {
  if (a.is_owner) return 0;
  if (a.role === 'admin') return 1;
  if (a.role === 'it_engineer') return 2;
  return 3;
}

// ─── Card content (shared between real cards and drag overlay) ──────────────
function NodeCardContent({ node, isSelected, isFindMe, isDropTarget, isDragging }) {
  const lvl = AGENT_LEVELS.find(l => l.level === (node.agentLevel || 1)) || AGENT_LEVELS[0];
  const childCount = (node.children || []).length;
  const isSplit = !!node._isSplitClone;

  return (
    <div
      data-card-face=""
      style={{
        width: '220px',
        minHeight: '150px',
        padding: '16px 14px 12px',
        borderRadius: '14px',
        backgroundColor: isDropTarget
          ? 'rgba(47, 168, 79, 0.1)'
          : isSplit
            ? 'rgba(227, 169, 74, 0.03)'
            : isSelected
              ? 'rgba(227, 169, 74, 0.08)'
              : 'var(--surface-card)',
        border: isDropTarget
          ? '2px dashed var(--status-success)'
          : isSplit
            ? '1.5px dashed rgba(227, 169, 74, 0.5)'
            : isSelected
              ? '2px solid var(--brand-gold)'
              : isFindMe
                ? '2px solid #1B2A4E'
                : '1px solid var(--border-color)',
        textAlign: 'center',
        transition: 'all 0.2s ease',
        boxShadow: isDragging
          ? '0 16px 40px rgba(0,0,0,0.2)'
          : isSelected
            ? '0 6px 20px rgba(227, 169, 74, 0.18)'
            : isFindMe
              ? '0 0 0 3px rgba(227, 169, 74,0.15)'
              : isSplit
                ? '0 2px 8px rgba(227, 169, 74, 0.08)'
                : '0 2px 12px rgba(0,0,0,0.04)',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0,
        opacity: isDragging ? 0.9 : isSplit ? 0.8 : 1,
        position: 'relative',
      }}
    >
      {/* Split clone indicator ribbon */}
      {isSplit && (
        <div style={{
          position: 'absolute', top: '0', left: '0', right: '0',
          height: '3px', borderRadius: '14px 14px 0 0',
          background: 'linear-gradient(90deg, var(--brand-gold), #E8C45A)',
        }} />
      )}

      <div style={{ flexShrink: 0, marginTop: isSplit ? '2px' : 0 }}>
        <Avatar name={dn(node)} photoUrl={node.photo_url} size={40} goldText={node.is_owner} ownerRing={node.is_owner} />
      </div>
      <div style={{
        fontWeight: '700', color: 'var(--brand-navy)', fontSize: '13px', lineHeight: '1.3',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        width: '100%', textAlign: 'center',
      }}>
        {dn(node) || 'Name not set'}
      </div>
      {node.is_owner ? (
        <span style={{
          display: 'inline-block', padding: '2px 10px', borderRadius: '999px', fontSize: '10px',
          fontWeight: 700, background: 'linear-gradient(135deg, #0C1022, #1B2A4E)', color: '#E3A94A', flexShrink: 0,
        }}>
          Owner
        </span>
      ) : (
        <div style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '10px', fontWeight: '600',
          backgroundColor: 'rgba(10, 37, 64, 0.06)', color: 'var(--brand-navy)', flexShrink: 0,
          maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          L{lvl.level} · {lvl.title}
        </div>
      )}

      {/* Split percentage badge */}
      {node._splitPercent != null ? (
        <div style={{ flexShrink: 0, textAlign: 'center', lineHeight: '1.3' }}>
          <div style={{
            fontSize: '10px', fontWeight: '700', color: '#fff',
            background: 'linear-gradient(135deg, var(--brand-gold), #E3A94A)',
            borderRadius: '999px', padding: '2px 10px',
            display: 'inline-flex', alignItems: 'center', height: '18px',
            boxShadow: '0 1px 4px rgba(227, 169, 74,0.3)',
          }}>
            {node._splitPercent}% commission
          </div>
          {node._splitOthers && node._splitOthers.length > 0 && (
            <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {node._splitOthers.map(o => `${o.name.split(' ')[0]} ${o.percent}%`).join(' · ')}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', height: '18px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
          {childCount > 0 && (
            <span>{childCount} report{childCount !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── NodeCard (clean, no dnd-kit) ───────────────────────────────────────────
function NodeCard({ node, isSelected, onSelect, isFindMe, cardRef, collapsed, onToggleCollapse, isAdmin, activeId, onScopeIn, onDragNodeStart }) {
  const childCount = (node.children || []).length;
  const isDragSource = activeId === node.id;
  const canDrag = isAdmin && !node.is_owner && !node._isSplitClone;

  const elRef = useRef(null);
  const setRef = useCallback((el) => {
    elRef.current = el;
    if (cardRef) {
      if (typeof cardRef === 'function') cardRef(el);
      else cardRef.current = el;
    }
  }, [cardRef]);

  // Native drag for admin hierarchy reorg
  const pointerOrigin = useRef(null);
  const handlePointerDown = useCallback((e) => {
    if (!canDrag) return;
    pointerOrigin.current = { x: e.clientX, y: e.clientY };
  }, [canDrag]);

  const handlePointerMove = useCallback((e) => {
    if (!pointerOrigin.current || !canDrag) return;
    const dx = e.clientX - pointerOrigin.current.x;
    const dy = e.clientY - pointerOrigin.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      pointerOrigin.current = null;
      if (onDragNodeStart) onDragNodeStart(node);
    }
  }, [canDrag, node, onDragNodeStart]);

  const handlePointerUp = useCallback(() => {
    pointerOrigin.current = null;
  }, []);

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }} data-node-id={node.id}>
      <div
        ref={setRef}
        onClick={() => { if (!isDragSource) onSelect(node); }}
        onDoubleClick={(e) => { e.stopPropagation(); if (childCount > 0 && onScopeIn) onScopeIn(node.id); }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          cursor: 'pointer',
          opacity: isDragSource ? 0.35 : 1,
          transition: 'opacity 0.2s ease',
        }}
      >
        <NodeCardContent
          node={node}
          isSelected={isSelected}
          isFindMe={isFindMe}
          isDropTarget={false}
          isDragging={false}
        />
      </div>

      {childCount > 0 && (
        <button
          onClick={e => { e.stopPropagation(); onToggleCollapse(node.id); }}
          style={{
            position: 'absolute', bottom: '-11px', left: '50%', transform: 'translateX(-50%)',
            width: '22px', height: '22px', borderRadius: '50%',
            border: '1.5px solid var(--border-color)', backgroundColor: 'var(--surface-card)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', color: 'var(--brand-navy)', fontWeight: 700, zIndex: 2,
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)', transition: 'background-color 0.15s', padding: 0,
          }}
          title={collapsed ? `Expand (${childCount})` : `Collapse (${childCount})`}
        >
          {collapsed ? '+' : '−'}
        </button>
      )}
    </div>
  );
}

// ─── TreeBranch ───────────────────────────────────────────────────────────────
function TreeBranch({ node, selectedId, onSelect, isFindMeId, cardRefs, collapsedIds, onToggleCollapse, depth, isAdmin, activeId, onScopeIn, onDragNodeStart }) {
  const sortedChildren = useMemo(() => (
    [...(node.children || [])].sort((a, b) => rolePriority(a) - rolePriority(b) || dn(a).localeCompare(dn(b)))
  ), [node.children]);

  const isCollapsed = collapsedIds.has(node.id);
  const hasChildren = sortedChildren.length > 0;
  const showChildren = hasChildren && !isCollapsed;

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const setCardRef = useCallback((el) => {
    if (el) cardRefs.current.set(node.id, el);
    else cardRefs.current.delete(node.id);
  }, [node.id, cardRefs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <NodeCard
        node={node}
        isSelected={selectedId === node.id}
        isFindMe={isFindMeId === node.id}
        onSelect={onSelect}
        cardRef={setCardRef}
        collapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
        isAdmin={isAdmin}
        activeId={activeId}
        onScopeIn={onScopeIn}
        onDragNodeStart={onDragNodeStart}
      />

      {showChildren && (
        <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '28px', justifyContent: 'center', flexWrap: 'nowrap' }}>
            {sortedChildren.map(child => (
              <div key={child.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <TreeBranch
                  node={child}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  isFindMeId={isFindMeId}
                  cardRefs={cardRefs}
                  collapsedIds={collapsedIds}
                  onToggleCollapse={onToggleCollapse}
                  depth={depth + 1}
                  isAdmin={isAdmin}
                  activeId={activeId}
                  onScopeIn={onScopeIn}
                  onDragNodeStart={onDragNodeStart}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mobile indented list ─────────────────────────────────────────────────────
function MobileTreeList({ nodes, depth, onSelect, selectedId }) {
  return (
    <div>
      {nodes.map(node => {
        const lvl = AGENT_LEVELS.find(l => l.level === (node.agentLevel || 1)) || AGENT_LEVELS[0];
        const children = node.children || [];
        return (
          <div key={node.id}>
            <div
              onClick={() => onSelect(node)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                marginLeft: `${depth * 20}px`,
                marginBottom: '4px',
                borderRadius: '10px',
                backgroundColor: selectedId === node.id ? 'rgba(227, 169, 74, 0.1)' : 'rgba(0,0,0,0.02)',
                border: selectedId === node.id ? '1.5px solid var(--brand-gold)' : '1.5px solid transparent',
                cursor: 'pointer',
              }}
            >
              <Avatar name={dn(node)} photoUrl={node.photo_url} size={36} goldText={node.is_owner} ownerRing={node.is_owner} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--brand-navy)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dn(node) || 'Name not set'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {node.email || ''}
                </div>
              </div>
              {node.is_owner ? (
                <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '9px', fontWeight: 700, background: 'linear-gradient(135deg, #0C1022, #1B2A4E)', color: '#E3A94A', whiteSpace: 'nowrap' }}>
                  Owner
                </span>
              ) : (
                <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, backgroundColor: 'rgba(10, 37, 64, 0.06)', color: 'var(--brand-navy)', whiteSpace: 'nowrap' }}>
                  L{lvl.level}
                </span>
              )}
            </div>
            {children.length > 0 && (
              <MobileTreeList nodes={children} depth={depth + 1} onSelect={onSelect} selectedId={selectedId} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function buildTree(agents, overrides = []) {
  // Step 1: Build normal tree using upline_id
  const agentMap = {};
  agents.forEach(a => { agentMap[a.id] = { ...a, children: [] }; });
  const roots = [];
  Object.values(agentMap).forEach(node => {
    if (node.is_owner) {
      roots.push(node);
    } else if (node.upline_id && agentMap[node.upline_id]) {
      agentMap[node.upline_id].children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Step 2: Add split clones under beneficiaries + tag real nodes with split data
  if (overrides.length > 0) {
    const overridesByAgent = {};
    overrides.forEach(o => {
      if (!overridesByAgent[o.agentId]) overridesByAgent[o.agentId] = [];
      overridesByAgent[o.agentId].push(o);
    });

    const findInTree = (nodes, id) => {
      for (const n of nodes) {
        if (n.id === id) return n;
        const found = findInTree(n.children || [], id);
        if (found) return found;
      }
      return null;
    };

    Object.entries(overridesByAgent).forEach(([agentId, splits]) => {
      const sourceAgent = agentMap[agentId];
      if (!sourceAgent || sourceAgent.is_owner) return;

      // Tag real node with split data for badge display
      sourceAgent._splits = splits.map(s => ({
        beneficiaryId: s.beneficiaryId,
        beneficiaryName: s.beneficiaryName,
        percent: s.percent,
      }));

      const currentParentId = sourceAgent.upline_id;

      splits.forEach(s => {
        const beneficiaryNode = findInTree(roots, s.beneficiaryId);
        if (!beneficiaryNode) return;

        const others = splits
          .filter(o => o.beneficiaryId !== s.beneficiaryId)
          .map(o => ({ name: o.beneficiaryName, percent: o.percent }));

        // Check if agent is already a descendant of this beneficiary (any depth)
        // If so, the agent already appears in beneficiary's subtree — just tag, don't clone
        const isDescendantOfBeneficiary = (() => {
          let cur = agentId;
          const visited = new Set();
          while (cur) {
            if (cur === s.beneficiaryId) return true;
            if (visited.has(cur)) return false;
            visited.add(cur);
            cur = agentMap[cur]?.upline_id || null;
          }
          return false;
        })();

        if (isDescendantOfBeneficiary) {
          const existingNode = findInTree([beneficiaryNode], agentId);
          if (existingNode && !existingNode._splitPercent) {
            existingNode._splitPercent = s.percent;
            existingNode._splitOthers = others;
          }
          return;
        }

        // Check if the beneficiary is already a descendant of this agent
        // If so, the agent is an ancestor — don't clone downward, just tag the agent node
        const isBeneficiaryDescendantOfAgent = (() => {
          let cur = s.beneficiaryId;
          const visited = new Set();
          while (cur) {
            if (cur === agentId) return true;
            if (visited.has(cur)) return false;
            visited.add(cur);
            cur = agentMap[cur]?.upline_id || null;
          }
          return false;
        })();

        if (isBeneficiaryDescendantOfAgent) {
          if (!sourceAgent._splitPercent) {
            sourceAgent._splitPercent = s.percent;
            sourceAgent._splitOthers = others;
          }
          return;
        }

        // Add a visual clone under this beneficiary
        const splitClone = {
          ...sourceAgent,
          children: [],
          _splitPercent: s.percent,
          _splitOthers: others,
          _splitParentId: s.beneficiaryId,
          _isSplitClone: true,
          id: agentId + '_split_' + s.beneficiaryId,
          _realId: agentId,
        };
        beneficiaryNode.children.push(splitClone);
      });
    });
  }

  if (roots.length === 0 && agents.length > 0) {
    Object.values(agentMap).forEach(node => roots.push(node));
  }
  roots.sort((a, b) => rolePriority(a) - rolePriority(b) || dn(a).localeCompare(dn(b)));
  return roots;
}

function collectIdsAtDepthGte(nodes, targetDepth, currentDepth) {
  const ids = new Set();
  nodes.forEach(node => {
    if (currentDepth >= targetDepth && (node.children || []).length > 0) {
      ids.add(node.id);
    }
    (node.children || []).forEach(child => {
      collectIdsAtDepthGte([child], targetDepth, currentDepth + 1).forEach(id => ids.add(id));
    });
  });
  return ids;
}

function findNodeInTree(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNodeInTree(n.children || [], id);
    if (found) return found;
  }
  return null;
}

// ─── HierarchyChart ──────────────────────────────────────────────────────────
function HierarchyChart({ agents, allOverrides = [], selectedMember, setSelectedMember, isAdmin, router, setAssignManagerAgent, setSelectedManagerId, userProfile, onRefresh }) {
  const { userProfile: ctxUser } = useUser();
  const currentUser = userProfile || ctxUser;
  const isSuperAdmin = currentUser?.email === 'kanchamjaswanthreddy@gmail.com';

  // DnD state
  const [activeId, setActiveId] = useState(null);
  const [pendingMove, setPendingMove] = useState(null); // { dragNode, dropNode }
  const [isMoving, setIsMoving] = useState(false);
  const [moveResult, setMoveResult] = useState(null); // { type, message }

  // Change log state
  const [showLog, setShowLog] = useState(false);
  const [hierarchyLog, setHierarchyLog] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [undoingId, setUndoingId] = useState(null);

  // Backfill state
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);
  const [diagResult, setDiagResult] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagEmail, setDiagEmail] = useState('');
  const [paymentAudit, setPaymentAudit] = useState(null);
  const [paymentAuditLoading, setPaymentAuditLoading] = useState(false);
  const [reminderResult, setReminderResult] = useState(null);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [paymentTracker, setPaymentTracker] = useState(null);
  const [paymentTrackerLoading, setPaymentTrackerLoading] = useState(false);

  // Load payment tracker via API (not server action) for super-admin
  useEffect(() => {
    if (userProfile?.email !== 'kanchamjaswanthreddy@gmail.com') return;
    setPaymentTrackerLoading(true);
    fetch('/api/team/data')
      .then(r => r.json())
      .then(res => { if (res.paymentTracker) setPaymentTracker(res.paymentTracker); })
      .catch(() => {})
      .finally(() => setPaymentTrackerLoading(false));
  }, [userProfile?.email]);

  // Build flat map for quick lookup
  const agentMap = useMemo(() => {
    const map = {};
    agents.forEach(a => { map[a.id] = a; });
    return map;
  }, [agents]);

  // Check if targetId is a descendant of agentId
  const isDescendantOf = useCallback((agentId, targetId) => {
    let current = targetId;
    const visited = new Set();
    while (current) {
      if (current === agentId) return true;
      if (visited.has(current)) return false;
      visited.add(current);
      current = agentMap[current]?.upline_id || null;
    }
    return false;
  }, [agentMap]);

  // Manual drag start (triggered by NodeCard after 8px pointer movement)
  const handleDragNodeStart = useCallback((node) => {
    setActiveId(node.id);
  }, []);

  // Cancel drag on pointerup anywhere (admin drag)
  useEffect(() => {
    if (!activeId) return;
    const handleUp = (e) => {
      // Find which card the pointer is over
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cardFace = el?.closest?.('[data-card-face]');
      if (cardFace) {
        const nodeEl = cardFace.closest('[data-node-id]');
        const dropId = nodeEl?.dataset?.nodeId;
        if (dropId && dropId !== activeId) {
          const dragNode = agentMap[activeId];
          const dropNode = agentMap[dropId];
          if (dragNode && dropNode && dragNode.upline_id !== dropId && !isDescendantOf(activeId, dropId)) {
            setPendingMove({ dragNode, dropNode });
          }
        }
      }
      setActiveId(null);
    };
    document.addEventListener('pointerup', handleUp, { once: true });
    return () => document.removeEventListener('pointerup', handleUp);
  }, [activeId, agentMap, isDescendantOf]);

  const confirmMove = async () => {
    if (!pendingMove || !currentUser) return;
    setIsMoving(true);
    const res = await moveAgent(currentUser.uid, pendingMove.dragNode.id, pendingMove.dropNode.id);
    setIsMoving(false);
    if (res.success) {
      setMoveResult({
        type: 'success',
        message: `Moved ${dn(pendingMove.dragNode)} under ${dn(pendingMove.dropNode)}${res.descendantsUpdated > 0 ? ` (${res.descendantsUpdated} descendant${res.descendantsUpdated !== 1 ? 's' : ''} updated)` : ''}`,
      });
      setPendingMove(null);
      if (onRefresh) onRefresh();
    } else {
      setMoveResult({ type: 'error', message: res.error || 'Move failed.' });
    }
    setTimeout(() => setMoveResult(null), 5000);
  };

  const loadChangeLog = useCallback(async () => {
    if (!currentUser) return;
    setLogLoading(true);
    const res = await fetchHierarchyMoves(currentUser.uid, 20);
    if (res.success) setHierarchyLog(res.moves);
    setLogLoading(false);
  }, [currentUser]);

  const handleUndo = useCallback(async (moveId) => {
    if (!currentUser) return;
    setUndoingId(moveId);
    const res = await undoMove(currentUser.uid, moveId);
    setUndoingId(null);
    if (res.success) {
      setMoveResult({ type: 'success', message: 'Move undone successfully.' });
      if (onRefresh) onRefresh();
      loadChangeLog();
    } else {
      setMoveResult({ type: 'error', message: res.error || 'Undo failed.' });
    }
    setTimeout(() => setMoveResult(null), 5000);
  }, [currentUser, onRefresh, loadChangeLog]);

  // Load log when panel is opened
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (showLog) loadChangeLog();
  }, [showLog, loadChangeLog]);

  const activeNode = activeId ? agentMap[activeId] : null;

  // ── Phase 3: Scoped view ──────────────────────────────────────────────────
  const [scopeId, setScopeId] = useState(null); // null = full tree

  // ── Hidden cards (view-only, persisted in localStorage) ───────────────────
  const [hiddenIds, setHiddenIds] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem('nxt_hierarchy_hidden');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [showHiddenPanel, setShowHiddenPanel] = useState(false);

  const toggleHide = useCallback((id) => {
    setHiddenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem('nxt_hierarchy_hidden', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const restoreAll = useCallback(() => {
    setHiddenIds(new Set());
    try { localStorage.removeItem('nxt_hierarchy_hidden'); } catch {}
    setShowHiddenPanel(false);
  }, []);

  // For non-admins, find all descendants via upline_id chain walking (BFS).
  // This is more reliable than hierarchyPath prefix matching which breaks
  // when hierarchyPaths are missing, stale, or malformed.
  const visibleAgents = useMemo(() => {
    if (isAdmin || currentUser?.is_owner) return agents;
    const myId = currentUser?.uid;
    if (!myId) return [];

    const downlineIds = new Set([myId]);
    let changed = true;
    while (changed) {
      changed = false;
      agents.forEach(a => {
        if (a.upline_id && downlineIds.has(a.upline_id) && !downlineIds.has(a.id)) {
          downlineIds.add(a.id);
          changed = true;
        }
      });
    }

    return agents.filter(a => downlineIds.has(a.id));
  }, [agents, isAdmin, currentUser]);

  // Separate hidden IDs into real agent IDs and split clone IDs (only applied for super-admin)
  const activeHiddenIds = isSuperAdmin ? hiddenIds : new Set();
  const hiddenRealIds = useMemo(() => {
    const real = new Set();
    activeHiddenIds.forEach(id => { if (!String(id).includes('_split_')) real.add(id); });
    return real;
  }, [activeHiddenIds]);

  // Filter out hidden real agents, reparenting their children to the nearest visible ancestor
  const displayAgents = useMemo(() => {
    if (hiddenRealIds.size === 0) return visibleAgents;
    const lookup = Object.fromEntries(visibleAgents.map(a => [a.id, a]));
    return visibleAgents
      .filter(a => !hiddenRealIds.has(a.id))
      .map(a => {
        if (a.upline_id && hiddenRealIds.has(a.upline_id)) {
          let parentId = a.upline_id;
          while (parentId && hiddenRealIds.has(parentId)) {
            parentId = lookup[parentId]?.upline_id || null;
          }
          return { ...a, upline_id: parentId };
        }
        return a;
      });
  }, [visibleAgents, hiddenRealIds]);

  // Strip hidden split clones from tree nodes recursively
  const stripHiddenClones = useCallback((nodes) => {
    return nodes.map(node => ({
      ...node,
      children: stripHiddenClones(
        (node.children || []).filter(c => !activeHiddenIds.has(c.id))
      ),
    }));
  }, [activeHiddenIds]);

  // Hidden items list (for the restore panel) — includes both real agents and split clones
  const hiddenItems = useMemo(() => {
    if (hiddenIds.size === 0) return [];
    const items = [];
    hiddenIds.forEach(id => {
      if (String(id).includes('_split_')) {
        const parts = String(id).split('_split_');
        const agentId = parts[0];
        const benefId = parts[1];
        const agent = visibleAgents.find(a => a.id === agentId);
        const benef = visibleAgents.find(a => a.id === benefId);
        if (agent) {
          items.push({
            id,
            name: dn(agent),
            photo_url: agent.photo_url,
            label: benef ? `under ${dn(benef).split(' ')[0]}` : 'split clone',
            isSplitClone: true,
          });
        }
      } else {
        const agent = visibleAgents.find(a => a.id === id);
        if (agent) {
          items.push({ id, name: dn(agent), photo_url: agent.photo_url, label: null, isSplitClone: false });
        }
      }
    });
    return items;
  }, [visibleAgents, hiddenIds]);

  // Build tree from display agents, then strip hidden split clones
  const fullTree = useMemo(() => {
    const tree = buildTree(displayAgents, allOverrides);
    if (activeHiddenIds.size === 0) return tree;
    return stripHiddenClones(tree);
  }, [displayAgents, allOverrides, activeHiddenIds, stripHiddenClones]);

  // Compute scoped roots
  const scopedRoots = useMemo(() => {
    if (!scopeId) return fullTree;
    const node = findNodeInTree(fullTree, scopeId);
    return node ? [node] : fullTree;
  }, [fullTree, scopeId]);

  // Build breadcrumb path from root to scoped node
  const breadcrumbs = useMemo(() => {
    if (!scopeId) return [];
    const path = [];
    const findPath = (nodes, targetId, trail) => {
      for (const n of nodes) {
        if (n.id === targetId) return [...trail, n];
        const found = findPath(n.children || [], targetId, [...trail, n]);
        if (found) return found;
      }
      return null;
    };
    return findPath(fullTree, scopeId, []) || [];
  }, [fullTree, scopeId]);

  // Double-click on a card to scope into that subtree
  const handleScopeIn = useCallback((nodeId) => {
    setScopeId(prev => prev === nodeId ? null : nodeId);
  }, []);

  // Use scopedRoots instead of roots for rendering
  const roots = scopedRoots;

  // Collapse state: default collapse nodes at depth >= 2
  const [collapsedIds, setCollapsedIds] = useState(() => collectIdsAtDepthGte(roots, 2, 0));

  // Recompute default collapses when agents or scope changes
  useEffect(() => {
    setCollapsedIds(collectIdsAtDepthGte(scopedRoots, 2, 0)); // eslint-disable-line react-hooks/set-state-in-effect
  }, [agents, scopeId, scopedRoots]);

  const onToggleCollapse = useCallback((id) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Pan/zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const cardRefs = useRef(new Map());
  const [svgPaths, setSvgPaths] = useState([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });
  const rafId = useRef(null);
  const [findMeId, setFindMeId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Search results filtered from agents
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return agents.filter(a =>
      dn(a).toLowerCase().includes(q) || (a.email && a.email.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [agents, searchQuery]);

  // Compute SVG connector paths — measures card positions in container-local coords
  const recomputePaths = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      if (!contentRef.current) return;
      const contentEl = contentRef.current;
      const contentRect = contentEl.getBoundingClientRect();
      const scale = transform.scale;

      const paths = [];
      const R = 8; // corner radius
      const isDev = process.env.NODE_ENV === 'development';

      // Convert screen-space rect to content-local unscaled coords
      function toLocal(screenRect) {
        return {
          left: (screenRect.left - contentRect.left) / scale,
          top: (screenRect.top - contentRect.top) / scale,
          right: (screenRect.right - contentRect.left) / scale,
          bottom: (screenRect.bottom - contentRect.top) / scale,
          width: screenRect.width / scale,
          height: screenRect.height / scale,
        };
      }

      function traverse(nodes) {
        nodes.forEach(node => {
          const children = node.children || [];
          if (children.length === 0 || collapsedIds.has(node.id)) return;

          const parentEl = cardRefs.current.get(node.id);
          if (!parentEl) return;

          // Find the actual card face (the 200x130 div) inside the wrapper
          const parentCard = parentEl.querySelector('[data-card-face]') || parentEl;
          const pLocal = toLocal(parentCard.getBoundingClientRect());

          // Parent bottom center
          const px = pLocal.left + pLocal.width / 2;
          const py = pLocal.bottom;

          const childPoints = children.map(child => {
            const el = cardRefs.current.get(child.id);
            if (!el) return null;
            const childCard = el.querySelector('[data-card-face]') || el;
            const cLocal = toLocal(childCard.getBoundingClientRect());
            const cx = cLocal.left + cLocal.width / 2;
            const cy = cLocal.top;
            return { cx, cy, id: child.id, cardBottom: cLocal.bottom };
          }).filter(Boolean);

          // Dev check: verify endpoints are at card edges
          if (isDev && childPoints.length > 0) {
            // Parent x should be at horizontal center of card face
            const pCenterX = pLocal.left + pLocal.width / 2;
            // Dev connector endpoint checks (silenced)
            childPoints.forEach(() => {});
          }

          if (childPoints.length === 0) return;

          // Bus line Y sits halfway between parent bottom and first child top
          const busY = py + (childPoints[0].cy - py) / 2;

          if (childPoints.length === 1) {
            // Single child: straight vertical line
            paths.push(`M ${px} ${py} L ${childPoints[0].cx} ${childPoints[0].cy}`);
          } else {
            // Multiple children: parent stem → horizontal bus → child stems
            const leftmost = Math.min(...childPoints.map(p => p.cx));
            const rightmost = Math.max(...childPoints.map(p => p.cx));

            // Parent stem: vertical from parent bottom-center down to bus
            paths.push(`M ${px} ${py} L ${px} ${busY}`);

            // Horizontal bus spanning first-child center to last-child center
            paths.push(`M ${leftmost} ${busY} L ${rightmost} ${busY}`);

            // Child stems: vertical from bus down to each child top-center with rounded corners
            childPoints.forEach(({ cx, cy }) => {
              if (Math.abs(cx - px) < 1) {
                // Directly below parent — straight line continues from bus
                paths.push(`M ${cx} ${busY} L ${cx} ${cy}`);
              } else {
                // Corner: horizontal on bus then turn down to child
                const dir = cx > px ? 1 : -1;
                paths.push(
                  `M ${cx} ${busY + R} L ${cx} ${cy}` // vertical from below corner to child
                );
                paths.push(
                  `M ${cx - dir * R} ${busY} Q ${cx} ${busY} ${cx} ${busY + R}` // rounded corner
                );
              }
            });
          }

          traverse(children);
        });
      }

      traverse(roots);
      setSvgPaths(paths);

      // SVG covers entire content area
      // scrollWidth/scrollHeight report unscaled dimensions since the SVG
      // is inside the scaled container and shares its coordinate space
      setSvgSize({
        w: contentEl.scrollWidth,
        h: contentEl.scrollHeight,
      });
    });
  }, [roots, collapsedIds, transform.scale]);

  // Recompute after layout paints and on dependency changes
  useLayoutEffect(() => {
    recomputePaths();
  }, [recomputePaths, agents, collapsedIds, selectedMember, transform]);

  // ResizeObserver on content container
  useEffect(() => {
    if (!contentRef.current) return;
    const ro = new ResizeObserver(() => recomputePaths());
    ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [recomputePaths]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, []);

  // Wheel zoom — only on pinch (ctrlKey) or Ctrl/Cmd+scroll
  // Attached as non-passive native listener so preventDefault works
  const onWheelRef = useRef(null);
  const onWheelHandler = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey) return; // normal scroll/trackpad ignored
    e.preventDefault();
    // Smooth factor: scale by a small fraction of deltaY for gentle zoom
    const speed = 0.005;
    const factor = 1 - Math.max(-0.15, Math.min(0.15, e.deltaY * speed));
    setTransform(prev => {
      const nextScale = Math.min(1.5, Math.max(0.4, prev.scale * factor));
      return { ...prev, scale: nextScale };
    });
  }, []);

  useEffect(() => {
    onWheelRef.current = onWheelHandler;
  }, [onWheelHandler]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => onWheelRef.current(e);
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Pan
  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    // Don't start panning if click is on an interactive element (card, button, link)
    const tag = e.target.tagName;
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('[data-card-face]')) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    e.currentTarget.style.cursor = 'grabbing';
  }, [transform.x, transform.y]);

  const onMouseMove = useCallback((e) => {
    if (!isPanning.current) return;
    setTransform(prev => ({
      ...prev,
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y,
    }));
  }, []);

  const onMouseUp = useCallback((e) => {
    isPanning.current = false;
    if (containerRef.current) containerRef.current.style.cursor = 'grab';
  }, []);

  // Fit to screen
  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !contentRef.current) return;
    const cW = containerRef.current.clientWidth;
    const cH = containerRef.current.clientHeight;
    const tW = contentRef.current.scrollWidth;
    const tH = contentRef.current.scrollHeight;
    const scale = Math.min(1.5, Math.max(0.4, Math.min((cW - 40) / tW, (cH - 40) / tH)));
    const x = (cW - tW * scale) / 2;
    const y = (cH - tH * scale) / 2;
    setTransform({ x, y, scale });
  }, []);

  // Find me
  const handleFindMe = useCallback(() => {
    if (!currentUser) return;
    const myId = currentUser.uid || currentUser.id;
    if (!myId) return;
    setFindMeId(myId);
    setTimeout(() => setFindMeId(null), 2500);

    // Expand ancestors so the card is visible
    function findAncestors(nodes, targetId, path) {
      for (const node of nodes) {
        if (node.id === targetId) return path;
        const result = findAncestors(node.children || [], targetId, [...path, node.id]);
        if (result) return result;
      }
      return null;
    }
    const ancestors = findAncestors(roots, myId, []);
    if (ancestors) {
      setCollapsedIds(prev => {
        const next = new Set(prev);
        ancestors.forEach(id => next.delete(id));
        return next;
      });
    }

    // Pan to card
    setTimeout(() => {
      const el = cardRefs.current.get(myId);
      if (!el || !containerRef.current || !contentRef.current) return;
      const cRect = containerRef.current.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const contentRect = contentRef.current.getBoundingClientRect();
      const cardCx = (eRect.left + eRect.width / 2 - contentRect.left) / transform.scale;
      const cardCy = (eRect.top + eRect.height / 2 - contentRect.top) / transform.scale;
      const cx = cRect.width / 2;
      const cy = cRect.height / 2;
      setTransform(prev => ({
        ...prev,
        x: cx - cardCx * prev.scale,
        y: cy - cardCy * prev.scale,
      }));
    }, 120);
  }, [currentUser, roots, transform.scale]);

  // Track which tree node was clicked (could be a split clone ID)
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // Resolve split clones to the real agent when selecting
  const handleSelectMember = useCallback((node) => {
    setSelectedNodeId(node?.id || null);
    if (node && node._isSplitClone && node._realId) {
      const realAgent = agents.find(a => a.id === node._realId);
      if (realAgent) { setSelectedMember(realAgent); return; }
    }
    setSelectedMember(node);
  }, [agents, setSelectedMember]);

  // Navigate to a search result in the tree
  const handleSearchSelect = useCallback((agent) => {
    setSearchQuery('');
    setFindMeId(agent.id);
    setTimeout(() => setFindMeId(null), 2500);

    // Expand ancestors
    function findAncestors(nodes, targetId, path) {
      for (const node of nodes) {
        if (node.id === targetId) return path;
        const result = findAncestors(node.children || [], targetId, [...path, node.id]);
        if (result) return result;
      }
      return null;
    }
    const ancestors = findAncestors(roots, agent.id, []);
    if (ancestors) {
      setCollapsedIds(prev => {
        const next = new Set(prev);
        ancestors.forEach(id => next.delete(id));
        return next;
      });
    }

    // Pan to card
    setTimeout(() => {
      const el = cardRefs.current.get(agent.id);
      if (!el || !containerRef.current || !contentRef.current) return;
      const cRect = containerRef.current.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const contentRect = contentRef.current.getBoundingClientRect();
      const cardCx = (eRect.left + eRect.width / 2 - contentRect.left) / transform.scale;
      const cardCy = (eRect.top + eRect.height / 2 - contentRect.top) / transform.scale;
      setTransform(prev => ({
        ...prev,
        x: cRect.width / 2 - cardCx * prev.scale,
        y: cRect.height / 2 - cardCy * prev.scale,
      }));
    }, 150);

    handleSelectMember(agent);
  }, [roots, transform.scale, handleSelectMember]);

  const m = selectedMember;
  const lvl = m ? (AGENT_LEVELS.find(l => l.level === (m.agentLevel || 1)) || AGENT_LEVELS[0]) : null;
  const upline = m && m.upline_id ? agents.find(a => a.id === m.upline_id) : null;
  const downlines = m ? agents.filter(a => a.upline_id === m.id) : [];

  // Commission splits for selected member (from overrides data)
  const memberSplits = useMemo(() => {
    if (!m || !allOverrides.length) return [];
    return allOverrides.filter(o => o.agentId === m.id);
  }, [m, allOverrides]);

  if (isMobile) {
    return (
      <div>
        <Card style={{ padding: 'var(--space-3)' }}>
          {roots.length === 0 ? (
            <div style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>No team members yet.</p>
            </div>
          ) : (
            <MobileTreeList nodes={roots} depth={0} onSelect={handleSelectMember} selectedId={selectedMember?.id} />
          )}
        </Card>

        {m && typeof document !== 'undefined' && createPortal(
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex',
              justifyContent: 'center', alignItems: 'center', zIndex: 10000,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedMember(null); }}
          >
            <Card style={{ width: '400px', maxHeight: '80vh', overflow: 'auto', padding: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <Avatar name={dn(m)} photoUrl={m.photo_url} size={64} goldText={m.is_owner} ownerRing={m.is_owner} />
                <button onClick={() => setSelectedMember(null)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: '22px', lineHeight: 1,
                }}>×</button>
              </div>

              <h3 style={{ margin: '0 0 6px 0', color: 'var(--brand-navy)', fontSize: '18px', fontWeight: 700 }}>
                {dn(m) || 'Name not set'}
              </h3>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
                {m.is_owner && (
                  <span style={{ padding: '3px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: 'linear-gradient(135deg, #0C1022, #1B2A4E)', color: '#E3A94A' }}>Owner</span>
                )}
                <span style={{ padding: '3px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(10, 37, 64, 0.06)', color: 'var(--brand-navy)' }}>
                  L{lvl.level} — {lvl.title}
                </span>
                <span style={{
                  padding: '3px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                  backgroundColor: m.status === 'active' ? 'rgba(47, 168, 79, 0.1)' : 'rgba(0,0,0,0.06)',
                  color: m.status === 'active' ? 'var(--status-success)' : 'var(--text-secondary)',
                }}>
                  {m.status || 'Unknown'}
                </span>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)',
                padding: 'var(--space-3)', borderRadius: '10px',
                backgroundColor: 'rgba(0,0,0,0.02)', marginBottom: 'var(--space-3)',
              }}>
                {m.email && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Email</div>
                    <a href={`mailto:${m.email}`} style={{ color: 'var(--brand-blue-accent)', fontSize: '13px', textDecoration: 'none', wordBreak: 'break-all' }}>{m.email}</a>
                  </div>
                )}
                {m.phone && (
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Phone</div>
                    <a href={`tel:${m.phone}`} style={{ color: 'var(--brand-blue-accent)', fontSize: '13px', textDecoration: 'none' }}>{m.phone}</a>
                  </div>
                )}
                {m.nxt_id && (
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>NXT ID</div>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{m.nxt_id}</span>
                  </div>
                )}
                {m.date_of_birth && (
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>DOB</div>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{m.date_of_birth}</span>
                  </div>
                )}
                {m.state && (
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>State</div>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{m.state}</span>
                  </div>
                )}
              </div>

              {upline && (
                <div style={{ marginBottom: 'var(--space-2)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Upline</div>
                  <div
                    onClick={() => setSelectedMember(upline)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.02)',
                      cursor: 'pointer', transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)'}
                  >
                    <Avatar name={dn(upline)} photoUrl={upline.photo_url} size={28} goldText={false} />
                    <span style={{ fontSize: '13px', color: 'var(--brand-navy)', fontWeight: 600 }}>
                      {dn(upline)}
                    </span>
                  </div>
                </div>
              )}

              {downlines.length > 0 && (
                <div style={{ marginBottom: 'var(--space-2)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    Direct Reports ({downlines.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {downlines.map(d => (
                      <div
                        key={d.id}
                        onClick={() => setSelectedMember(d)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.02)',
                          cursor: 'pointer', transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)'}
                      >
                        <Avatar name={dn(d)} photoUrl={d.photo_url} size={24} goldText={false} />
                        <span style={{ fontSize: '12px', color: 'var(--brand-navy)', fontWeight: 500 }}>
                          {dn(d)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {memberSplits.length > 0 && (
                <div style={{ marginBottom: 'var(--space-2)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    Commission Splits ({memberSplits.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {memberSplits.map((s, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 12px', borderRadius: '8px',
                          backgroundColor: 'rgba(227, 169, 74, 0.06)',
                          border: '1px solid rgba(227, 169, 74, 0.15)',
                        }}
                      >
                        <span style={{ fontSize: '12px', color: 'var(--brand-navy)', fontWeight: 500 }}>
                          {s.beneficiaryName || 'Unknown'}
                        </span>
                        <span style={{
                          fontSize: '11px', fontWeight: 700, color: '#fff',
                          backgroundColor: 'var(--brand-gold)', borderRadius: '999px',
                          padding: '1px 8px', display: 'inline-flex', alignItems: 'center',
                        }}>
                          {s.percent}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-color)' }}>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => router.push(`/dashboard/team/${m.id}`)}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px',
                        border: '1.5px solid var(--border-color)', backgroundColor: 'transparent',
                        cursor: 'pointer', color: 'var(--brand-navy)', fontWeight: 600,
                      }}
                    >
                      Full Profile
                    </button>
                    {!m.is_owner && (
                      <button
                        onClick={() => { setSelectedMember(null); setAssignManagerAgent(m); setSelectedManagerId(m.upline_id || ''); }}
                        style={{
                          flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px',
                          border: '1.5px solid var(--brand-gold)', backgroundColor: 'rgba(227, 169, 74, 0.08)',
                          cursor: 'pointer', color: 'var(--brand-navy)', fontWeight: 600,
                        }}
                      >
                        Assign Upline
                      </button>
                    )}
                  </>
                )}
                {isSuperAdmin && !m.is_owner && (
                  <button
                    onClick={() => { toggleHide(selectedNodeId || m.id); setSelectedMember(null); }}
                    title="Hide this card from the hierarchy view"
                    style={{
                      padding: '10px', borderRadius: '10px', fontSize: '13px',
                      border: '1.5px solid var(--border-color)', backgroundColor: 'transparent',
                      cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                    Hide
                  </button>
                )}
              </div>
            </Card>
          </div>,
        document.body)}
      </div>
    );
  }

  return (
    <div>
      {/* Pan/zoom canvas */}
      <Card style={{ padding: 0, overflow: 'hidden', position: 'relative', borderRadius: '16px' }}>
        {/* Toolbar */}
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', gap: '12px',
          background: 'linear-gradient(180deg, rgba(12, 16, 34, 0.03), transparent)',
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '0 1 260px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 12px', borderRadius: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--surface-card)',
              transition: 'border-color 0.15s',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  border: 'none', outline: 'none', background: 'transparent',
                  fontSize: '12px', color: 'var(--brand-navy)', width: '100%',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1, padding: 0 }}
                >×</button>
              )}
            </div>
            {/* Search dropdown */}
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                backgroundColor: 'var(--surface-card)', borderRadius: '10px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 100, overflow: 'hidden',
              }}>
                {searchResults.map(a => (
                  <div
                    key={a.id}
                    onClick={() => handleSearchSelect(a)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', cursor: 'pointer',
                      transition: 'background-color 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(227, 169, 74,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Avatar name={dn(a)} photoUrl={a.photo_url} size={24} goldText={false} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--brand-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {dn(a)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.email || ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '10px', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '20px', height: '2px', backgroundColor: '#C8CDD5', borderRadius: '1px' }} />
              <span>Hierarchy</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '20px', height: '3px', background: 'linear-gradient(90deg, var(--brand-gold), #E8C45A)', borderRadius: '2px' }} />
              <span>Split</span>
            </div>
            {isAdmin && (
              <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Drag to reassign · Double-click to scope
              </span>
            )}
          </div>

          {/* Hidden agents indicator (super-admin only) */}
          {isSuperAdmin && hiddenItems.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowHiddenPanel(p => !p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '4px 10px', borderRadius: '999px', fontSize: '11px',
                  border: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.03)',
                  cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                {hiddenItems.length} hidden
              </button>
              {showHiddenPanel && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '6px',
                  width: '260px', maxHeight: '300px', overflow: 'auto',
                  backgroundColor: 'var(--surface-card)', borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  zIndex: 200, padding: '8px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 8px', borderBottom: '1px solid var(--border-color)', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--brand-navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hidden Cards</span>
                    <button
                      onClick={restoreAll}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '11px', color: 'var(--brand-blue-accent)', fontWeight: 600,
                      }}
                    >
                      Restore All
                    </button>
                  </div>
                  {hiddenItems.map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '6px 8px', borderRadius: '8px',
                        transition: 'background-color 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Avatar name={item.name} photoUrl={item.photo_url} size={24} goldText={false} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--brand-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {item.name}
                        </span>
                        {item.label && (
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            {item.label}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleHide(item.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: '10px', color: 'var(--brand-blue-accent)', fontWeight: 600,
                          padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
                        }}
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {/* Breadcrumb bar for scoped view */}
        {scopeId && breadcrumbs.length > 0 && (
          <div style={{
            padding: '6px 16px', fontSize: '12px', color: 'var(--text-secondary)',
            backgroundColor: 'rgba(12, 16, 34, 0.04)', borderBottom: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap',
          }}>
            <button
              onClick={() => setScopeId(null)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
                borderRadius: '4px', fontSize: '12px', color: 'var(--brand-blue-accent)', fontWeight: 600,
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(227, 169, 74,0.1)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              All
            </button>
            {breadcrumbs.map((node, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <React.Fragment key={node.id}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>/</span>
                  {isLast ? (
                    <span style={{ fontWeight: 600, color: 'var(--brand-navy)', padding: '2px 6px' }}>
                      {dn(node)}
                    </span>
                  ) : (
                    <button
                      onClick={() => setScopeId(node.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
                        borderRadius: '4px', fontSize: '12px', color: 'var(--brand-blue-accent)', fontWeight: 500,
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(227, 169, 74,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {dn(node)}
                    </button>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
        <div
          ref={containerRef}
          onMouseDown={activeId ? undefined : onMouseDown}
          onMouseMove={activeId ? undefined : onMouseMove}
          onMouseUp={activeId ? undefined : onMouseUp}
          onMouseLeave={activeId ? undefined : onMouseUp}
          style={{
            width: '100%',
            height: '640px',
            overflow: 'hidden',
            cursor: activeId ? 'grabbing' : 'grab',
            position: 'relative',
            userSelect: 'none',
          }}
        >
          {roots.length === 0 ? (
            <div style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>No team members yet.</p>
            </div>
          ) : (
            <>
              <div
                ref={contentRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transformOrigin: '0 0',
                  transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                  padding: '32px 40px 48px',
                  zIndex: 1,
                }}
              >
                <svg
                  style={{
                    position: 'absolute', top: 0, left: 0,
                    width: svgSize.w || '100%',
                    height: svgSize.h || '100%',
                    pointerEvents: 'none', overflow: 'visible',
                    zIndex: 0,
                  }}
                >
                  {svgPaths.map((d, i) => (
                    <path key={i} d={d} fill="none" stroke="rgba(12, 16, 34, 0.15)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                  ))}
                </svg>

                <div style={{ display: 'flex', gap: '48px', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                {roots.map(root => (
                  <TreeBranch
                    key={root.id}
                    node={root}
                    selectedId={selectedMember?.id}
                    onSelect={handleSelectMember}
                    isFindMeId={findMeId}
                    cardRefs={cardRefs}
                    collapsedIds={collapsedIds}
                    onToggleCollapse={onToggleCollapse}
                    depth={0}
                    isAdmin={isAdmin}
                    activeId={activeId}
                    onScopeIn={handleScopeIn}
                    onDragNodeStart={handleDragNodeStart}
                  />
                ))}
                </div>
              </div>

              <div style={{
                position: 'absolute', top: 0, right: 0, bottom: 0, width: '32px',
                background: 'linear-gradient(to left, rgba(0,0,0,0.06), transparent)',
                pointerEvents: 'none', zIndex: 3,
              }} />
            </>
          )}

          {/* Controls */}
          <div style={{
            position: 'absolute', bottom: '16px', right: '16px',
            display: 'flex', flexDirection: 'column', gap: '6px',
            zIndex: 10,
          }}>
            {/* eslint-disable-next-line react-hooks/refs */}
            {[
              { label: '+', title: 'Zoom in', action: () => setTransform(p => ({ ...p, scale: Math.min(1.5, p.scale * 1.15) })) },
              { label: '−', title: 'Zoom out', action: () => setTransform(p => ({ ...p, scale: Math.max(0.4, p.scale / 1.15) })) },
              { label: '⊡', title: 'Fit to screen', action: fitToScreen },
              { label: '◎', title: 'Find me', action: handleFindMe },
            ].map(({ label, title, action }) => (
              <button
                key={title}
                onClick={e => { e.stopPropagation(); action(); }}
                title={title}
                style={{
                  width: '34px', height: '34px', borderRadius: '8px',
                  border: '1.5px solid var(--border-color)',
                  backgroundColor: 'var(--surface-card)',
                  cursor: 'pointer', fontSize: '16px', lineHeight: 1,
                  color: 'var(--brand-navy)', fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(227, 169, 74,0.1)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--surface-card)'}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Drag indicator — shows dragged card name at cursor */}
      {activeNode && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9999, pointerEvents: 'none',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          paddingTop: '80px',
        }}>
          <div style={{
            padding: '8px 16px', borderRadius: '10px',
            backgroundColor: 'var(--surface-card)', border: '2px solid var(--brand-gold)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)', fontSize: '13px', fontWeight: 600,
            color: 'var(--brand-navy)',
          }}>
            Moving {dn(activeNode)} — drop on a card
          </div>
        </div>,
      document.body)}

      {/* Confirm move modal — portaled to body to avoid clipping by .main overflow */}
      {pendingMove && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 10001,
          }}
          onClick={e => { if (e.target === e.currentTarget && !isMoving) setPendingMove(null); }}
        >
          <Card style={{ width: '420px', padding: 'var(--space-4)' }}>
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--brand-navy)', fontSize: '16px', fontWeight: 700 }}>
              Confirm Hierarchy Change
            </h3>
            <p style={{ margin: '0 0 var(--space-3) 0', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
              Move <strong style={{ color: 'var(--brand-navy)' }}>{dn(pendingMove.dragNode)}</strong> under <strong style={{ color: 'var(--brand-navy)' }}>{dn(pendingMove.dropNode)}</strong>?
            </p>
            <div style={{
              padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.03)',
              marginBottom: 'var(--space-3)', fontSize: '12px', color: 'var(--text-secondary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Avatar name={dn(pendingMove.dragNode)} photoUrl={pendingMove.dragNode.photo_url} size={28} goldText={false} />
                <span style={{ fontWeight: 600, color: 'var(--brand-navy)' }}>{dn(pendingMove.dragNode)}</span>
              </div>
              <div style={{ paddingLeft: '14px', borderLeft: '2px solid var(--brand-gold)', marginLeft: '14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Current upline: {(() => {
                    const cur = pendingMove.dragNode.upline_id ? agents.find(a => a.id === pendingMove.dragNode.upline_id) : null;
                    return cur ? dn(cur) : 'None (top-level)';
                  })()}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--status-success)', fontWeight: 600 }}>
                  New upline: {dn(pendingMove.dropNode)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => setPendingMove(null)} disabled={isMoving}>Cancel</Button>
              <Button onClick={confirmMove} isLoading={isMoving}>
                Confirm Move
              </Button>
            </div>
          </Card>
        </div>,
      document.body)}

      {/* Change log panel (admin only) */}
      {isAdmin && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <button
            onClick={() => setShowLog(prev => !prev)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0',
            }}
          >
            <span style={{ fontSize: '14px', transition: 'transform 0.2s', transform: showLog ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
            Recent Hierarchy Changes
          </button>
          {showLog && (
            <Card style={{ marginTop: '8px', padding: 'var(--space-3)' }}>
              {logLoading ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', padding: 'var(--space-2)' }}>Loading...</div>
              ) : hierarchyLog.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', padding: 'var(--space-2)' }}>No hierarchy changes yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {hierarchyLog.map(log => {
                    const oldParent = log.oldUplineId ? agentMap[log.oldUplineId] : null;
                    const newParent = log.newUplineId ? agentMap[log.newUplineId] : null;
                    return (
                      <div key={log.id} style={{
                        padding: '10px 12px', borderRadius: '8px',
                        backgroundColor: log.undone ? 'rgba(0,0,0,0.02)' : 'rgba(227, 169, 74,0.04)',
                        border: '1px solid var(--border-color)',
                        opacity: log.undone ? 0.6 : 1,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ fontSize: '12px', color: 'var(--brand-navy)', fontWeight: 600 }}>
                            {log.agentName}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                            {log.createdAt ? new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {oldParent ? dn(oldParent) : 'Top-level'}
                          {' → '}
                          {newParent ? dn(newParent) : 'Top-level'}
                          {log.descendantsUpdated > 0 && ` · ${log.descendantsUpdated} descendants`}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          by {log.performedByName}
                          {log.undone && <span style={{ color: 'var(--status-warning)', fontWeight: 600 }}> · Undone</span>}
                        </div>
                        {!log.undone && (
                          <button
                            onClick={() => handleUndo(log.id)}
                            disabled={undoingId === log.id}
                            style={{
                              marginTop: '6px', padding: '3px 10px', borderRadius: '999px',
                              border: '1px solid var(--border-color)', backgroundColor: 'transparent',
                              cursor: undoingId === log.id ? 'wait' : 'pointer',
                              fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600,
                              opacity: undoingId === log.id ? 0.5 : 1,
                            }}
                          >
                            {undoingId === log.id ? 'Undoing...' : 'Undo'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Backfill hierarchy paths (super-admin only) */}
      {userProfile?.email === 'kanchamjaswanthreddy@gmail.com' && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <button
            onClick={async () => {
              setBackfilling(true);
              setBackfillResult(null);
              try {
                const res = await backfillHierarchyPaths(userProfile.uid);
                setBackfillResult(res);
                if (res.success && onRefresh) onRefresh();
              } catch (e) {
                setBackfillResult({ success: false, error: e.message });
              }
              setBackfilling(false);
            }}
            disabled={backfilling}
            style={{
              background: 'none', border: '1px solid var(--border-color)', cursor: backfilling ? 'wait' : 'pointer',
              fontSize: '12px', color: 'var(--brand-navy)', fontWeight: 600,
              padding: '6px 14px', borderRadius: '8px',
              opacity: backfilling ? 0.5 : 1,
            }}
          >
            {backfilling ? 'Fixing hierarchy paths...' : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4,verticalAlign:'middle'}}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>Repair Hierarchy Paths</>}
          </button>
          {backfillResult && (
            <div style={{
              marginTop: '6px', fontSize: '12px', padding: '8px 12px', borderRadius: '8px',
              backgroundColor: backfillResult.success ? 'rgba(47,168,79,0.08)' : 'rgba(220,53,69,0.08)',
              color: backfillResult.success ? 'var(--status-success)' : 'var(--status-error)',
              border: `1px solid ${backfillResult.success ? 'rgba(47,168,79,0.2)' : 'rgba(220,53,69,0.2)'}`,
            }}>
              {backfillResult.success
                ? `Fixed ${backfillResult.fixed} agents (${backfillResult.skipped} already correct, ${backfillResult.total} total)${backfillResult.orphans?.length ? ` · ${backfillResult.orphans.length} orphans` : ''}`
                : `Error: ${backfillResult.error}`}
            </div>
          )}
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="email"
              placeholder="Agent email to diagnose..."
              value={diagEmail}
              onChange={e => setDiagEmail(e.target.value)}
              style={{
                fontSize: '12px', padding: '6px 12px', borderRadius: '8px',
                border: '1px solid var(--border-color)', width: '260px',
              }}
            />
            <button
              onClick={async () => {
                if (!diagEmail.trim()) return;
                setDiagLoading(true);
                setDiagResult(null);
                try {
                  const res = await diagnoseAgentVisibility(userProfile.uid, diagEmail.trim());
                  setDiagResult(res);
                } catch (e) {
                  setDiagResult({ success: false, error: e.message });
                }
                setDiagLoading(false);
              }}
              disabled={diagLoading || !diagEmail.trim()}
              style={{
                background: 'none', border: '1px solid var(--border-color)', cursor: diagLoading ? 'wait' : 'pointer',
                fontSize: '12px', color: 'var(--brand-navy)', fontWeight: 600,
                padding: '6px 14px', borderRadius: '8px',
                opacity: (diagLoading || !diagEmail.trim()) ? 0.5 : 1,
              }}
            >
              {diagLoading ? 'Diagnosing...' : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4,verticalAlign:'middle'}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Diagnose</>}
            </button>
          </div>
          {diagResult && (
            <pre style={{
              marginTop: '8px', fontSize: '11px', padding: '10px', borderRadius: '8px',
              backgroundColor: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-color)',
              overflow: 'auto', maxHeight: '300px', whiteSpace: 'pre-wrap',
            }}>
              {JSON.stringify(diagResult, null, 2)}
            </pre>
          )}
          <div style={{ marginTop: '12px' }}>
            <button
              onClick={async () => {
                setPaymentAuditLoading(true);
                setPaymentAudit(null);
                try {
                  const res = await getAgentsMissingPayment(userProfile.uid);
                  setPaymentAudit(res);
                } catch (e) {
                  setPaymentAudit({ success: false, error: e.message });
                }
                setPaymentAuditLoading(false);
              }}
              disabled={paymentAuditLoading}
              style={{
                background: 'none', border: '1px solid var(--border-color)', cursor: paymentAuditLoading ? 'wait' : 'pointer',
                fontSize: '12px', color: 'var(--brand-navy)', fontWeight: 600,
                padding: '6px 14px', borderRadius: '8px',
                opacity: paymentAuditLoading ? 0.5 : 1,
              }}
            >
              {paymentAuditLoading ? 'Auditing...' : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4,verticalAlign:'middle'}}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>Audit Missing Card Details</>}
            </button>
            <button
              onClick={async () => {
                setReminderLoading(true);
                setReminderResult(null);
                try {
                  const res = await sendPaymentReminders(userProfile.uid);
                  setReminderResult(res);
                } catch (e) {
                  setReminderResult({ success: false, error: e.message });
                }
                setReminderLoading(false);
              }}
              disabled={reminderLoading}
              style={{
                background: 'none', border: '1px solid #DC3545', cursor: reminderLoading ? 'wait' : 'pointer',
                fontSize: '12px', color: '#DC3545', fontWeight: 600,
                padding: '6px 14px', borderRadius: '8px',
                opacity: reminderLoading ? 0.5 : 1,
              }}
            >
              {reminderLoading ? 'Sending...' : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4,verticalAlign:'middle'}}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Send Payment Reminders</>}
            </button>
          </div>
          {reminderResult && (
            <pre style={{
              marginTop: '8px', fontSize: '11px', padding: '10px', borderRadius: '8px',
              backgroundColor: reminderResult.success ? 'rgba(47, 168, 79, 0.06)' : 'rgba(220, 53, 69, 0.06)',
              border: `1px solid ${reminderResult.success ? 'rgba(47, 168, 79, 0.2)' : 'rgba(220, 53, 69, 0.2)'}`,
              overflow: 'auto', maxHeight: '300px', whiteSpace: 'pre-wrap',
            }}>
              {JSON.stringify(reminderResult, null, 2)}
            </pre>
          )}
          {paymentAudit && (
            <pre style={{
              marginTop: '8px', fontSize: '11px', padding: '10px', borderRadius: '8px',
              backgroundColor: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-color)',
              overflow: 'auto', maxHeight: '400px', whiteSpace: 'pre-wrap',
            }}>
              {JSON.stringify(paymentAudit, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Payment Tracker Dashboard (super-admin only) */}
      {userProfile?.email === 'kanchamjaswanthreddy@gmail.com' && (
        <div style={{
          marginTop: 'var(--space-3)', padding: '20px', borderRadius: '16px',
          background: '#fff', border: '1px solid var(--border-color)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'rgba(220, 53, 69, 0.08)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC3545" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--brand-navy)' }}>Payment Status Tracker</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {paymentTrackerLoading ? 'Loading...' : paymentTracker?.success
                    ? `${paymentTracker.missing.length} missing · ${paymentTracker.withCard.length} completed`
                    : 'Failed to load'}
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                setPaymentTrackerLoading(true);
                try {
                  const res = await getAgentsMissingPayment(userProfile.uid);
                  setPaymentTracker(res);
                } catch {}
                setPaymentTrackerLoading(false);
              }}
              disabled={paymentTrackerLoading}
              style={{
                background: 'none', border: '1px solid var(--border-color)',
                cursor: paymentTrackerLoading ? 'wait' : 'pointer',
                fontSize: '12px', color: 'var(--brand-navy)', fontWeight: 600,
                padding: '5px 12px', borderRadius: '8px',
                opacity: paymentTrackerLoading ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
              </svg>
              Refresh
            </button>
          </div>

          {/* Progress bar */}
          {paymentTracker?.success && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                height: '8px', borderRadius: '4px', background: 'rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: '4px',
                  background: 'linear-gradient(90deg, #2FA84F, #34C759)',
                  width: `${(paymentTracker.withCard.length / (paymentTracker.withCard.length + paymentTracker.missing.length)) * 100}%`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                {paymentTracker.withCard.length} of {paymentTracker.withCard.length + paymentTracker.missing.length} agents have added payment
              </p>
            </div>
          )}

          {/* Missing card table */}
          {paymentTracker?.success && paymentTracker.missing.length > 0 && (
            <div>
              <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: '#DC3545' }}>
                Still Missing ({paymentTracker.missing.length})
              </p>
              <div style={{ borderRadius: '10px', border: '1px solid rgba(220,53,69,0.15)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(220,53,69,0.04)' }}>
                      <th scope="col" style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--brand-navy)', borderBottom: '1px solid rgba(220,53,69,0.1)' }}>Name</th>
                      <th scope="col" style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--brand-navy)', borderBottom: '1px solid rgba(220,53,69,0.1)' }}>Email</th>
                      <th scope="col" style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--brand-navy)', borderBottom: '1px solid rgba(220,53,69,0.1)' }}>Role</th>
                      <th scope="col" style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--brand-navy)', borderBottom: '1px solid rgba(220,53,69,0.1)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentTracker.missing.map(agent => (
                      <tr key={agent.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--brand-navy)', fontWeight: 500 }}>{agent.name}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{agent.email}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{agent.role}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
                            fontSize: '11px', fontWeight: 600,
                            background: 'rgba(220,53,69,0.08)', color: '#DC3545',
                          }}>
                            Missing
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Completed card table */}
          {paymentTracker?.success && paymentTracker.withCard.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: '#2FA84F' }}>
                Completed ({paymentTracker.withCard.length})
              </p>
              <div style={{ borderRadius: '10px', border: '1px solid rgba(47,168,79,0.15)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(47,168,79,0.04)' }}>
                      <th scope="col" style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--brand-navy)', borderBottom: '1px solid rgba(47,168,79,0.1)' }}>Name</th>
                      <th scope="col" style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--brand-navy)', borderBottom: '1px solid rgba(47,168,79,0.1)' }}>Email</th>
                      <th scope="col" style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--brand-navy)', borderBottom: '1px solid rgba(47,168,79,0.1)' }}>Card</th>
                      <th scope="col" style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--brand-navy)', borderBottom: '1px solid rgba(47,168,79,0.1)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentTracker.withCard.map(agent => (
                      <tr key={agent.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--brand-navy)', fontWeight: 500 }}>{agent.name}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{agent.email}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {agent.cardLastFour ? `**** ${agent.cardLastFour}` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
                            fontSize: '11px', fontWeight: 600,
                            background: 'rgba(47,168,79,0.08)', color: '#2FA84F',
                          }}>
                            Done
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* All done state */}
          {paymentTracker?.success && paymentTracker.missing.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '20px', borderRadius: '10px',
              background: 'rgba(47,168,79,0.06)', border: '1px solid rgba(47,168,79,0.15)',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2FA84F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#2FA84F' }}>
                All agents have added their payment details
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                This tracker can be safely removed.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Move result toast — portaled to body */}
      {moveResult && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 10002,
          padding: 'var(--space-2) var(--space-3)', borderRadius: '12px',
          backgroundColor: moveResult.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
          color: '#fff', fontSize: '13px', fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: '400px',
        }}>
          {moveResult.message}
        </div>,
      document.body)}

      {/* Centered bento card for member details — portaled to body to avoid clipping */}
      {m && typeof document !== 'undefined' && createPortal(
        <>
          <div
            onClick={() => setSelectedMember(null)}
            style={{
              position: 'fixed', inset: 0,
              backgroundColor: 'rgba(12, 16, 34, 0.35)',
              backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
              zIndex: 9999,
              animation: 'fadeIn 0.2s ease',
            }}
          />
          <div
            style={{
              position: 'fixed', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '480px', maxWidth: '92vw', maxHeight: '85vh',
              backgroundColor: 'var(--surface-card)',
              borderRadius: '16px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
              zIndex: 10000,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              animation: 'cardPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Header with navy accent bar */}
            <div style={{
              padding: '24px 24px 18px',
              background: 'linear-gradient(180deg, rgba(12, 16, 34, 0.04), transparent)',
              borderBottom: '1px solid var(--border-light)',
            }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <Avatar name={dn(m)} photoUrl={m.photo_url} size={56} goldText={m.is_owner} ownerRing={m.is_owner} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, color: 'var(--brand-navy)', fontSize: '18px', fontWeight: 700, lineHeight: 1.3 }}>
                    {dn(m) || 'Name not set'}
                  </h3>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {m.is_owner && (
                      <span style={{ padding: '3px 12px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: 'linear-gradient(135deg, #0C1022, #1B2A4E)', color: '#E3A94A' }}>Owner</span>
                    )}
                    <span style={{ padding: '3px 12px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, backgroundColor: 'rgba(10, 37, 64, 0.06)', color: 'var(--brand-navy)' }}>
                      L{lvl.level} · {lvl.title}
                    </span>
                    <span style={{
                      padding: '3px 12px', borderRadius: '999px', fontSize: '10px', fontWeight: 600,
                      backgroundColor: m.status === 'active' ? 'rgba(47, 168, 79, 0.1)' : 'rgba(0,0,0,0.06)',
                      color: m.status === 'active' ? 'var(--status-success)' : 'var(--text-secondary)',
                    }}>
                      {m.status || 'Unknown'}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedMember(null)} style={{
                  background: 'none', border: '1px solid var(--border-color)', cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1,
                  width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background-color 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >×</button>
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflow: 'auto', padding: '18px 24px' }}>
              {/* Contact grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
                padding: '14px', borderRadius: '12px',
                backgroundColor: 'rgba(0,0,0,0.02)', marginBottom: '16px',
              }}>
                {m.email && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Email</div>
                    <a href={`mailto:${m.email}`} style={{ color: 'var(--brand-blue-accent)', fontSize: '12px', textDecoration: 'none', wordBreak: 'break-all' }}>{m.email}</a>
                  </div>
                )}
                {m.phone && (
                  <div>
                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Phone</div>
                    <a href={`tel:${m.phone}`} style={{ color: 'var(--brand-blue-accent)', fontSize: '12px', textDecoration: 'none' }}>{m.phone}</a>
                  </div>
                )}
                {m.nxt_id && (
                  <div>
                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>NXT ID</div>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>{m.nxt_id}</span>
                  </div>
                )}
                {m.date_of_birth && (
                  <div>
                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>DOB</div>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{m.date_of_birth}</span>
                  </div>
                )}
                {m.state && (
                  <div>
                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>State</div>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{m.state}</span>
                  </div>
                )}
              </div>

              {/* Upline */}
              {upline && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Upline</div>
                  <div
                    onClick={() => setSelectedMember(upline)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.02)',
                      cursor: 'pointer', transition: 'background-color 0.15s',
                      border: '1px solid transparent',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)'; e.currentTarget.style.borderColor = 'transparent'; }}
                  >
                    <Avatar name={dn(upline)} photoUrl={upline.photo_url} size={28} goldText={false} />
                    <span style={{ fontSize: '13px', color: 'var(--brand-navy)', fontWeight: 600 }}>
                      {dn(upline)}
                    </span>
                  </div>
                </div>
              )}

              {/* Direct Reports */}
              {downlines.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                    Direct Reports ({downlines.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {downlines.map(d => (
                      <div
                        key={d.id}
                        onClick={() => setSelectedMember(d)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.02)',
                          cursor: 'pointer', transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)'}
                      >
                        <Avatar name={dn(d)} photoUrl={d.photo_url} size={24} goldText={false} />
                        <span style={{ fontSize: '12px', color: 'var(--brand-navy)', fontWeight: 500 }}>
                          {dn(d)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Commission Splits */}
              {memberSplits.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                    Commission Splits ({memberSplits.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {memberSplits.map((s, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 12px', borderRadius: '10px',
                          background: 'linear-gradient(135deg, rgba(227, 169, 74, 0.06), rgba(227, 169, 74, 0.02))',
                          border: '1px solid rgba(227, 169, 74, 0.12)',
                        }}
                      >
                        <span style={{ fontSize: '12px', color: 'var(--brand-navy)', fontWeight: 500 }}>
                          {s.beneficiaryName || 'Unknown'}
                        </span>
                        <span style={{
                          fontSize: '11px', fontWeight: 700, color: '#fff',
                          background: 'linear-gradient(135deg, var(--brand-gold), #E3A94A)',
                          borderRadius: '999px',
                          padding: '2px 10px', display: 'inline-flex', alignItems: 'center',
                          boxShadow: '0 1px 3px rgba(227, 169, 74,0.3)',
                        }}>
                          {s.percent}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div style={{
              padding: '14px 24px 18px',
              borderTop: '1px solid var(--border-light)',
              display: 'flex', gap: '8px', flexWrap: 'wrap',
              background: 'linear-gradient(0deg, rgba(12, 16, 34, 0.02), transparent)',
            }}>
              {isAdmin && (
                <>
                  <button
                    onClick={() => router.push(`/dashboard/team/${m.id}`)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px',
                      border: '1.5px solid var(--border-color)', backgroundColor: 'transparent',
                      cursor: 'pointer', color: 'var(--brand-navy)', fontWeight: 600,
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    Full Profile
                  </button>
                  {!m.is_owner && (
                    <button
                      onClick={() => { setSelectedMember(null); setAssignManagerAgent(m); setSelectedManagerId(m.upline_id || ''); }}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px',
                        border: '1.5px solid var(--brand-gold)', backgroundColor: 'rgba(227, 169, 74, 0.06)',
                        cursor: 'pointer', color: 'var(--brand-navy)', fontWeight: 600,
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(227, 169, 74, 0.12)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(227, 169, 74, 0.06)'}
                    >
                      Assign Upline
                    </button>
                  )}
                </>
              )}
              {(m.children?.length > 0 || agents.some(a => a.upline_id === m.id)) && (
                <button
                  onClick={() => { setSelectedMember(null); handleScopeIn(m.id); }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px',
                    border: '1.5px solid var(--brand-blue-accent)', backgroundColor: 'rgba(227, 169, 74, 0.04)',
                    cursor: 'pointer', color: 'var(--brand-navy)', fontWeight: 600,
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(227, 169, 74, 0.1)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(227, 169, 74, 0.04)'}
                >
                  View Team
                </button>
              )}
              {isSuperAdmin && !m.is_owner && (
                <button
                  onClick={() => { toggleHide(selectedNodeId || m.id); setSelectedMember(null); }}
                  title="Hide this card from the hierarchy view"
                  style={{
                    padding: '10px', borderRadius: '10px', fontSize: '12px',
                    border: '1.5px solid var(--border-color)', backgroundColor: 'transparent',
                    cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600,
                    transition: 'background-color 0.15s',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                  Hide
                </button>
              )}
            </div>
          </div>
        </>,
      document.body)}
    </div>
  );
}

export default function TeamDashboard() {
  const router = useRouter();
  const { userProfile, isLoading: profileLoading } = useUser();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('hierarchy');
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // Data loaded via API route (not server actions) to avoid POST to current URL
  const [agents, setAgents] = useState([]);
  const [invites, setInvites] = useState([]);
  const [teamMetrics, setTeamMetrics] = useState([]);
  const [allOverrides, setAllOverrides] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'full_name', direction: 'asc' });
  const [resendingId, setResendingId] = useState(null);
  const [resendResult, setResendResult] = useState(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isSendingWorkAuth, setIsSendingWorkAuth] = useState(false);
  const [w9Map, setW9Map] = useState({});
  const [assignManagerAgent, setAssignManagerAgent] = useState(null);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [linkingInviteId, setLinkingInviteId] = useState(null);
  const [linkAgentSearch, setLinkAgentSearch] = useState('');
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });

  const isAdmin = userProfile && (
    userProfile.role === 'admin' ||
    userProfile.role === 'it_engineer' ||
    userProfile.is_owner
  );
  const canAccessTeam = !!userProfile;

  // Load all data via API route — no server action POST to current URL
  const loadAllData = async () => {
    try {
      const res = await fetch('/api/team/data').then(r => r.json());
      if (res.success) {
        setAgents(res.agents || []);
        setInvites(res.invites || []);
        setTeamMetrics(res.metrics || []);
        setAllOverrides(res.overrides || []);
        setW9Map(res.w9Map || {});
      }
    } catch {
      // silenced
    }
    setIsLoading(false);
  };

  // Load data on mount via API route (GET, not POST)
  useEffect(() => {
    if (profileLoading) return;
    if (!userProfile) return;
    if (!canAccessTeam) {
      router.push('/dashboard');
      return;
    }
    loadAllData();
  }, [profileLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // kept for backward compat with any refresh calls
  const loadMetrics = async (profile) => {
    // now handled by loadAllData
    const list = [];
    setTeamMetrics(list);
  };

  // Filter metrics by visibility (same logic as old loadAllData)
  const visibleMetrics = useMemo(() => {
    if (!userProfile) return teamMetrics;
    return teamMetrics.filter(m =>
      userProfile.role === 'admin' || userProfile.role === 'it_engineer' ||
      m.agentId === userProfile.uid ||
      (m.agentHierarchyPath && m.agentHierarchyPath.startsWith((userProfile.hierarchyPath || '') + '/'))
    );
  }, [teamMetrics, userProfile]);

  const getAgentMetrics = (agentId) => {
    return visibleMetrics.find(m => m.agentId === agentId) || {};
  };

  const getOnboardingStatus = (agent) => {
    // Owner is always Active — skip onboarding checks
    if (agent.is_owner) return 'active';
    if (agent.status === 'invited') return 'invited';
    if (agent.status === 'docs_pending_review') return 'docs_pending_review';
    if (agent.status === 'pending_licensing') return 'pending_licensing';
    if ((!agent.first_name && !agent.full_name) || !agent.phone) return 'onboarding';
    if (agent.onboardingProgress?.documentsApproved) return 'contracted';
    if (agent.onboardingProgress?.documentsUploaded) return 'docs_pending';
    if (agent.licensedStates?.length > 0) return 'licensed';
    return agent.status || 'active';
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortedAgents = () => {
    return [...agents].sort((a, b) => {
      let valA, valB;

      if (sortConfig.key === 'full_name') {
        valA = dn(a).toLowerCase();
        valB = dn(b).toLowerCase();
      } else if (sortConfig.key === 'production') {
        const mA = getAgentMetrics(a.id);
        const mB = getAgentMetrics(b.id);
        valA = (mA.commissionPaid || 0) + (mA.overrideEarnedPaid || 0);
        valB = (mB.commissionPaid || 0) + (mB.overrideEarnedPaid || 0);
      } else if (sortConfig.key === 'status') {
        valA = getOnboardingStatus(a);
        valB = getOnboardingStatus(b);
      } else {
        valA = a[sortConfig.key] || '';
        valB = b[sortConfig.key] || '';
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  if (isLoading) {
    return (
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '60px', backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  const sortedAgents = getSortedAgents();
  const totalTeamProd = teamMetrics.reduce((sum, m) => sum + (m.commissionPaid || 0) + (m.overrideEarnedPaid || 0), 0);
  const totalDeals = teamMetrics.reduce((sum, m) => sum + (m.dealsWonCount || 0), 0);
  // Non-admins only see invites they sent; admins/owners see all
  const visibleInvites = isAdmin
    ? invites
    : invites.filter(i => i.invited_by_uid === userProfile?.uid || i.upline_id === userProfile?.uid);
  const pendingInvites = visibleInvites.filter(i => i.status === 'pending');
  const SortIcon = ({ field }) => sortConfig.key === field ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : '';

  const thStyle = { padding: 'var(--space-2) var(--space-2)', cursor: 'pointer', fontWeight: '600', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', userSelect: 'none' };
  const tdStyle = { padding: 'var(--space-2)', fontSize: 'var(--text-caption)' };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-h1)', margin: '0 0 4px 0', fontWeight: '600' }}>Team</h1>
          {isAdmin && (
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-secondary)' }}>
              {agents.length} member{agents.length !== 1 ? 's' : ''} · {pendingInvites.length} pending invite{pendingInvites.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          {isAdmin && (
            <button
              onClick={async () => {
                setIsCleaning(true);
                const res = await cleanupOrphanAgents(userProfile.agency_id, userProfile.uid);
                if (res.success) {
                  setResendResult({
                    type: 'success',
                    message: res.removed > 0
                      ? `Cleaned up ${res.removed} orphan agent${res.removed !== 1 ? 's' : ''}.`
                      : 'No orphan agents found. Everything is clean.'
                  });
                  if (res.removed > 0) await loadAllData();
                } else {
                  setResendResult({ type: 'error', message: res.error || 'Cleanup failed.' });
                }
                setIsCleaning(false);
                setTimeout(() => setResendResult(null), 5000);
              }}
              disabled={isCleaning}
              style={{
                padding: '8px 16px', borderRadius: '999px',
                border: '1.5px solid var(--border-color)', backgroundColor: 'transparent',
                color: 'var(--text-secondary)', fontSize: 'var(--text-caption)', fontWeight: 600,
                cursor: isCleaning ? 'wait' : 'pointer', opacity: isCleaning ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {isCleaning ? 'Cleaning...' : 'Cleanup Orphans'}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={async () => {
                setIsSendingWorkAuth(true);
                const res = await sendWorkAuthorizationTasks(
                  userProfile.agency_id,
                  userProfile.uid,
                  dn(userProfile),
                );
                if (res.success) {
                  setResendResult({
                    type: 'success',
                    message: res.sent > 0
                      ? `Sent work authorization task to ${res.sent} agent${res.sent !== 1 ? 's' : ''}.`
                      : res.message || 'All agents already have work authorization on file.'
                  });
                } else {
                  setResendResult({ type: 'error', message: res.error || 'Failed to send tasks.' });
                }
                setIsSendingWorkAuth(false);
                setTimeout(() => setResendResult(null), 5000);
              }}
              disabled={isSendingWorkAuth}
              style={{
                padding: '8px 16px', borderRadius: '999px',
                border: '1.5px solid var(--brand-gold)', backgroundColor: 'rgba(227, 169, 74, 0.08)',
                color: 'var(--brand-navy)', fontSize: 'var(--text-caption)', fontWeight: 600,
                cursor: isSendingWorkAuth ? 'wait' : 'pointer', opacity: isSendingWorkAuth ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {isSendingWorkAuth ? 'Sending...' : 'Send Work Auth Task'}
            </button>
          )}
          <Button onClick={() => setIsInviteOpen(true)}>
            + Invite Member
          </Button>
        </div>
      </div>

      {/* KPI Summary — admin only */}
      {isAdmin && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <Card style={{ padding: 'var(--space-2) var(--space-3)' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>
            Team Size
          </p>
          <p style={{ margin: 0, fontSize: 'var(--text-h1)', fontWeight: 'bold', color: 'var(--brand-navy)' }}>
            {agents.length}
          </p>
        </Card>
        <Card style={{ padding: 'var(--space-2) var(--space-3)' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>
            MTD Production
          </p>
          <p style={{ margin: 0, fontSize: 'var(--text-h1)', fontWeight: 'bold', color: 'var(--brand-navy)' }}>
            ${totalTeamProd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </Card>
        <Card style={{ padding: 'var(--space-2) var(--space-3)' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>
            MTD Deals Won
          </p>
          <p style={{ margin: 0, fontSize: 'var(--text-h1)', fontWeight: 'bold', color: 'var(--brand-navy)' }}>
            {totalDeals}
          </p>
        </Card>
        <Card style={{ padding: 'var(--space-2) var(--space-3)' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>
            Pending Invites
          </p>
          <p style={{ margin: 0, fontSize: 'var(--text-h1)', fontWeight: 'bold', color: pendingInvites.length > 0 ? 'var(--status-warning)' : 'var(--brand-navy)' }}>
            {pendingInvites.length}
          </p>
        </Card>
      </div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-1)' }}>
        {[
          { key: 'hierarchy', label: 'Hierarchy' },
          ...(isAdmin ? [
            { key: 'roster', label: 'Agent Roster' },
            { key: 'teams', label: 'Teams' },
          ] : []),
          { key: 'invites', label: `Invites (${visibleInvites.length})` }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: '999px',
              border: 'none',
              backgroundColor: activeTab === tab.key ? 'rgba(227, 169, 74, 0.15)' : 'transparent',
              color: activeTab === tab.key ? 'var(--brand-navy)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.key ? '600' : '500',
              fontSize: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Agent Roster Tab */}
      {activeTab === 'roster' && (
        <RosterTable
          agents={agents}
          w9Map={w9Map}
          teamMetrics={teamMetrics}
          userProfile={userProfile}
          onAssignUpline={(agent) => { setAssignManagerAgent(agent); setSelectedManagerId(agent.upline_id || ''); }}
          onRefresh={() => loadAllData()}
          onToast={(t) => { setResendResult(t); setTimeout(() => setResendResult(null), 5000); }}
          onInvite={() => setIsInviteOpen(true)}
          getOnboardingStatus={getOnboardingStatus}
          pendingInviteCount={pendingInvites.length}
        />
      )}

      {/* Hierarchy Tab — Visual Org Chart */}
      {activeTab === 'hierarchy' && <HierarchyChart agents={agents} allOverrides={allOverrides} selectedMember={selectedMember} setSelectedMember={setSelectedMember} isAdmin={isAdmin} router={router} setAssignManagerAgent={setAssignManagerAgent} setSelectedManagerId={setSelectedManagerId} userProfile={userProfile} onRefresh={() => loadAllData()} />}

      {/* Resend result toast */}
      {resendResult && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 10001,
          padding: 'var(--space-2) var(--space-3)', borderRadius: '12px',
          backgroundColor: resendResult.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
          color: '#fff', fontSize: 'var(--text-secondary)', fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: '400px',
        }}>
          <p style={{ margin: 0 }}>{resendResult.message}</p>
          {resendResult.link && (
            <p style={{ margin: '6px 0 0 0', fontSize: 'var(--text-caption)', fontWeight: 400, wordBreak: 'break-all' }}>
              {resendResult.link}
            </p>
          )}
        </div>
      )}

      {/* Teams Tab */}
      {activeTab === 'teams' && (() => {
        const managers = agents.filter(a => a.role === 'admin' || a.role === 'it_engineer');
        const unassigned = agents.filter(a => !a.upline_id && a.role !== 'admin' && a.role !== 'it_engineer');
        const groupedByManager = managers.map(mgr => ({
          manager: mgr,
          members: agents.filter(a => a.upline_id === mgr.id),
        })).filter(g => g.members.length > 0);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {groupedByManager.map(({ manager: mgr, members }) => {
              const mgrMetrics = members.reduce((acc, m) => {
                const mx = getAgentMetrics(m.id);
                return { prod: acc.prod + (mx.commissionPaid || 0) + (mx.overrideEarnedPaid || 0), deals: acc.deals + (mx.dealsWonCount || 0) };
              }, { prod: 0, deals: 0 });

              return (
                <Card key={mgr.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Avatar name={dn(mgr)} photoUrl={mgr.photo_url} size={40} />
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--brand-navy)' }}>{dn(mgr) || 'Unnamed'}</div>
                        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                          {mgr.is_owner ? 'Owner' : mgr.role} · {members.length} member{members.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                      <span>MTD: <strong style={{ color: 'var(--brand-navy)' }}>${mgrMetrics.prod.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                      <span>Deals: <strong style={{ color: 'var(--brand-navy)' }}>{mgrMetrics.deals}</strong></span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {members.map(m => {
                      const mx = getAgentMetrics(m.id);
                      const mProd = (mx.commissionPaid || 0) + (mx.overrideEarnedPaid || 0);
                      const lvl = AGENT_LEVELS.find(l => l.level === (m.agentLevel || 1)) || AGENT_LEVELS[0];
                      return (
                        <div key={m.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.02)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <div style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: 'var(--text-secondary)' }}>
                              {dn(m)}
                            </div>
                            <span style={{
                              padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: '600',
                              backgroundColor: 'rgba(10, 37, 64, 0.06)', color: 'var(--brand-navy)'
                            }}>
                              L{lvl.level}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <span style={{ fontSize: 'var(--text-caption)', fontWeight: '600', color: mProd > 0 ? 'var(--status-success)' : 'var(--text-secondary)' }}>
                              ${mProd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                            <button
                              onClick={() => router.push(`/dashboard/team/${m.id}`)}
                              style={{
                                padding: '2px 10px', borderRadius: '999px', border: '1px solid var(--border-color)',
                                backgroundColor: 'transparent', cursor: 'pointer', fontSize: '11px',
                                color: 'var(--brand-navy)', fontWeight: '500'
                              }}
                            >
                              View
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}

            {unassigned.length > 0 && (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>Unassigned</div>
                    <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                      {unassigned.length} agent{unassigned.length !== 1 ? 's' : ''} not assigned to an upline
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {unassigned.map(m => {
                    const lvl = AGENT_LEVELS.find(l => l.level === (m.agentLevel || 1)) || AGENT_LEVELS[0];
                    return (
                      <div key={m.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.02)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: 'var(--text-secondary)' }}>
                            {dn(m)}
                          </span>
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: '600',
                            backgroundColor: 'rgba(10, 37, 64, 0.06)', color: 'var(--brand-navy)'
                          }}>
                            L{lvl.level}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                          {(userProfile?.role === 'admin' || userProfile?.role === 'it_engineer') && !m.is_owner && (
                            <button
                              onClick={() => { setAssignManagerAgent(m); setSelectedManagerId(''); }}
                              style={{
                                padding: '2px 10px', borderRadius: '999px', border: '1px solid var(--brand-gold)',
                                backgroundColor: 'rgba(227, 169, 74, 0.08)', cursor: 'pointer', fontSize: '11px',
                                color: 'var(--brand-navy)', fontWeight: '500'
                              }}
                            >
                              Assign
                            </button>
                          )}
                          <button
                            onClick={() => router.push(`/dashboard/team/${m.id}`)}
                            style={{
                              padding: '2px 10px', borderRadius: '999px', border: '1px solid var(--border-color)',
                              backgroundColor: 'transparent', cursor: 'pointer', fontSize: '11px',
                              color: 'var(--brand-navy)', fontWeight: '500'
                            }}
                          >
                            View
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {groupedByManager.length === 0 && unassigned.length === 0 && (
              <Card style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p>No team members yet. Invite agents to build your team.</p>
              </Card>
            )}
          </div>
        );
      })()}

      {/* Assign Manager Modal */}
      {assignManagerAgent && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 10000
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setAssignManagerAgent(null); }}
        >
          <Card style={{ width: '420px' }}>
            <h3 style={{ margin: '0 0 4px 0', color: 'var(--brand-navy)', fontSize: 'var(--text-h2)' }}>
              Assign Upline
            </h3>
            <p style={{ margin: '0 0 var(--space-3) 0', color: 'var(--text-secondary)', fontSize: 'var(--text-caption)' }}>
              Assign <strong>{dn(assignManagerAgent)}</strong> to an upline.
            </p>
            <AgentSearchSelect
              items={agents.filter(a => a.id !== assignManagerAgent.id && a.status !== 'invited')}
              value={selectedManagerId}
              onChange={(id) => setSelectedManagerId(id)}
              placeholder="Search agent by name or NXT ID..."
              emptyLabel="— No Upline —"
              renderItem={(mgr) => {
                const lvl = AGENT_LEVELS.find(l => l.level === (mgr.agentLevel || 1)) || AGENT_LEVELS[0];
                return (
                  <>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#0C1022', backgroundColor: 'rgba(12, 16, 34,0.08)', padding: '2px 8px', borderRadius: '6px', fontFamily: 'monospace', flexShrink: 0 }}>
                      {mgr.nxt_id || '---'}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{dn(mgr)}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                      {mgr.is_owner ? 'Owner' : mgr.role === 'it_engineer' ? 'IT Engineer' : lvl.title}
                    </span>
                  </>
                );
              }}
              style={{ marginBottom: 'var(--space-3)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => setAssignManagerAgent(null)} disabled={isAssigning}>Cancel</Button>
              <Button
                onClick={async () => {
                  setIsAssigning(true);
                  const res = await moveAgent(userProfile.uid, assignManagerAgent.id, selectedManagerId || null);
                  if (res.success) {
                    setAssignManagerAgent(null);
                    setResendResult({
                      type: 'success',
                      message: res.noChange
                        ? 'No change needed.'
                        : `Reassigned ${dn(assignManagerAgent)}${res.descendantsUpdated > 0 ? ` (${res.descendantsUpdated} descendant paths updated)` : ''}`,
                    });
                    setTimeout(() => setResendResult(null), 5000);
                    await loadAllData();
                  } else {
                    toast.error(res.error || 'Failed to assign upline.');
                  }
                  setIsAssigning(false);
                }}
                isLoading={isAssigning}
              >
                {selectedManagerId ? 'Assign' : 'Remove Upline'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Invites Tab */}
      {activeTab === 'invites' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {visibleInvites.length === 0 ? (
            <div style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: 'var(--text-body)', marginBottom: 'var(--space-2)' }}>No invites sent yet.</p>
              <Button onClick={() => setIsInviteOpen(true)}>Send First Invite</Button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                  <th scope="col" style={thStyle}>Email</th>
                  <th scope="col" style={thStyle}>Role</th>
                  <th scope="col" style={thStyle}>Level</th>
                  <th scope="col" style={thStyle}>Status</th>
                  <th scope="col" style={thStyle}>Sent</th>
                  <th scope="col" style={thStyle}>Expires</th>
                  <th scope="col" style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleInvites.map((inv) => {
                  const isExpired = inv.status === 'pending' && new Date(inv.expires_at) < new Date();
                  const displayStatus = isExpired ? 'expired' : inv.status;
                  const canResend = displayStatus === 'expired' || displayStatus === 'pending';

                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: '500', color: 'var(--brand-navy)' }}>{inv.email}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ textTransform: 'capitalize' }}>{inv.role}</span>
                      </td>
                      <td style={tdStyle}>
                        {(() => {
                          const lvl = AGENT_LEVELS.find(l => l.level === (inv.agentLevel || 1)) || AGENT_LEVELS[0];
                          return (
                            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--brand-navy)', fontWeight: '500' }}>
                              L{lvl.level} — {lvl.title}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={tdStyle}>
                        <StatusBadge status={displayStatus} map={INVITE_STATUS} />
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 'var(--text-caption)' }}>
                        {inv.created_at ? new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ ...tdStyle, color: isExpired ? 'var(--status-error)' : 'var(--text-secondary)', fontSize: 'var(--text-caption)', fontWeight: isExpired ? 600 : 400 }}>
                        {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', flexWrap: 'wrap' }}>
                          {/* View agent profile or Link Agent — admin only */}
                          {isAdmin && (() => {
                            const matchedAgent = agents.find(a =>
                              (inv.accepted_by_uid && a.id === inv.accepted_by_uid) ||
                              a.email === inv.email ||
                              (inv.signup_email && a.email === inv.signup_email)
                            );
                            if (matchedAgent) {
                              return (
                                <button
                                  onClick={() => router.push(`/dashboard/team/${matchedAgent.id}`)}
                                  style={{
                                    padding: '4px 12px', borderRadius: '999px',
                                    border: '1px solid var(--brand-navy)', backgroundColor: 'rgba(12, 16, 34, 0.06)',
                                    cursor: 'pointer', fontSize: 'var(--text-caption)', color: 'var(--brand-navy)',
                                    fontWeight: '600', transition: 'all 0.2s ease'
                                  }}
                                >
                                  View Profile
                                </button>
                              );
                            }
                            if (inv.status === 'accepted' && userProfile?.nxt_id === 'NXT0002') {
                              if (linkingInviteId === inv.id) {
                                const linkedUids = new Set(invites.filter(i => i.accepted_by_uid).map(i => i.accepted_by_uid));
                                const unlinkedAgents = agents.filter(a =>
                                  !linkedUids.has(a.id) &&
                                  dn(a).toLowerCase().includes(linkAgentSearch.toLowerCase())
                                );
                                return (
                                  <div style={{ position: 'relative', minWidth: '200px' }}>
                                    <input
                                      type="text"
                                      placeholder="Search agent..."
                                      value={linkAgentSearch}
                                      onChange={e => setLinkAgentSearch(e.target.value)}
                                      autoFocus
                                      style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px', boxSizing: 'border-box' }}
                                    />
                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, maxHeight: '160px', overflowY: 'auto', backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                      {unlinkedAgents.length === 0 ? (
                                        <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-secondary)' }}>No unlinked agents found</div>
                                      ) : unlinkedAgents.map(a => (
                                        <div
                                          key={a.id}
                                          onClick={async () => {
                                            const res = await linkInviteToAgent(inv.id, a.id);
                                            if (res.success) {
                                              setLinkingInviteId(null);
                                              setLinkAgentSearch('');
                                              setResendResult({ type: 'success', message: `Linked ${inv.email} → ${dn(a)}` });
                                              loadAllData();
                                              setTimeout(() => setResendResult(null), 5000);
                                            } else {
                                              setResendResult({ type: 'error', message: res.error });
                                              setTimeout(() => setResendResult(null), 5000);
                                            }
                                          }}
                                          style={{ padding: '8px 10px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '2px' }}
                                        >
                                          <span style={{ fontWeight: '600', color: 'var(--brand-navy)' }}>{dn(a)}</span>
                                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{a.email}</span>
                                        </div>
                                      ))}
                                    </div>
                                    <button
                                      onClick={() => { setLinkingInviteId(null); setLinkAgentSearch(''); }}
                                      style={{ position: 'absolute', top: '6px', right: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)' }}
                                    >×</button>
                                  </div>
                                );
                              }
                              return (
                                <button
                                  onClick={() => { setLinkingInviteId(inv.id); setLinkAgentSearch(''); }}
                                  style={{
                                    padding: '4px 12px', borderRadius: '999px',
                                    border: '1px solid var(--brand-gold)', backgroundColor: 'rgba(227, 169, 74, 0.08)',
                                    cursor: 'pointer', fontSize: 'var(--text-caption)', color: 'var(--brand-navy)',
                                    fontWeight: '600', transition: 'all 0.2s ease'
                                  }}
                                >
                                  Link Agent
                                </button>
                              );
                            }
                            return null;
                          })()}
                          {canResend && (
                            <button
                              onClick={async () => {
                                setResendingId(inv.id);
                                setResendResult(null);
                                const res = await resendInvite(inv.id);
                                setResendingId(null);
                                if (res.success) {
                                  setResendResult({
                                    type: 'success',
                                    message: res.emailSent ? 'Invite resent successfully!' : (res.emailError || 'New invite link generated. Copy it below:'),
                                    link: !res.emailSent ? res.inviteLink : null,
                                  });
                                  await loadAllData();
                                } else {
                                  setResendResult({ type: 'error', message: res.error || 'Failed to resend.' });
                                }
                                setTimeout(() => setResendResult(null), 8000);
                              }}
                              disabled={resendingId === inv.id}
                              style={{
                                padding: '4px 14px', borderRadius: '999px',
                                border: '1px solid var(--border-color)', backgroundColor: 'transparent',
                                cursor: resendingId === inv.id ? 'wait' : 'pointer',
                                fontSize: 'var(--text-caption)', color: 'var(--brand-navy)',
                                fontWeight: '500', transition: 'all 0.2s ease',
                                opacity: resendingId === inv.id ? 0.5 : 1,
                              }}
                            >
                              {resendingId === inv.id ? 'Sending...' : 'Resend'}
                            </button>
                          )}
                          {(userProfile?.role === 'admin' || userProfile?.role === 'it_engineer') && displayStatus === 'pending' && (
                            <button
                              onClick={async () => {
                                setResendingId(inv.id);
                                const res = await markInviteAcceptedByEmail(inv.email);
                                setResendingId(null);
                                if (res.success) {
                                  setResendResult({ type: 'success', message: `Marked ${inv.email} as accepted` });
                                  loadAllData();
                                } else {
                                  setResendResult({ type: 'error', message: res.error || 'Failed to update' });
                                }
                                setTimeout(() => setResendResult(null), 5000);
                              }}
                              disabled={resendingId === inv.id}
                              style={{
                                padding: '4px 10px', borderRadius: '999px',
                                border: '1px solid var(--status-success)', backgroundColor: 'rgba(47, 168, 79, 0.08)',
                                cursor: resendingId === inv.id ? 'wait' : 'pointer',
                                fontSize: 'var(--text-caption)', color: 'var(--brand-navy)',
                                fontWeight: '500', transition: 'all 0.2s ease',
                                opacity: resendingId === inv.id ? 0.5 : 1,
                              }}
                            >
                              Mark Accepted
                            </button>
                          )}
                          {(userProfile?.role === 'admin' || userProfile?.role === 'it_engineer') && (
                            <button
                              onClick={() => {
                                setConfirmState({
                                  open: true,
                                  title: 'Delete Invite',
                                  message: `Delete invite for ${inv.email}?`,
                                  variant: 'danger',
                                  onConfirm: async () => {
                                    setResendingId(inv.id);
                                    const res = await deleteInvite(inv.id);
                                    setResendingId(null);
                                    if (res.success) {
                                      setResendResult({ type: 'success', message: `Deleted invite for ${inv.email}` });
                                      loadAllData();
                                    } else {
                                      setResendResult({ type: 'error', message: res.error || 'Failed to delete' });
                                    }
                                    setTimeout(() => setResendResult(null), 5000);
                                  },
                                });
                              }}
                              disabled={resendingId === inv.id}
                              style={{
                                padding: '4px 10px', borderRadius: '999px',
                                border: '1px solid var(--status-error)', backgroundColor: 'rgba(220, 53, 69, 0.08)',
                                cursor: 'pointer', fontSize: 'var(--text-caption)', color: 'var(--status-error)',
                                fontWeight: '500', transition: 'all 0.2s ease',
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <InviteAgentModal
        isOpen={isInviteOpen}
        onClose={() => { setIsInviteOpen(false); loadAllData(); }}
        userProfile={userProfile}
        agents={agents}
      />

      <ConfirmDialog
        isOpen={confirmState.open}
        title={confirmState.title}
        description={confirmState.message}
        variant={confirmState.variant}
        confirmText={confirmState.confirmLabel || 'Confirm'}
        onConfirm={() => { setConfirmState(s => ({ ...s, open: false })); confirmState.onConfirm?.(); }}
        onClose={() => setConfirmState(s => ({ ...s, open: false }))}
      />
    </div>
  );
}
