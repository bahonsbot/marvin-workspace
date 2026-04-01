import Link from 'next/link';
import { floatingInsetStyle } from '@/components/shared/floating';
import type { MemorySection } from '@/lib/types/contracts';

const sectionItems: Array<{ key: MemorySection; label: string; hint: string }> = [
  { key: 'durable', label: 'Durable', hint: 'MEMORY.md' },
  { key: 'daily', label: 'Daily', hint: 'memory/YYYY-MM-DD.md' },
  { key: 'learnings', label: 'Learnings', hint: '.learnings/*.md' },
];

export function MemoryRail({ currentSection }: { currentSection: MemorySection }) {
  return (
    <aside
      style={{
        ...floatingInsetStyle({ radius: 22, padding: 16, background: 'linear-gradient(180deg, rgba(255, 253, 251, 0.82) 0%, rgba(247, 241, 235, 0.72) 100%)' }),
        display: 'grid',
        gap: 14,
        alignContent: 'start',
      }}
    >
      <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, padding: '6px 8px' }}>Memory</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {sectionItems.map((item) => {
          const active = item.key === currentSection;
          return (
            <Link
              key={item.key}
              href={`/general/memory?section=${item.key}`}
              style={{
                border: `1px solid ${active ? 'rgba(121, 166, 148, 0.28)' : 'var(--border)'}`,
                borderRadius: 16,
                padding: '12px 12px',
                background: active ? 'rgba(212, 231, 221, 0.7)' : 'rgba(255, 255, 255, 0.58)',
                display: 'grid',
                gap: 5,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: active ? 600 : 500, color: active ? '#315f51' : 'var(--text-body)' }}>{item.label}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{item.hint}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
