# Antigravity Build Prompt — Phase 5: Commission Tracking

Paste this whole thing into Antigravity as the task. It assumes Phases 1–4 (Auth/visibility, Leads, Pipeline including the `onDealWon` hook stub in `dealAutomationHooks.ts`, Tasks) are already built and working. Do not modify Phase 1–4 logic except for the two explicitly flagged touch points in section 2 and section 5 below.

---

## Context

Insurance agency CRM (NXT Financial Group), Firebase/Firestore backend. Existing entities: `Agency`, `Agent` (`hierarchyPath`, `role`, `uplineId`), `Lead`, `Deal` (`ownerAgentId`, `policyType`, `premiumAmount`, `status`, `policyNumber`), `PipelineStage`, `Task`. A stub function `onDealWon({ deal })` already exists in `dealAutomationHooks.ts`, firing when a deal's status becomes `'won'` and `policyNumber` is set, currently a no-op.

This is the most domain-specific phase — insurance IMOs pay commissions on a **level-differential override model**: each contract level has a total commission percent for a given carrier/product, and an upline agent's override is the *difference* between their level's percent and the percent of the level directly below them in the chain — not a flat stacked bonus. Build exactly this model, described in full in section 4.

**Reuse the existing visibility rule** for all new collections: a user can see a record if `record.ownerAgentId == me.id` (or, for overrides, `record.beneficiaryAgentId == me.id`) OR the record owner's `hierarchyPath` starts with `me.hierarchyPath + "/"`.

**Reuse the existing design tokens exactly:** navy `#0F2A52` / `#1B3A6B`, blue accent `#2D6FC4`, gold `#C99A3D` / `#F2C94C` (sparse accents only — commission totals are a good candidate for one tasteful gold highlight, e.g. the YTD total figure, but not the whole page), silver `#A9ACB1`, surfaces `#FAFAFA` / `#FFFFFF`, status colors separate from gold (success green `#2FA84F`, warning-amber `#E08E2B`, error red `#D33F3F`). All buttons full capsule (`999px`), icon buttons circles (`50%`), inputs/dropdowns `12px`, cards `16px`, modals `20px`, badges `999px`. Motion 150–250ms. Dark mode required everywhere. Every async action: idle → loading (skeleton) → success/error.

## Goal for this phase

Build: carrier and commission-rate configuration, the level-differential override calculation engine wired into `onDealWon`, per-agent commission views (own + override earnings), and a carrier-statement import/reconciliation workflow for matching actual carrier payouts against expected commissions.

## 1. Schema — create these Firestore collections

```
Carrier
  id (doc id)
  agencyId: string
  name: string
  notes: string | null
  active: boolean
  createdAt

CommissionRate
  id (doc id)
  agencyId: string
  carrierId: string
  policyType: 'life' | 'health' | 'annuity' | 'disability' | 'final_expense' | 'other'
  agentLevel: string          // e.g. "Level 1", "Level 2", "Level 3" — must match Agent.contractLevel values
  commissionPercent: number   // total contracted % for this level, this carrier, this product
  effectiveDate: string       // ISO date; use the most recent rate with effectiveDate <= today when calculating
  createdAt

Commission
  id (doc id)
  agencyId: string
  dealId: string
  agentId: string                    // the writing agent (Deal.ownerAgentId)
  agentHierarchyPath: string
  carrierId: string
  policyType: string
  premiumAmount: number               // snapshot at time of creation
  commissionRatePercent: number       // snapshot of the rate used — never recalculated retroactively if rates change later
  commissionAmount: number | null     // premiumAmount * commissionRatePercent / 100; null if needsRateReview
  needsRateReview: boolean            // true if no matching CommissionRate was found
  status: 'pending' | 'confirmed' | 'paid' | 'chargeback' | 'void'
  matchedStatementLineId: string | null
  expectedPayDate: string | null
  actualPaidDate: string | null
  actualPaidAmount: number | null
  createdAt, updatedAt

CommissionOverride
  id (doc id)
  agencyId: string
  originatingCommissionId: string     // the base Commission this override is derived from
  dealId: string
  beneficiaryAgentId: string          // the upline agent earning this override
  beneficiaryHierarchyPath: string
  overridePercent: number             // the differential, not the full level rate
  overrideAmount: number
  status: 'pending' | 'confirmed' | 'paid' | 'chargeback' | 'void'   // mirrors parent Commission status via the same status-update flow
  createdAt, updatedAt

CarrierStatement
  id (doc id)
  agencyId: string
  carrierId: string
  fileName: string
  uploadedByAgentId: string
  periodStart: string | null
  periodEnd: string | null
  status: 'processing' | 'needs_review' | 'reconciled'
  createdAt

CarrierStatementLine
  id (doc id)
  carrierStatementId: string
  policyNumber: string
  paidAmount: number
  paidDate: string
  matchedCommissionId: string | null
  matchStatus: 'matched' | 'unmatched' | 'disputed'
  rawRowData: object          // original row, for audit
```

