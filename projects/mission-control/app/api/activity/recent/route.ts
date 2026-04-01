import { NextResponse } from 'next/server';
import { getRecentActivity } from '@/lib/adapters/activity';

export async function GET() {
  const data = await getRecentActivity();
  return NextResponse.json(data);
}
