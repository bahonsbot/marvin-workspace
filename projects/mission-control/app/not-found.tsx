import Link from 'next/link';
import { PageScaffold } from '@/components/shared/PageScaffold';

export default function NotFoundPage() {
  return (
    <PageScaffold
      title="Not Found"
      titleVariant="editorial"
      description="This route is outside the current Mission Control surface."
    >
      <div
        style={{
          border: '1px solid rgba(200, 195, 188, 0.42)',
          borderRadius: 22,
          background: 'rgba(255, 253, 251, 0.92)',
          padding: 24,
          display: 'grid',
          gap: 12,
        }}
      >
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: 'var(--text-muted)' }}>
          Mission Control could not resolve this page inside the current shell.
        </p>
        <div>
          <Link href="/general/home" style={{ color: 'var(--text-body)', fontWeight: 700 }}>
            Return to home
          </Link>
        </div>
      </div>
    </PageScaffold>
  );
}
