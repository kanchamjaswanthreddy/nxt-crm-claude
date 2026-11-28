"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import styles from './page.module.css';
import { auth } from '@/lib/firebase/clientApp';
import { db } from '@/lib/firebase/clientApp';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { validateInviteToken, completeInviteSignup, cleanupOrphanAuthUser } from '@/app/actions/invite';



export default function InvitePage() {
  const { token } = useParams();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [inviteData, setInviteData] = useState(null);

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const hasMinLength = password.length >= 10;
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isPasswordValid = hasMinLength && hasNumber && hasSymbol;
  const isFormComplete = fullName.trim().length >= 2 && isPasswordValid && password === confirmPassword;

  useEffect(() => {
    const checkToken = async () => {
      try {
        const result = await validateInviteToken(token);
        if (result.valid) {
          setInviteData(result.invite);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError('Error validating invite link. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    if (token) checkToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormComplete || !inviteData) return;

    setIsSubmitting(true);
    setError(null);
    try {
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(auth, inviteData.email, password);
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          // A sign-in for this email already exists. If an earlier attempt on this invite stopped half way,
          // the same password signs in and the set-up simply carries on.
          try {
            userCredential = await signInWithEmailAndPassword(auth, inviteData.email, password);
          } catch {
            // Otherwise it may be left over from a deleted account: clear it and start fresh.
            const cleanup = await cleanupOrphanAuthUser(inviteData.email);
            if (cleanup.success) {
              try { userCredential = await createUserWithEmailAndPassword(auth, inviteData.email, password); } catch { userCredential = null; }
            }
            if (!userCredential) {
              setError('This email already has an account. Try signing in instead, or ask your admin for help.');
              setIsSubmitting(false);
              return;
            }
          }
        } else {
          throw authErr;
        }
      }

      // The server finishes the sign-up from the invite itself (role, upline, level, NXT ID, overrides).
      const user = userCredential.user;
      const done = await completeInviteSignup(token, await user.getIdToken(), fullName);
      if (!done.success) throw new Error(done.error);

      router.push('/onboarding');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} />
          <p className={styles.loadingText}>Validating your invite...</p>
        </div>
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className={styles.card}>
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>!</div>
          <h2 className={styles.errorTitle}>Invite Error</h2>
          <p className={styles.errorMessage}>{error}</p>
          <p className={styles.errorHint}>
            Please contact your agency admin for a new invite link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      {/* Welcome Banner */}
      <div className={styles.banner}>
        <div className={styles.bannerIcon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </div>
        <h1 className={styles.bannerTitle}>Welcome to NXT</h1>
        <p className={styles.bannerSubtitle}>
          You&apos;ve been invited to join as{' '}
          <span className={styles.roleBadge}>{inviteData.role}</span>
        </p>
      </div>

      {/* Email Info */}
      <div className={styles.emailInfo}>
        <span className={styles.emailLabel}>Account email</span>
        <span className={styles.emailValue}>{inviteData.email}</span>
      </div>

      {/* Steps */}
      <div className={styles.steps}>
        <div className={`${styles.step} ${styles.stepActive}`}>
          <div className={styles.stepNumber}>1</div>
          <span>Create Account</span>
        </div>
        <div className={styles.stepDivider} />
        <div className={styles.step}>
          <div className={styles.stepNumber}>2</div>
          <span>Onboarding</span>
        </div>
        <div className={styles.stepDivider} />
        <div className={styles.step}>
          <div className={styles.stepNumber}>3</div>
          <span>Start Working</span>
        </div>
      </div>

      {/* Form */}
      {error && (
        <div className={styles.errorBanner}>
          <p>{error}</p>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <Input
          id="fullName"
          label="Full Legal Name"
          placeholder="e.g. John Michael Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          disabled={isSubmitting}
        />

        <div>
          <div style={{ position: 'relative' }}>
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              label="Create Password"
              placeholder="Min. 10 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              style={{
                position: 'absolute', right: '14px', top: '38px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', padding: '4px',
                display: 'flex', alignItems: 'center',
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          <div className={styles.validationGrid}>
            <div className={`${styles.validationChip} ${hasMinLength ? styles.chipMet : ''}`}>
              {hasMinLength ? '\u2713' : '\u25CB'} 10+ chars
            </div>
            <div className={`${styles.validationChip} ${hasNumber ? styles.chipMet : ''}`}>
              {hasNumber ? '\u2713' : '\u25CB'} Number
            </div>
            <div className={`${styles.validationChip} ${hasSymbol ? styles.chipMet : ''}`}>
              {hasSymbol ? '\u2713' : '\u25CB'} Symbol
            </div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isSubmitting}
            error={password && confirmPassword && password !== confirmPassword ? "Passwords do not match" : null}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            tabIndex={-1}
            style={{
              position: 'absolute', right: '14px', top: '38px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', padding: '4px',
              display: 'flex', alignItems: 'center',
            }}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
          >
            {showConfirmPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>

        <Button
          type="submit"
          isLoading={isSubmitting}
          disabled={!isFormComplete}
        >
          Create Account & Continue
        </Button>
      </form>

      <p className={styles.securityNote}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: '6px' }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Your information is encrypted and secure
      </p>
    </div>
  );
}
