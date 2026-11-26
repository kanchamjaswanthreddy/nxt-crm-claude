'use client';

/**
 * Shared avatar component — shows photo_url when available, falls back to initial.
 *
 * @param {{ name?: string, photoUrl?: string, size?: number, goldText?: boolean, ownerRing?: boolean, style?: object }} props
 */
export default function Avatar({ name, photoUrl, size = 36, goldText = true, ownerRing = false, style }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  const fontSize = Math.max(10, Math.round(size * 0.4));

  const base = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    backgroundColor: 'var(--brand-navy)',
    color: goldText ? 'var(--brand-gold)' : '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: `${fontSize}px`,
    flexShrink: 0,
    overflow: 'hidden',
    border: ownerRing ? '2.5px solid var(--brand-gold)' : 'none',
    ...style,
  };

  return (
    <div style={base}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        initial
      )}
    </div>
  );
}
