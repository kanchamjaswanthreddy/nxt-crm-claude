'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/clientApp';
import { onAuthStateChanged } from 'firebase/auth';
import { createOidcAuthCode } from '@/app/actions/oidcAuth';

export default function OidcAuthorizePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a1628 0%, #162a4a 100%)' }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '48px', maxWidth: '440px', width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <p style={{ color: '#6b7280' }}>Loading…</p>
        </div>
      </div>
    }>
      <AuthorizeFlow />
    </Suspense>
  );
}

function AuthorizeFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState(null);

  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');
  const nonce = searchParams.get('nonce');
  const scope = searchParams.get('scope');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Not logged in — redirect to NXT login, then back here
        const returnUrl = window.location.href;
        router.push(`/auth/login?redirect=${encodeURIComponent(returnUrl)}`);
        return;
      }

      try {
        setStatus('authorizing');

        // Get a fresh Firebase ID token
        const idToken = await user.getIdToken(true);

        // Call the server action (avoids jose/firebase-admin bundle conflict)
        const data = await createOidcAuthCode({
          firebaseIdToken: idToken,
          redirect_uri: redirectUri,
          state: state || '',
          nonce: nonce || '',
        });

        if (data.error) {
          setError(data.error_description || 'Authorization failed');
          setStatus('error');
          return;
        }

        // Redirect to FIG callback with the auth code
        setStatus('redirecting');
        window.location.href = data.redirect_url;
      } catch (err) {
        setError(err.message || 'Something went wrong');
        setStatus('error');
      }
    });

    return () => unsubscribe();
  }, [clientId, redirectUri, state, nonce, scope, router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a1628 0%, #162a4a 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '48px',
        maxWidth: '440px',
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0a1628, #c99a3d)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            fontSize: '24px',
            fontWeight: 700,
            color: '#fff',
          }}>
            N
          </div>
        </div>

        <h1 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: '#0a1628',
          margin: '0 0 8px',
        }}>
          Signing you in
        </h1>

        {status === 'checking' && (
          <p style={{ color: '#6b7280', fontSize: '15px' }}>
            Checking your NXT session…
          </p>
        )}

        {status === 'authorizing' && (
          <p style={{ color: '#6b7280', fontSize: '15px' }}>
            Authorizing your account…
          </p>
        )}

        {status === 'redirecting' && (
          <p style={{ color: '#16a34a', fontSize: '15px', fontWeight: 500 }}>
            Redirecting…
          </p>
        )}

        {status === 'error' && (
          <div>
            <p style={{ color: '#dc2626', fontSize: '15px', marginBottom: '16px' }}>
              {error}
            </p>
            <button className="nxt-btn nxt-btn-primary"
              onClick={() => router.push('/dashboard')}
             
            >
              Return to Dashboard
            </button>
          </div>
        )}

        {(status === 'checking' || status === 'authorizing') && (
          <div style={{
            marginTop: '24px',
            display: 'flex',
            justifyContent: 'center',
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid #e5e7eb',
              borderTopColor: '#c99a3d',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        )}

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
