"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/clientApp';
import { fetchMyProfile } from '@/app/actions/profile';
import InteractiveBackground from '@/components/ui/InteractiveBackground';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function PendingApprovalPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [agentName, setAgentName] = useState('');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const result = await fetchMyProfile();
      if (result.success) {
        const data = result.profile;
        setAgentName([data.first_name, data.middle_name, data.last_name].filter(Boolean).join(' ') || data.full_name || data.preferred_name || '');

        // If already active, go to dashboard
        if (data.status === 'active' || data.status === 'pending_licensing' || data.status === 'docs_pending_review') {
          router.push('/dashboard');
          return;
        }

        // If still invited (onboarding not done), go to onboarding
        if (data.status === 'invited') {
          router.push('/onboarding');
          return;
        }
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Poll every 10 seconds to check if approved
  useEffect(() => {
    if (isLoading) return;

    const interval = setInterval(async () => {
      const user = auth.currentUser;
      if (!user) return;

      const result = await fetchMyProfile();
      if (result.success) {
        const s = result.profile.status;
        if (s === 'active' || s === 'pending_licensing' || s === 'docs_pending_review') {
          clearInterval(interval);
          router.push('/dashboard');
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isLoading, router]);

  if (isLoading) {
    return (
      <>
        <InteractiveBackground />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', position: 'relative', zIndex: 1,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '36px', height: '36px', border: '3px solid #E7E3DA',
              borderTopColor: 'var(--brand-gold)', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
            }} />
            <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </>
    );
  }

  return (
    <>
      <InteractiveBackground />
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: '24px', position: 'relative', zIndex: 1,
      }}>
        <div style={{ maxWidth: '520px', width: '100%' }}>
          <Card>
            <div style={{ padding: '48px 32px', textAlign: 'center' }}>
              {/* Animated clock icon */}
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(227, 169, 74, 0.12), rgba(227, 169, 74, 0.04))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 28px auto',
                border: '2px solid rgba(227, 169, 74, 0.2)',
              }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--brand-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>

              <h1 style={{
                fontSize: '24px', fontWeight: '700', color: 'var(--brand-navy)',
                margin: '0 0 8px 0', letterSpacing: '-0.02em',
              }}>
                Application Under Review
              </h1>

              <p style={{
                fontSize: '17px', color: 'var(--text-secondary)',
                lineHeight: '1.7', margin: '0 0 32px 0',
              }}>
                {agentName ? `Thank you, ${agentName.split(' ')[0]}! ` : ''}Your onboarding is complete and your application has been submitted to the admin team for review. You&apos;ll receive an email once you&apos;re approved.
              </p>

              {/* Status steps */}
              <div style={{
                background: 'var(--surface-page)', borderRadius: '12px',
                padding: '20px', textAlign: 'left', marginBottom: '32px',
                border: '1px solid var(--border-color)',
              }}>
                {[
                  { label: 'Account Created', done: true },
                  { label: 'Onboarding Completed', done: true },
                  { label: 'Admin Review', done: false, active: true },
                  { label: 'Full Access Granted', done: false },
                ].map((step, i) => (
                  <div key={step.label} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 0',
                    borderBottom: i < 3 ? '1px solid var(--border-color)' : 'none',
                  }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      backgroundColor: step.done
                        ? 'var(--status-success)'
                        : step.active
                          ? 'var(--brand-gold)'
                          : '#E7E3DA',
                    }}>
                      {step.done ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : step.active ? (
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          backgroundColor: '#fff',
                          animation: 'pulse 2s ease-in-out infinite',
                        }} />
                      ) : (
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          backgroundColor: '#8A857B',
                        }} />
                      )}
                    </div>
                    <span style={{
                      fontSize: '16px',
                      fontWeight: step.done || step.active ? '600' : '400',
                      color: step.done
                        ? 'var(--status-success)'
                        : step.active
                          ? 'var(--brand-navy)'
                          : 'var(--text-secondary)',
                    }}>
                      {step.label}
                      {step.active && (
                        <span style={{
                          fontSize: '14px', fontWeight: '500',
                          color: 'var(--brand-gold)', marginLeft: '8px',
                        }}>
                          In Progress
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <p style={{
                fontSize: '15px', color: 'var(--text-secondary)',
                lineHeight: '1.6', margin: '0 0 24px 0',
              }}>
                This page will automatically update when your application is approved. You can also close this page and check back later — you&apos;ll receive an email notification.
              </p>

              <Button
                variant="secondary"
                onClick={() => auth.signOut().then(() => router.push('/auth/login'))}
              >
                Sign Out
              </Button>
            </div>
          </Card>
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </>
  );
}
