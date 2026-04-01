'use client';

import { useEffect, useState } from 'react';

export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 520);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <a
      href="#page-top"
      onClick={(event) => {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      style={{
        position: 'fixed',
        right: 54,
        bottom: 44,
        zIndex: 20,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 999,
        border: '1px solid rgba(94, 234, 212, 0.28)',
        background: 'rgba(11, 20, 28, 0.88)',
        color: '#5eead4',
        boxShadow: '0 18px 40px rgba(0, 0, 0, 0.28)',
        backdropFilter: 'blur(12px)',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      <span style={{ fontSize: 13 }}>↑</span>
      <span>Back to top</span>
    </a>
  );
}
