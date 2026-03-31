import { NextRequest, NextResponse } from 'next/server';
import { getAutonomousTaskById, removeAutonomousTask } from '@/lib/autonomous';

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
