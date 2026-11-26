import React from 'react';
import Image from 'next/image';
import styles from './layout.module.css';

export default function AuthLayout({ children }) {
  return (
    <div className={styles.page}>
      <aside className={styles.left}>
        <span className={styles.glow} aria-hidden="true" />
        <svg className={styles.rings} viewBox="0 0 600 600" aria-hidden="true">
          <circle cx="300" cy="300" r="150" />
          <circle cx="300" cy="300" r="220" />
          <circle cx="300" cy="300" r="290" />
        </svg>

        <p className={styles.brand}>NXT Financial Group</p>

        <div className={styles.leftContent}>
          <h1 className={styles.headline}>
            Empowering your financial future<span className={styles.stop}>.</span>
          </h1>
          <p className={styles.tagline}>Plan, grow, achieve.</p>
        </div>

        <div className={styles.art} aria-hidden="true">
          <svg viewBox="0 0 520 190" className={styles.chart} preserveAspectRatio="none">
            <defs>
              <linearGradient id="authFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#E3A94A" stopOpacity="0.34" />
                <stop offset="1" stopColor="#E3A94A" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path className={styles.area} d="M0 160 C 70 150, 110 118, 170 122 S 270 84, 330 78 S 440 40, 520 18 L 520 190 L 0 190 Z" fill="url(#authFill)" />
            <path className={styles.line} pathLength="1" d="M0 160 C 70 150, 110 118, 170 122 S 270 84, 330 78 S 440 40, 520 18" />
          </svg>
          <div className={styles.split}>
            <span style={{ flexGrow: 62 }} />
            <span style={{ flexGrow: 23 }} />
            <span style={{ flexGrow: 15 }} />
          </div>
        </div>
      </aside>

      <main className={styles.right}>
        <div className={styles.formColumn}>
          <div className={styles.logo}>
            <Image src="/new-nxt-logo.png" alt="NXT Financial Group" width={220} height={71} style={{ objectFit: 'contain' }} priority />
          </div>
          <div className={styles.formBody}>{children}</div>
          <div className={styles.formFooter}>&copy; NXT Financial Group Portal. All rights reserved.</div>
        </div>
      </main>
    </div>
  );
}
