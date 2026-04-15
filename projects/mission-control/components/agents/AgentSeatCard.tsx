import Image from 'next/image';
import { floatingInsetStyle } from '@/components/shared/floating';
import { AgentActionButton } from '@/components/agents/AgentActionButton';
import { AgentIssueStateButton } from '@/components/agents/AgentIssueStateButton';
import type { AgentAlert, AgentAlertSeverity, AgentHealthStatus, AgentUnitPayload } from '@/lib/agents/definitions';

function statePalette(status: AgentHealthStatus) {
  if (status === 'active') return { bg: 'rgba(104, 242, 166, 0.22)', border: 'rgba(74, 224, 145, 0.4)', text: '#23b26b' };
  if (status === 'ready') return { bg: 'rgba(122, 248, 177, 0.2)', border: 'rgba(92, 229, 157, 0.38)', text: '#29bb72' };
  if (status === 'quiet') return { bg: 'rgba(122, 248, 177, 0.2)', border: 'rgba(92, 229, 157, 0.38)', text: '#29bb72' };
  if (status === 'attention') return { bg: 'rgba(127, 134, 138, 0.1)', border: 'rgba(127, 134, 138, 0.22)', text: '#586167' };
  return { bg: 'rgba(91, 124, 116, 0.09)', border: 'rgba(91, 124, 116, 0.16)', text: '#47655c' };
}

function alertPalette(severity: AgentAlertSeverity) {
  if (severity === 'attention') {
    return { bg: 'rgba(153, 111, 78, 0.12)', border: 'rgba(153, 111, 78, 0.24)', text: '#7a5230' };
  }

  return { bg: 'rgba(94, 128, 111, 0.11)', border: 'rgba(94, 128, 111, 0.22)', text: '#365347' };
}

const AVATAR_FILE_BY_LABEL: Record<string, string> = {
  Marvin: 'Marvin.png',
  Sudo: 'Sudo.png',
  Vantage: 'Vantage.png',
  Johan: 'Johan.png',
  Milou: 'Milou.png',
  Japin: 'Japin.png',
  Link: 'Link.png',
};

function initials(label: string) {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function avatarGradient(item: AgentUnitPayload) {
  if (item.kind === 'control') return 'linear-gradient(135deg, #0d2d24 0%, #2c5a4b 100%)';
  if (item.kind === 'team') return 'linear-gradient(135deg, rgba(19, 49, 40, 0.96) 0%, rgba(88, 125, 111, 0.88) 100%)';
  return 'linear-gradient(135deg, rgba(76, 104, 95, 0.9) 0%, rgba(191, 168, 131, 0.86) 100%)';
}

function AgentAvatarImage({ item, size }: { item: AgentUnitPayload; size: number }) {
  const file = AVATAR_FILE_BY_LABEL[item.label];
  if (!file) return null;

  return (
    <Image
      src={`/api/files/raw?path=${encodeURIComponent(`uploads/mission-control/avatars/${file}`)}`}
      alt={`${item.label} avatar`}
      width={size}
      height={size}
      unoptimized
      style={{
        width: size,
        height: size,
        borderRadius: item.kind === 'control' ? 28 : 26,
        objectFit: 'cover',
        border: '1px solid rgba(18, 31, 25, 0.12)',
        boxShadow: '0 16px 34px rgba(19, 31, 27, 0.12)',
        background: '#ede7dc',
      }}
    />
  );
}

function SingleAvatar({ item }: { item: AgentUnitPayload }) {
  const size = item.kind === 'control' ? 88 : 84;
  const avatarImage = <AgentAvatarImage item={item} size={size} />;
  if (avatarImage) return avatarImage;

  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: item.kind === 'control' ? 28 : 26,
        background: avatarGradient(item),
        border: '1px solid rgba(18, 31, 25, 0.12)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 16px 34px rgba(19, 31, 27, 0.12)',
        display: 'grid',
        placeItems: 'center',
        color: '#fffaf2',
        fontSize: item.kind === 'control' ? 24 : 22,
        fontWeight: 700,
        letterSpacing: '-0.05em',
      }}
    >
      {initials(item.label)}
    </div>
  );
}

