import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AgentSeatModelAlias } from '@/lib/agents/definitions';

const STORE_PATH = path.join(process.cwd(), 'data', 'sudo-delegations.json');
const MAX_RUNS = 24;

export type SudoLaneSlug = 'frontend' | 'backend' | 'qa';
export type SudoDelegationStatus = 'queued' | 'running' | 'done' | 'error';
export type SudoOrchestrationStatus = 'queued' | 'running' | 'waiting' | 'done' | 'error';
export type SudoDecisionMode = 'direct_answer' | 'ask_question' | 'propose_alternative' | 'delegate';
export type SudoOversightLevel = 'informative' | 'approval' | 'blocker';
export type SudoOversightReason = 'risk' | 'ambiguity' | 'conflict' | 'blocked' | 'tradeoff' | 'uncertainty';
export type SudoLanePlanStep = {
  lane: SudoLaneSlug;
  order: number;
  purpose: string;
  expectedOutput: string;
  validationFocus?: string;
};

export type SudoOversightState = {
  oversightNeeded: boolean;
  oversightLevel?: SudoOversightLevel;
  oversightReason?: SudoOversightReason;
  approvalNeeded: boolean;
  recommendedDecision?: string;
  blockedBy: string[];
  conflictSummary?: string;
  nextHumanDecision?: string;
  marvinSummary?: string;
  safeToAutoContinue: boolean;
};

export type SudoDelegationLane = {
  slug: SudoLaneSlug;
  seatLabel: string;
  role: string;
  defaultModel: AgentSeatModelAlias;
  defaultThinking: 'low' | 'medium' | 'high' | 'xhigh';
  executionNote: string;
};

export type SudoDelegatedRun = {
  id: string;
  delegatedBy: 'Sudo';
  orchestrationId?: string;
  orchestrationSequence?: number;
  sourceSeatSlug: 'dev-team';
  sourceSessionKey: string;
  sourceSessionLabel: string;
  sourceRuntimeNote: string;
  lane: SudoDelegationLane;
  requestedPrompt: string;
  promptSummary: string;
  status: SudoDelegationStatus;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  childSessionKey?: string;
  runId?: string;
  resultSummary?: string;
  error?: string;
};

export type SudoOrchestrationDecision = {
  mode: SudoDecisionMode;
  lanePlan: SudoLaneSlug[];
  lanePlanSteps: SudoLanePlanStep[];
  rationale: string;
  orderRationale?: string;
  expectedOutputs: string[];
  validationIntent?: string;
  completionCriteria?: string;
  question?: string;
  suggestion?: string;
  directAnswer?: string;
  oversight: SudoOversightState;
};

export type SudoOrchestrationSynthesis = {
  summary: string;
  decided: string;
  lanesRun: SudoLaneSlug[];
  changesOrFindings: string[];
  blockers: string[];
  unresolvedIssues: string[];
  completedAt: string;
  oversight: SudoOversightState;
};

export type SudoOrchestrationArtifact = {
  path: string;
  label?: string;
  kind?: 'file' | 'dir' | 'url' | 'log';
};

export type SudoOrchestrationRun = {
  id: string;
  delegatedBy: 'Sudo';
  sourceSeatSlug: 'dev-team';
  sourceSessionKey: string;
  sourceSessionLabel: string;
  sourceRuntimeNote: string;
  requestedPrompt: string;
  promptSummary: string;
  linkedTaskId?: string;
  status: SudoOrchestrationStatus;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  decision?: SudoOrchestrationDecision;
  synthesis?: SudoOrchestrationSynthesis;
  artifacts?: SudoOrchestrationArtifact[];
  decisionSessionKey?: string;
  decisionRunId?: string;
  childRunIds: string[];
  waitingForPhilippe: boolean;
  oversight: SudoOversightState;
  error?: string;
};

type SudoDelegationStore = {
  orchestrations: SudoOrchestrationRun[];
  runs: SudoDelegatedRun[];
  meta: {
    schemaVersion: 4;
    updatedAt: string;
  };
};

