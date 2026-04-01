import { NextResponse } from 'next/server';
import { getDirectoryListing } from '@/lib/adapters/files';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  const data = await getDirectoryListing(path);
  return NextResponse.json(data);
}