## 2. Touch point A — extend `Agent`
Add `contractLevel: string | null` to `Agent` (must match a `CommissionRate.agentLevel` value to calculate correctly). Build an admin screen (`/settings/agent-levels`) to assign/change each agent's `contractLevel`. This is additive to the existing `Agent` doc — do not alter any Phase 1 auth/role logic.

## 3. Touch point B — extend `Deal` and the Won modal (from Phase 3)
Add `carrierId: string | null` to `Deal`. In the existing Phase 3 "mark as Won" modal (which currently requires `policyNumber` + `premiumAmount`), add a required `carrierId` dropdown (select from active `Carrier` docs for the agency) — the Won transaction cannot commit without it, same gating pattern already used for `policyNumber`. This is the only change to Phase 3 pipeline code; do not touch drag-and-drop, stage-history, or the automation hook mechanism itself.

## 4. Commission + override calculation — implement the `onDealWon` hook body

Replace the no-op in `dealAutomationHooks.ts` with, inside a single Firestore transaction:

**Step 1 — base commission for the writing agent:**
1. Look up the writing agent's `contractLevel`. If null, create the `Commission` with `needsRateReview: true`, `commissionAmount: null`, `status: 'pending'`, and stop — flag for admin, do not block the deal win.
2. Query `CommissionRate` where `carrierId == deal.carrierId`, `policyType == deal.policyType`, `agentLevel == writingAgent.contractLevel`, `effectiveDate <= today`, ordered by `effectiveDate` descending, take the first result.
3. If no rate found: same `needsRateReview: true` flagging as step 1.
4. Otherwise: create `Commission` with `commissionRatePercent` = that rate's `commissionPercent`, `commissionAmount = premiumAmount * commissionRatePercent / 100`, `status: 'pending'`.

**Step 2 — walk the upline chain for overrides:**
1. Set `currentAgent = writingAgent`, `currentLevelPercent = the rate found in Step 1` (0 if `needsRateReview` was true — overrides still calculate off whatever floor exists, but flag them too if the base was unresolved).
2. Walk `currentAgent.uplineId` up the chain, one agent at a time, until reaching an agent with no `uplineId` (top of the agency):
   - For the upline agent, look up their `contractLevel`, then their `CommissionRate` for the same `carrierId` + `policyType` (same lookup as Step 1).
   - If the upline has no matching rate or no `contractLevel`, skip them (no override created) but continue walking further up the chain.
   - If the upline's rate percent is **greater than** `currentLevelPercent`: create a `CommissionOverride` with `overridePercent = uplineRatePercent - currentLevelPercent`, `overrideAmount = premiumAmount * overridePercent / 100`, `beneficiaryAgentId = uplineAgent.id`, `status: 'pending'`. Update `currentLevelPercent = uplineRatePercent` before continuing up the chain (each subsequent override is relative to the level just below it, not back to the original writing agent).
   - If the upline's rate percent is **less than or equal to** `currentLevelPercent`: no override for them, but still continue walking up (a differently-configured upline further up the chain may still have a higher rate).
3. This produces zero or more `CommissionOverride` records, one per level-step where the rate actually increases going up the chain.

**Idempotency**: perform this entire calculation inside the same transaction as the deal's won-status write (called from the Won modal confirm action in Phase 3's now-extended code), so it cannot double-fire on a retried write.

## 5. Screens to build

