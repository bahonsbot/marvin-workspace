import { redirect } from 'next/navigation';

type MemoryCompatProps = {
  searchParams?: Promise<{
    section?: string;
    date?: string;
    learning?: string;
  }>;
};

export default async function MemoryCompatPage({ searchParams }: MemoryCompatProps) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();
  if (resolvedSearchParams?.section) params.set('section', resolvedSearchParams.section);
  if (resolvedSearchParams?.date) params.set('date', resolvedSearchParams.date);
  if (resolvedSearchParams?.learning) params.set('learning', resolvedSearchParams.learning);
  redirect(`/general/memory${params.size > 0 ? `?${params.toString()}` : ''}`);
}
