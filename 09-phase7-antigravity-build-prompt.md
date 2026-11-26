# Antigravity Build Prompt — Phase 7: Hardening & Security Review

Paste this whole thing into Antigravity as the task. This phase assumes Phases 1–6 (Auth/visibility, Leads, Pipeline, Tasks, Commissions, Reporting) are functionally complete. This phase does not add new user-facing features — it audits, tightens, and instruments everything already built. Treat every item below as something to verify by actually testing it, not just reasoning about it.

---

## Context

Insurance agency CRM (NXT Financial Group) handling agent PII, prospect/client PII (names, DOB, address, phone, email), and financial data (commissions, premiums). This is the pass that makes it trustworthy to run real business through before Phase 8 deployment.

## 1. Firestore Security Rules — full audit

Go collection by collection and verify, with an actual test (not just rule inspection), for every one of: `Agency`, `Agent`, `Invite`, `Lead`, `LeadNote`, `Deal`, `PipelineStage`, `DealStageHistory`, `Task`, `StageTaskTemplate`, `Carrier`, `CommissionRate`, `Commission`, `CommissionOverride`, `CarrierStatement`, `CarrierStatementLine`, `AgentMetricsSummary`:

- [ ] An unauthenticated request is rejected on every collection except the specific public lead-capture write path
- [ ] An authenticated agent cannot read a document outside their `hierarchyPath` scope (attempt a direct SDK read with a low-privilege test account against a record you know exists outside their downline — expect permission-denied, not just "empty result")
- [ ] An authenticated agent cannot write to a document outside their scope, and cannot escalate a write by setting fields they shouldn't control (e.g., a non-admin trying to set their own `role: 'admin'`, or set someone else's `ownerAgentId` to themselves to hijack a lead)
- [ ] Admin-only collections (`CommissionRate`, `Carrier`, `StageTaskTemplate`, `CarrierStatement`) reject writes from `manager`/`agent` roles
- [ ] `AgentMetricsSummary` rejects **all** client writes, full stop (Cloud-Function-only, verified in Phase 6 — re-confirm here)
- [ ] Required-field rules (e.g., `Lead` needing name + contact method, `Deal` won/lost gating) are enforced server-side in rules, not only in client form validation — test by attempting a raw SDK write that skips the UI entirely

Document every rule test performed and its result in a security test log (a simple markdown or spreadsheet checklist is fine) — this becomes part of the audit trail.

## 2. Abuse & rate-limiting audit
- [ ] Login lockout (Phase 1: 5 failed attempts → 15 min lockout) still functions correctly and cannot be bypassed by clearing cookies/local storage (lockout must be tracked server-side against the account/IP, not client-side state)
- [ ] Public lead-capture web form (Phase 2) has working bot protection (reCAPTCHA or equivalent) and a hard rate limit per IP (e.g., no more than N submissions per minute) enforced server-side
- [ ] Password reset requests are rate-limited per email/IP to prevent enumeration/spam
- [ ] CSV import endpoints reject files above a sane size limit rather than attempting to process an unbounded file and timing out or crashing

## 3. Data validation audit
Re-walk every form built in Phases 1–6 and confirm both client-side inline validation AND server-side/rule-level enforcement exist for every required field and every format constraint (email, phone, dates, currency amounts). Produce a simple table: Screen | Field | Client validation? | Server validation? — flag and fix any field that only has one.

## 4. Sensitive data handling
- [ ] Confirm no PII (SSN, DOB, full address) is ever written to client-side logs or third-party analytics/error-tracking payloads — audit every `console.log`/error-reporting call that touches a Lead, Agent, or Deal object for accidental full-object logging
- [ ] Add an `AuditLog` collection that records sensitive admin actions: `{ id, agencyId, actorAgentId, action, targetType, targetId, metadata, timestamp }` — write an entry on: agent role changes, agent reassignment (upline change), commission rate changes, manual commission edits (Needs Review resolution), invite creation/revocation. Readable only by `admin` role. This is standard practice for anything touching commission/financial data and will matter if there's ever a dispute over "who changed this rate and when."
- [ ] Confirm `Invite` tokens are cryptographically random (not sequential/guessable IDs) and single-use

## 5. Data subject rights (export / deletion)
Since this system holds PII on prospects and clients who are not the CRM's direct users:
- [ ] Build an admin-only "export all data for a contact" action on the Lead detail page — bundles the Lead, its Notes, linked Deals, and Tasks into a downloadable JSON/CSV
- [ ] Build an admin-only "delete/anonymize this contact" action — replaces PII fields (name, email, phone, address, DOB) with anonymized placeholders while preserving non-PII records needed for financial/commission audit trails (e.g., a won Deal's commission history stays intact for accounting, but the underlying contact's personal details are scrubbed). Log this action in `AuditLog`.

## 6. Monitoring & error tracking
- [ ] Integrate an error-tracking service (e.g., Sentry) on both frontend and Cloud Functions, capturing unhandled exceptions with enough context to debug (user role, agency, route) but explicitly scrubbing PII fields before they're sent to the third-party service
- [ ] Set up alerting for: Cloud Function error rate spike, Firestore rule denial rate spike (could indicate either a bug or an attack), scheduled job (nightly reconciliation, commission calculations) failing to run
- [ ] Confirm the Phase 4 email digest and Phase 6 reconciliation job both log success/failure in a way that's visible to whoever's on call, not just silently swallowed

## 7. Dependency & vulnerability check
- [ ] Run a dependency vulnerability scan (`npm audit` or equivalent) across the project and resolve high/critical findings
- [ ] Confirm no API keys, service account credentials, or admin SDK secrets are present in client-side bundled code — audit the built frontend bundle, not just the source tree, since a misconfigured env var can leak into the client build

## 8. Accessibility final pass
- [ ] Run an automated accessibility scan (axe or equivalent) across every screen built in Phases 1–6 and fix all serious/critical findings
- [ ] Manually keyboard-navigate the full core flow (login → create lead → convert to deal → move through pipeline → complete a task → view commission) without touching a mouse
- [ ] Verify color contrast on the actual brand palette in both light and dark mode — navy-on-gold and gold-on-white combinations especially, since gold can be a lower-contrast color, check it wasn't used anywhere text needs to sit directly on it

## 9. Definition of done
- Every checklist item above has been actually executed and its result recorded, not just reviewed in the abstract
- A security test log exists documenting what was tested and the outcome
- `AuditLog` is live and capturing the specified sensitive actions
- Data export/anonymization tools exist and have been tested end-to-end on a real (test) contact record
- Error tracking and alerting are live and have been verified by deliberately triggering a test error
- No critical/high vulnerabilities remain in dependencies
- No secrets are present in the client bundle

This phase produces no new screens beyond the export/anonymize actions and the audit log viewer — its output is a hardened, verified system and a written record of what was checked.
