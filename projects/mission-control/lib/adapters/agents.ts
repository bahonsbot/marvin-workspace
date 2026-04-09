import { cache } from 'react';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getAgentIssueStateMap } from '@/lib/adapters/agent-issues';
import { getOrchestratorIntegrationSummary } from '@/lib/adapters/orchestrator';
import { getSessions } from '@/lib/adapters/sessions';
import {
  AGENT_DEFINITIONS,
  AGENT_SECTION_META,
  type AgentAction,
  type AgentAlert,
  type AgentDefinition,
  type AgentHealthStatus,
  type AgentIssueState,
  type AgentMemberDefinition,
  type AgentMemberState,
  type AgentReadinessState,
  type AgentsPageData,
  type AgentSessionSignal,
  type AgentUnitPayload,
  type QuietSessionPayload,
  type SessionMatchHint,
} from '@/lib/agents/definitions';

type Session = Awaited<ReturnType<typeof getSessions>>['sessions'][number];
type ControlPath = Awaited<ReturnType<typeof getOrchestratorIntegrationSummary>>['controlPath'];
type ArtifactFile = {
  path: string;
  label: string;
  lastModifiedAt: string;
  ageMs: number;
};
type WorkspaceStatus = {
  exists: boolean;
  missingFiles: string[];
  readiness: AgentReadinessState;
  artifactDirectoryPath?: string;
  latestArtifact: ArtifactFile | null;
  realArtifactCount: number;
};
type VerificationState = 'verified' | 'awaiting-first-output' | 'missing-after-activity' | 'unavailable';
type SessionMatchTier = 'exact' | 'marker' | 'role' | 'reviewer-like' | 'keyword';
type SessionMatch = {
  session: Session;
  tier: SessionMatchTier;
  rank: number;
  detail: string;
};

const RECENTLY_ACTIVE_MS = 6 * 60 * 60 * 1000;
const WORKSPACE_ROOT = process.env.OPENCLAW_WORKSPACE_ROOT ?? '/data/.openclaw/workspace';
const DEFAULT_IGNORED_ARTIFACT_FILES = new Set(['README.md', '.gitkeep', '.keep']);
const MATCH_TIER_RANK: Record<SessionMatchTier, number> = {
  exact: 1,
  marker: 2,
  role: 3,
  'reviewer-like': 4,
  keyword: 5,
};

function formatExpectedOutputs(outputs: string[]) {
  if (outputs.length === 0) return 'verified output';
  if (outputs.length === 1) return outputs[0];
  if (outputs.length === 2) return `${outputs[0]} or ${outputs[1]}`;
  return `${outputs.slice(0, -1).join(', ')}, or ${outputs[outputs.length - 1]}`;
}

function expectedOutputSentence(definition: AgentDefinition) {
  return formatExpectedOutputs(definition.expectedOutputs ?? []);
}

function sessionText(session: Session) {
  return `${session.rawKey ?? ''} ${session.label ?? ''} ${session.model ?? ''}`.toLowerCase();
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokenize(value?: string | null) {
  const normalized = normalizeToken(value ?? '');
  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
}

function containsTokenSequence(haystack: string[], needle: string[]) {
  if (needle.length === 0 || haystack.length < needle.length) return false;

  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    let matches = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }

  return false;
}

function sessionMatcherContext(session: Session) {
  const rawKeyTokens = tokenize(session.rawKey);
  const labelTokens = tokenize(session.label);
  const modelTokens = tokenize(session.model);

  return {
    rawKey: (session.rawKey ?? '').toLowerCase(),
    rawKeyTokens,
    labelTokens,
    allTokens: [...rawKeyTokens, ...labelTokens],
    modelTokens,
  };
}

function isReviewerLike(session: Session) {
  const context = sessionMatcherContext(session);
  const hasSubagentMarker = context.rawKeyTokens.includes('subagent');
  const hasReviewerToken =
    containsTokenSequence(context.allTokens, ['reviewer']) ||
    containsTokenSequence(context.allTokens, ['review']) ||
    containsTokenSequence(context.allTokens, ['qa', 'review']);
  const hasQaOrTestToken =
    containsTokenSequence(context.allTokens, ['qa']) ||
    containsTokenSequence(context.allTokens, ['test']) ||
    containsTokenSequence(context.allTokens, ['tester']) ||
    containsTokenSequence(context.allTokens, ['testing']);
  const modelSignalsReviewer = context.modelTokens.includes('qwen');

  return hasReviewerToken && (hasSubagentMarker || hasQaOrTestToken || modelSignalsReviewer);
}

