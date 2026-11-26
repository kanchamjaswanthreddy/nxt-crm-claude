import React from 'react';
import styles from './LoadingSpinner.module.css';

export function LoadingSpinner({ size = 'medium', label, inline = false }) {
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
