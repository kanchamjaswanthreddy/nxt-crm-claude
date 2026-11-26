import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID || 'nxt-fig-sso';

/**
 * OIDC Authorization Endpoint (GET only)
 *
 * SP-initiated flow:
 * 1. FIG redirects user here with client_id, redirect_uri, state, nonce, scope
 * 2. We redirect to the client-side authorize page which handles Firebase Auth
 * 3. The client-side page calls the createOidcAuthCode server action
 * 4. On success, redirects back to FIG with code + state
 *
 * NOTE: POST is no longer used here — the client-side page calls
 * a server action directly to avoid jose/firebase-admin bundle conflicts.
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const responseType = searchParams.get('response_type');
  const scope = searchParams.get('scope');
  const state = searchParams.get('state');
  const nonce = searchParams.get('nonce');

  if (responseType !== 'code') {
    return NextResponse.json(
      { error: 'unsupported_response_type', error_description: 'Only "code" is supported' },
      { status: 400 }
    );
  }

  if (clientId !== OIDC_CLIENT_ID) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Unknown client_id' },
      { status: 400 }
    );
  }

  // Redirect to the client-side authorize page which handles Firebase Auth
  const authorizePageUrl = new URL('/oidc/authorize', request.url);
  authorizePageUrl.searchParams.set('client_id', clientId);
  authorizePageUrl.searchParams.set('redirect_uri', redirectUri || '');
  authorizePageUrl.searchParams.set('state', state || '');
  authorizePageUrl.searchParams.set('nonce', nonce || '');
  authorizePageUrl.searchParams.set('scope', scope || 'openid');

  return NextResponse.redirect(authorizePageUrl.toString());
}
