import type { AgentAction } from '@/lib/agents/definitions';

export type AgentActionButtonTone = 'control' | 'team' | 'specialist';

function tonePalette(tone: AgentActionButtonTone) {
  if (tone === 'team') {
    return {
      liveText: '#72543f',
      liveBackground: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(247, 239, 230, 0.98) 100%)',
      liveBorder: 'rgba(196, 130, 58, 0.28)',
      liveShadow: '0 8px 18px rgba(135, 104, 74, 0.08)',
      stagedText: '#7c6550',
      stagedBackground: 'rgba(247, 239, 230, 0.86)',
      stagedBorder: 'rgba(196, 130, 58, 0.2)',
      idleBackground: 'rgba(255, 255, 255, 0.7)',
      idleBorder: 'rgba(196, 130, 58, 0.16)',
    };
  }

  if (tone === 'specialist') {
    return {
      liveText: '#665284',
      liveBackground: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(242, 237, 248, 0.98) 100%)',
      liveBorder: 'rgba(127, 90, 162, 0.24)',
      liveShadow: '0 8px 18px rgba(112, 92, 144, 0.08)',
      stagedText: '#6f5d8c',
      stagedBackground: 'rgba(242, 237, 248, 0.86)',
      stagedBorder: 'rgba(127, 90, 162, 0.18)',
      idleBackground: 'rgba(255, 255, 255, 0.72)',
      idleBorder: 'rgba(127, 90, 162, 0.14)',
    };
  }

  return {
    liveText: '#2d5c4e',
    liveBackground: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(236, 244, 240, 0.96) 100%)',
    liveBorder: 'rgba(121, 166, 148, 0.34)',
    liveShadow: '0 8px 18px rgba(60, 102, 88, 0.08)',
    stagedText: '#496d63',
    stagedBackground: 'rgba(236, 244, 240, 0.8)',
    stagedBorder: 'rgba(121, 166, 148, 0.26)',
    idleBackground: 'rgba(255, 255, 255, 0.68)',
    idleBorder: 'rgba(200, 195, 188, 0.38)',
  };
}

export function AgentActionButton({ action, tone = 'control' }: { action: AgentAction; tone?: AgentActionButtonTone }) {
  const palette = tonePalette(tone);
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
          color: action.availability === 'staged' ? palette.stagedText : 'var(--text-muted)',
          background: action.availability === 'staged' ? palette.stagedBackground : palette.idleBackground,
          borderColor: action.availability === 'staged' ? palette.stagedBorder : palette.idleBorder,
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
        color: palette.liveText,
        background: palette.liveBackground,
        borderColor: palette.liveBorder,
        boxShadow: palette.liveShadow,
      }}
    >
      {action.label}
    </a>
  );
}
