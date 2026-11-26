# NXT CRM — Forms & Input Field Inventory

## 1. Login — `src/app/auth/login/page.js`

| Field | Type | Required | Options Source | Validation |
|-------|------|----------|---------------|------------|
| email | email | yes | — | non-empty |
| password | password | yes | — | non-empty |

**Submit:** Firebase `signInWithEmailAndPassword` → redirect to `/dashboard`
**Error display:** Yes — mapped Firebase errors shown in UI
**Loading state:** Yes — `isLoading`

---

## 2. Signup — `src/app/auth/signup/page.js`

| Field | Type | Required | Options Source | Validation |
|-------|------|----------|---------------|------------|
| agencyName | text | yes | — | non-empty |
| fullName | text | yes | — | non-empty |
| email | email | yes | — | Firebase validates |
| password | password | yes | — | ≥10 chars, 1 number, 1 symbol |
| confirmPassword | password | yes | — | must match password |

**Submit:** Firebase `createUserWithEmailAndPassword` → `agencies` + `agents` Firestore writes → verification email
**Error display:** Yes
**Loading state:** Yes

---

## 3. Forgot Password — `src/app/auth/forgot-password/page.js`

| Field | Type | Required | Options Source | Validation |
|-------|------|----------|---------------|------------|
| email | email | yes | — | non-empty |

**Submit:** `requestPasswordReset` server action
**Error display:** Always shows success (anti-enumeration)

---

## 4. Onboarding — `src/app/onboarding/page.js`

### Step: Personal Info
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| legalName | text | yes | — |
| preferredName | text | no | — |
| dateOfBirth | date | yes | — |
| phone | tel | yes | — |
| ssn | text/password | yes (unless itin) | — |
| itin | text | no | — |
| addressLine1 | autocomplete | yes | Google Places |
| addressLine2 | text | no | — |
| city | text | yes | — |
| state | select | yes | US_STATES hardcoded |
| zipCode | text | yes | regex: `/^\d{5}(-\d{4})?$/` |

### Step: Employment (up to 5)
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| employer | text | yes (idx=0) | — |
| position | text | yes (idx=0) | — |
| workPhone | tel | no | — |
| startDate / endDate | date | no | — |
| current | checkbox | no | — |

### Step: Qualification (7 yes/no toggles)
All required (must not be null). Custom button toggles, not native inputs.

### Step: Documents + Step: Payment
Signature inputs, consent checkboxes, Stripe payment form.

**Submit:** `completeOnboarding` server action → `agents/{uid}` update

---

## 5. New Lead — `src/app/dashboard/leads/new/page.js`

| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| firstName | text | yes | — |
| lastName | text | yes | — |
| email | email | no | — |
| phone | tel | no | — |
| dateOfBirth | date | no | — |
| street | text | no | — |
| city | text | no | — |
| state | text | no | — (free text, maxLength=2) |
| zip | text | no | — |

**Submit:** `createLead` server action → `leads` collection
**Validation:** firstName + lastName required; at least one of email or phone
**Error display:** Yes — `alert()`
**Loading state:** Yes

---

## 6. Lead Detail — `src/app/dashboard/leads/[id]/page.js`

### Edit Contact Info (inline)
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| firstName | text | no | — |
| lastName | text | no | — |
| email | text | no | — |
| phone | text | no | — |

**Submit:** ⚠️ **Direct client `updateDoc`** on `leads/{id}` — permission depends on Firestore rules
**Error display:** ❌ No — only `console.error`
**Loading state:** ❌ No

### Add Note
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| newNote | textarea | yes (trim check) | — |

**Submit:** `addLeadNote` server action → `leadNotes` collection
**Loading state:** Yes

### Status Select (inline)
| Field | Type | Options Source |
|-------|------|---------------|
| status | select | Hardcoded: new/contacted/no_answer/qualified/not_interested/client/lost |

**Submit:** `updateLeadStatus` server action

### Reassign Lead Modal
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| selectedAgentId | select | yes | Firestore `agents` (client-side query) |

**Submit:** `reassignLead` server action

---

## 7. Unassigned Leads — `src/app/dashboard/leads/unassigned/page.js`

### Per-row Agent Assignment
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| agentId | select | yes | Firestore `agents` (client-side query) |

**Submit:** ⚠️ **Direct client `updateDoc`** on `leads/{leadId}`
**Error display:** `alert()` only
**Loading state:** ❌ No

---

## 8. Lead Import — `src/app/dashboard/leads/import/page.js`

### Step 1: Upload
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| file | file (.csv) | yes | — |

### Step 2: Column Mapping
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| firstName mapping | select | yes | CSV column headers (dynamic) |
| lastName mapping | select | yes | CSV column headers (dynamic) |
| email/phone/address mappings | select | no | CSV column headers (dynamic) |

**Submit:** `importLeads` server action → `leads` collection (bulk)

---

## 9. New Client — `src/app/dashboard/clients/new/page.js`

| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| firstName | text | yes | — |
| lastName | text | yes | — |
| email | email | no | — |
| phone | tel | no | — |
| dateOfBirth | date | no | — |
| gender | select | no | Hardcoded: male/female/other |
| maritalStatus | select | no | Hardcoded: single/married/divorced/widowed/domestic_partner |
| ssn4 | text | no | — (maxLength=4, digits only) |
| preferredContact | select | no | Hardcoded: email/phone/text |
| employer | text | no | — |
| occupation | text | no | — |
| annualIncome | number | no | — |
| street | text | no | — |
| city | text | no | — |
| state | select | no | US_STATES hardcoded |
| zip | text | no | — |

**Submit:** `createClient` server action → `clients` collection
**Validation:** firstName + lastName; at least one of email/phone; email regex; ssn4 exactly 4 digits if provided
**Error display:** Yes
**Loading state:** Yes

---

## 10. Client Detail — `src/app/dashboard/clients/[id]/page.js`

### Edit Client (inline)
Same fields as New Client.
**Submit:** `updateClient` server action
**Error display:** ❌ No
**Loading state:** ❌ No

### Add/Edit Policy Modal
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| carrier | combobox | yes | Firestore `carriers` via `fetchCarriers` |
| policyNumber | text | yes | — |
| type | select | yes | POLICY_TYPES hardcoded |
| status | select | no | POLICY_STATUSES hardcoded |
| premium | number | no | — |
| premiumFrequency | select | no | Hardcoded: monthly/quarterly/semi-annual/annual |
| coverageAmount | number | no | — |
| effectiveDate | date | no | — |
| expiryDate | date | no | — |
| notes | textarea | no | — |
| beneficiaryName | text | no | — |
| beneficiaryRelation | text | no | — |
| beneficiaryPercent | number | no | — |

**Submit:** `addPolicy` / `updatePolicy` server actions
**Error display:** ❌ No — silent failures
**Loading state:** ❌ No

### Add Note
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| newNote | textarea | yes (trim check) | — |

**Submit:** `addClientNote` server action → `clientNotes` sub-collection

---

## 11. New Deal — `src/app/dashboard/deals/new/page.js`

| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| stageId | select | yes | ⚠️ Firestore `pipelineStages` via `fetchPipelineStages` — **EMPTY for new agencies** |
| policyType | select | no | Hardcoded: life/health/annuity/disability/final_expense/other |
| premiumAmount | number | no | — |
| expectedCloseDate | date | no | — |
| isRenewal | checkbox | no | — |

**Submit:** `createDeal` server action → `deals` collection
**Error display:** `alert()`
**Loading state:** Yes
**🚨 BUG:** stageId dropdown has zero options when `pipelineStages` collection is empty — deal creation impossible

---

## 12. Deal Detail — `src/app/dashboard/deals/[id]/page.js`

### Edit Deal (inline)
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| policyType | select | no | Hardcoded |
| premiumAmount | number | no | — |
| expectedCloseDate | date | no | — |
| policyNumber | text | no | — |
| isRenewal | checkbox | no | — |

**Submit:** `updateDeal` server action
**Error display:** `alert()`
**Loading state:** No loading indicator on Save button

---

## 13. Pipeline Settings — `src/app/dashboard/settings/pipeline/page.js`

### Add Stage
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| newStageName | text | yes | — |

**Submit:** ⚠️ **Direct client `addDoc`** on `pipelineStages` — requires admin role per Firestore rules
**Error display:** `alert()`
**Loading state:** Yes

### Per-stage flags (inline)
| Field | Type | Options Source |
|-------|------|---------------|
| isWonStage | checkbox | — |
| isLostStage | checkbox | — |

**Submit:** `updatePipelineStage` server action

---

## 14. Commission Settings — `src/app/dashboard/settings/commissions/page.js`

### Add/Edit Carrier Modal
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| carrierName | text | yes | — |
| carrierActive | checkbox | no | — |

**Submit:** `createOrUpdateCarrier` server action → `carriers` collection

### Add/Edit Rate Modal
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| rateCarrierId | select | yes | Firestore `carriers` via `fetchCarriers` |
| ratePolicyType | text | yes | — |
| rateAgentLevel | text | yes | — |
| ratePercent | number | yes | step=0.01 |
| rateEffectiveDate | date | yes | — |

**Submit:** `createOrUpdateRate` server action → `commissionRates` collection

---

## 15. Task Automation — `src/app/dashboard/settings/task-automation/page.js`

### Add/Edit Rule Modal
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| triggerStageId | select | yes | Firestore `pipelineStages` — ⚠️ **empty if no stages seeded** |
| taskTitle | text | yes | — |
| daysUntilDue | number | yes | min=0 |
| priority | select | no | Hardcoded: low/medium/high |
| active | checkbox | no | — |

**Submit:** `createOrUpdateTemplate` server action → `taskTemplates` collection

---

## 16. Agent Levels — `src/app/dashboard/settings/agent-levels/page.js`

### Change Level Modal
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| selectedLevel | radio | yes | `AGENT_LEVELS` from `src/lib/constants.js` |

