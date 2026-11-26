# Antigravity Build Prompt — Phase 2: Contacts & Leads

Paste this whole thing into Antigravity as the task. It assumes Phase 1 (Firebase Auth, multi-tenant agency/agent structure, role-based onboarding, Firestore security rules, hierarchyPath visibility) is already built and working in this codebase — do not modify Phase 1 auth/onboarding logic, only extend the schema and rules as specified below.

---

## Context

This is an insurance agency CRM (NXT Financial Group) built on Firebase/Firestore. Existing entities: `Agency`, `Agent` (with `agencyId`, `upline_id`/`uplineId`, `role`: admin/manager/agent, `hierarchyPath` string like `"AGENCY1/ADMIN_7/MGR_12/AGENT_45"`).

Visibility rule already established and must be reused, not reinvented: a user can see a record if `record.ownerAgentId == me.id` OR `record.ownerHierarchyPath` starts with `me.hierarchyPath + "/"`. This is enforced in both Firestore Security Rules and app-level queries.

Design system already established — reuse these tokens exactly, do not introduce new colors or radii:
- Colors: navy `#0F2A52` (primary/nav/buttons), navy-light `#1B3A6B`, blue accent `#2D6FC4` (links), gold `#C99A3D` (sparse accents/badges only, never full backgrounds), gold-light `#F2C94C` (gold hover/gradient), silver `#A9ACB1` (borders/dividers/secondary text), surface page `#FAFAFA`, surface card `#FFFFFF`. Status colors are separate from gold: success green `#2FA84F`, warning-amber `#E08E2B`, error red `#D33F3F`.
- Typography: system font stack (`-apple-system, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif`), calm hierarchy, no heavy bold walls of text.
- **All buttons are full capsule/pill shape (`border-radius: 999px`)** — primary, secondary, and small/inline buttons alike. Icon-only buttons are perfect circles (`50%`). Text inputs and dropdowns use `12px` radius (not pills). Cards use `16px`. Badges/status pills use `999px`. Toggles use `999px` track / `50%` thumb. No sharp corners anywhere.
- Motion: 150–250ms ease-in-out transitions only, respect `prefers-reduced-motion`.
- Every async action shows idle → loading (skeleton/inline spinner, never a blank screen) → success/error feedback.
- Dark mode required on every screen from the start (navy background inverts to `#12203A`, gold/silver accents unchanged).
- WCAG AA contrast, full keyboard navigation, proper `<label>`s, `aria-label`s on icon buttons.

## Goal for this phase

