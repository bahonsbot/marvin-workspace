import { NextResponse } from 'next/server';
import { getHomeSummary } from '@/lib/adapters/home';

export async function GET() {
  const data = await getHomeSummary();
  return NextResponse.json(data);
}
