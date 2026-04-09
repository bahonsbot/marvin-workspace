import { AgentActionButton } from '@/components/agents/AgentActionButton';
import { floatingInsetStyle } from '@/components/shared/floating';
import type { AgentAlert, AgentsPageData } from '@/lib/agents/definitions';

function severityPalette(severity: AgentAlert['severity']) {
  if (severity === 'attention') {
    return { bg: 'rgba(153, 111, 78, 0.12)', border: 'rgba(153, 111, 78, 0.24)', text: '#7a5230' };
  }

  return { bg: 'rgba(94, 128, 111, 0.11)', border: 'rgba(94, 128, 111, 0.22)', text: '#365347' };
}

export function AgentAlertStrip({ summary, alerts }: Pick<AgentsPageData, 'summary' | 'alerts'>) {
  const visibleAlerts = alerts.slice(0, 3);

  return (
    <section
      style={{
        ...floatingInsetStyle({ padding: '18px 20px', radius: 24, background: 'rgba(255,255,255,0.76)' }),
        display: 'grid',
        gap: 16,
      }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              padding: '6px 10px',
              borderRadius: 999,
              background: 'rgba(16, 43, 34, 0.08)',
              border: '1px solid rgba(16, 43, 34, 0.12)',
              color: '#173128',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Oversight
          </span>
          <span style={{ fontSize: 13, color: '#365347' }}>
            {summary.activeIssues > 0
              ? `Marvin is tracking ${summary.activeIssues} live issue${summary.activeIssues === 1 ? '' : 's'}.`
              : 'Roster is calm. No active issues need intervention right now.'}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, color: '#173128' }}>
          <strong style={{ fontSize: 18, letterSpacing: -0.2 }}>{summary.activeIssues}</strong>
          <span style={{ fontSize: 13, color: '#5a6d64' }}>active issue{summary.activeIssues === 1 ? '' : 's'}</span>
          <strong style={{ fontSize: 18, letterSpacing: -0.2 }}>{summary.seatsNeedingAttention}</strong>
          <span style={{ fontSize: 13, color: '#5a6d64' }}>seat{summary.seatsNeedingAttention === 1 ? '' : 's'} need attention</span>
        </div>
      </div>

      {visibleAlerts.length > 0 ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {visibleAlerts.map((alert) => {
            const palette = severityPalette(alert.severity);
            return (
              <div
                key={alert.id}
                style={{
                  ...floatingInsetStyle({ padding: '14px 16px', radius: 18, background: 'rgba(255,255,255,0.68)' }),
                  display: 'grid',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      padding: '4px 8px',
                      borderRadius: 999,
                      background: palette.bg,
                      border: `1px solid ${palette.border}`,
                      color: palette.text,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {alert.severity}
                  </span>
                  <strong style={{ fontSize: 14, color: '#173128' }}>{alert.unitLabel}</strong>
                  <span style={{ fontSize: 13, color: '#173128' }}>{alert.title}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{alert.detail}</div>
                {alert.actions.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {alert.actions.map((action) => (
                      <AgentActionButton key={action.id} action={action} />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
