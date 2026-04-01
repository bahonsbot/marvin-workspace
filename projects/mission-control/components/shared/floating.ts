import type { CSSProperties } from 'react';

type SurfaceOptions = {
  borderColor?: string;
  background?: string;
  radius?: number;
  padding?: number | string;
  shadow?: string;
};

export function floatingPanelStyle(options: SurfaceOptions = {}): CSSProperties {
  return {
    border: `1px solid ${options.borderColor ?? 'var(--border)'}`,
    borderRadius: options.radius ?? 22,
    padding: options.padding ?? 16,
    background: options.background ?? 'rgba(255, 255, 255, 0.74)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: options.shadow ?? 'var(--shadow-card)',
  };
}

export function floatingInsetStyle(options: SurfaceOptions = {}): CSSProperties {
  return {
    border: `1px solid ${options.borderColor ?? 'var(--border)'}`,
    borderRadius: options.radius ?? 16,
    padding: options.padding ?? 12,
    background: options.background ?? 'rgba(255, 255, 255, 0.58)',
  };
}
