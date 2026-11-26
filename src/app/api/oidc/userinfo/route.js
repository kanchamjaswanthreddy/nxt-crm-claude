import { NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase/adminApp';

export const dynamic = 'force-dynamic';

/**
 * OIDC UserInfo Endpoint
 *
 * Accepts: Bearer access_token in Authorization header
 * Returns: user claims (sub, name, email, npn, crd)
 */
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'invalid_token' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7);
    const admin = getAdminApp();
    const db = admin.firestore();

    const tokenDoc = await db.collection('oidc_access_tokens').doc(accessToken).get();
    if (!tokenDoc.exists) {
      return NextResponse.json(
        { error: 'invalid_token' },
        { status: 401 }
      );
    }

    const tokenData = tokenDoc.data();

    // Check expiration
    const expiresAt = tokenData.expires_at?.toDate ? tokenData.expires_at.toDate() : new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'Token expired' },
        { status: 401 }
      );
    }

    const displayName = [tokenData.first_name, tokenData.middle_name, tokenData.last_name].filter(Boolean).join(' ') || tokenData.full_name || '';
    const givenName = tokenData.first_name || displayName.split(' ')[0] || '';
    const middleName = tokenData.middle_name || '';
    const familyName = tokenData.last_name || displayName.split(' ').slice(1).join(' ') || '';

    return NextResponse.json({
      sub: tokenData.uid,
      name: displayName,
      given_name: givenName,
      middle_name: middleName || undefined,
      family_name: familyName,
      email: tokenData.email || '',
      email_verified: true,
      npn: tokenData.npn || '',
      crd: tokenData.crd || '',
    }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('OIDC userinfo error:', error);
    return NextResponse.json(
      { error: 'server_error' },
      { status: 500 }
    );
  }
}