export const SUDO_DELEGATION_LANES: SudoDelegationLane[] = [
  {
    slug: 'frontend',
    seatLabel: 'Frontend Developer',
    role: 'UI implementation lane',
    defaultModel: 'codex',
    defaultThinking: 'medium',
    executionNote: 'Real child run spawned under the main OpenClaw agent/runtime.',
  },
  {
    slug: 'backend',
    seatLabel: 'Backend Developer',
    role: 'API and server implementation lane',
    defaultModel: 'codex',
    defaultThinking: 'medium',
    executionNote: 'Real child run spawned under the main OpenClaw agent/runtime.',
  },
  {
    slug: 'qa',
    seatLabel: 'QA Engineer',
    role: 'Verification and regression lane',
    defaultModel: 'minimax2.7',
    defaultThinking: 'low',
    executionNote: 'Real child run spawned under the main OpenClaw agent/runtime.',
  },
];

function nowIso() {
  return new Date().toISOString();
}

function emptyStore(): SudoDelegationStore {
  return {
    orchestrations: [],
    runs: [],
    meta: {
      schemaVersion: 4,
      updatedAt: nowIso(),
    },
  };
}

function summarizePrompt(value: string) {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (clean.length <= 180) return clean;
  return `${clean.slice(0, 177).trimEnd()}...`;
}

function emptyOversightState(defaultSafeToAutoContinue = true): SudoOversightState {
  return {
    oversightNeeded: false,
    approvalNeeded: false,
    blockedBy: [],
    safeToAutoContinue: defaultSafeToAutoContinue,
  };
}

function normalizeOversight(
  value: unknown,
  options: { defaultSafeToAutoContinue?: boolean } = {},
): SudoOversightState {
  const fallback = emptyOversightState(options.defaultSafeToAutoContinue ?? true);
  if (!value || typeof value !== 'object') return fallback;

  const oversight = value as Partial<SudoOversightState> & { needed?: boolean };
  const oversightLevel =
    oversight.oversightLevel === 'informative' || oversight.oversightLevel === 'approval' || oversight.oversightLevel === 'blocker'
      ? oversight.oversightLevel
      : undefined;
  const oversightReason =
    oversight.oversightReason === 'risk'
    || oversight.oversightReason === 'ambiguity'
    || oversight.oversightReason === 'conflict'
    || oversight.oversightReason === 'blocked'
    || oversight.oversightReason === 'tradeoff'
    || oversight.oversightReason === 'uncertainty'
      ? oversight.oversightReason
      : undefined;
  const oversightNeeded = Boolean(oversight.oversightNeeded ?? oversight.needed ?? oversightLevel ?? oversightReason);

  if (!oversightNeeded) {
    return fallback;
  }

  return {
    oversightNeeded: true,
    oversightLevel: oversightLevel ?? (oversight.approvalNeeded ? 'approval' : undefined),
    oversightReason,
    approvalNeeded: Boolean(oversight.approvalNeeded),
    recommendedDecision: typeof oversight.recommendedDecision === 'string' ? oversight.recommendedDecision : undefined,
    blockedBy: Array.isArray(oversight.blockedBy)
      ? oversight.blockedBy.filter((entry): entry is string => typeof entry === 'string')
      : [],
    conflictSummary: typeof oversight.conflictSummary === 'string' ? oversight.conflictSummary : undefined,
    nextHumanDecision: typeof oversight.nextHumanDecision === 'string' ? oversight.nextHumanDecision : undefined,
    marvinSummary: typeof oversight.marvinSummary === 'string' ? oversight.marvinSummary : undefined,
    safeToAutoContinue:
      typeof oversight.safeToAutoContinue === 'boolean'
        ? oversight.safeToAutoContinue
        : false,
  };
}

function buildBlockedOversight(summary: string, blockedBy: string[]): SudoOversightState {
  return {
    oversightNeeded: true,
    oversightLevel: 'blocker',
    oversightReason: 'blocked',
    approvalNeeded: false,
    recommendedDecision: 'Review the blocked lane result before changing the plan or declaring the work done.',
    blockedBy,
    nextHumanDecision: 'Marvin and Philippe need to decide whether to adjust the plan, retry, or stop.',
    marvinSummary: summary,
    safeToAutoContinue: false,
  };
}

