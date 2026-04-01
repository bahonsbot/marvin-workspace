import { NextResponse } from 'next/server';
import { listTaskLifecycleEvents } from '@/lib/task-lifecycle-events';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const events = await listTaskLifecycleEvents();
  return NextResponse.json(
    {
      status: 'ok',
      events,
      refreshedAt: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
