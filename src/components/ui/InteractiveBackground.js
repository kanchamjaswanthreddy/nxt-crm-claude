import React from 'react';
import s from './InteractiveBackground.module.css';

// Backdrop for the join, invite, onboarding and pending-approval screens.
// Pure CSS: a cream page with a soft gold glow and slow rings. No canvas, no scripts.
export default function InteractiveBackground() {
  return (
    <div className={s.bg} aria-hidden="true">
      <span className={s.glowA} />
      <span className={s.glowB} />
      <svg className={s.rings} viewBox="0 0 600 600">
        <circle cx="300" cy="300" r="140" />
        <circle cx="300" cy="300" r="210" />
        <circle cx="300" cy="300" r="285" />
      </svg>
    </div>
  );
}
