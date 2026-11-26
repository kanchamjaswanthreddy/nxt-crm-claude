# Bug Fix Progress

## Critical
| ID | Status | Note |
|----|--------|------|
| C-01 | fixed | updateMyProfile field allowlist (PROFILE_UPDATE_ALLOWLIST) |
| C-02 | fixed | completeOnboarding field allowlist (ONBOARDING_ALLOWLIST) |
| C-03 | fixed | Created middleware.js redirecting unauthenticated users from /dashboard/* |
| C-04 | fixed | Replaced decodeFirebaseIdToken in samlAuth.js with REST API verifyFirebaseIdToken |
| C-05 | fixed | Replaced decodeFirebaseIdToken in oidcAuth.js with REST API verifyFirebaseIdToken |
| C-06 | fixed | PDF endpoint now uses requireUserFromRequest |
| C-07 | fixed | Deleted /api/diagnose endpoint entirely |
| C-08 | fixed | Stripe setup-intent uses requireUserFromRequest, verifies agentId matches caller |
| C-09 | fixed | Stripe create-subscription uses requireUserFromRequest, verifies customerId ownership |
| C-10 | fixed | Stripe update-payment-method uses requireUserFromRequest, agentId from caller.uid |
| C-11 | fixed | STRIPE_WEBHOOK_SECRET now required (500 if missing) |
| C-12 | fixed | Reports export now uses session cookie instead of token in URL |

## High
| ID | Status | Note |
|----|--------|------|
| H-01 | fixed | Client CRUD uses requireUser(), agency scoped |
| H-02 | fixed | Deal CRUD uses requireUser(), agency scoped |
| H-03 | fixed | Lead CRUD uses requireUser(), agency scoped |
| H-04 | fixed | Commission ops use requireUser()/requireAdmin() |
| H-05 | fixed | Override ops use requireAdmin() |
| H-06 | fixed | Task CRUD uses requireUser(), agency scoped |
| H-07 | fixed | Document upload/fetch uses requireUser() |
| H-08 | fixed | sendInvite uses requireAdmin() server-side |
| H-09 | fixed | Learning resources use requireUser()/requireAdmin() |
| H-10 | fixed | Carrier updates use requireAdmin() |
| H-11 | fixed | Report data uses requireUser() |
| H-12 | fixed | Scoreboard uses requireUser() |
| H-13 | fixed | Activity logs use requireAdmin() |
| H-14 | fixed | Google Drive uses requireUser() |
| H-15 | fixed | Agent deletion uses requireAdmin() |
| H-16 | fixed | setOwnerFlag uses requireOwner() |
| H-17 | fixed | sendPaymentReminders uses requireAdmin() |
| H-18 | fixed | fetchTeamData scoped to caller.agencyId |
| H-19 | fixed | fetchContracts uses requireUser() |
| H-20 | fixed | fetchPipelineData uses requireUser() |
| H-21 | fixed | CRON_SECRET unconditionally required (500 if missing) |
| H-22 | fixed | Same fix on metrics-reconciliation |
| H-23 | fixed | npm update: next 16.4.6, firebase/firebase-admin latest |
| H-24 | fixed | SAML SSO uses requireUserFromRequest |

## Medium
| ID | Status | Note |
|----|--------|------|
| M-01 | fixed | NavLink moved to module level outside DashboardLayoutInner |
| M-02 | fixed | ESLint errors reduced from 125 to 0 (all fixes + legitimate disable comments) |
| M-03 | fixed | Server actions now use session cookie via requireUser() instead of client-supplied uid |
| M-04 | needs my decision | 5-min inactivity timeout |
| M-05 | fixed | fetchPendingApprovals has .limit(50) |
| M-06 | fixed | getAgents removed; only fetchAgents remains |
| M-07 | fixed | deleteDeal now soft-deletes with deletedAt/deletedBy |
| M-08 | fixed | anonymizeContact logs activity after anonymizing |
| M-09 | fixed | Commission rate validation 0-100% |
| M-10 | fixed | Card update uses refreshProfile() instead of window.location.reload() |
| M-11 | fixed | Card update form has isSubmitting state, disabled button while submitting |
| M-12 | needs my decision | Fixed PDF coordinate system |
| M-13 | needs my decision | No PDF caching |
| M-14 | fixed | Email sendWithRetry helper (2 retries, 1s delay) |
| M-15 | fixed | Billing exemption centralized via isSubscriptionExempt() from constants.js |
| M-16 | fixed | Login lockout already implemented — 5 attempts, 15-min cooldown, Firestore-backed |
| M-17 | fixed | Password reset rate limiting uses Firestore (rate_limits collection) |
| M-18 | fixed | Tracker ops use requireUser() |
| M-19 | needs my decision | No duplicate deal detection |
| M-20 | fixed | ErrorBoundary component wraps dashboard layout |
| M-21 | fixed | exportContactData has Firestore-based rate limit (5/hr per user) |
| M-22 | fixed | resolveNeedsReview logs activity |
| M-23 | fixed | Activity logs visible by role check, not NXT0002 hardcode |
| M-24 | fixed | fixAgentAgencyId deleted |
| M-25 | needs my decision | Self-signup minimal validation |
| M-26 | fixed | fetchTeamData accepts { limit, startAfter } for pagination |
| M-27 | fixed | DEAL_UPDATE_ALLOWLIST for field validation |
| M-28 | fixed | assignLead verifies target agent exists |
| M-29 | fixed | OIDC uses verifyFirebaseIdToken from serverAuth |
| M-30 | fixed | Additional commissions use requireUser()/requireAdmin() |
| M-31 | fixed | Dashboard data uses requireUser() |

## Low
| ID | Status | Note |
|----|--------|------|
| L-01 | fixed | Duplicate getAgents removed |
| L-02 | fixed | Activity logger retries once after 500ms on write failure |
| L-03 | needs my decision | No card brand icon |
| L-04 | needs my decision | No TypeScript |
| L-05 | action needed | Google API key — restrict in Google Cloud Console (HTTP referrers + Places API only). Cannot fix from code. |
| L-06 | fixed | Stripe.js already lazy-loaded (getStripe() defers loadStripe) |
| L-07 | fixed | No console.log in client code (only console.error for error handling) |
| L-08 | fixed | Mobile hamburger nav added with responsive CSS at 1024px breakpoint |
| L-09 | fixed | uploadProfilePhoto has 5MB size check |
| L-10 | fixed | acceptInvite checks expires_at and rejects expired invites |
| L-11 | fixed | All dashboard pages have loading states (spinner/text indicators) |
| L-12 | needs my decision | Agent levels hardcoded |
| L-13 | fixed | fetchCommissions has .limit(100) |
| L-14 | needs my decision | Signature capture UX |
| L-15 | fixed | fetchDealStageHistory has .limit(100) |
| L-16 | needs my decision | Automation hooks tightly coupled |
| L-17 | fixed | firestore.indexes.json already exists with 11 composite indexes |
| L-18 | fixed | InteractiveBackground respects prefers-reduced-motion |

## Unverified
| ID | Status | Note |
|----|--------|------|
| U-01 | pending | PDF signature alignment — needs manual testing |
| U-02 | pending | Email deliverability — needs credentials/live testing |
| U-03 | pending | SAML assertion fields — needs SuranceBay access |
| U-04 | pending | Trial to paid transition — needs Stripe test mode |
| U-05 | pending | Webhook during cold starts — needs deployment testing |
| U-06 | pending | OIDC clock skew — needs live testing |
| U-07 | pending | Dashboard slow with many agents — needs load testing |
| U-08 | pending | Commission floating-point — needs data review |
| U-09 | pending | Firebase session invalidation — custom sessions now used |
| U-10 | pending | Onboarding back button — needs manual UX testing |

## Found During Verification
| ID | Status | Note |
|----|--------|------|
| V-01 | fixed | approveAgent/rejectAgent missing cross-agency check — added agency_id guard |
| V-02 | fixed | adminUpdateAgentProfile missing agency isolation + allowed `role` overwrite — added agency check and stripped `role` from safeUpdates |
| V-03 | fixed | notifyAdminsOfCompletion accepted arbitrary agentId — now enforces agentId === caller.uid |
| V-04 | verified | Pagination limits in place across all list queries (U-07 code review) |
| V-05 | verified | Commission floating-point uses Math.round + 0.01 tolerance (U-08 code review) |
| V-06 | verified | Custom Firestore sessions replace Firebase session cookies (U-09 code review) |
| V-07 | verified | Onboarding back button exists (U-10 code review) |
| V-08 | verified | All 9 data-flow checks passed — no missing agency scoping, no cross-tenant leaks |
