import Link from 'next/link';
import { floatingInsetStyle } from '@/components/shared/floating';
import { PageScaffold } from '@/components/shared/PageScaffold';
import { DirectoryListing } from '@/components/files/DirectoryListing';
import { FilesPreviewSection } from '@/components/files/FilesPreviewSection';
import { FilesRail } from '@/components/files/FilesRail';
import { RecentFilesStrip } from '@/components/files/RecentFilesStrip';
import { BackToTopButton } from '@/components/memory/BackToTopButton';
import { getDirectoryListing, getFilePreview, getFilesNameSearch } from '@/lib/adapters/files';
import type { FilesNameSearchResult } from '@/lib/types/contracts';

export const dynamic = 'force-dynamic';

type SearchParamValue = string | string[] | undefined;

type FilesPageSearchParams = {
  path?: SearchParamValue;
  file?: SearchParamValue;
  q?: SearchParamValue;
};

function getParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function dirname(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean);
  if (parts.length <= 1) return '.';
  return parts.slice(0, -1).join('/');
}

function formatResultMeta(result: FilesNameSearchResult): string {
  if (result.kind === 'directory') return 'Directory';
  if (result.size === null) return 'File';
  if (result.size < 1024) return `File - ${result.size} B`;
  if (result.size < 1024 * 1024) return `File - ${(result.size / 1024).toFixed(1)} KB`;
  return `File - ${(result.size / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function FilesPage({ searchParams }: { searchParams?: Promise<FilesPageSearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const selectedPath = getParam(resolvedSearchParams?.path);
  const selectedFilePath = getParam(resolvedSearchParams?.file) ?? null;
  const nameQuery = getParam(resolvedSearchParams?.q)?.trim() ?? '';

  const [listing, preview, searchResults] = await Promise.all([
    getDirectoryListing(selectedPath),
    selectedFilePath ? getFilePreview(selectedFilePath) : Promise.resolve(null),
    nameQuery ? getFilesNameSearch(nameQuery, { limit: 50 }) : Promise.resolve(null),
  ]);

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

              <form action="/general/files" method="get" style={{ display: 'grid', gap: 8 }}>
                <input type="hidden" name="path" value={listing.directory.path} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="search"
                    name="q"
                    defaultValue={nameQuery}
                    placeholder="Search file and folder names in workspace"
                    aria-label="Search file and folder names"
                    style={{
                      flex: '1 1 280px',
                      minWidth: 200,
                      borderRadius: 999,
                      border: '1px solid var(--border)',
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.76)',
                      color: 'var(--text-body)',
                      fontFamily: 'monospace',
                      fontSize: 13,
                    }}
                  />
                  <button type="submit" className="floating-pill" style={{ cursor: 'pointer' }}>
                    Search names
                  </button>
                  {nameQuery ? (
                    <Link href={`/general/files?path=${encodeURIComponent(listing.directory.path)}`} className="floating-pill" style={{ display: 'inline-flex', alignItems: 'center' }}>
                      Clear
                    </Link>
                  ) : null}
                </div>
              </form>
            </header>

            {searchResults ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: 18, padding: 14, background: 'rgba(255, 253, 251, 0.72)', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted-strong)' }}>
                    Name matches for <span style={{ fontFamily: 'monospace', color: 'var(--text-body)' }}>{searchResults.query}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Showing {searchResults.results.length} of {searchResults.total}
                    {searchResults.truncated ? ` (capped at ${searchResults.limit})` : ''}
                  </div>
                </div>

                {searchResults.results.length > 0 ? (
                  <div style={{ display: 'grid', gap: 6 }}>
                    {searchResults.results.map((result) => {
                      const href = result.kind === 'file'
                        ? `/general/files?path=${encodeURIComponent(dirname(result.path))}&file=${encodeURIComponent(result.path)}&q=${encodeURIComponent(nameQuery)}#file-preview`
                        : `/general/files?path=${encodeURIComponent(result.path)}&q=${encodeURIComponent(nameQuery)}`;
                      return (
                        <Link key={result.path} href={href} style={{ display: 'grid', gap: 2, padding: '8px 10px', borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.58)' }}>
                          <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {result.kind === 'directory' ? '📁' : '📄'} {result.path}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{formatResultMeta(result)}</div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>No file or folder names matched this query.</div>
                )}
              </div>
            ) : null}

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
