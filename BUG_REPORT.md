# NXT CRM Bug Audit Report

Generated: 2026-11-18

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 12 |
| HIGH | 24 |
| MEDIUM | 31 |
| LOW | 18 |
| **Total** | **85** |

---

## Confirmed Bugs

### CRITICAL

| ID | Area | File & Line | Description | Steps to Reproduce | Expected vs Actual | Suggested Fix |
|----|------|-------------|-------------|--------------------|--------------------|---------------|
| C-01 | Auth | `actions/profile.js:updateMyProfile` | **Privilege escalation via updateMyProfile** — accepts arbitrary `uid` and arbitrary `updates` object, writes via `set(merge:true)` with no field allowlist. Any authenticated user can set `role:'admin'`, `is_owner:true`, or `status:'active'` on any agent document. | Call `updateMyProfile('anyUid', {role:'admin', is_owner:true})` from browser console | Should reject unauthorized fields | Add field allowlist (name, phone, email, etc.); verify caller uid matches target uid via Firebase Admin `verifyIdToken` |
| C-02 | Auth | `actions/profile.js:completeOnboarding` | **Privilege escalation via onboarding** — `agentData` is spread directly into Firestore doc with no field filtering. Attacker can inject `role`, `is_owner`, `billingExempt`, etc. | During onboarding, intercept request and add `role:'admin'` to agentData | Should only accept onboarding-specific fields | Add strict field allowlist for onboarding data |
| C-03 | Auth | No `middleware.js` exists | **Zero server-side route protection** — no Next.js middleware at all. All route guards are client-side only (UserContext redirects). Any API route or server action is callable without authentication. | Navigate directly to `/dashboard/admin/approvals` without logging in; client-side redirect fires but server action data is already fetched | Server should reject unauthenticated requests at the middleware layer | Create `middleware.js` that verifies Firebase session cookie on all `/dashboard/*` and `/api/*` routes |
| C-04 | Auth | `actions/samlAuth.js:decodeFirebaseIdToken` | **JWT signature not verified** — only base64-decodes the JWT payload, checks `iss`/`aud`/`exp` claims but never verifies the RSA cryptographic signature. Attacker can forge a token with correct claims. | Craft a JWT with `{"iss":"https://securetoken.google.com/...","aud":"...","exp":future}`, base64-encode it, send to any endpoint using this function | Should verify signature via Firebase Admin SDK | Replace with `admin.auth().verifyIdToken(token)` from Firebase Admin SDK |
| C-05 | Auth | `actions/oidcAuth.js:getOidcAgentData` | **Same broken JWT decode as C-04** — OIDC authorization uses the same `decodeFirebaseIdToken` with no signature verification. | Same as C-04 via `/api/oidc/authorize` | Should verify token cryptographically | Use `admin.auth().verifyIdToken(token)` |
| C-06 | API | `api/documents/filled/route.js` | **Unauthenticated access to signed legal documents** — GET endpoint returns filled PDFs (ICA, AOA, Business Standards) with agent signatures. Zero authentication. Anyone who knows or guesses an agentId can download signed contracts. | `GET /api/documents/filled?agentId=<any-agent-id>&docType=ICA` | Should require authenticated admin or document owner | Add Firebase token verification; verify caller is the agent or an admin |
| C-07 | API | `api/diagnose/route.js` | **Unauthenticated PII exposure** — GET endpoint returns all agents for any agencyId (names, emails, NXT IDs, roles, statuses). No auth check. | `GET /api/diagnose?agencyId=JHdkqlkDcXFKzHl46FG7` | Should require admin authentication | Add auth check or remove endpoint (appears to be a debug route) |
| C-08 | API | `api/stripe/setup-intent/route.js` | **Unauthenticated Stripe SetupIntent creation** — anyone can create a SetupIntent for any Stripe customer by posting a customerId. | `POST /api/stripe/setup-intent` with `{customerId: "cus_..."}` | Should verify the caller owns this customer | Verify Firebase token and match customerId to caller's agent record |
| C-09 | API | `api/stripe/create-subscription/route.js` | **Unauthenticated subscription creation** — anyone can create a Stripe subscription for any customer. | `POST /api/stripe/create-subscription` with valid customer/payment IDs | Should verify caller identity | Add Firebase token verification |
| C-10 | API | `api/stripe/update-payment-method/route.js` | **Unauthenticated payment method update** — anyone can update the payment method on any Stripe customer. | `POST /api/stripe/update-payment-method` with `{customerId, paymentMethodId, agentId}` | Should verify caller is the agent | Add Firebase token verification; verify agentId matches caller |
| C-11 | API | `api/stripe/webhook/route.js:16-26` | **Webhook signature verification bypass** — if `STRIPE_WEBHOOK_SECRET` env var is not set or the `stripe-signature` header is null, the code falls through to `JSON.parse(body)` without any verification. Attacker can send fake webhook events. | Send a POST to `/api/stripe/webhook` without signature header when env var is missing | Should always verify webhook signature or reject | Make `STRIPE_WEBHOOK_SECRET` required; reject requests when it's missing |
| C-12 | API | `api/reports/export/route.js` | **Token in URL + broken verification** — uses same broken `decodeFirebaseIdToken` (no signature verify), AND passes the token as a query parameter (`?token=...`) which gets logged in URL bars, referrer headers, and server access logs. Exports all deals as CSV. | `GET /api/reports/export?token=<forged-jwt>` | Should use Authorization header with properly verified token | Use `Authorization: Bearer` header; replace with `admin.auth().verifyIdToken()` |

