'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

const SLIDES = [
  { src: '/flyers/01_Our_Vision.jpg', alt: 'Our Vision' },
  { src: '/flyers/02_Our_Mission.jpg', alt: 'Our Mission' },
  { src: '/flyers/03_PROTECT_Values.jpg', alt: 'PROTECT Values' },
  { src: '/flyers/04_Partnership.jpg', alt: 'Partnership' },
  { src: '/flyers/05_Responsibility.jpg', alt: 'Responsibility' },
  { src: '/flyers/06_Ownership.jpg', alt: 'Ownership' },
  { src: '/flyers/07_Transparency.jpg', alt: 'Transparency' },
  { src: '/flyers/08_Education.jpg', alt: 'Education' },
  { src: '/flyers/09_Commitment.jpg', alt: 'Commitment' },
  { src: '/flyers/10_Trust.jpg', alt: 'Trust' },
  { src: '/flyers/11_Closing.jpg', alt: 'NXT Financial Group' },
];

const AUTO_ADVANCE_MS = 5000;

export default function FlyerSlider({ onComplete }) {
  const [current, setCurrent] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const timerRef = useRef(null);

  const total = SLIDES.length;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent(prev => {
        if (prev >= total - 1) {
          clearInterval(timerRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, AUTO_ADVANCE_MS);
  }, [total]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const goTo = (index) => {
    setCurrent(index);
    resetTimer();
  };

  const goNext = () => {
    if (current < total - 1) goTo(current + 1);
  };

  const goPrev = () => {
    if (current > 0) goTo(current - 1);
  };

  const handleClose = () => {
    setIsExiting(true);
    sessionStorage.setItem('nxt_flyers_seen', '1');
    setTimeout(() => onComplete(), 400);
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Touch swipe
  const handleTouchStart = (e) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
    setTouchStart(null);
  };

  const isLast = current === total - 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 10, 30, 0.92)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isExiting ? 0 : 1,
        transition: 'opacity 0.4s ease',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip / Close button */}
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: 20,
          right: 24,
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff',
          padding: '8px 20px',
          borderRadius: '999px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
          zIndex: 10,
        }}
        onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.2)'; }}
        onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.12)'; }}
      >
        {isLast ? 'Go to Dashboard' : 'Skip'}
      </button>

      {/* Slide counter */}
      <div style={{
        position: 'absolute',
        top: 24,
        left: 24,
        color: 'rgba(255,255,255,0.6)',
        fontSize: '14px',
        fontWeight: 600,
      }}>
        {current + 1} / {total}
      </div>

      {/* Main slide area */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '1400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '56px 60px 0',
        flex: 1,
        minHeight: 0,
      }}>
        {/* Prev arrow */}
        {current > 0 && (
          <button
            onClick={goPrev}
            aria-label="Previous slide"
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(0,0,0,0.4)',
              color: '#fff',
              fontSize: '22px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              zIndex: 5,
            }}
            onMouseEnter={e => { e.target.style.background = 'rgba(0,0,0,0.6)'; }}
            onMouseLeave={e => { e.target.style.background = 'rgba(0,0,0,0.4)'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        )}

        {/* Slide image */}
        <div style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: '12px',
        }}>
          <img
            key={SLIDES[current].src}
            src={SLIDES[current].src}
            alt={SLIDES[current].alt}
            style={{
              width: '100%',
              maxHeight: 'calc(100vh - 100px)',
              objectFit: 'contain',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              animation: 'flyerFadeIn 0.4s ease',
            }}
          />
        </div>

        {/* Next arrow */}
        {current < total - 1 && (
          <button
            onClick={goNext}
            aria-label="Next slide"
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(0,0,0,0.4)',
              color: '#fff',
              fontSize: '22px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              zIndex: 5,
            }}
            onMouseEnter={e => { e.target.style.background = 'rgba(0,0,0,0.6)'; }}
            onMouseLeave={e => { e.target.style.background = 'rgba(0,0,0,0.4)'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        )}
      </div>

      {/* Dot indicators */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '10px 0 12px',
        alignItems: 'center',
      }}>
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            style={{
              width: i === current ? 28 : 10,
              height: 10,
              borderRadius: '999px',
              border: 'none',
              background: i === current ? '#C99A3D' : 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              padding: 0,
            }}
          />
        ))}
      </div>

      {/* Bottom action */}
      {isLast && (
        <button
          onClick={handleClose}
          style={{
            marginBottom: 24,
            padding: '14px 48px',
            borderRadius: '999px',
            border: 'none',
            background: 'linear-gradient(135deg, #C99A3D, #E8C97A)',
            color: '#00205B',
            fontSize: '16px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(201,154,61,0.4)',
            transition: 'all 0.2s',
            animation: 'flyerFadeIn 0.4s ease',
          }}
          onMouseEnter={e => { e.target.style.transform = 'scale(1.04)'; }}
          onMouseLeave={e => { e.target.style.transform = 'scale(1)'; }}
        >
          Go to Dashboard
        </button>
      )}

      {/* Progress bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: `${((current + 1) / total) * 100}%`,
        height: '3px',
        background: 'linear-gradient(90deg, #C99A3D, #E8C97A)',
        transition: 'width 0.4s ease',
      }} />

      <style>{`
        @keyframes flyerFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
