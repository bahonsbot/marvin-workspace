import { NextRequest, NextResponse } from 'next/server';
import { triggerCronRun } from '@/lib/adapters/cron';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const jobId = typeof body?.jobId === 'string' ? body.jobId : null;
  const result = await triggerCronRun(jobId);
  return NextResponse.json(result, { status: 202 });
}
