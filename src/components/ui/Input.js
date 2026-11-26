import React from 'react';
import styles from './Input.module.css';

export default function Input({
  label,
  helpText,
  error,
  onBlur,
  onChange,
  type,
  textarea = false,
  className,
  ...props
}) {
  const handleChange = (e) => {
    if (type === 'number' && onChange) {
      const raw = e.target.value;
      if (raw.length > 1 && raw.startsWith('0') && raw[1] !== '.') {
        e.target.value = String(Number(raw));
      }
    }
    onChange?.(e);
  };

  const handleBlur = (e) => {
    if (type === 'number' && e.target.value !== '') {
      e.target.value = String(Number(e.target.value));
      onChange?.(e);
    }
    onBlur?.(e);
  };

  const Tag = textarea ? 'textarea' : 'input';

  return (
    <div className={`${styles.wrapper} ${className || ''}`}>
      {label && <label className={styles.label} htmlFor={props.id}>{label}</label>}
      {helpText && <span className={styles.helpText}>{helpText}</span>}
      <Tag
        className={`${textarea ? styles.textarea : styles.input} ${error ? styles.error : ''}`}
        type={textarea ? undefined : type}
        onChange={handleChange}
        onBlur={textarea ? onBlur : handleBlur}
        {...props}
      />
      {error && (
        <span className={styles.errorMessage} role="alert">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
