import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const WORKSPACE_ROOT = process.env.OPENCLAW_WORKSPACE_ROOT ?? '/data/.openclaw/workspace';
const UPLOAD_ROOT = path.join(WORKSPACE_ROOT, 'uploads', 'mission-control');
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const BLOCKED_UPLOAD_EXTENSIONS = new Set([
  '.php',
  '.phtml',
  '.phar',
  '.cgi',
  '.pl',
  '.py',
  '.sh',
  '.bash',
  '.zsh',
  '.js',
  '.mjs',
  '.cjs',
  '.bat',
  '.cmd',
  '.com',
  '.exe',
  '.dll',
  '.msi',
  '.scr',
]);

function sanitizeFilename(name: string): string {
  const parsed = path.parse(name);
  const safeStem = (parsed.name || 'upload')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const safeExtension = parsed.ext.toLowerCase().replace(/[^a-z0-9.]+/g, '');
  return `${safeStem || 'upload'}${safeExtension}`;
}

function timestampPrefix(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const files = form.getAll('files').filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 });
    }

    await fs.mkdir(UPLOAD_ROOT, { recursive: true });

    const uploaded = [] as Array<{
      name: string;
      path: string;
      size: number;
      mimeType: string;
    }>;

    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `File too large: ${file.name}` }, { status: 413 });
      }

      const rawExtension = path.extname(file.name).toLowerCase();
      if (rawExtension && BLOCKED_UPLOAD_EXTENSIONS.has(rawExtension)) {
        return NextResponse.json({ error: `Blocked file type: ${file.name}` }, { status: 400 });
      }

      const safeName = sanitizeFilename(file.name);
      const finalName = `${timestampPrefix()}-${safeName}`;
      const absolutePath = path.join(UPLOAD_ROOT, finalName);
      const relativePath = path.relative(WORKSPACE_ROOT, absolutePath).replace(/\\/g, '/');
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(absolutePath, buffer);
      uploaded.push({
        name: file.name,
        path: relativePath,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
      });
    }

    return NextResponse.json({ uploaded });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
