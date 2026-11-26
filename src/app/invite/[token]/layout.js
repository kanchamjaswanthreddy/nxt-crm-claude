import React from 'react';
import Image from 'next/image';
import InteractiveBackground from '@/components/ui/InteractiveBackground';
import styles from './layout.module.css';

export default function InviteLayout({ children }) {
  return (
    <>
      <InteractiveBackground />
      <div className={styles.container} style={{ position: 'relative', zIndex: 1 }}>
        <div className={styles.cardWrapper}>
          <div className={styles.logo}>
            <Image
              src="/new-nxt-logo.png"
              alt="NXT Financial Group"
              width={240}
              height={80}
              className={styles.logoImage}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
