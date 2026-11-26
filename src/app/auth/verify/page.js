"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/clientApp';
import { onAuthStateChanged } from 'firebase/auth';
import { sendBrandedVerificationEmail } from '@/app/actions/agents';
import Button from '@/components/ui/Button';
import styles from './page.module.css';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Listen for the current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/auth/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Poll to see if email is verified
  useEffect(() => {
    if (!user) return;

    // Check immediately
    if (user.emailVerified) {
      router.push('/dashboard');
      return;
    }

    const interval = setInterval(async () => {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          clearInterval(interval);
          router.push('/dashboard');
        }
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [user, router]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResend = async () => {
    if (!auth.currentUser) return;
    setIsResending(true);
    setError(null);
    setMessage(null);

    try {
      const result = await sendBrandedVerificationEmail({
        email: auth.currentUser.email,
        name: auth.currentUser.displayName || null,
      });
      if (!result.success) {
        throw new Error(result.error || 'Failed to send verification email.');
      }
      setCountdown(60);
      setMessage('Verification email sent! Check your inbox.');
    } catch (err) {
      setError(err.message || 'Failed to send verification email.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <>
      <div className={styles.header}>
        <div className={styles.iconWrapper} style={{ marginBottom: 'var(--space-2)' }}>
          <svg className={styles.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className={styles.title}>Check your email</h1>
        <p className={styles.subtitle}>
          We sent a verification link to your email address. 
          Please click the link to activate your account.
        </p>
      </div>

      <div className={styles.content}>
        {error && (
          <p style={{ fontSize: '15px', color: 'var(--status-error)', marginBottom: '12px', textAlign: 'center' }}>
            {error}
          </p>
        )}
        {message && (
          <p style={{ fontSize: '15px', color: '#059669', marginBottom: '12px', textAlign: 'center' }}>
            {message}
          </p>
        )}
        <Button
          variant="secondary"
          onClick={handleResend}
          disabled={countdown > 0 || isResending}
          isLoading={isResending}
        >
          {countdown > 0 ? `Resend email in ${countdown}s` : 'Resend verification email'}
        </Button>
        <p style={{ fontSize: '14px', color: '#8A857B', marginTop: '16px', textAlign: 'center' }}>
          Don&apos;t see it? Check your spam or junk folder.
        </p>
      </div>
    </>
  );
}
