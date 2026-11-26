import React from 'react';
import Image from 'next/image';
import styles from './layout.module.css';

export default function AuthLayout({ children }) {
  return (
    <div className={styles.page}>
      {/* ── Left: text sitting on the blue part of the background ── */}
      <div className={styles.left}>
        <div className={styles.leftContent}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowText}>NXT Financial Group</span>
            <span className={styles.eyebrowLine} />
          </div>
          <h1 className={styles.headline}>
            Empowering Your<br />
            Financial <span className={styles.headlineGold}>Future</span>
          </h1>
          <div className={styles.tagline}>
            <span>Plan</span>
            <span className={styles.taglineDot}>&bull;</span>
            <span>Grow</span>
            <span className={styles.taglineDot}>&bull;</span>
            <span>Achieve</span>
          </div>
        </div>
      </div>

      {/* ── Right: logo + form on the white part of the background ── */}
      <div className={styles.right}>
        <div className={styles.formColumn}>
          <div className={styles.logo}>
            <Image
              src="/new-nxt-logo.png"
              alt="NXT Financial Group"
              width={280}
              height={90}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>

          <div className={styles.formBody}>
            {children}
          </div>

          <div className={styles.formFooter}>
            &copy; NXT Financial Group Portal. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