Build the full Contacts & Leads module: data model, all screens, assignment logic, duplicate detection, and Firestore rules — matching the spec below exactly. Do not build Pipeline/kanban (that's Phase 3) — leads have a simple status field only in this phase, not pipeline stages.

## 1. Schema — create these Firestore collections

```
Lead
  id (doc id)
  agencyId: string
  ownerAgentId: string | null       // null = unassigned
  ownerHierarchyPath: string | null // set together with ownerAgentId, always in one transaction
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  dateOfBirth: string | null        // ISO date
  address: { street, city, state, zip }
  source: 'manual' | 'web_form' | 'csv_import' | 'referral' | 'purchased' | 'event'
  status: 'new' | 'contacted' | 'no_answer' | 'qualified' | 'not_interested' | 'client' | 'lost'
  tags: string[]
  duplicateOfLeadId: string | null
  createdAt, updatedAt: timestamp
  lastContactedAt: timestamp | null
  createdByAgentId: string | null   // null if created via web form

LeadNote
  id (doc id)
  leadId: string
  authorAgentId: string
  body: string
  createdAt: timestamp
```

Add to `Agent`: `licensedStates: string[]` (empty array default) — editable by the agent themselves and by admins.

Add to `Agency.settings`: `leadAssignmentMode: 'manual' | 'round_robin' | 'license_matched_round_robin'`, plus a `roundRobinPointer` field to track rotation state.

## 2. Validation rules
- Require `firstName`, `lastName`, and at least one of `email`/`phone` — enforce in the form (disable submit until met) AND in Firestore Security Rules (reject writes missing these).
- Validate email format and phone format client-side, inline, on blur — not only on submit.

## 3. Duplicate detection (implement exactly this logic)
Before creating a Lead, query the same `agencyId` for an existing Lead with matching `email` (if provided) OR matching `phone` (if provided).
- **Manual entry path**: if a match is found, block creation. Show the existing lead (name + link) and an "Add note to existing lead instead" action.
- **CSV import path**: flag matching rows in the validation-preview step as "possible duplicate — [existing lead name]" with a per-row choice: skip, or import anyway (set `duplicateOfLeadId` on the new row to the match).
- **Web form path**: no user available to ask — auto-set `duplicateOfLeadId` on the new lead pointing to the match, and auto-create a `LeadNote` reading "Duplicate submission received via web form" rather than presenting it as a fresh untouched lead.

## 4. Assignment logic (implement all three modes; agency picks one in settings)
1. **Manual**: admin/manager UI action, sets `ownerAgentId` + `ownerHierarchyPath` in a single Firestore transaction (both fields must land atomically, never as two writes).
2. **Round-robin**: on lead creation (if mode is round_robin and no manual owner given), pick the next active agent using `Agency.settings.roundRobinPointer`, assign, advance the pointer — all inside one transaction to prevent two concurrent lead creations from landing on the same agent or corrupting the pointer.
3. **License-matched round-robin**: same as round-robin, but the eligible pool is filtered to agents whose `licensedStates` includes `lead.address.state`. If the eligible pool is empty, do NOT assign — leave `ownerAgentId: null`, add a `flagged: true`-style marker (add this boolean field to Lead) so it surfaces clearly in the Unassigned Pool screen for an admin to handle manually.

## 5. Screens to build

1. **Leads List** (`/leads`) — table, columns: name, status (colored capsule badge), source, state, owner, date added. Filter by status/source/state/owner. Sort by any column. Scoped to the requesting user's visibility (self + downline). Skeleton-row loading state.
2. **Lead Detail** (`/leads/:id`) — editable contact fields inline (click to edit, save on blur with inline validation), status changer (dropdown → capsule badge updates live), notes timeline (newest first, add-note box pinned at top), reassign control visible only to admin/manager roles, confirmation modal before reassigning.
3. **Add Lead** (`/leads/new`) — single form, live field validation, duplicate check on submit with the blocking behavior described above.
4. **Import Leads** (`/leads/import`) — 4-step wizard: (1) file upload, (2) column mapping (map CSV headers to Lead fields), (3) validation preview (show row count, flag errors and duplicates per row, let user resolve each), (4) confirm & import with a progress indicator, then a post-import summary report (X imported, Y skipped, Z flagged as duplicate).
5. **Unassigned Pool** (`/leads/unassigned`) — admin/manager only, list of leads with `ownerAgentId: null`, including any `flagged: true` license-mismatch leads called out distinctly, with an "Assign" action per row.
6. **Public Web Form** (`/embed/lead-form/:agencyId`) — unauthenticated route, minimal branded form (name, email, phone, state, message), reCAPTCHA (or equivalent) required before submit, on success creates a Lead with `source: 'web_form'`, `createdByAgentId: null`, runs it through duplicate detection and assignment logic same as any other lead.

## 6. Firestore Security Rules to add
- Reads/writes on `Lead`: allowed only if `request.auth.uid`'s agent doc has `ownerAgentId == request.auth.uid` OR the requester's `hierarchyPath` is a prefix-match of `resource.data.ownerHierarchyPath` (implement via the same pattern used for Phase 1 visibility).
- Unassigned leads (`ownerAgentId == null`): readable/writable only by agents with `role in ['admin','manager']` in that `agencyId`.
- The public web form path must use a separate, tightly-scoped rule (or a Cloud Function endpoint instead of direct client writes) that only allows creating a new Lead with `source == 'web_form'` and `ownerAgentId == null` — never allow public writes to update or read existing leads.
- Writes to `Lead` must be rejected if `firstName`, `lastName` are missing, or if both `email` and `phone` are missing.

## 7. Error states to implement and manually verify before calling this done
- [ ] Required-field validation blocks submit, client and server side
- [ ] Invalid email/phone format shown inline before submit
- [ ] Duplicate detected on manual entry → submission blocked, existing lead linked
- [ ] CSV missing required columns → import blocked before any row processes
- [ ] CSV malformed row → skipped, listed in post-import report, rest of import proceeds
- [ ] Two simultaneous round-robin assignments never land on the same agent (test with concurrent requests)
- [ ] License-matched mode with zero eligible agents → lead stays unassigned + flagged, never force-assigned
- [ ] Reassignment updates `ownerAgentId` + `ownerHierarchyPath` atomically
- [ ] Agent guessing a direct `/leads/:id` URL outside their visibility → clean "not found," no data leak
- [ ] Public web form is rate-limited/bot-protected and cannot write anything beyond a new unassigned lead

## 8. Definition of done
- All 6 screens built, styled per the design tokens above (capsule buttons, correct colors, dark mode working)
- All 3 assignment modes functional and switchable via agency settings
- Every checklist item in section 7 manually triggered and confirmed
- A manager can see their full downline's leads in one list view; an agent cannot see outside their own scope, verified by direct Firestore SDK read attempt (should be permission-denied)

Do not proceed to pipeline/kanban functionality — that is Phase 3 and out of scope here.
