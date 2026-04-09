import { spawn } from 'node:child_process';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import {
  createSudoDelegatedRun,
  getSudoDelegationLane,
  listSudoDelegatedRuns,
  SUDO_DELEGATION_LANES,
  updateSudoDelegatedRun,
} from '@/lib/agents/sudo-delegation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RUNNER_PATH = path.join(process.cwd(), 'scripts', 'run-sudo-delegation.mjs');

export async function GET() {
  const runs = await listSudoDelegatedRuns();
  return NextResponse.json(
    {
      lanes: SUDO_DELEGATION_LANES,
      runs,
      refreshedAt: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      laneSlug?: string;
      prompt?: string;
      sourceSessionKey?: string | null;
    };

    const lane = body.laneSlug ? getSudoDelegationLane(body.laneSlug) : null;
    if (!lane) {
      return NextResponse.json({ error: 'Unknown Sudo delegation lane.' }, { status: 400 });
    }

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return NextResponse.json({ error: 'Delegation prompt is required.' }, { status: 400 });
    }

    const run = await createSudoDelegatedRun({
      lane,
      requestedPrompt: prompt,
      sourceSessionKey: body.sourceSessionKey,
    });

    try {
      const child = spawn('node', [RUNNER_PATH, run.id], {
        cwd: process.cwd(),
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start delegated lane run.';
      const failedRun = await updateSudoDelegatedRun(run.id, (current) => ({
        ...current,
        status: 'error',
        completedAt: new Date().toISOString(),
        error: message,
      }));
      return NextResponse.json({ error: message, run: failedRun }, { status: 500 });
    }

    return NextResponse.json({ status: 'accepted', run });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start Sudo delegation.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
