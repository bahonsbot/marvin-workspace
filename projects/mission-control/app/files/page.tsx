import { redirect } from 'next/navigation';

type FilesCompatProps = {
  searchParams?: {
    path?: string;
    file?: string;
  };
};

export default function FilesCompatPage({ searchParams }: FilesCompatProps) {
  const params = new URLSearchParams();
  if (searchParams?.path) params.set('path', searchParams.path);
  if (searchParams?.file) params.set('file', searchParams.file);
  redirect(`/general/files${params.size > 0 ? `?${params.toString()}` : ''}`);
}