function deriveOversightState(orchestration: SudoOrchestrationRun, childRuns: SudoDelegatedRun[]): SudoOversightState {
  const childFailure = childRuns.find((run) => run.status === 'error');
  if (childFailure) {
    return buildBlockedOversight(
      `${childFailure.lane.seatLabel} hit a blocker and Sudo cannot safely continue alone.`,
      [`${childFailure.lane.seatLabel}: ${childFailure.error || 'Delegated lane failed.'}`],
    );
  }

  if (orchestration.synthesis?.blockers.length) {
    return buildBlockedOversight(
      orchestration.synthesis.oversight.marvinSummary || 'Sudo surfaced blockers that need Marvin review before continuation.',
      orchestration.synthesis.blockers,
    );
  }

  if (orchestration.synthesis) {
    return orchestration.synthesis.oversight.oversightNeeded
      ? orchestration.synthesis.oversight
      : emptyOversightState(orchestration.decision?.mode === 'delegate');
  }

  if (orchestration.decision?.oversight.oversightNeeded) return orchestration.decision.oversight;
  if (orchestration.oversight.oversightNeeded) return orchestration.oversight;
  return emptyOversightState(orchestration.decision?.mode === 'delegate');
}

function normalizeRun(value: unknown): SudoDelegatedRun | null {
  if (!value || typeof value !== 'object') return null;
  const run = value as Partial<SudoDelegatedRun>;
  const lane = SUDO_DELEGATION_LANES.find((entry) => entry.slug === run.lane?.slug);
  if (!lane || typeof run.id !== 'string' || typeof run.requestedPrompt !== 'string' || typeof run.promptSummary !== 'string') {
    return null;
  }

  return {
    id: run.id,
    delegatedBy: 'Sudo',
    orchestrationId: typeof run.orchestrationId === 'string' ? run.orchestrationId : undefined,
    orchestrationSequence: typeof run.orchestrationSequence === 'number' ? run.orchestrationSequence : undefined,
    sourceSeatSlug: 'dev-team',
    sourceSessionKey: typeof run.sourceSessionKey === 'string' ? run.sourceSessionKey : 'agent:main:main',
    sourceSessionLabel: typeof run.sourceSessionLabel === 'string' ? run.sourceSessionLabel : 'Sudo via main session',
    sourceRuntimeNote:
      typeof run.sourceRuntimeNote === 'string'
        ? run.sourceRuntimeNote
        : 'Sudo itself remains routed through the main session. Only delegated lanes create child runs.',
    lane,
    requestedPrompt: run.requestedPrompt,
    promptSummary: run.promptSummary,
    status: run.status === 'running' || run.status === 'done' || run.status === 'error' ? run.status : 'queued',
    requestedAt: typeof run.requestedAt === 'string' ? run.requestedAt : nowIso(),
    startedAt: typeof run.startedAt === 'string' ? run.startedAt : undefined,
    completedAt: typeof run.completedAt === 'string' ? run.completedAt : undefined,
    updatedAt: typeof run.updatedAt === 'string' ? run.updatedAt : nowIso(),
    childSessionKey: typeof run.childSessionKey === 'string' ? run.childSessionKey : undefined,
    runId: typeof run.runId === 'string' ? run.runId : undefined,
    resultSummary: typeof run.resultSummary === 'string' ? run.resultSummary : undefined,
    error: typeof run.error === 'string' ? run.error : undefined,
  };
}

function normalizeDecision(value: unknown): SudoOrchestrationDecision | null {
  if (!value || typeof value !== 'object') return null;
  const decision = value as Partial<SudoOrchestrationDecision>;
  const mode = decision.mode;
  if (
    mode !== 'direct_answer'
    && mode !== 'ask_question'
    && mode !== 'propose_alternative'
    && mode !== 'delegate'
  ) {
    return null;
  }

  const lanePlan = Array.isArray(decision.lanePlan)
    ? decision.lanePlan.filter((lane): lane is SudoLaneSlug => lane === 'frontend' || lane === 'backend' || lane === 'qa')
    : [];
  const lanePlanSteps = Array.isArray(decision.lanePlanSteps)
    ? decision.lanePlanSteps
        .map((entry, index): SudoLanePlanStep | null => {
          if (!entry || typeof entry !== 'object') return null;
          const step = entry as Partial<SudoLanePlanStep>;
          if (step.lane !== 'frontend' && step.lane !== 'backend' && step.lane !== 'qa') return null;
          return {
            lane: step.lane,
            order: typeof step.order === 'number' ? step.order : index + 1,
            purpose: typeof step.purpose === 'string' ? step.purpose : '',
            expectedOutput: typeof step.expectedOutput === 'string' ? step.expectedOutput : '',
            validationFocus: typeof step.validationFocus === 'string' ? step.validationFocus : undefined,
          };
        })
        .filter((entry): entry is SudoLanePlanStep => Boolean(entry))
        .sort((left, right) => left.order - right.order)
    : lanePlan.map((lane, index) => ({
        lane,
        order: index + 1,
        purpose: '',
        expectedOutput: '',
      }));

  return {
    mode,
    lanePlan,
    lanePlanSteps,
    rationale: typeof decision.rationale === 'string' ? decision.rationale : '',
    orderRationale: typeof decision.orderRationale === 'string' ? decision.orderRationale : undefined,
    expectedOutputs: Array.isArray(decision.expectedOutputs)
      ? decision.expectedOutputs.filter((entry): entry is string => typeof entry === 'string')
      : [],
    validationIntent: typeof decision.validationIntent === 'string' ? decision.validationIntent : undefined,
    completionCriteria: typeof decision.completionCriteria === 'string' ? decision.completionCriteria : undefined,
    question: typeof decision.question === 'string' ? decision.question : undefined,
    suggestion: typeof decision.suggestion === 'string' ? decision.suggestion : undefined,
    directAnswer: typeof decision.directAnswer === 'string' ? decision.directAnswer : undefined,
    oversight: normalizeOversight(decision.oversight, {
      defaultSafeToAutoContinue: mode === 'delegate',
    }),
  };
}

