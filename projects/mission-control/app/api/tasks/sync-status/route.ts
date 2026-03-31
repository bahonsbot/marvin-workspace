import { NextResponse } from 'next/server';
import { getTaskSyncStatus } from '@/lib/adapters/tasks';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const data = await getTaskSyncStatus();
  return NextResponse.json(data);
}
