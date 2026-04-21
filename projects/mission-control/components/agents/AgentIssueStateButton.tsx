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
          minHeight: 34,
          padding: '8px 12px',
          borderRadius: 999,
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: '0.02em',
          border: '1px solid rgba(121, 166, 148, 0.28)',
          color: alert.state === 'active' ? '#2d5c4e' : '#5a655f',
          background: alert.state === 'active'
            ? 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(236, 244, 240, 0.96) 100%)'
            : 'rgba(255,255,255,0.66)',
          boxShadow: alert.state === 'active' ? '0 8px 18px rgba(60, 102, 88, 0.08)' : 'none',
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
