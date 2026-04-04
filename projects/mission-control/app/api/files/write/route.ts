import { NextResponse } from 'next/server';
import { writeFileContent } from '@/lib/adapters/files';

export async function PUT(request: Request) {
  let payload: { path?: unknown; content?: unknown; expectedMtimeMs?: unknown };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (typeof payload.path !== 'string' || typeof payload.content !== 'string') {
    return NextResponse.json({ error: 'path and content are required' }, { status: 400 });
  }

  const expectedMtimeMs =
    typeof payload.expectedMtimeMs === 'number' ? payload.expectedMtimeMs : payload.expectedMtimeMs == null ? null : Number.NaN;

  if (Number.isNaN(expectedMtimeMs)) {
    return NextResponse.json({ error: 'expectedMtimeMs must be a number or null' }, { status: 400 });
  }

  try {
    const data = await writeFileContent({
      requestedPath: payload.path,
      content: payload.content,
      expectedMtimeMs,
    });

    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'CONFLICT') {
      return NextResponse.json({ error: 'file changed on disk since it was loaded; reload before saving' }, { status: 409 });
    }

    if (message === 'OUT_OF_SCOPE') {
      return NextResponse.json({ error: 'file is outside the allowed writable scope' }, { status: 403 });
    }

    if (message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'file not found' }, { status: 404 });
    }

    if (message === 'UNSUPPORTED') {
      return NextResponse.json({ error: 'only text files can be edited here' }, { status: 400 });
    }

    return NextResponse.json({ error: 'failed to write file' }, { status: 500 });
  }
}
