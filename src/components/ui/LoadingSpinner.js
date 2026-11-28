import React from 'react';
import styles from './LoadingSpinner.module.css';

export function LoadingSpinner({ size = 'medium', label, inline = false }) {
  // A labelled, page-level loader shows soft placeholder shapes in place of the content that is on its way.
  if (label && !inline && size !== 'small') {
    return (
      <div className={styles.page} role="status" aria-label={String(label).replace(/\.+$/, '')}>
        <div className={styles.pageHead} aria-hidden="true"><span className={styles.skeleton} style={{ width: '38%', height: 22 }} /><span className={styles.skeleton} style={{ width: 96, height: 34, borderRadius: 999 }} /></div>
        {[92, 78, 86, 64, 72].map((w, i) => (
          <div key={i} className={styles.pageRow} aria-hidden="true"><span className={styles.skeleton} style={{ width: 36, height: 36, borderRadius: '50%', flex: 'none' }} /><span className={styles.skeleton} style={{ width: `${w}%`, height: 14 }} /></div>
        ))}
      </div>
    );
  }
  return (
    <div className={`${styles.wrapper} ${inline ? styles.inline : ''}`}>
      <div className={`${styles.spinner} ${styles[size]}`} role="status" aria-label={label || 'Loading'} />
      {label && <span className={styles.text}>{label}</span>}
    </div>
  );
}

export function Skeleton({ width, height, circle = false, className, style }) {
  return (
    <div
      className={`${circle ? styles.skeletonCircle : styles.skeleton} ${className || ''}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={`${styles.skeletonRow} ${className || ''}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={i === 0 ? styles.skeletonHeading : styles.skeletonText}
          style={i === lines - 1 ? { width: '75%' } : undefined}
        />
      ))}
    </div>
  );
}
