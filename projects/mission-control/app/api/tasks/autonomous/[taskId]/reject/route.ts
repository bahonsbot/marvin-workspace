import { NextRequest, NextResponse } from 'next/server';
import { rejectAutonomousTask } from '@/lib/autonomous';

export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const body = await request.json().catch(() => ({}));
    const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : 'Rejected without note.';
    const task = await rejectAutonomousTask(taskId, note);
    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }
    return NextResponse.json({ status: 'ok', task });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reject autonomous task.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
