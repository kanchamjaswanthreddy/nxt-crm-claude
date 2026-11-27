import React from 'react';
import Image from 'next/image';
import AuthReel from '@/components/AuthReel';
import AuthCard from './AuthCard';
import styles from './layout.module.css';

export default function AuthLayout({ children }) {
  return (
    <div className={styles.page}>
      <AuthReel />
      <div className={styles.logo}>
        <Image src="/new-nxt-logo.png" alt="NXT Financial Group" width={372} height={120} style={{ objectFit: 'contain', width: 'auto', height: '100%' }} priority />
      </div>
      <AuthCard>{children}</AuthCard>
    </div>
  );
}
