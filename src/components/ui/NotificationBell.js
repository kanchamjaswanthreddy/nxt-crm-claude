'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchNotifications, markNotificationsRead } from '@/app/actions/notifications';
import s from './NotificationBell.module.css';

export default function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);

  const load = useCallback(async () => {
    const res = await fetchNotifications();
    if (res.success) {
      setNotifications(res.notifications);
      setUnreadCount(res.notifications.filter(n => !n.read).length);
    }
  }, []);

  // Poll every 60s
  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [isOpen]);

  const handleOpen = async () => {
    setIsOpen(prev => !prev);
    if (!isOpen && unreadCount > 0) {
      await markNotificationsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleClick = (n) => {
    setIsOpen(false);
    if (n.href) router.push(n.href);
  };

  const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className={s.wrapper} ref={panelRef}>
      <button className={s.bellBtn} onClick={handleOpen} aria-label="Notifications">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className={s.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className={s.panel} role="dialog" aria-label="Notifications">
          <div className={s.panelHeader}>
            <h3 className={s.panelTitle}>Notifications</h3>
          </div>
          <div className={s.panelBody}>
            {notifications.length === 0 ? (
              <div className={s.empty}>No notifications yet</div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  className={`${s.item} ${n.read ? '' : s.itemUnread}`}
                  onClick={() => handleClick(n)}
                >
                  <div className={s.itemIcon}>
                    {n.type === 'task' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                    )}
                  </div>
                  <div className={s.itemContent}>
                    <p className={s.itemText}>{n.message}</p>
                    <span className={s.itemTime}>{timeAgo(n.createdAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
