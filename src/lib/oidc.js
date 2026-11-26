import { importPKCS8, importSPKI, SignJWT, exportJWK } from 'jose';
import crypto from 'crypto';

const ISSUER = process.env.OIDC_ISSUER || 'https://crm.nxtfinancialgroup.com';
const CLIENT_ID = process.env.OIDC_CLIENT_ID || 'nxt-fig-sso';
const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || '';
const KEY_ID = 'nxt-oidc-signing-key-1';

function formatPem(raw) {
  if (!raw) return undefined;
  return raw.replace(/\\n/g, '\n');
}

let cachedPrivateKey = null;
let cachedPublicKey = null;

async function getPrivateKey() {
  if (cachedPrivateKey) return cachedPrivateKey;
  const pem = formatPem(process.env.OIDC_PRIVATE_KEY);
  if (!pem) throw new Error('OIDC_PRIVATE_KEY not configured');
  cachedPrivateKey = await importPKCS8(pem, 'RS256');
  return cachedPrivateKey;
}

async function getPublicKey() {
  if (cachedPublicKey) return cachedPublicKey;
  const pem = formatPem(process.env.OIDC_PUBLIC_KEY);
  if (!pem) throw new Error('OIDC_PUBLIC_KEY not configured');
  cachedPublicKey = await importSPKI(pem, 'RS256');
  return cachedPublicKey;
}

/** Return the JWKS (JSON Web Key Set) for the public key */
export async function getJWKS() {
  const pub = await getPublicKey();
  const jwk = await exportJWK(pub);
  return {
    keys: [
      {
        ...jwk,
        kid: KEY_ID,
        alg: 'RS256',
        use: 'sig',
      },
    ],
  };
}

/**
 * Sign an ID token with the required OIDC claims for FIG.
 * @param {object} agent - Firestore agent document data
 * @param {string} agent.uid - Firebase Auth UID (used as sub)
 * @param {string} [agent.first_name] - first name
 * @param {string} [agent.middle_name] - middle name
 * @param {string} [agent.last_name] - last name
 * @param {string} [agent.full_name] - legacy full name
 * @param {string} agent.email - email address
 * @param {string} [agent.npn] - National Producer Number
 * @param {string} [agent.crd] - CRD number
 * @param {string} nonce - OIDC nonce from the authorization request
 * @param {string} audience - client_id of the relying party
 */
export async function signIdToken(agent, nonce, audience) {
  const privateKey = await getPrivateKey();
  const displayName = [agent.first_name, agent.middle_name, agent.last_name].filter(Boolean).join(' ') || agent.full_name || '';
  const givenName = agent.first_name || displayName.split(' ')[0] || '';
  const middleName = agent.middle_name || '';
  const familyName = agent.last_name || displayName.split(' ').slice(1).join(' ') || '';

  const token = await new SignJWT({
    sub: agent.uid,
    name: displayName,
    given_name: givenName,
    middle_name: middleName || undefined,
    family_name: familyName,
    email: agent.email || '',
    email_verified: true,
    npn: agent.npn || '',
    crd: agent.crd || '',
    nonce: nonce || undefined,
  })
    .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
    .setIssuer(ISSUER)
    .setAudience(audience || CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  return token;
}

/** Generate a cryptographically random auth code */
export function generateAuthCode() {
  return crypto.randomBytes(32).toString('hex');
}

/** Validate client credentials for the token endpoint */
export function validateClientCredentials(clientId, clientSecret) {
  return clientId === CLIENT_ID && clientSecret === CLIENT_SECRET;
}

export { ISSUER, CLIENT_ID, KEY_ID };
