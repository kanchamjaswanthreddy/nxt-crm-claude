import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ISSUER = process.env.OIDC_ISSUER || 'https://nxt-crm-beta.vercel.app';

export async function GET() {
  const config = {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/api/oidc/authorize`,
    token_endpoint: `${ISSUER}/api/oidc/token`,
    userinfo_endpoint: `${ISSUER}/api/oidc/userinfo`,
    jwks_uri: `${ISSUER}/api/oidc/jwks`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'profile', 'email'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    claims_supported: [
      'sub', 'name', 'given_name', 'family_name',
      'email', 'email_verified', 'npn', 'crd',
    ],
  };

  return NextResponse.json(config, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
