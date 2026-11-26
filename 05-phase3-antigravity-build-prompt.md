# Antigravity Build Prompt — Phase 3: Pipeline

Paste this whole thing into Antigravity as the task. It assumes Phase 1 (Firebase Auth, multi-tenant agency/agent structure, Firestore security rules, hierarchyPath visibility) and Phase 2 (Leads: schema, screens, assignment logic) are already built and working. Do not modify Phase 1 or Phase 2 logic — only extend the schema, rules, and app as specified below.

---

## Context

Insurance agency CRM (NXT Financial Group), Firebase/Firestore backend. Existing entities: `Agency`, `Agent` (`agencyId`, `uplineId`, `role`: admin/manager/agent, `hierarchyPath`), `Lead` (with `ownerAgentId`, `ownerHierarchyPath`, `status`, etc.).

**Reuse the existing visibility rule, do not reinvent it**: a user can see a record if `record.ownerAgentId == me.id` OR `record.ownerHierarchyPath` starts with `me.hierarchyPath + "/"`. Enforce in both Firestore Security Rules and app-level queries, exactly as done for `Lead` in Phase 2.

**Reuse the existing design tokens exactly, introduce nothing new:**
- Colors: navy `#0F2A52` (primary/nav/buttons), navy-light `#1B3A6B`, blue accent `#2D6FC4` (links), gold `#C99A3D` (sparse accents/badges only — never a full background, never more than one standout element per screen), gold-light `#F2C94C`, silver `#A9ACB1` (borders/dividers/secondary/neutral UI), surface page `#FAFAFA`, surface card `#FFFFFF`. Status colors stay separate from gold: success green `#2FA84F`, warning-amber `#E08E2B`, error red `#D33F3F`.
- Typography: system font stack (`-apple-system, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif`), calm hierarchy.
- **All buttons are full capsule/pill shape (`border-radius: 999px`)**, icon-only buttons are perfect circles (`50%`). Inputs/dropdowns `12px` radius. Cards `16px`. Modals `20px`. Badges/status pills `999px`. No sharp corners anywhere.
- Motion: 150–250ms ease-in-out only, respect `prefers-reduced-motion`.
- Every async action: idle → loading (skeleton/spinner, never blank) → success/error feedback.
- Dark mode required on every screen (navy background inverts to `#12203A`, gold/silver unchanged).
- WCAG AA contrast, full keyboard navigation, proper labels/aria-labels.

## Goal for this phase

Build the full Pipeline module: `PipelineStage` and `Deal` schema, the kanban board with drag-and-drop, stage history tracking, gated Won/Lost transitions, pipeline settings, and automation hooks (empty/placeholder implementations Phase 4 and Phase 5 will fill in — but the hook call sites must exist and fire correctly now). Do not build task auto-creation or commission record creation logic itself — only the hook call sites.

## 1. Schema — create these Firestore collections

```
PipelineStage
  id (doc id)
  agencyId: string
  name: string
  order: number
  isWonStage: boolean
  isLostStage: boolean
  createdAt: timestamp

Deal
  id (doc id)
  agencyId: string
  leadId: string | null
  ownerAgentId: string
  ownerHierarchyPath: string
  stageId: string
  policyType: 'life' | 'health' | 'annuity' | 'disability' | 'final_expense' | 'other'
  premiumAmount: number | null
  expectedCloseDate: string | null   // ISO date
  status: 'open' | 'won' | 'lost'
  lostReason: string | null
  policyNumber: string | null
  createdAt, updatedAt: timestamp
  stageChangedAt: timestamp

DealStageHistory
  id (doc id)
  dealId: string
  fromStageId: string | null   // null on initial creation
  toStageId: string
  changedByAgentId: string
  changedAt: timestamp
```

On agency creation (or as a migration for existing agencies), seed default `PipelineStage` docs in this order: `New`, `Contacted`, `Appointment Set`, `Application Submitted`, `Underwriting`, `Closed Won` (`isWonStage: true`), `Closed Lost` (`isLostStage: true`).

## 2. Screens to build

1. **Pipeline board** (`/pipeline`) — one column per `PipelineStage` ordered by `order`, scoped to viewer's visibility (self + downline deals only). Column header shows stage name, deal count, sum of `premiumAmount` in that column. Deal cards show contact name (from linked Lead or Deal's own fields), `policyType` as a capsule badge, `premiumAmount`, and days since `stageChangedAt`. Horizontal scroll on narrow viewports, do not compress columns.

2. **Deal detail** (`/deals/:id`) — full deal fields (editable inline where sensible), a `DealStageHistory` timeline (chronological, newest first), link back to originating `Lead` if present.

3. **Add deal** (`/deals/new`) — manual creation form. Also add a "Convert to Deal" button on the existing Lead detail page (Phase 2) that pre-fills `leadId`, contact info, and creates the Deal in the `New` stage — this is the only touch point allowed on Phase 2 code, adding a button/action, not altering Lead logic.

