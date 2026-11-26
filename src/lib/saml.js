import crypto from 'crypto';
import { SignedXml } from 'xml-crypto';

const ENTITY_ID = process.env.SAML_ENTITY_ID || 'https://crm.nxtfinancialgroup.com/saml';
const ACS_URL = process.env.SURELC_ACS_URL || 'https://www.surelc.com/saml/acs';
const SP_ENTITY_ID = process.env.SURELC_ENTITY_ID || 'https://www.surelc.com';

function formatPem(raw) {
  if (!raw) return undefined;
  return raw.replace(/\\n/g, '\n');
}

function getCertificateBody() {
  const pem = formatPem(process.env.SAML_CERTIFICATE);
  if (!pem) throw new Error('SAML_CERTIFICATE not configured');
  return pem
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\s+/g, '');
}

/**
 * Build a SAML 2.0 Response with an embedded Assertion for SureLC.
 * @param {object} agentData - Agent profile from Firestore
 * @param {object} config - Optional overrides
 */
export function buildSamlResponse(agentData, config = {}) {
  const issuer = config.issuer || ENTITY_ID;
  const destination = config.acsUrl || ACS_URL;
  const audience = config.spEntityId || SP_ENTITY_ID;

  const now = new Date();
  const notBefore = new Date(now.getTime() - 5 * 60 * 1000); // 5 min clock skew
  const notAfter = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour validity
  const sessionExpiry = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours

  const responseId = `_${crypto.randomUUID()}`;
  const assertionId = `_${crypto.randomUUID()}`;
  const instant = now.toISOString();
  const notBeforeStr = notBefore.toISOString();
  const notAfterStr = notAfter.toISOString();
  const sessionExpiryStr = sessionExpiry.toISOString();

  const nameId = agentData.nxt_id || agentData.uid;
  const displayName = [agentData.first_name, agentData.middle_name, agentData.last_name].filter(Boolean).join(' ') || agentData.full_name || '';
  const firstName = agentData.first_name || displayName.split(' ')[0] || '';
  const middleName = agentData.middle_name || '';
  const lastName = agentData.last_name || displayName.split(' ').slice(1).join(' ') || '';

  // Role mapping: admin/owner -> bga with officeManager; agent -> producer
  const isAdmin = agentData.role === 'admin' || agentData.is_owner;
  const application = isAdmin ? 'bga' : 'producer';

  // Format DOB to mm/dd/yyyy if available
  let dob = '';
  if (agentData.date_of_birth) {
    const d = new Date(agentData.date_of_birth);
    if (!isNaN(d.getTime())) {
      dob = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
    }
  }

  const attributes = [
    { name: 'application', value: application },
    { name: 'firstName', value: firstName },
    { name: 'middleName', value: middleName },
    { name: 'lastName', value: lastName },
    { name: 'email', value: agentData.email || '' },
    { name: 'agentId', value: nameId },
    { name: 'dob', value: dob },
    { name: 'cell', value: agentData.phone || '' },
  ];

  // Add roles for BGA users
  if (isAdmin) {
    attributes.push({ name: 'roles', value: 'agencyWorker,officeManager' });
  }

  const attributeStatements = attributes
    .map(
      (attr) =>
        `<saml:Attribute Name="${attr.name}" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic">` +
        `<saml:AttributeValue xsi:type="xs:string">${escapeXml(attr.value)}</saml:AttributeValue>` +
        `</saml:Attribute>`
    )
    .join('\n            ');

  const xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${responseId}" Version="2.0" IssueInstant="${instant}" Destination="${destination}">
  <saml:Issuer>${issuer}</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  <saml:Assertion xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xs="http://www.w3.org/2001/XMLSchema" ID="${assertionId}" Version="2.0" IssueInstant="${instant}">
    <saml:Issuer>${issuer}</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent">${escapeXml(nameId)}</saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData NotOnOrAfter="${notAfterStr}" Recipient="${destination}"/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="${notBeforeStr}" NotOnOrAfter="${notAfterStr}">
      <saml:AudienceRestriction>
        <saml:Audience>${audience}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement AuthnInstant="${instant}" SessionNotOnOrAfter="${sessionExpiryStr}" SessionIndex="${assertionId}">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
    <saml:AttributeStatement>
            ${attributeStatements}
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`;

  return { xml, assertionId, responseId };
}

/**
 * Sign the SAML Response using XML-DSig (RSA-SHA256).
 * Per SuranceBay's spec, the signature covers the Response element
 * and is placed after the Response-level <saml:Issuer>, before <samlp:Status>.
 */
export function signSamlResponse(xml, responseId) {
  const privateKeyPem = formatPem(process.env.SAML_PRIVATE_KEY);
  if (!privateKeyPem) throw new Error('SAML_PRIVATE_KEY not configured');

  const certBody = getCertificateBody();

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  });

  sig.addReference({
    xpath: `//*[local-name(.)='Response' and @ID='${responseId}']`,
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
  });

  sig.keyInfoProvider = {
    getKeyInfo() {
      return `<X509Data><X509Certificate>${certBody}</X509Certificate></X509Data>`;
    },
  };

  sig.computeSignature(xml, {
    prefix: 'ds',
    location: {
      reference: `//*[local-name(.)='Issuer' and parent::*[local-name(.)='Response']]`,
      action: 'after',
    },
  });

  return sig.getSignedXml();
}

/**
 * Build IdP metadata XML for SuranceBay to configure their SP.
 */
export function buildMetadataXml() {
  const certBody = getCertificateBody();
  const baseUrl = ENTITY_ID.replace('/saml', '');
  const ssoUrl = `${baseUrl}/saml/authorize`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${ENTITY_ID}">
  <md:IDPSSODescriptor WantAuthnRequestsSigned="false" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${certBody}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</md:NameIDFormat>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${ssoUrl}"/>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${ssoUrl}"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`;
}

/**
 * Build an auto-submitting HTML form that POSTs the SAMLResponse to the SP ACS URL.
 */
export function buildAutoPostHtml(acsUrl, samlResponseBase64, relayState) {
  const relayStateField = relayState
    ? `<input type="hidden" name="RelayState" value="${escapeXml(relayState)}"/>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><title>Redirecting to SureLC...</title></head>
<body onload="document.forms[0].submit()">
  <noscript><p>JavaScript is required. Please click the button below.</p></noscript>
  <form method="POST" action="${escapeXml(acsUrl)}">
    <input type="hidden" name="SAMLResponse" value="${samlResponseBase64}"/>
    ${relayStateField}
    <noscript><button type="submit">Continue to SureLC</button></noscript>
  </form>
</body>
</html>`;
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
