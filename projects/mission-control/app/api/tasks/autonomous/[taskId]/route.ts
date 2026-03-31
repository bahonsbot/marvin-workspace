import { NextRequest, NextResponse } from 'next/server';
import { getAutonomousTaskById, removeAutonomousTask, rewriteLinkedLegacyTaskText, updateAutonomousTask } from '@/lib/autonomous';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const task = await getAutonomousTaskById(taskId);
    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }
    return NextResponse.json({ status: 'ok', task });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load autonomous task.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const priority = typeof body?.priority === 'string' ? body.priority : 'normal';
    const agentTarget = typeof body?.agentTarget === 'string' ? body.agentTarget : 'marvin';
    if (!title) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }
    const existing = await getAutonomousTaskById(taskId);
    if (!existing) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    const nextLegacyText = existing.linkedAutonomyRef?.kind === 'autonomous-md'
      ? existing.linkedAutonomyRef.taskText.replace(existing.title, title)
      : title;

    const task = await updateAutonomousTask(taskId, (current) => ({
      ...current,
      title,
      description: description || undefined,
      priority,
      agentTarget,
      linkedAutonomyRef: current.linkedAutonomyRef
        ? { ...current.linkedAutonomyRef, taskText: nextLegacyText, taskTextNormalized: nextLegacyText.toLowerCase() }
        : current.linkedAutonomyRef,
    }));
    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }
    if (task.linkedAutonomyRef?.kind === 'autonomous-md') {
      await rewriteLinkedLegacyTaskText(task, task.linkedAutonomyRef.taskText);
    }
    return NextResponse.json({ status: 'ok', task });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update autonomous task.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const task = await removeAutonomousTask(taskId);
    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }
    return NextResponse.json({ status: 'ok', task });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove autonomous task.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
