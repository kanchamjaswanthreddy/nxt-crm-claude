# NXT CRM — Full UX & UI Audit

**Date:** November 20, 2026
**Scope:** 51 dashboard pages, 6 auth pages, 7 public pages, 15+ shared components, 35+ server action files
**Method:** Code-only review. No browser rendering or screenshots were taken. Visual issues are inferred from code and noted as such. A live walkthrough would catch additional rendering, responsive, and interaction issues.

---

## 1. UX Researcher — Usability Review

**Rating: 6/10** — Core workflows function but several require too many clicks, provide inconsistent feedback, and violate standard heuristics.

### What Works Well

- **Clear information architecture.** Business, Admin, and Team sections are logically separated in the nav. Agents see only what they need; admins get a dropdown with management tools.
- **Lead and client creation flows are fast.** One form, minimal required fields, duplicate detection catches collisions early.
- **Quick Task modal** accessible from every page via the header button — excellent for capturing work without leaving context.
- **Onboarding flow** is multi-step with clear progress and covers personal info, employment, documents, and payment in a guided sequence.
- **Pipeline page** with drag-and-drop deal movement matches the mental model of a sales pipeline.

### Issues

| # | Issue | Location | Severity | Heuristic Violated |
|---|-------|----------|----------|---------------------|
| 1 | **No global search.** Users cannot search across leads, clients, deals, or tasks from one place. Each entity has its own search buried inside its page. A financial services rep managing 200+ contacts will waste significant time navigating to the right page first. | `layout.js` | Major | H7 — Flexibility and efficiency |
| 2 | **No breadcrumbs.** Detail pages (`/leads/[id]`, `/deals/[id]`, `/clients/[id]`, `/team/[id]`) have no breadcrumb trail. Users lose context of where they are and must use the browser back button. | All `[id]/page.js` detail pages | Major | H3 — User control, H1 — Visibility |
| 3 | **Alert dialogs for errors.** 17 dashboard pages use `alert()` for error feedback. This blocks the UI thread, cannot be styled, and breaks the user's flow. | `deals/new/page.js`, `settings/commissions/page.js`, `pipeline/page.js`, `tasks/page.js`, + 13 others | Major | H9 — Help users recover from errors |
| 4 | **Inconsistent feedback after actions.** Some pages show inline success messages, some use `alert()`, some silently succeed. After creating a deal, the user sees `alert("Deal created")`. After creating a client, they see an inline banner. No consistent pattern. | Multiple pages | Major | H1 — Visibility of system status |
| 5 | **Commission import is a multi-step process with no undo.** A wrong CSV import could create hundreds of incorrect commission records with no batch rollback. | `commissions/import/page.js` | Major | H3 — User control and freedom |
| 6 | **No keyboard shortcuts.** Power users (agents processing 20+ leads/day) have no way to speed up repetitive actions like "create lead", "next lead", "mark as contacted". | Entire app | Minor | H7 — Flexibility and efficiency |
| 7 | **Lead import field mapping is manual every time.** No saved mapping templates. Agencies importing leads weekly from the same source must re-map columns each time. | `leads/import/page.js` | Minor | H7 — Flexibility and efficiency |
| 8 | **No confirmation on destructive actions in some places.** Deleting a carrier update or removing a group member happens immediately with no "Are you sure?" step. | `business/carrier-updates/page.js`, `admin/groups/[groupId]/page.js` | Minor | H5 — Error prevention |
| 9 | **Reports page has no date range selector visible in the initial view.** Users must scroll or interact before filtering, making the first impression feel like a static page. | `reports/page.js` | Minor | H1 — Visibility |
| 10 | **Getting Started page** is useful for new agents but has no progress tracking or completion state. It stays in the nav permanently. | `getting-started/page.js` | Minor | H8 — Aesthetic and minimalist |

---

## 2. UI Designer — Visual & Layout Review

**Rating: 6.5/10** — Strong design tokens and a cohesive color palette, but heavy reliance on inline styles creates inconsistency across pages. Missing a true component library.

### What Works Well

