import { NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase/adminApp';
import { fillSignedPdf } from '@/lib/fillPdf';
import { requireUserFromRequest } from '@/lib/serverAuth';

const VALID_DOCS = ['ica', 'aoa', 'businessStandards'];

/**
 * GET /api/documents/filled?agentId=xxx&doc=ica
 * Returns a filled PDF with signatures overlaid.
 */
export async function GET(request) {
  let caller;
  try {
    caller = await requireUserFromRequest(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  const doc = searchParams.get('doc');

  if (!agentId || !doc || !VALID_DOCS.includes(doc)) {
    return NextResponse.json(
      { error: 'Missing or invalid agentId or doc parameter' },
      { status: 400 }
    );
  }

  // Only allow access if caller is the agent themselves or an admin/owner
  const isAdmin = caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer';
  if (agentId !== caller.uid && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const admin = getAdminApp();
    const db = admin.firestore();
    // Fetch agent data from Firestore
    const agentSnap = await db.collection('agents').doc(agentId).get();
    if (!agentSnap.exists) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const agent = agentSnap.data();
    const agreement = agent.agreement;

    if (!agreement || !agreement[doc]) {
      return NextResponse.json(
        { error: 'No signed agreement found for this document' },
        { status: 404 }
      );
    }

    const sigData = agreement[doc];
    const signedAt = sigData.signed_at
      ? new Date(sigData.signed_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

    const pdfBytes = await fillSignedPdf(doc, sigData, signedAt);

    const docNames = {
      ica: 'ICA',
      aoa: 'AOA',
      businessStandards: 'Business_Standards',
    };
    const agentName = ([agent.first_name, agent.middle_name, agent.last_name].filter(Boolean).join(' ') || agent.full_name || 'Agent').replace(/\s+/g, '_');
    const filename = `NXT_${docNames[doc]}_Signed_${agentName}.pdf`;

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (err) {
    console.error('Error generating filled PDF:', err);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
