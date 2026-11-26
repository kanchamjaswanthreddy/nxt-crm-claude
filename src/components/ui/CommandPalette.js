'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { globalSearch } from '@/app/actions/search';
import s from './CommandPalette.module.css';

/* ── Page links for quick navigation ── */

const PAGES = [
  { title: 'Dashboard', href: '/dashboard', keywords: 'home overview' },
  { title: 'Leads', href: '/dashboard/leads', keywords: 'contacts prospects' },
  { title: 'New Lead', href: '/dashboard/leads/new', keywords: 'create add contact' },
  { title: 'Clients', href: '/dashboard/clients', keywords: 'customers accounts' },
  { title: 'New Business Deals', href: '/dashboard/deals', keywords: 'policies applications' },
  { title: 'Pipeline Board', href: '/dashboard/business/pipeline', keywords: 'kanban tracker' },
  { title: 'Tasks', href: '/dashboard/tasks', keywords: 'todo checklist' },
  { title: 'Commissions', href: '/dashboard/commissions', keywords: 'earnings pay' },
  { title: 'Contracts', href: '/dashboard/contracts', keywords: 'agreements' },
  { title: 'Team', href: '/dashboard/team', keywords: 'agents members' },
  { title: 'Reports', href: '/dashboard/reports', keywords: 'analytics stats' },
  { title: 'Scoreboard', href: '/dashboard/scoreboard', keywords: 'leaderboard rankings' },
  { title: 'Recruitment', href: '/dashboard/recruitment', keywords: 'hire recruit' },
  { title: 'Calculator', href: '/dashboard/calculator', keywords: 'quote estimate' },
  { title: 'NXT University', href: '/dashboard/learn', keywords: 'training education' },
  { title: 'NXT Help', href: '/dashboard/help', keywords: 'support tickets' },
  { title: 'Profile Settings', href: '/dashboard/settings/profile', keywords: 'account preferences' },
  { title: 'Billing', href: '/dashboard/billing', keywords: 'subscription payment' },
  { title: 'Get Started', href: '/dashboard/getting-started', keywords: 'onboarding setup' },
  { title: 'Documents', href: '/dashboard/business/documents', keywords: 'files uploads' },
  { title: 'Carrier Updates', href: '/dashboard/business/carrier-updates', keywords: 'news announcements' },
];

/* ── Icons ── */

function SearchIcon() {
  return (
    <svg className={s.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

const TYPE_ICONS = {
  lead: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  client: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  deal: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" />
    </svg>
  ),
  task: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  ),
  page: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
    </svg>
  ),
};

const TYPE_LABELS = {
  lead: 'Leads',
  client: 'Clients',
  deal: 'Deals',
  task: 'Tasks',
  page: 'Pages',
};

/* ── Component ── */

export default function CommandPalette({ isOpen, onClose }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debounceRef = useRef(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Build combined results (pages + search)
  const buildResults = useCallback((q, searchResults) => {
    const items = [];
    if (!q) return items;

    const lower = q.toLowerCase();

    // Filter pages
    const matchedPages = PAGES.filter(p =>
      p.title.toLowerCase().includes(lower) ||
      p.keywords.includes(lower)
    ).slice(0, 5).map(p => ({ ...p, type: 'page', id: p.href }));

    // Group by type
    const groups = {};
    for (const item of searchResults) {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    }
    if (matchedPages.length) groups.page = matchedPages;

    // Order: pages first, then leads, clients, deals, tasks
    for (const type of ['page', 'lead', 'client', 'deal', 'task']) {
      if (groups[type]) items.push(...groups[type]);
    }

    return items;
  }, []);

  // Search on query change
  useEffect(() => {
    if (!isOpen) return;

    if (!query.trim()) {
      setResults([]);
      setActiveIndex(0);
      return;
    }

    // Show page results immediately
    const pageResults = PAGES.filter(p =>
      p.title.toLowerCase().includes(query.toLowerCase()) ||
      p.keywords.includes(query.toLowerCase())
    ).slice(0, 5).map(p => ({ ...p, type: 'page', id: p.href }));
    setResults(pageResults);
    setActiveIndex(0);

    // Debounce server search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length >= 2) {
      setIsSearching(true);
      debounceRef.current = setTimeout(async () => {
        const res = await globalSearch(query.trim());
        if (res.success) {
          const combined = buildResults(query, res.results);
          setResults(combined);
          setActiveIndex(0);
        }
        setIsSearching(false);
      }, 300);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isOpen, buildResults]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleSelect = useCallback((item) => {
    onClose();
    if (item.href) {
      router.push(item.href);
    }
  }, [onClose, router]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    }
  };

  if (!isOpen) return null;

  // Group results for display
  const grouped = [];
  let lastType = null;
  for (const item of results) {
    if (item.type !== lastType) {
      grouped.push({ type: 'label', label: TYPE_LABELS[item.type] || item.type });
      lastType = item.type;
    }
    grouped.push(item);
  }

  let itemIndex = -1;

  return (
    <div className={s.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Search">
      <div className={s.dialog} onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className={s.inputWrap}>
          <SearchIcon />
          <input
            ref={inputRef}
            className={s.input}
            type="text"
            placeholder="Search leads, clients, deals, pages..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className={s.kbd}>ESC</kbd>
        </div>

        {/* Results */}
        <div className={s.results} ref={listRef} role="listbox">
          {!query.trim() ? (
            <div className={s.empty}>
              <svg className={s.emptyIcon} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>Type to search across your CRM</span>
            </div>
          ) : results.length === 0 && !isSearching ? (
            <div className={s.empty}>
              <span>No results for &ldquo;{query}&rdquo;</span>
            </div>
          ) : (
            grouped.map((entry, i) => {
              if (entry.type === 'label') {
                return (
                  <div key={`label-${entry.label}`} className={s.group}>
                    <div className={s.groupLabel}>{entry.label}</div>
                  </div>
                );
              }
              itemIndex++;
              const idx = itemIndex;
              return (
                <div
                  key={entry.id}
                  data-index={idx}
                  className={`${s.item} ${idx === activeIndex ? s.itemActive : ''}`}
                  role="option"
                  aria-selected={idx === activeIndex}
                  onClick={() => handleSelect(entry)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  style={{ margin: '0 8px' }}
                >
                  <div className={s.itemIcon}>
                    {TYPE_ICONS[entry.type]}
                  </div>
                  <div className={s.itemContent}>
                    <div className={s.itemTitle}>{entry.title}</div>
                    {entry.meta && <div className={s.itemMeta}>{entry.meta}</div>}
                  </div>
                  {entry.href && <span className={s.itemAction}>Enter</span>}
                </div>
              );
            })
          )}
          {isSearching && (
            <div className={s.loading}>
              <div className={s.spinner} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={s.footer}>
          <span className={s.footerHint}>
            <kbd className={s.kbd}>↑</kbd>
            <kbd className={s.kbd}>↓</kbd>
            navigate
          </span>
          <span className={s.footerHint}>
            <kbd className={s.kbd}>Enter</kbd>
            open
          </span>
          <span className={s.footerHint}>
            <kbd className={s.kbd}>Esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
