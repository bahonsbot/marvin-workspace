import { NextRequest, NextResponse } from 'next/server';
import { approveAutonomousTask } from '@/lib/autonomous';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const task = await approveAutonomousTask(taskId);
    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }
    return NextResponse.json({ status: 'ok', task });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to approve autonomous task.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