**Submit:** `updateAgentContractLevel` server action

---

## 17. Team Member Detail — `src/app/dashboard/team/[id]/page.js`

### Level Select (inline)
| Field | Type | Options Source |
|-------|------|---------------|
| level | select | `AGENT_LEVELS` from constants |

**Submit:** `updateAgentContractLevel` server action — ⚠️ no loading guard

### Role Select (inline, owner-only)
| Field | Type | Options Source |
|-------|------|---------------|
| role | select | Hardcoded: admin/agent |

**Submit:** `updateAgentRole` server action

### Reject Document Modal
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| rejectReason | textarea | yes | — |

**Submit:** `rejectDocument` server action

### Send Request Modal
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| requestType | select | no | Hardcoded: upload_document/provide_info/update_profile/complete_training/other |
| requestTitle | text | yes | — |
| requestDesc | textarea | no | — |

**Submit:** `createAgentRequest` server action

### Assign Upline Modal
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| selectedManagerId | select | yes | Firestore `agents` (client-side query) |

**Submit:** `assignAgentToManager` server action

---

## 18. Invite Agent — `src/components/InviteAgentModal.js`

| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| email | email | yes | — |
| agentLevel | select | no | `AGENT_LEVELS` from constants |
| overrides | CommissionSplitBar | no | — |

**Submit:** `createInvite` server action → `invites` collection + email
**Error display:** Yes — result panel
**Loading state:** Yes

---

## 19. Quick Add Task — `src/components/TaskQuickAddModal.js`

| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| title | text | yes | — |
| dueAt | datetime-local | yes | — |
| priority | select | no | Hardcoded: low/medium/high |
| relatedLeadId | select | no | Firestore `leads` (client-side query) |
| relatedDealId | select | no | Firestore `deals` (client-side query) |
| description | textarea | no | — |

**Submit:** `createTask` server action → `tasks` collection
**Validation:** title + dueAt required; past-date warning
**Loading state:** Yes

---

## 20. Commission Import — `src/app/dashboard/commissions/import/page.js`

| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| selectedCarrier | select | yes | Firestore `carriers` via `fetchCarriers` |
| file | file (.csv) | yes | — |

**Submit:** `processStatement` server action → marks matched commissions as paid

---

## 21. Business Documents — `src/app/dashboard/business/documents/page.js`

### Upload Document Modal
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| uploadDocType | select | yes | Hardcoded DOC_TYPES |
| uploadFile | file | yes | — |

**Submit:** ⚠️ **Direct client Firebase Storage upload + `addDoc` on `agentDocuments`**

---

## 22. Settings Profile — `src/app/dashboard/settings/profile/page.js`

### Personal Info Section
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| full_name | text | no | — |
| phone | tel | no | — |
| date_of_birth | date | no | — |
| addressLine1 | autocomplete | no | Google Places |
| addressLine2 | text | no | — |
| city | text | no | — |
| state | select | no | US_STATES hardcoded |
| zip | text | no | — |

### Profile Photo
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| photo | file (image/*) | no | — |

### Licensing
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| npn | text | no | digits only, max 10 |
| residentState | select | no | US_STATES |
| licenseExpiry | date | no | — |
| licensedStates | toggle buttons | no | US_STATES |

### Compliance
| Field | Type | Required | Options Source |
|-------|------|----------|---------------|
| hasEO | toggle | no | — |
| eoProvider / eoPolicyNumber / eoExpiry | text/date | no | — |
| amlCertified | toggle | no | — |
| amlProvider / amlCertDate | text/date | no | — |

**Submit:** `updateMyProfile` server action → `agents/{uid}`

---

## Summary: Client-side Firestore Writes (permission risk)

| Page | Collection | Operation | Firestore Rules |
|------|-----------|-----------|-----------------|
| leads/[id] | leads | updateDoc | Requires `canAccessLead` + `hasValidLeadFields` — may fail if required fields missing |
| leads/unassigned | leads | updateDoc | Same rules — may fail |
| settings/pipeline | pipelineStages | addDoc | Requires `role == 'admin'` — works for admins, fails for agents |
| business/documents | agentDocuments | addDoc | Requires `agentId == auth.uid` — works |

## Summary: Selects with Firestore-sourced Options

| Select | Collection | Potentially Empty |
|--------|-----------|-------------------|
| deals/new → stageId | pipelineStages | ✅ **YES — blocks deal creation** |
| task-automation → triggerStageId | pipelineStages | ✅ YES |
| clients/[id] → carrier | carriers | ✅ YES (no carriers seeded) |
| commissions/settings → rateCarrierId | carriers | ✅ YES |
| commissions/import → selectedCarrier | carriers | ✅ YES |
| leads/[id] reassign → selectedAgentId | agents | No — at least admin exists |
| team/[id] assign → selectedManagerId | agents | No — at least admin exists |
| TaskQuickAddModal → relatedLeadId | leads | Acceptable — optional field |
| TaskQuickAddModal → relatedDealId | deals | Acceptable — optional field |
