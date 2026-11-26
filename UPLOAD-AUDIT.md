# Upload Documents — Diagnostic Audit

## Summary

The Documents Manager page (`/dashboard/business/documents`) and the onboarding document step (`/onboarding`) both upload files **directly from the browser** to Firebase Cloud Storage using the client SDK, then write metadata to Firestore `agentDocuments`. There are **multiple issues** that can cause failures depending on the Storage security rules deployed to the Firebase project.

---

## Root Causes

### 0. Cloud Storage for Firebase API is DISABLED

The `firebasestorage.googleapis.com` API has **never been enabled** on project `nxt-crm-6b71f`. This means:
- The bucket `nxt-crm-6b71f.firebasestorage.app` does **not exist**
- ALL uploads (client-side or admin SDK) will fail
- Must enable at: https://console.developers.google.com/apis/api/firebasestorage.googleapis.com/overview?project=nxt-crm-6b71f
- Then go to Firebase Console → Storage to initialize the default bucket

### 1. No Storage Security Rules in the Repo

There is **no `storage.rules` file** in the repository, and `firebase.json` has no `storage` section. This means:
- Storage rules are managed **only in the Firebase console** — they're invisible to the codebase
- If the console rules are restrictive (e.g. `allow read, write: if false` or require auth), the **client-side upload will fail silently** with a 403 or CORS-looking error because the Firebase Storage SDK doesn't surface rule denials clearly
- If the console rules are permissive (e.g. `allow read, write: if true`), uploads work but **any file is publicly accessible** — a security risk for sensitive documents (IDs, SSN cards, W-9s)

**This is the most likely root cause of upload failures.** Firebase Storage defaults to denying all access if no rules match.

### 2. Admin SDK Has No Storage Bucket Configured

`src/lib/firebase/adminApp.js` initializes without a `storageBucket` property:
```js
initializeApp({
  credential: cert({...}),
  // NO storageBucket here
});
```
This means:
- The server cannot generate signed upload/download URLs
- The server cannot verify uploaded objects
- There is no server-side upload path available

### 3. CORS Not Managed in the Repo

There is no CORS configuration file or script for the Storage bucket. If CORS is not configured on `nxt-crm-6b71f.firebasestorage.app` for `localhost:3000` and `crm.nxtfinancialgroup.com`, client-side uploads will fail with a CORS error in the browser.

### 4. Field Name Mismatch Between Documents Page and Onboarding

| Field | Documents page (`documents/page.js`) | Onboarding (`onboarding/page.js`) |
|-------|--------------------------------------|-------------------------------------|
| Download URL | `storageUrl` | `fileURL` |
| Upload timestamp | `createdAt` (serverTimestamp) | `uploadedAt` (ISO string) |
| Storage path | Not stored | `storagePath` |

The admin review page (`team/[id]/page.js:773`) uses `adoc.fileURL` for the "View" link. So:
- Documents uploaded from the Documents Manager page store the URL as `storageUrl` → the admin "View" button renders `href={undefined}` → **broken link**
- Documents uploaded from onboarding store `fileURL` → admin "View" works

### 5. Storage Path Inconsistency

| Page | Storage path |
|------|-------------|
| Documents Manager | `agentDocuments/{uid}/{timestamp}_{filename}` |
| Onboarding | `agent-documents/{uid}/{docKey}.{ext}` |

Two different root folders in Storage for the same logical feature.

### 6. No File Size Validation on Documents Page

The onboarding step validates 10MB max. The Documents Manager page has **no size check** — a user could attempt a 100MB upload that times out or fails.

### 7. No MIME Type Validation

Both pages use `accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"` on the `<input>` element, but this is trivially bypassed. Neither page validates the actual file MIME type before uploading.

### 8. `alert()` Used for Errors

Documents page line 95: `alert('Upload failed: ' + ...)` — should use inline error messages.

### 9. Download URLs are Public Permanent Tokens

`getDownloadURL()` returns a URL with a permanent access token baked in. Once generated, that URL grants access **forever** to anyone who has it — even after the agent is deactivated. There is no way to revoke it without rotating the Storage security rules or deleting the file.

