# NXT CRM — Forms Audit Report

## Priority 1: Forms That Cannot Be Submitted At All

### F1. Deal Creation — Stage dropdown empty
**Form:** New Deal (`src/app/dashboard/deals/new/page.js:99-109`)
**Root cause:** `fetchPipelineStages` in `src/app/actions/pipeline.js:53-55` uses `.where('agencyId', '==', agencyId).orderBy('order', 'asc')` — this compound query requires a **composite Firestore index** on `pipelineStages(agencyId ASC, order ASC)` that does not exist. The query throws `FAILED_PRECONDITION`, the catch block returns `{ success: false }`, and the page renders an empty dropdown.
**Impact:** Deal creation is completely blocked. No deals can be created.
**Fix:**
1. Create the composite index: `pipelineStages` → `agencyId ASC, order ASC`
2. Stages already exist (7 docs for this agency, seeded previously). No data seeding needed.
**Verification URL:** `https://console.firebase.google.com/v1/r/project/nxt-crm-6b71f/firestore/indexes?create_composite=ClRwcm9qZWN0cy9ueHQtY3JtLTZiNzFmL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9waXBlbGluZVN0YWdlcy9pbmRleGVzL18QARoMCghhZ2VuY3lJZBABGgkKBW9yZGVyEAEaDAoIX19uYW1lX18QAQ`

### F2. Task Automation — Trigger stage dropdown empty (same root cause)
**Form:** Task Automation rule modal (`src/app/dashboard/settings/task-automation/page.js`)
**Root cause:** Same as F1 — calls `fetchPipelineStages` which fails due to missing index.
**Impact:** Cannot create task automation rules.
**Fix:** Same index as F1 fixes this.

---

## Priority 2: Fields That Save the Wrong Value or Don't Save

### F3. Lead edit — client-side write with no error display
**Form:** Lead detail edit (`src/app/dashboard/leads/[id]/page.js:96`)
**Root cause:** Uses direct client `updateDoc` on `leads/{id}`. Firestore rules require `hasValidLeadFields` (firstName, lastName, email or phone must be non-empty) but the form has no validation — fields are not marked required. If a user clears firstName and saves, the Firestore write silently fails.
**Error display:** Only `console.error` — user sees nothing.
**Loading state:** None on the Save button.
**Fix:** Move to server action; add validation; show errors and loading state.

### F4. Unassigned leads — client-side write with no loading/error
**Form:** Unassigned leads assign (`src/app/dashboard/leads/unassigned/page.js:65`)
**Root cause:** Uses direct client `updateDoc` on `leads/{leadId}`. Same Firestore rules issue — updating `ownerAgentId` requires the full document to still pass `hasValidLeadFields`. The `updateDoc` only sends partial fields so it may fail if the lead doc is missing required fields.
**Error display:** `alert()` only.
**Loading state:** None — user can double-fire.
**Fix:** Move to server action with Admin SDK.

### F5. Client detail edit — no error display, no loading
**Form:** Client detail edit (`src/app/dashboard/clients/[id]/page.js`)
**Root cause:** `updateClient` server action is called, but the result is not checked — if it fails, the user sees nothing.
**Loading state:** None on the Save button.
**Fix:** Check result and show error; add loading state.

### F6. Policy add/edit — no error display
**Form:** Client detail policy modal (`src/app/dashboard/clients/[id]/page.js`)
**Root cause:** `addPolicy` / `updatePolicy` server actions are called, but errors are not surfaced to the user.
**Fix:** Show error message in the modal.

---

## Priority 3: Selects With Empty Sources That Need Seeding

### F7. Pipeline stages — already seeded ✅
**Collection:** `pipelineStages` — 7 docs exist for this agency.
**Status:** Data exists. Only the index is missing (F1).

### F8. Carriers — already populated ✅
**Collection:** `carriers` — 150 docs exist for this agency.
**Status:** No action needed.

### F9. Commission rates — empty (0 docs)
**Collection:** `commissionRates`
**Impact:** Commission calculations during deal stage changes will silently find no matching rate. Not blocking form submission but commissions won't calculate.
**Fix:** Not a form bug — admin needs to configure rates via Settings → Commissions.

