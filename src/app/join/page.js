"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/clientApp';
import { createSelfSignupAgent, sendBrandedVerificationEmail, resolveReferralCode } from '@/app/actions/agents';
import InteractiveBackground from '@/components/ui/InteractiveBackground';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Image from 'next/image';
import Link from 'next/link';

const DEFAULT_AGENCY_ID = process.env.NEXT_PUBLIC_DEFAULT_AGENCY_ID || 'JHdkqlkDcXFKzHl46FG7';

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinPageInner />
    </Suspense>
  );
}

function JoinPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [referrer, setReferrer] = useState(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Resolve referral code from URL
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (!ref) return;
    resolveReferralCode(ref).then(res => {
      if (res.success) setReferrer(res.agent);
    });
  }, [searchParams]);

  const hasMinLength = password.length >= 10;
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isPasswordValid = hasMinLength && hasNumber && hasSymbol;
  const isFormComplete = fullName.trim().length >= 2 && email.trim() && isPasswordValid && password === confirmPassword;

  function formatPhone(value) {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormComplete) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const user = userCredential.user;

      // Create agent doc via server action (uses admin SDK, bypasses Firestore rules)
      const result = await createSelfSignupAgent({
        uid: user.uid,
        fullName,
        email,
        phone,
        agencyId: DEFAULT_AGENCY_ID,
        referredByAgentId: referrer?.id || null,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create agent profile.');
      }

      // Send branded verification email via Resend
      await sendBrandedVerificationEmail({ email: email.trim().toLowerCase(), name: fullName.trim() });

      router.push('/auth/verify');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already associated with an account. Try signing in instead.');
      } else {
        setError(err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const EyeOpen = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
  const EyeClosed = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
    </svg>
  );

  const eyeBtnStyle = {
    position: 'absolute', right: '14px', top: '38px',
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-secondary)', padding: '4px',
    display: 'flex', alignItems: 'center',
  };

  return (
    <>
      <InteractiveBackground />
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: '24px', position: 'relative', zIndex: 1,
      }}>
        <div style={{ maxWidth: '480px', width: '100%' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <Image src="/new-nxt-logo.png" alt="NXT Financial Group" width={200} height={67}
              style={{ objectFit: 'contain' }} priority />
          </div>

          <Card>
            {/* Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #0C1022 0%, #1B2A4E 50%, #1B2A4E 100%)',
              padding: '32px 28px 24px', textAlign: 'center', borderRadius: '16px 16px 0 0',
            }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '50%',
                background: 'rgba(227, 169, 74, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px', color: 'var(--brand-gold)',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </div>
              <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                Join NXT Financial Group
              </h1>
              <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: '1.5' }}>
                Create your account to start your journey as an independent agent
              </p>
              {referrer && (
                <div style={{
                  marginTop: '14px', padding: '10px 16px', borderRadius: '10px',
                  background: 'rgba(227, 169, 74,0.12)', border: '1px solid rgba(227, 169, 74,0.2)',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E3A94A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span style={{ fontSize: '15px', color: 'rgba(255,255,255,0.8)', fontWeight: '500' }}>
                    Referred by <strong style={{ color: '#E3A94A' }}>{referrer.name}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Form */}
            <div style={{ padding: '28px 28px 24px' }}>
              {error && (
                <div style={{
                  background: 'rgba(211, 63, 63, 0.06)', borderLeft: '3px solid var(--status-error)',
                  padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
                  fontSize: '15px', color: 'var(--status-error)',
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Input id="joinFullName" label="Full Legal Name" placeholder="e.g. John Michael Doe"
                  value={fullName} onChange={e => setFullName(e.target.value)} required disabled={isSubmitting} />

                <Input id="joinEmail" type="email" label="Email Address" placeholder="name@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} required disabled={isSubmitting} />

                <Input id="joinPhone" type="tel" label="Phone Number" placeholder="(555) 555-5555"
                  value={phone} onChange={e => setPhone(formatPhone(e.target.value))} disabled={isSubmitting} />

                <div>
                  <div style={{ position: 'relative' }}>
                    <Input id="joinPassword" type={showPassword ? 'text' : 'password'} label="Create Password"
                      placeholder="Min. 10 characters" value={password}
                      onChange={e => setPassword(e.target.value)} required disabled={isSubmitting} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                      style={eyeBtnStyle} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? EyeClosed : EyeOpen}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '-4px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    {[
                      [hasMinLength, '10+ chars'],
                      [hasNumber, 'Number'],
                      [hasSymbol, 'Symbol'],
                    ].map(([met, label]) => (
                      <span key={label} style={{
                        fontSize: '13px', fontWeight: '500', padding: '3px 10px',
                        borderRadius: '999px', transition: 'all 0.2s ease',
                        color: met ? '#059669' : '#8A857B',
                        background: met ? 'rgba(5, 150, 105, 0.08)' : '#F0EDE6',
                      }}>
                        {met ? '\u2713' : '\u25CB'} {label}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ position: 'relative' }}>
                  <Input id="joinConfirmPassword" type={showConfirmPassword ? 'text' : 'password'}
                    label="Confirm Password" placeholder="Re-enter your password"
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    required disabled={isSubmitting}
                    error={password && confirmPassword && password !== confirmPassword ? "Passwords do not match" : null} />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex={-1}
                    style={eyeBtnStyle} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                    {showConfirmPassword ? EyeClosed : EyeOpen}
                  </button>
                </div>

                <Button type="submit" isLoading={isSubmitting} disabled={!isFormComplete}>
                  Create Account & Continue
                </Button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '15px', color: 'var(--text-secondary)' }}>
                Already have an account?{' '}
                <Link href="/auth/login" style={{ fontWeight: '600', color: 'var(--brand-navy)' }}>Sign in</Link>
              </div>

              <p style={{ textAlign: 'center', fontSize: '14px', color: '#8A857B', margin: '16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Your information is encrypted and secure
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
