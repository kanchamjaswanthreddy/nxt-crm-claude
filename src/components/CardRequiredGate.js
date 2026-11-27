'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripeClient';
import { auth } from '@/lib/firebase/clientApp';
import s from './CardRequiredGate.module.css';

// Shown instead of the CRM when a signed-in person who must have a card on file has none.
// It uses the same two steps as Billing > Update card: /api/stripe/setup-intent, then
// /api/stripe/update-payment-method, which saves the card's last four on their record.
function GateForm({ userProfile, onSaved }) {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const fullName = [userProfile.first_name, userProfile.middle_name, userProfile.last_name].filter(Boolean).join(' ') || userProfile.full_name || '';

  useEffect(() => {
    let cancelled = false;
    fetch('/api/stripe/setup-intent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userProfile.email, name: fullName, agentId: userProfile.uid }),
    })
      .then(r => r.json())
      .then(d => { if (cancelled) return; if (d.error) setError(d.error); else { setClientSecret(d.clientSecret); setCustomerId(d.customerId); } setReady(true); })
      .catch(() => { if (!cancelled) { setError('The card form could not start. Check your connection and reload the page.'); setReady(true); } });
    return () => { cancelled = true; };
  }, [userProfile.email, userProfile.uid, fullName]);

  const save = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) return;
    setBusy(true); setError('');
    const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: { card: elements.getElement(CardElement), billing_details: { name: fullName, email: userProfile.email } },
    });
    if (stripeError) { setError(stripeError.message); setBusy(false); return; }
    try {
      const res = await fetch('/api/stripe/update-payment-method', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, paymentMethodId: setupIntent.payment_method, agentId: userProfile.uid }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setBusy(false); return; }
      await onSaved();
    } catch {
      setError('Your card could not be saved. Please try again.'); setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className={s.form}>
      <label className={s.label} htmlFor="gate-card">Card details</label>
      <div id="gate-card" className={s.cardBox}>
        {ready ? (
          <CardElement onChange={(ev) => { setComplete(ev.complete); setError(ev.error ? ev.error.message : ''); }}
            options={{ style: { base: { fontSize: '17px', color: '#0C1022', '::placeholder': { color: '#8B877F' } }, invalid: { color: '#B42318' } } }} />
        ) : <span className={s.loading}>Loading the card form</span>}
      </div>
      {error && <p className={s.error} role="alert">{error}</p>}
      <button type="submit" className={s.save} disabled={busy || !complete || !clientSecret}>{busy ? 'Saving your card' : 'Save card and continue'}</button>
    </form>
  );
}

export default function CardRequiredGate({ userProfile, onSaved }) {
  const [leaving, setLeaving] = useState(false);
  const logOut = async () => { setLeaving(true); try { await auth.signOut(); } finally { window.location.href = '/auth/login'; } };
  return (
    <div className={s.page} role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className={s.card}>
        <Image src="/new-nxt-logo.png" alt="NXT Financial Group" width={170} height={55} style={{ objectFit: 'contain' }} priority />
        <h1 id="gate-title" className={s.title}>Please add your card details to continue<span>.</span></h1>
        <p className={s.text}>Your account has no card on file, so the back office is locked until one is saved. Add a card below and you will go straight in.</p>
        <Elements stripe={getStripe()}>
          <GateForm userProfile={userProfile} onSaved={onSaved} />
        </Elements>
        <button type="button" className={s.out} onClick={logOut} disabled={leaving}>{leaving ? 'Logging out' : 'OK, log me out'}</button>
        <p className={s.small}>You will see this screen each time you sign in until a card is saved. Need help? Contact your upline or NXT support.</p>
      </div>
    </div>
  );
}
