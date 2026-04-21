import type { AgentAction } from '@/lib/agents/definitions';

export function AgentActionButton({ action }: { action: AgentAction }) {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    padding: '8px 12px',
    borderRadius: 999,
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: '0.02em',
    textDecoration: 'none',
    border: '1px solid transparent',
  } as const;

  if (action.availability !== 'live' || !action.href) {
    return (
      <span
        title={action.note}
        style={{
          ...baseStyle,
          color: action.availability === 'staged' ? '#496d63' : 'var(--text-muted)',
          background: action.availability === 'staged' ? 'rgba(236, 244, 240, 0.8)' : 'rgba(255, 255, 255, 0.68)',
          borderColor: action.availability === 'staged' ? 'rgba(121, 166, 148, 0.26)' : 'rgba(200, 195, 188, 0.38)',
        }}
      >
        {action.label}
      </span>
    );
  }

  return (
    <a
      href={action.href}
      target={action.external ? '_blank' : undefined}
      rel={action.external ? 'noopener noreferrer' : undefined}
      style={{
        ...baseStyle,
        color: '#2d5c4e',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(236, 244, 240, 0.96) 100%)',
        borderColor: 'rgba(121, 166, 148, 0.34)',
        boxShadow: '0 8px 18px rgba(60, 102, 88, 0.08)',
      }}
    >
      {action.label}
    </a>
  );
}
