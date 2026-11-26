import { NextResponse } from 'next/server';
import { signIdToken } from '@/lib/oidc';
import { exchangeOidcCode } from '@/app/actions/oidcAuth';

export const dynamic = 'force-dynamic';

/**
 * OIDC Token Endpoint
 *
 * Accepts: grant_type=authorization_code, code, redirect_uri, client_id, client_secret
 * Returns: access_token, id_token, token_type, expires_in
 *
 * Firestore operations (code lookup, access token creation) happen in a server action
 * to avoid jose/firebase-admin bundle conflicts. Only jose signing happens here.
 */
export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let params;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      params = Object.fromEntries(new URLSearchParams(text));
    } else {
      params = await request.json();
    }

    let { grant_type, code, redirect_uri, client_id, client_secret } = params;

    if (grant_type !== 'authorization_code') {
      return NextResponse.json(
        { error: 'unsupported_grant_type' },
        { status: 400 }
      );
    }

    // Support Basic auth header
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Basic ')) {
      const decoded = atob(authHeader.slice(6));
      const [basicId, basicSecret] = decoded.split(':');
      client_id = client_id || basicId;
      client_secret = client_secret || basicSecret;
    }

    // Exchange auth code via server action (handles Firestore without jose conflict)
    const result = await exchangeOidcCode({
      code,
      redirect_uri,
      client_id,
      client_secret,
    });

    if (result.error) {
      const status = result.error === 'invalid_client' ? 401 : 400;
      return NextResponse.json(
        { error: result.error, error_description: result.error_description },
        { status }
      );
    }

    // Sign the ID token with jose (no firebase-admin in this bundle)
    const idToken = await signIdToken(result.agent, result.nonce, result.clientId);

    return NextResponse.json({
      access_token: result.accessToken,
      id_token: idToken,
      token_type: 'Bearer',
      expires_in: 3600,
    }, {
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    console.error('OIDC token error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Token generation failed' },
      { status: 500 }
    );
  }
}
