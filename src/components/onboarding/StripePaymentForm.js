"use client";

import React, { useState, useEffect } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripeClient';


const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      color: '#0F2A52',
      '::placeholder': { color: 'rgba(0, 0, 0, 0.3)' },
      iconColor: '#0F2A52',
    },
    invalid: {
      color: '#D33F3F',
      iconColor: '#D33F3F',
    },
  },
  hidePostalCode: false,
};

function PaymentFormInner({
  agentEmail,
  agentName,
  agentId,
  assignedLevel,
  onSetupComplete,
  validationErrors,
  consent,
  onConsentChange,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState('');
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);

  // Create SetupIntent when component mounts
  useEffect(() => {
    if (!agentEmail || !agentId) return;

    let cancelled = false;

    (async () => {
      setIsCreatingIntent(true);

      try {
        const res = await fetch('/api/stripe/setup-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: agentEmail, name: agentName, agentId }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.error) {
          setCardError(data.error);
        } else {
          setClientSecret(data.clientSecret);
          setCustomerId(data.customerId);
        }
        setIsCreatingIntent(false);
      } catch (err) {
        if (!cancelled) {
          setCardError('Failed to initialize payment. Please try again.');
          setIsCreatingIntent(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [agentEmail, agentId, agentName]);

  // Expose the confirm function to parent via onSetupComplete callback
  useEffect(() => {
    if (!onSetupComplete) return;

    const confirmSetup = async () => {
      if (!stripe || !elements || !clientSecret) {
        return { error: 'Payment not ready. Please wait.' };
      }

      const cardElement = elements.getElement(CardElement);
      const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: { name: agentName, email: agentEmail },
        },
      });

      if (error) {
        return { error: error.message };
      }

      // Create the subscription
      const subRes = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          paymentMethodId: setupIntent.payment_method,
          agentLevel: assignedLevel,
          agentId,
        }),
      });

      const subData = await subRes.json();
      if (subData.error) {
        return { error: subData.error };
      }

      return {
        success: true,
        customerId,
        subscriptionId: subData.subscriptionId,
        cardLast4: subData.cardLast4,
        cardBrand: subData.cardBrand,
        trialEnd: subData.trialEnd,
      };
    };

    onSetupComplete(confirmSetup);
  }, [stripe, elements, clientSecret, customerId, agentName, agentEmail, assignedLevel, agentId, onSetupComplete]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Free trial banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(47, 168, 79, 0.08), rgba(47, 168, 79, 0.02))',
        border: '1px solid rgba(47, 168, 79, 0.2)',
        borderRadius: '12px',
        padding: 'var(--space-3)',
        textAlign: 'center',
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          backgroundColor: 'rgba(47, 168, 79, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto var(--space-1)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2FA84F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <p style={{ color: 'var(--status-success)', fontWeight: '700', fontSize: 'var(--text-body)', margin: '0 0 4px' }}>
          First Month FREE
        </p>
      </div>

      {/* Stripe Card Element */}
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
          Card Details *
        </label>
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          border: `1.5px solid ${cardError ? 'var(--status-error)' : 'var(--border-color)'}`,
          backgroundColor: 'var(--surface-card)',
          transition: 'border-color 0.2s ease',
        }}>
          {isCreatingIntent ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
              <div style={{
                width: '14px', height: '14px',
                border: '2px solid var(--brand-blue-accent)', borderTopColor: 'transparent',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Initializing secure payment...</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <CardElement
              options={CARD_ELEMENT_OPTIONS}
              onChange={(e) => {
                setCardComplete(e.complete);
                setCardError(e.error?.message || '');
              }}
            />
          )}
        </div>
        {cardError && (
          <span style={{ fontSize: '12px', color: 'var(--status-error)', marginTop: '4px', display: 'block' }}>{cardError}</span>
        )}
        {validationErrors?.card && (
          <span style={{ fontSize: '12px', color: 'var(--status-error)', marginTop: '4px', display: 'block' }}>{validationErrors.card}</span>
        )}
      </div>

      {/* Powered by Stripe badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Secured by <strong>Stripe</strong> — your card details are never stored on our servers
        </span>
      </div>

      {/* Consent checkbox */}
      <label style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: 'var(--space-2)', borderRadius: '10px',
        border: '1.5px solid var(--border-color)', backgroundColor: 'var(--surface-card)',
        cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={consent}
          onChange={e => onConsentChange(e.target.checked)}
          style={{ marginTop: '3px', accentColor: 'var(--brand-navy)', width: '18px', height: '18px' }}
        />
        <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-primary)', lineHeight: 1.5, fontWeight: 500 }}>
          I agree to be charged after my free trial period ends (30 days from today).
          I understand I can cancel anytime.
        </span>
      </label>
      {validationErrors?.consent && (
        <span style={{ fontSize: '12px', color: 'var(--status-error)', marginTop: '-8px' }}>{validationErrors.consent}</span>
      )}
    </div>
  );
}

/**
 * Wrapper that provides Stripe Elements context.
 */
export default function StripePaymentForm(props) {
  return (
    <Elements stripe={getStripe()}>
      <PaymentFormInner {...props} />
    </Elements>
  );
}
