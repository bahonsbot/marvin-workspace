import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { getAutonomousTaskById, latestMeaningfulRetryFeedback, moveLinkedLegacyTask, updateAutonomousTask } from '@/lib/autonomous';
import { autonomousTaskPreflight } from '@/lib/autonomous-preflight';

const WORKSPACE_ROOT = '/data/.openclaw/workspace';
const SESSIONS_ROOT = '/data/.openclaw/agents/main/sessions';
const RUNNER_DIR = path.join(WORKSPACE_ROOT, 'projects', 'mission-control', 'scripts');
const RUNNER_FILE = 'run-autonomous-task.mjs';
const RUNNER_PATH = path.join(RUNNER_DIR, RUNNER_FILE);
const SESSIONS_REGISTRY_PATH = path.join(SESSIONS_ROOT, 'sessions.json');
const RUNNER_START_TIMEOUT_MS = 2000;
const RUNNER_START_POLL_MS = 150;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildAutonomousSessionId(taskId: string, startedAt: number): string {
  const digest = createHash('sha1').update(String(taskId || '')).digest('hex').slice(0, 10);
  return `mc-auto-${digest}-${startedAt}`;
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function sessionEvidenceExists(sessionId: string): Promise<boolean> {
  if (await fileExists(path.join(SESSIONS_ROOT, `${sessionId}.jsonl`))) {
    return true;
  }

  try {
    const raw = await fs.readFile(SESSIONS_REGISTRY_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, { sessionId?: string } | undefined>;
    if (parsed[sessionId]) {
      return true;
    }
    return Object.values(parsed).some((entry) => entry?.sessionId === sessionId);
  } catch {
    return false;
  }
}

type RunnerStartupResult =
  | { ok: true }
  | { ok: false; reason: string };

async function waitForRunnerStartup(sessionId: string, child: ReturnType<typeof spawn>): Promise<RunnerStartupResult> {
  let launchError: string | null = null;
  let exitReason: string | null = null;

  const onError = (error: Error) => {
    launchError = error.message;
  };
  const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
    exitReason = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`;
  };

  child.once('error', onError);
  child.once('exit', onExit);

  try {
    const deadline = Date.now() + RUNNER_START_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (launchError) {
        return { ok: false, reason: `Runner failed to launch: ${launchError}` };
      }
      if (exitReason) {
        return { ok: false, reason: `Runner exited too early (${exitReason})` };
      }
      if (await sessionEvidenceExists(sessionId)) {
        return { ok: true };
      }
      await delay(RUNNER_START_POLL_MS);
    }

    if (launchError) {
      return { ok: false, reason: `Runner failed to launch: ${launchError}` };
    }
    if (exitReason) {
      return { ok: false, reason: `Runner exited too early (${exitReason})` };
    }

    // If the process is still alive after a short observation window,
    // treat startup as healthy even if session artifacts appear later.
    return { ok: true };
  } finally {
    child.off('error', onError);
    child.off('exit', onExit);
  }
}

function terminateRunner(child: ReturnType<typeof spawn>): void {
  const pid = child.pid;
  if (!pid) return;
  try {
    process.kill(-pid, 'SIGTERM');
    return;
  } catch {
    // Fall through to direct child kill.
  }
  try {
    child.kill('SIGTERM');
  } catch {
    // Best effort only.
  }
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const task = await getAutonomousTaskById(taskId);
    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }
    if (!(task.status === 'backlog' || task.status === 'todo')) {
      return NextResponse.json({ error: 'Task is not in an executable state.' }, { status: 409 });
    }

    const preflight = autonomousTaskPreflight({
      title: task.title,
      description: task.description,
      agentTarget: task.agentTarget,
    });
    if (!preflight.ok) {
      const note = preflight.warning ?? 'Task execution is blocked by a missing runtime capability.';
      const blocked = await updateAutonomousTask(task.id, (current) => ({
        ...current,
        status: 'todo',
        needsInput: {
          reason: 'missing-web-research-capability',
          at: Date.now(),
          note,
        },
        run: current.run
          ? {
              ...current.run,
              model: current.model,
              status: 'error',
              summary: note,
              error: note,
            }
          : undefined,
      }));
      return NextResponse.json({ error: note, code: 'missing-web-research-capability', task: blocked }, { status: 409 });
    }

    try {
      await fs.access(RUNNER_PATH);
    } catch {
      return NextResponse.json({ error: `Autonomous runner is missing: ${RUNNER_PATH}` }, { status: 500 });
    }

    const startedAt = Date.now();
    const sessionId = buildAutonomousSessionId(task.id, startedAt);
    const attemptNumber = Math.max((task.run?.attemptNumber ?? 0) + 1, 1);
    const attemptId = `${task.id}-attempt-${attemptNumber}`;
    const latestFeedback = latestMeaningfulRetryFeedback(task);
    const updated = await updateAutonomousTask(task.id, (current) => ({
      ...current,
      status: 'in-progress',
      needsInput: undefined,
      linkedAutonomyRef: current.linkedAutonomyRef
        ? {
            ...current.linkedAutonomyRef,
            section: 'in-progress',
            queueLinked: false,
            queueLabel: undefined,
            completedOutputPath: undefined,
          }
        : current.linkedAutonomyRef,
      artifacts: [],
      run: {
        attemptId,
        attemptNumber,
        trigger: 'direct',
        model: current.model,
        sessionKey: sessionId,
        sessionId,
        startedAt,
        status: 'running',
        summary: latestFeedback ? 'Retrying with operator feedback' : 'Execution started',
        feedbackAt: latestFeedback?.at,
        feedbackNote: latestFeedback?.note,
      },
    }));

    if (updated) {
      await moveLinkedLegacyTask(updated, 'in-progress');
    }

    const child = spawn('node', [RUNNER_FILE, task.id], {
      cwd: RUNNER_DIR,
      detached: true,
      stdio: 'ignore',
    });

    const startup = await waitForRunnerStartup(sessionId, child);
    if (!startup.ok) {
      terminateRunner(child);
      const note = `Autonomous execution failed to start: ${startup.reason}`;
      const repaired = await updateAutonomousTask(task.id, (current) => ({
        ...current,
        status: 'todo',
        needsInput: undefined,
        linkedAutonomyRef: current.linkedAutonomyRef
          ? {
              ...current.linkedAutonomyRef,
              section: 'open-backlog',
              queueLinked: false,
              queueLabel: undefined,
              completedOutputPath: undefined,
            }
          : current.linkedAutonomyRef,
        run: current.run
          ? {
              ...current.run,
              endedAt: Date.now(),
              status: 'error',
              summary: 'Execution failed to start',
              error: note,
            }
          : current.run,
      }));
      if (repaired) {
        await moveLinkedLegacyTask(repaired, 'open-backlog');
      }
      return NextResponse.json({ error: note, task: repaired }, { status: 500 });
    }

    child.unref();
    return NextResponse.json({ status: 'started', task: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to execute autonomous task.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