function matchDetail(mode: SessionMatchTier, value?: string) {
  if (mode === 'exact') return `Matched by exact session key${value ? ` "${value}"` : ''}`;
  if (mode === 'marker') return `Matched by explicit seat marker${value ? ` "${value}"` : ''}`;
  if (mode === 'role') return `Matched by role marker${value ? ` "${value}"` : ''}`;
  if (mode === 'reviewer-like') return 'Matched by narrow reviewer fallback';
  return `Matched by bounded fallback keyword${value ? ` "${value}"` : ''}`;
}

function matchSessionHint(session: Session, matcher: SessionMatchHint): SessionMatch | null {
  const context = sessionMatcherContext(session);
  const needle = tokenize(matcher.value);

  if (matcher.mode === 'reviewer-like') {
    if (!isReviewerLike(session)) return null;
    return {
      session,
      tier: 'reviewer-like',
      rank: MATCH_TIER_RANK['reviewer-like'],
      detail: matchDetail('reviewer-like'),
    };
  }

  if (matcher.mode === 'exact') {
    if (!matcher.value || context.rawKey !== matcher.value.toLowerCase()) return null;
    return {
      session,
      tier: 'exact',
      rank: MATCH_TIER_RANK.exact,
      detail: matchDetail('exact', matcher.value),
    };
  }

  if (needle.length === 0) return null;

  const matchesMarker =
    containsTokenSequence(context.rawKeyTokens, needle) || containsTokenSequence(context.labelTokens, needle);
  const matchesRole = matchesMarker;
  const matchesKeyword = containsTokenSequence(context.allTokens, needle);

  if (matcher.mode === 'marker' && matchesMarker) {
    return {
      session,
      tier: 'marker',
      rank: MATCH_TIER_RANK.marker,
      detail: matchDetail('marker', matcher.value),
    };
  }

  if (matcher.mode === 'role' && matchesRole) {
    return {
      session,
      tier: 'role',
      rank: MATCH_TIER_RANK.role,
      detail: matchDetail('role', matcher.value),
    };
  }

  if (matcher.mode === 'keyword' && matchesKeyword) {
    return {
      session,
      tier: 'keyword',
      rank: MATCH_TIER_RANK.keyword,
      detail: matchDetail('keyword', matcher.value),
    };
  }

  return null;
}

function bestSessionMatch(session: Session, definition: AgentDefinition | AgentMemberDefinition): SessionMatch | null {
  const matches = (definition.matchers ?? [])
    .map((matcher) => matchSessionHint(session, matcher))
    .filter((value): value is SessionMatch => Boolean(value))
    .sort((left, right) => left.rank - right.rank || left.detail.localeCompare(right.detail));

  return matches[0] ?? null;
}

function matchedSessionsForDefinition(sessions: Session[], definition: AgentDefinition | AgentMemberDefinition): SessionMatch[] {
  const matches = sessions
    .map((session) => bestSessionMatch(session, definition))
    .filter((value): value is SessionMatch => Boolean(value));

  if (matches.length === 0) return [];

  const strongestRank = Math.min(...matches.map((match) => match.rank));
  return matches
    .filter((match) => match.rank === strongestRank)
    .sort((left, right) => (left.session.ageMs ?? Number.MAX_SAFE_INTEGER) - (right.session.ageMs ?? Number.MAX_SAFE_INTEGER));
}

function quietInternalSession(session: Session) {
  const text = sessionText(session);
  return (
    text.includes(':cron:') ||
    text.startsWith('cron:') ||
    text.includes('heartbeat') ||
    text.includes('system') ||
    text.includes('helper') ||
    text.includes(':subagent:')
  );
}

