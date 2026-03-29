import type { ReactNode, CSSProperties } from 'react';
import { floatingPanelStyle } from '@/components/shared/floating';

export function PageScaffold({
  title,
  description,
  children,
  titleVariant = 'default',
  descriptionVariant = 'default',
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  titleVariant?: 'default' | 'editorial' | 'system';
  descriptionVariant?: 'default' | 'quote';
}) {
  const editorial = titleVariant === 'editorial';
  const system = titleVariant === 'system';
  const quoteDescription = descriptionVariant === 'quote';
  const titleStyle: CSSProperties = editorial
    ? {
        margin: 0,
        fontSize: 28,
        lineHeight: 1.12,
        letterSpacing: -0.4,
        fontFamily: 'var(--font-sans, "Avenir Next", "Segoe UI", sans-serif)',
        fontWeight: 600,
      }
    : system
      ? {
          margin: 0,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--accent-mid)',
          textAlign: 'center',
        }
      : {
          margin: 0,
          fontSize: 30,
          letterSpacing: -0.4,
        };

  const underlineStyle: CSSProperties = system
    ? {
        width: 'min(240px, 56vw)',
        height: 1,
        marginTop: 14,
        marginBottom: 0,
        borderRadius: 999,
        background: 'linear-gradient(90deg, rgba(121, 166, 148, 0) 0%, rgba(121, 166, 148, 0.36) 12%, rgba(121, 166, 148, 0.64) 50%, rgba(121, 166, 148, 0.36) 88%, rgba(121, 166, 148, 0) 100%)',
        opacity: 0.95,
        justifySelf: 'center',
      }
    : {};

  return (
    <section style={{ display: 'grid', gap: editorial ? 28 : system ? 26 : 18 }}>
      <header
        style={{
          display: 'grid',
          gap: editorial ? 18 : system ? 14 : 10,
          paddingTop: editorial ? 18 : system ? 22 : 0,
          paddingBottom: editorial ? 14 : system ? 24 : 0,
          justifyItems: editorial || system ? 'center' : 'start',
          textAlign: editorial || system ? 'center' : 'left',
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: editorial ? 14 : system ? 10 : 8,
            maxWidth: editorial ? 760 : system ? 980 : 860,
            width: '100%',
            justifyItems: editorial || system ? 'center' : 'start',
          }}
        >
          <h1 style={titleStyle}>{title}</h1>
          {system ? (
            <div aria-hidden="true" style={underlineStyle} />
          ) : quoteDescription ? (
            <div
              aria-hidden="true"
              style={{
                width: 'min(300px, 64vw)',
                maxWidth: 300,
                height: 1,
                marginTop: 10,
                marginBottom: 10,
                borderRadius: 999,
                background: 'linear-gradient(90deg, rgba(121, 166, 148, 0) 0%, rgba(121, 166, 148, 0.42) 16%, rgba(121, 166, 148, 0.62) 50%, rgba(121, 166, 148, 0.42) 84%, rgba(121, 166, 148, 0) 100%)',
                opacity: 0.95,
              }}
            />
          ) : description ? (
            <p
              style={{
                margin: 0,
                color: 'var(--muted)',
                fontSize: editorial ? 16 : 15,
                lineHeight: 1.7,
                maxWidth: editorial ? 720 : 860,
                fontStyle: 'normal',
              }}
            >
              {description}
            </p>
          ) : null}
        </div>
      </header>
      <div
        className="page-scaffold-panel"
        style={{
          ...floatingPanelStyle({ padding: system ? 22 : 20 }),
        }}
      >
        {children}
      </div>
    </section>
  );
}