function TeamAvatar({ item }: { item: AgentUnitPayload }) {
  const avatarImage = <AgentAvatarImage item={item} size={92} />;
  if (avatarImage) return avatarImage;

  return (
    <div
      aria-hidden="true"
      style={{
        width: 92,
        height: 92,
        borderRadius: 28,
        background: avatarGradient(item),
        border: '1px solid rgba(18, 31, 25, 0.12)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 16px 34px rgba(19, 31, 27, 0.12)',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8,
        padding: 12,
      }}
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          style={{
            borderRadius: 16,
            background: index === 0 ? 'rgba(255, 250, 242, 0.94)' : 'rgba(255, 250, 242, 0.3)',
            border: '1px solid rgba(255,255,255,0.18)',
            boxShadow: index === 0 ? '0 4px 12px rgba(13, 27, 21, 0.12)' : 'none',
          }}
        />
      ))}
    </div>
  );
}

function AvatarBlock({ item }: { item: AgentUnitPayload }) {
  if (item.kind === 'team') return <TeamAvatar item={item} />;
  return <SingleAvatar item={item} />;
}

function visibleActions(actions: AgentUnitPayload['actions']) {
  return actions.filter((action) => action.availability === 'live' && action.href);
}

function ActionCluster({ actions }: { actions: AgentUnitPayload['actions'] }) {
  const liveActions = visibleActions(actions);
  if (liveActions.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {liveActions.map((action) => (
        <AgentActionButton key={action.id} action={action} />
      ))}
    </div>
  );
}

