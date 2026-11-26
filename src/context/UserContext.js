"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/clientApp';
// fetchMyProfile moved to API route to avoid server-action POST on every page

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimer = useRef(null);

  const clearSessionCookie = useCallback(() => {
    fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (auth.currentUser) {
      inactivityTimer.current = setTimeout(() => {
        clearSessionCookie();
        signOut(auth).catch(() => {});
      }, INACTIVITY_TIMEOUT_MS);
    }
  }, [clearSessionCookie]);

  // Inactivity auto-logout: reset timer on user activity
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    const handler = () => resetInactivityTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetInactivityTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivityTimer]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      try {
        if (user) {
          setFirebaseUser(user);

          // Ensure session cookie exists BEFORE calling fetchMyProfile
          try {
            const idToken = await user.getIdToken();
            const cookieRes = await fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken }),
            });
            if (!cookieRes.ok) {
              console.error('[UserContext] Session cookie POST failed:', cookieRes.status, cookieRes.statusText);
            }
          } catch (cookieErr) {
            console.error('[UserContext] Session cookie POST threw:', cookieErr);
          }

          // Fetch profile via API route (not server action) to avoid POST to current page URL
          const result = await fetch('/api/auth/profile').then(r => r.json());

          if (result.success) {
            const data = result.profile;

            if (!user.emailVerified && !data.email_verified_at) {
              router.push('/auth/verify');
              setIsLoading(false);
              return;
            }

            // Gate: redirect non-active agents away from dashboard
            if (data.status === 'invited') {
              router.push('/onboarding');
              setIsLoading(false);
              return;
            }
            if (data.status === 'pending_approval') {
              router.push('/pending-approval');
              setIsLoading(false);
              return;
            }

            setUserProfile({ uid: user.uid, ...data });
          } else {
            console.error('[UserContext] fetchMyProfile failed:', result.error || 'unknown error');
            // Doc doesn't exist yet (new signup)
            setUserProfile({
              uid: user.uid,
              email: user.email,
              first_name: user.displayName?.split(' ')[0] || user.email?.split('@')[0] || '',
              last_name: user.displayName?.split(' ').slice(1).join(' ') || '',
              full_name: user.displayName || user.email?.split('@')[0] || '',
              role: 'agent',
            });
          }
        } else {
          setFirebaseUser(null);
          setUserProfile(null);
          clearSessionCookie();
          router.push('/auth/login');
        }
      } catch (err) {
        console.error('[UserContext] onAuthStateChanged threw:', err);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [router, clearSessionCookie]);

  const refreshProfile = async () => {
    if (!firebaseUser) return;
    try {
      const result = await fetch('/api/auth/profile').then(r => r.json());
      if (result.success) {
        setUserProfile({ uid: firebaseUser.uid, ...result.profile });
      }
    } catch {}
  };

  return (
    <UserContext.Provider value={{ userProfile, firebaseUser, isLoading, refreshProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
