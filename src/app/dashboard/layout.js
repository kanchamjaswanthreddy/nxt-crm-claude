"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase/clientApp';
import { UserProvider, useUser } from '@/context/UserContext';
import TaskQuickAddModal from '@/components/TaskQuickAddModal';
import CommandPalette from '@/components/ui/CommandPalette';
import KeyboardShortcuts from '@/components/ui/KeyboardShortcuts';
import NotificationBell from '@/components/ui/NotificationBell';
import Avatar from '@/components/Avatar';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';
// fetchMyGroups moved to API route to avoid server-action POST on every page load
import { getMenuLinksForGroups } from '@/lib/groups';
import s from './layout.module.css';
import CardRequiredGate from '@/components/CardRequiredGate';
import { isSubscriptionExempt } from '@/lib/constants';

export default function DashboardLayout({ children }) {
  return (
    <UserProvider>
      <ErrorBoundary>
        <ToastProvider>
          <DashboardLayoutInner>{children}</DashboardLayoutInner>
        </ToastProvider>
      </ErrorBoundary>
    </UserProvider>
  );
}

const dn = (a) => [a?.first_name, a?.middle_name, a?.last_name].filter(Boolean).join(' ') || a?.full_name || a?.name || a?.email || '';

// ── SVG Icons (inline, tiny) ────────────────────────────────────────────────

const Icon = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  home: <Icon d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" />,
  rocket: <Icon d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0 M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />,
  briefcase: <Icon d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />,
  users: <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75" />,
  chart: <Icon d="M18 20V10 M12 20V4 M6 20v-6" />,
  trophy: <Icon d="M6 9H4.5a2.5 2.5 0 010-5H6 M18 9h1.5a2.5 2.5 0 000-5H18 M4 22h16 M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22h10c0-2-1-3.25-2.03-3.79A1.07 1.07 0 0114 17v-2.34 M6 2h12v7a6 6 0 11-12 0V2z" />,
  userPlus: <Icon d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M8.5 11a4 4 0 100-8 4 4 0 000 8z M20 8v6 M23 11h-6" />,
  fileText: <Icon d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />,
  calculator: <Icon d="M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2z M8 10h0 M12 10h0 M16 10h0 M8 14h0 M12 14h0 M16 14h0 M8 18h0 M12 18h0 M16 18h0 M4 6h16" />,
  book: <Icon d="M4 19.5A2.5 2.5 0 016.5 17H20 M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z" />,
  shield: <Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  helpCircle: <Icon d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3 M12 17h.01" />,
  shoppingBag: <Icon d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z M3 6h18 M16 10a4 4 0 01-8 0" />,
  settings: <Icon d="M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />,
  clipboard: <Icon d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2 M9 2h6a1 1 0 011 1v1a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1z" />,
  layers: <Icon d="M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5" />,
  activity: <Icon d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  chevron: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 3l3 3-3 3" /></svg>,
  menu: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  x: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  dots: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>,
  external: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3L3 9 M9 3H5 M9 3v4"/></svg>,
};

// ── Expandable nav section ──────────────────────────────────────────────────

