'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, LineSeries, type IChartApi, type ISeriesApi, type LineData, type Time } from 'lightweight-charts';
import type { TickerPriceRangeSeries } from '@/lib/trading/contracts';

type PriceChartProps = {
  ranges: string[];
  activeRange: string;
  rangeSeries?: Record<string, TickerPriceRangeSeries>;
};

function toLineData(series: TickerPriceRangeSeries | undefined): LineData<Time>[] {
  return (series?.points ?? []).map((point) => ({ time: point.time as Time, value: point.value }));
}

export function TickerPriceChart({ ranges, activeRange, rangeSeries = {} }: PriceChartProps) {
  const availableRanges = useMemo(() => ranges.filter((range) => rangeSeries[range]?.points?.length), [ranges, rangeSeries]);
  const [selectedRange, setSelectedRange] = useState(() => (rangeSeries[activeRange]?.points?.length ? activeRange : availableRanges[0] ?? activeRange));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const selectedSeries = rangeSeries[selectedRange];
  const lineData = useMemo(() => toLineData(selectedSeries), [selectedSeries]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height: 220,
      autoSize: true,
      layout: {
        attributionLogo: false,
        background: { color: 'transparent' },
        textColor: 'rgba(34, 48, 41, 0.58)',
        fontFamily: 'inherit',
      },
      grid: {
        vertLines: { color: 'rgba(28, 37, 32, 0.05)' },
        horzLines: { color: 'rgba(28, 37, 32, 0.08)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(28, 37, 32, 0.12)',
        textColor: 'rgba(34, 48, 41, 0.55)',
      },
      timeScale: {
        borderColor: 'rgba(28, 37, 32, 0.12)',
        timeVisible: selectedRange === '1D' || selectedRange === '5D',
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(23, 36, 30, 0.24)', labelBackgroundColor: '#17241e' },
        horzLine: { color: 'rgba(23, 36, 30, 0.18)', labelBackgroundColor: '#17241e' },
      },
    });

    const line = chart.addSeries(LineSeries, {
      color: '#16a34a',
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = line;

    const observer = new ResizeObserver(() => chart.timeScale().fitContent());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [selectedRange]);

  useEffect(() => {
    seriesRef.current?.setData(lineData);
    chartRef.current?.applyOptions({
      timeScale: {
        timeVisible: selectedRange === '1D' || selectedRange === '5D',
        secondsVisible: false,
      },
    });
    chartRef.current?.timeScale().fitContent();
  }, [lineData, selectedRange]);

  return (
    <div className="trading-price-chart-shell">
      <div className="trading-range-tabs trading-ticker-range-tabs" role="tablist" aria-label="Ticker price range">
        {ranges.map((range) => {
          const disabled = !rangeSeries[range]?.points?.length;
          return (
            <button
              key={range}
              type="button"
              className={range === selectedRange ? 'active' : ''}
              role="tab"
              aria-selected={range === selectedRange}
              disabled={disabled}
              onClick={() => setSelectedRange(range)}
            >
              {range}
            </button>
          );
        })}
      </div>
      <div ref={containerRef} className="trading-lightweight-chart" aria-label={`${selectedRange} price chart`} />
      <div className="trading-ticker-chart-axis" aria-hidden="true">
        {(selectedSeries?.axis ?? []).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <dl className="trading-ticker-chart-stats">
        {(selectedSeries?.stats ?? []).map((stat) => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
      <p className="trading-financial-caption">{selectedSeries?.source.freshness ?? 'missing'} · {selectedSeries?.source.source ?? 'yahoo'}: {selectedSeries?.source.note ?? 'Yahoo chart range data unavailable.'}</p>
    </div>
  );
}
