import Link from 'next/link';
import { floatingInsetStyle } from '@/components/shared/floating';
import { PageScaffold } from '@/components/shared/PageScaffold';
import { MemoryDocumentEditor } from '@/components/memory/MemoryDocumentEditor';
import { MemoryRail } from '@/components/memory/MemoryRail';
import { MemoryMetaStrip } from '@/components/memory/MemoryMetaStrip';
import { BackToTopButton } from '@/components/memory/BackToTopButton';
import { getMemoryDocument, getMemoryOverview, resolveLearningKind } from '@/lib/adapters/memory';
import type { LearningKind, MemorySection } from '@/lib/types/contracts';

export const dynamic = 'force-dynamic';

type MemoryPageSearchParams = {
  section?: string;
  date?: string;
  learning?: string;
};

const learningTabs: Array<{ key: LearningKind; label: string }> = [
  { key: 'corrections', label: 'Corrections' },
  { key: 'errors', label: 'Errors' },
  { key: 'requests', label: 'Requests' },
];

export default async function MemoryPage({ searchParams }: { searchParams?: MemoryPageSearchParams }) {
  const section = (searchParams?.section === 'daily' || searchParams?.section === 'learnings' ? searchParams.section : 'durable') as MemorySection;

  const [overview, selected] = await Promise.all([
    getMemoryOverview(),
    getMemoryDocument({
      section,
      date: searchParams?.date,
      learning: searchParams?.learning,
    }),
  ]);

  const selectedLearning = resolveLearningKind(searchParams?.learning ?? selected.selectedLearning ?? undefined);

  return (
    <div id="page-top">
      <PageScaffold
        title="Memory"
        titleVariant="editorial"
        descriptionVariant="quote"
      >
        <div id="memory-top" className="general-two-col-layout">
          <MemoryRail currentSection={selected.section} />

          <section
            style={{
              ...floatingInsetStyle({ radius: 24, padding: 22, background: 'linear-gradient(180deg, rgba(255, 253, 251, 0.9) 0%, rgba(247, 241, 235, 0.78) 100%)' }),
              display: 'grid',
              alignContent: 'start',
              gap: 18,
              minWidth: 0,
            }}
          >
            <header style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    {selected.section === 'durable' ? 'Shared continuity' : selected.section === 'daily' ? 'Daily archive' : 'Learning ledger'}
                  </div>
                  <h2 style={{ margin: 0, fontSize: 34, lineHeight: 1.1, letterSpacing: -0.6, fontFamily: 'Georgia, \"Times New Roman\", serif', fontWeight: 400 }}>{selected.document.title}</h2>
                </div>
              </div>

              {selected.section === 'daily' && (
                <div className="floating-pill-row">
                  {overview.daily.files.slice(0, 10).map((file) => {
                    const active = file.title === selected.selectedDate;
                    return (
                      <Link
                        key={file.path}
                        href={`/general/memory?section=daily&date=${file.title}`}
                        className={`floating-pill${active ? ' floating-pill-active' : ''}`}
                        style={{ fontFamily: 'monospace' }}
                      >
                        {file.title}
                      </Link>
                    );
                  })}
                  {overview.daily.files.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 12 }}>No daily files detected in /memory yet.</span>}
                </div>
              )}

              {selected.section === 'learnings' && (
                <div className="floating-pill-row">
                  {learningTabs.map((tab) => {
                    const active = selectedLearning === tab.key;
                    return (
                      <Link
                        key={tab.key}
                        href={`/general/memory?section=learnings&learning=${tab.key}`}
                        className={`floating-pill${active ? ' floating-pill-active' : ''}`}
                      >
                        {tab.label}
                      </Link>
                    );
                  })}
                </div>
              )}

              <MemoryMetaStrip
                kind={selected.document.kind}
                updatedAt={selected.document.updatedAt}
                exists={selected.document.exists}
              />
            </header>

            <MemoryDocumentEditor
              initialDocument={selected.document}
              section={selected.section}
              selectedDate={selected.selectedDate}
              selectedLearning={selected.selectedLearning}
            />
          </section>
        </div>
        <BackToTopButton />
      </PageScaffold>
    </div>
  );
}
