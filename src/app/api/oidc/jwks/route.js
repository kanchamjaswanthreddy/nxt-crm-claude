import { NextResponse } from 'next/server';
import { getJWKS } from '@/lib/oidc';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const jwks = await getJWKS();
    return NextResponse.json(jwks, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load signing keys' },
      { status: 500 }
    );
  }
}
