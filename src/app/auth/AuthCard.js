'use client';

import { usePathname } from 'next/navigation';
import styles from './layout.module.css';

/** The fixed card that holds the form. The sign-up form is long, so it gets a wider card. */
export default function AuthCard({ children }) {
  const pathname = usePathname() || '';
  const wide = pathname.startsWith('/auth/signup');
  return (
    <main className={styles.card} data-wide={wide ? 'true' : undefined}>
      <div className={styles.formBody}>{children}</div>
      <p className={styles.formFooter}>&copy; NXT Financial Group Portal. All rights reserved.</p>
    </main>
  );
}
