import type { HomeWorkspaceHealthSummary } from '@/lib/types/contracts';

type WorkspaceHealthWidgetProps = {
  summary: HomeWorkspaceHealthSummary;
  formatRelative: (value: string) => string;
};

function renderValue(value: string | number | null) {
  if (value === null || value === '') return '—';
  return value;
}

export function WorkspaceHealthWidget({ summary, formatRelative }: WorkspaceHealthWidgetProps) {
  return (
    <article className="general-home-widget-card" aria-label="Workspace health">
      <div className="general-home-widget-header">
        <h3 className="general-home-widget-title">Workspace health</h3>
      </div>

      <div className="general-home-health-metrics">
        <div className="general-home-health-metric">
          <span className="general-home-health-label">QMD collections</span>
          <span className="general-home-health-value">{renderValue(summary.qmdCollections)}</span>
        </div>
        <div className="general-home-health-metric">
          <span className="general-home-health-label">Last cron run</span>
          <span className="general-home-health-value">
            {summary.lastCronRunAt ? formatRelative(summary.lastCronRunAt) : 'Unavailable'}
          </span>
        </div>
        <div className="general-home-health-metric">
          <span className="general-home-health-label">Last autonomous task</span>
          <span className="general-home-health-value">
            {summary.lastAutonomousTaskAt ? formatRelative(summary.lastAutonomousTaskAt) : 'Unavailable'}
          </span>
        </div>
      </div>
    </article>
  );
}
