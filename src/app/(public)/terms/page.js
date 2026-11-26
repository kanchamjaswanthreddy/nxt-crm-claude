import React from 'react';

export const metadata = {
  title: 'Terms of Service | NXT CRM',
  description: 'Terms of Service for NXT CRM.',
};

export default function TermsPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-5) 24px' }}>
      <h1 style={{ color: 'var(--brand-navy)', marginBottom: 'var(--space-3)' }}>Terms of Service</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>Last Updated: {new Date().toLocaleDateString('en-US')}</p>
      
      <div style={{ lineHeight: '1.6', color: 'var(--text-primary)' }}>
        <p><strong>[DRAFT / PLACEHOLDER - REQUIRES LEGAL REVIEW]</strong></p>
        
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing and using NXT CRM, you accept and agree to be bound by the terms and provision of this agreement.</p>
        
        <h2>2. Use of Service</h2>
        <p>The Service is designed for insurance agencies to manage leads, pipelines, and commissions. You agree to use the Service in compliance with all applicable local, state, and federal laws.</p>
        
        <h2>3. Data Ownership</h2>
        <p>The Agency retains all rights to the data entered into the system. The Agency is solely responsible for ensuring it has the appropriate consent to store client and prospect data.</p>
        
        <h2>4. Termination</h2>
        <p>We reserve the right to terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
      </div>
    </div>
  );
}
