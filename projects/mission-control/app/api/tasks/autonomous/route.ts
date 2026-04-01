import { NextRequest, NextResponse } from 'next/server';
import {
  createManualAutonomousTask,
  importLegacyAutonomousTasks,
  loadStructuredTasks,
  type MCAutoTaskAgentTarget,
  type MCAutoTaskPriority,
} from '@/lib/autonomous';
import { normalizeAutonomousTaskModel } from '@/lib/task-models';

function isPriority(value: unknown): value is MCAutoTaskPriority {
  return value === 'critical' || value === 'high' || value === 'normal' || value === 'low';
}

function isAgentTarget(value: unknown): value is MCAutoTaskAgentTarget {
  return value === 'marvin' || value === 'builder' || value === 'reviewer' || value === 'content-creator';
}

export async function GET() {
  try {
    const store = await loadStructuredTasks();
    return NextResponse.json({
      status: 'ok',
      tasks: store.tasks,
      meta: store.meta,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load autonomous tasks.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : undefined;
    const priority = isPriority(body?.priority) ? body.priority : 'normal';
    const agentTarget = isAgentTarget(body?.agentTarget) ? body.agentTarget : 'marvin';
    const model = normalizeAutonomousTaskModel(body?.model);
    const sourceSessionKey = typeof body?.sourceSessionKey === 'string' ? body.sourceSessionKey : undefined;

    if (!title) {
      return NextResponse.json({ error: 'Task title is required.' }, { status: 400 });
    }

    const task = await createManualAutonomousTask({
      title,
      description,
      priority,
      agentTarget,
      model,
      sourceSessionKey,
    });

    return NextResponse.json({ status: 'created', task }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create autonomous task.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT() {
  try {
    const result = await importLegacyAutonomousTasks();
    return NextResponse.json({
      status: 'ok',
      imported: result.imported,
      updated: result.updated,
      total: result.store.tasks.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to refresh autonomous tasks.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