### HIGH

| ID | Area | File & Line | Description | Steps to Reproduce | Expected vs Actual | Suggested Fix |
|----|------|-------------|-------------|--------------------|--------------------|---------------|
| H-01 | Auth | `actions/clients.js` (all functions) | **No auth on client CRUD** — `createClient`, `fetchClients`, `getClient`, `updateClient`, `addPolicy`, `deletePolicy`, `addClientNote` have zero authentication or authorization checks. Any caller can read/write any client. | Call `fetchClients('anyAgencyId')` without authentication | Should verify caller belongs to the agency | Add token verification and agency membership check |
| H-02 | Auth | `actions/deals.js` (all functions) | **No auth on deal CRUD** — `fetchDeals`, `createDeal`, `updateDeal`, `deleteDeal` have zero authentication. | Call `deleteDeal('anyDealId')` from an unauthenticated context | Should verify ownership or admin role | Add token verification and ownership/agency check |
| H-03 | Auth | `actions/leads.js` (all functions) | **No auth on lead CRUD** — `createLead`, `fetchLeads`, `updateLeadFields`, `assignLead`, `addLeadNote`, `exportContactData`, `anonymizeContact` have zero auth. `anonymizeContact` can destroy PII without authorization. | Call `anonymizeContact('anyLeadId')` | Should verify admin role for destructive ops | Add auth checks; require admin for anonymize/export |
| H-04 | Auth | `actions/commissions.js` (all functions) | **No auth on commission operations** — `fetchCommissions`, `createOrUpdateCarrier`, `createOrUpdateRate`, `resolveNeedsReview` have zero auth. Any user can modify carrier rates. | Call `createOrUpdateRate(...)` without admin role | Should require admin for rate changes | Add admin role check for write operations |
| H-05 | Auth | `actions/overrides.js` (all functions) | **No auth on override operations** — `setOverride`, `setOverridesBulk`, `removeOverride` allow any caller to set commission overrides for any agent. | Call `setOverride(agentId, carrierId, rate)` | Should require admin | Add admin role verification |
| H-06 | Auth | `actions/tasks.js` (all functions) | **No auth on task CRUD** — `createTask`, `fetchTasks`, `updateTaskStatus`, `deleteTask` have zero auth. | Call `deleteTask('anyTaskId')` | Should verify task ownership or admin | Add ownership check |
| H-07 | Auth | `actions/documents.js:uploadDocument, fetchDocuments` | **No auth on document upload/fetch** — only `reviewDocument` checks admin role. Anyone can upload documents to any agent's record or fetch any agent's documents. | Call `fetchDocuments('anyAgentId')` | Should verify caller is the agent or admin | Add auth check |
| H-08 | Auth | `actions/invite.js:sendInvite` | **Admin check but no token verification** — `sendInvite` checks if caller role is admin, but the role is passed from the client, not verified server-side. | Intercept and modify the role parameter to 'admin' | Should verify admin role via Firebase Admin SDK | Verify token server-side, then look up role from Firestore |
| H-09 | Auth | `actions/learn.js` (all functions) | **No auth on learning resources** — `createLearningResource` and `deleteLearningResource` should be admin-only but have zero auth. | Call `deleteLearningResource('anyId')` | Should require admin role | Add admin role check |
| H-10 | Auth | `actions/carrierUpdates.js` | **No auth on carrier updates** — `createCarrierUpdate` and `deleteCarrierUpdate` should be admin-only. | Call `deleteCarrierUpdate('anyId')` | Should require admin | Add admin role check |
| H-11 | Auth | `actions/reports.js:fetchReportData` | **No auth on report data** — returns agency-wide report data to any caller. | Call `fetchReportData('anyAgencyId')` | Should verify agency membership | Add auth check |
| H-12 | Auth | `actions/scoreboard.js:fetchScoreboardData` | **No auth** — returns scoreboard data for any agency. | Call with any agencyId | Should verify membership | Add auth check |
| H-13 | Auth | `actions/activityLogActions.js:fetchActivityLogs` | **No auth on activity logs** — UI gates this to NXT0002 only, but server action has zero auth. Anyone can call it. | Call `fetchActivityLogs()` directly | Should verify caller is NXT0002 or admin | Add server-side auth check |
| H-14 | Auth | `actions/drive.js` | **No auth on Google Drive access** — `listDriveFolder` and `searchDriveFiles` have no authentication. | Call `listDriveFolder('anyFolderId')` | Should verify caller | Add auth check |
| H-15 | Auth | `actions/agents.js:deleteAgent` | **No auth on agent deletion** — `deleteAgent` can remove any agent document. | Call `deleteAgent('anyAgentId')` | Should require admin with confirmation | Add admin role verification |
| H-16 | Auth | `actions/agents.js:setOwnerFlag` | **No auth on owner flag** — allows setting `is_owner: true` on any agent. | Call `setOwnerFlag('anyAgentId', true)` | Should be super-admin only | Add strict auth check; this should almost never be called |
| H-17 | Auth | `actions/billing.js:sendPaymentReminders` | **Partial auth** — checks admin role but role comes from client. | Modify client-sent role to bypass | Should verify server-side | Verify token and look up role from DB |
| H-18 | IDOR | `actions/profile.js:fetchTeamData` | **Cross-agency data access** — accepts any `agencyId` with no verification that caller belongs to that agency. | Call `fetchTeamData('otherAgencyId')` | Should verify caller's agency | Verify caller's agencyId matches |
| H-19 | IDOR | `actions/contracts.js:fetchContracts` | **No auth or agency check** — returns contracts for any agency. | Call with any agencyId | Should verify agency membership | Add auth check |
| H-20 | IDOR | `actions/pipeline.js:fetchPipelineData` | **No auth** — returns pipeline data for any agency. | Call with any agencyId | Should verify membership | Add auth check |
| H-21 | API | `api/cron/daily-tasks/route.js` | **Conditional CRON_SECRET check** — `if (process.env.CRON_SECRET && ...)` means if the env var is not set, the check is skipped entirely. Anyone can trigger the cron. | `GET /api/cron/daily-tasks` when CRON_SECRET is not set | Should always require the secret | Make check unconditional: reject if secret is missing |
| H-22 | API | `api/cron/metrics-reconciliation/route.js` | **Same conditional CRON_SECRET bypass as H-21** | Same as H-21 | Same | Same fix |
| H-23 | Deps | `package.json` | **37 npm vulnerabilities** — `npm audit` reports 1 critical, 20 high, 15 moderate, 1 low vulnerability across dependencies. | Run `npm audit` | Should have zero critical/high vulnerabilities | Run `npm audit fix`; review and update vulnerable packages |
| H-24 | Auth | `api/saml/sso/route.js` | **Unauthenticated SAML assertion endpoint** — POST endpoint generates SAML assertions without verifying caller. Combined with C-04 (broken JWT verify), allows forged SSO into SureLC. | POST to `/api/saml/sso` with forged token | Should verify Firebase token properly | Fix JWT verification (C-04) and add proper auth |