### F10. Stage task templates — empty (0 docs)
**Collection:** `stageTaskTemplates`
**Impact:** No auto-tasks will be created when deals move through pipeline.
**Fix:** Not a form bug — admin needs to configure via Settings → Task Automation (which is blocked by F2 until the index is created).

---

## Priority 4: Missing Validation or Error Display

### F11. Pipeline settings — client-side addDoc
**Form:** Add stage (`src/app/dashboard/settings/pipeline/page.js:48`)
**Root cause:** Uses direct client `addDoc` on `pipelineStages`. Firestore rules allow this for admins (`role == 'admin'`), but the user's agent doc may have `role == 'it_engineer'` or `is_owner == true` without `role == 'admin'`, causing a permission failure.
**Fix:** Move `handleAddStage` to a server action using Admin SDK (like the existing `updatePipelineStage` and `archivePipelineStage`).

### F12. Business documents upload — client-side addDoc + storage upload
**Form:** Upload document (`src/app/dashboard/business/documents/page.js:75`)
**Root cause:** Uses direct client `addDoc` on `agentDocuments` + client-side Firebase Storage upload. This works per Firestore rules (`agentId == auth.uid` for create), but error handling is alert-only.
**Status:** Low priority — functionally works for the common case.

### F13. Team member level change — no loading guard
**Form:** Team detail level select (`src/app/dashboard/team/[id]/page.js`)
**Root cause:** `updateAgentContractLevel` fires directly on `onChange` with no debounce or loading state. User can fire multiple rapid changes.
**Fix:** Add loading guard / optimistic lock.

### F14. Commission needs-review — client-side reads
**Form:** Resolve rate modal (`src/app/dashboard/commissions/needs-review/page.js`)
**Root cause:** Reads `commissions` collection client-side. Firestore rules for `commissions` reads require `agentId == auth.uid` or hierarchyPath match — admin reads of other agents' commissions may fail since there's no admin exemption in the read rule.
**Fix:** Move commission reads to a server action.

---

## Additional: Missing Composite Indexes (blocking queries)

These compound queries will fail with `FAILED_PRECONDITION` until indexes are created:

| Collection | Fields | Used By |
|-----------|--------|---------|
| `pipelineStages` | agencyId ASC, order ASC | `pipeline.js:53-55` (**F1, F2**) |
| `agentRequests` | agencyId ASC, createdAt DESC | `agentRequests.js:57-60` |
| `agentRequests` | targetAgentId ASC, createdAt DESC | `agentRequests.js:63-66` |
| `carrierUpdates` | agencyId ASC, publishedAt DESC | `carrierUpdates.js:11-12` |
| `clients` | agencyId ASC, createdAt DESC | `clients.js:94-95` |
| `dealStageHistory` | dealId ASC, changedAt DESC | `deals.js:418-419` |
| `invites` | email ASC, created_at DESC | `invite.js:117-118` |
| `commissionRates` | agencyId + carrierId + policyType + agentLevel + effectiveDate DESC | `deals.js:287-292, 347-352` |

---

## Fix Plan (after approval)

### Step 1: Create all missing composite indexes
Use Firebase CLI or console to create each index. These take 1-5 minutes to build.

### Step 2: Fix F1/F2 — pipeline stages query
The index creation alone fixes this. No code change needed.

### Step 3: Fix F3/F4 — lead edit and unassigned leads
- Create `updateLeadFields` server action in `src/app/actions/leads.js`
- Replace client `updateDoc` calls in `leads/[id]/page.js` and `leads/unassigned/page.js`
- Add validation, error display, and loading states

### Step 4: Fix F5/F6 — client edit and policy modal error display
- Check server action results and show errors to user
- Add loading states to Save buttons

### Step 5: Fix F11 — pipeline settings addDoc
- Create `createPipelineStage` server action in `src/app/actions/pipeline.js`
- Replace client `addDoc` in `settings/pipeline/page.js`

### Step 6: Rerun forms test — verify zero failures

### Step 7: Push and verify deployment
