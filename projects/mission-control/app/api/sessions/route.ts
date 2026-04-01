import { NextResponse } from 'next/server';
import { getSessions } from '@/lib/adapters/sessions';

export async function GET() {
  const data = await getSessions();
  return NextResponse.json(data);
}
