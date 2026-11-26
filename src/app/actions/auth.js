'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';

export async function checkLoginLockout(email) {
  if (!email) return { locked: false };
  const admin = getAdminApp();
  const db = admin.firestore();
  
  const cleanEmail = email.trim().toLowerCase();
  const lockoutRef = db.collection('loginAttempts').doc(cleanEmail);
  
  try {
    const snap = await lockoutRef.get();
    if (snap.exists) {
      const data = snap.data();
      if (data.attempts >= 5) {
        const lockedUntil = data.lastAttemptAt.toMillis() + (15 * 60 * 1000); // 15 mins
        if (Date.now() < lockedUntil) {
          return { locked: true, unlockTime: lockedUntil };
        } else {
          // Lockout expired, reset
          await lockoutRef.delete();
          return { locked: false };
        }
      }
    }
    return { locked: false };
  } catch (err) {
    return { locked: false };
  }
}

export async function recordFailedLogin(email) {
  if (!email) return;
  const admin = getAdminApp();
  const db = admin.firestore();
  
  const cleanEmail = email.trim().toLowerCase();
  const lockoutRef = db.collection('loginAttempts').doc(cleanEmail);
  
  try {
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(lockoutRef);
      if (snap.exists) {
        const data = snap.data();
        const lockedUntil = data.lastAttemptAt.toMillis() + (15 * 60 * 1000);
        if (data.attempts >= 5 && Date.now() < lockedUntil) {
          return; // Already locked, do nothing
        }
        
        let newAttempts = data.attempts + 1;
        if (Date.now() > lockedUntil) {
           newAttempts = 1; // reset if old
        }
        
        transaction.update(lockoutRef, {
          attempts: newAttempts,
          lastAttemptAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        transaction.set(lockoutRef, {
          attempts: 1,
          lastAttemptAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });
  } catch (err) {
    // failed to record login attempt
  }
}

export async function recordSuccessfulLogin(email) {
  if (!email) return;
  const admin = getAdminApp();
  const db = admin.firestore();
  const cleanEmail = email.trim().toLowerCase();
  
  try {
    await db.collection('loginAttempts').doc(cleanEmail).delete();
  } catch (err) {
    // Ignore if not exists
  }
}

export async function requestPasswordReset(email) {
  const cleanEmail = email.trim().toLowerCase();
  const admin = getAdminApp();
  const db = admin.firestore();

  // M-17: Persistent Firestore-based rate limit — 3 requests per hour per email
  try {
    const rlRef = db.collection('rate_limits').doc(`pwd_reset_${cleanEmail}`);
    const rlSnap = await rlRef.get();
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;

    if (rlSnap.exists) {
      const rlData = rlSnap.data();
      const windowStart = rlData.windowStart || 0;
      const count = rlData.count || 0;

      if (now - windowStart < oneHourMs) {
        if (count >= 3) {
          return { success: false, error: "Too many password reset requests. Please try again later." };
        }
        await rlRef.update({ count: count + 1 });
      } else {
        await rlRef.set({ count: 1, windowStart: now });
      }
    } else {
      await rlRef.set({ count: 1, windowStart: now });
    }
  } catch (rlErr) {
    // rate limit check failed
  }

  return { success: true };
}
