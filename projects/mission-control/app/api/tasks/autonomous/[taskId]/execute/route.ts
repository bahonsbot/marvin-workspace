import { spawn } from 'node:child_process';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { getAutonomousTaskById, moveLinkedLegacyTask, updateAutonomousTask } from '@/lib/autonomous';

const WORKSPACE_ROOT = '/data/.openclaw/workspace';
const RUNNER_PATH = path.join(WORKSPACE_ROOT, 'projects', 'mission-control', 'scripts', 'run-autonomous-task.mjs');

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

    const startedAt = Date.now();
    const sessionId = `mc-auto-${task.id}-${startedAt}`;
    const updated = await updateAutonomousTask(task.id, (current) => ({
      ...current,
      status: 'in-progress',
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
        sessionKey: sessionId,
        sessionId,
        startedAt,
        status: 'running',
        summary: Array.isArray(current.feedback) && current.feedback.length > 0 ? 'Retrying with feedback' : undefined,
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
