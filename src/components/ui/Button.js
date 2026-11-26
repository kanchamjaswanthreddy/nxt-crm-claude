import React from 'react';
import styles from './Button.module.css';

export default function Button({
  children,
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  iconOnly = false,
  disabled = false,
  className,
  ...props
}) {
  const classes = [
    styles.btn,
    styles[variant],
    iconOnly ? styles.iconOnly : styles[size],
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <span className={styles.spinner} />}
      {!isLoading && children}
    </button>
  );
}
