"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createLead } from '@/app/actions/leads';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

const MIN_SUBMIT_TIME_MS = 2000;

export default function PublicWebFormPage({ params }) {
  const { agencyId } = React.use(params);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('');
  const [website, setWebsite] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const mountedAtRef = useRef(Date.now());
  useEffect(() => { mountedAtRef.current = Date.now(); }, []);

  const validateForm = () => {
    if (!firstName || !lastName) {
      setError('First and last name are required.');
      return false;
    }
    if (!email && !phone) {
      setError('Either email or phone is required.');
      return false;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Invalid email address.');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Honeypot: bots fill the hidden field, humans never see it
    if (website) {
      setIsSuccess(true);
      return;
    }

    // Timestamp check: bots submit almost instantly after page load
    if (Date.now() - mountedAtRef.current < MIN_SUBMIT_TIME_MS) {
      setIsSuccess(true);
      return;
    }

    setIsSubmitting(true);
    setError('');

    const leadData = {
      agencyId,
      creatorAgentId: null,
      ownerAgentId: null, // Will trigger round-robin on the backend
      ownerHierarchyPath: null,
      firstName,
      lastName,
      email,
      phone,
      address: { state },
      source: 'web_form'
    };

    const res = await createLead(leadData);

    if (res.success || res.isDuplicate) {
      // For web forms, duplicates are automatically handled on the backend (merged).
      // We don't expose duplicate status to the public to prevent data leakage.
      setIsSuccess(true);
    } else {
      setError(res.error || 'An error occurred. Please try again.');
    }
    
    setIsSubmitting(false);
  };

  if (isSuccess) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--surface-page)' }}>
        <Card style={{ maxWidth: '400px', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--status-success, #2FA84F)', marginBottom: 'var(--space-2)' }}>Thank You!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
            We have received your information and an agent will be in touch with you shortly.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--surface-page)', padding: 'var(--space-3)' }}>
      <Card style={{ maxWidth: '500px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
          <h1 style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-h2)', margin: '0 0 8px 0' }}>Request a Consultation</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-secondary)' }}>Fill out the form below to connect with an insurance professional.</p>
        </div>

        {error && (
          <div style={{ backgroundColor: 'var(--status-error, #fde8e8)', color: 'var(--status-error-text, #9b1c1c)', padding: 'var(--space-2)', borderRadius: '8px', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <Input id="firstName" label="First Name *" value={firstName} onChange={e => setFirstName(e.target.value)} required />
            <Input id="lastName" label="Last Name *" value={lastName} onChange={e => setLastName(e.target.value)} required />
          </div>

          <div style={{ marginBottom: 'var(--space-2)' }}>
            <Input id="email" label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <Input id="phone" label="Phone Number" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Input id="state" label="State (e.g. TX)" value={state} onChange={e => setState(e.target.value)} maxLength={2} />
          </div>

          {/* Honeypot field -- invisible to humans, bots auto-fill it */}
          <div style={{ position: 'absolute', left: '-9999px', opacity: 0 }} aria-hidden="true">
            <input
              type="text"
              name="website"
              id="website"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <Button type="submit" isLoading={isSubmitting} style={{ width: '100%' }}>
            Submit Request
          </Button>
          
          <p style={{ fontSize: 'var(--text-caption)', color: 'var(--silver)', textAlign: 'center', marginTop: 'var(--space-2)' }}>
            By submitting this form, you agree to be contacted by our agents.
          </p>
        </form>
      </Card>
    </div>
  );
}
