'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { AgentAlert } from '@/lib/agents/definitions';

export function AgentIssueStateButton({ alert }: { alert: AgentAlert }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nextState = alert.state === 'active' ? 'acknowledged' : 'active';

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(() => {
            void (async () => {
              try {
                const response = await fetch(`/api/agents/issues/${encodeURIComponent(alert.id)}`, {
                  method: 'PATCH',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ state: nextState }),
                });

                if (!response.ok) {
                  throw new Error('REQUEST_FAILED');
                }

                router.refresh();
              } catch {
                setError('Could not update issue state.');
              }
            })();
          });
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 36,
          padding: '8px 11px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.01em',
          border: '1px solid rgba(18, 31, 25, 0.14)',
          color: alert.state === 'active' ? '#234236' : '#5a655f',
          background: alert.state === 'active' ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.58)',
          cursor: isPending ? 'wait' : 'pointer',
          opacity: isPending ? 0.7 : 1,
        }}
      >
        {isPending ? 'Saving...' : alert.state === 'active' ? 'Acknowledge' : 'Mark active'}
      </button>
      {error ? <span style={{ fontSize: 11, color: '#7a5230' }}>{error}</span> : null}
    </div>
  );
}
