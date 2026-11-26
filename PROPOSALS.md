# NXT CRM — Feature Proposals

**Date:** November 20, 2026
**Context:** These proposals address audit issues PM-1, PM-5, PM-7, PM-8, PM-9, PM-10, and UI-9 from the UX Audit. Each section describes the problem, proposed solution, scope, effort estimate, and priority. None of these are built — they are decision documents for review.

---

## 6.1 Email and SMS Integration

**Audit ref:** PM-1 (High impact, High priority)

### Problem

Agents cannot email or text a lead/client from within the CRM. They must copy contact info, switch to Gmail/Outlook/phone, compose, then return. For a team processing 20+ leads per day, this context-switching is the single largest daily friction point. No communication history is captured in the CRM either, so the next agent who touches a lead has no visibility into prior outreach.

### Proposed Solution

**Phase A — Email (SendGrid or Resend)**

1. Add a "Send Email" button on lead and client detail pages.
2. Compose modal: To (pre-filled), Subject, Body (rich text), optional template selection.
3. Server action calls SendGrid/Resend API to send. Store a record in a `communications` Firestore collection: `{ contactId, contactType, channel: 'email', subject, body, sentAt, sentBy, agencyId }`.
4. Show sent emails in the Activity Timeline on detail pages.
5. Email templates: Admin can create reusable templates (welcome, follow-up, renewal reminder) from a Settings page.

**Phase B — SMS (Twilio)**

1. Add a "Send SMS" button on lead and client detail pages (only if phone exists).
2. Compose modal: To (pre-filled), Body (160 char limit shown), send button.
3. Server action calls Twilio API. Store record in same `communications` collection with `channel: 'sms'`.
4. Show in Activity Timeline.
5. Opt-out handling: If a contact replies STOP, mark them as `smsOptOut: true` and block further sends.

**Phase C — Inbound (Future)**

- Webhook endpoints for SendGrid inbound parse and Twilio incoming SMS.
- Match to existing contacts by email/phone, create timeline entries.
- Notify assigned agent via in-app notification.

### Scope

