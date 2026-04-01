import { NextResponse } from 'next/server';
import { getMemoryOverview } from '@/lib/adapters/memory';

export async function GET() {
  const data = await getMemoryOverview();
  return NextResponse.json(data);
}
