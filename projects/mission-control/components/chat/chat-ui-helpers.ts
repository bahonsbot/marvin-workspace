import type { CSSProperties } from 'react';

export function pillStyle({ active = false, dark = false }: { active?: boolean; dark?: boolean } = {}): CSSProperties {
  if (dark) {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '7px 11px',
      borderRadius: 999,
      border: active ? '1px solid rgba(122, 168, 149, 0.42)' : '1px solid rgba(255, 255, 255, 0.12)',
      background: active ? 'rgba(18, 52, 42, 0.88)' : 'rgba(255, 255, 255, 0.06)',
      color: active ? '#ddeadf' : 'rgba(238, 242, 239, 0.9)',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    };
  }

  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 10px',
    borderRadius: 999,
    border: active ? '1px solid rgba(121, 166, 148, 0.4)' : '1px solid rgba(200, 195, 188, 0.42)',
    background: active ? 'rgba(212, 231, 221, 0.66)' : 'rgba(255, 255, 255, 0.72)',
    color: active ? '#1a3d32' : 'var(--text-body)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };
}

export function actionButtonStyle(enabled: boolean, emphasis?: boolean): CSSProperties {
  return {
    border: emphasis ? '1px solid rgba(122, 168, 149, 0.3)' : '1px solid rgba(255, 255, 255, 0.12)',
    background: emphasis
      ? 'linear-gradient(135deg, rgba(18, 52, 42, 0.96) 0%, rgba(28, 77, 63, 0.92) 100%)'
      : 'rgba(255, 255, 255, 0.06)',
    color: emphasis ? '#f7f3ec' : enabled ? 'rgba(241, 245, 242, 0.94)' : 'rgba(202, 210, 206, 0.72)',
    borderRadius: 12,
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.72,
    boxShadow: emphasis ? '0 10px 24px rgba(0, 0, 0, 0.18)' : 'none',
    textDecoration: 'none',
  };
}

export function contextTone(percent: number | null) {
  if (percent === null) return { bar: 'rgba(255, 255, 255, 0.18)', text: 'rgba(227, 233, 229, 0.72)' };
  if (percent >= 85) return { bar: 'linear-gradient(90deg, #cc8842 0%, #b34949 100%)', text: '#f0b08e' };
  if (percent >= 65) return { bar: 'linear-gradient(90deg, #7ba796 0%, #cc8842 100%)', text: '#e0c08b' };
  return { bar: 'linear-gradient(90deg, #7ba796 0%, #3f695b 100%)', text: '#b8d7ca' };
}

export function composerIconButtonStyle(active: boolean): CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: 999,
    border: `1px solid ${active ? 'rgba(121, 166, 148, 0.34)' : 'rgba(200, 195, 188, 0.26)'}`,
    background: active ? 'rgba(121, 166, 148, 0.16)' : 'rgba(250, 248, 245, 0.92)',
    color: active ? '#163b31' : 'var(--text-muted)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: active ? 'pointer' : 'not-allowed',
    boxShadow: active ? '0 8px 18px rgba(26, 61, 50, 0.08)' : 'none',
    transition: 'all 140ms ease',
  };
}
