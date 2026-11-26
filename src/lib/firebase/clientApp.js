import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, browserSessionPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Initialize Sentry here
// Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, tracesSampleRate: 1.0 });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase for SSR compatibility
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
// Session-only persistence: closing the tab/browser logs the user out
setPersistence(auth, browserSessionPersistence).catch(() => {});
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
