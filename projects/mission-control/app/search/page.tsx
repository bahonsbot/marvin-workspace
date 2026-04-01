import { PageScaffold } from '@/components/shared/PageScaffold';
import { SearchExperience } from '@/components/search/SearchExperience';
import { BackToTopButton } from '@/components/memory/BackToTopButton';
import { queryWorkspaceSearch } from '@/lib/adapters/search';

export const dynamic = 'force-dynamic';

type SearchPageParams = {
  q?: string;
  scope?: string;
};

export default async function SearchPage({ searchParams }: { searchParams?: SearchPageParams }) {
  const initialData = await queryWorkspaceSearch({
    query: searchParams?.q,
    scope: searchParams?.scope,
    limit: 50,
  });

  return (
    <div id="page-top">
      <PageScaffold title="Search">
        <SearchExperience initialQuery={searchParams?.q} initialScope={searchParams?.scope} initialData={initialData} />
        <BackToTopButton />
      </PageScaffold>
    </div>
  );
}
