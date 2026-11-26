import { NextResponse } from 'next/server';
import { buildSamlResponse, signSamlResponse, buildAutoPostHtml } from '@/lib/saml';
import { requireUserFromRequest } from '@/lib/serverAuth';
import { getAdminApp } from '@/lib/firebase/adminApp';

const ACS_URL = process.env.SURELC_ACS_URL || 'https://www.surelc.com/saml/acs';

/**
 * POST /api/saml/sso
 * Builds a signed SAML Response for the authenticated caller and returns
 * an auto-submit HTML form targeting the IdP ACS URL.
 *
 * The agent data is loaded server-side from Firestore using the verified
 * session — the client body is NOT trusted for identity claims.
 */
export async function POST(request) {
  let caller;
  try {
    caller = await requireUserFromRequest(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { relayState } = await request.json().catch(() => ({}));

    // Load agent data from Firestore using the verified caller uid
    const admin = getAdminApp();
    const db = admin.firestore();
    const agentDoc = await db.collection('agents').doc(caller.uid).get();

    if (!agentDoc.exists) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Agent not found' },
        { status: 404 }
      );
    }

    const agentData = agentDoc.data();
    const agent = {
      uid: caller.uid,
      ...agentData,
    };

    // Build the unsigned SAML Response XML
    const { xml, responseId } = buildSamlResponse(agent);

    // Sign the Response with RSA-SHA256 (per SuranceBay spec)
    const signedXml = signSamlResponse(xml, responseId);

    // Base64 encode the signed XML
    const samlResponseBase64 = Buffer.from(signedXml, 'utf8').toString('base64');

    // Build auto-submit HTML
    const html = buildAutoPostHtml(ACS_URL, samlResponseBase64, relayState);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache',
      },
    });
  } catch (error) {
    console.error('[SAML SSO] ERROR:', error.message, error.stack);
    return NextResponse.json(
      { error: 'server_error', error_description: error.message },
      { status: 500 }
    );
  }
}
