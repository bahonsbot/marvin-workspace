import { NextResponse } from 'next/server';
import { getFilesRoots } from '@/lib/adapters/files';

export async function GET() {
  const roots = await getFilesRoots();
  return NextResponse.json({ roots, refreshedAt: new Date().toISOString() });
}
