# NXT CRM Feature Inventory

Generated: 2026-11-18

## Pages (61 total)

### Public Pages
| Page | Path | Auth Required |
|------|------|---------------|
| Landing | `/` | No |
| About | `/about` | No |
| Privacy Policy | `/privacy` | No |
| Terms of Service | `/terms` | No |

### Auth Pages
| Page | Path | Auth Required |
|------|------|---------------|
| Login | `/auth/login` | No |
| Signup (redirects to login) | `/auth/signup` | No |
| Forgot Password | `/auth/forgot-password` | No |
| Email Verification | `/auth/verify` | Firebase user |

### Onboarding & Special
| Page | Path | Auth Required | Role Required |
|------|------|---------------|---------------|
| Onboarding | `/onboarding` | Firebase user | status=invited |
| Pending Approval | `/pending-approval` | Firebase user | status=pending_approval |
| Invite Accept | `/invite/[token]` | No (creates account) | N/A |
| Join (self-signup) | `/join` | No | N/A |
| OIDC Authorize | `/oidc/authorize` | Firebase user | N/A |
| SAML Authorize | `/saml/authorize` | Firebase user | N/A |
| Embed Lead Form | `/embed/lead-form/[agencyId]` | No | N/A |

### Dashboard Pages
| Page | Path | Role Required |
|------|------|---------------|
| Dashboard Home | `/dashboard` | Any active |
| Getting Started | `/dashboard/getting-started` | Any active |
| Billing | `/dashboard/billing` | Any active |
| Calculator | `/dashboard/calculator` | Any active |
| Learn (NXT Academy) | `/dashboard/learn` | Any active |
| SureLC SSO | `/dashboard/surelc` | Any active |
| Tasks | `/dashboard/tasks` | Any active |
| Scoreboard | `/dashboard/scoreboard` | Any active |
| Reports | `/dashboard/reports` | Any active |
| Pipeline | `/dashboard/pipeline` | Any active |
| Contracts | `/dashboard/contracts` | Any active |
| Recruitment | `/dashboard/recruitment` | Any active |
| Profile Settings | `/dashboard/settings/profile` | Any active |

### Business Pages
| Page | Path | Role Required |
|------|------|---------------|
| Deals List | `/dashboard/deals` | Any active |
| Deal Detail | `/dashboard/deals/[id]` | Any active |
| New Deal | `/dashboard/deals/new` | Any active |
| Clients List | `/dashboard/clients` | Any active |
| Client Detail | `/dashboard/clients/[id]` | Any active |
| New Client | `/dashboard/clients/new` | Any active |
| Leads List | `/dashboard/leads` | Any active |
| Lead Detail | `/dashboard/leads/[id]` | Any active |
| New Lead | `/dashboard/leads/new` | Any active |
| Lead Import | `/dashboard/leads/import` | Admin |
| Unassigned Leads | `/dashboard/leads/unassigned` | Admin |
| Commissions List | `/dashboard/commissions` | Any active |
| Commission Detail | `/dashboard/commissions/[id]` | Any active |
| Commission Import | `/dashboard/commissions/import` | Admin |
| Needs Review | `/dashboard/commissions/needs-review` | Admin |
| Insurance | `/dashboard/business/insurance` | Any active |
| Annuities | `/dashboard/business/annuities` | Any active |
| Trail | `/dashboard/business/trail` | Any active |
| Renewals | `/dashboard/business/renewals` | Any active |
| Business Pipeline | `/dashboard/business/pipeline` | Any active |
| Documents | `/dashboard/business/documents` | Any active |
| Carrier Updates | `/dashboard/business/carrier-updates` | Any active |
| Marketing Data | `/dashboard/business/marketing-data` | Any active |

### Admin Pages
| Page | Path | Role Required |
|------|------|---------------|
| Agent Approvals | `/dashboard/admin/approvals` | Admin/IT |
| Document Review | `/dashboard/admin/documents` | Admin/IT |
| Commission Distribution | `/dashboard/commission-distribution` | Admin |
| Team | `/dashboard/team` | Any active |
| Team Member Detail | `/dashboard/team/[id]` | Any active |
| Carriers & Rates | `/dashboard/settings/commissions` | Admin |
| Agent Levels | `/dashboard/settings/agent-levels` | Admin |
| Pipeline Settings | `/dashboard/settings/pipeline` | Admin |
| Task Automation | `/dashboard/settings/task-automation` | Admin |
| Activity Logs | `/dashboard/logs` | nxt_id=NXT0002 only |

## API Routes (15 total)

| Route | Method | Auth Check |
|-------|--------|------------|
| `/api/stripe/setup-intent` | POST | None |
| `/api/stripe/create-subscription` | POST | None |
| `/api/stripe/update-payment-method` | POST | None |
| `/api/stripe/webhook` | POST | Stripe signature (bypassed if secret not set) |
| `/api/saml/sso` | POST | None |
| `/api/saml/metadata` | GET | None (intentional) |
| `/api/oidc/authorize` | GET/POST | Broken (no JWT signature verification) |
| `/api/oidc/token` | POST | Broken (no JWT signature verification) |
| `/api/oidc/userinfo` | GET | Broken (no JWT signature verification) |
| `/api/oidc/jwks` | GET | None (intentional) |
| `/api/documents/filled` | GET | None |
| `/api/reports/export` | GET | Broken (no JWT signature verification) |
| `/api/diagnose` | GET | None |
| `/api/cron/daily-tasks` | GET | CRON_SECRET check (conditional) |
| `/api/cron/metrics-reconciliation` | GET | CRON_SECRET check (conditional) |

## Server Actions (31 files)

