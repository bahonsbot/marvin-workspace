import Link from 'next/link';
import { floatingInsetStyle } from '@/components/shared/floating';
import type { FilesRoot } from '@/lib/types/contracts';

function isRootActive(rootPath: string, currentPath: string) {
  if (rootPath === '.') return currentPath === '.';
  return currentPath === rootPath || currentPath.startsWith(`${rootPath}/`);
}

export function FilesRail({ roots, currentPath }: { roots: FilesRoot[]; currentPath: string }) {
  return (
    <aside
      style={{
        ...floatingInsetStyle({ radius: 22, padding: 16, background: 'linear-gradient(180deg, rgba(255, 253, 251, 0.82) 0%, rgba(247, 241, 235, 0.72) 100%)' }),
        display: 'grid',
        gap: 14,
        alignContent: 'start',
      }}
    >
      <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, padding: '6px 8px' }}>Files</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {roots.map((root) => {
          const active = isRootActive(root.path, currentPath);
          return (
            <Link
              key={root.id}
              href={`/general/files?path=${encodeURIComponent(root.path)}`}
              style={{
                border: `1px solid ${active ? 'rgba(121, 166, 148, 0.28)' : 'var(--border)'}`,
                borderRadius: 16,
                padding: '12px 12px',
                background: active ? 'rgba(212, 231, 221, 0.7)' : 'rgba(255, 255, 255, 0.58)',
                display: 'grid',
                gap: 5,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: active ? 600 : 500, color: active ? '#315f51' : 'var(--text-body)' }}>{root.label}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{root.path}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
