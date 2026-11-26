'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './SlideOver.module.css';

const ANIMATION_MS = 300;

export default function SlideOver({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width = 480,
}) {
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);

  const beginClose = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setExiting(false);
      onClose();
    }, ANIMATION_MS);
  }, [onClose]);

  /* Mount / unmount */
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      setMounted(true);
      setExiting(false);
    }
  }, [isOpen]);

  /* Focus trap + Escape */
  useEffect(() => {
    if (!mounted || exiting) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        beginClose();
        return;
      }

      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    /* Auto-focus the panel */
    if (panelRef.current) {
      const firstFocusable = panelRef.current.querySelector(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [mounted, exiting, beginClose]);

  /* Unmount after close animation */
  useEffect(() => {
    if (!isOpen && mounted && !exiting) {
      setMounted(false);
    }
  }, [isOpen, mounted, exiting]);

  if (!mounted) return null;

  const overlayClasses = [
    styles.overlay,
    exiting && styles.overlayExit,
  ].filter(Boolean).join(' ');

  const panelClasses = [
    styles.panel,
    exiting && styles.panelExit,
  ].filter(Boolean).join(' ');

  return createPortal(
    <>
      <div className={overlayClasses} onClick={beginClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        className={panelClasses}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button
            className={styles.closeBtn}
            onClick={beginClose}
            aria-label="Close panel"
            type="button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className={styles.body}>
          {children}
        </div>
        {footer && (
          <div className={styles.footer}>
            {footer}
          </div>
        )}
      </aside>
    </>,
    document.body
  );
}
