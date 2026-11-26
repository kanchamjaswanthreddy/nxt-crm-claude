# Hierarchy Data Model — Phase 0 Findings

## Agent Fields (on `agents/{uid}`)

| Field | Type | Purpose |
|-------|------|---------|
| `upline_id` | `string \| null` | Direct parent agent UID. Used to build the tree. `null` = top-level (owner/unassigned). |
| `hierarchyPath` | `string` | Slash-delimited path from root to this agent, e.g. `"/OWNER_UID/MGR_UID/AGENT_UID"`. Used for prefix-match visibility: `startsWith(myPath + '/')` means "is my downline". |

### How `hierarchyPath` is set today

- **`assignAgentToManager`** (`src/app/actions/agents.js:371-378`): Sets `upline_id` and computes `hierarchyPath = (manager.hierarchyPath || '/' + managerId) + '/' + agentId`. **Only updates the moved agent — does NOT cascade to descendants.**
- **Invite acceptance** (`src/app/actions/invite.js:289-305`): Reads upline's `hierarchyPath` from inviter doc and sets `parentHierarchyPath` on the invite, which flows into the new agent during onboarding.
- **Signup** (`src/app/auth/signup/page.js:72`): Sets `upline_id: null` (owner bootstrap).

---

## Collections that COPY hierarchy paths (denormalized)

Every record below stores a snapshot of the owner/agent's `hierarchyPath` at creation time. If an agent moves, **these stale copies are NOT updated**.

| Collection | Field | Set by |
|------------|-------|--------|
| `leads` | `ownerHierarchyPath` | `leads.js` — createLead, reassignLead, assignLead, round-robin |
| `deals` | `ownerHierarchyPath` | `deals.js` — createDeal |
| `tasks` | `ownerHierarchyPath` | `tasks.js` — createTask; `TaskQuickAddModal.js` |
| `clients` | `agentHierarchyPath` | `clients.js` — createClient |
| `commissions` | `agentHierarchyPath` | `commissions.js` — from carrier statement matching |
| `commissionOverrides` | `beneficiaryHierarchyPath` | `deals.js` — upline override walk |
| `AgentMetricsSummary` | `agentHierarchyPath` | `metrics.js` — incrementAgentMetrics |
| `additionalCommissions` | `agentHierarchyPath` | `additionalCommissions.js` |
| `agentContracts` | `agentHierarchyPath` | `contracts.js` |

---

## Firestore Security Rules using `hierarchyPath`

All visibility rules follow the same pattern: `resource.data.<fieldName>.startsWith(getAgentData().hierarchyPath + '/')`.

| Collection | Hierarchy field checked | Rule |
|------------|------------------------|------|
| `leads` | `ownerHierarchyPath` | `canAccessLead()` — line 52 |
| `deals` | `ownerHierarchyPath` | `canAccessDeal()` — line 97 |
| `tasks` | `ownerHierarchyPath` | `canAccessTask()` — line 144 |
| `commissions` | `agentHierarchyPath` | line 182 |
| `commissionOverrides` | `beneficiaryHierarchyPath` | line 191 |
| `AgentMetricsSummary` | `agentHierarchyPath` | line 209 |
| `clients` | `agentHierarchyPath` | `canAccessClient()` — line 250 |

---

## Server-side visibility checks (app-level)

Same prefix-match pattern in server actions:

| File | Function | Uses |
|------|----------|------|
| `deals.js` | `fetchDeals` | `ownerHierarchyPath.startsWith(hierarchyPath + '/')` |
| `leads.js` | `fetchLeads` | same pattern |
| `tasks.js` | `fetchTasks` | same pattern |
| `commissions.js` | `fetchCommissions` | `agentHierarchyPath.startsWith(...)` |
| `commissions.js` | `fetchCommissionOverrides` | `beneficiaryHierarchyPath.startsWith(...)` |
| `clients.js` | `fetchClients` | `agentHierarchyPath.startsWith(...)` |
| `reports.js` | `canSeeDeal`, `canSeeLead` | same pattern |
| `deals-data.js` | `canSeeDeal` | same pattern |
| `dashboard-v2.js` | `canSeeDeal` | same pattern |
| `TaskQuickAddModal.js` | deal/lead visibility | same pattern |
| `team/page.js:1082` | metrics visibility | `agentHierarchyPath.startsWith(profile.hierarchyPath + '/')` |
| `commissions/[id]/page.js` | commission detail access | same pattern |
| `api/reports/export/route.js` | report export | same pattern |

---

## Commission override walk (upline chain)

`deals.js` lines 336-386: When a deal is won, walks `uplineId` up the chain to compute commission overrides. Each override stores `beneficiaryHierarchyPath` from the upline's agent doc at that moment.

---

## What `buildTree` uses (org chart)

`team/page.js:301-319`: Builds the tree purely from `upline_id` (not `hierarchyPath`). The `hierarchyPath` is not used for rendering the tree — only `upline_id` parent-child relationships matter.

---

## Critical gaps for `moveAgent`

1. **No descendant cascade**: `assignAgentToManager` only updates the moved agent's `hierarchyPath`. All descendants keep their old paths. This means visibility breaks for the subtree after a move.

2. **No denormalized record updates**: The 9 collections above store stale `hierarchyPath` snapshots. After a move, an agent's old upline can still see their old records (path still matches), and the new upline cannot see them (path doesn't match their prefix).

3. **No cycle detection**: Nothing prevents assigning an agent under their own descendant.

4. **No audit trail**: No logging of hierarchy changes.

5. **`hierarchyPath` format**: Uses `/UID/UID/UID` format. The leading slash is inconsistent — some code does `'/' + managerId`, others assume it's already there.

---

## Summary: What `moveAgent` must do

When agent A is moved under new parent B:

1. **Validate**: No cycles (B is not a descendant of A), both agents exist, caller is admin
2. **Update agent A**: Set `upline_id = B.id`, compute new `hierarchyPath = B.hierarchyPath + '/' + A.id`
3. **Cascade descendants**: Find all agents whose `hierarchyPath` starts with A's OLD path, rewrite their `hierarchyPath` by replacing the old prefix with the new one
4. **Update denormalized records** (optional/deferred): The 9 collections with stale paths. This is expensive and may be better handled via a background job or accepted as eventual consistency.
5. **Log the move**: Write to `hierarchyMoves` collection for audit