function NavSection({ label, icon, children, defaultOpen = false, pathname, activePaths = [] }) {
  const isActive = activePaths.some(p => pathname.includes(p));
  const [open, setOpen] = useState(isActive || defaultOpen);

  useEffect(() => {
    if (isActive && !open) setOpen(true);
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <button
        className={`${s.navExpand} ${open ? s.navExpandOpen : ''} ${isActive ? s.navItemActive : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className={s.navItemIcon}>{icon}</span>
          {label}
        </span>
        <span className={s.navExpandIcon}>{ICONS.chevron}</span>
      </button>
      {open && <div className={s.navSubItems}>{children}</div>}
    </div>
  );
}

// ── Main layout ─────────────────────────────────────────────────────────────

function DashboardLayoutInner({ children }) {
  const pathname = usePathname();
  // The panel is the scroll area now, so a new screen must start at its top.
  useEffect(() => { document.getElementById('main-content')?.scrollTo({ top: 0 }); }, [pathname]);
  const { userProfile, firebaseUser, isLoading, refreshProfile } = useUser();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [groupMenuLinks, setGroupMenuLinks] = useState([]);
  const [isTeamLeader, setIsTeamLeader] = useState(false);
  const [isHelpDeskMember, setIsHelpDeskMember] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const userMenuRef = useRef(null);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'it_engineer';

  // Global Cmd/Ctrl+K listener
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const closeSearch = useCallback(() => setIsSearchOpen(false), []);

  useEffect(() => {
    if (!userProfile?.uid) return;
    const loadGroups = async () => {
      try {
        const res = await fetch('/api/groups/mine').then(r => r.json());
        if (res.success) {
          setGroupMenuLinks(getMenuLinksForGroups(res.groupIds));
          setIsTeamLeader(res.groupIds.includes('team-leaders'));
          setIsHelpDeskMember(res.groupIds.includes('help-desk'));
        }
      } catch {}
    };
    loadGroups();
  }, [userProfile?.uid]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  // Auto-close mobile nav when viewport widens past mobile breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1025px)');
    const handler = (e) => { if (e.matches) setIsMobileNavOpen(false); };
    mq.addEventListener('change', handler);
    // Also close immediately if already wide
    if (mq.matches) setIsMobileNavOpen(false);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isActive = (href, exact = false) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const navLink = (href, icon, label, exact = false, badge) => (
    <Link
      href={href}
      onClick={(e) => { e.preventDefault(); window.location.href = href; }}
      className={`${s.navItem} ${isActive(href, exact) ? s.navItemActive : ''}`}
    >
      <span className={s.navItemIcon}>{icon}</span>
      {label}
      {badge > 0 && <span className={s.navBadge}>{badge}</span>}
    </Link>
  );

  const subLink = (href, label) => (
    <Link
      href={href}
      onClick={(e) => { e.preventDefault(); window.location.href = href; }}
      className={`${s.navSubItem} ${isActive(href) ? s.navSubItemActive : ''}`}
    >
      {label}
    </Link>
  );

  const roleBadgeText = userProfile?.is_owner ? 'Owner'
    : userProfile?.role === 'admin' ? 'Admin'
    : userProfile?.role === 'it_engineer' ? 'IT'
    : '';

  // Card required: anyone who must have a card on file (everyone except owners, IT and billing-exempt
  // accounts) and has none sees only the add-card screen. Saving a card lets them straight in;
  // otherwise their only other choice is to log out.
  const needsCard = !!userProfile && !isSubscriptionExempt(userProfile) && !userProfile.payment?.cardLastFour;
  if (needsCard) {
    return <CardRequiredGate userProfile={userProfile} onSaved={refreshProfile} />;
  }

  return (
    <div className={s.shell}>
      {/* ── Skip to main content ── */}
      <a href="#main-content" className={s.skipLink}>
        Skip to main content
      </a>

      {/* ── Sidebar ── */}
      <aside className={`${s.sidebar} ${isMobileNavOpen ? s.sidebarOpen : ''}`} aria-label="Main navigation">
        <div className={s.sidebarLogo}>
          <Link href="/dashboard" onClick={(e) => { e.preventDefault(); window.location.href = '/dashboard'; }}>
            <img
              src="/new-nxt-logo.png"
              alt="NXT Financial Group"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/nxt-financial-group-logo.png';
              }}
            />
          </Link>
        </div>

        {/* Quick Task + Search */}
        <div className={s.sidebarActions}>
          <button className={s.quickTaskBtn} onClick={() => setIsTaskModalOpen(true)}>
            {ICONS.plus}
            Quick Task
          </button>
          <button className={s.searchBtn} onClick={() => setIsSearchOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Search
            <kbd className={s.searchKbd}>&#8984;K</kbd>
          </button>
        </div>

        <nav className={s.nav}>
          {/* Main */}
          <div className={s.navSection}>
            {navLink('/dashboard', ICONS.home, 'Dashboard', true)}
            {navLink('/dashboard/getting-started', ICONS.rocket, 'Get Started', true)}
          </div>

          {/* Business */}
          <div className={s.navSection}>
            <div className={s.navLabel}>Business</div>
            <NavSection
              label="Pipeline"
              icon={ICONS.layers}
              pathname={pathname}
              activePaths={['/dashboard/deals', '/dashboard/leads', '/dashboard/clients', '/dashboard/pipeline', '/dashboard/business/pipeline']}
            >
              {subLink('/dashboard/leads', 'Leads')}
              {subLink('/dashboard/clients', 'Clients')}
              {subLink('/dashboard/deals', 'New Businesses')}
              {subLink('/dashboard/business/pipeline', 'Pipeline Board')}
            </NavSection>

            <NavSection
              label="Commissions"
              icon={ICONS.chart}
              pathname={pathname}
              activePaths={['/dashboard/commissions', '/dashboard/commission-distribution']}
            >
              {subLink('/dashboard/commissions', 'My Commissions')}
              {subLink('/dashboard/business/insurance', 'Insurance')}
              {subLink('/dashboard/business/annuities', 'Annuities')}
              {subLink('/dashboard/business/trail', 'Trail')}
              {subLink('/dashboard/business/renewals', 'Renewals')}
            </NavSection>

            {navLink('/dashboard/tasks', ICONS.clipboard, 'Tasks')}
            {navLink('/dashboard/contracts', ICONS.fileText, 'Contracts')}

            <NavSection
              label="Resources"
              icon={ICONS.briefcase}
              pathname={pathname}
              activePaths={['/dashboard/business/documents', '/dashboard/business/carrier-updates', '/dashboard/business/carrier-resources', '/dashboard/business/marketing-data']}
            >
              {subLink('/dashboard/business/documents', 'Documents')}
              {subLink('/dashboard/business/carrier-updates', 'Carrier Updates')}
              {subLink('/dashboard/business/carrier-resources', 'Carrier Resources')}
              {subLink('/dashboard/business/marketing-data', 'Marketing Data')}
              <a href="https://drive.google.com/drive/folders/1j3lVm330BJBRCIPi7fi1PUVZACSjrhx5" target="_blank" rel="noopener noreferrer" className={s.navSubItem}>
                NXT Templates {ICONS.external}
              </a>
              {groupMenuLinks.filter(l => l.menu === 'business').map((link, i) => (
                <a key={i} href={link.url} target={link.external ? '_blank' : '_self'} rel={link.external ? 'noopener noreferrer' : undefined} className={s.navSubItem}>
                  {link.label} {link.external && ICONS.external}
                </a>
              ))}
            </NavSection>
          </div>

          {/* Team & Reports */}
          <div className={s.navSection}>
            <div className={s.navLabel}>Team</div>
            {navLink('/dashboard/team', ICONS.users, 'Team')}
            {navLink('/dashboard/reports', ICONS.activity, 'Reports')}
            {navLink('/dashboard/scoreboard', ICONS.trophy, 'Scoreboard')}
            {navLink('/dashboard/recruitment', ICONS.userPlus, 'Recruitment')}
          </div>

          {/* Learn & Tools */}
          <div className={s.navSection}>
            <div className={s.navLabel}>Tools</div>
            {navLink('/dashboard/calculator', ICONS.calculator, 'Calculator')}
            {navLink('/dashboard/learn', ICONS.book, 'NXT University')}
            {userProfile?.status === 'active' && navLink('/dashboard/surelc', ICONS.shield, 'SureLC')}
            {navLink('/dashboard/help', ICONS.helpCircle, 'NXT Help')}
            {navLink('/dashboard/brand-shop', ICONS.shoppingBag, 'NXT Brand Shop')}
          </div>

          {/* Admin section */}
          {(isAdmin || isTeamLeader || isHelpDeskMember) && (
            <div className={s.navSection}>
              <div className={s.navDivider} />
              <div className={s.navLabel}>Admin</div>

              {(isAdmin || isTeamLeader) && (
                <>
                  {subLink('/dashboard/admin/approvals', 'Agent Approvals')}
                  {subLink('/dashboard/admin/documents', 'Document Review')}
                  {subLink('/dashboard/admin/onboarding', 'Team Onboarding')}
                </>
              )}

              {isAdmin && (
                <>
                  {subLink('/dashboard/commissions/needs-review', 'Needs Review')}
                  {subLink('/dashboard/commissions/import', 'Import Statement')}
                  {subLink('/dashboard/settings/commissions', 'Carriers & Rates')}
                  {subLink('/dashboard/settings/agent-levels', 'Agent Levels')}
                  {subLink('/dashboard/commission-distribution', 'Commission Distribution')}
                  {subLink('/dashboard/admin/groups', 'Groups')}
                  {subLink('/dashboard/admin/workboard', 'Work Board')}
                  {subLink('/dashboard/admin/announcements', 'Announcements')}
                </>
              )}

              {(isAdmin || isHelpDeskMember) && (
                subLink('/dashboard/admin/help', 'Help Desk')
              )}

              {(isAdmin || userProfile?.is_owner) && (
                subLink('/dashboard/logs', 'Activity Logs')
              )}
            </div>
          )}
        </nav>

        {/* ── User footer ── */}
        <div className={s.sidebarFooter} ref={userMenuRef} style={{ position: 'relative' }}>
          {isUserMenuOpen && (
            <div className={s.userDropdown}>
              <Link href="/dashboard/settings/profile" onClick={(e) => { e.preventDefault(); setIsUserMenuOpen(false); window.location.href = '/dashboard/settings/profile'; }} className={s.userDropdownItem}>
                My Profile
              </Link>
              <Link href="/dashboard/billing" onClick={(e) => { e.preventDefault(); setIsUserMenuOpen(false); window.location.href = '/dashboard/billing'; }} className={s.userDropdownItem}>
                Billing
              </Link>
              <a href="https://nxtfinancialgroup.ourproshop.com/en-US" target="_blank" rel="noopener noreferrer" onClick={() => setIsUserMenuOpen(false)} className={s.userDropdownItem}>
                NXT Brand Shop {ICONS.external}
              </a>
              <div className={s.userDropdownDivider} />
              <button onClick={() => { setIsUserMenuOpen(false); auth.signOut(); }} className={s.userDropdownDanger}>
                Sign Out
              </button>
            </div>
          )}

          <div className={s.footerRow}>
            <div className={s.footerAvatarWrap} onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}>
              <Avatar name={dn(userProfile) || firebaseUser?.email} photoUrl={userProfile?.photo_url} size={34} />
              <span className={s.footerOnlineDot} />
            </div>
            <div className={s.footerInfo} onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}>
              <div className={s.footerName}>{dn(userProfile)}</div>
              <div className={s.footerRole}>{roleBadgeText || userProfile?.role}</div>
            </div>
            <div className={s.footerActions}>
              <div className={s.footerIconBtn} onClick={(e) => e.stopPropagation()}>
                <NotificationBell />
              </div>
              <Link href="/dashboard/settings/profile" onClick={(e) => { e.preventDefault(); window.location.href = '/dashboard/settings/profile'; }} className={s.footerIconBtn} aria-label="Settings">
                {ICONS.settings}
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile overlay ── */}
      {isMobileNavOpen && (
        <div className={s.mobileOverlay} onClick={() => setIsMobileNavOpen(false)} aria-hidden="true" />
      )}

      {/* ── Main area ── */}
      <div className={s.main}>
        {/* Mobile header */}
        <header className={s.mobileHeader}>
          <button className={s.mobileMenuBtn} onClick={() => setIsMobileNavOpen(!isMobileNavOpen)} aria-label="Toggle navigation">
            {isMobileNavOpen ? ICONS.x : ICONS.menu}
          </button>
          <img
            src="/new-nxt-logo.png"
            alt="NXT"
            className={s.mobileLogo}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/nxt-financial-group-logo.png';
            }}
          />
          <button className={s.mobileTaskBtn} onClick={() => setIsTaskModalOpen(true)} aria-label="Quick task">
            +
          </button>
        </header>

        <main id="main-content" className={s.content} onClick={() => { if (isMobileNavOpen) setIsMobileNavOpen(false); }}>
          {isLoading ? (
            <div className={s.loading}>
              <div className={s.loadingSpinner} />
            </div>
          ) : children}
        </main>
      </div>

      <TaskQuickAddModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        userProfile={userProfile}
      />
      <CommandPalette isOpen={isSearchOpen} onClose={closeSearch} />
      <KeyboardShortcuts onQuickTask={() => setIsTaskModalOpen(true)} />
    </div>
  );
}