function toSignal(match: SessionMatch): AgentSessionSignal {
  const session = match.session;
  return {
    id: session.id,
    label: session.label,
    state: session.state,
    kind: session.kind,
    model: session.model ?? null,
    lastActiveAt: session.lastActiveAt ?? null,
    ageMs: session.ageMs ?? null,
    matchReason: match.detail,
  };
}

function formatTimestamp(value?: string | null) {
  if (!value) return 'No recent signal';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

function formatAge(ageMs?: number | null) {
  if (ageMs === null || ageMs === undefined || Number.isNaN(ageMs)) return 'No timestamp';
  const minutes = Math.round(ageMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function deriveSessionHealth(session: Session | null): AgentHealthStatus {
  if (!session) return 'staged';
  if (session.state === 'running') return 'active';
  if (session.state === 'unknown') return 'attention';
  if ((session.ageMs ?? Number.MAX_SAFE_INTEGER) <= RECENTLY_ACTIVE_MS) return 'ready';
  return 'quiet';
}

async function pathExists(absolutePath: string) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function collectArtifacts(absoluteDir: string, relativeDir: string, ignoredFiles: Set<string>): Promise<ArtifactFile[]> {
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  const files: ArtifactFile[] = [];

  for (const entry of entries) {
    const absoluteChild = path.join(absoluteDir, entry.name);
    const relativeChild = `${relativeDir}/${entry.name}`.replace(/\\/g, '/');

    if (entry.isDirectory()) {
      files.push(...(await collectArtifacts(absoluteChild, relativeChild, ignoredFiles)));
      continue;
    }

    if (!entry.isFile()) continue;
    if (ignoredFiles.has(entry.name)) continue;

    const stat = await fs.stat(absoluteChild);
    files.push({
      path: relativeChild,
      label: entry.name,
      lastModifiedAt: stat.mtime.toISOString(),
      ageMs: Date.now() - stat.mtime.getTime(),
    });
  }

  return files.sort((left, right) => new Date(right.lastModifiedAt).getTime() - new Date(left.lastModifiedAt).getTime());
}

async function inspectWorkspace(definition: AgentDefinition): Promise<WorkspaceStatus> {
  if (!definition.workspace) {
    return {
      exists: false,
      missingFiles: [],
      readiness: definition.workspaceReadiness,
      artifactDirectoryPath: undefined,
      latestArtifact: null,
      realArtifactCount: 0,
    };
  }

  const workspaceAbsolute = path.join(WORKSPACE_ROOT, definition.workspace.path);
  const artifactDirectoryPath = `${definition.workspace.path}/${definition.workspace.artifactDir}`.replace(/\\/g, '/');

  try {
    const stat = await fs.stat(workspaceAbsolute);
    if (!stat.isDirectory()) {
      return {
        exists: false,
        missingFiles: [],
        readiness: 'staged',
        artifactDirectoryPath,
        latestArtifact: null,
        realArtifactCount: 0,
      };
    }
  } catch {
    return {
      exists: false,
      missingFiles: [],
      readiness: 'staged',
      artifactDirectoryPath,
      latestArtifact: null,
      realArtifactCount: 0,
    };
  }

  const checks = await Promise.all(
    definition.workspace.starterFiles.map(async (file) => {
      const exists = await pathExists(path.join(workspaceAbsolute, file));
      return exists ? null : file;
    }),
  );

  const missingFiles = checks.filter((value): value is string => Boolean(value));
  const readiness = missingFiles.length === 0 ? 'ready' : 'partial';

  const ignoredFiles = new Set([...(definition.workspace.ignoredArtifactFiles ?? []), ...DEFAULT_IGNORED_ARTIFACT_FILES]);
  const artifactAbsolute = path.join(workspaceAbsolute, definition.workspace.artifactDir);

  let artifacts: ArtifactFile[] = [];
  try {
    const artifactStat = await fs.stat(artifactAbsolute);
    if (artifactStat.isDirectory()) {
      artifacts = await collectArtifacts(artifactAbsolute, artifactDirectoryPath, ignoredFiles);
    }
  } catch {
    artifacts = [];
  }

  return {
    exists: true,
    missingFiles,
    readiness,
    artifactDirectoryPath,
    latestArtifact: artifacts[0] ?? null,
    realArtifactCount: artifacts.length,
  };
}

function mergeHealth(a: AgentHealthStatus, b: AgentHealthStatus): AgentHealthStatus {
  const rank: Record<AgentHealthStatus, number> = {
    active: 5,
    ready: 4,
    quiet: 3,
    attention: 2,
    staged: 1,
  };
  return rank[a] >= rank[b] ? a : b;
}

function deriveVerificationState(workspaceStatus: WorkspaceStatus, sessions: Session[]): VerificationState {
  if (!workspaceStatus.artifactDirectoryPath) return 'unavailable';
  if (workspaceStatus.latestArtifact) return 'verified';

  const recentFinishedActivity = sessions.some(
    (session) => session.state !== 'running' && (session.ageMs ?? Number.MAX_SAFE_INTEGER) <= RECENTLY_ACTIVE_MS,
  );

  return recentFinishedActivity ? 'missing-after-activity' : 'awaiting-first-output';
}

function healthLabel(
  status: AgentHealthStatus,
  workspaceReadiness: AgentReadinessState,
  matchedCount: number,
  verificationState: VerificationState,
) {
  if (workspaceReadiness === 'partial') return 'Workspace incomplete';
  if (verificationState === 'missing-after-activity') return 'Missing output after recent activity';
  if (status === 'active') return matchedCount > 1 ? 'Live signals present' : 'Live now';
  if (verificationState === 'verified' && matchedCount === 0) return 'Verified output on file';
  if (status === 'ready') return matchedCount > 0 ? 'Runtime seen recently' : 'Ready through Marvin';
  if (status === 'quiet') return verificationState === 'verified' ? 'Verified output on file' : 'Present but quiet';
  if (verificationState === 'awaiting-first-output' && workspaceReadiness !== 'staged') return 'Awaiting first verified output';
  if (status === 'attention') return 'Signal needs verification';
  if (workspaceReadiness === 'staged') return 'Staged capability';
  return 'No current session evidence';
}

function readinessLabel(state: AgentReadinessState) {
  if (state === 'ready') return 'Ready now';
  if (state === 'partial') return 'Partial';
  if (state === 'marvin-routed') return 'Via Marvin for now';
  if (state === 'internal-only') return 'Internal-only';
  return 'Staged';
}

function verificationActions(definition: AgentDefinition, workspaceStatus: WorkspaceStatus): AgentAction[] {
  if (!definition.workspace || !workspaceStatus.latestArtifact) return [];

  return [
    {
      id: `${definition.id}.latest-artifact`,
      label: 'Open latest artifact',
      availability: 'live',
      href: `/general/files?path=${encodeURIComponent(workspaceStatus.artifactDirectoryPath ?? definition.workspace.path)}&file=${encodeURIComponent(workspaceStatus.latestArtifact.path)}#file-preview`,
    },
  ];
}

function workspaceActions(definition: AgentDefinition, workspaceStatus: WorkspaceStatus): AgentAction[] {
  if (!definition.workspace || !workspaceStatus.exists) return [];

  return [
    {
      id: `${definition.id}.workspace`,
      label: 'Open workspace',
      availability: 'live',
      href: `/general/files?path=${encodeURIComponent(definition.workspace.path)}`,
    },
    {
      id: `${definition.id}.memory`,
      label: definition.workspace.memoryFile.endsWith('MEMORY.md') ? 'Open MEMORY.md' : 'Open memory context',
      availability: 'live',
      href: `/general/files?path=${encodeURIComponent(definition.workspace.path)}&file=${encodeURIComponent(definition.workspace.memoryFile)}#file-preview`,
    },
  ];
}

function selectAlertActions(actions: AgentAction[], suffixes: string[]) {
  const selected: AgentAction[] = [];
  const seen = new Set<string>();

  for (const suffix of suffixes) {
    const match = actions.find(
      (action) => action.id.endsWith(`.${suffix}`) && action.availability === 'live' && action.href && !seen.has(action.id),
    );
    if (!match) continue;
    seen.add(match.id);
    selected.push(match);
  }

  return selected;
}

function buildActions(definition: AgentDefinition, controlPath: ControlPath, workspaceStatus: WorkspaceStatus): AgentAction[] {
  const workspaceLinks = [...workspaceActions(definition, workspaceStatus), ...verificationActions(definition, workspaceStatus)];
  const activationHref = definition.activation ? `/general/chat?seat=${encodeURIComponent(definition.seatSlug)}` : '/general/chat';

  if (definition.actionMode === 'control') {
    return [
      { id: `${definition.id}.chat`, label: 'Open chat', availability: 'live', href: activationHref },
      ...workspaceLinks,
      controlPath.href
        ? { id: `${definition.id}.control`, label: 'Open Control UI', availability: 'live', href: controlPath.href, external: true }
        : {
            id: `${definition.id}.control`,
            label: 'Control UI unavailable',
            availability: 'unavailable',
            note: 'No browser-reachable control surface was exposed by the runtime adapter.',
          },
    ];
  }

  if (definition.actionMode === 'internal') {
    return [
      { id: `${definition.id}.chat`, label: 'Open in chat seat', availability: 'live', href: activationHref },
      ...workspaceLinks,
      controlPath.href
        ? { id: `${definition.id}.control`, label: 'Inspect in Control UI', availability: 'live', href: controlPath.href, external: true }
        : {
            id: `${definition.id}.control`,
            label: 'Internal seats only',
            availability: 'unavailable',
            note: 'These seats exist today, but they do not expose their own direct browser control path.',
          },
    ];
  }

  if (definition.actionMode === 'marvin-routed') {
    return [
      { id: `${definition.id}.chat`, label: 'Open in chat seat', availability: 'live', href: activationHref },
      ...workspaceLinks,
      {
        id: `${definition.id}.direct`,
        label: 'Direct seat staged',
        availability: 'staged',
        note: 'Dedicated routing is intentionally shown as staged until a real direct chat path exists.',
      },
    ];
  }

  return [
    ...workspaceLinks,
    {
      id: `${definition.id}.staged`,
      label: 'Capability staged',
      availability: 'staged',
      note: 'This seat is intentionally visible ahead of the underlying direct-runtime support.',
    },
  ];
}

function buildMemberState(member: AgentMemberDefinition, matches: SessionMatch[]): AgentMemberState {
  const match = matches[0] ?? null;
  const session = match?.session ?? null;
  const status = deriveSessionHealth(session);
  return {
    id: member.id,
    label: member.label,
    role: member.role,
    status,
    detail: session
      ? `${match?.detail ?? 'Matched session'} · ${session.label} · ${session.model ?? 'model unknown'} · ${formatAge(session.ageMs)}`
      : status === 'staged'
        ? 'Seat is defined, not routed directly yet.'
        : 'No current session evidence.',
  };
}

function workspaceEvidence(definition: AgentDefinition, workspaceStatus: WorkspaceStatus) {
  if (!definition.workspace) return null;
  if (!workspaceStatus.exists) {
    return {
      id: `${definition.id}.workspace`,
      label: 'Workspace missing',
      detail: `Expected at ${definition.workspace.path}, but the seeded workspace directory does not exist yet.`,
    };
  }
  if (workspaceStatus.missingFiles.length > 0) {
    return {
      id: `${definition.id}.workspace`,
      label: 'Workspace partial',
      detail: `Workspace exists at ${definition.workspace.path}, missing: ${workspaceStatus.missingFiles.join(', ')}.`,
    };
  }
  return {
    id: `${definition.id}.workspace`,
    label: 'Workspace ready',
    detail: `${definition.workspace.path} contains the seeded starter files for durable workspace work.`,
  };
}

function artifactEvidence(definition: AgentDefinition, workspaceStatus: WorkspaceStatus, verificationState: VerificationState) {
  if (!definition.workspace || !workspaceStatus.artifactDirectoryPath) return null;
  const expectedOutput = expectedOutputSentence(definition);

  if (verificationState === 'verified' && workspaceStatus.latestArtifact) {
    return {
      id: `${definition.id}.artifact`,
      label: 'Verified output on file',
      detail: `${workspaceStatus.latestArtifact.path} · ${formatTimestamp(workspaceStatus.latestArtifact.lastModifiedAt)} · ${formatAge(workspaceStatus.latestArtifact.ageMs)}.`,
    };
  }

  if (verificationState === 'missing-after-activity') {
    return {
      id: `${definition.id}.artifact`,
      label: 'Missing output after recent activity',
      detail: `Recent activity was seen, but no ${expectedOutput} has landed in ${workspaceStatus.artifactDirectoryPath}. Placeholder files are ignored.`,
    };
  }

  return {
    id: `${definition.id}.artifact`,
    label: 'Awaiting first verified output',
    detail: `Waiting for a first ${expectedOutput} in ${workspaceStatus.artifactDirectoryPath}. Placeholder files such as README.md and .gitkeep are ignored until a real delivery lands.`,
  };
}

function expectedOutputEvidence(definition: AgentDefinition) {
  if (!definition.expectedOutputs || definition.expectedOutputs.length === 0) return null;
  return {
    id: `${definition.id}.expected-output`,
    label: 'Expected output',
    detail: `This seat is currently expected to leave behind a ${expectedOutputSentence(definition)}.`,
  };
}

function buildUnitAlerts(
  definition: AgentDefinition,
  sessions: Session[],
  workspaceStatus: WorkspaceStatus,
  verificationState: VerificationState,
  actions: AgentAction[],
  issueStates: Record<string, { state: Extract<AgentIssueState, 'acknowledged'>; acknowledgedAt: string; updatedAt: string }>,
): AgentAlert[] {
  const alerts: AgentAlert[] = [];

  function applyIssueState(alert: Omit<AgentAlert, 'state' | 'acknowledgedAt'>): AgentAlert {
    const persisted = issueStates[alert.id];
    return {
      ...alert,
      state: persisted?.state ?? 'active',
      acknowledgedAt: persisted?.acknowledgedAt ?? null,
    };
  }

  if (definition.workspace && workspaceStatus.exists && workspaceStatus.missingFiles.length > 0) {
    alerts.push(applyIssueState({
      id: `${definition.id}.alert.workspace-partial`,
      unitId: definition.id,
      unitLabel: definition.label,
      title: 'Workspace partial',
      detail: `Missing starter files: ${workspaceStatus.missingFiles.join(', ')}.`,
      severity: 'warning',
      actions: selectAlertActions(actions, ['workspace', 'memory']),
    }));
  }

  if (verificationState === 'missing-after-activity') {
    const expectedOutput = expectedOutputSentence(definition);
    alerts.push(applyIssueState({
      id: `${definition.id}.alert.missing-output`,
      unitId: definition.id,
      unitLabel: definition.label,
      title: 'Missing output after recent activity',
      detail: `Recent activity was seen, but no ${expectedOutput} has landed yet. Next step: inspect the workspace context, then route through Marvin if follow-through is needed.`,
      severity: 'attention',
      actions: selectAlertActions(actions, ['workspace', 'memory', 'chat', 'control']),
    }));
  }

  const unknownSession = sessions.find((session) => session.state === 'unknown');
  if (unknownSession) {
    alerts.push(applyIssueState({
      id: `${definition.id}.alert.signal-verification`,
      unitId: definition.id,
      unitLabel: definition.label,
      title: 'Runtime signal needs verification',
      detail: `${unknownSession.label} last reported an unknown session state. Next step: verify the runtime path, then compare against the latest seat context.`,
      severity: 'warning',
      actions: selectAlertActions(actions, ['chat', 'control', 'workspace', 'latest-artifact']),
    }));
  }

  return alerts;
}

function buildUnitPayload(
  definition: AgentDefinition,
  matches: SessionMatch[],
  allSessions: Session[],
  controlPath: ControlPath,
  workspaceStatus: WorkspaceStatus,
  issueStates: Record<string, { state: Extract<AgentIssueState, 'acknowledged'>; acknowledgedAt: string; updatedAt: string }>,
): AgentUnitPayload {
  const sessions = matches.map((match) => match.session);
  const memberMatches = (definition.members ?? []).map((member) => ({
    member,
    matches: matchedSessionsForDefinition(allSessions, member),
  }));
  const memberStates = memberMatches.map(({ member, matches: memberSessionMatches }) => buildMemberState(member, memberSessionMatches));
  const observedMatches = [
    ...matches,
    ...memberMatches.flatMap(({ matches: memberSessionMatches }) => memberSessionMatches),
  ].filter((match, index, list) => list.findIndex((candidate) => candidate.session.id === match.session.id) === index);
  const observedSessions = observedMatches.map((match) => match.session);

  const topSession = sessions[0] ?? null;
  const effectiveWorkspaceReadiness = definition.workspace ? workspaceStatus.readiness : definition.workspaceReadiness;
  const verificationState = deriveVerificationState(workspaceStatus, observedSessions);
  const actions = buildActions(definition, controlPath, workspaceStatus);
  const baseHealth = memberStates.reduce<AgentHealthStatus>(
    (current, member) => mergeHealth(current, member.status),
    deriveSessionHealth(topSession),
  );

  const status =
    effectiveWorkspaceReadiness === 'partial'
      ? 'attention'
      : verificationState === 'missing-after-activity'
        ? 'attention'
        : verificationState === 'verified' && baseHealth === 'staged'
          ? 'ready'
          : baseHealth === 'staged' && effectiveWorkspaceReadiness !== 'staged'
            ? 'quiet'
            : baseHealth;

  const evidenceSource = observedMatches.length > 0 ? observedMatches : matches;
  const evidence = evidenceSource.slice(0, 3).map((match) => ({
    id: match.session.id,
    label: match.session.label,
    detail: `${match.detail} · ${match.session.model ?? 'model unknown'} · ${formatTimestamp(match.session.lastActiveAt)} · ${formatAge(match.session.ageMs)}`,
  }));

  const workspaceSignal = workspaceEvidence(definition, workspaceStatus);
  if (workspaceSignal) evidence.unshift(workspaceSignal);

  const artifactSignal = artifactEvidence(definition, workspaceStatus, verificationState);
  if (artifactSignal) evidence.splice(workspaceSignal ? 1 : 0, 0, artifactSignal);

  const expectationSignal = expectedOutputEvidence(definition);
  if (expectationSignal) {
    evidence.push(expectationSignal);
  }

  if (evidence.length === 0) {
    evidence.push({
      id: `${definition.id}.readiness`,
      label: readinessLabel(effectiveWorkspaceReadiness),
      detail:
        effectiveWorkspaceReadiness === 'staged'
          ? 'This seat is intentionally visible before dedicated workspace/routing support is live.'
          : 'Real runtime support exists, but there is no matching session evidence right now.',
    });
  }

  const note =
    definition.kind === 'team'
      ? definition.chatReadiness === 'internal-only'
        ? 'Requests still enter through Marvin; these seats operate as internal support lanes.'
        : 'The team is represented now, while direct dedicated routing remains staged.'
      : definition.kind === 'specialist'
        ? definition.activation?.routing === 'direct'
          ? `Direct specialist seat is live in chat via ${definition.activation.targetSessionKey}.`
          : 'Seat is visible from the start, but direct specialist routing is staged until the runtime makes it truthful.'
        : 'This is the canonical control seat and should remain distinct from every other roster unit.';

  const alerts = buildUnitAlerts(definition, observedSessions, workspaceStatus, verificationState, actions, issueStates).sort((left, right) => {
    if (left.state !== right.state) return left.state === 'active' ? -1 : 1;
    if (left.severity !== right.severity) return left.severity === 'attention' ? -1 : 1;
    return left.title.localeCompare(right.title);
  });

  return {
    id: definition.id,
    kind: definition.kind,
    label: definition.label,
    role: definition.role,
    summary: definition.summary,
    workspaceReadiness: effectiveWorkspaceReadiness,
    chatReadiness: definition.chatReadiness,
    health: {
      status,
      label: healthLabel(status, effectiveWorkspaceReadiness, observedMatches.length, verificationState),
      evidence,
    },
    alerts,
    note,
    expectedOutputs: definition.expectedOutputs ?? [],
    actions,
    members: memberStates,
    sessions: observedMatches.map(toSignal),
  };
}

export const getAgentsPageData = cache(async function getAgentsPageData(): Promise<AgentsPageData> {
  const [sessionSummary, integration, issueStore] = await Promise.all([
    getSessions(),
    getOrchestratorIntegrationSummary(),
    getAgentIssueStateMap(),
  ]);
  const sessions = [...sessionSummary.sessions].sort((left, right) => (left.ageMs ?? Number.MAX_SAFE_INTEGER) - (right.ageMs ?? Number.MAX_SAFE_INTEGER));
  const matchedSessionIds = new Set<string>();

  const sections = (Object.entries(AGENT_SECTION_META) as Array<[
    keyof typeof AGENT_SECTION_META,
    (typeof AGENT_SECTION_META)[keyof typeof AGENT_SECTION_META],
  ]>).map(async ([sectionId, meta]) => {
    const items = await Promise.all(
      AGENT_DEFINITIONS.filter((definition) => definition.sectionId === sectionId).map(async (definition) => {
        const matchedSessions = matchedSessionsForDefinition(sessions, definition);
        matchedSessions.forEach((match) => matchedSessionIds.add(match.session.id));
        (definition.members ?? [])
          .flatMap((member) => matchedSessionsForDefinition(sessions, member))
          .forEach((match) => matchedSessionIds.add(match.session.id));
        const workspaceStatus = await inspectWorkspace(definition);
        return buildUnitPayload(definition, matchedSessions, sessions, integration.controlPath, workspaceStatus, issueStore.issues);
      }),
    );

    return {
      id: sectionId,
      title: meta.title,
      description: meta.description,
      items,
    };
  });
  const resolvedSections = await Promise.all(sections);
  const allUnits = resolvedSections.flatMap((section) => section.items);
  const pageAlerts = allUnits.filter((item) => item.id !== 'control.marvin').flatMap((item) => item.alerts);
  const activeAlerts = pageAlerts.filter((alert) => alert.state === 'active');
  const acknowledgedAlerts = pageAlerts.filter((alert) => alert.state === 'acknowledged');

  const hydratedSections = resolvedSections.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.id === 'control.marvin'
        ? {
            ...item,
            alerts: pageAlerts,
            oversight: {
              activeIssues: activeAlerts.length,
              acknowledgedIssues: acknowledgedAlerts.length,
              seatsNeedingAttention: new Set(pageAlerts.map((alert) => alert.unitId)).size,
              activeUnits: allUnits.filter((unit) => unit.health.status === 'active' || unit.health.status === 'ready').length,
              quietSessions: sessions.filter((session) => !matchedSessionIds.has(session.id)).filter((session) => quietInternalSession(session)).length,
            },
            health: {
              ...item.health,
              label:
                activeAlerts.length > 0
                  ? `Tracking ${activeAlerts.length} active issue${activeAlerts.length === 1 ? '' : 's'}`
                  : item.health.label,
            },
          }
        : item,
    ),
  }));

  const quietSessions: QuietSessionPayload[] = sessions
    .filter((session) => !matchedSessionIds.has(session.id))
    .filter((session) => quietInternalSession(session))
    .map((session) => ({
      id: session.id,
      label: session.label.replace(/^cron:/i, '').replace(/^subagent:/i, '').replace(/^main:/i, ''),
      state: session.state,
      kind: session.kind,
      model: session.model ?? null,
      lastActiveAt: session.lastActiveAt ?? null,
      ageMs: session.ageMs ?? null,
    }));

  return {
    summary: {
      controlLive: hydratedSections.find((section) => section.id === 'control')?.items.filter((item) => item.health.status === 'active').length ?? 0,
      activeUnits: allUnits.filter((item) => item.health.status === 'active' || item.health.status === 'ready').length,
      stagedSeats: allUnits.filter((item) => item.workspaceReadiness === 'staged' || item.workspaceReadiness === 'partial').length,
      quietSessions: quietSessions.length,
      activeIssues: activeAlerts.length,
      acknowledgedIssues: acknowledgedAlerts.length,
      seatsNeedingAttention: new Set(pageAlerts.map((alert) => alert.unitId)).size,
    },
    alerts: pageAlerts,
    sections: hydratedSections,
    quietSessions,
    refreshedAt: sessionSummary.refreshedAt,
  };
});
