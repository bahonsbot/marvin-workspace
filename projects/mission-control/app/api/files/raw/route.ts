import { promises as fs } from 'node:fs';
import { NextResponse } from 'next/server';
import { resolveRawFilePath } from '@/lib/adapters/files';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  const resolved = await resolveRawFilePath(path);
  if (!resolved.absolutePath) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const [stat, bytes] = await Promise.all([fs.stat(resolved.absolutePath), fs.readFile(resolved.absolutePath)]);
    if (!stat.isFile()) {
      return new NextResponse('Not found', { status: 404 });
    }

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': resolved.mimeType,
        'Cache-Control': 'private, max-age=120',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
