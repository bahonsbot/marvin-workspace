import Link from 'next/link';
import { floatingInsetStyle } from '@/components/shared/floating';
import { PageScaffold } from '@/components/shared/PageScaffold';
import { DirectoryListing } from '@/components/files/DirectoryListing';
import { FilesPreviewSection } from '@/components/files/FilesPreviewSection';
import { FilesRail } from '@/components/files/FilesRail';
import { RecentFilesStrip } from '@/components/files/RecentFilesStrip';
import { BackToTopButton } from '@/components/memory/BackToTopButton';
import { getDirectoryListing, getFilePreview } from '@/lib/adapters/files';

export const dynamic = 'force-dynamic';

type SearchParamValue = string | string[] | undefined;

type FilesPageSearchParams = {
  path?: SearchParamValue;
  file?: SearchParamValue;
};

function getParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FilesPage({ searchParams }: { searchParams?: Promise<FilesPageSearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const selectedPath = getParam(resolvedSearchParams?.path);
  const selectedFilePath = getParam(resolvedSearchParams?.file) ?? null;

  const listing = await getDirectoryListing(selectedPath);
  const preview = selectedFilePath ? await getFilePreview(selectedFilePath) : null;

  return (
    <div id="page-top">
      <PageScaffold
        title="Files"
        titleVariant="editorial"
        descriptionVariant="quote"
        hideHeader
      >
        <div className="general-two-col-layout">
          <FilesRail roots={listing.roots} currentPath={listing.directory.path} />

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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--muted)' }}>Workspace browser</div>
                  <h2 style={{ margin: 0, fontSize: 34, lineHeight: 1.1, letterSpacing: -0.6, fontFamily: 'Georgia, \"Times New Roman\", serif', fontWeight: 400 }}>Workspace Files</h2>
                </div>
              </div>

              <div className="floating-pill-row">
                {listing.directory.breadcrumb.map((crumb, index) => (
                  <span key={crumb.path} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Link
                      href={`/general/files?path=${encodeURIComponent(crumb.path)}`}
                      className={`floating-pill${index === listing.directory.breadcrumb.length - 1 ? ' floating-pill-active' : ''}`}
                      style={{ fontFamily: 'monospace' }}
                    >
                      {crumb.label}
                    </Link>
                    {index < listing.directory.breadcrumb.length - 1 ? <span style={{ color: 'var(--muted)' }}>/</span> : null}
                  </span>
                ))}
              </div>
            </header>

            <RecentFilesStrip activeFilePath={preview?.file?.path ?? null} />

            <DirectoryListing entries={listing.entries} currentDirectory={listing.directory.path} selectedFilePath={preview?.file?.path ?? null} />

            <FilesPreviewSection initialPreview={preview} />
          </section>
        </div>
        <BackToTopButton />
      </PageScaffold>
    </div>
  );
}
