'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import s from './KeyboardShortcuts.module.css';

const SHORTCUT_GROUPS = [
  {
    label: 'Navigation',
    shortcuts: [
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'L'], description: 'Go to Leads' },
      { keys: ['G', 'C'], description: 'Go to Clients' },
      { keys: ['G', 'B'], description: 'Go to New Business' },
      { keys: ['G', 'T'], description: 'Go to Tasks' },
      { keys: ['G', 'R'], description: 'Go to Reports' },
      { keys: ['G', 'P'], description: 'Go to Pipeline' },
    ],
  },
  {
    label: 'Actions',
    shortcuts: [
      { keys: ['\u2318', 'K'], description: 'Open search' },
      { keys: ['Q'], description: 'Quick add task' },
      { keys: ['N', 'L'], description: 'New lead' },
    ],
  },
  {
    label: 'General',
    shortcuts: [
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close dialog / panel' },
    ],
  },
];

const NAV_MAP = {
  d: '/dashboard',
  l: '/dashboard/leads',
  c: '/dashboard/clients',
  b: '/dashboard/deals',
  t: '/dashboard/tasks',
  r: '/dashboard/reports',
  p: '/dashboard/business/pipeline',
};

export default function KeyboardShortcuts({ onQuickTask }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const [pendingPrefix, setPendingPrefix] = useState(null);
  const prefixTimerRef = React.useRef(null);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handle = (e) => {
      const tag = e.target.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable;

      // Don't intercept shortcuts when typing in inputs
      if (isInput) return;

      // ? — toggle help overlay
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsOpen(prev => !prev);
        return;
      }

      // If help overlay is open, only Escape closes it
      if (isOpen) {
        if (e.key === 'Escape') setIsOpen(false);
        return;
      }

      // Q — quick task
      if (e.key === 'q' && !e.metaKey && !e.ctrlKey) {
        if (pendingPrefix) { setPendingPrefix(null); return; }
        e.preventDefault();
        onQuickTask?.();
        return;
      }

      // G prefix — start nav sequence
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !pendingPrefix) {
        setPendingPrefix('g');
        clearTimeout(prefixTimerRef.current);
        prefixTimerRef.current = setTimeout(() => setPendingPrefix(null), 1500);
        return;
      }

      // N prefix — new entity
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !pendingPrefix) {
        setPendingPrefix('n');
        clearTimeout(prefixTimerRef.current);
        prefixTimerRef.current = setTimeout(() => setPendingPrefix(null), 1500);
        return;
      }

      // Handle second key after prefix
      if (pendingPrefix === 'g') {
        const dest = NAV_MAP[e.key];
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
        setPendingPrefix(null);
        clearTimeout(prefixTimerRef.current);
        return;
      }

      if (pendingPrefix === 'n') {
        if (e.key === 'l') {
          e.preventDefault();
          router.push('/dashboard/leads/new');
        }
        setPendingPrefix(null);
        clearTimeout(prefixTimerRef.current);
        return;
      }
    };

    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      clearTimeout(prefixTimerRef.current);
    };
  }, [isOpen, pendingPrefix, router, onQuickTask]);

  if (!isOpen) return null;

  return (
    <div className={s.overlay} onClick={close} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className={s.dialog} onClick={e => e.stopPropagation()}>
        <div className={s.header}>
          <h2 className={s.title}>Keyboard Shortcuts</h2>
          <button className={s.closeBtn} onClick={close} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={s.body}>
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.label} className={s.group}>
              <h3 className={s.groupLabel}>{group.label}</h3>
              <div className={s.list}>
                {group.shortcuts.map((sc, i) => (
                  <div key={i} className={s.row}>
                    <span className={s.desc}>{sc.description}</span>
                    <span className={s.keys}>
                      {sc.keys.map((k, j) => (
                        <React.Fragment key={j}>
                          {j > 0 && <span className={s.then}>then</span>}
                          <kbd className={s.kbd}>{k}</kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={s.footer}>
          Press <kbd className={s.kbd}>?</kbd> to toggle this overlay
        </div>
      </div>
    </div>
  );
}
