import React from 'react';
import Link from 'next/link';
import { floatingPanelStyle } from '@/components/shared/floating';
import { PageScaffold } from '@/components/shared/PageScaffold';
import { BackToTopButton } from '@/components/memory/BackToTopButton';
import { getCronJobs, getCronRuns } from '@/lib/adapters/cron';

export const dynamic = 'force-dynamic';

type CronPageParams = {
  tab?: string;
};

function JobGroup({ title, count, children, defaultOpen = false }: { title: string; count: number; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen}>
      <summary style={{ listStyle: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          <span style={{ fontSize: 13 }}>▸</span>
          <span>{title} ({count})</span>
        </div>
      </summary>
      <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>{children}</div>
    </details>
  );
}

function formatRelative(at: string | null | undefined, withSeconds = false) {
  if (!at) return '—';
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' as const } : {}),
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

function cardStyle(accent = 'var(--border)') {
  return floatingPanelStyle({
    borderColor: accent,
    radius: 18,
    padding: 16,
    background: 'linear-gradient(180deg, rgba(255, 253, 251, 0.9) 0%, rgba(247, 241, 235, 0.78) 100%)',
  });
}

type Job = {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  type?: 'runner-backed' | 'mixed' | 'model-backed';
  executionPath?: 'host-deterministic' | 'openclaw-cron' | 'mixed';
  sourceLabel?: string | null;
  sourceNote?: string | null;
  model?: string | null;
  timeoutSeconds?: number | null;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  let bg = 'rgba(200, 195, 188, 0.18)';
  let text = '#7a7a7a';
  let label = 'unknown';

  if (status === 'ok' || status === 'success') {
    bg = 'rgba(121, 166, 148, 0.16)';
    text = '#3c6658';
    label = 'success';
  } else if (status === 'warn') {
    bg = 'rgba(196, 130, 58, 0.14)';
    text = '#c4823a';
    label = 'warning';
  } else if (status === 'error' || status === 'failed') {
    bg = 'rgba(248, 113, 113, 0.18)';
    text = '#f87171';
    label = 'failed';
  } else if (status === 'running') {
    bg = 'rgba(212, 231, 221, 0.9)';
    text = '#3c6658';
    label = 'running';
  } else if (status === 'skipped') {
    bg = 'rgba(235, 230, 224, 0.86)';
    text = '#7a7a7a';
    label = 'skipped';
  }

  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        background: bg,
        color: text,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  );
}

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        background: enabled ? 'rgba(121, 166, 148, 0.14)' : 'rgba(248, 113, 113, 0.14)',
        color: enabled ? '#3c6658' : '#f87171',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
      }}
    >
      {enabled ? 'enabled' : 'disabled'}
    </span>
  );
}

function TypeBadge({ type }: { type?: string }) {
  let bg = 'rgba(200, 195, 188, 0.14)';
  let text = '#7a7a7a';
  let label = type || 'unknown';

  if (type === 'runner-backed') {
    bg = 'rgba(212, 231, 221, 0.9)';
    text = '#3c6658';
    label = 'runner';
  } else if (type === 'model-backed') {
    bg = 'rgba(255, 255, 255, 0.6)';
    text = '#7a7a7a';
    label = 'model';
  } else if (type === 'mixed') {
    bg = 'rgba(196, 130, 58, 0.12)';
    text = '#c4823a';
    label = 'mixed';
  }

  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        background: bg,
        color: text,
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  );
}

