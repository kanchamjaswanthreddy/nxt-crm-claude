#!/usr/bin/env node
/**
 * Generate an RSA key pair for OIDC JWT signing.
 *
 * Usage:
 *   node scripts/generate-oidc-keys.mjs
 *
 * Output: prints OIDC_PRIVATE_KEY and OIDC_PUBLIC_KEY values
 * to paste into your .env.local (and Vercel env vars).
 */
import { generateKeyPair, exportPKCS8, exportSPKI } from 'jose';

const { privateKey, publicKey } = await generateKeyPair('RS256', {
  extractable: true,
});

const pkcs8 = await exportPKCS8(privateKey);
const spki = await exportSPKI(publicKey);

console.log('=== Add these to .env.local and Vercel Environment Variables ===\n');
console.log('OIDC_PRIVATE_KEY="' + pkcs8.replace(/\n/g, '\\n') + '"');
console.log('');
console.log('OIDC_PUBLIC_KEY="' + spki.replace(/\n/g, '\\n') + '"');
console.log('');
console.log('OIDC_ISSUER="https://nxt-crm-beta.vercel.app"');
console.log('OIDC_CLIENT_ID="nxt-fig-sso"');
console.log('OIDC_CLIENT_SECRET="<generate-a-random-secret-and-share-with-FIG>"');
console.log('');
console.log('=== Done ===');
