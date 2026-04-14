import { PageScaffold } from '@/components/shared/PageScaffold';
import { SearchExperience } from '@/components/search/SearchExperience';
import { BackToTopButton } from '@/components/memory/BackToTopButton';
import { queryWorkspaceSearch } from '@/lib/adapters/search';

export const dynamic = 'force-dynamic';

type SearchPageParams = {
  q?: string;
  scope?: string;
};

export default async function SearchPage({ searchParams }: { searchParams?: Promise<SearchPageParams> }) {
  const resolvedSearchParams = await searchParams;
  const initialData = await queryWorkspaceSearch({
    query: resolvedSearchParams?.q,
    scope: resolvedSearchParams?.scope,
    limit: 50,
  });

  return (
    <div id="page-top">
      <PageScaffold title="Search">
        <SearchExperience initialQuery={resolvedSearchParams?.q} initialScope={resolvedSearchParams?.scope} initialData={initialData} />
        <BackToTopButton />
      </PageScaffold>
    </div>
  );
}
