/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['firebase-admin', 'jose', 'jwks-rsa', 'xml-crypto', 'stripe'],
};

export default nextConfig;