- 2 new server action files (`actions/email.js`, `actions/sms.js`)
- 1 new Firestore collection (`communications`)
- Compose modal component (shared for email/SMS)
- Email template CRUD (admin settings page)
- Activity Timeline integration (already built in Phase 5)
- Environment variables: `SENDGRID_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

### Effort

- Phase A (Email): 3-4 days
- Phase B (SMS): 2-3 days
- Phase C (Inbound): 3-5 days (can defer)

### Priority: HIGH

This is the most impactful feature gap. A CRM without communication is a database with a UI.

### Dependencies

- SendGrid or Resend account with verified sender domain
- Twilio account with a phone number for SMS
- Activity Timeline component (done — Phase 5.7)

---

## 6.2 Client Portal

**Audit ref:** PM-9 (Low impact, Future priority)

### Problem

Clients have no self-service access. To check policy status, download documents, or submit a service request, they must call or email their agent. This creates unnecessary load on agents for routine inquiries and makes the agency feel less professional compared to carriers that offer online portals.

### Proposed Solution

A separate, lightweight client-facing portal at `/portal` (or a subdomain) with its own auth flow.

**Features:**

1. **Login via magic link** — Client receives an email with a one-time login link. No password to manage. Token expires in 15 minutes, session lasts 30 days.
2. **Dashboard** — Shows active policies (from deals marked "Won"), upcoming renewal dates, and agent contact info.
3. **Documents** — View and download documents shared by their agent (e.g., policy declarations, ID cards). Agent marks documents as "client-visible" from the CRM side.
4. **Service requests** — Client can submit a request (address change, beneficiary update, claim question) that creates an NXT Help ticket assigned to their agent.
5. **Profile** — View and update contact info (address, phone, email). Changes create a pending update that the agent must approve.

**What it does NOT include:**

- Payment processing
- Policy binding or quoting
- Direct carrier integration
- Chat or messaging

### Scope

- New Firestore collection: `portal_sessions` (magic link tokens)
- New pages under `/portal/` (login, dashboard, documents, requests, profile)
- Server actions for portal auth, document listing, request submission
- Agent-side toggle on documents: "Share with client"
- Email template for magic link delivery

### Effort

- 5-7 days for MVP (login + dashboard + documents + requests)
- +2-3 days for profile editing with approval flow

### Priority: LOW (Future)

Nice-to-have for agency professionalism. Not blocking daily operations. Recommend building after email/SMS integration is live, since magic link delivery depends on email infrastructure.

---

## 6.3 Academy Progress Tracking / Quizzes / Certificates

**Audit ref:** PM-10 (Low impact, Medium priority)

### Problem

NXT Academy (`/dashboard/learn`) is currently a static list of training resources. There is no tracking of which modules an agent has completed, no assessments to verify understanding, and no certificates for compliance purposes. For a company that emphasizes education-first culture, this is underdeveloped.

### Proposed Solution

**Phase A — Progress Tracking**

1. Each training module gets a "Mark as Complete" button. Completion is stored per-agent in Firestore (`training_progress` collection: `{ agentId, moduleId, completedAt, agencyId }`).
2. Progress bar on the Academy page showing X of Y modules completed.
3. Admin view: table showing each agent's completion percentage. Filter by module or agent.
4. Getting Started checklist integration: "Complete 3 Academy modules" as a step.

**Phase B — Quizzes**

1. Admin can attach a quiz to any module (5-10 multiple choice questions).
2. Quiz data stored in Firestore (`training_quizzes` collection). Questions, options, correct answer index.
3. Agent must pass the quiz (70%+) to mark the module as complete.
4. Failed attempts show which questions were wrong with brief explanations.
5. Unlimited retries.

**Phase C — Certificates**

1. When an agent completes all modules in a "track" (e.g., "New Agent Onboarding", "Compliance Basics"), generate a PDF certificate.
2. Certificate includes: agent name, track name, completion date, agency logo.
3. Use a client-side PDF library (e.g., `@react-pdf/renderer`) to generate.
4. Certificates appear in the agent's profile and in the admin's compliance view.

### Scope

- 1 new Firestore collection (`training_progress`), 1 optional (`training_quizzes`)
- Modifications to `/dashboard/learn` page
- New admin page: `/dashboard/admin/training`
- PDF generation component for certificates

### Effort

- Phase A: 2 days
- Phase B: 2-3 days
- Phase C: 1-2 days

### Priority: MEDIUM

Useful for compliance and onboarding. Phase A alone adds significant value and is low effort.

---

## 6.4 Advanced Reports (Conversion Funnel, Time-to-Close)

**Audit ref:** PM-5 (Medium impact, Medium priority)

### Problem

The current reports page shows KPI summary cards and basic charts, but cannot answer critical business questions like:

- "What is our lead-to-client conversion rate?"
- "How long does it take my agents to close a deal on average?"
- "Where in the pipeline do we lose the most deals?"
- "Which lead sources produce the highest conversion rate?"

Agency owners making hiring, training, and marketing decisions need these insights.

### Proposed Solution

Add 4 new report sections to the existing reports page (or as sub-tabs):

**1. Conversion Funnel**

- Visual funnel chart: Leads Created > Contacted > Qualified > Deal Created > Won
- Show drop-off percentage at each stage
- Filter by date range, lead source, assigned agent
- Compare periods (this month vs. last month)

**2. Time-to-Close Analysis**

- Average days from lead creation to deal Won, broken down by:
  - Agent (bar chart)
  - Lead source (bar chart)
  - Deal size bucket (< $1K, $1K-$5K, $5K-$25K, $25K+)
- Trend line over time (monthly average)

**3. Pipeline Health**

- Deals by stage with aging: how long has each deal been in its current stage?
- Stale deal alert: deals that haven't moved in 30+ days
- Win rate by stage (what % of deals that reach "Proposal" eventually close?)

**4. Source ROI**

- Leads by source with conversion rate and average deal value
- Cost-per-lead input (manual) to calculate ROI per source
- Table format with sortable columns

### Technical Approach

All data already exists in Firestore (leads, deals, pipeline stages). The reports would be computed server-side in a new `fetchAdvancedReports` server action that runs aggregate queries. For performance, consider:

- Caching results for 15 minutes (reports don't need real-time data)
- Running heavy queries with Firestore composite indexes
- Pagination for large date ranges

### Scope

- 1 new server action file (`actions/advanced-reports.js`)
- 4 new chart sections on reports page (or sub-tabs)
- Chart library: use existing chart setup or add `recharts`

### Effort

- 4-5 days for all 4 reports
- 1-2 days for caching and performance optimization

### Priority: MEDIUM

High value for agency owners. Not urgent for agents' daily workflow but critical for business decision-making.

---

## 6.5 Consolidate Business Nav Items

**Audit ref:** PM — "What Could Be Removed or Simplified" section

### Problem

The Business section in the sidebar currently has 5 separate nav items:

- New Businesses (deals)
- Pipeline
- Insurance
- Annuities
- Trail
- Renewals

Insurance, Annuities, Trail, and Renewals are essentially filtered views of the same deals/policies data. This creates a cluttered navigation and forces users to guess which page has the data they need. An agent looking for a specific policy may check 3-4 pages before finding it.

### Proposed Solution

Consolidate into 3 nav items:

1. **Deals** — The current New Businesses page (active deals and pipeline)
2. **Pipeline** — The visual pipeline board (keep as-is, it serves a different interaction model)
3. **Book of Business** — A unified page that replaces Insurance/Annuities/Trail/Renewals

**Book of Business page design:**

- Single table of all won deals / active policies
- Filter bar at top with tabs or dropdown: All | Insurance | Annuities | Trail | Renewals
- URL state: `/dashboard/business?type=insurance` preserves filter in URL for sharing/bookmarking
- Same columns: client name, carrier, policy number, premium, commission, status, dates
- Search across all types
- Export to CSV

### Migration

- Redirect old URLs (`/dashboard/business/insurance`) to `/dashboard/business?type=insurance` for bookmarks
- Remove 4 separate page files, replace with 1 unified page
- Update sidebar nav

### Scope

- 1 new unified page (`/dashboard/business/page.js`)
- Remove 4 pages (`insurance/`, `annuities/`, `trail/`, `renewals/`)
- Update `layout.js` sidebar
- Add redirects for old URLs

### Effort

- 2 days

### Priority: MEDIUM

Reduces nav clutter and simplifies the mental model. Low risk since it is a UI reorganization, not a data change.

---

## 6.6 Marketing Data Page Improvements

**Audit ref:** PM-8 (Low impact, Low priority)

### Problem

The Marketing Data page (`/dashboard/marketing-data`) is currently just a link to a Google Drive folder. There is no preview, no search, no tagging, and no way to know what marketing materials are available without leaving the CRM. It is essentially a bookmark.

### Proposed Solution

**Option A — Lightweight (Recommended)**

Keep Google Drive as the source of truth but improve the in-CRM experience:

1. **Folder browser** — Use the Google Drive API to list files and folders in the shared marketing folder. Show thumbnails for images/PDFs, file names, last modified dates.
2. **Search** — Filter files by name within the CRM.
3. **Preview** — Click to open a preview modal (images rendered inline, PDFs via Google's embed viewer, other files open in new tab).
4. **Categories** — Map top-level folders to category tabs (e.g., "Flyers", "Social Media", "Email Templates", "Presentations").
5. **Download** — Direct download button per file.

**Option B — Full CMS (Future)**

Replace Google Drive with an in-CRM asset manager:

1. Upload files directly to Firebase Storage or Vercel Blob.
2. Tag, categorize, and version assets.
3. Agent can "request" assets (e.g., "I need a flyer for Medicare open enrollment").
4. Admin can publish/unpublish assets.

Option B is significantly more effort and only warranted if the agency outgrows Google Drive.

### Scope (Option A)

- Google Drive API integration (service account with read access to the shared folder)
- 1 new server action file (`actions/marketing.js`)
- Rewrite of `/dashboard/marketing-data/page.js`
- Environment variable: `GOOGLE_DRIVE_FOLDER_ID`, service account credentials

### Effort

- Option A: 2-3 days
- Option B: 5-7 days

### Priority: LOW

Nice improvement but not blocking any workflow. Agents can still use the Google Drive link directly.

---

## 6.7 Dark Mode

**Audit ref:** UI-9 (Minor severity)

### Problem

The CRM only supports light mode. CSS custom properties are defined in `globals.css` but only for the light theme. No `prefers-color-scheme: dark` media query exists. While not a functional gap, dark mode is expected in modern SaaS products, reduces eye strain for agents working evening shifts, and signals product maturity.

### Proposed Solution

**Approach: CSS custom property swap**

The existing design token system (`--brand-navy`, `--surface-card`, `--text-primary`, etc.) makes this feasible without touching component code. The implementation:

1. **Define dark palette** — Create a `[data-theme="dark"]` selector in `globals.css` that overrides all custom properties:

   | Token | Light | Dark |
   |-------|-------|------|
   | `--surface-page` | `#F7F8FA` | `#0D1117` |
   | `--surface-card` | `#FFFFFF` | `#161B22` |
   | `--surface-inset` | `#F0F1F4` | `#21262D` |
   | `--text-primary` | `#0F2A52` | `#E6EDF3` |
   | `--text-secondary` | `#5A6678` | `#8B949E` |
   | `--border-color` | `#E2E5EA` | `#30363D` |
   | `--brand-navy` | `#0F2A52` | `#58A6FF` (accent blue) |
   | `--brand-gold` | `#C99A3D` | `#D4A849` (slightly brighter) |
   | `--shadow-*` | current | darker, more subtle |

