'use client';

import React, { createContext, useCallback, useContext, useReducer, useRef } from 'react';
import styles from './Toast.module.css';

/* ── Constants ── */

const MAX_TOASTS = 5;

const DURATIONS = {
  success: 4000,
  info: 4000,
  error: 6000,
};

const DISMISS_ANIMATION_MS = 300;

/* ── Icons ── */

function CheckCircleIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 1.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm3.53 5.78-4.25 4.25a.75.75 0 0 1-1.06 0l-1.75-1.75a.75.75 0 1 1 1.06-1.06L7.75 9.94l3.72-3.72a.75.75 0 1 1 1.06 1.06Z"
        fill="currentColor"
      />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 1.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm2.78 9.22a.75.75 0 1 1-1.06 1.06L9 10.06l-1.72 1.72a.75.75 0 0 1-1.06-1.06L7.94 9 6.22 7.28a.75.75 0 0 1 1.06-1.06L9 7.94l1.72-1.72a.75.75 0 0 1 1.06 1.06L10.06 9l1.72 1.72Z"
        fill="currentColor"
      />
    </svg>
  );
}

function InfoCircleIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 1.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM9.75 12.75a.75.75 0 0 1-1.5 0v-3a.75.75 0 0 1 1.5 0v3ZM9 7.5A.75.75 0 1 1 9 6a.75.75 0 0 1 0 1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10.5 3.5 3.5 10.5M3.5 3.5l7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const ICONS = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  info: InfoCircleIcon,
};

/* ── Reducer ── */

let nextId = 0;

function toastReducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const updated = [...state, action.toast];
      if (updated.length > MAX_TOASTS) {
        return updated.slice(updated.length - MAX_TOASTS);
      }
      return updated;
    }
    case 'DISMISS':
      return state.map((t) =>
        t.id === action.id ? { ...t, exiting: true } : t
      );
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

/* ── Context ── */

const ToastContext = createContext(null);

/* ── Single Toast Item ── */

function ToastItem({ toast: t, onDismiss }) {
  const Icon = ICONS[t.variant];
  const duration = DURATIONS[t.variant];
  const role = t.variant === 'error' ? 'alert' : 'status';

  const classes = [
    styles.toast,
    styles[t.variant],
    t.exiting ? styles.exiting : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} role={role}>
      <Icon />
      <div className={styles.body}>
        <div className={styles.title}>{t.title}</div>
        {t.message && <div className={styles.message}>{t.message}</div>}
      </div>
      <button
        className={styles.close}
        onClick={() => onDismiss(t.id)}
        aria-label="Dismiss notification"
        type="button"
      >
        <CloseIcon />
      </button>
      {!t.exiting && (
        <div
          className={styles.progress}
          style={{ animationDuration: `${duration}ms` }}
        />
      )}
    </div>
  );
}

/* ── Provider ── */

export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);
  const timersRef = useRef({});

  const dismiss = useCallback((id) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    dispatch({ type: 'DISMISS', id });
    setTimeout(() => {
      dispatch({ type: 'REMOVE', id });
    }, DISMISS_ANIMATION_MS);
  }, []);

  const addToast = useCallback((variant, title, message) => {
    const id = ++nextId;
    const toast = { id, variant, title, message, exiting: false };
    dispatch({ type: 'ADD', toast });

    const duration = DURATIONS[variant];
    timersRef.current[id] = setTimeout(() => {
      dismiss(id);
    }, duration);

    return id;
  }, [dismiss]);

  const toast = React.useMemo(() => ({
    success: (title, message) => addToast('success', title, message),
    error: (title, message) => addToast('error', title, message),
    info: (title, message) => addToast('info', title, message),
  }), [addToast]);

  const contextValue = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className={styles.container} aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ── Hook ── */

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
