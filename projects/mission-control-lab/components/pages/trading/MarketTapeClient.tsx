'use client';

import { useEffect, useRef, useState } from 'react';
import type { MarketTapeData } from '@/lib/trading/market-tape';

function itemTone(change: string) {
  if (change.startsWith('-')) return 'negative';
  if (change.startsWith('+')) return 'positive';
  return 'neutral';
}

function isUsMarketOpen(now = new Date()) {
  const easternParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const part = (type: string) => easternParts.find((item) => item.type === type)?.value;
  const weekday = part('weekday');
  const hour = Number(part('hour'));
  const minute = Number(part('minute'));
  if (weekday === 'Sat' || weekday === 'Sun' || !Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const minutes = hour * 60 + minute;
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

export function MarketTapeClient({ initialData }: { initialData: MarketTapeData }) {
  const [tape, setTape] = useState<MarketTapeData>(initialData);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function refreshTape() {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const response = await fetch('/api/trading/market-tape', {
          cache: 'no-store',
          headers: { accept: 'application/json' },
        });
        if (!response.ok) return;
        const data = (await response.json()) as MarketTapeData;
        if (!cancelled) setTape(data);
      } finally {
        inFlightRef.current = false;
      }
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (!isUsMarketOpen()) return;
      void refreshTape();
    }, 60_000);

    const onVisible = () => {
      if (document.visibilityState === 'visible' && isUsMarketOpen()) void refreshTape();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <div className="trading-market-tape-shell" aria-label="Market tape" data-market-open={tape.isMarketOpen ? 'true' : 'false'}>
      <div className="trading-market-tape">
        {tape.items.map((item) => (
          <div key={item.label} className="trading-market-tape-item">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <em className={itemTone(item.change)}>{item.change}</em>
          </div>
        ))}
        <div className="trading-market-tape-status">{tape.status}</div>
      </div>
    </div>
  );
}
