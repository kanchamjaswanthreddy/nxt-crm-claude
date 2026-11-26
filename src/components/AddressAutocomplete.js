"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Google Places Address Autocomplete.
 * Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local with Places API enabled.
 *
 * Props:
 *  - value: string (the street address line)
 *  - onChange: (street) => void
 *  - onPlaceSelect: ({ line1, city, state, zip }) => void — called when user picks a suggestion
 *  - label, placeholder, id, error, disabled — passed through to the input
 */

let googleMapsPromise = null;

function loadGoogleMaps() {
  if (googleMapsPromise) return googleMapsPromise;

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    return Promise.reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set'));
  }

  if (typeof window !== 'undefined' && window.google?.maps?.places) {
    return Promise.resolve(window.google.maps.places);
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=__initGooglePlaces`;
    script.async = true;
    script.defer = true;

    window.__initGooglePlaces = () => {
      delete window.__initGooglePlaces;
      resolve(window.google.maps.places);
    };

    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error('Failed to load Google Maps'));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function parseAddressComponents(place) {
  const result = { line1: '', city: '', state: '', zip: '' };
  const components = place.address_components || [];

  let streetNumber = '';
  let route = '';

  for (const comp of components) {
    const type = comp.types[0];
    if (type === 'street_number') streetNumber = comp.long_name;
    if (type === 'route') route = comp.long_name;
    if (type === 'locality' || type === 'sublocality_level_1') result.city = comp.long_name;
    if (type === 'administrative_area_level_1') result.state = comp.short_name;
    if (type === 'postal_code') result.zip = comp.long_name;
  }

  result.line1 = streetNumber ? `${streetNumber} ${route}` : route;

  return result;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  label = 'Street Address',
  placeholder = 'Start typing your address...',
  id = 'address-autocomplete',
  error,
  disabled,
}) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const handlePlaceChanged = useCallback(() => {
    const autocomplete = autocompleteRef.current;
    if (!autocomplete) return;

    const place = autocomplete.getPlace();
    if (!place?.address_components) return;

    const parsed = parseAddressComponents(place);
    if (onChange) onChange(parsed.line1);
    if (onPlaceSelect) onPlaceSelect(parsed);
  }, [onChange, onPlaceSelect]);

  useEffect(() => {
    let isMounted = true;

    loadGoogleMaps()
      .then(() => {
        if (!isMounted || !inputRef.current) return;
        setIsLoaded(true);

        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ['address'],
          componentRestrictions: { country: 'us' },
          fields: ['address_components'],
        });

        autocomplete.addListener('place_changed', handlePlaceChanged);
        autocompleteRef.current = autocomplete;
      })
      .catch(() => {
        if (isMounted) setLoadError(true);
      });

    return () => {
      isMounted = false;
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [handlePlaceChanged]);

  const inputStyles = {
    width: '100%',
    padding: 'var(--space-2) 16px',
    borderRadius: '12px',
    border: `1px solid ${error ? 'var(--status-error)' : 'var(--border-color)'}`,
    backgroundColor: 'var(--surface-card)',
    fontFamily: 'var(--font-base)',
    fontSize: 'var(--text-secondary)',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    boxSizing: 'border-box',
  };

  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          style={{
            display: 'block',
            marginBottom: 'var(--space-1)',
            fontSize: 'var(--text-secondary)',
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={e => onChange && onChange(e.target.value)}
        placeholder={loadError ? 'Enter your address' : (isLoaded ? placeholder : 'Loading address search...')}
        disabled={disabled}
        autoComplete="off"
        style={inputStyles}
        onFocus={e => {
          e.target.style.borderColor = 'var(--brand-blue-accent)';
          e.target.style.boxShadow = '0 0 0 3px rgba(45, 111, 196, 0.1)';
        }}
        onBlur={e => {
          e.target.style.borderColor = error ? 'var(--status-error)' : 'var(--border-color)';
          e.target.style.boxShadow = 'none';
        }}
      />
      {error && (
        <span style={{ fontSize: 'var(--text-caption)', color: 'var(--status-error)', marginTop: '2px', display: 'block' }}>
          {error}
        </span>
      )}
    </div>
  );
}
