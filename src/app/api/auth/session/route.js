import { NextResponse } from 'next/server';
import { createSession, deleteSession, SESSION_COOKIE_NAME, SESSION_EXPIRY_MS } from '@/lib/serverAuth';

/**
 * POST /api/auth/session
 * Creates an httpOnly session cookie from a Firebase ID token.
 * Called by the client immediately after successful Firebase sign-in.
 * Body: { idToken: string }
 */
export async function POST(request) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    const sessionId = await createSession(idToken);

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(SESSION_EXPIRY_MS / 1000),
    });

    return response;
  } catch (err) {
    console.error('[session/create]', err.message);
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

/**
 * DELETE /api/auth/session
 * Clears the session cookie and deletes the session from Firestore.
 */
export async function DELETE(request) {
  // Try to delete the session from Firestore
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  const sessionId = match ? match[1] : null;
  if (sessionId) {
    await deleteSession(sessionId);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