function AlertActions({ actions }: { actions: AgentAlert['actions'] }) {
  if (actions.length === 0) return null;
  const [primary, ...secondary] = actions;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b756e' }}>Next step</span>
        <AgentActionButton action={primary} />
      </div>
      {secondary.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {secondary.map((action) => (
            <AgentActionButton key={action.id} action={action} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AlertCard({ alert, showUnitLabel = false }: { alert: AgentUnitPayload['alerts'][number]; showUnitLabel?: boolean }) {
  const severity = alertPalette(alert.severity);
  const isAcknowledged = alert.state === 'acknowledged';

  return (
    <div
      style={{
        ...floatingInsetStyle({
          padding: '12px 14px',
          radius: 16,
          background: isAcknowledged ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.62)',
        }),
        display: 'grid',
        gap: 8,
        opacity: isAcknowledged ? 0.78 : 1,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span
          style={{
            display: 'inline-flex',
            padding: '4px 8px',
            borderRadius: 999,
            background: severity.bg,
            border: `1px solid ${severity.border}`,
            color: severity.text,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {alert.severity}
        </span>
        <span
          style={{
            display: 'inline-flex',
            padding: '4px 8px',
            borderRadius: 999,
            background: isAcknowledged ? 'rgba(101, 112, 106, 0.1)' : 'rgba(17, 51, 40, 0.08)',
            border: `1px solid ${isAcknowledged ? 'rgba(101, 112, 106, 0.16)' : 'rgba(17, 51, 40, 0.12)'}`,
            color: isAcknowledged ? '#5a655f' : '#234236',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {alert.state === 'active' ? 'active' : 'acknowledged'}
        </span>
        {showUnitLabel ? <strong style={{ fontSize: 13, color: '#183328' }}>{alert.unitLabel}</strong> : null}
        <span style={{ fontSize: 13, color: '#183328', fontWeight: 700 }}>{alert.title}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{alert.detail}</div>
      {alert.acknowledgedAt ? (
        <div style={{ fontSize: 11, color: '#65706a' }}>
          Seen {new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(alert.acknowledgedAt))}
        </div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'start', justifyContent: 'space-between' }}>
        <div style={{ flex: '1 1 220px' }}>
          <AlertActions actions={alert.actions} />
        </div>
        <AgentIssueStateButton alert={alert} />
      </div>
    </div>
  );
}

export function AgentSeatCard({ item }: { item: AgentUnitPayload }) {
  const palette = statePalette(item.health.status);
  const showAlertBlock = item.kind !== 'control' && item.alerts.length > 0;
  const visibleAlerts = item.kind === 'control' ? item.alerts.slice(0, 4) : item.alerts;
  const oversight = item.oversight;
  const activeIssueCount = item.alerts.filter((alert) => alert.state === 'active').length;
  const acknowledgedIssueCount = item.alerts.filter((alert) => alert.state === 'acknowledged').length;
  const controlLeftColumn = (
    <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
          <AvatarBlock item={item} />
          <div
            title={item.health.label}
            aria-label={`Status: ${item.health.label}`}
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: palette.text,
              boxShadow: `0 0 0 4px ${palette.bg}`,
              marginTop: 8,
              flex: '0 0 auto',
            }}
          />
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                width: 'fit-content',
                padding: '5px 10px',
                borderRadius: 999,
                background: palette.bg,
                border: `1px solid ${palette.border}`,
                color: palette.text,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {item.role}
            </span>
            {activeIssueCount > 0 ? (
              <span
                style={{
                  display: 'inline-flex',
                  width: 'fit-content',
                  padding: '5px 10px',
                  borderRadius: 999,
                  background: 'rgba(153, 111, 78, 0.12)',
                  border: '1px solid rgba(153, 111, 78, 0.2)',
                  color: '#7a5230',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                {activeIssueCount} active
              </span>
            ) : null}
            {acknowledgedIssueCount > 0 ? (
              <span
                style={{
                  display: 'inline-flex',
                  width: 'fit-content',
                  padding: '5px 10px',
                  borderRadius: 999,
                  background: 'rgba(101, 112, 106, 0.08)',
                  border: '1px solid rgba(101, 112, 106, 0.16)',
                  color: '#5a655f',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                {acknowledgedIssueCount} seen
              </span>
            ) : null}
          </div>
          <h2 style={{ margin: 0, fontSize: item.kind === 'control' ? 28 : 25, lineHeight: 1.08, letterSpacing: -0.4, color: '#102b22' }}>{item.label}</h2>
          <p style={{ margin: 0, maxWidth: 560, fontSize: 13, lineHeight: 1.6, color: '#51605a' }}>
            {item.kind === 'control'
              ? 'King of all lobsters and Philippe’s dedicated right-hand. Orchestrates, reviews, and monitors continuity across all levels.'
              : item.summary}
          </p>
          {item.arsenal.length > 0 ? <div style={{ fontSize: 11.5, lineHeight: 1.55, color: '#68736d', marginTop: 2 }}>{item.arsenal.join(' · ')}</div> : null}
        </div>
      </div>

      <div style={{ minHeight: 30 }} />

      <div style={{ marginTop: 'auto' }}>
        <ActionCluster actions={item.actions} />
      </div>
    </div>
  );

  return (
    <article
      style={{
        border: `1px solid ${palette.border}`,
        borderRadius: item.kind === 'control' ? 32 : 30,
        padding: item.kind === 'control' ? 22 : 20,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(247, 242, 233, 0.92) 100%)',
        boxShadow: '0 18px 42px rgba(25, 31, 28, 0.06)',
        display: 'grid',
        gap: 18,
        alignContent: 'start',
        minHeight: item.kind === 'control' ? 0 : 468,
      }}
    >
      {item.kind === 'control' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(280px, 0.92fr)', gap: 18, alignItems: 'start' }}>
          {controlLeftColumn}
          <aside
            style={{
              ...floatingInsetStyle({ padding: '12px 12px 13px', radius: 20, background: 'rgba(255,255,255,0.64)' }),
              display: 'grid',
              gap: 10,
              alignContent: 'start',
              alignSelf: 'start',
              justifySelf: 'end',
              width: '100%',
              maxWidth: 336,
            }}
          >
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#47655c' }}>Oversight</div>
                <span style={{ fontSize: 10.5, color: '#5d675f' }}>
                  {oversight && oversight.activeIssues > 0 ? 'Active issues in view' : oversight && oversight.acknowledgedIssues > 0 ? 'Seen issues retained' : 'All clear'}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ ...floatingInsetStyle({ padding: '9px 10px', radius: 14, background: 'rgba(255,255,255,0.72)' }), display: 'grid', gap: 2, minWidth: 90 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b756e' }}>Active</span>
                  <strong style={{ fontSize: 18, color: '#183328', lineHeight: 1 }}>{oversight?.activeIssues ?? activeIssueCount}</strong>
                </div>
                <div style={{ ...floatingInsetStyle({ padding: '9px 10px', radius: 14, background: 'rgba(255,255,255,0.72)' }), display: 'grid', gap: 2, minWidth: 90 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b756e' }}>Seen</span>
                  <strong style={{ fontSize: 18, color: '#183328', lineHeight: 1 }}>{oversight?.acknowledgedIssues ?? acknowledgedIssueCount}</strong>
                </div>
                <div style={{ ...floatingInsetStyle({ padding: '9px 10px', radius: 14, background: 'rgba(255,255,255,0.72)' }), display: 'grid', gap: 2, minWidth: 104, flex: '1 1 104px' }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b756e' }}>Seats</span>
                  <strong style={{ fontSize: 18, color: '#183328', lineHeight: 1 }}>{oversight?.seatsNeedingAttention ?? 0}</strong>
                </div>
              </div>
            </div>

            {visibleAlerts.length > 0 ? (
              <div style={{ display: 'grid', gap: 7 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#47655c' }}>Issue flow</div>
                <div style={{ display: 'grid', gap: 7 }}>
                  {visibleAlerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} showUnitLabel />
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
              <AvatarBlock item={item} />
              <div
                title={item.health.label}
                aria-label={`Status: ${item.health.label}`}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: palette.text,
                  boxShadow: `0 0 0 4px ${palette.bg}`,
                  marginTop: 8,
                  flex: '0 0 auto',
                }}
              />
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    width: 'fit-content',
                    padding: '5px 10px',
                    borderRadius: 999,
                    background: palette.bg,
                    border: `1px solid ${palette.border}`,
                    color: palette.text,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {item.role}
                </span>
                {activeIssueCount > 0 ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      width: 'fit-content',
                      padding: '5px 10px',
                      borderRadius: 999,
                      background: 'rgba(153, 111, 78, 0.12)',
                      border: '1px solid rgba(153, 111, 78, 0.2)',
                      color: '#7a5230',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {activeIssueCount} active
                  </span>
                ) : null}
                {acknowledgedIssueCount > 0 ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      width: 'fit-content',
                      padding: '5px 10px',
                      borderRadius: 999,
                      background: 'rgba(101, 112, 106, 0.08)',
                      border: '1px solid rgba(101, 112, 106, 0.16)',
                      color: '#5a655f',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {acknowledgedIssueCount} seen
                  </span>
                ) : null}
              </div>
              <h2 style={{ margin: 0, fontSize: 25, lineHeight: 1.08, letterSpacing: -0.4, color: '#102b22' }}>{item.label}</h2>
              <p style={{ margin: 0, maxWidth: 560, fontSize: 13, lineHeight: 1.6, color: '#51605a' }}>{item.summary}</p>
              {item.arsenal.length > 0 ? <div style={{ fontSize: 11.5, lineHeight: 1.55, color: '#68736d' }}>{item.arsenal.join(' · ')}</div> : null}
            </div>
          </div>

          <div style={{ minHeight: 30 }} />

          {item.members.length > 0 ? (
            <details
              style={{
                border: '1px solid rgba(200, 195, 188, 0.26)',
                borderRadius: 18,
                background: 'rgba(255,255,255,0.38)',
                overflow: 'hidden',
              }}
            >
              <summary
                style={{
                  listStyle: 'none',
                  cursor: 'pointer',
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#47655c' }}>
                  Seats
                </span>
                <span aria-hidden="true" style={{ fontSize: 14, color: '#5d675f', lineHeight: 1 }}>▾</span>
              </summary>
              <div style={{ display: 'grid', gap: 10, padding: '0 14px 14px' }}>
                {item.members.map((member) => {
                  const memberPalette = statePalette(member.status);
                  return (
                    <div
                      key={member.id}
                      style={{
                        ...floatingInsetStyle({ padding: '12px 14px', radius: 16, background: 'rgba(255,255,255,0.66)' }),
                        display: 'grid',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <strong style={{ fontSize: 14, color: '#183328' }}>{member.label}</strong>
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '4px 8px',
                            borderRadius: 999,
                            background: memberPalette.bg,
                            border: `1px solid ${memberPalette.border}`,
                            color: memberPalette.text,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {member.role}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          ) : null}

          {showAlertBlock ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#47655c' }}>Issues</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {visibleAlerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 'auto' }}>
            <ActionCluster actions={item.actions} />
          </div>
        </>
      )}
    </article>
  );
}
