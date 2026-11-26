"use client";

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/clientApp';
import { checkLoginLockout, recordFailedLogin, recordSuccessfulLogin } from '@/app/actions/auth';
import { logActivity } from '@/lib/activityLogger';
import styles from './page.module.css';

const MailIcon = () => (
  <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 7l-10 7L2 7" />
  </svg>
);

const LockIcon = () => (
  <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon = ({ open }) => open ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function LoginPage() {
  return (
    <Suspense fallback={<p style={{ textAlign: 'center', color: '#5F5C56' }}>Loading...</p>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectAfterLogin = searchParams.get('redirect');
  const sessionExpired = searchParams.get('expired') === '1';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const lockout = await checkLoginLockout(email).catch(() => ({ locked: false }));
      if (lockout.locked) {
        setError({
          title: "Account temporarily locked",
          message: "Too many failed attempts. Please wait 15 minutes before trying again, or reset your password.",
          showResetLink: true
        });
        setIsLoading(false);
        return;
      }

      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (authErr) {
        recordFailedLogin(email).catch(() => {});
        logActivity({
          category: 'auth',
          action: 'login_failed',
          description: `Failed login attempt for ${email}`,
          metadata: { email },
        }).catch(() => {});
        setError({ message: "Invalid email or password. Please try again." });
        setIsLoading(false);
        return;
      }

      try {
        const idToken = await userCredential.user.getIdToken();
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
      } catch (cookieErr) {
        // Non-blocking
      }

      recordSuccessfulLogin(email).catch(() => {});
      logActivity({
        category: 'auth',
        action: 'login_success',
        actorId: userCredential.user.uid,
        description: `Successful login for ${email}`,
        metadata: { email },
      }).catch(() => {});

      router.push(redirectAfterLogin || '/dashboard');
    } catch (err) {
      setError({ message: "Something went wrong. Please try again." });
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Sign in to your account</p>
      </div>

      {sessionExpired && !error && (
        <div className={styles.sessionExpiredBanner}>
          <p>Your session has expired. Please sign in again.</p>
        </div>
      )}

      {error && (
        <div className={styles.errorBanner}>
          {error.title && <h4>{error.title}</h4>}
          <p>{error.message}</p>
          {error.showResetLink && (
            <div style={{ marginTop: '4px' }}>
              <Link href="/auth/forgot-password" className={styles.forgotLink}>
                Reset password
              </Link>
            </div>
          )}
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="email">Email address</label>
          <div className={styles.inputWrap}>
            <MailIcon />
            <input
              id="email"
              type="email"
              className={styles.input}
              placeholder="name@agency.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="password">Password</label>
          <div className={styles.inputWrap}>
            <LockIcon />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className={`${styles.input} ${styles.inputWithEye}`}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>

        <div className={styles.forgotRow}>
          <Link href="/auth/forgot-password" className={styles.forgotLink}>
            Forgot password?
          </Link>
        </div>

        <button type="submit" className={styles.signInBtn}>
          {isLoading ? (
            <span className={styles.spinner} />
          ) : (
            <>
              Sign In
              <span className={styles.signInArrow}>&rarr;</span>
            </>
          )}
        </button>

        <div className={styles.rememberRow}>
          <input type="checkbox" id="remember" className={styles.checkbox} />
          <label htmlFor="remember" className={styles.checkboxLabel}>Remember me</label>
        </div>
      </form>
    </>
  );
}