### MEDIUM

| ID | Area | File & Line | Description | Steps to Reproduce | Expected vs Actual | Suggested Fix |
|----|------|-------------|-------------|--------------------|--------------------|---------------|
| M-01 | Code Quality | `app/dashboard/layout.js` | **NavLink component defined inside render** — `NavLink` is created during render, causing React to unmount/remount on every re-render (losing focus, breaking transitions). ESLint flags this. | Navigate between sidebar links; notice transition flicker | Should be a stable component reference | Extract `NavLink` outside the layout component |
| M-02 | Code Quality | 49 files (ESLint) | **126 ESLint issues** — 99 errors, 27 warnings. Key categories: 29 "variable accessed before declaration" (function hoisting), 24 "setState in effect without cleanup", 20 "components created during render", 22 missing useEffect deps. | Run `npx eslint src/` | Should have zero errors | Fix ESLint errors systematically; prioritize the 29 variable-before-declaration and 20 component-in-render issues |
| M-03 | Auth | `context/UserContext.js` | **Client-supplied uid used as identity** — `fetchMyProfile(user.uid)` sends the client-side uid to server actions. Server actions trust this uid without verification. | Modify `user.uid` before it's sent to `fetchMyProfile` | Should verify uid server-side | Server actions should verify the Firebase ID token themselves |
| M-04 | Auth | `context/UserContext.js` | **5-minute inactivity auto-logout** — may be too aggressive for agents doing paperwork or on calls. No warning before logout. | Leave app idle for 5 minutes | Should warn before logout and allow configurable timeout | Add 30-second warning toast; consider longer timeout |
| M-05 | Data | `actions/profile.js:fetchPendingApprovals` | **No pagination** — fetches all pending agents at once. Could be slow if many agents are pending. | Have 100+ pending agents | Should paginate | Add limit/offset or cursor pagination |
| M-06 | Data | `actions/agents.js:getAgents` / `fetchAgents` | **Two functions doing similar things** — `getAgents` and `fetchAgents` both query the agents collection with slightly different implementations. Maintenance risk. | Read both functions | Should have one canonical function | Consolidate into one function |
| M-07 | Data | `actions/deals.js:deleteDeal` | **Hard delete** — permanently removes deal document. No soft delete, no audit trail. | Delete a deal | Should soft-delete or archive | Add `deletedAt` timestamp instead of `deleteDoc` |
| M-08 | Data | `actions/leads.js:anonymizeContact` | **No audit trail** — anonymizes PII with no record of who did it or when (beyond Firestore audit if enabled). | Call `anonymizeContact(leadId)` | Should log who anonymized and why | Add activity log entry before anonymizing |
| M-09 | Data | `actions/commissions.js` | **No validation on rate values** — `createOrUpdateRate` accepts any numeric value for commission rates. No range check (e.g., 0-100%). | Set rate to 500% or -10% | Should validate rate is within acceptable range | Add min/max validation |
| M-10 | UI | `app/dashboard/billing/page.js` | **`window.location.reload()` after card update** — full page reload instead of state update. Poor UX. | Update card successfully | Should update state without reload | Refresh profile context via `fetchMyProfile` and update state |
| M-11 | UI | `app/dashboard/billing/page.js` | **No loading state during card update** — user can click submit multiple times. | Click update button rapidly | Should show loading and disable button | Add loading state and disable submit during processing |
| M-12 | PDF | `lib/fillPdf.js` | **Fixed coordinate system for signatures** — PDF signature positions are hardcoded pixel coordinates. If PDF templates change dimensions, signatures will be misaligned. | Change PDF template dimensions | Should adapt to template | Use relative positioning or configurable coordinates per template version |
| M-13 | PDF | `api/documents/filled/route.js` | **No PDF caching** — regenerates filled PDF on every request. | Request the same filled PDF twice | Should cache generated PDFs | Cache in Firestore Storage or add ETag/If-None-Match |
| M-14 | Email | `lib/email/resend.js` | **No retry logic for email sending** — if Resend API call fails, the email is lost. | Resend API returns 500 | Should retry with backoff | Add retry with exponential backoff (2-3 attempts) |
| M-15 | Data | `actions/billing.js:getAgentsMissingPayment` | **Hardcoded billing exemption** — billing exemption is checked via `billingExempt` flag and `role === 'it_engineer'`. If more roles need exemption, requires code change. | Add a new exempt role | Should be configurable | Use an array of exempt roles in constants |
| M-16 | Auth | `app/(auth)/login/page.js` | **Login lockout stored in Firestore** — rate limiting uses Firestore reads/writes on every login attempt, adding latency and cost. | Trigger login lockout flow | Should use in-memory or Redis cache | Use edge-compatible rate limiting (Redis or in-memory with fallback) |
| M-17 | Auth | `actions/auth.js` | **In-memory password reset rate limiting** — resets on every server restart/redeployment. On Vercel, each function invocation may have its own memory. | Restart server; rate limit resets | Should persist across restarts | Use Firestore or Redis for rate limiting |
| M-18 | Data | `actions/tracker.js` | **No auth on tracker operations** — `fetchTrackerSettings`, `updateTrackerSettings`, CRUD on tracker contacts have no auth. | Call any tracker action without auth | Should verify caller | Add auth check |
| M-19 | Data | `actions/deals.js:createDeal` | **No duplicate detection** — can create identical deals without warning. | Create the same deal twice | Should warn about potential duplicates | Add duplicate check on key fields (client, carrier, amount) |
| M-20 | UI | Multiple dashboard pages | **No error boundaries** — if a server action throws, the page crashes with a white screen. | Trigger a Firestore error | Should show user-friendly error | Add React error boundaries to dashboard layout |
| M-21 | Data | `actions/leads.js:exportContactData` | **No rate limiting on data export** — allows unlimited bulk export of contact data. | Call `exportContactData` in a loop | Should rate-limit exports | Add rate limiting per user |
| M-22 | Data | `actions/commissions.js:resolveNeedsReview` | **No audit trail** — commission review resolution has no record of who resolved it. | Resolve a commission review | Should log resolver and decision | Add activity log |
| M-23 | UI | `app/dashboard/layout.js` | **Activity Logs hardcoded to NXT0002** — `nxt_id === 'NXT0002'` is a hardcoded user gate. If this user leaves or ID changes, no one can access logs. | Change NXT0002's ID | Should use role-based access | Use admin role check instead of hardcoded ID |
| M-24 | Data | `actions/profile.js:fixAgentAgencyId` | **Utility that writes to any agent** — no auth check; can set any agent's `agency_id`. | Call `fixAgentAgencyId('anyAgentId', 'anyAgencyId')` | Should require admin | Add admin auth check or remove if no longer needed |
| M-25 | Data | `actions/agents.js:createSelfSignupAgent` | **Self-signup creates agent with minimal validation** — no verification that the email domain is authorized or that the agent was invited. | Sign up with any email via `/join` | Should validate against allowed domains or require invite | Add email domain allowlist or invitation requirement |
| M-26 | Performance | `actions/profile.js:fetchTeamData` | **Fetches all agents in agency at once** — no pagination. With 100+ agents this becomes slow. | Have many agents in one agency | Should paginate | Add cursor-based pagination |
| M-27 | Data | `actions/deals.js:updateDeal` | **No field validation on deal updates** — accepts any fields. Could write unexpected data to Firestore. | Pass unexpected fields in update | Should validate fields | Add field allowlist |
| M-28 | Data | `actions/leads.js:assignLead` | **No check that target agent exists** — can assign lead to a non-existent agent ID. | Call `assignLead(leadId, 'nonexistent')` | Should verify target agent exists | Check agent document exists before assigning |
| M-29 | API | `api/oidc/authorize` | **Full OIDC provider with broken auth** — combined with C-05, the OIDC provider issues tokens without proper verification. | Use the OIDC flow with forged Firebase token | Should have proper auth | Fix C-05; consider if OIDC provider is needed |
| M-30 | Data | `actions/additionalCommissions.js` | **No auth on additional commission handling** — no caller verification. | Call any function without auth | Should verify caller | Add auth check |
| M-31 | Data | `actions/dashboard-v2.js` | **No auth on dashboard data** — returns dashboard metrics for any agency without verification. | Call with any agencyId | Should verify membership | Add auth check |

