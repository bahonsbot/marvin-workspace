import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NextRequest, NextResponse } from 'next/server';
import {
  createSudoOrchestrationRun,
  listSudoDelegatedRuns,
  listSudoOrchestrationRuns,
  SUDO_DELEGATION_LANES,
  updateSudoOrchestrationRun,
} from '@/lib/agents/sudo-delegation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RUNNER_PATH = fileURLToPath(new URL('../../../../scripts/run-sudo-orchestration.mjs', import.meta.url));

export async function GET() {
  const [orchestrations, runs] = await Promise.all([listSudoOrchestrationRuns(), listSudoDelegatedRuns()]);
  return NextResponse.json(
    {
      lanes: SUDO_DELEGATION_LANES,
      orchestrations,
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
      prompt?: string;
      sourceSessionKey?: string | null;
      taskId?: string | null;
    };

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return NextResponse.json({ error: 'A Sudo brief is required.' }, { status: 400 });
    }

    const orchestration = await createSudoOrchestrationRun({
      requestedPrompt: prompt,
      sourceSessionKey: body.sourceSessionKey,
      linkedTaskId: body.taskId,
    });

    try {
      const child = spawn('node', [RUNNER_PATH, orchestration.id], {
        cwd: process.cwd(),
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start Sudo orchestration.';
      const failedRun = await updateSudoOrchestrationRun(orchestration.id, (current) => ({
        ...current,
        status: 'error',
        completedAt: new Date().toISOString(),
        waitingForPhilippe: false,
        oversight: {
          oversightNeeded: true,
          oversightLevel: 'blocker',
          oversightReason: 'blocked',
          approvalNeeded: false,
          recommendedDecision: 'Review why the Sudo orchestration runner could not start before retrying.',
          blockedBy: [message],
          nextHumanDecision: 'Marvin and Philippe should decide whether to retry the orchestration or stop.',
          marvinSummary: 'Mission Control could not start the Sudo orchestration runner, so Sudo could not safely continue.',
          safeToAutoContinue: false,
        },
        error: message,
      }));
      return NextResponse.json({ error: message, orchestration: failedRun }, { status: 500 });
    }

    return NextResponse.json({ status: 'accepted', orchestration });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start Sudo orchestration.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
