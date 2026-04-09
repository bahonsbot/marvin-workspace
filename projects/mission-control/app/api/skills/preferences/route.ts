import { NextResponse } from 'next/server';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const STATE_PATH = path.join(process.cwd(), 'data', 'skills-ui-state.json');

type SkillsUiState = {
  hiddenSkills: string[];
  tagMap: Record<string, string[]>;
  updatedAt: string;
};

const DEFAULT_STATE: SkillsUiState = {
  hiddenSkills: [],
  tagMap: {},
  updatedAt: new Date(0).toISOString(),
};

function normalizeState(input: unknown): SkillsUiState {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const hiddenSkills = Array.isArray(record.hiddenSkills)
    ? Array.from(
        new Set(
          record.hiddenSkills
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter((value) => value.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b))
    : [];

  const rawTagMap = record.tagMap && typeof record.tagMap === 'object' ? (record.tagMap as Record<string, unknown>) : {};
  const tagMap: Record<string, string[]> = {};
  for (const [skillName, tags] of Object.entries(rawTagMap)) {
    if (typeof skillName !== 'string' || !skillName.trim() || !Array.isArray(tags)) continue;
    const normalized = Array.from(
      new Set(
        tags
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));
    if (normalized.length > 0) tagMap[skillName] = normalized;
  }

  return {
    hiddenSkills,
    tagMap,
    updatedAt: typeof record.updatedAt === 'string' && record.updatedAt ? record.updatedAt : new Date().toISOString(),
  };
}

async function readState(): Promise<SkillsUiState> {
  try {
    const raw = await readFile(STATE_PATH, 'utf8');
    return normalizeState(JSON.parse(raw));
  } catch {
    return DEFAULT_STATE;
  }
}

async function writeState(state: SkillsUiState): Promise<void> {
  await mkdir(path.dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export async function GET() {
  const state = await readState();
  return NextResponse.json(state);
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const normalized = normalizeState(payload);
  const nextState: SkillsUiState = {
    ...normalized,
    updatedAt: new Date().toISOString(),
  };

  await writeState(nextState);
  return NextResponse.json(nextState);
}
