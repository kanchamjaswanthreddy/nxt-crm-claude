# Insurance CRM — Master Build Spec
## Part A: Design Language · Part B: Phase 1 (Auth & Foundation)

---

## PART A — DESIGN SYSTEM (applies to every phase)

**Reference feel:** Apple's own software (Settings, Notes, Calendar, App Store on macOS/iOS) — calm, confident, low-noise. Never busy, never cramped.

### Typography
- Font stack: `-apple-system, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif`
- Scale: 34/28/22/17/15/13px (display / h1 / h2 / body / secondary / caption)
- Weight: regular body, medium (500) for emphasis, semibold (600) only for page titles — never bold walls of text
- Line height: 1.4–1.6 for body text
- Line length: cap paragraph/table text at ~75 characters for readability

### Color — NXT Financial Group brand palette

Derived from the NXT Financial Group logo (navy / gold / silver):

| Token | Hex | Usage |
|---|---|---|
| `--brand-navy` | `#0F2A52` | Primary UI color — nav bar, headers, primary buttons, active nav item |
| `--brand-navy-light` | `#1B3A6B` | Hover/lighter variant of navy, secondary headers |
| `--brand-blue-accent` | `#2D6FC4` | Links, secondary interactive elements |
| `--brand-gold` | `#C99A3D` | Reserved for brand accents only: logo mark, premium/featured badges, primary CTA highlight, key data callouts. Not used for status. |
| `--brand-gold-light` | `#F2C94C` | Gold gradient highlight / hover state on gold elements only |
| `--brand-silver` | `#A9ACB1` | Secondary neutral — borders, dividers, inactive icons, secondary text on light backgrounds |
| `--surface-page` | `#FAFAFA` | App background |
| `--surface-card` | `#FFFFFF` | Cards, panels |

**Semantic status colors are kept deliberately separate from brand gold** so a "pending" or "warning" state never reads as a branding choice:
- Success / active: green (`#2FA84F`)
- Warning / pending: amber-orange (`#E08E2B`) — visually distinct from brand gold, cooler/more orange
- Error / overdue: red (`#D33F3F`)
- Inactive / neutral: brand silver

**Usage rules:**
- Navy is the dominant color of the interface — sidebar, top bar, primary buttons, headers
- Gold appears sparingly: the logo itself, one accent line/highlight per screen, badges for top performers or featured items — never as a full background or on more than one element per view
- Silver/gray handles all the "quiet" UI: borders, dividers, placeholder text, disabled states
- Dark mode: navy inverts to a deep charcoal-navy background (`#12203A`) with the gold and silver accents unchanged — gold especially should still pop against a dark surface, this is where it does its best work
- Dark mode is a first-class citizen, not an afterthought — every screen designed in both from day one

### Spacing & layout
- 8pt grid for all spacing (8, 16, 24, 32, 48px)
- Generous whitespace around content — never edge-to-edge dense tables without breathing room
- Sidebar + minimal top bar navigation; no more than 2 levels of nesting visible at once
- Cards: 12–16px corner radius, 1px hairline border or soft shadow — never both heavy border + heavy shadow

### Buttons & corner radius (Apple-style — applies to every component, every phase)

Apple's language uses **fully rounded, pill/capsule buttons** for primary actions, with consistent, generous rounding everywhere else. No sharp corners anywhere in the interface.

| Component | Corner radius | Notes |
|---|---|---|
| Primary button | `border-radius: 999px` (full capsule) | Height 40–44px. Radius = half the height, always a true pill, never a rounded rectangle |
| Secondary / outline button | `999px` (full capsule) | Same pill shape, navy border on white/transparent fill, not a filled block |
| Small / inline button (table row actions, chips) | `999px` | Smaller pill, 28–32px height |
| Icon-only button | `50%` (perfect circle) | Square bounding box, fully circular |
| Text input / search field | `12px` | Rounded rect, not a pill — pills read oddly on wide inputs |
| Dropdown / select | `12px` | Matches input fields |
| Card / panel | `16px` | Slightly larger than inputs for visual hierarchy |
| Modal / sheet | `20px` (top corners only on bottom sheets, all corners on centered modals) | |
| Badge / status pill | `999px` | Always a full capsule — "pill" badges reinforce status at a glance |
| Toggle switch | `999px` (track), `50%` (thumb) | Standard Apple switch shape |
| Avatar | `50%` | Circular, always |
| Tooltip | `10px` | Smaller radius than cards |

**Rules:**
- No button anywhere in the product uses a small/sharp radius (4–8px) — that reads as "Windows," not Apple. If it's a button, it's either a full capsule or a perfect circle (icon-only).
- Radius scales with component size but never drops below 12px on anything rectangular, and buttons specifically are always pill-shaped regardless of size.
- Consistency check per phase: before marking any phase done, scan every button/badge/toggle built in that phase and confirm it matches this table exactly — this is checked every phase, not just once.

### Motion
- Transitions 150–250ms, ease-in-out — never bouncy, never longer than 300ms
- Motion communicates state change (a row appearing, a panel sliding in) — never decorative
- Respect `prefers-reduced-motion`