### LOW

| ID | Area | File & Line | Description | Steps to Reproduce | Expected vs Actual | Suggested Fix |
|----|------|-------------|-------------|--------------------|--------------------|---------------|
| L-01 | Code Quality | `actions/agents.js` | **Duplicate functions** — `getAgents` and `fetchAgents` overlap in purpose. | Read both functions | Should have one | Consolidate |
| L-02 | Code Quality | `lib/activityLogger.js` | **Logger may silently fail** — if Firestore write fails, error is caught but activity is lost. | Firestore write fails | Should retry or queue | Add retry or fallback logging |
| L-03 | UI | `components/StripePaymentForm.js` | **No card brand icon** — shows text "Visa" instead of card brand logo. | View payment form | Should show card brand icon | Add card brand SVG icons |
| L-04 | Config | `jsconfig.json` | **No TypeScript** — entire project is JavaScript with no type checking. Type bugs can't be caught statically. | Write a type error | Should catch type errors | Consider gradual TypeScript migration |
| L-05 | UI | `components/AddressAutocomplete.js` | **Google Places API key may be exposed client-side** — standard for client-side usage but should be restricted by HTTP referrer. | View page source | API key should be referrer-restricted | Verify Google API key has HTTP referrer restrictions |
| L-06 | Performance | `app/dashboard/billing/page.js` | **Stripe.js loaded on every billing page visit** — `loadStripe` called even if user won't update card. | Visit billing page | Should lazy-load Stripe | Only load Stripe when update card modal opens |
| L-07 | Code Quality | Multiple files | **Console.log statements in production** — various `console.log` and `console.error` statements remain in production code. | Check server logs | Should use structured logging | Replace with a logging utility that respects log levels |
| L-08 | UI | `app/dashboard/layout.js` | **Sidebar not responsive** — no mobile hamburger menu or responsive collapse. | View on mobile (<768px) | Should have mobile navigation | Add responsive sidebar with toggle |
| L-09 | Performance | `actions/profile.js:uploadProfilePhoto` | **No image size validation** — accepts any file size for profile photos. | Upload a 50MB photo | Should limit file size | Add max file size check (e.g., 5MB) |
| L-10 | Data | `actions/invite.js:validateInviteToken` | **Token expiry not enforced** — invite tokens may not have expiration. | Use an old invite token | Should expire after reasonable period | Add `expiresAt` field to invite documents |
| L-11 | UI | Multiple pages | **No skeleton/loading states** — pages show blank content while server actions load. | Navigate to any dashboard page on slow connection | Should show loading skeletons | Add loading.js files or skeleton components |
| L-12 | Code Quality | `lib/constants.js` | **Agent levels hardcoded** — level names and commission structures are in source code rather than database-configurable. | Need to change level structure | Should be admin-configurable | Already has `/dashboard/settings/agent-levels` page; verify it works |
| L-13 | Performance | `actions/commissions.js:fetchCommissions` | **No query limits** — fetches all commissions without pagination. | Have 10,000+ commissions | Should paginate | Add pagination |
| L-14 | UI | `components/DocumentSigning.js` | **Signature capture UX** — no undo/redo for signature drawing. | Make a mistake while signing | Should allow redo | Add clear/redo button (may already exist; verify) |
| L-15 | Data | `actions/deals.js:fetchDealStageHistory` | **Unbounded history fetch** — gets all stage history entries. | Deal with 1000 stage changes | Should limit or paginate | Add limit |
| L-16 | Code Quality | `lib/dealAutomationHooks.js` | **Automation hooks tightly coupled** — deal stage change triggers are hardcoded rather than configurable. | Need to change automation rules | Should be configurable via task automation settings | Verify `/dashboard/settings/task-automation` page works with these hooks |
| L-17 | Performance | Multiple server actions | **No Firestore query indexing hints** — complex queries may need composite indexes that aren't documented. | Query fails with index error | Should document required indexes | Add `firestore.indexes.json` with required indexes |
| L-18 | UI | `components/ui/InteractiveBackground.js` | **Animated background may impact performance** — continuous animation on every page. | Monitor CPU on low-end device | Should respect `prefers-reduced-motion` | Add reduced motion media query check |

