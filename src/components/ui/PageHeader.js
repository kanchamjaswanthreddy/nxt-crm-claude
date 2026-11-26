import React from 'react';
import Link from 'next/link';
import styles from './PageHeader.module.css';

/**
 * @param {{ title: string, subtitle?: string, breadcrumbs?: Array<{label: string, href?: string}>, actions?: React.ReactNode }} props
 */
export default function PageHeader({ title, subtitle, breadcrumbs, actions }) {
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className={styles.breadcrumbSep} aria-hidden="true">/</span>}
                {crumb.href ? (
                  <Link href={crumb.href} className={styles.breadcrumbLink}>{crumb.label}</Link>
                ) : (
                  <span className={styles.breadcrumbCurrent} aria-current="page">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
