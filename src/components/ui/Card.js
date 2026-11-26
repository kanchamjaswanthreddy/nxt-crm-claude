import React from 'react';
import styles from './Card.module.css';

export default function Card({ children, hoverable = false, compact = false, flush = false, className, ...props }) {
  const classes = [
    styles.card,
    hoverable && styles.hoverable,
    compact && styles.compact,
    flush && styles.flush,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
