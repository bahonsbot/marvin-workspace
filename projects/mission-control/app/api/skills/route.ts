import { NextResponse } from 'next/server';
import { getSkillsSummary } from '@/lib/adapters/skills';

export async function GET() {
  const data = await getSkillsSummary();
  return NextResponse.json(data);
}
