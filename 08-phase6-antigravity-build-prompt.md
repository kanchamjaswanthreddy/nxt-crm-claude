# Antigravity Build Prompt — Phase 6: Reporting & Dashboards

Paste this whole thing into Antigravity as the task. It assumes Phases 1–5 (Auth/visibility, Leads, Pipeline, Tasks, Commission Tracking) are already built and working. This phase is **read-mostly** — it should not require modifying Phase 1–5 write logic, only adding new Cloud Function triggers that listen to existing collections and new screens that read from them.

---

## Context

Insurance agency CRM (NXT Financial Group), Firebase/Firestore backend. Existing collections: `Agent` (`hierarchyPath`, `contractLevel`), `Lead` (`status`, `source`), `Deal` (`status`, `stageId`, `premiumAmount`), `Task` (`status`, `dueAt`), `Commission`, `CommissionOverride` (both with `status`, amounts).

**Reuse the existing visibility rule** for every new collection and query here: a user sees a record if they own it or the owner's `hierarchyPath` is downline of theirs.

**Reuse the existing design tokens exactly:** navy `#0F2A52`/`#1B3A6B`, blue accent `#2D6FC4`, gold `#C99A3D`/`#F2C94C` (sparse — the single YTD/headline production number on a dashboard is the right kind of place for the one gold accent per view, not chart fills generally), silver `#A9ACB1`, surfaces `#FAFAFA`/`#FFFFFF`, status colors separate from gold. All buttons full capsule (`999px`), inputs/dropdowns `12px`, cards `16px`, modals `20px`. Motion 150–250ms. Dark mode everywhere. Every async load: skeleton → data, never blank.

## Why this phase is architected around precomputed summaries, not live aggregation

Firestore cannot efficiently sum thousands of `Commission` documents on every dashboard page load, especially for a manager whose downline spans dozens of agents. **Do not write dashboard queries that sum raw transactional collections live.** Instead, maintain a precomputed per-agent summary document, updated incrementally by Cloud Function triggers as source data changes, and have dashboards/reports read from those summaries (cheap, fast, one doc per agent) rather than the underlying `Commission`/`Deal`/`Lead`/`Task` collections directly.

## 1. Schema — create this collection

```
AgentMetricsSummary
  id: `${agentId}_${period}`        // period = 'all_time' or 'YYYY-MM' for a given month
  agencyId: string
  agentId: string
  agentHierarchyPath: string
  period: string                     // 'all_time' | 'YYYY-MM'
  commissionPending: number
  commissionConfirmed: number
  commissionPaid: number
  overrideEarnedPending: number
  overrideEarnedConfirmed: number
  overrideEarnedPaid: number
  dealsWonCount: number
  dealsWonPremiumTotal: number
  dealsLostCount: number
  dealsOpenCount: number
  leadsAssignedCount: number
  leadsConvertedCount: number         // leads whose status reached 'client'
  tasksCompletedCount: number
  tasksOverdueCurrentCount: number    // snapshot at last recompute, not historical
  lastUpdatedAt: timestamp
```

Maintain **two summary docs per agent**: one with `period: 'all_time'` and one for the current `period: 'YYYY-MM'` (create a new monthly doc automatically when the month rolls over — a trigger checks the month of the event being processed and writes to the matching period doc, creating it if absent).

## 2. Cloud Function triggers to build (incremental updates, not full recomputes)

Each of these listens to an existing collection and increments the relevant fields on both the `all_time` and the current-month `AgentMetricsSummary` doc for the relevant agent(s), using atomic increments (Firestore `FieldValue.increment`), not read-then-write.

- **On `Commission` create/update** (status change): adjust `commissionPending`/`commissionConfirmed`/`commissionPaid` on the writing agent's summary — when status moves e.g. `pending → paid`, decrement the old bucket and increment the new one in the same write.
- **On `CommissionOverride` create/update**: same pattern, on the `beneficiaryAgentId`'s summary, using the `overrideEarned*` fields.
- **On `Deal` status change to `won`**: increment `dealsWonCount`, `dealsWonPremiumTotal` (+= premiumAmount), decrement `dealsOpenCount` on the deal owner's summary.
- **On `Deal` status change to `lost`**: increment `dealsLostCount`, decrement `dealsOpenCount`.
- **On `Deal` create with status `open`**: increment `dealsOpenCount`.
- **On `Lead` assignment (ownerAgentId set)**: increment `leadsAssignedCount` on the new owner's summary.
- **On `Lead` status change to `client`**: increment `leadsConvertedCount`.
- **On `Task` status change to `completed`**: increment `tasksCompletedCount` on the task owner's summary.

## 3. Nightly reconciliation job (self-healing against drift)
Build a scheduled Cloud Function (once daily, off-peak) that fully recomputes `all_time` summaries from the raw source collections for every agent and overwrites the summary doc if it differs from the incrementally-maintained value. Incremental counters can drift if a trigger fails partway; this job is the safety net. Log any agent whose recomputed value differed from the stored one by more than a trivial rounding amount, for admin visibility — silent correction is fine, but silent *unnoticed* drift is not.

