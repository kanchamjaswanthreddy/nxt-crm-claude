'use server';

import crypto from 'crypto';
import { requireUser } from '@/lib/serverAuth';

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '18j7lnOyihC4CwIvmIq6JhwsbFpMnSl-J';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

/**
 * Get an access token with Google Drive scope using the Firebase service account.
 * The default Firebase token lacks Drive scopes, so we mint a JWT ourselves.
 */
async function getDriveAccessToken() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY');
  }
  privateKey = privateKey.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: DRIVE_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(payload)}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey);
  const jwt = `${unsigned}.${signature.toString('base64url')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error_description || `Token exchange failed (${res.status})`);
  }

  const data = await res.json();
  return data.access_token;
}

async function driveGet(path, params = {}) {
  const token = await getDriveAccessToken();
  const url = new URL(`${DRIVE_API}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Drive API error (${res.status})`);
  }
  return res.json();
}

/**
 * List files/folders inside a given Drive folder.
 * Returns { success, files, breadcrumbs }
 */
export async function listDriveFolder(folderId) {
  try { await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const targetId = folderId || ROOT_FOLDER_ID;

  try {
    // Fetch folder contents
    const data = await driveGet('/files', {
      q: `'${targetId}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,size,modifiedTime,iconLink,thumbnailLink,webViewLink,webContentLink,createdTime)',
      orderBy: 'folder,name',
      pageSize: '200',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });

    // Build breadcrumbs by walking up from current folder
    const breadcrumbs = await buildBreadcrumbs(targetId);

    // Separate folders and files
    const folders = [];
    const files = [];
    for (const f of data.files || []) {
      const item = {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size ? Number(f.size) : null,
        modifiedTime: f.modifiedTime,
        createdTime: f.createdTime,
        iconLink: f.iconLink,
        thumbnailLink: f.thumbnailLink,
        webViewLink: f.webViewLink,
        webContentLink: f.webContentLink,
        isFolder: f.mimeType === 'application/vnd.google-apps.folder',
      };
      if (item.isFolder) {
        folders.push(item);
      } else {
        files.push(item);
      }
    }

    return { success: true, folders, files, breadcrumbs, currentFolderId: targetId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function buildBreadcrumbs(folderId) {
  const crumbs = [];
  let currentId = folderId;
  let safety = 10;

  while (currentId && currentId !== ROOT_FOLDER_ID && safety > 0) {
    safety--;
    try {
      const meta = await driveGet(`/files/${currentId}`, {
        fields: 'id,name,parents',
        supportsAllDrives: 'true',
      });
      crumbs.unshift({ id: meta.id, name: meta.name });
      currentId = meta.parents?.[0] || null;
    } catch {
      break;
    }
  }

  // Add root
  crumbs.unshift({ id: ROOT_FOLDER_ID, name: 'Marketing Data' });

  return crumbs;
}

/**
 * Search files across the entire marketing folder tree.
 */
export async function searchDriveFiles(searchQuery) {
  try { await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!searchQuery || searchQuery.trim().length < 2) {
    return { success: false, error: 'Search query too short' };
  }

  try {
    const escaped = searchQuery.replace(/'/g, "\\'");
    const data = await driveGet('/files', {
      q: `'${ROOT_FOLDER_ID}' in parents or fullText contains '${escaped}' and trashed = false`,
      fields: 'files(id,name,mimeType,size,modifiedTime,iconLink,thumbnailLink,webViewLink,webContentLink,parents)',
      orderBy: 'modifiedTime desc',
      pageSize: '50',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });

    const results = (data.files || []).map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size ? Number(f.size) : null,
      modifiedTime: f.modifiedTime,
      iconLink: f.iconLink,
      thumbnailLink: f.thumbnailLink,
      webViewLink: f.webViewLink,
      webContentLink: f.webContentLink,
      isFolder: f.mimeType === 'application/vnd.google-apps.folder',
    }));

    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
