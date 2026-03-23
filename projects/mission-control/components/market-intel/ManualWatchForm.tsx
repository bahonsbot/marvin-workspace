'use client';

import { useState } from 'react';

interface ManualWatchFormProps {
  onAdded?: () => void;
}

type Conviction = 'low' | 'medium' | 'high';

export function ManualWatchForm({ onAdded }: ManualWatchFormProps) {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [thesis, setThesis] = useState('');
  const [conviction, setConviction] = useState<Conviction>('medium');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!symbol.trim() || !thesis.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/market-intel/manual-watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol.trim(),
          thesis: thesis.trim(),
          conviction,
          tags: tags.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to add');
        return;
      }

      setSuccess(true);
      setSymbol('');
      setThesis('');
      setTags('');
      setNotes('');
      setConviction('medium');
      setOpen(false);
      onAdded?.();
    } catch {
      setError('Network error — try again');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          borderRadius: 999,
          border: '1px solid rgba(251, 191, 36, 0.4)',
          background: 'rgba(251, 191, 36, 0.08)',
          color: '#fbbf24',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        }}
      >
        + Add ticker
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: '1px solid rgba(251, 191, 36, 0.28)',
        borderRadius: 12,
        padding: '12px 13px',
        background: 'rgba(251, 191, 36, 0.05)',
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>Add to watch</span>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); setSuccess(false); }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            fontSize: 16,
            cursor: 'pointer',
            padding: '0 2px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 10px', alignItems: 'center' }}>
        <label style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
          Ticker *
        </label>
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="e.g. AAPL"
          maxLength={10}
          required
          style={{
            background: 'rgba(7, 12, 22, 0.8)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            padding: '5px 9px',
            color: 'var(--text)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.5,
            width: '100%',
            boxSizing: 'border-box',
          }}
        />

        <label style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
          Thesis *
        </label>
        <textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          placeholder="Why watch this ticker?"
          rows={2}
          required
          style={{
            background: 'rgba(7, 12, 22, 0.8)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            padding: '5px 9px',
            color: 'var(--text)',
            fontSize: 12,
            resize: 'vertical',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />

        <label style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
          Conviction
        </label>
        <select
          value={conviction}
          onChange={(e) => setConviction(e.target.value as Conviction)}
          style={{
            background: 'rgba(7, 12, 22, 0.8)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            padding: '5px 9px',
            color: 'var(--text)',
            fontSize: 12,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <label style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
          Tags
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="comma-separated, e.g. momentum, earnings"
          style={{
            background: 'rgba(7, 12, 22, 0.8)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            padding: '5px 9px',
            color: 'var(--text)',
            fontSize: 12,
            width: '100%',
            boxSizing: 'border-box',
          }}
        />

        <label style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
          Notes
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="optional context"
          style={{
            background: 'rgba(7, 12, 22, 0.8)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            padding: '5px 9px',
            color: 'var(--text)',
            fontSize: 12,
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(248, 113, 113, 0.1)', padding: '5px 9px', borderRadius: 7, border: '1px solid rgba(248, 113, 113, 0.25)' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ fontSize: 12, color: '#5eead4', background: 'rgba(94, 234, 212, 0.08)', padding: '5px 9px', borderRadius: 7, border: '1px solid rgba(94, 234, 212, 0.2)' }}>
          Added — page will refresh momentarily.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); setSuccess(false); }}
          style={{
            padding: '5px 12px',
            borderRadius: 7,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--muted)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !symbol.trim() || !thesis.trim()}
          style={{
            padding: '5px 14px',
            borderRadius: 7,
            border: '1px solid rgba(251, 191, 36, 0.4)',
            background: submitting ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.15)',
            color: submitting ? 'rgba(251, 191, 36, 0.4)' : '#fbbf24',
            fontSize: 12,
            fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Saving…' : 'Add to watch'}
        </button>
      </div>
    </form>
  );
}
