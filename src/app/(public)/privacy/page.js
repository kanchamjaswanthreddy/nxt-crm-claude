import React from 'react';

export const metadata = {
  title: 'Privacy Policy | NXT CRM',
  description: 'Privacy policy and data handling practices for NXT CRM.',
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-5) 24px' }}>
      <h1 style={{ color: 'var(--brand-navy)', marginBottom: 'var(--space-3)' }}>Privacy Policy</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>Last Updated: {new Date().toLocaleDateString('en-US')}</p>
      
      <div style={{ lineHeight: '1.6', color: 'var(--text-primary)' }}>
        <p><strong>[DRAFT / PLACEHOLDER - REQUIRES LEGAL REVIEW]</strong></p>
        
        <h2>1. Information We Collect</h2>
        <p>We collect information you provide directly to us when you create an account, manage leads, and interact with the CRM. We also collect client and prospect information (including PII such as name, email, phone, and date of birth) entered by agents during normal business operations.</p>
        
        <h2>2. How We Use Your Information</h2>
        <p>We use the information to provide, maintain, and improve our services, process transactions (including commissions), and comply with legal obligations.</p>
        
        <h2>3. Data Subject Rights (GDPR/CCPA)</h2>
        <p>If you are a client or prospect and wish to request a copy of your data or request deletion, please contact the agency administrator. The CRM provides tools to securely export all data related to a contact record, and an anonymization feature to permanently remove PII while preserving financial reporting integrity.</p>
        
        <h2>4. Contact Us</h2>
        <p>If you have questions about this privacy policy, please contact us at privacy@nxtcrm.com.</p>
      </div>
    </div>
  );
}
