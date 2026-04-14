import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NextRequest, NextResponse } from 'next/server';
import { getAutonomousTaskById, latestMeaningfulRetryFeedback, moveLinkedLegacyTask, updateAutonomousTask } from '@/lib/autonomous';
import { autonomousTaskPreflight } from '@/lib/autonomous-preflight';

const WORKSPACE_ROOT = '/data/.openclaw/workspace';
const RUNNER_PATH = fileURLToPath(new URL('../../../../../../scripts/run-autonomous-task.mjs', import.meta.url));

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

    const startedAt = Date.now();
    const sessionId = `mc-auto-${task.id}-${startedAt}`;
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

    const child = spawn('node', [RUNNER_PATH, task.id], {
      cwd: WORKSPACE_ROOT,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    return NextResponse.json({ status: 'started', task: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to execute autonomous task.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
