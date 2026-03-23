import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const MANUAL_WATCH_PATH = '/data/.openclaw/workspace/projects/market-intel/data/manual_watch_candidates.json';

function generateId(symbol: string): string {
  const slug = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const timestamp = Date.now().toString(36);
  return `manual-watch-${slug}-${timestamp}`;
}

function normalizeConviction(value: unknown): 'low' | 'medium' | 'high' {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  if (raw === 'high') return 'high';
  if (raw === 'low') return 'low';
  return 'medium';
}

function parseTags(value: unknown): string[] {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
  }
  if (Array.isArray(value)) {
    return value
      .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
      .filter((t) => t.length > 0);
  }
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const symbol = typeof body.symbol === 'string' && body.symbol.trim().length > 0
      ? body.symbol.trim().toUpperCase()
      : null;

    const thesis = typeof body.thesis === 'string' && body.thesis.trim().length > 0
      ? body.thesis.trim()
      : null;

    if (!symbol || !thesis) {
      return NextResponse.json(
        { error: 'symbol and thesis are required' },
        { status: 400 }
      );
    }

    const raw = await fs.readFile(MANUAL_WATCH_PATH, 'utf8').catch(() => '[]');
    const items = JSON.parse(raw);

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'invalid data file' }, { status: 500 });
    }

    // Prevent exact duplicate symbols (case-insensitive)
    const duplicate = items.some(
      (item: Record<string, unknown>) =>
        typeof item.symbol === 'string' && item.symbol.toUpperCase() === symbol
    );
    if (duplicate) {
      return NextResponse.json({ error: `${symbol} is already in the watch list` }, { status: 409 });
    }

    const newItem: Record<string, unknown> = {
      id: generateId(symbol),
      symbol,
      thesis,
      company: typeof body.company === 'string' && body.company.trim()
        ? body.company.trim()
        : null,
      conviction: normalizeConviction(body.conviction),
      review_status: 'active',
      tags: parseTags(body.tags),
      notes: typeof body.notes === 'string' && body.notes.trim()
        ? body.notes.trim()
        : null,
      source_origin: 'manual',
      linked_theme: null,
      linked_chain_layer: null,
      linked_chain_sublayer: null,
      added_at: new Date().toISOString(),
    };

    items.push(newItem);

    // Sort newest first
    items.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const aTime = a.added_at ? new Date(a.added_at as string).getTime() : 0;
      const bTime = b.added_at ? new Date(b.added_at as string).getTime() : 0;
      return bTime - aTime;
    });

    const dir = path.dirname(MANUAL_WATCH_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(MANUAL_WATCH_PATH, JSON.stringify(items, null, 2), 'utf8');

    return NextResponse.json({ success: true, item: newItem }, { status: 201 });
  } catch (err) {
    console.error('[manual-watch POST]', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const raw = await fs.readFile(MANUAL_WATCH_PATH, 'utf8').catch(() => '[]');
    const items = JSON.parse(raw);
    return NextResponse.json(Array.isArray(items) ? items : []);
  } catch {
    return NextResponse.json([]);
  }
}