2. **Theme toggle** — Add a sun/moon toggle button in the sidebar footer (next to the notification bell). Store preference in `localStorage` and respect `prefers-color-scheme` as default.

3. **System preference detection** — On first visit, check `window.matchMedia('(prefers-color-scheme: dark)')`. If true, default to dark. User can override.

4. **Audit pass** — Some components use hardcoded colors in inline styles (e.g., `color: '#fff'`, `backgroundColor: 'rgba(0,0,0,0.5)'`). These need to be converted to use CSS variables. Estimate 20-30 instances across the codebase.

### What does NOT change

- Component structure
- Server actions
- Firestore schema
- No new dependencies required

### Scope

- Modify `globals.css` with dark theme variables
- Add theme toggle component
- Audit and fix 20-30 hardcoded color values in inline styles
- Test all pages in both themes

### Effort

- 2-3 days (mostly the inline style audit and testing)

### Priority: LOW

No functional impact. Recommend implementing after all higher-priority features are live. However, the CSS variable foundation is already in place, making this lower effort than it would be otherwise.

---

## Priority Summary

| # | Proposal | Priority | Effort | Audit Ref |
|---|----------|----------|--------|-----------|
| 6.1 | Email and SMS Integration | HIGH | 5-7 days (Phase A+B) | PM-1 |
| 6.4 | Advanced Reports | MEDIUM | 4-5 days | PM-5 |
| 6.5 | Consolidate Business Nav | MEDIUM | 2 days | PM simplification |
| 6.3 | Academy Progress Tracking | MEDIUM | 2-5 days (phased) | PM-10 |
| 6.6 | Marketing Data Improvements | LOW | 2-3 days | PM-8 |
| 6.7 | Dark Mode | LOW | 2-3 days | UI-9 |
| 6.2 | Client Portal | LOW (Future) | 5-7 days | PM-9 |

**Recommended build order:** 6.1 > 6.4 > 6.5 > 6.3 > 6.7 > 6.6 > 6.2