- **Color palette is intentional.** Navy (#0F2A52), gold (#C99A3D), and a neutral gray scale create a professional financial services look. Status colors (green, amber, red) are well-chosen.
- **Typography scale is clean.** System font stack with SF Pro / Inter fallback looks sharp. The scale from 13px captions to 34px display is well-proportioned.
- **Card component** has layered shadows (10px + 4px + outline) that create genuine depth without feeling heavy.
- **Dashboard main page** is the best-designed page — bento grid, featured KPI card with gradient, pipeline visualization, and task list all work together.
- **Button component** is polished — gradient primary, pill shape, hover elevation, loading spinner.

### Issues

| # | Issue | Location | Severity | Fix |
|---|-------|----------|----------|-----|
| 1 | **Inline styles dominate (~60% of pages).** Maintenance nightmare. A spacing or color change requires editing dozens of files. | All dashboard pages | Major | Extract common patterns (page header, section card, filter bar) into CSS modules or shared components. |
| 2 | **Inconsistent empty states.** Clients page has a rich empty state (icon + heading + description + CTA button). Commissions page shows a plain `<td>No commissions found.</td>`. Help desk has a third variant. At least 3 different patterns exist. | `clients/page.js`, `commissions/page.js`, `help/page.js`, `admin/help/page.js` | Major | Create an `EmptyState` component with variants (rich, minimal, table-row). |
| 3 | **Inconsistent loading states.** Some pages show a styled spinner with descriptive text ("Loading clients..."). Others show bare "Loading..." text with no spinner. | `clients/page.js` (styled), `commissions/page.js` (bare text) | Major | Create a `LoadingSpinner` component. Use skeleton screens for data-heavy pages. |
| 4 | **No toast/notification system.** Success and error feedback varies between `alert()`, inline banners, and nothing. No snackbar or toast pattern exists. | Entire app | Major | Add a toast provider (e.g., Sonner or react-hot-toast) for consistent feedback. |
| 5 | **Tables lack consistent column alignment.** Some tables left-align all columns; others right-align numeric values. Amount columns should always be right-aligned. | `commissions/page.js`, `deals/page.js` | Minor | Standardize: text left, numbers right, actions center. |
| 6 | **Only 10 media queries across the entire app.** Most pages rely on flexbox wrapping, which works for simple layouts but breaks for complex ones (tables, multi-column forms, pipeline). | `dashboard.module.css`, `RosterTable.module.css` | Major | Add responsive breakpoints (768px, 480px) to all data-heavy pages. Tables should become card lists on mobile. |
| 7 | **Modal styling is not centralized.** Each modal builds its own overlay, backdrop, and container with inline styles. Slight variations in border-radius (8px, 10px, 12px), padding, and backdrop opacity exist across modals. | `InviteAgentModal.js`, `TaskQuickAddModal.js`, various inline modals | Minor | Create a `Modal` shell component. |
| 8 | **Status badges use inconsistent patterns.** RosterTable has 9 status variants with dedicated CSS classes. Help ticket badges use inline styles with different color logic. Deal stage badges use a third approach. | `RosterTable.module.css`, `help/page.js`, `deals/page.js` | Minor | Create a `StatusBadge` component with variant props. |
| 9 | **No dark mode support.** CSS variables are defined but only for light mode. No `prefers-color-scheme: dark` media query. Not blocking, but notable for a modern SaaS. | `globals.css` | Minor | Low priority. Would require a full pass. |
| 10 | **Page headers are not sticky.** When scrolling a long table (leads, clients, team), the page title and action buttons scroll away. Users must scroll back up to access filters or the "Add" button. | All list pages | Minor | Make page headers sticky with `position: sticky; top: 0`. |

---

## 3. Product Manager — Feature & Value Review

**Rating: 7/10** — Covers the core workflows of a financial services brokerage well. Some features are table stakes for a paying client but missing.

### What Works Well

- **Commission tracking is a differentiator.** Multi-tier overrides, carrier-specific rates, agent levels, bulk import, and distribution visualization go well beyond basic CRM functionality.
- **Role-based access and hierarchy** are well thought out. Agents see their own data, managers see their team, admins see everything. Group-based permissions (team-leaders, help-desk) add flexibility.
- **Document management with approval workflow** solves a real compliance need for insurance agencies — E&O certificates, AML training, state licenses all tracked with status.
- **Pipeline with Won/Lost flow** requires policy number and carrier for Won deals, and a reason for Lost deals — enforces data discipline.
- **Embeddable lead form** (`/embed/lead-form/[agencyId]`) lets agencies capture leads from their own websites.
- **NXT Help ticketing** gives agents an internal support channel — good for scaling.

### What's Missing or Needs Work

| # | Gap | Impact | Priority |
|---|-----|--------|----------|
| 1 | **No email/SMS integration.** Agents cannot email or text a lead/client from within the CRM. They must copy contact info and switch to another app. For a sales team, this is the #1 daily friction point. | High | High |
| 2 | **No activity timeline on lead/client detail pages.** There is a notes section and task list, but no unified timeline showing "called on Nov 10", "email sent Nov 12", "deal created Nov 15". Agents lose context on what happened and when. | High | High |
| 3 | **No calendar/scheduling view.** Tasks have due dates but there is no calendar visualization. Agents managing 50+ follow-ups need to see their week at a glance. | Medium | Medium |
| 4 | **No bulk actions on list pages.** Cannot select multiple leads to reassign, change status, or delete in batch. An admin cleaning up 100 stale leads must do it one by one. | Medium | Medium |
| 5 | **Reports are basic.** KPI cards and simple charts exist, but no cohort analysis, conversion funnel, or time-to-close metrics. For an agency owner, the question "How long does it take my agents to close a deal?" cannot be answered. | Medium | Medium |
| 6 | **No notifications system.** When a ticket is assigned, a deal moves stage, or a document is approved, the user finds out only by checking the relevant page. No bell icon, no in-app alerts, no email notifications for CRM events. | High | High |
| 7 | **Scoreboard only shows deals and revenue.** Add activity metrics (calls logged, notes added, tasks completed) to give a fuller picture of agent effort, not just outcomes. | Low | Low |
| 8 | **Marketing Data page is just a Google Drive folder link.** No preview, no search, no tagging. It is essentially a bookmark. | Low | Low |
| 9 | **No client portal.** Clients cannot log in to view their policies, sign documents, or submit requests. Everything goes through the agent. | Low | Future |
| 10 | **NXT Academy (Learn) is a static list.** No progress tracking, no completion certificates, no quizzes. For a company that emphasizes education-first, this is underdeveloped. | Low | Medium |

### What Could Be Removed or Simplified

- **Business > Insurance / Annuities / Trail / Renewals** — These are essentially filtered views of the same deals table. Consider consolidating into a single "Business" page with tabs or filters instead of 4 separate nav items.
- **Calculator page** — Useful but could be a modal or sidebar tool rather than a full page.

---

## 4. QA Tester — Bug & Edge Case Review

**Rating: 5.5/10** — Core happy paths work, but validation gaps, missing error handling, and untested edge cases would cause real problems in production.

### What Works Well

- All server actions use `requireUser()` auth checks consistently.
- Agency isolation is enforced on every Firestore query (`agencyId` scoping).
- Duplicate detection on lead/client creation prevents obvious collisions.
- Account lockout after 5 failed login attempts (15-minute window).

### Issues

| # | Issue | Location | Severity | Fix |
|---|-------|----------|----------|-----|
| 1 | **No server-side string length limits.** A user could submit a lead with a 100,000-character first name. No `maxLength` enforcement exists on the server for firstName, lastName, description, subject, or any text field. | All action files (`leads.js`, `clients.js`, `help.js`, etc.) | Critical | Add `if (field.length > MAX) return error` checks on all text fields in server actions. |
| 2 | **Embed lead form has no bot protection.** The public lead form at `/embed/lead-form/[agencyId]` has a TODO comment for reCAPTCHA (line 46) but no implementation. Any bot can spam hundreds of leads into an agency. | `embed/lead-form/[agencyId]/page.js` | Critical | Implement reCAPTCHA, honeypot field, or rate limiting. |
| 3 | **246 console.log/error/warn statements in production code.** These leak internal error details to anyone with browser DevTools open and add noise. | Across all `src/app/` files | Major | Replace with a proper logging service. Remove all client-side console statements. |
| 4 | **Phone number has no server-side validation.** Client-side has `maxLength={10}` on some forms but the server accepts any string. Invalid phone numbers will pollute data. | `leads.js`, `clients.js` server actions | Major | Add phone regex validation server-side. |
| 5 | **Email validation is too permissive.** Regex `/^\S+@\S+\.\S+$/` accepts `a@b.c`, `@@..`, and other invalid formats. | `leads.js` line ~35, `clients.js` | Major | Use a stricter regex or validation library. |
| 6 | **Commission import has no rollback.** A CSV with 500 rows creates 500 Firestore documents. If 200 succeed and the 201st fails, there is no way to undo the partial import. | `commissions/import/page.js`, action file | Major | Use Firestore batch writes with rollback, or add an "undo last import" feature. |
| 7 | **No rate limiting on form submissions.** Only the contact data export has rate limiting (5/hour). Lead creation, client creation, deal creation, and ticket creation have none. | Server actions | Major | Add rate limiting to all create operations (e.g., 50 leads/hour per user). |
| 8 | **Pipeline drag-and-drop has no optimistic rollback.** If the server rejects a stage change after the user drops a deal, the UI may show the deal in the wrong column until page refresh. | `pipeline/page.js` | Minor | Snapshot state before drag, rollback on server error. |
| 9 | **Long text overflows in table cells.** No `text-overflow: ellipsis` or `max-width` on table cells. A lead with a 200-character name will stretch the table. | All table pages | Minor | Add `overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px` to text cells. |
| 10 | **No session timeout handling.** If a user's Firebase session expires while they are on a dashboard page, the next server action will fail silently with "Unauthorized". No redirect to login, no "Session expired" message. | All pages | Major | Add a global error interceptor that redirects to `/auth/login` on 401 responses. |

---

## 5. Accessibility Reviewer — WCAG 2.1 AA

**Rating: 4/10** — Significant accessibility gaps. Would not pass a WCAG 2.1 AA audit. Most issues stem from using `<div>` for interactive elements and missing ARIA attributes.

### What Works Well

- `Input` component properly associates `<label>` with `<input>` via `htmlFor`.
- Dashboard main page uses `role="button"` and `tabIndex={0}` on clickable divs (5 instances).
- `InteractiveBackground` component respects `prefers-reduced-motion`.
- Layout has `aria-label="Toggle navigation"` on the mobile menu button.

### Issues

| # | Issue | Location | Severity | Fix |
|---|-------|----------|----------|-----|
| 1 | **Clickable `<div>` elements without keyboard support.** At least 10 instances of `<div onClick>` without `role="button"`, `tabIndex={0}`, or `onKeyDown` handlers. These are completely invisible to keyboard and screen reader users. | `tasks/page.js` line 285, `help/page.js` lines 492/587, + others | Critical | Replace with `<button>` elements, or add `role="button" tabIndex={0} onKeyDown`. |
| 2 | **Only 14 ARIA attributes across 51 dashboard pages.** That is 0.27 ARIA attributes per page. Forms, tables, modals, and dynamic content regions have almost no ARIA support. | Entire dashboard | Critical | Add `aria-label` to icon-only buttons, `aria-live` to dynamic regions, `role="dialog"` to modals, `aria-sort` to table headers. |
| 3 | **Modals do not trap focus.** When a modal opens, keyboard focus can tab behind it to the page content. No focus trap, no `Escape` to close (in most modals), no `aria-modal="true"`. | `TaskQuickAddModal.js`, `InviteAgentModal.js`, all inline modals | Critical | Implement focus trap. Add `role="dialog" aria-modal="true"`. Restore focus on close. |
| 4 | **No skip navigation link.** There is no "Skip to main content" link for keyboard users to bypass the navigation bar. | `layout.js` | Major | Add `<a href="#main" class="sr-only focus:visible">Skip to main content</a>` before nav. |
| 5 | **Tables lack proper header semantics.** Some tables use `<div>` grids instead of `<table>`, `<thead>`, `<th scope="col">`. Screen readers cannot parse these as data tables. | `help/page.js`, `admin/help/page.js` | Major | Use semantic `<table>` elements with proper `<th>` and `scope` attributes. |
| 6 | **Color used as only differentiator.** Status badges (open=green, closed=red, in_progress=blue) rely on color alone with no icon or text prefix to distinguish them for colorblind users. | `help/page.js`, `RosterTable` status badges | Major | Add an icon or text prefix (e.g., a dot + the word "Open") alongside color. |
| 7 | **Placeholder text contrast is likely insufficient.** `var(--brand-silver)` (#A9ACB1) on white (#FFFFFF) has a contrast ratio of approximately 2.6:1. WCAG AA requires 4.5:1 for text. | `Input.module.css` | Major | Darken placeholder to at least #767676 (4.5:1 on white). |
| 8 | **Form error messages rely on color alone.** Red text with no icon. Users who cannot see red will miss the error. | `Input.module.css` error state, inline error banners | Major | Add an error icon (warning triangle or exclamation) before error text. |
| 9 | **No `lang` attribute verification.** The HTML document should have `lang="en"`. | `layout.js` root | Minor | Verify `<html lang="en">` is set. |
| 10 | **No visible focus indicator on most custom elements.** Buttons and inputs have focus rings, but card links, nav items, and status filters do not show a visible focus outline. | Nav items in `layout.js`, filter buttons | Major | Add `outline: 2px solid var(--brand-blue-accent)` on `:focus-visible` for all interactive elements. |

---

## 6. Design Lead — Overall Verdict

**Rating: 6/10** — This CRM is functionally impressive for a solo-built product. It covers an unusually wide surface area (commissions, compliance docs, pipeline, ticketing, onboarding, role-based access) that would take a team of 4-5 engineers months to build. The architecture is sound and the data model is well-designed.

However, it is **not ready for a paying external client** without addressing:

1. **Consistency.** The mix of inline styles, CSS modules, `alert()` dialogs, and varied empty/loading/error states creates an unpolished feel. A paying user will notice that some pages feel finished and others feel like prototypes.

2. **Accessibility.** The app would fail a WCAG 2.1 AA audit. For a financial services product, this is both a legal risk (ADA compliance) and a usability issue. Focus traps, keyboard navigation, and screen reader support are essentially absent.

3. **Error resilience.** No server-side string limits, no bot protection on the public form, no session timeout handling, and no commission import rollback mean that one bad input or one expired session can cause real data problems.

4. **Communication layer.** No email, no SMS, no in-app notifications. A CRM without communication is a database with a UI. This is the single biggest functional gap.

The product has a **strong foundation** and an **ambitious scope** that covers real insurance brokerage workflows. The fix list below is ordered to maximize perceived quality improvement per hour of work.

---

## Summary

### Overall Score: 5.8 / 10

| Perspective | Score | One-Line |
|-------------|-------|----------|
| UX Researcher | 6/10 | Workflows function but feedback, search, and navigation need work |
| UI Designer | 6.5/10 | Strong tokens and palette, undermined by inline style sprawl and inconsistency |
| Product Manager | 7/10 | Deep feature set for insurance, missing communication and notifications |
| QA Tester | 5.5/10 | Happy paths work, but validation gaps and no rollback on bulk ops are risky |
| Accessibility | 4/10 | Would fail WCAG AA; keyboard/screen reader support nearly absent |
| Design Lead | 6/10 | Impressive solo build, not client-ready without consistency and a11y fixes |

---

## Top 10 Fixes Ranked by Impact vs. Effort

| Rank | Fix | Impact | Effort | Pages Affected |
|------|-----|--------|--------|----------------|
| 1 | **Add a toast notification system** (replace all `alert()` calls and add success/error toasts). Install `react-hot-toast` or `sonner`, create a provider, replace 17 pages of `alert()`. | Very High | 2-3 hours | 17+ pages |
| 2 | **Add server-side string length limits.** Add `if (str.length > 500) return error` to all text fields in server actions. Prevents data abuse. | Very High | 1-2 hours | All action files |
| 3 | **Implement bot protection on embed lead form.** Add a honeypot field + basic rate limiting. reCAPTCHA can follow later. | Very High | 1 hour | 1 page + 1 action |
| 4 | **Create a shared `EmptyState` component.** Icon + heading + description + optional CTA. Replace the 5+ different patterns. | High | 1-2 hours | 10+ pages |
| 5 | **Create a shared `LoadingSpinner` component.** Spinner + text. Replace bare "Loading..." text and inconsistent inline spinners. | High | 30 min | 15+ pages |
| 6 | **Add `role="button"` and keyboard handlers to all clickable divs.** Grep for `<div onClick`, add semantics. | High | 2 hours | 10+ instances |
| 7 | **Add focus trap to all modals.** Use a lightweight library like `focus-trap-react`. Add `Escape` to close, `aria-modal="true"`. | High | 2-3 hours | 5+ modals |
| 8 | **Add breadcrumbs to detail pages.** Simple component: Home > Leads > Lead Name. | Medium | 1-2 hours | 6 detail pages |
| 9 | **Add session timeout redirect.** Wrap server action calls in a handler that checks for "Unauthorized" and redirects to login with a message. | High | 1-2 hours | Global |
| 10 | **Remove all console.log/error statements.** Replace with proper error boundaries or remove. | Medium | 1-2 hours | 246 statements |

---

## Quick Wins (Under 1 Hour Each)

1. **Darken placeholder text color** — Change `var(--brand-silver)` to `#767676` in `Input.module.css`. (5 min)
2. **Add `aria-label` to icon-only buttons** — Search for buttons with only SVG children, add labels. (30 min)
3. **Add error icons to form error messages** — Prepend a warning icon to the error `<span>` in `Input.js`. (15 min)
4. **Add "Skip to main content" link** — One `<a>` tag in `layout.js` with an `sr-only` class. (10 min)
5. **Add `text-overflow: ellipsis`** to table text cells globally via a CSS utility class. (20 min)
6. **Add a "No results" row** to any table that currently just shows nothing when filters return 0. (30 min)
7. **Add `lang="en"` to `<html>` tag** if missing. (2 min)
8. **Hide "Getting Started" nav link** once the user has completed onboarding. (30 min)
9. **Right-align numeric columns** (premium, commission amounts) in all tables. (20 min)
10. **Add phone validation regex** to server actions: `/^\d{10}$/` or similar. (15 min)

---

*This audit was conducted via code review only. A live browser walkthrough with Lighthouse, axe DevTools, and manual keyboard testing would uncover additional rendering and interaction issues. Recommend running that as a follow-up.*
