import { NextRequest, NextResponse } from 'next/server';
import { runShellCommand } from '@/lib/adapters/runtime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GATEWAY_CALL_TIMEOUT_MS = 40000;
const ROUTE_TIMEOUT_MS = 45000;

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { key?: string | null };
    const key = typeof body?.key === 'string' ? body.key.trim() : '';

    if (!key) {
      return NextResponse.json({ error: 'session key is required' }, { status: 400 });
    }

    const { stdout } = await runShellCommand(
      `openclaw gateway call sessions.patch --json --timeout ${GATEWAY_CALL_TIMEOUT_MS} --params ${shellQuote(JSON.stringify({ key }))}`,
      ROUTE_TIMEOUT_MS,
    );

    return NextResponse.json(JSON.parse(stdout), {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (cause) {
    return NextResponse.json(
      {
        error: cause instanceof Error ? cause.message : 'sessions.patch failed',
      },
      { status: 500 },
    );
  }
}