---

## Unverified (Suspected but Not Confirmed)

| ID | Area | Suspicion | Why Unverified |
|----|------|-----------|----------------|
| U-01 | PDF | Signature overlay may not align on all PDF viewer implementations | Could not test actual PDF rendering; would need to open generated PDFs in multiple viewers |
| U-02 | Email | Payment reminder emails may land in spam due to Resend domain configuration | Would need to send actual emails and check deliverability |
| U-03 | SSO | SureLC SAML assertion may fail for agents without all required fields | Depends on SuranceBay's ACS validation rules; cannot test without their sandbox |
| U-04 | Stripe | Subscription with 30-day trial may not transition correctly to paid on day 31 | Would need to wait for trial expiration or use Stripe test clocks |
| U-05 | Stripe | Webhook may miss events during Vercel cold starts | Would need to trigger webhooks during deployment transitions |
| U-06 | OIDC | OIDC token issuance may have clock skew issues | Cannot test without an OIDC relying party configured |
| U-07 | Performance | Dashboard page may be slow with 50+ agents due to un-paginated queries | Would need production-scale data to confirm |
| U-08 | Data | Commission distribution calculations may have floating-point precision issues | Would need to test with specific edge-case commission split ratios |
| U-09 | Auth | Firebase Auth session tokens may not be properly invalidated on password change | Would need to test with two active sessions |
| U-10 | UI | Onboarding flow may break if browser back button is pressed mid-step | Would need runtime testing |

