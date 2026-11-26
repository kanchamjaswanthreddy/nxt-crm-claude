# Antigravity Build Prompt — Phase 8: Deployment & Launch

Paste this whole thing into Antigravity as the task. This assumes Phase 7 (hardening/security review) is complete. This phase takes the finished, audited product live for real agents to use.

---

## Context

Insurance agency CRM (NXT Financial Group), Firebase/Firestore backend, built through Phases 1–7. Goal now: reliable environments, automated deploys, a real domain, monitoring in production, and a go-live runbook — not new features.

## 1. Environment separation
- [ ] Set up three separate Firebase projects: `nxt-crm-dev`, `nxt-crm-staging`, `nxt-crm-prod` — each with its own Firestore instance, Auth config, and Cloud Functions, so testing never touches real agent/client data
- [ ] Environment-specific config (API keys, project IDs) loaded via environment variables / a config file per environment — never hardcoded, never shared between environments
- [ ] Confirm the security rules, indexes, and Cloud Functions are deployed identically across all three (single source of truth in the repo, deployed per-environment, not hand-edited per environment in the Firebase console)

## 2. CI/CD pipeline
- [ ] Set up a pipeline (GitHub Actions or equivalent) that on every push to a feature branch: runs linting, type-checking, and any automated tests, and deploys a preview build
- [ ] On merge to `main`/`staging` branch: auto-deploy to the staging Firebase project
- [ ] Production deploys are a **manual, deliberate trigger** (tag-based release or manual approval step) — never auto-deploy straight to prod on merge, given this handles real commission/financial data
- [ ] Cloud Functions, Firestore rules, and Firestore indexes all deploy together as one atomic release step, not independently (a rules deploy that's out of sync with the functions expecting it is a common source of subtle bugs)
- [ ] Add a rollback step/documented procedure: how to redeploy the previous known-good version of rules + functions + hosting if something breaks post-deploy

## 3. Domain, hosting, SSL
- [ ] Connect the production custom domain to Firebase Hosting, confirm SSL is issued and auto-renewing
- [ ] Set up staging on a subdomain (e.g., `staging.nxtcrm.com`) clearly distinguishable from production, ideally with a visible banner/indicator in the UI when running in staging so no one confuses the two environments
- [ ] Confirm proper cache headers on static assets and that the app correctly forces a refresh for users on an old cached build after a new deploy (stale-bundle issues are a common silent bug in SPA deploys)

## 4. Production monitoring
- [ ] Confirm the Phase 7 error tracking and alerting (Sentry + Cloud Function/scheduled-job alerts) are pointed at the production project specifically, with staging/dev noise filtered separately
- [ ] Set up uptime monitoring on the production URL (simple external ping service is sufficient) with alerting to whoever owns on-call
- [ ] Set up a Firestore usage/cost alert (budget alert in Google Cloud) so an unexpected usage spike (e.g., a runaway query or bad recursive trigger) surfaces as a cost alert before it becomes a bill surprise

## 5. Backups & disaster recovery
- [ ] Set up scheduled, automated Firestore exports (daily) to a Cloud Storage bucket, with a retention policy (e.g., 30 daily + 12 monthly)
- [ ] Document and test an actual restore procedure once before go-live — not just "we have backups," but a verified "we restored a backup into a test project and confirmed the data came back correctly"

## 6. Data migration / onboarding for real launch
- [ ] If the agency has existing agents/hierarchy from before this system (spreadsheets, another CRM), build or confirm a one-time import path: agents via a bulk-invite CSV (name, email, role, upline reference) that creates `Invite` records in bulk rather than one at a time — reuse Phase 1's invite mechanism, just batch the creation
- [ ] Existing leads/contacts from a prior system import through the Phase 2 CSV import flow already built — confirm it handles the actual real-world export format from whatever system the agency is migrating from (check column names/formats now, not on launch day)
- [ ] Existing in-flight deals (if any) may need a one-time manual/scripted import into `Deal` with an appropriate starting `stageId` — build a small one-off admin import tool if the volume warrants it, rather than manual re-entry by agents

## 7. Legal & compliance pages
- [ ] Add Privacy Policy and Terms of Service pages/links, linked from the signup screen and footer (content itself is a legal/business decision, not an engineering one — flag clearly to the user that actual legal review of the policy text is their responsibility, not something to draft into production law)
- [ ] Confirm the data export/anonymization tools built in Phase 7 are referenced in the privacy policy as the mechanism for handling data requests

## 8. Go-live runbook
Produce a written runbook covering:
- [ ] Pre-launch checklist (final data migration complete, DNS propagated, SSL verified, monitoring confirmed live, at least one full manual walkthrough of every phase's core flow completed on production with a test account)
- [ ] Launch day sequence (who does what, in what order — e.g., admin account created first, then bulk agent invites sent, then a announcement to agents)
- [ ] First-48-hours monitoring plan — who's watching error rates/alerts closely in the window right after go-live, and what the escalation path is if something breaks
- [ ] Support channel for agents encountering issues (even a simple shared inbox or Slack channel is fine for initial launch — the point is agents have somewhere to report a problem immediately rather than it going unnoticed)

## 9. Final pre-launch verification (repeat the full core flow on production, not staging)
- [ ] Sign up as a fresh admin account on production → invite a manager → invite an agent under that manager → confirm hierarchy and visibility are correct
- [ ] Create a lead → convert to deal → move through every pipeline stage → mark won with a carrier and policy number → confirm commission + override records generate correctly
- [ ] Confirm a task auto-generates from the stage-change automation and appears correctly assigned
- [ ] Confirm the dashboard and team dashboard show correct, live numbers reflecting the above test activity
- [ ] Delete/clean up this test data afterward so it doesn't pollute real production reporting (or run this verification in a way — e.g., a clearly-tagged test agency — that's easy to identify and remove)

## 10. Definition of done
- Dev, staging, and production are fully separated and independently deployable
- CI/CD deploys automatically to staging and via deliberate release to production, with rules/functions/indexes always deployed atomically together
- Custom domain live with SSL, staging visibly distinguished from production
- Backups running on schedule and a restore has been actually tested once
- Monitoring, alerting, and cost alerts are live and verified
- Any legacy data migration paths are tested against the real source data formats before launch day
- The go-live runbook is written and everyone involved in launch has read it
- A full end-to-end walkthrough has been completed successfully on production itself, not just staging, immediately before real agents are invited in