## 4. Screens to build

1. **My Dashboard** (`/dashboard`, default landing page after login) — reads the viewer's own `all_time` and current-month `AgentMetricsSummary`. Cards: MTD commission (pending+confirmed+paid broken out), YTD total (this is the one gold-accented headline number), pipeline value (sum of `dealsOpenCount`-related open deals — read live from `Deal` here since it's a small, owner-scoped set, not a downline-wide sum), lead conversion rate (`leadsConvertedCount / leadsAssignedCount`). Below the cards: a simple bar or donut chart of open deals by stage, and the existing Phase 4 due/overdue task widget.

2. **Team Dashboard** (`/dashboard/team`, managers/admins only) — query `AgentMetricsSummary` docs (current month, `period` = this month) where `agentHierarchyPath` is downline of the viewer (same range-query pattern as every other visibility check), sum them for a team total header, and render a **leaderboard table**: agent name, deals won, premium total, commission total, sortable by any column. This is a small, bounded read (one doc per downline agent, not per transaction), which is exactly why the summary collection exists.

3. **Reports** (`/reports`) — a report picker with four report types, each with a date-range filter and (for managers/admins) a scope filter (self / specific downline agent / whole team):
   - **Production Report**: commission + override totals per agent, by status, for the selected range — read from `Commission`/`CommissionOverride` filtered by `createdAt` range and the visibility rule (this one does need to query raw records, since date-range slicing isn't something the monthly summary buckets support precisely — acceptable because reports are an explicit, occasional action, not a page loaded on every dashboard visit).
   - **Pipeline Report**: open deals by stage and by agent, with average days-in-stage (derived from `DealStageHistory`).
   - **Lead Conversion Report**: leads grouped by `source`, showing count assigned vs. count converted to `client`, as a conversion-rate table — this is what tells an admin whether purchased leads or referrals actually convert better.
   - **Agent Activity Report**: tasks completed, deals moved, commissions earned per agent over the range — a simple production/activity leaderboard for a specific date window.
   Each report has a **CSV export** button; for any report whose result set could be large (e.g., "all time, whole agency"), run the export via a Cloud Function that generates the file and returns a download link rather than building a huge CSV client-side and freezing the browser tab.

## 5. Firestore Security Rules to add
- `AgentMetricsSummary`: readable if `agentId == request.auth.uid` OR requester's `hierarchyPath` is a prefix of `agentHierarchyPath`. **No client writes permitted at all** — this collection is Cloud-Function-only; deny all client-side create/update/delete in rules.
- Reports queries against `Commission`/`CommissionOverride`/`Deal`/`Lead`/`Task` for date-range slicing reuse the exact same visibility rules already defined in Phases 2–5 — do not create a parallel, looser rule for reporting convenience.

## 6. Error states to implement and manually verify before calling this done
- [ ] A brand-new agent with zero activity sees a clean empty-state dashboard ("No production yet — once you close your first deal, it'll show up here"), not a broken chart or a page full of zeros with no context
- [ ] Team Dashboard for a manager with zero downline agents shows an appropriate empty state, not an error
- [ ] Incremental counters never go negative (e.g., a commission moving `paid → chargeback` correctly decrements `commissionPaid` and increments a chargeback-tracking path rather than allowing an unhandled status transition to silently corrupt totals) — chargebacks should decrement the bucket they were counted in, not just disappear
- [ ] Nightly reconciliation job correctly corrects a deliberately-induced drift (test by manually editing a summary doc's number, then running the job, and confirming it's corrected and logged)
- [ ] Date-range report queries handle an invalid range (end before start) with a clear inline validation error before querying
- [ ] CSV export correctly escapes commas/quotes in text fields (agent names, notes) so the file doesn't break when opened in Excel/Sheets
- [ ] Large CSV export (whole-agency, all-time) does not freeze the browser — generated server-side with a download link, not built in-memory client-side
- [ ] Leaderboard sort works correctly on ties (stable secondary sort, e.g. by name) rather than jumping order unpredictably
- [ ] An agent cannot access `/dashboard/team` or any report scoped beyond their own data by manipulating the URL — route guards check role, and the underlying queries are additionally protected by Security Rules regardless of what the UI allows
- [ ] All charts render a clear "no data yet" state rather than an empty/broken chart when the underlying dataset is empty

## 7. Definition of done
- `AgentMetricsSummary` docs update correctly and near-instantly as commissions, deals, leads, and tasks change
- Nightly reconciliation catches and logs drift
- My Dashboard and Team Dashboard both load fast (reading only summary docs, not raw transactional data) and respect the visibility rule
- All four reports produce correct, exportable data scoped correctly to the viewer's permissions
- Every checklist item in section 6 manually triggered and confirmed

This phase completes the core functional scope matching Experior's feature set. What remains is Phase 7/8 in the original roadmap — permissions hardening, security review, and deployment — which is an operational/security pass rather than new user-facing features.