---

## Untested Areas

The following parts of the inventory could not be tested and why:

| Area | Reason |
|------|--------|
| **Runtime testing (all 61 pages)** | Dev server was not started; full walkthrough of each page flow was not performed. All findings are from static code analysis only. |
| **Stripe payment flows** | Requires live/test Stripe keys and actual card interactions. Could not test SetupIntent creation, subscription lifecycle, or webhook handling end-to-end. |
| **Email delivery** | Requires Resend API key and actual email sending. Could not verify templates render correctly or emails are delivered. |
| **SAML SSO with SureLC** | Requires SuranceBay sandbox environment. Could not test full SSO flow. |
| **OIDC provider flow** | Requires a configured relying party. Could not test token issuance or authorization flow. |
| **Google Drive integration** | Requires Google service account credentials. Could not test `listDriveFolder` or `searchDriveFiles`. |
| **Google Places autocomplete** | Requires Google API key. Could not test address completion. |
| **PDF generation and signing** | Requires running app with Firebase credentials to test actual PDF overlay. |
| **Mobile responsiveness** | Requires running dev server and testing at multiple breakpoints. |
| **Cross-browser compatibility** | Requires running dev server in Chrome, Firefox, and Safari. |
| **Vercel deployment behavior** | Requires deploying to Vercel to test cron jobs, edge functions, and cold starts. |
| **Firebase security rules** | Firestore security rules were not audited (they're in the Firebase console, not in this repo). If rules are permissive, the server action auth gaps are even more severe. |
| **Commission calculation accuracy** | Requires production-like data with known expected results. |
| **Concurrent user scenarios** | Requires multiple simultaneous sessions to test race conditions. |

---

## Static Check Results

### ESLint: 126 issues (99 errors, 27 warnings) across 49 files

Top categories:
- 29 × "variable accessed before declaration" (function hoisting in useEffect callbacks)
- 24 × "setState called in useEffect without cleanup"
- 22 × missing useEffect dependency array entries
- 20 × "component created during render" (causes re-mount every render)
- Remaining: unused variables, missing key props, etc.

### Next.js Build: PASSES (0 errors)

Build completes successfully despite ESLint issues (ESLint is not enforced during build).

### npm audit: 37 vulnerabilities

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 20 |
| Moderate | 15 |
| Low | 1 |

---

## Systemic Issues Summary

These cross-cutting concerns affect the entire application:

1. **No server-side authentication layer** — No middleware.js exists. All route protection is client-side only via UserContext redirects. Every server action and API route is callable by any unauthenticated user.

2. **Server actions never verify caller identity** — Server actions accept a client-supplied `uid` parameter and trust it without cryptographic verification. The Firebase Admin SDK's `verifyIdToken()` is never called in any server action.

3. **No authorization framework** — Even if auth were fixed, there is no consistent pattern for checking "does this user have permission to do this action on this resource?" Each action would need individual RBAC logic.

4. **IDOR everywhere** — Most data-fetching actions accept an `agencyId` or `agentId` parameter with no verification that the caller belongs to that agency or is that agent.

5. **No field allowlists on writes** — `updateMyProfile` and `completeOnboarding` spread arbitrary objects into Firestore, enabling privilege escalation.

6. **Broken JWT implementation** — `decodeFirebaseIdToken` in samlAuth.js, oidcAuth.js, and reports/export only does base64 decode — it never verifies the cryptographic signature. This makes the SAML SSO, OIDC provider, and report export features completely insecure.
