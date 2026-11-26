import React from 'react';
import styles from './StatusBadge.module.css';

const DOT_CLASS_MAP = {
  success: styles.successDot,
  warning: styles.warningDot,
  error: styles.errorDot,
  info: styles.infoDot,
  neutral: styles.neutralDot,
  gold: styles.goldDot,
};

export default function StatusBadge({
  status,
  children,
  dot = true,
  className,
}) {
  const classes = [
    styles.badge,
    styles[status],
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      {dot && (
        <span
          className={[styles.dot, DOT_CLASS_MAP[status]].filter(Boolean).join(' ')}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