1. **My Commissions** (`/commissions`) — tabs: "My Sales" (own `Commission` records) and "Overrides" (`CommissionOverride` records where `beneficiaryAgentId == me`). Summary header: total pending, confirmed, and paid — this month and YTD (YTD figure gets the one tasteful gold accent per the design note above). List filterable by status/carrier/date, each row linking to the originating `Deal`.
2. **Commission detail** — shows the calculation breakdown plainly (premium × rate% = amount), status, linked deal, and — for overrides — which agent's sale generated it.
3. **Team Commissions** (managers/admins) — same as My Commissions but scoped to the viewer's downline via the visibility rule, useful for a manager auditing their team's production.
4. **Carrier & rate management** (`/settings/commissions`, admin-only) — CRUD for `Carrier` list, and a rate-schedule table/editor for `CommissionRate` (carrier × policyType × agentLevel × percent × effective date). Support adding a new rate with a future `effectiveDate` without deleting the old one (historical commissions must keep referencing their snapshot rate, never the current one).
5. **Needs Review queue** (admin-only) — list of `Commission` docs where `needsRateReview == true`, with an action to manually set the rate/amount and clear the flag (this manual override also snapshots into `commissionRatePercent`/`commissionAmount` on that record, same as the automated path).
6. **Carrier statement import** (`/commissions/import`, admin-only) — multi-step: (1) select carrier + upload CSV, (2) map columns to `policyNumber`/`paidAmount`/`paidDate`, (3) auto-match: for each row, find the `Deal` with matching `policyNumber`, then its `Commission`, and set `matchStatus: 'matched'` + populate `matchedCommissionId`; rows with no matching policy number get `matchStatus: 'unmatched'`, (4) review screen showing matched/unmatched counts, with manual search-and-link for unmatched rows, (5) confirm — on confirm, matched commissions get `status: 'paid'`, `actualPaidAmount`, `actualPaidDate` set from the statement line, and any linked `CommissionOverride` records for that deal move to `'paid'` too (paid status cascades from the base commission to its overrides).

## 6. Firestore Security Rules to add
- `Commission`: readable if `agentId == request.auth.uid` OR requester's `hierarchyPath` is a prefix of `agentHierarchyPath`. Writable only via server-side logic (Cloud Functions) for the automated path; manual admin edits (Needs Review queue) restricted to `role == 'admin'`.
- `CommissionOverride`: readable if `beneficiaryAgentId == request.auth.uid` OR requester's `hierarchyPath` is a prefix of `beneficiaryHierarchyPath`. Same write restriction as `Commission`.
- `Carrier`, `CommissionRate`: read open to all agents in the agency (needed for the Won modal's carrier dropdown and rate display), write restricted to `role == 'admin'`.
- `CarrierStatement`, `CarrierStatementLine`: full access restricted to `role == 'admin'`.

## 7. Error states to implement and manually verify before calling this done
- [ ] Won modal cannot commit without selecting a `carrierId` (mirrors existing `policyNumber` gating)
- [ ] Missing `contractLevel` or missing matching `CommissionRate` correctly flags `needsRateReview: true` instead of crashing or silently producing a zero/null commission that looks paid
- [ ] Override chain calculation correctly stops crediting a level whose rate is not higher than the level below it, while still continuing to check further up the chain
- [ ] Override chain terminates cleanly at an agent with no upline (top of agency) without error
- [ ] Adding a new `CommissionRate` with a future `effectiveDate` does not alter `commissionRatePercent`/`commissionAmount` on already-created `Commission` records
- [ ] CSV import with unmatched `policyNumber` rows does not crash the import — they land in the review step as `unmatched`, resolvable manually
- [ ] Confirming a statement import correctly cascades `'paid'` status from a `Commission` to all its linked `CommissionOverride` records
- [ ] A manager/admin resolving a Needs Review commission snapshots the rate correctly and it never silently recalculates later
- [ ] An agent cannot view another agent's `Commission` or `CommissionOverride` outside their downline (verify via direct SDK read — expect permission-denied)
- [ ] All list/detail screens show skeleton loading, never a blank screen, and a clear empty state when no commissions exist yet

## 8. Definition of done
- Marking a deal Won with a carrier selected correctly generates the writing agent's `Commission` and the correct chain of `CommissionOverride` records per the level-differential model
- Admins can manage carriers, rate schedules (with historical versioning via effective dates), and agent contract levels
- The Needs Review queue catches every case where automated calculation couldn't resolve a rate
- Carrier statement CSV import correctly auto-matches by policy number, surfaces unmatched rows for manual resolution, and cascades paid status to overrides on confirmation
- Every checklist item in section 7 manually triggered and confirmed
- Visibility rule verified: managers see downline commissions/overrides, agents see only their own

Do not build the reporting/dashboard rollups (aggregate income charts, team performance dashboards) in this phase — that is Phase 7 scope, which will read from the `Commission`/`CommissionOverride` data built here.
