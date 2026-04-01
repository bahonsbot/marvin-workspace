import { NextResponse } from 'next/server';
import { queryWorkspaceSearch } from '@/lib/adapters/search';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const scope = searchParams.get('scope');
  const limitRaw = searchParams.get('limit');
  const limit = limitRaw ? Number(limitRaw) : null;

  const data = await queryWorkspaceSearch({
    query,
    scope,
    limit: Number.isFinite(limit) ? limit : null,
  });

  return NextResponse.json(data);
}