function normalizeArtifacts(value: unknown): SudoOrchestrationArtifact[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const artifacts: SudoOrchestrationArtifact[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const artifact = entry as Partial<SudoOrchestrationArtifact>;
    if (typeof artifact.path !== 'string' || !artifact.path.trim()) continue;
    artifacts.push({
      path: artifact.path.trim(),
      label: typeof artifact.label === 'string' ? artifact.label : undefined,
      kind: artifact.kind === 'dir' || artifact.kind === 'url' || artifact.kind === 'log' ? artifact.kind : 'file',
    });
  }
  return artifacts.length > 0 ? artifacts : undefined;
}

function normalizeSynthesis(value: unknown): SudoOrchestrationSynthesis | null {
  if (!value || typeof value !== 'object') return null;
  const synthesis = value as Partial<SudoOrchestrationSynthesis>;
  if (typeof synthesis.summary !== 'string' || typeof synthesis.decided !== 'string') return null;
  return {
    summary: synthesis.summary,
    decided: synthesis.decided,
    lanesRun: Array.isArray(synthesis.lanesRun)
      ? synthesis.lanesRun.filter((lane): lane is SudoLaneSlug => lane === 'frontend' || lane === 'backend' || lane === 'qa')
      : [],
    changesOrFindings: Array.isArray(synthesis.changesOrFindings)
      ? synthesis.changesOrFindings.filter((entry): entry is string => typeof entry === 'string')
      : [],
    blockers: Array.isArray(synthesis.blockers)
      ? synthesis.blockers.filter((entry): entry is string => typeof entry === 'string')
      : [],
    unresolvedIssues: Array.isArray(synthesis.unresolvedIssues)
      ? synthesis.unresolvedIssues.filter((entry): entry is string => typeof entry === 'string')
      : [],
    completedAt: typeof synthesis.completedAt === 'string' ? synthesis.completedAt : nowIso(),
    oversight: normalizeOversight(synthesis.oversight),
  };
}