| File | Exported Functions | Has Auth Check |
|------|-------------------|----------------|
| `actions/auth.js` | checkLoginLockout, recordFailedLogin, recordSuccessfulLogin, requestPasswordReset | N/A (pre-auth) |
| `actions/profile.js` | fetchMyProfile, fetchTeamData, updateMyProfile, adminUpdateAgentProfile, uploadProfilePhoto, completeOnboarding, fixAgentAgencyId, saveOnboardingDraft, fetchPendingApprovals, approveAgent, rejectAgent, notifyAdminsOfCompletion, diagnoseUnlinkedInvites | Partial (approve/reject check role) |
| `actions/agents.js` | getAgents, fixOwnerUpline, fetchAgents, setOwnerFlag, updateAgentContractLevel, deleteAgent, createSelfSignupAgent, etc. | Minimal |
| `actions/billing.js` | getAgentsMissingPayment, getSubscriptionStatus, updatePaymentMethod, getBillingHistory, getAgencyBillingSummary, sendPaymentReminders | Partial (sendPaymentReminders checks admin) |
| `actions/clients.js` | createClient, fetchClients, getClient, updateClient, addPolicy, fetchPolicies, updatePolicy, deletePolicy, addClientNote, fetchClientNotes | None |
| `actions/deals.js` | fetchDeals, createDeal, updateDeal, deleteDeal, fetchDealStageHistory | None |
| `actions/leads.js` | createLead, fetchLeads, updateLeadFields, assignLead, reassignLead, updateLeadStatus, addLeadNote, exportContactData, anonymizeContact | None |
| `actions/commissions.js` | fetchCarriersAndRates, createOrUpdateCarrier, createOrUpdateRate, fetchCommissions, fetchCommissionOverrides, fetchNeedsReviewCommissions, resolveNeedsReview | None |
| `actions/overrides.js` | setOverride, setOverridesBulk, getOverridesForAgent, removeOverride | None |
| `actions/tasks.js` | createTask, fetchTasks, updateTaskStatus, updateTaskDetails, deleteTask | None |
| `actions/contracts.js` | fetchContracts | None |
| `actions/carrierUpdates.js` | fetchCarrierUpdates, createCarrierUpdate, deleteCarrierUpdate | None |
| `actions/learn.js` | fetchLearningResources, createLearningResource, deleteLearningResource | None |
| `actions/tracker.js` | fetchTrackerSettings, updateTrackerSettings, fetchTrackerContacts, createTrackerContact, updateTrackerContact, deleteTrackerContact | None |
| `actions/documents.js` | uploadDocument, fetchDocuments, reviewDocument | Partial (reviewDocument checks admin) |
| `actions/invite.js` | cleanupOrphanAuthUser, sendInvite, validateInviteToken, acceptInvite, resendInvite | Partial (sendInvite checks admin) |
| `actions/reports.js` | fetchReportData | None |
| `actions/scoreboard.js` | fetchScoreboardData | None |
| `actions/leaderboard.js` | fetchLeaderboardData | None |
| `actions/metrics.js` | incrementAgentMetrics | None |
| `actions/pipeline.js` | fetchPipelineData | None |
| `actions/hierarchy.js` | (hierarchy utilities) | N/A |
| `actions/activityLogActions.js` | fetchActivityLogs | None |
| `actions/samlAuth.js` | getSamlAgentData | Broken (no JWT sig verify) |
| `actions/oidcAuth.js` | getOidcAgentData | Broken (no JWT sig verify) |
| `actions/dashboard-v2.js` | (dashboard data) | None |
| `actions/deals-data.js` | (deal data helpers) | None |
| `actions/audit.js` | (audit helpers) | None |
| `actions/drive.js` | listDriveFolder, searchDriveFiles | None |
| `actions/agentRequests.js` | (agent request handling) | Partial |
| `actions/additionalCommissions.js` | (additional commission handling) | None |

## User Roles

| Role | Description | Count (approx) |
|------|-------------|----------------|
| `admin` (+ `is_owner`) | Agency owner, full access | 1 |
| `admin` | Full admin access | 1-2 |
| `it_engineer` | IT admin, billing exempt | 1 |
| `agent` | Regular agent | ~12 |

## Key Components (13)

| Component | Purpose |
|-----------|---------|
| `StripePaymentForm.js` | Card collection during onboarding |
| `DocumentSigning.js` | ICA/AOA/Business Standards signing |
| `InviteAgentModal.js` | Agent invitation form |
| `TaskQuickAddModal.js` | Quick task creation |
| `RosterTable.js` | Team roster display |
| `Avatar.js` | User avatar with initials fallback |
| `AddressAutocomplete.js` | Google Places autocomplete |
| `CommissionSplitBar.js` | Visual commission split display |
| `UplineSearchSelect.js` | Upline agent selector |
| `ui/Button.js` | Design system button |
| `ui/Card.js` | Design system card |
| `ui/Input.js` | Design system input |
| `ui/InteractiveBackground.js` | Animated background |

## Libraries (12)

| File | Purpose |
|------|---------|
| `lib/firebase/clientApp.js` | Client-side Firebase init |
| `lib/firebase/adminApp.js` | Server-side Firebase Admin init |
| `lib/stripe.js` | Server-side Stripe instance |
| `lib/stripeClient.js` | Client-side Stripe loadStripe |
| `lib/saml.js` | SAML 2.0 response builder |
| `lib/oidc.js` | OIDC token/authorization helpers |
| `lib/fillPdf.js` | PDF signature overlay |
| `lib/email/resend.js` | Email sending via Resend |
| `lib/activityLogger.js` | Activity logging helper |
| `lib/constants.js` | Agent levels, billing constants |
| `lib/dealAutomationHooks.js` | Deal stage change automation |
| `lib/documentTypes.js` | Document type definitions |