4. **Pipeline settings** (`/settings/pipeline`) — admin-only. Rename stages, reorder (drag or up/down controls), add new stages, archive a stage (soft-delete: hidden from the board but historical deals/history referencing it remain valid), toggle `isWonStage`/`isLostStage` flags. Deleting/archiving a stage that still has open `Deal`s in it must be blocked with a message prompting the admin to move those deals first.

## 3. Kanban drag-and-drop behavior (implement exactly this)
- Dragging a card to a new column updates the UI **optimistically** (card moves immediately, before the write confirms).
- The actual write: update `Deal.stageId`, `Deal.stageChangedAt`, and create a new `DealStageHistory` row — all in a single Firestore transaction.
- If the transaction fails, animate the card back to its original column and show an inline error toast with a retry option. The UI must never be left showing a stage the backend rejected.
- **Dropping into a column where `isWonStage == true`**: before the transaction commits, open a modal requiring `policyNumber` (text, required) and confirming/entering final `premiumAmount` if not already set. Cancel returns the card to its prior column with no write. Confirm commits the transaction and additionally sets `Deal.status = 'won'`.
- **Dropping into a column where `isLostStage == true`**: before the transaction commits, open a modal requiring `lostReason` — dropdown (`price`, `went_with_competitor`, `unqualified`, `unresponsive`, `other`) plus a free-text field shown when `other` is selected. Cancel returns the card to its prior column with no write. Confirm commits the transaction and sets `Deal.status = 'lost'`.
- Concurrent moves on the same deal (two clients acting near-simultaneously): use a Firestore transaction so the second write reads the latest state; if the deal has already moved since the client's last render, refresh that client's card to the true current stage rather than allowing a stale overwrite.

## 4. Automation hook call sites (build the call sites now; leave the handler bodies as a documented no-op / TODO for Phase 4 and Phase 5 to fill in)
- After every successful stage-change transaction, call `onDealStageChanged({ deal, fromStageId, toStageId, changedByAgentId })`. Implement this as an exported function stub in its own module (e.g. `dealAutomationHooks.ts`) so Phase 4 can add task-creation logic there without touching pipeline board code.
- After a deal's `status` becomes `'won'` AND `policyNumber` is set, call `onDealWon({ deal })` — same pattern, stub in the same module, for Phase 5 (commission record creation) to fill in later.

## 5. Firestore Security Rules to add
- `Deal` reads/writes: same visibility pattern as `Lead` — allowed only if `ownerAgentId == request.auth.uid` OR requester's `hierarchyPath` is a prefix match of `resource.data.ownerHierarchyPath`.
- Writes to `Deal` must reject if attempting to set `status: 'won'` without a non-empty `policyNumber`, or `status: 'lost'` without a non-empty `lostReason` — mirror this validation in rules, not just the client, since rules are the real gate.
- `PipelineStage` writes (create/update/archive) restricted to `role in ['admin']` for that `agencyId`. Reads open to any agent in the agency (needed to render the board).
- `DealStageHistory`: create-only from the client (never update/delete), readable under the same visibility rule as the parent `Deal`.

## 6. Error states to implement and manually verify before calling this done
- [ ] Drag-and-drop failure rolls the card back visually with a specific, actionable error message
- [ ] Won transition cannot commit without `policyNumber`
- [ ] Lost transition cannot commit without `lostReason`
- [ ] Cancelling either modal leaves the deal in its original stage with no partial write
- [ ] Two concurrent stage-move attempts on the same deal never produce a corrupted/lost history entry — verify with a concurrent-write test
- [ ] Deleting/archiving a `PipelineStage` with open deals still in it is blocked with a clear message
- [ ] Reordering stages does not change any existing `Deal.stageId` references
- [ ] A manually-created deal (no `leadId`) passes the same required-field validation as a lead-converted one
- [ ] An agent cannot view, drag, or query a `Deal` outside their downline (verify via direct SDK read attempt — expect permission-denied)
- [ ] Board renders correct skeleton/loading state on initial load and on slow connections, never a blank screen

## 7. Definition of done
- Board renders all stages in order, correctly scoped to viewer visibility, with accurate per-column counts and premium totals
- Drag-and-drop works smoothly with optimistic updates and correct rollback on failure
- Won/Lost transitions are fully gated as specified, enforced in both UI and Security Rules
- Full stage history is recorded and viewable per deal
- Pipeline settings allow stage customization without breaking existing deals or history
- `onDealStageChanged` and `onDealWon` hook call sites exist, fire at the correct moments, and are ready for Phase 4/5 to implement

Do not build task auto-creation or commission record logic in this phase — only the hook call sites described above. That is Phase 4 and Phase 5 scope.
