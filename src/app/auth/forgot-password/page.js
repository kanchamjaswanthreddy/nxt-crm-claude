"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/clientApp';
import { requestPasswordReset } from '@/app/actions/auth';
import styles from './page.module.css';

const MailIcon = () => (
  <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 7l-10 7L2 7" />
  </svg>
);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const check = await requestPasswordReset(email);
      if (check.success) {
        await sendPasswordResetEmail(auth, email, {
          url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://crm.nxtfinancialgroup.com'}/auth/login`,
          handleCodeInApp: false,
        });
      }
    } catch (error) {
      // Always show success to prevent email enumeration
    } finally {
      setIsLoading(false);
      setIsSent(true);
    }
  };

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Reset password</h1>
        <p className={styles.subtitle}>
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      {isSent && (
        <div className={styles.successBanner}>
          <h4>Link sent</h4>
          <p>If an account exists for {email}, you will receive a password reset link shortly.</p>
        </div>
      )}

      {!isSent ? (
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

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={!email || isLoading}
          >
            {isLoading ? <span className={styles.spinner} /> : 'Send Reset Link'}
          </button>
        </form>
      ) : (
        <button
          className={styles.tryAgainBtn}
          onClick={() => { setIsSent(false); setEmail(''); }}
        >
          Try another email
        </button>
      )}

      <div className={styles.footer}>
        <Link href="/auth/login" className={styles.backLink}>
          Back to login
        </Link>
      </div>
    </>
  );
}
