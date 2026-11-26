# NXT CRM Design System

## Direction

Clean, calm, premium SaaS. Think Stripe, Linear, Attio — not flashy dashboards.

## Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--brand-navy` | `#0F2A52` | Primary brand, sidebar bg, headings |
| `--brand-gold` | `#C99A3D` | Accent, CTAs, badges |
| `--brand-blue-accent` | `#2D6FC4` | Links, active states |
| `--surface-page` | `#F8F9FB` | Page background |
| `--surface-card` | `#FFFFFF` | Card backgrounds |
| `--surface-inset` | `#F1F3F5` | Inset/recessed areas |
| `--text-primary` | `#111827` | Body text |
| `--text-secondary` | `#6B7280` | Secondary text |
| `--text-tertiary` | `#9CA3AF` | Muted labels |

### Status Colors

Each status color has a matching `-light` variant for badge backgrounds:

- `--status-success` / `--status-success-light` — green
- `--status-warning` / `--status-warning-light` — amber
- `--status-error` / `--status-error-light` — red
- `--status-info` / `--status-info-light` — blue

## Typography

Font: Inter (400, 500, 600, 700, 800).

| Token | Size | Usage |
|-------|------|-------|
| `--text-display` | 30px | Hero numbers |
| `--text-h1` | 24px | Page titles |
| `--text-h2` | 20px | Section headings |
| `--text-h3` | 16px | Card headings |
| `--text-body` | 14px | Body copy |
| `--text-sm` | 13px | Small text, labels |
| `--text-xs` | 11px | Captions, badges |

## Spacing

4px grid. Use `--space-{n}` tokens — never hardcode pixel values.

| Token | Value |
|-------|-------|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-16` | 64px |

## Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Small elements, badges |
| `--radius-md` | 8px | Buttons, inputs |
| `--radius-lg` | 12px | Cards, dropdowns |
| `--radius-xl` | 16px | Featured cards, modals |
| `--radius-full` | 999px | Pills, avatars |

## Shadows

| Token | Usage |
|-------|-------|
| `--shadow-xs` | Subtle lift |
| `--shadow-sm` | Default card |
| `--shadow-card` | Card with border ring |
| `--shadow-md` | Hover state |
| `--shadow-lg` | Dropdowns, popovers |
| `--shadow-xl` | Modals |
| `--shadow-focus` | Focus ring |

## Components

All in `src/components/ui/`:

| Component | File | Purpose |
|-----------|------|---------|
| Button | `Button.js` | primary, secondary, ghost, danger, gold variants |
| Card | `Card.js` | hoverable, compact, flush options |
| Input | `Input.js` | Text input + textarea, error state |
| Modal | `Modal.js` | Portal, focus trap, Escape, overlay |
| ConfirmDialog | `ConfirmDialog.js` | Wraps Modal for confirm/cancel |
| SlideOver | `SlideOver.js` | Right-side panel, sticky header/footer |
| Toast | `Toast.js` | ToastProvider + useToast() hook |
| EmptyState | `EmptyState.js` | rich, minimal, tableRow variants |
| StatusBadge | `StatusBadge.js` | success, warning, error, info, neutral, gold |
| LoadingSpinner | `LoadingSpinner.js` | Spinner, Skeleton, SkeletonText |
| PageHeader | `PageHeader.js` | Title, subtitle, breadcrumbs, actions |
| DataTable | `DataTable.js` | Sortable, responsive, aria-sort |
| FilterBar | `FilterBar.js` | Search + selects + chips + clear |
| FormField | `FormField.js` | Label + error + help text wrapper |

## Layout

- **Sidebar**: Fixed left, 260px, navy bg. Expandable nav sections.
- **Main content**: `margin-left: 260px`, padded.
- **Mobile** (<=1024px): Sidebar slides from left, overlay, hamburger header.

## Accessibility

- Focus-visible outlines on all interactive elements
- `aria-modal`, `role="dialog"` on modals
- `aria-sort` on sortable table headers
- `role="alert"` on error messages
- `prefers-reduced-motion` disables animations
- `.sr-only` utility for screen-reader-only content
- Status badges use dot + color (not color alone)

## Transitions

| Token | Duration | Usage |
|-------|----------|-------|
| `--duration-fast` | 100ms | Hover states |
| `--duration-normal` | 200ms | Most interactions |
| `--duration-slow` | 300ms | Sidebar, slide panels |

Easing: `--ease-out` for entries, `--ease-in-out` for state changes.
