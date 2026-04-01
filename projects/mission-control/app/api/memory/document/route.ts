import { NextResponse } from 'next/server';
import { getMemoryDocument } from '@/lib/adapters/memory';

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
