import { buildMetadataXml } from '@/lib/saml';

/**
 * GET /api/saml/metadata
 * Returns SAML IdP metadata XML. SuranceBay uses this URL to configure their SP.
 */
export async function GET() {
  const xml = buildMetadataXml();

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
