import { NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = '__session';

/**
 * Middleware: convenience redirect for unauthenticated users on /dashboard/*.
 * The real auth check happens inside each server action and API route via
 * requireUser() / requireAdmin(). This just prevents the flash of dashboard
 * UI before the client-side redirect kicks in.
 */
export function middleware(request) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cookie exists — let the request through. The server action will verify
  // the cookie's validity (signature, expiry, revocation).
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
