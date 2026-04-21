import { AgentSeatCard } from '@/components/agents/AgentSeatCard';
import type { AgentSectionPayload } from '@/lib/agents/definitions';

const RAIL_LAYOUT: Record<AgentSectionPayload['id'], { visibleCount: number; minWidth: number; peek: number }> = {
  control: { visibleCount: 1, minWidth: 0, peek: 0 },
  teams: { visibleCount: 2, minWidth: 420, peek: 54 },
  specialists: { visibleCount: 3, minWidth: 280, peek: 54 },
};

export function AgentSection({ section }: { section: AgentSectionPayload }) {
  const isControl = section.id === 'control';
  const showHeading = !isControl;
  const rail = RAIL_LAYOUT[section.id];

  return (
    <section style={{ display: 'grid', gap: showHeading ? 16 : 0 }}>
      {showHeading ? (
        <div style={{ display: 'grid', gap: 4 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 650,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--accent-mid)',
            }}
          >
            {section.title}
          </h2>
        </div>
      ) : null}

      <div style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            gap: 18,
            overflowX: isControl ? 'visible' : 'auto',
            paddingBottom: 8,
            paddingRight: showHeading ? rail.peek : 0,
            scrollSnapType: isControl ? 'none' : 'x proximity',
            scrollbarWidth: 'thin',
          }}
        >
          {section.items.map((item) => {
            const basis = isControl
              ? `max(${RAIL_LAYOUT.teams.minWidth}px, calc((100% - ${RAIL_LAYOUT.teams.peek}px - ${(RAIL_LAYOUT.teams.visibleCount - 1) * 18}px) / ${RAIL_LAYOUT.teams.visibleCount}))`
              : `max(${rail.minWidth}px, calc((100% - ${rail.peek}px - ${(rail.visibleCount - 1) * 18}px) / ${rail.visibleCount}))`;

            return (
              <div
                key={item.id}
                style={{
                  flex: `0 0 ${basis}`,
                  minWidth: isControl ? 0 : rail.minWidth,
                  maxWidth: isControl ? basis : undefined,
                  scrollSnapAlign: isControl ? 'none' : 'start',
                }}
              >
                <AgentSeatCard item={item} />
              </div>
            );
          })}
        </div>

        {showHeading ? (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 72,
              height: '100%',
              pointerEvents: 'none',
              background: 'linear-gradient(90deg, rgba(247, 242, 233, 0) 0%, rgba(247, 242, 233, 0.58) 42%, rgba(247, 242, 233, 0.96) 100%)',
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
