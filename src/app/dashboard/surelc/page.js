'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /dashboard/surelc - Redirects to the SAML authorize flow.
 * This page exists as a simple nav target that initiates IdP-initiated SSO.
 */
export default function SureLCPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/saml/authorize');
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid #E7E3DA',
          borderTopColor: '#E3A94A',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 12px',
        }} />
        <p style={{ color: '#5F5C56', fontSize: '14px', margin: 0 }}>
          Connecting to SureLC...
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
