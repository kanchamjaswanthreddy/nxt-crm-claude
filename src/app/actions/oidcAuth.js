'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { verifyFirebaseIdToken } from '@/lib/serverAuth';
import { getDisplayName } from '@/lib/constants';
import crypto from 'crypto';
import { validateLengths, FIELD_LIMITS } from '@/lib/validation';

const CLIENT_ID = process.env.OIDC_CLIENT_ID || 'nxt-fig-sso';
const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || '';

/**
 * Verify Firebase ID token, look up agent, generate OIDC auth code,
 * and return the redirect URL.
 */
export async function createOidcAuthCode({ firebaseIdToken, redirect_uri, state, nonce }) {
  if (!firebaseIdToken) {
    return { error: 'missing_token', error_description: 'Firebase ID token required' };
  }
  if (!redirect_uri) {
    return { error: 'invalid_request', error_description: 'redirect_uri required' };
  }

  const uriErr = validateLengths([[redirect_uri, 'redirect_uri', FIELD_LIMITS.url]]);
  if (uriErr) return { error: 'invalid_request', error_description: uriErr };

  try {
    const decoded = await verifyFirebaseIdToken(firebaseIdToken);
    const uid = decoded.uid;

    const admin = getAdminApp();
    const db = admin.firestore();
    const agentDoc = await db.collection('agents').doc(uid).get();

    if (!agentDoc.exists) {
      return { error: 'access_denied', error_description: 'Agent profile not found' };
    }

    const agentData = agentDoc.data();
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.collection('oidc_auth_codes').doc(code).set({
      uid,
      email: agentData.email || decoded.email || '',
      first_name: agentData.first_name || '',
      middle_name: agentData.middle_name || '',
      last_name: agentData.last_name || '',
      full_name: getDisplayName(agentData) || decoded.name || '',
      npn: agentData.npn || '',
      crd: agentData.crd || '',
      nonce: nonce || '',
      redirect_uri,
      client_id: CLIENT_ID,
      created_at: new Date(),
      expires_at: expiresAt,
      used: false,
    });

    const callbackUrl = new URL(redirect_uri);
    callbackUrl.searchParams.set('code', code);
    if (state) callbackUrl.searchParams.set('state', state);

    return { success: true, redirect_url: callbackUrl.toString() };
  } catch (error) {
    return { error: 'server_error', error_description: 'Authorization failed' };
  }
}

/**
 * Exchange auth code for agent data. Returns agent info needed to sign
 * the ID token, or an error. Also creates an opaque access token.
 * Keeps firebase-admin in this server action, separate from jose.
 */
export async function exchangeOidcCode({ code, redirect_uri, client_id, client_secret }) {
  // Validate client credentials (support both post body and basic auth)
  if (client_id !== CLIENT_ID || client_secret !== CLIENT_SECRET) {
    return { error: 'invalid_client' };
  }

  try {
    const admin = getAdminApp();
    const db = admin.firestore();
    const codeRef = db.collection('oidc_auth_codes').doc(code);
    const codeDoc = await codeRef.get();

    if (!codeDoc.exists) {
      return { error: 'invalid_grant', error_description: 'Auth code not found' };
    }

    const codeData = codeDoc.data();

    if (codeData.used) {
      return { error: 'invalid_grant', error_description: 'Auth code already used' };
    }

    const expiresAt = codeData.expires_at?.toDate ? codeData.expires_at.toDate() : new Date(codeData.expires_at);
    if (expiresAt < new Date()) {
      return { error: 'invalid_grant', error_description: 'Auth code expired' };
    }

    if (redirect_uri && redirect_uri !== codeData.redirect_uri) {
      return { error: 'invalid_grant', error_description: 'redirect_uri mismatch' };
    }

    // Mark code as used
    await codeRef.update({ used: true, used_at: new Date() });

    // Generate opaque access token
    const accessToken = crypto.randomUUID();
    await db.collection('oidc_access_tokens').doc(accessToken).set({
      uid: codeData.uid,
      email: codeData.email,
      first_name: codeData.first_name || '',
      middle_name: codeData.middle_name || '',
      last_name: codeData.last_name || '',
      full_name: codeData.full_name,
      npn: codeData.npn,
      crd: codeData.crd,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 3600 * 1000),
    });

    return {
      success: true,
      accessToken,
      agent: {
        uid: codeData.uid,
        full_name: codeData.full_name,
        email: codeData.email,
        npn: codeData.npn,
        crd: codeData.crd,
      },
      nonce: codeData.nonce,
      clientId: codeData.client_id,
    };
  } catch (error) {
    return { error: 'server_error', error_description: 'Token generation failed' };
  }
}
