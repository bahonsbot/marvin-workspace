import 'server-only';

import { promises as fs } from 'node:fs';
import type { IntegrationStatus, SkillSummary, SkillsSummary } from '@/lib/types/contracts';
import { runShellCommand } from '@/lib/adapters/runtime';

const SKILLS_TIMEOUT_MS = 45000;
const SKILLS_CACHE_PATH = '/data/.openclaw/workspace/projects/mission-control/data/skills-summary-cache.json';

let skillsMemoryCache: { data: SkillsSummary; cachedAtMs: number } | null = null;
let skillsRefreshPromise: Promise<SkillsSummary> | null = null;

type RawSkill = {
  name?: string;
  description?: string;
  emoji?: string;
  eligible?: boolean;
  disabled?: boolean;
  blockedByAllowlist?: boolean;
  source?: string;
  bundled?: boolean;
  homepage?: string;
  missing?: {
    bins?: string[];
    anyBins?: string[];
    env?: string[];
    config?: string[];
    os?: string[];
  };
};

type RawSkillsOutput = {
  workspaceDir?: string;
  managedSkillsDir?: string;
  skills?: RawSkill[];
};

function extractJsonPayload(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error('openclaw skills list returned empty output');

  try {
    return JSON.parse(trimmed);
  } catch {
    // tolerate warnings before JSON payload
  }

  for (let index = 0; index < trimmed.length; index += 1) {
    const ch = trimmed[index];
    if (ch !== '{' && ch !== '[') continue;
    try {
      return JSON.parse(trimmed.slice(index));
    } catch {
      // keep scanning
    }
  }

  throw new Error('Failed to parse openclaw skills output as JSON');
}

function parseSkillsOutput(stdout: string): RawSkillsOutput {
  const parsed = extractJsonPayload(stdout);

  if (Array.isArray(parsed)) {
    return { skills: parsed as RawSkill[] };
  }

  if (parsed && typeof parsed === 'object') {
    return parsed as RawSkillsOutput;
  }

  throw new Error('Invalid skills payload');
}

function normalizeSource(rawSource: string | undefined, bundled: boolean | undefined): SkillSummary['source'] {
  const value = (rawSource ?? '').toLowerCase();
  if (bundled || value.includes('bundled')) return 'bundled';
  if (value.includes('clawhub')) return 'clawhub';
  if (value.includes('workspace')) return 'workspace';
  return 'other';
}

function sourceLabel(source: SkillSummary['source']): string {
  if (source === 'bundled') return 'Bundled';
  if (source === 'workspace') return 'Workspace';
  if (source === 'clawhub') return 'ClawHub';
  return 'Other';
}

function countMissing(skill: RawSkill): number {
  const missing = skill.missing;
  if (!missing) return 0;
  return [missing.bins, missing.anyBins, missing.env, missing.config, missing.os].reduce((sum, items) => sum + (items?.length ?? 0), 0);
}

async function readSkillsCache(): Promise<SkillsSummary | null> {
  try {
    const raw = await fs.readFile(SKILLS_CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as SkillsSummary;
    if (!parsed || !Array.isArray(parsed.skills) || !parsed.counts) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeSkillsCache(summary: SkillsSummary): Promise<void> {
  try {
    await fs.writeFile(SKILLS_CACHE_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  } catch (error) {
    console.warn('[skills-adapter] Failed to persist skills cache', error instanceof Error ? error.message : error);
  }
}

function primeSkillsMemoryCache(summary: SkillsSummary): SkillsSummary {
  skillsMemoryCache = {
    data: summary,
    cachedAtMs: Date.now(),
  };
  return summary;
}

async function fetchSkillsSummaryLive(): Promise<SkillsSummary> {
  try {
    const { stdout, stderr } = await runShellCommand('openclaw skills list --json', SKILLS_TIMEOUT_MS, 2 * 1024 * 1024);

    const output = stdout.trim() ? stdout : stderr;
    const parsed = parseSkillsOutput(output);
    const skills = (parsed.skills ?? []).map((skill): SkillSummary => {
      const source = normalizeSource(skill.source, skill.bundled);
      const missingCount = countMissing(skill);
      const eligible = Boolean(skill.eligible);
      const disabled = Boolean(skill.disabled);
      const blockedByAllowlist = Boolean(skill.blockedByAllowlist);
      const needsAttention = !eligible || disabled || blockedByAllowlist || missingCount > 0;

      return {
        name: skill.name ?? 'Unnamed skill',
        description: skill.description ?? '',
        emoji: skill.emoji ?? null,
        eligible,
        disabled,
        blockedByAllowlist,
        source,
        sourceLabel: sourceLabel(source),
        rawSource: skill.source ?? null,
        bundled: Boolean(skill.bundled),
        homepage: skill.homepage ?? null,
        missing: {
          bins: skill.missing?.bins ?? [],
          anyBins: skill.missing?.anyBins ?? [],
          env: skill.missing?.env ?? [],
          config: skill.missing?.config ?? [],
          os: skill.missing?.os ?? [],
        },
        missingCount,
        needsAttention,
      };
    });

    const counts = {
      total: skills.length,
      active: skills.filter((skill) => skill.eligible && !skill.disabled && !skill.blockedByAllowlist).length,
      unavailable: skills.filter((skill) => !skill.eligible).length,
      needsAttention: skills.filter((skill) => skill.needsAttention).length,
      bundled: skills.filter((skill) => skill.source === 'bundled').length,
      workspace: skills.filter((skill) => skill.source === 'workspace').length,
      clawhub: skills.filter((skill) => skill.source === 'clawhub').length,
      other: skills.filter((skill) => skill.source === 'other').length,
    };

    return {
      status: 'adapter-backed' as IntegrationStatus,
      workspaceDir: parsed.workspaceDir ?? '/data/.openclaw/workspace',
      managedSkillsDir: parsed.managedSkillsDir ?? null,
      skills: skills.sort((a, b) => {
        if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
        if (a.source !== b.source) return a.source.localeCompare(b.source);
        return a.name.localeCompare(b.name);
      }),
      counts,
      refreshedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[skills-adapter] Failed to load skills', error instanceof Error ? error.message : error);
    return {
      status: 'partial',
      workspaceDir: '/data/.openclaw/workspace',
      managedSkillsDir: null,
      skills: [],
      counts: {
        total: 0,
        active: 0,
        unavailable: 0,
        needsAttention: 0,
        bundled: 0,
        workspace: 0,
        clawhub: 0,
        other: 0,
      },
      error: error instanceof Error ? error.message : 'Failed to load skills',
      refreshedAt: new Date().toISOString(),
    };
  }
}

export async function getSkillsSummary(options?: { preferFresh?: boolean }): Promise<SkillsSummary> {
  const preferFresh = options?.preferFresh === true;

  if (!preferFresh && skillsMemoryCache) {
    return skillsMemoryCache.data;
  }

  if (!preferFresh) {
    const cached = await readSkillsCache();
    if (cached) return primeSkillsMemoryCache(cached);
  }

  if (!skillsRefreshPromise) {
    skillsRefreshPromise = (async () => {
      const live = await fetchSkillsSummaryLive();
      if (live.status === 'adapter-backed' && live.skills.length > 0) {
        await writeSkillsCache(live);
        return primeSkillsMemoryCache(live);
      }

      const cached = await readSkillsCache();
      if (cached) return primeSkillsMemoryCache(cached);

      return primeSkillsMemoryCache(live);
    })().finally(() => {
      skillsRefreshPromise = null;
    });
  }

  return skillsRefreshPromise;
}