---

## Firestore Rules — OK

The `agentDocuments` create rule (`firestore.rules:299`) requires:
```
request.resource.data.agentId == request.auth.uid
```
Both the Documents Manager and onboarding set `agentId` to the authenticated user's UID. **This is correct and not a blocker.**

Read and update rules also look correct — agents can see/update their own docs, admins/IT can see/update any in their agency.

---

## What Needs to Happen (Fix Plan)

1. **Move uploads server-side**: Client → server action for signed upload URL → client PUTs file → server action finalizes (verifies + writes Firestore). This eliminates the need for client-side Storage SDK access and Storage security rules.

2. **Add `storageBucket` to Admin SDK init** so server actions can interact with Storage.

3. **Unify field names**: Use `fileURL` everywhere (or `storageUrl` — pick one), add `storagePath` to both flows.

4. **Use signed read URLs** (15-min expiry) instead of permanent download tokens. The admin review page and document list should fetch a fresh signed URL via a server action.

5. **Add file validation**: 10MB max, PDF/JPG/PNG only (verify MIME type server-side).

6. **Replace `alert()` with inline error messages.**

7. **Add CORS config** for the Storage bucket if client-side PUT to signed URLs is used.

8. **Add `storage.rules`** to the repo (can be `allow read, write: if false` since all access goes through the Admin SDK with signed URLs).

---

## Files Affected

| File | Issue |
|------|-------|
| `src/lib/firebase/adminApp.js` | No `storageBucket` in init |
| `src/app/dashboard/business/documents/page.js` | Client-side upload, no size check, `storageUrl` field, `alert()` |
| `src/app/onboarding/page.js` | Client-side upload, `fileURL` field |
| `src/app/dashboard/team/[id]/page.js:773` | Uses `adoc.fileURL` — breaks for docs uploaded from Documents Manager |
| `firebase.json` | No storage section |
| `storage.rules` | Does not exist |
| No CORS config file | Needs to be applied to bucket |

---

## Code Changes Made

| File | Change |
|------|--------|
| `src/lib/firebase/adminApp.js` | Added `storageBucket` to init, exposed `admin.storage()` |
| `src/app/actions/documents.js` | **NEW** — `getUploadUrl`, `finalizeDocumentUpload`, `getDocumentViewUrl`, `fetchDocuments`, `fetchAgentDocumentsAdmin` |
| `src/app/dashboard/business/documents/page.js` | Rewritten: server-side upload via signed URLs, XHR progress, file validation (10MB, PDF/JPG/PNG), inline errors (no `alert()`), signed view URLs |
| `src/app/onboarding/page.js` | Upload rewritten to use server actions, removed client-side Firebase Storage imports |
| `src/app/dashboard/team/[id]/page.js` | View button now fetches signed read URL via `getDocumentViewUrl` |
| `storage.rules` | **NEW** — `allow read, write: if false` (all access via Admin SDK) |
| `firebase.json` | Added `storage.rules` reference |
| `cors.json` | **NEW** — CORS config for localhost:3000 and production domain |

---

## Manual Steps Required (Before Testing)

1. **Enable Cloud Storage for Firebase API**:
   - Visit: https://console.developers.google.com/apis/api/firebasestorage.googleapis.com/overview?project=nxt-crm-6b71f
   - Click "Enable"

2. **Initialize the Storage bucket** in Firebase Console:
   - Go to: https://console.firebase.google.com/project/nxt-crm-6b71f/storage
   - Click "Get started" and create the default bucket

3. **Verify the bucket name** matches `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` in `.env.local`
   - If Firebase creates `nxt-crm-6b71f.appspot.com` instead of `nxt-crm-6b71f.firebasestorage.app`, update `.env.local` and `adminApp.js` accordingly

4. **Apply CORS config**:
   ```bash
   gsutil cors set cors.json gs://BUCKET_NAME
   ```

5. **Deploy storage rules**:
   ```bash
   firebase deploy --only storage
   ```
