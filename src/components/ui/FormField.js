import React from 'react';
import styles from './FormField.module.css';

/**
 * Wrapper for form inputs providing consistent label, help text, and error display.
 *
 * @param {{
 *   label?: string,
 *   htmlFor?: string,
 *   required?: boolean,
 *   optional?: boolean,
 *   helpText?: string,
 *   error?: string,
 *   children: React.ReactNode,
 *   className?: string,
 * }} props
 */
export default function FormField({ label, htmlFor, required, optional, helpText, error, children, className }) {
  return (
    <div className={`${styles.field} ${className || ''}`}>
      {label && (
        <div className={styles.labelRow}>
          <label className={styles.label} htmlFor={htmlFor}>
            {label}
            {required && <span className={styles.required} aria-hidden="true">*</span>}
          </label>
          {optional && <span className={styles.optional}>Optional</span>}
        </div>
      )}
      {helpText && !error && <span className={styles.helpText}>{helpText}</span>}
      {children}
      {error && (
        <span className={styles.errorText} role="alert">
          <svg className={styles.errorIcon} width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
          </svg>
          {error}
        </span>
      )}
    </div>
  );
}
