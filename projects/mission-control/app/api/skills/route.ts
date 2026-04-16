import { NextResponse } from 'next/server';
import { getSkillsSummary } from '@/lib/adapters/skills';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const refresh = new URL(request.url).searchParams.get('refresh');
  const data = await getSkillsSummary({ preferFresh: refresh === '1' || refresh === 'true' });
  return NextResponse.json(data);
}
