import { NextResponse } from 'next/server';
import { getMemoryDocument, writeMemoryDocument } from '@/lib/adapters/memory';

const sectionSet = new Set(['durable', 'daily', 'learnings']);
const learningSet = new Set(['corrections', 'errors', 'requests']);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section');
  const date = searchParams.get('date');
  const learning = searchParams.get('learning');

  if (section && !sectionSet.has(section)) {
    return NextResponse.json({ error: 'invalid section parameter' }, { status: 400 });
  }

  if (learning && !learningSet.has(learning)) {
    return NextResponse.json({ error: 'invalid learning parameter' }, { status: 400 });
  }

  const data = await getMemoryDocument({ section, date, learning });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  let payload: {
    section?: unknown;
    date?: unknown;
    learning?: unknown;
    content?: unknown;
    expectedMtimeMs?: unknown;
  };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const section = typeof payload.section === 'string' ? payload.section : null;
  const date = typeof payload.date === 'string' ? payload.date : null;
  const learning = typeof payload.learning === 'string' ? payload.learning : null;

  if (section && !sectionSet.has(section)) {
    return NextResponse.json({ error: 'invalid section parameter' }, { status: 400 });
  }

  if (learning && !learningSet.has(learning)) {
    return NextResponse.json({ error: 'invalid learning parameter' }, { status: 400 });
  }

  if (typeof payload.content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const expectedMtimeMs =
    typeof payload.expectedMtimeMs === 'number' ? payload.expectedMtimeMs : payload.expectedMtimeMs == null ? null : Number.NaN;

  if (Number.isNaN(expectedMtimeMs)) {
    return NextResponse.json({ error: 'expectedMtimeMs must be a number or null' }, { status: 400 });
  }

  try {
    const data = await writeMemoryDocument({
      section,
      date,
      learning,
      content: payload.content,
      expectedMtimeMs,
    });

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'CONFLICT') {
      return NextResponse.json({ error: 'memory document changed on disk since it was loaded; reload before saving' }, { status: 409 });
    }

    if (message === 'UNSUPPORTED') {
      return NextResponse.json({ error: 'target memory path is not a writable file' }, { status: 400 });
    }

    return NextResponse.json({ error: 'failed to write memory document' }, { status: 500 });
  }
}
