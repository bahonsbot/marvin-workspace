import { NextResponse } from 'next/server';
import { cleanupTaskSyncDrift, getTaskSyncStatus } from '@/lib/adapters/tasks';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const data = await getTaskSyncStatus();
  return NextResponse.json(data);
}

export async function POST() {
  const cleanup = await cleanupTaskSyncDrift();
  const data = await getTaskSyncStatus();
  return NextResponse.json({ ...data, cleanup });
}
