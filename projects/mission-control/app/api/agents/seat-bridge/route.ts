import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const execFileAsync = promisify(execFile);
const BRIDGE_SCRIPT = path.join(process.cwd(), 'scripts', 'seat-bridge.mjs');

export async function GET() {
  try {
    const { stdout } = await execFileAsync('node', [BRIDGE_SCRIPT, '--list'], {
      cwd: process.cwd(),
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });
    return NextResponse.json(JSON.parse(stdout || '{}'), {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to inspect seat bridge.';
    return NextResponse.json({ status: 'error', error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      seat?: string;
      prompt?: string;
      sourceSessionKey?: string | null;
      taskId?: string | null;
      timeoutSeconds?: number | null;
      dryRun?: boolean;
    };

    const seat = typeof body.seat === 'string' ? body.seat.trim() : '';
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!seat) {
      return NextResponse.json({ status: 'error', error: 'A seat is required.' }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ status: 'error', error: 'A prompt is required.' }, { status: 400 });
    }

    const args = [BRIDGE_SCRIPT, '--seat', seat, '--prompt', prompt];
    if (typeof body.sourceSessionKey === 'string' && body.sourceSessionKey.trim()) {
      args.push('--source-session-key', body.sourceSessionKey.trim());
    }
    if (typeof body.taskId === 'string' && body.taskId.trim()) {
      args.push('--task-id', body.taskId.trim());
    }
    if (typeof body.timeoutSeconds === 'number' && Number.isFinite(body.timeoutSeconds) && body.timeoutSeconds > 0) {
      args.push('--timeout', String(body.timeoutSeconds));
    }
    if (body.dryRun) {
      args.push('--dry-run');
    }

    const { stdout } = await execFileAsync('node', args, {
      cwd: process.cwd(),
      timeout: Math.max(15000, ((body.timeoutSeconds && body.timeoutSeconds > 0 ? body.timeoutSeconds : 900) + 30) * 1000),
      maxBuffer: 10 * 1024 * 1024,
    });

    const parsed = JSON.parse(stdout || '{}');
    return NextResponse.json(parsed, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Seat bridge execution failed.';
    return NextResponse.json({ status: 'error', error: message }, { status: 500 });
  }
}
