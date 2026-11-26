import React from 'react';
import styles from './EmptyState.module.css';

export default function EmptyState({
  variant = 'rich',
  icon,
  title,
  description,
  action,
  colSpan,
}) {
  if (variant === 'tableRow') {
    return (
      <tr className={styles.tableRow}>
        <td className={styles.tableRowCell} colSpan={colSpan}>
          {title}
          {description && <> &mdash; {description}</>}
          {action && (
            <>
              {' '}
              <button
                className={styles.minimalLink}
                onClick={action.onClick}
                type="button"
              >
                {action.label}
              </button>
            </>
          )}
        </td>
      </tr>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={styles.minimal}>
        <p className={styles.minimalText}>{title}</p>
        {action && (
          <button
            className={styles.minimalLink}
            onClick={action.onClick}
            type="button"
          >
            {action.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.rich}>
      {icon && <div className={styles.iconArea}>{icon}</div>}
      <h3 className={styles.richTitle}>{title}</h3>
      {description && <p className={styles.richDescription}>{description}</p>}
      {action && (
        <div className={styles.richAction}>
          <button onClick={action.onClick} type="button">
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
}
