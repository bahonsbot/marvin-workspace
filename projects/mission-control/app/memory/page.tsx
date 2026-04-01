import { redirect } from 'next/navigation';

type MemoryCompatProps = {
  searchParams?: {
    section?: string;
    date?: string;
    learning?: string;
  };
};

export default function MemoryCompatPage({ searchParams }: MemoryCompatProps) {
  const params = new URLSearchParams();
  if (searchParams?.section) params.set('section', searchParams.section);
  if (searchParams?.date) params.set('date', searchParams.date);
  if (searchParams?.learning) params.set('learning', searchParams.learning);
  redirect(`/general/memory${params.size > 0 ? `?${params.toString()}` : ''}`);
}