function normalizeOrchestration(value: unknown): SudoOrchestrationRun | null {
  if (!value || typeof value !== 'object') return null;
  const run = value as Partial<SudoOrchestrationRun>;
  if (typeof run.id !== 'string' || typeof run.requestedPrompt !== 'string' || typeof run.promptSummary !== 'string') {
    return null;
  }

  const decision = normalizeDecision(run.decision);
  const synthesis = normalizeSynthesis(run.synthesis);

  return {
    id: run.id,
    delegatedBy: 'Sudo',
    sourceSeatSlug: 'dev-team',
    sourceSessionKey: typeof run.sourceSessionKey === 'string' ? run.sourceSessionKey : 'agent:main:main',
    sourceSessionLabel: typeof run.sourceSessionLabel === 'string' ? run.sourceSessionLabel : 'Sudo via main session',
    sourceRuntimeNote:
      typeof run.sourceRuntimeNote === 'string'
        ? run.sourceRuntimeNote
        : 'Sudo itself remains routed through the main session. Orchestration records the parent decision, and only delegated lanes create child runs.',
    requestedPrompt: run.requestedPrompt,
    promptSummary: run.promptSummary,
    linkedTaskId: typeof run.linkedTaskId === 'string' ? run.linkedTaskId : undefined,
    status:
      run.status === 'running' || run.status === 'waiting' || run.status === 'done' || run.status === 'error'
        ? run.status
        : 'queued',
    requestedAt: typeof run.requestedAt === 'string' ? run.requestedAt : nowIso(),
    startedAt: typeof run.startedAt === 'string' ? run.startedAt : undefined,
    completedAt: typeof run.completedAt === 'string' ? run.completedAt : undefined,
    updatedAt: typeof run.updatedAt === 'string' ? run.updatedAt : nowIso(),
    decision: decision ?? undefined,
    synthesis: synthesis ?? undefined,
    artifacts: normalizeArtifacts(run.artifacts),
    decisionSessionKey: typeof run.decisionSessionKey === 'string' ? run.decisionSessionKey : undefined,
    decisionRunId: typeof run.decisionRunId === 'string' ? run.decisionRunId : undefined,
    childRunIds: Array.isArray(run.childRunIds) ? run.childRunIds.filter((entry): entry is string => typeof entry === 'string') : [],
    waitingForPhilippe: Boolean(run.waitingForPhilippe),
    oversight: normalizeOversight(run.oversight, {
      defaultSafeToAutoContinue: decision?.mode === 'delegate',
    }),
    error: typeof run.error === 'string' ? run.error : undefined,
  };
}

function deriveOrchestrationState(orchestration: SudoOrchestrationRun, childRuns: SudoDelegatedRun[]): SudoOrchestrationRun {
  const oversight = deriveOversightState(orchestration, childRuns);
  if (orchestration.decision?.mode !== 'delegate') return { ...orchestration, oversight };
  if (childRuns.length === 0) return { ...orchestration, oversight };

  if (childRuns.some((run) => run.status === 'error')) {
    return {
      ...orchestration,
      status: 'error',
      completedAt: orchestration.completedAt ?? childRuns.find((run) => run.status === 'error')?.completedAt ?? orchestration.updatedAt,
      waitingForPhilippe: false,
      oversight,
      error: orchestration.error ?? childRuns.find((run) => run.status === 'error')?.error,
    };
  }

  const expectedSteps = orchestration.decision.lanePlan.length;
  if (expectedSteps > 0 && childRuns.length >= expectedSteps && childRuns.every((run) => run.status === 'done')) {
    const latestCompletion = childRuns
      .map((run) => run.completedAt ?? run.updatedAt)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0];

    return {
      ...orchestration,
      status: oversight.oversightNeeded && !oversight.safeToAutoContinue ? 'waiting' : 'done',
      completedAt: orchestration.completedAt ?? latestCompletion ?? orchestration.updatedAt,
      waitingForPhilippe: false,
      oversight,
    };
  }

  return {
    ...orchestration,
    oversight,
  };
}

export function getSudoDelegationLane(slug: string): SudoDelegationLane | null {
  return SUDO_DELEGATION_LANES.find((lane) => lane.slug === slug) ?? null;
}

export async function readSudoDelegationStore(): Promise<SudoDelegationStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SudoDelegationStore>;
    const orchestrations = Array.isArray(parsed.orchestrations)
      ? parsed.orchestrations
          .map((entry) => normalizeOrchestration(entry))
          .filter((entry): entry is SudoOrchestrationRun => Boolean(entry))
      : [];
    const runs = Array.isArray(parsed.runs)
      ? parsed.runs.map((entry) => normalizeRun(entry)).filter((entry): entry is SudoDelegatedRun => Boolean(entry))
      : [];

    return {
      orchestrations: orchestrations
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
        .slice(0, MAX_RUNS),
      runs: runs
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
        .slice(0, MAX_RUNS),
      meta: {
        schemaVersion: 4,
        updatedAt: typeof parsed.meta?.updatedAt === 'string' ? parsed.meta.updatedAt : nowIso(),
      },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return emptyStore();
    }
    throw error;
  }
}

export async function writeSudoDelegationStore(store: SudoDelegationStore) {
  const nextStore: SudoDelegationStore = {
    orchestrations: store.orchestrations
      .slice()
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, MAX_RUNS),
    runs: store.runs
      .slice()
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, MAX_RUNS),
    meta: {
      schemaVersion: 4,
      updatedAt: nowIso(),
    },
  };

  await fs.writeFile(STORE_PATH, `${JSON.stringify(nextStore, null, 2)}\n`, 'utf8');
  return nextStore;
}

