import { redirect } from 'next/navigation';

type FilesCompatProps = {
  searchParams?: Promise<{
    path?: string;
    file?: string;
  }>;
};

export default async function FilesCompatPage({ searchParams }: FilesCompatProps) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();
  if (resolvedSearchParams?.path) params.set('path', resolvedSearchParams.path);
  if (resolvedSearchParams?.file) params.set('file', resolvedSearchParams.file);
  redirect(`/general/files${params.size > 0 ? `?${params.toString()}` : ''}`);
}
