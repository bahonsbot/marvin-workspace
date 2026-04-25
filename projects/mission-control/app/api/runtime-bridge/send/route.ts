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
    const body = (await request.json()) as {
      sessionKey?: string | null;
      message?: string | null;
      deliver?: boolean;
      idempotencyKey?: string | null;
      attachments?: unknown;
    };

    const sessionKey = typeof body?.sessionKey === 'string' ? body.sessionKey.trim() : '';
    const message = typeof body?.message === 'string' ? body.message : '';

    if (!sessionKey) {
      return NextResponse.json({ error: 'sessionKey is required' }, { status: 400 });
    }

    if (!message.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const params: Record<string, unknown> = {
      sessionKey,
      message,
      deliver: Boolean(body?.deliver),
    };

    if (typeof body?.idempotencyKey === 'string' && body.idempotencyKey.trim()) {
      params.idempotencyKey = body.idempotencyKey.trim();
    }

    if (Array.isArray(body?.attachments)) {
      params.attachments = body.attachments;
    }

    const { stdout } = await runShellCommand(
      `openclaw gateway call chat.send --json --timeout ${GATEWAY_CALL_TIMEOUT_MS} --params ${shellQuote(JSON.stringify(params))}`,
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
        error: cause instanceof Error ? cause.message : 'chat.send failed',
      },
      { status: 500 },
    );
  }
}