export async function listSudoDelegatedRuns() {
  const store = await readSudoDelegationStore();
  return store.runs;
}

export async function listSudoOrchestrationRuns() {
  const store = await readSudoDelegationStore();
  return store.orchestrations.map((orchestration) =>
    deriveOrchestrationState(
      orchestration,
      store.runs.filter((run) => run.orchestrationId === orchestration.id),
    ),
  );
}

export async function createSudoOrchestrationRun(input: {
  requestedPrompt: string;
  sourceSessionKey?: string | null;
  linkedTaskId?: string | null;
}) {
  const store = await readSudoDelegationStore();
  const requestedAt = nowIso();
  const run: SudoOrchestrationRun = {
    id: `sudo-orchestration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    delegatedBy: 'Sudo',
    sourceSeatSlug: 'dev-team',
    sourceSessionKey: input.sourceSessionKey?.trim() || 'agent:main:main',
    sourceSessionLabel: 'Sudo via main session',
    sourceRuntimeNote:
      'Sudo itself remains routed through the main session. This orchestration records the parent decision and only delegated lanes spawn real child runs.',
    requestedPrompt: input.requestedPrompt.trim(),
    promptSummary: summarizePrompt(input.requestedPrompt),
    linkedTaskId: input.linkedTaskId?.trim() || undefined,
    status: 'queued',
    requestedAt,
    updatedAt: requestedAt,
    childRunIds: [],
    waitingForPhilippe: false,
    oversight: emptyOversightState(true),
  };

  store.orchestrations.unshift(run);
  await writeSudoDelegationStore(store);
  return run;
}

export async function createSudoDelegatedRun(input: {
  lane: SudoDelegationLane;
  requestedPrompt: string;
  sourceSessionKey?: string | null;
  orchestrationId?: string;
  orchestrationSequence?: number;
}) {
  const store = await readSudoDelegationStore();
  const requestedAt = nowIso();
  const run: SudoDelegatedRun = {
    id: `sudo-delegation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    delegatedBy: 'Sudo',
    orchestrationId: input.orchestrationId,
    orchestrationSequence: input.orchestrationSequence,
    sourceSeatSlug: 'dev-team',
    sourceSessionKey: input.sourceSessionKey?.trim() || 'agent:main:main',
    sourceSessionLabel: 'Sudo via main session',
    sourceRuntimeNote: 'Sudo itself remains routed through the main session. This delegation spawns a real child run under that runtime.',
    lane: input.lane,
    requestedPrompt: input.requestedPrompt.trim(),
    promptSummary: summarizePrompt(input.requestedPrompt),
    status: 'queued',
    requestedAt,
    updatedAt: requestedAt,
  };

  store.runs.unshift(run);

  if (input.orchestrationId) {
    const orchestration = store.orchestrations.find((entry) => entry.id === input.orchestrationId);
    if (orchestration) {
      orchestration.childRunIds = [run.id, ...orchestration.childRunIds.filter((entry) => entry !== run.id)];
      orchestration.updatedAt = requestedAt;
    }
  }

  await writeSudoDelegationStore(store);
  return run;
}

export async function updateSudoDelegatedRun(
  runId: string,
  updater: (current: SudoDelegatedRun) => SudoDelegatedRun,
) {
  const store = await readSudoDelegationStore();
  const index = store.runs.findIndex((run) => run.id === runId);
  if (index === -1) {
    throw new Error(`Delegated run not found: ${runId}`);
  }

  const current = store.runs[index];
  const next = {
    ...updater(current),
    updatedAt: nowIso(),
  };
  store.runs[index] = next;
  await writeSudoDelegationStore(store);
  return next;
}

export async function updateSudoOrchestrationRun(
  runId: string,
  updater: (current: SudoOrchestrationRun) => SudoOrchestrationRun,
) {
  const store = await readSudoDelegationStore();
  const index = store.orchestrations.findIndex((run) => run.id === runId);
  if (index === -1) {
    throw new Error(`Orchestration run not found: ${runId}`);
  }

  const current = store.orchestrations[index];
  const next = {
    ...updater(current),
    updatedAt: nowIso(),
  };
  store.orchestrations[index] = next;
  await writeSudoDelegationStore(store);
  return next;
}
