import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/auth/login');
}

/*
// Original demo landing page kept for reference
"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.logo}>
          NXT<span className={styles.logoAccent}> Financial</span>
        </div>
        <nav className={styles.nav}>
          <a href="#home" className={styles.navLink}>Home</a>
          <a href="#about" className={styles.navLink}>About Us</a>
          <a href="#services" className={styles.navLink}>Services</a>
          <a href="#contact" className={styles.navLink}>Contact</a>
        </nav>
        <div className={styles.headerActions}>
          <Link href="/auth/login" className={styles.loginBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Login
          </Link>
          <a href="#contact" className={styles.joinBtn}>Join Now</a>
          <button
            className={styles.mobileMenuBtn}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>}
          </button>
        </div>
      </div>
      <div className={`${styles.mobileNav} ${mobileOpen ? styles.mobileNavOpen : ''}`}>
        <a href="#home" className={styles.mobileNavLink} onClick={() => setMobileOpen(false)}>Home</a>
        <a href="#about" className={styles.mobileNavLink} onClick={() => setMobileOpen(false)}>About Us</a>
        <a href="#services" className={styles.mobileNavLink} onClick={() => setMobileOpen(false)}>Services</a>
        <a href="#contact" className={styles.mobileNavLink} onClick={() => setMobileOpen(false)}>Contact</a>
        <Link href="/auth/login" className={styles.btnPrimary} style={{ textAlign: 'center', textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>
          Login to CRM
        </Link>
      </div>
    </header>
  );
};

const Hero = () => {
  return (
    <section id="home" className={styles.hero}>
      <div className={`${styles.container} ${styles.heroGrid}`}>
        <div className={styles.heroCard}>
          <span className={styles.heroTag}>
            Canada&apos;s Leading MGA
          </span>
          <h1 className={styles.heroTitle}>
            Build Your Legacy with NXT Financial
          </h1>
          <p className={styles.heroDesc}>
            Join a North American financial powerhouse. Experience the unique Tribrid MGA model designed for agent success. Get licensed, build your legacy.
          </p>
          <div className={styles.heroCtas}>
            <a href="#services" className={styles.btnPrimary}>Learn More</a>
            <a href="#contact" className={styles.btnSecondary}>Contact Us</a>
          </div>
        </div>

        <div className={styles.heroImage}>
          <Image
            src="/hero_family.jpg"
            alt="Happy family protected by financial planning"
            fill
            style={{ objectFit: 'cover' }}
            priority
          />
        </div>
      </div>
    </section>
  );
};

const Features = () => {
  const features = [
    "Industry-leading compensation",
    "Comprehensive training and support",
    "Proprietary technology platform",
    "True ownership of your book of business"
  ];

  return (
    <section id="services" className={styles.features}>
      <div className={`${styles.container} ${styles.featuresGrid}`}>
        <div className={styles.featureImage}>
          <Image
            src="/feature_professional.jpg"
            alt="Financial Advisor consulting with clients"
            fill
            style={{ objectFit: 'cover' }}
          />
        </div>
        <div>
          <h2 className={styles.featureTitle}>
            Empowering Your Financial Future
          </h2>
          <p className={styles.featureDesc}>
            Our model is built differently. We put our agents and clients first. By removing corporate red tape, we give you the tools and support needed to thrive in today&apos;s dynamic market.
          </p>
          <ul className={styles.featureList}>
            {features.map((feature, idx) => (
              <li key={idx} className={styles.featureItem}>
                <span className={styles.featureCheck}>&#10003;</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

const Accordion = () => {
  const [open, setOpen] = useState(0);

  const faqs = [
    {
      q: "What is the Tribrid MGA Model?",
      a: "The Tribrid MGA Model combines the best aspects of captive, independent, and networking agencies. It provides unmatched support, top-tier compensation, and true ownership."
    },
    {
      q: "How do I get licensed?",
      a: "We offer an extensive training program that guides you through the licensing process step-by-step, ensuring you're ready to succeed from day one."
    },
    {
      q: "Can I work part-time?",
      a: "Absolutely! Our flexible platform allows you to build your business at your own pace, whether you're looking for supplemental income or a full-time career."
    },
  ];

  return (
    <section id="about" className={styles.faq}>
      <div className={`${styles.container} ${styles.faqContainer}`}>
        <h2 className={styles.faqTitle}>
          Frequently Asked Questions
        </h2>
        <div className={styles.faqList}>
          {faqs.map((faq, i) => (
            <div key={i} className={styles.faqItem}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className={`${styles.faqButton} ${open === i ? styles.faqButtonOpen : ''}`}
              >
                {faq.q}
                <span className={`${styles.faqArrow} ${open === i ? styles.faqArrowOpen : ''}`}>
                  &#9660;
                </span>
              </button>
              {open === i && (
                <div className={styles.faqAnswer}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Newsletter = () => {
  return (
    <section id="contact" className={styles.newsletter}>
      <div className={styles.container}>
        <div className={styles.newsletterCard}>
          <h2 className={styles.newsletterTitle}>
            Stay in the Loop
          </h2>
          <p className={styles.newsletterDesc}>
            No spam. Just the latest releases, tips, and interesting articles in your inbox every week.
          </p>
          <form onSubmit={(e) => e.preventDefault()} className={styles.newsletterForm}>
            <input
              type="email"
              placeholder="Enter your email address"
              className={styles.newsletterInput}
            />
            <button type="submit" className={styles.btnPrimary} style={{ padding: '16px 32px' }}>
              Subscribe Now
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.footerGrid}>
          <div>
            <div className={styles.footerLogo}>
              NXT<span className={styles.footerLogoAccent}> Financial</span>
            </div>
            <p className={styles.footerTagline}>
              Building Financial Foundations across North America.
            </p>
            <div className={styles.footerContact}>
              Email: info@nxtfinancialgroup.com<br />
              Phone: 1-800-555-0199
            </div>
          </div>
          <div>
            <h4 className={styles.footerHeading}>Quick Links</h4>
            <ul className={styles.footerLinks}>
              <li><a href="#home" className={styles.footerLink}>Home</a></li>
              <li><a href="#about" className={styles.footerLink}>About</a></li>
              <li><a href="#services" className={styles.footerLink}>Services</a></li>
              <li><Link href="/auth/login" className={styles.footerLink}>Agent Login</Link></li>
            </ul>
          </div>
          <div>
            <h4 className={styles.footerHeading}>Legal</h4>
            <ul className={styles.footerLinks}>
              <li><span className={styles.footerLink}>Privacy Policy</span></li>
              <li><span className={styles.footerLink}>Terms of Service</span></li>
              <li><span className={styles.footerLink}>Disclaimer</span></li>
            </ul>
          </div>
        </div>
        <div className={styles.footerBottom}>
          &copy; {new Date().getFullYear()} NXT Financial Group, NXT World Holdings, Inc. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
};

function OriginalHome() {
  return (
    <div className={styles.website}>
      <Header />
      <Hero />
      <Features />
      <Accordion />
      <Newsletter />
      <Footer />
    </div>
  );
}
*/
