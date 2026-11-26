import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const formatPrivateKey = (key) => {
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n');
};

function ensureApp() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }
}

export function getAdminApp() {
  ensureApp();

  const firestoreFn = () => getFirestore();
  firestoreFn.FieldValue = FieldValue;
  firestoreFn.Timestamp = Timestamp;

  return {
    firestore: firestoreFn,
    storage: () => getStorage().bucket(),
  };
}

/**
 * Gets an OAuth2 access token from the Firebase Admin service account.
 * Used for REST API calls that avoid the firebase-admin/auth ESM conflict.
 */
export async function getServiceAccountAccessToken() {
  ensureApp();
  const app = getApps()[0];
  const tokenResult = await app.options.credential.getAccessToken();
  return tokenResult.access_token;
}

/**
 * Generates an email verification link via Firebase Auth REST API.
 * Avoids importing firebase-admin/auth which causes ESM conflict with jose on Vercel.
 */
export async function generateVerificationLinkREST(email) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const accessToken = await getServiceAccountAccessToken();

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:sendOobCode`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestType: 'VERIFY_EMAIL',
        email,
        returnOobLink: true,
        continueUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://crm.nxtfinancialgroup.com'}/auth/login`,
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody?.error?.message || `Failed to generate verification link (HTTP ${response.status})`
    );
  }

  const data = await response.json();
  return data.oobLink;
}
