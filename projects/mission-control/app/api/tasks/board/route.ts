import { NextResponse } from 'next/server';
import { getTaskBoard } from '@/lib/adapters/tasks';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const data = await getTaskBoard();
  return NextResponse.json(data);
}
