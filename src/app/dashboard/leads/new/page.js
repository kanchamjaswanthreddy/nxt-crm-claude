"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createLead } from '@/app/actions/leads';
import { useUser } from '@/context/UserContext';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AddLeadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile } = useUser();
  const fromPipeline = searchParams.get('fromPipeline');

  const [firstName, setFirstName] = useState(searchParams.get('firstName') || '');
  const [lastName, setLastName] = useState(searchParams.get('lastName') || '');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  const [dateOfBirth, setDateOfBirth] = useState(searchParams.get('dateOfBirth') || '');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [state, setState] = useState(searchParams.get('state') || '');
  const [zip, setZip] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [duplicateMatch, setDuplicateMatch] = useState(null);

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
    
    setIsSubmitting(true);
    setError('');
    setDuplicateMatch(null);

    const leadData = {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      address: { street, city, state, zip },
      source: 'manual'
    };

    const res = await createLead(leadData);

    if (res.success) {
      router.push(`/dashboard/leads/${res.id}`);
    } else {
      if (res.isDuplicate) {
        setDuplicateMatch({ id: res.duplicateId, name: res.duplicateName });
      } else {
        setError(res.error || 'An error occurred while creating the lead.');
      }
      setIsSubmitting(false);
    }
  };

  if (!userProfile) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
      <LoadingSpinner label="Loading..." />
    </div>
  );

  return (
    <div>
      <PageHeader title="Add New Lead" subtitle="Manually enter a new lead into your CRM." />

      {fromPipeline && (
        <div style={{
          backgroundColor: 'rgba(227, 169, 74,0.06)', color: '#1d4ed8',
          padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', maxWidth: '800px',
          fontSize: '16px', border: '1px solid rgba(227, 169, 74,0.15)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          Pre-filled from Pipeline contact. Review and complete the remaining fields.
        </div>
      )}

      <Card style={{ maxWidth: '800px' }}>
        {error && (
          <div style={{ backgroundColor: 'var(--status-error, #fde8e8)', color: 'var(--status-error-text, #9b1c1c)', padding: 'var(--space-2)', borderRadius: '8px', marginBottom: 'var(--space-3)', fontSize: 'var(--text-secondary)' }}>
            {error}
          </div>
        )}

        {duplicateMatch && (
          <div style={{ backgroundColor: 'var(--status-warning, #fdf6b2)', color: '#723b13', padding: 'var(--space-2)', borderRadius: '8px', marginBottom: 'var(--space-3)', border: '1px solid #fce96a' }}>
            <strong>Duplicate Detected!</strong>
            <p style={{ margin: 'var(--space-1) 0', fontSize: 'var(--text-secondary)' }}>
              A lead named <strong>{duplicateMatch.name}</strong> already exists with this email or phone number in your agency.
            </p>
            <Button variant="secondary" onClick={() => router.push(`/dashboard/leads/${duplicateMatch.id}`)}>
              View Existing Lead Instead
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <Input id="firstName" label="First Name *" value={firstName} onChange={e => setFirstName(e.target.value)} required />
            <Input id="lastName" label="Last Name *" value={lastName} onChange={e => setLastName(e.target.value)} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <Input id="email" label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <Input id="phone" label="Phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>* At least one of Email or Phone is required.</p>
          </div>

          <div style={{ marginBottom: 'var(--space-3)' }}>
            <Input id="dob" label="Date of Birth" type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
          </div>

          <h3 style={{ fontSize: 'var(--text-body)', marginBottom: 'var(--space-2)', color: 'var(--brand-navy)' }}>Address (Optional)</h3>
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <Input id="street" label="Street" value={street} onChange={e => setStreet(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <Input id="city" label="City" value={city} onChange={e => setCity(e.target.value)} />
            <Input id="state" label="State (e.g. TX)" value={state} onChange={e => setState(e.target.value)} maxLength={2} />
            <Input id="zip" label="Zip" value={zip} onChange={e => setZip(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <Button variant="secondary" onClick={() => router.push('/dashboard/leads')} type="button" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={duplicateMatch !== null}>
              Create Lead
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
