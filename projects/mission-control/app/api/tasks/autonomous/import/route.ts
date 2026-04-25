import { NextResponse } from 'next/server';
import { importLegacyAutonomousTasks } from '@/lib/autonomous';

export async function POST() {
  try {
    const result = await importLegacyAutonomousTasks();
    return NextResponse.json({
      status: 'ok',
      imported: result.imported,
      updated: result.updated,
      deduped: result.deduped,
      total: result.store.tasks.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import autonomous tasks.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