function SourceBadge({ executionPath, sourceLabel }: { executionPath?: Job['executionPath']; sourceLabel?: string | null }) {
  let bg = 'rgba(200, 195, 188, 0.12)';
  let text = '#7a7a7a';
  const label = sourceLabel ?? 'Unknown source';

  if (executionPath === 'host-deterministic') {
    bg = 'rgba(121, 166, 148, 0.14)';
    text = '#3c6658';
  } else if (executionPath === 'openclaw-cron') {
    bg = 'rgba(212, 231, 221, 0.9)';
    text = '#3c6658';
  } else if (executionPath === 'mixed') {
    bg = 'rgba(196, 130, 58, 0.12)';
    text = '#c4823a';
  }

  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        background: bg,
        color: text,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

function JobCard({ job }: { job: Job }) {
  return (
    <div style={{ ...cardStyle(), display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35, wordBreak: 'break-word', color: 'var(--text-body)' }}>{job.name}</div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <EnabledBadge enabled={job.enabled} />
          {job.type && <TypeBadge type={job.type} />}
          <SourceBadge executionPath={job.executionPath} sourceLabel={job.sourceLabel} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: 10, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Schedule</div>
          <div style={{ fontSize: 12, fontFamily: 'monospace' }}>{job.schedule}</div>
        </div>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: 10, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Next run</div>
          <div style={{ fontSize: 12 }}>{formatRelative(job.nextRunAt)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: 10, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Last run</div>
          <div style={{ fontSize: 12 }}>{formatRelative(job.lastRunAt)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: 10, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Status</div>
          <StatusBadge status={job.lastRunStatus} />
        </div>
      </div>
      {job.model && (
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          Model: <span style={{ fontFamily: 'monospace' }}>{job.model}</span>
          {job.timeoutSeconds && <span> · {job.timeoutSeconds}s timeout</span>}
        </div>
      )}
    </div>
  );
}

function RunRow({ run }: { run: { id: string; jobId: string; state: string; startedAt: string; finishedAt?: string | null; durationMs?: number | null; clusterCount?: number; windowStartAt?: string | null; windowEndAt?: string | null; notes?: string[] } }) {
  const statusColor = run.state === 'success' ? '#3c6658' : run.state === 'failed' ? '#f87171' : '#c4823a';
  const isCluster = (run.clusterCount ?? 1) > 1;
  const windowLabel = isCluster
    ? `${formatRelative(run.windowStartAt ?? run.startedAt, true)} → ${formatRelative(run.windowEndAt ?? run.startedAt, true)}`
    : formatRelative(run.startedAt, true);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: 'var(--text-body)' }}>
          <span>{run.jobId}</span>
          {isCluster && (
            <span style={{ fontSize: 11, color: '#c4823a', background: 'rgba(196, 130, 58, 0.12)', padding: '2px 6px', borderRadius: 999 }}>
              {run.clusterCount} runs clustered
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{windowLabel}</div>
        {isCluster && run.notes && run.notes.length > 0 && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{run.notes.join(' · ')}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
        <span style={{ fontSize: 12, color: statusColor, textTransform: 'capitalize' }}>{run.state}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', minWidth: 60, textAlign: 'right' }}>
        {run.durationMs ? `${Math.round(run.durationMs / 1000)}s` : '—'}
      </div>
    </div>
  );
}

export default async function CronPage({ searchParams }: { searchParams?: CronPageParams }) {
  const [jobs, runs] = await Promise.all([getCronJobs(), getCronRuns()]);
  const activeTab = searchParams?.tab === 'runs' ? 'runs' : 'jobs';

  const runnerJobs = jobs.jobs.filter((j) => j.type === 'runner-backed');
  const mixedJobs = jobs.jobs.filter((j) => j.type === 'mixed');
  const modelJobs = jobs.jobs.filter((j) => j.type === 'model-backed' || !j.type);

  return (
    <div id="page-top">
      <PageScaffold
        title="Crons"
        titleVariant="system"
        hideHeader
      >
        <div style={{ display: 'grid', gap: 20 }}>
          <div className="floating-pill-row">
            {[
              { key: 'jobs', label: `Jobs (${jobs.jobs.length})` },
              { key: 'runs', label: `Recent runs (${runs.runs.length})` },
            ].map((tab) => {
              const active = activeTab === tab.key;
              return (
                <Link
                  key={tab.key}
                  href={tab.key === 'jobs' ? '/general/crons' : '/general/crons?tab=runs'}
                  className={`floating-pill${active ? ' floating-pill-active' : ''}`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          {activeTab === 'jobs' ? (
            <section>
              {jobs.jobs.length === 0 ? (
                <div style={{ ...cardStyle(), color: 'var(--muted)', textAlign: 'center', padding: 24 }}>
                  No cron jobs visible from the current adapter path.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {runnerJobs.length > 0 && (
                    <JobGroup title="Runner-backed" count={runnerJobs.length}>
                      {runnerJobs.map((job) => (
                        <JobCard key={job.id} job={job} />
                      ))}
                    </JobGroup>
                  )}
                  {mixedJobs.length > 0 && (
                    <JobGroup title="Mixed" count={mixedJobs.length}>
                      {mixedJobs.map((job) => (
                        <JobCard key={job.id} job={job} />
                      ))}
                    </JobGroup>
                  )}
                  {modelJobs.length > 0 && (
                    <JobGroup title="Model-backed" count={modelJobs.length}>
                      {modelJobs.map((job) => (
                        <JobCard key={job.id} job={job} />
                      ))}
                    </JobGroup>
                  )}
                </div>
              )}
            </section>
          ) : (
            <section>
              {runs.runs.length === 0 ? (
                <div style={{ ...cardStyle(), color: 'var(--muted)', textAlign: 'center', padding: 24 }}>
                  No recent runs in cron-run-log.jsonl.
                </div>
              ) : (
                <div style={{ ...cardStyle(), padding: '10px 18px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Job</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>State</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Duration</div>
                  </div>
                  {runs.runs.slice(0, 30).map((run) => (
                    <RunRow key={run.id} run={run} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
        <BackToTopButton />
      </PageScaffold>
    </div>
  );
}
