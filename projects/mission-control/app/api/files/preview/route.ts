import { NextResponse } from 'next/server';
import { getFilePreview } from '@/lib/adapters/files';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  const data = await getFilePreview(path);
  return NextResponse.json(data);
}
