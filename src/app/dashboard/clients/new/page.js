"use client";

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { createClient } from '@/app/actions/clients';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
];

export default function AddClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [duplicateMatch, setDuplicateMatch] = useState(null);
  const fromPipeline = searchParams.get('fromPipeline');
  const fromLead = searchParams.get('fromLead');
  const prefilled = fromPipeline || fromLead;

  const [form, setForm] = useState({
    firstName: searchParams.get('firstName') || '',
    lastName: searchParams.get('lastName') || '',
    email: searchParams.get('email') || '',
    phone: searchParams.get('phone') || '',
    dateOfBirth: searchParams.get('dateOfBirth') || '',
    gender: '', maritalStatus: '', ssn4: '',
    employer: '',
    occupation: searchParams.get('occupation') || '',
    annualIncome: '',
    preferredContact: 'email',
    street: '',
    city: searchParams.get('city') || '',
    state: searchParams.get('state') || '',
    zip: '',
  });

  const update = (field, value) => setForm({ ...form, [field]: value });

  const validate = () => {
    if (!form.firstName || !form.lastName) {
      setError('First and last name are required.');
      return false;
    }
    if (!form.email && !form.phone) {
      setError('Either email or phone is required.');
      return false;
    }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      setError('Invalid email address.');
      return false;
    }
    if (form.ssn4 && !/^\d{4}$/.test(form.ssn4)) {
      setError('SSN last 4 must be exactly 4 digits.');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setError('');
    setDuplicateMatch(null);

    const res = await createClient({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
      maritalStatus: form.maritalStatus,
      ssn4: form.ssn4,
      employer: form.employer,
      occupation: form.occupation,
      annualIncome: form.annualIncome,
      preferredContact: form.preferredContact,
      address: {
        street: form.street,
        city: form.city,
        state: form.state,
        zip: form.zip,
      },
    });

    if (res.success) {
      router.push(`/dashboard/clients/${res.id}`);
    } else {
      if (res.isDuplicate) {
        setDuplicateMatch({ id: res.duplicateId, name: res.duplicateName });
      } else {
        setError(res.error || 'An error occurred.');
      }
      setIsSubmitting(false);
    }
  };

  if (!userProfile) {
    return <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'40vh'}}><LoadingSpinner label="Loading..." /></div>;
  }

  return (
    <div>
      {/* Back + Header */}
      <button
        onClick={() => router.push('/dashboard/clients')}
        style={{
          background: 'none', border: 'none', color: 'var(--text-secondary)',
          cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center',
          gap: '6px', marginBottom: '20px', padding: 0,
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand-navy)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
      >
        <span style={{ fontSize: '18px' }}>&larr;</span> Back to Clients
      </button>

      <PageHeader title="Add New Client" subtitle="Enter your client's details. You can add policies after creating the client." />

      {prefilled && (
        <div style={{
          backgroundColor: 'rgba(59,130,246,0.06)', color: '#1d4ed8',
          padding: '12px 16px', borderRadius: '10px', marginBottom: '20px',
          fontSize: '14px', border: '1px solid rgba(59,130,246,0.15)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          Pre-filled from {fromPipeline ? 'Pipeline contact' : 'Lead'}. Review and complete the remaining fields.
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: 'rgba(220,38,38,0.06)', color: '#dc2626',
          padding: '12px 16px', borderRadius: '10px', marginBottom: '20px',
          fontSize: '14px', border: '1px solid rgba(220,38,38,0.15)',
        }}>
          {error}
        </div>
      )}

      {duplicateMatch && (
        <div style={{
          backgroundColor: 'rgba(202,138,4,0.06)', color: '#92400e',
          padding: '16px', borderRadius: '10px', marginBottom: '20px',
          border: '1px solid rgba(202,138,4,0.2)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: '6px', fontSize: '14px' }}>Duplicate Detected</div>
          <p style={{ margin: '0 0 12px', fontSize: '14px' }}>
            A client named <strong>{duplicateMatch.name}</strong> already exists with this email.
          </p>
          <Button variant="secondary" onClick={() => router.push(`/dashboard/clients/${duplicateMatch.id}`)}>
            View Existing Client
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Personal Information */}
        <Card style={{ marginBottom: '20px' }}>
          <h3 style={sectionTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginRight: '8px' }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Personal Information
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <Input id="firstName" label="First Name *" value={form.firstName} onChange={(e) => update('firstName', e.target.value)} required />
            <Input id="lastName" label="Last Name *" value={form.lastName} onChange={(e) => update('lastName', e.target.value)} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <Input id="email" label="Email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            <Input id="phone" label="Phone" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', marginTop: 0 }}>
            * At least one of Email or Phone is required.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <Input id="dob" label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(e) => update('dateOfBirth', e.target.value)} />
            <div>
              <label style={labelStyle} htmlFor="gender">Gender</label>
              <select id="gender" value={form.gender} onChange={(e) => update('gender', e.target.value)} style={selectStyle}>
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={labelStyle} htmlFor="maritalStatus">Marital Status</label>
              <select id="maritalStatus" value={form.maritalStatus} onChange={(e) => update('maritalStatus', e.target.value)} style={selectStyle}>
                <option value="">Select...</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
                <option value="domestic_partner">Domestic Partner</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Input id="ssn4" label="SSN (Last 4)" value={form.ssn4} onChange={(e) => update('ssn4', e.target.value)} maxLength={4} placeholder="1234" />
            <div>
              <label style={labelStyle} htmlFor="preferredContact">Preferred Contact</label>
              <select id="preferredContact" value={form.preferredContact} onChange={(e) => update('preferredContact', e.target.value)} style={selectStyle}>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="text">Text</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Employment & Income */}
        <Card style={{ marginBottom: '20px' }}>
          <h3 style={sectionTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginRight: '8px' }}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            Employment & Income
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <Input id="employer" label="Employer" value={form.employer} onChange={(e) => update('employer', e.target.value)} />
            <Input id="occupation" label="Occupation" value={form.occupation} onChange={(e) => update('occupation', e.target.value)} />
            <Input id="annualIncome" label="Annual Income" type="number" value={form.annualIncome} onChange={(e) => update('annualIncome', e.target.value)} placeholder="75000" />
          </div>
        </Card>

        {/* Address */}
        <Card style={{ marginBottom: '28px' }}>
          <h3 style={sectionTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginRight: '8px' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Address
          </h3>
          <div style={{ marginBottom: '14px' }}>
            <Input id="street" label="Street" value={form.street} onChange={(e) => update('street', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '14px' }}>
            <Input id="city" label="City" value={form.city} onChange={(e) => update('city', e.target.value)} />
            <div>
              <label style={labelStyle} htmlFor="state">State</label>
              <select id="state" value={form.state} onChange={(e) => update('state', e.target.value)} style={selectStyle}>
                <option value="">Select...</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <Input id="zip" label="Zip" value={form.zip} onChange={(e) => update('zip', e.target.value)} />
          </div>
        </Card>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <Button variant="secondary" onClick={() => router.push('/dashboard/clients')} type="button" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={duplicateMatch !== null}>
            Create Client
          </Button>
        </div>
      </form>
    </div>
  );
}

const sectionTitle = {
  fontSize: '16px',
  color: 'var(--brand-navy)',
  marginBottom: '20px',
  marginTop: 0,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  color: 'var(--text-secondary)',
  marginBottom: '6px',
  fontWeight: '500',
};

const selectStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  fontSize: '14px',
  backgroundColor: '#fff',
  color: 'var(--text-primary)',
};
