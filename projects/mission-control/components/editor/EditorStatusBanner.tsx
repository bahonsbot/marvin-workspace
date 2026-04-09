'use client';

type EditorStatusTone = 'neutral' | 'success' | 'warning' | 'danger';

const toneStyles: Record<EditorStatusTone, { border: string; background: string; text: string; accent: string }> = {
  neutral: {
    border: 'rgba(200, 195, 188, 0.4)',
    background: 'rgba(255, 253, 251, 0.78)',
    text: '#48514c',
    accent: '#7c7c7c',
  },
  success: {
    border: 'rgba(82, 138, 117, 0.3)',
    background: 'rgba(233, 247, 240, 0.82)',
    text: '#245544',
    accent: '#3f8a71',
  },
  warning: {
    border: 'rgba(157, 103, 55, 0.34)',
    background: 'rgba(255, 246, 236, 0.88)',
    text: '#7c4f26',
    accent: '#b06a2d',
  },
  danger: {
    border: 'rgba(168, 80, 80, 0.34)',
    background: 'rgba(255, 240, 240, 0.88)',
    text: '#7a2f2f',
    accent: '#b55656',
  },
};

export function EditorStatusBanner({
  tone,
  title,
  detail,
}: {
  tone: EditorStatusTone;
  title: string;
  detail?: string | null;
}) {
  const style = toneStyles[tone];

  return (
    <div
      style={{
        border: `1px solid ${style.border}`,
        background: style.background,
        color: style.text,
        borderRadius: 14,
        padding: '12px 14px',
        display: 'grid',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: style.accent,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
      </div>
      {detail ? <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>{detail}</div> : null}
    </div>
  );
}
