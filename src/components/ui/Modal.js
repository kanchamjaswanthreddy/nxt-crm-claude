'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  footer,
  hideClose = false,
}) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);
  const titleId = useRef(
    `modal-title-${Math.random().toString(36).slice(2, 9)}`
  ).current;

  // Mount and animate in
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      setMounted(true);
      // Allow one frame for the DOM to paint before triggering transition
      const raf = requestAnimationFrame(() => {
        setVisible(true);
      });
      return () => cancelAnimationFrame(raf);
    }

    // Animate out then unmount
    setVisible(false);
    const timer = setTimeout(() => {
      setMounted(false);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Focus trap
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
      );
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

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
    },
    [onClose]
  );

  // Auto-focus first focusable element on open
  useEffect(() => {
    if (!visible || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      panelRef.current.focus();
    }
  }, [visible]);

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  if (!mounted) return null;

  return createPortal(
    <div
      className={styles.overlay}
      data-visible={visible}
      ref={overlayRef}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div
        className={styles.panel}
        data-size={size}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title} id={titleId}>
            {title}
          </h2>
          {!hideClose && (
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close dialog"
            >
              <CloseIcon />
            </button>
          )}
        </div>

        {/* Body */}
        <div className={styles.body}>{children}</div>

        {/* Footer */}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
