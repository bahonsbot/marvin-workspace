import type { AgentAction } from '@/lib/agents/definitions';

export function AgentActionButton({ action }: { action: AgentAction }) {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    padding: '9px 12px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.01em',
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
          background: action.availability === 'staged' ? 'rgba(121, 166, 148, 0.1)' : 'rgba(255, 255, 255, 0.55)',
          borderColor: action.availability === 'staged' ? 'rgba(121, 166, 148, 0.2)' : 'rgba(200, 195, 188, 0.38)',
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
        color: '#fffdf9',
        background: 'linear-gradient(135deg, #113328 0%, #2d5c4e 100%)',
        borderColor: 'rgba(15, 31, 25, 0.3)',
        boxShadow: '0 10px 24px rgba(16, 38, 31, 0.14)',
      }}
    >
      {action.label}
    </a>
  );
}