### Interaction & feedback (the "seamless" part)
- Every action has three visible states: idle → loading (inline spinner/skeleton, never a blank screen) → success/error (toast or inline confirmation)
- Destructive actions (delete contact, remove agent) always require a confirmation step
- Forms validate inline, field-by-field, as the user types or on blur — never only on submit
- No dead ends: every error state includes a clear next step ("Try again", "Contact support"), never just a red message

### Accessibility (non-negotiable, checked every phase)
- WCAG AA contrast minimum on all text/background pairs
- Full keyboard navigation + visible focus rings
- All icon-only buttons have `aria-label`s
- Forms have proper `<label>` associations, not placeholder-only fields

---

## PART B — PHASE 1: AUTH, ONBOARDING & FOUNDATION

### 1. Screens in this phase

| Screen | Purpose |
|---|---|
| Sign up (agency admin) | First user creates the agency + their own admin account |
| Log in | Email + password, "forgot password" link |
| Forgot / reset password | Email link → set new password |
| Email verification | Sent on signup, required before full access |
| Invite acceptance | Invited agent clicks emailed link → sets password → lands in onboarding |
| Onboarding wizard (admin) | Agency name, branding, first pipeline stage names |
| Onboarding wizard (agent) | Profile photo, phone, upline confirmation, notification preferences |
| Account settings | Change password, update profile, manage sessions |

### 2. Data model (extends Phase 0 ERD)

```
Agency
  id (uuid, PK)
  name
  logo_url
  settings (jsonb)  -- pipeline stage names, timezone, etc.
  created_at

Agent
  id (uuid, PK)
  agency_id (FK -> Agency)
  upline_id (FK -> Agent, nullable)
  full_name
  email (unique)
  phone
  role (enum: admin, manager, agent)
  status (enum: invited, active, suspended)
  password_hash
  email_verified_at (nullable)
  last_login_at
  created_at

Invite
  id (uuid, PK)
  agency_id (FK -> Agency)
  email
  role (enum)
  upline_id (FK -> Agent, nullable)
  token (unique, random)
  status (enum: pending, accepted, expired, revoked)
  expires_at
  created_at
```

### 3. Core flows

**Sign up (first admin / new agency)**
1. Enter agency name, full name, email, password, confirm password
2. Client-side validation live: email format, password strength meter (min 10 chars, 1 number, 1 symbol), passwords match
3. On submit: check email uniqueness server-side → create Agency + Agent(role=admin, status=invited) → send verification email
4. Show "check your email" state with a resend option (rate-limited: 1 resend per 60s)

**Invite an agent (admin/manager action, built here since login depends on it)**
1. Admin/manager enters email + selects upline (defaults to themselves) + role
2. System creates Invite row, emails a signed token link (expires in 7 days)
3. Invitee clicks link → token validated (not expired, not already used) → sets password → Agent row created with status=active, email_verified_at=now

**Log in**
1. Email + password
2. Failed attempts: after 5 consecutive failures on one account, 15-minute lockout with a clear message and a "reset password" shortcut — never a generic "try again"
3. Successful login with `email_verified_at = null` → redirected to "verify your email" screen, not the dashboard

**Forgot password**
1. Enter email → always show the same "if that email exists, we sent a link" message (don't reveal whether the account exists)
2. Reset link expires in 1 hour, single-use

### 4. Error handling checklist (verify every one before calling this phase done)

- [ ] Duplicate email on signup → inline error under the field, not a toast
- [ ] Weak password → live strength indicator, submit button disabled until minimum met
- [ ] Mismatched confirm-password → inline error, cleared as soon as it matches
- [ ] Expired/used invite token → clear message + "ask your admin to resend"
- [ ] Expired/used reset token → clear message + link back to "forgot password"
- [ ] Network failure mid-submit → form data preserved, retry banner shown, no silent data loss
- [ ] Login lockout → message states exact wait time, updates live
- [ ] Unverified email trying to access dashboard routes → redirected server-side, not just hidden in UI
- [ ] Session expiry during active use → redirect to login with a "your session expired" message, and return user to the page they were on after re-auth
- [ ] All error copy is specific and actionable — never "Something went wrong"

### 5. Access rules established here (used by every later phase)
- `agent.status` must be `active` and `email_verified_at` not null to access any authenticated route
- Row visibility rule: an agent may access a record if `record.owner_agent_id = agent.id` OR `record.owner_agent_id` is in `agent`'s recursive downline
- Only `admin` role can invite other admins; `manager` and `admin` can invite `agent` role into their own downline

### 6. Definition of done for Phase 1
- A brand-new agency can be created end-to-end with zero manual DB intervention
- An admin can invite a manager, who can invite agents beneath them, forming a real hierarchy
- Every error state above has been triggered manually and confirmed to show the correct message
- Light and dark mode both verified on every screen
- Full keyboard-only walkthrough of signup → verify → login succeeds without a mouse

---

*Next: Phase 2 — Contacts & Leads (capture, fields, statuses, assignment rules).*
