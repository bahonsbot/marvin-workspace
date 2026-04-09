#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  createMissionControlSessionTarget,
  formatModelVerificationError,
  prepareSessionModel,
  verifySessionModel,
} from './lib/openclaw-session-model.mjs';

const execFileAsync = promisify(execFile);
const storePath = path.join(process.cwd(), 'data', 'sudo-delegations.json');
const delegationRunnerPath = path.join(process.cwd(), 'scripts', 'run-sudo-delegation.mjs');
const workspaceRoot = '/data/.openclaw/workspace';
const sudoModelAlias = 'codex5.4';
const sudoThinking = 'medium';
const supportedLanes = new Set(['frontend', 'backend', 'qa']);
const laneDefaults = {
  frontend: {
    slug: 'frontend',
    seatLabel: 'Frontend Developer',
    role: 'UI implementation lane',
    defaultModel: 'codex',
    defaultThinking: 'medium',
    executionNote: 'Real child run spawned under the main OpenClaw agent/runtime.',
  },
  backend: {
    slug: 'backend',
    seatLabel: 'Backend Developer',
    role: 'API and server implementation lane',
    defaultModel: 'codex',
    defaultThinking: 'medium',
    executionNote: 'Real child run spawned under the main OpenClaw agent/runtime.',
  },
  qa: {
    slug: 'qa',
    seatLabel: 'QA Engineer',
    role: 'Verification and regression lane',
    defaultModel: 'minimax2.7',
    defaultThinking: 'low',
    executionNote: 'Real child run spawned under the main OpenClaw agent/runtime.',
  },
};
const allowedLanePlans = new Set([
  JSON.stringify(['frontend']),
  JSON.stringify(['backend']),
  JSON.stringify(['qa']),
  JSON.stringify(['frontend', 'qa']),
  JSON.stringify(['backend', 'qa']),
  JSON.stringify(['frontend', 'backend']),
  JSON.stringify(['backend', 'frontend']),
  JSON.stringify(['frontend', 'backend', 'qa']),
  JSON.stringify(['backend', 'frontend', 'qa']),
]);

function nowIso() {
  return new Date().toISOString();
}

function summarizeText(value, max = 240) {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3).trimEnd()}...`;
}

function compactList(value, max = 4, itemMax = 220) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => summarizeText(entry, itemMax))
    .filter(Boolean)
    .slice(0, max);
}

async function loadStore() {
  const raw = await readFile(storePath, 'utf8');
  return JSON.parse(raw);
}

async function saveStore(store) {
  store.meta = {
    schemaVersion: 4,
    updatedAt: nowIso(),
  };
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

function emptyOversightState(defaultSafeToAutoContinue = true) {
  return {
    oversightNeeded: false,
    approvalNeeded: false,
    blockedBy: [],
    safeToAutoContinue: defaultSafeToAutoContinue,
  };
}

function normalizeOversight(raw, options = {}) {
  const fallback = emptyOversightState(options.defaultSafeToAutoContinue ?? true);
  if (!raw || typeof raw !== 'object') return fallback;

  const oversightLevel = ['informative', 'approval', 'blocker'].includes(raw.oversightLevel)
    ? raw.oversightLevel
    : undefined;
  const oversightReason = ['risk', 'ambiguity', 'conflict', 'blocked', 'tradeoff', 'uncertainty'].includes(raw.oversightReason)
    ? raw.oversightReason
    : undefined;
  const oversightNeeded = Boolean(raw.oversightNeeded ?? raw.needed ?? oversightLevel ?? oversightReason);

  if (!oversightNeeded) return fallback;

  return {
    oversightNeeded: true,
    oversightLevel: oversightLevel || (raw.approvalNeeded ? 'approval' : undefined),
    oversightReason,
    approvalNeeded: Boolean(raw.approvalNeeded),
    recommendedDecision: summarizeText(raw.recommendedDecision || '', 260) || undefined,
    blockedBy: compactList(raw.blockedBy, 4, 220),
    conflictSummary: summarizeText(raw.conflictSummary || '', 240) || undefined,
    nextHumanDecision: summarizeText(raw.nextHumanDecision || '', 240) || undefined,
    marvinSummary: summarizeText(raw.marvinSummary || '', 240) || undefined,
    safeToAutoContinue: typeof raw.safeToAutoContinue === 'boolean' ? raw.safeToAutoContinue : false,
  };
}

function buildBlockedOversight(summary, blockedBy = []) {
  return {
    oversightNeeded: true,
    oversightLevel: 'blocker',
    oversightReason: 'blocked',
    approvalNeeded: false,
    recommendedDecision: 'Review the blocked lane result before changing the plan or marking the work complete.',
    blockedBy: compactList(blockedBy, 4, 220),
    conflictSummary: undefined,
    nextHumanDecision: 'Marvin and Philippe need to decide whether to retry, change the plan, or stop.',
    marvinSummary: summarizeText(summary, 240),
    safeToAutoContinue: false,
  };
}

function needsOversightHold(oversight) {
  return Boolean(oversight?.oversightNeeded && (oversight.approvalNeeded || oversight.safeToAutoContinue === false));
}

async function updateOrchestration(runId, updater) {
  const store = await loadStore();
  const index = Array.isArray(store.orchestrations) ? store.orchestrations.findIndex((run) => run.id === runId) : -1;
  if (index === -1) throw new Error(`Orchestration run not found: ${runId}`);
  const current = store.orchestrations[index];
  const next = {
    ...updater(current),
    updatedAt: nowIso(),
  };
  store.orchestrations[index] = next;
  await saveStore(store);
  return next;
}

async function createChildRun(orchestration, step, stepPrompt) {
  const store = await loadStore();
  const requestedAt = nowIso();
  const childRun = {
    id: `sudo-delegation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    delegatedBy: 'Sudo',
    orchestrationId: orchestration.id,
    orchestrationSequence: step.order,
    sourceSeatSlug: 'dev-team',
    sourceSessionKey: orchestration.sourceSessionKey || 'agent:main:main',
    sourceSessionLabel: 'Sudo via main session',
    sourceRuntimeNote: 'Sudo itself remains routed through the main session. This delegation spawns a real child run under that runtime.',
    lane: laneDefaults[step.lane],
    requestedPrompt: stepPrompt,
    promptSummary: summarizeText(stepPrompt, 180),
    status: 'queued',
    requestedAt,
    updatedAt: requestedAt,
  };

  if (!Array.isArray(store.runs)) store.runs = [];
  store.runs.unshift(childRun);

  const orchestrationIndex = Array.isArray(store.orchestrations)
    ? store.orchestrations.findIndex((entry) => entry.id === orchestration.id)
    : -1;
  if (orchestrationIndex !== -1) {
    const current = store.orchestrations[orchestrationIndex];
    current.childRunIds = [childRun.id, ...(Array.isArray(current.childRunIds) ? current.childRunIds.filter((entry) => entry !== childRun.id) : [])];
    current.updatedAt = requestedAt;
  }

  await saveStore(store);
  return childRun;
}

function extractTexts(value, output = []) {
  if (!value) return output;
  if (typeof value === 'string') {
    const clean = summarizeText(value, 800);
    if (clean) output.push(clean);
    return output;
  }
  if (Array.isArray(value)) {
    for (const entry of value) extractTexts(entry, output);
    return output;
  }
  if (typeof value !== 'object') return output;

  extractTexts(value.summary, output);
  extractTexts(value.message, output);
  extractTexts(value.text, output);
  extractTexts(value.content, output);
  extractTexts(value.result, output);
  extractTexts(value.payloads, output);
  extractTexts(value.response, output);
  return output;
}

function extractJsonObjects(text) {
  const trimmed = String(text || '');
  const results = [];

  for (let start = 0; start < trimmed.length; start += 1) {
    if (trimmed[start] !== '{') continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < trimmed.length; index += 1) {
      const char = trimmed[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;

      if (depth === 0) {
        const candidate = trimmed.slice(start, index + 1);
        try {
          results.push(JSON.parse(candidate));
        } catch {}
        break;
      }
    }
  }

  return results;
}

function scoreDecisionCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') return Number.NEGATIVE_INFINITY;

  const raw = candidate?.decision && typeof candidate.decision === 'object' ? candidate.decision : candidate;
  let score = 0;

  if (typeof raw.mode === 'string') score += 8;
  if (['direct_answer', 'ask_question', 'propose_alternative', 'delegate'].includes(raw.mode)) score += 24;
  if (Array.isArray(raw.lanePlan)) score += 6;
  if (Array.isArray(raw.lanePlanSteps)) score += 5;
  if (typeof raw.rationale === 'string') score += 4;
  if (raw.oversight && typeof raw.oversight === 'object') score += 4;
  if (typeof raw.directAnswer === 'string' || typeof raw.question === 'string' || typeof raw.suggestion === 'string') score += 2;

  if ('status' in candidate) score -= 6;
  if ('result' in candidate) score -= 3;
  if ('message' in candidate && !('mode' in raw)) score -= 2;

  return score;
}

function extractDecisionPayload(...sources) {
  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const source of sources) {
    for (const candidate of extractJsonObjects(source)) {
      const score = scoreDecisionCandidate(candidate);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
  }

  return best;
}

function normalizeLanePlan(rawPlan) {
  const lanePlan = Array.isArray(rawPlan)
    ? rawPlan.filter((lane) => supportedLanes.has(lane)).slice(0, 3)
    : [];
  if (!allowedLanePlans.has(JSON.stringify(lanePlan))) {
    throw new Error('Sudo chose delegation but did not provide a supported lane plan.');
  }
  return lanePlan;
}

function inferStepPurpose(lane, order, lanePlan) {
  if (lane === 'frontend' && lanePlan.includes('backend')) {
    return order === 1 ? 'Shape the UI contract and implementation surface before cross-lane follow-up.' : 'Complete frontend implementation after backend dependencies are clear.';
  }
  if (lane === 'backend' && lanePlan.includes('frontend')) {
    return order === 1 ? 'Define or implement server-side changes that unblock dependent UI work.' : 'Finish backend follow-through after frontend findings clarified integration needs.';
  }
  if (lane === 'qa') return 'Validate the shipped path, check regressions, and surface unresolved risk.';
  if (lane === 'frontend') return 'Implement or adjust the user-facing surface for this request.';
  return 'Implement or adjust the server-side path for this request.';
}

function inferExpectedOutput(lane) {
  if (lane === 'frontend') return 'Concrete UI/code changes, affected files, and implementation risks.';
  if (lane === 'backend') return 'Concrete API/server/code changes, affected files, and implementation risks.';
  return 'Verification result, regressions checked, and any blockers or unresolved issues.';
}

function normalizeDecision(parsed) {
  const raw = parsed?.decision && typeof parsed.decision === 'object' ? parsed.decision : parsed;
  const mode = raw?.mode;
  if (!['direct_answer', 'ask_question', 'propose_alternative', 'delegate'].includes(mode)) {
    throw new Error('Sudo orchestration did not return a supported decision mode.');
  }

  const lanePlan = mode === 'delegate' ? normalizeLanePlan(raw?.lanePlan) : [];
  const rawSteps = Array.isArray(raw?.lanePlanSteps) ? raw.lanePlanSteps : [];
  const lanePlanSteps = lanePlan.map((lane, index) => {
    const source = rawSteps.find((entry) => entry?.lane === lane && Number(entry?.order || index + 1) === index + 1) || rawSteps[index] || {};
    return {
      lane,
      order: index + 1,
      purpose: summarizeText(source?.purpose || inferStepPurpose(lane, index + 1, lanePlan), 180),
      expectedOutput: summarizeText(source?.expectedOutput || inferExpectedOutput(lane), 180),
      validationFocus: summarizeText(source?.validationFocus || '', 180) || undefined,
    };
  });

  if (mode === 'delegate' && lanePlanSteps.length !== lanePlan.length) {
    throw new Error('Sudo chose delegation but did not provide a valid step plan.');
  }
  if (mode === 'direct_answer' && !summarizeText(raw?.directAnswer || '', 1200)) {
    throw new Error('Sudo chose direct_answer but did not provide directAnswer text.');
  }
  if (mode === 'ask_question' && !summarizeText(raw?.question || '', 420)) {
    throw new Error('Sudo chose ask_question but did not provide a question.');
  }
  if (mode === 'propose_alternative' && !summarizeText(raw?.suggestion || '', 420)) {
    throw new Error('Sudo chose propose_alternative but did not provide a suggestion.');
  }

  return {
    mode,
    lanePlan,
    lanePlanSteps,
    rationale: summarizeText(raw?.rationale || '', 320),
    orderRationale: summarizeText(raw?.orderRationale || '', 320) || undefined,
    expectedOutputs: compactList(raw?.expectedOutputs, 5, 180),
    validationIntent: summarizeText(raw?.validationIntent || '', 240) || undefined,
    completionCriteria: summarizeText(raw?.completionCriteria || '', 240) || undefined,
    question: summarizeText(raw?.question || '', 420) || undefined,
    suggestion: summarizeText(raw?.suggestion || '', 420) || undefined,
    directAnswer: summarizeText(raw?.directAnswer || '', 1200) || undefined,
    oversight: normalizeOversight(raw?.oversight, {
      defaultSafeToAutoContinue: mode === 'delegate',
    }),
  };
}

function buildDecisionPrompt(orchestration) {
  return [
    'You are Sudo, the Mission Control dev-team lead.',
    'Runtime truth:',
    '- Sudo is not a separate backend runtime. Sudo still routes through the main runtime boundary.',
    '- If you delegate, Mission Control can start real child runs for frontend, backend, and QA.',
    '- Keep the decision bounded and truthful. Do not invent hidden tools, hidden reviewers, or fake autonomy.',
    '- Marvin oversight is a visible supervision boundary inside the same Mission Control runtime, not a second hidden runtime.',
    '',
    'Decide the next step for Philippe using exactly one mode:',
    '- direct_answer: answer directly with no delegation.',
    '- ask_question: ask Philippe a clarifying question before execution if the brief is unclear, under-specified, or blocked by missing constraints.',
    '- propose_alternative: suggest a safer or materially better alternative before execution if the brief is risky, wasteful, or aimed at the wrong solution.',
    '- delegate: delegate to the minimal honest lane plan that can start now.',
    '',
    'Allowed delegation lane plans are bounded to these exact sequences:',
    '- [frontend]',
    '- [backend]',
    '- [qa]',
    '- [frontend, qa]',
    '- [backend, qa]',
    '- [frontend, backend]',
    '- [backend, frontend]',
    '- [frontend, backend, qa]',
    '- [backend, frontend, qa]',
    '',
    'Rules:',
    '- Prefer ask_question over delegation when repo path, desired outcome, constraints, acceptance criteria, or risk tolerance are missing.',
    '- Prefer propose_alternative when the brief implies unnecessary complexity, risk, or a clearly better path.',
    '- Use direct_answer only when the brief can be fully handled without spawning lane work.',
    '- Use delegate only when execution is clear enough to begin now.',
    '- Use oversight only for structural escalation: conflict, blocked execution, approval-worthy tradeoff, elevated risk/uncertainty, or any next step that is not safe to auto-continue.',
    '- Do not use oversight as a replacement for a normal ask_question. If Philippe simply needs to clarify the brief, use ask_question and keep oversightNeeded false unless a broader review boundary is also needed.',
    '- QA can appear alone for verification-only work, or as the final lane after implementation. Never put QA before implementation lanes.',
    '- Frontend and backend can both appear only when the first lane materially unblocks the second lane.',
    '- Keep rationale and order justification concise and concrete.',
    '',
    'Return strict JSON with this shape and no extra prose:',
    '{',
    '  "mode": "direct_answer | ask_question | propose_alternative | delegate",',
    '  "lanePlan": ["frontend" | "backend" | "qa"],',
    '  "lanePlanSteps": [',
    '    {',
    '      "lane": "frontend | backend | qa",',
    '      "order": 1,',
    '      "purpose": "why this lane runs at this step",',
    '      "expectedOutput": "what this lane should produce",',
    '      "validationFocus": "optional validation emphasis"',
    '    }',
    '  ],',
    '  "rationale": "short reason for the overall mode",',
    '  "orderRationale": "why this order is the smallest honest sequence",',
    '  "expectedOutputs": ["brief bullets for the whole orchestration"],',
    '  "validationIntent": "how Mission Control expects to validate the outcome",',
    '  "completionCriteria": "what makes this orchestration done",',
    '  "question": "required only for ask_question",',
    '  "suggestion": "required only for propose_alternative",',
    '  "directAnswer": "required only for direct_answer",',
    '  "oversight": {',
    '    "oversightNeeded": true,',
    '    "oversightLevel": "informative | approval | blocker",',
    '    "oversightReason": "risk | ambiguity | conflict | blocked | tradeoff | uncertainty",',
    '    "approvalNeeded": false,',
    '    "recommendedDecision": "what Marvin/Philippe should decide next",',
    '    "blockedBy": ["what is blocking safe continuation"],',
    '    "conflictSummary": "required only if outputs or options materially conflict",',
    '    "nextHumanDecision": "the next review or approval call Marvin/Philippe must make",',
    '    "marvinSummary": "short honest summary for the Marvin oversight panel",',
    '    "safeToAutoContinue": true',
    '  }',
    '}',
    '',
    'Task brief from Philippe:',
    orchestration.requestedPrompt,
  ].join('\n');
}

function buildLanePrompt(orchestration, decision, step, completedRuns) {
  const completedContext = completedRuns.length
    ? completedRuns
        .map((run) => `- ${run.lane.seatLabel}: ${run.resultSummary || run.error || run.promptSummary}`)
        .join('\n')
    : '- No prior lane output yet.';

  return [
    `You are the ${laneDefaults[step.lane].seatLabel} lane delegated by Sudo inside Mission Control.`,
    'Runtime truth:',
    '- This is a real delegated child run under the main OpenClaw runtime and main agent session boundary.',
    '- Sudo itself still routes through the main session; do not claim a separate dedicated lane backend exists.',
    `Lane focus: ${laneDefaults[step.lane].role}.`,
    '',
    'Sudo plan context:',
    `- Step ${step.order} of ${decision.lanePlanSteps.length}`,
    `- Planned lane order: ${decision.lanePlan.join(' -> ')}`,
    `- Step purpose: ${step.purpose}`,
    `- Expected output: ${step.expectedOutput}`,
    step.validationFocus ? `- Validation focus: ${step.validationFocus}` : null,
    decision.orderRationale ? `- Order rationale: ${decision.orderRationale}` : null,
    decision.validationIntent ? `- Validation intent: ${decision.validationIntent}` : null,
    decision.completionCriteria ? `- Completion criteria: ${decision.completionCriteria}` : null,
    '',
    'Prior completed lane output:',
    completedContext,
    '',
    'Task delegated by Sudo:',
    orchestration.requestedPrompt,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildFallbackSynthesis(orchestration, decision, childRuns, failureMessage) {
  const lanesRun = childRuns.map((run) => run.lane.slug);
  const changesOrFindings = childRuns
    .map((run) => summarizeText(run.resultSummary || '', 220))
    .filter(Boolean)
    .slice(0, 6);
  const blockers = childRuns
    .filter((run) => run.status === 'error' && run.error)
    .map((run) => summarizeText(`${run.lane.seatLabel}: ${run.error}`, 220));

  if (failureMessage && blockers.length === 0) blockers.push(summarizeText(failureMessage, 220));

  return {
    summary: summarizeText(
      failureMessage
        ? `Sudo planned ${decision.mode} with ${decision.lanePlan.join(' -> ') || 'no lane plan'}, but synthesis fallback was used after an orchestration issue.`
        : `Sudo completed ${decision.mode === 'delegate' ? `the lane plan ${decision.lanePlan.join(' -> ')}` : decision.mode}.`,
      240,
    ),
    decided:
      decision.mode === 'delegate'
        ? `Delegated ${decision.lanePlan.join(' -> ')} because ${decision.rationale || 'execution could start now.'}`
        : decision.mode === 'ask_question'
          ? decision.question || 'Sudo asked Philippe for clarification.'
          : decision.mode === 'propose_alternative'
            ? decision.suggestion || 'Sudo proposed an alternative path.'
            : decision.directAnswer || 'Sudo answered directly.',
    lanesRun,
    changesOrFindings,
    blockers,
    unresolvedIssues: blockers.length > 0 ? ['Review the blocker output before claiming completion.'] : [],
    completedAt: nowIso(),
    oversight:
      blockers.length > 0
        ? buildBlockedOversight(
            'Sudo cannot safely continue because delegated execution surfaced a blocker.',
            blockers,
          )
        : emptyOversightState(true),
  };
}

function buildSynthesisPrompt(orchestration, decision, childRuns) {
  return [
    'You are Sudo summarizing a completed Mission Control orchestration.',
    'Truthfulness rules:',
    '- Only summarize what is present in the brief, the decision, and child lane outputs.',
    '- Do not invent file changes, tests, blockers, or validation that are not present.',
    '- If a lane result is vague, keep the synthesis vague rather than embellishing.',
    '- If the run now needs Marvin oversight, say so explicitly and only for real conflict, blockers, approval boundaries, or elevated uncertainty.',
    '',
    'Return strict JSON and no extra prose:',
    '{',
    '  "summary": "short final outcome for the UI",',
    '  "decided": "what Sudo decided and why",',
    '  "lanesRun": ["frontend" | "backend" | "qa"],',
    '  "changesOrFindings": ["what changed or what was found"],',
    '  "blockers": ["actual blockers"],',
    '  "unresolvedIssues": ["remaining open issues"],',
    '  "oversight": {',
    '    "oversightNeeded": true,',
    '    "oversightLevel": "informative | approval | blocker",',
    '    "oversightReason": "risk | ambiguity | conflict | blocked | tradeoff | uncertainty",',
    '    "approvalNeeded": false,',
    '    "recommendedDecision": "what Marvin/Philippe should decide next",',
    '    "blockedBy": ["what is blocking safe continuation"],',
    '    "conflictSummary": "required only if lane outputs materially conflict",',
    '    "nextHumanDecision": "specific review or approval call",',
    '    "marvinSummary": "short honest summary for the Marvin oversight panel",',
    '    "safeToAutoContinue": true',
    '  }',
    '',
    '}',
    '',
    `Original brief: ${orchestration.requestedPrompt}`,
    `Decision mode: ${decision.mode}`,
    `Lane plan: ${decision.lanePlan.join(' -> ') || 'none'}`,
    `Rationale: ${decision.rationale || 'n/a'}`,
    `Order rationale: ${decision.orderRationale || 'n/a'}`,
    `Validation intent: ${decision.validationIntent || 'n/a'}`,
    `Completion criteria: ${decision.completionCriteria || 'n/a'}`,
    '',
    'Lane outputs:',
    ...childRuns.map((run) => [
      `- Lane: ${run.lane.slug}`,
      `  status: ${run.status}`,
      `  summary: ${run.resultSummary || 'n/a'}`,
      `  error: ${run.error || 'none'}`,
    ].join('\n')),
  ].join('\n');
}

async function runModelJson(sessionId, prompt, thinking = sudoThinking) {
  const result = await execFileAsync(
    'bash',
    [
      '-lc',
      `openclaw agent --session-id ${JSON.stringify(sessionId)} --message ${JSON.stringify(prompt)} --thinking ${JSON.stringify(thinking)} --json --timeout 900`,
    ],
    {
      cwd: workspaceRoot,
      timeout: 920000,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch {}

  const extractedTexts = extractTexts(parsed);
  const payload = extractDecisionPayload(
    parsed?.response?.text,
    parsed?.result?.text,
    ...(Array.isArray(parsed?.result?.payloads) ? parsed.result.payloads.map((payload) => payload?.text) : []),
    ...extractedTexts,
    result.stdout || '',
  );
  return {
    parsed,
    payload,
  };
}

async function buildSynthesis(orchestration, decision, childRuns, decisionSessionId) {
  try {
    const synthesisSession = createMissionControlSessionTarget({
      agentId: 'main',
      label: 'sudo-synthesis',
      sessionId: `${decisionSessionId}-synthesis`,
    });
    const preparedSynthesisSession = await prepareSessionModel({
      agentId: synthesisSession.agentId,
      sessionId: synthesisSession.sessionId,
      sessionKey: synthesisSession.sessionKey,
      modelAlias: sudoModelAlias,
    });
    const { parsed, payload } = await runModelJson(preparedSynthesisSession.sessionId, buildSynthesisPrompt(orchestration, decision, childRuns), 'low');
    const synthesisVerification = await verifySessionModel({
      agentId: preparedSynthesisSession.agentId,
      sessionId: preparedSynthesisSession.sessionId,
      sessionKey: preparedSynthesisSession.sessionKey,
      modelAlias: sudoModelAlias,
      runtimeResult: parsed,
    });
    if (!synthesisVerification.ok) {
      throw new Error(formatModelVerificationError('Sudo synthesis model verification failed.', synthesisVerification, sudoModelAlias));
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('Sudo synthesis did not return JSON.');
    }

    const fallback = buildFallbackSynthesis(orchestration, decision, childRuns);
    const payloadOversight = normalizeOversight(payload.oversight);
    const oversight = payloadOversight.oversightNeeded ? payloadOversight : fallback.oversight;

    return {
      summary: summarizeText(payload.summary || '', 240) || fallback.summary,
      decided: summarizeText(payload.decided || '', 280) || fallback.decided,
      lanesRun: Array.isArray(payload.lanesRun)
        ? payload.lanesRun.filter((lane) => supportedLanes.has(lane)).slice(0, 3)
        : childRuns.map((run) => run.lane.slug),
      changesOrFindings: compactList(payload.changesOrFindings, 6, 220),
      blockers: compactList(payload.blockers, 4, 220),
      unresolvedIssues: compactList(payload.unresolvedIssues, 4, 220),
      completedAt: nowIso(),
      oversight,
    };
  } catch (error) {
    return buildFallbackSynthesis(
      orchestration,
      decision,
      childRuns,
      error instanceof Error ? error.message : 'Synthesis failed.',
    );
  }
}

async function run() {
  const runId = process.argv[2];
  if (!runId) throw new Error('Usage: run-sudo-orchestration.mjs <orchestration-run-id>');

  const orchestration = await updateOrchestration(runId, (current) => ({
    ...current,
    status: 'running',
    startedAt: current.startedAt || nowIso(),
    waitingForPhilippe: false,
    synthesis: undefined,
    oversight: emptyOversightState(true),
    error: undefined,
  }));

  const decisionSession = createMissionControlSessionTarget({
    agentId: 'main',
    label: 'sudo-orchestration',
    sessionId: `mc-sudo-orchestration-${Date.now()}`,
  });

  try {
    const preparedDecisionSession = await prepareSessionModel({
      agentId: decisionSession.agentId,
      sessionId: decisionSession.sessionId,
      sessionKey: decisionSession.sessionKey,
      modelAlias: sudoModelAlias,
    });

    const { parsed, payload } = await runModelJson(preparedDecisionSession.sessionId, buildDecisionPrompt(orchestration));
    const decisionVerification = await verifySessionModel({
      agentId: preparedDecisionSession.agentId,
      sessionId: preparedDecisionSession.sessionId,
      sessionKey: preparedDecisionSession.sessionKey,
      modelAlias: sudoModelAlias,
      runtimeResult: parsed,
    });
    if (!decisionVerification.ok) {
      throw new Error(formatModelVerificationError('Sudo orchestration model verification failed.', decisionVerification, sudoModelAlias));
    }

    const decision = normalizeDecision(payload);
    const decisionSessionKey = parsed?.childSessionKey || parsed?.sessionKey || parsed?.session?.key || decisionVerification.sessionKey || preparedDecisionSession.sessionKey;
    const decisionRunId = parsed?.runId || parsed?.run?.id;
    const waitingForPhilippe = decision.mode === 'ask_question' || decision.mode === 'propose_alternative';
    const holdForOversight = decision.mode === 'delegate' && needsOversightHold(decision.oversight);

    await updateOrchestration(runId, (current) => ({
      ...current,
      status: waitingForPhilippe || holdForOversight ? 'waiting' : decision.mode === 'delegate' ? 'running' : 'done',
      completedAt: decision.mode === 'delegate' ? undefined : nowIso(),
      decision,
      decisionSessionKey,
      decisionRunId,
      waitingForPhilippe,
      oversight: decision.oversight,
      synthesis:
        decision.mode === 'delegate'
          ? undefined
          : {
              summary:
                decision.mode === 'direct_answer'
                  ? summarizeText(decision.directAnswer || 'Sudo answered directly.', 240)
                  : decision.mode === 'ask_question'
                    ? summarizeText(decision.question || 'Sudo is waiting on Philippe.', 240)
                    : summarizeText(decision.suggestion || 'Sudo proposed an alternative path.', 240),
              decided:
                decision.mode === 'direct_answer'
                  ? summarizeText(`Direct answer. ${decision.rationale}`, 280)
                  : decision.mode === 'ask_question'
                    ? summarizeText(`Clarification needed. ${decision.rationale}`, 280)
                    : summarizeText(`Alternative proposed. ${decision.rationale}`, 280),
              lanesRun: [],
              changesOrFindings:
                decision.mode === 'direct_answer'
                  ? compactList([decision.directAnswer], 2, 220)
                  : decision.mode === 'propose_alternative'
                    ? compactList([decision.suggestion], 2, 220)
                    : [],
              blockers: [],
              unresolvedIssues: decision.mode === 'ask_question' ? compactList([decision.question], 1, 220) : [],
              completedAt: nowIso(),
              oversight: decision.oversight,
            },
      error: undefined,
    }));

    if (decision.mode !== 'delegate' || holdForOversight) {
      return;
    }

    const completedRuns = [];
    const childRunIds = [];
    for (const step of decision.lanePlanSteps) {
      const stepPrompt = buildLanePrompt(orchestration, decision, step, completedRuns);
      const childRun = await createChildRun(orchestration, step, stepPrompt);
      childRunIds.push(childRun.id);

      await updateOrchestration(runId, (current) => ({
        ...current,
        status: 'running',
        childRunIds,
      }));

      try {
        await execFileAsync('node', [delegationRunnerPath, childRun.id], {
          cwd: process.cwd(),
          timeout: 920000,
          maxBuffer: 10 * 1024 * 1024,
        });
      } catch (error) {
        const failedSynthesis = buildFallbackSynthesis(
          orchestration,
          decision,
          [...completedRuns, { ...childRun, status: 'error', error: error instanceof Error ? error.message : 'Delegated lane run failed.' }],
          error instanceof Error ? error.message : 'Delegated lane run failed.',
        );
        await updateOrchestration(runId, (current) => ({
          ...current,
          status: 'error',
          completedAt: nowIso(),
          waitingForPhilippe: false,
          childRunIds,
          synthesis: failedSynthesis,
          oversight: failedSynthesis.oversight,
          error: error instanceof Error ? error.message : 'Delegated lane run failed.',
        }));
        throw error;
      }

      const store = await loadStore();
      const completed = Array.isArray(store.runs) ? store.runs.find((entry) => entry.id === childRun.id) : null;
      if (completed) completedRuns.push(completed);
    }

    const synthesis = await buildSynthesis(orchestration, decision, completedRuns, preparedDecisionSession.sessionId);
    const holdAfterSynthesis = needsOversightHold(synthesis.oversight);
    await updateOrchestration(runId, (current) => ({
      ...current,
      status: holdAfterSynthesis ? 'waiting' : 'done',
      completedAt: nowIso(),
      childRunIds,
      waitingForPhilippe: false,
      synthesis,
      oversight: synthesis.oversight,
      error: undefined,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sudo orchestration failed.';
    await updateOrchestration(runId, (current) => ({
      ...current,
      status: 'error',
      completedAt: current.completedAt || nowIso(),
      waitingForPhilippe: false,
      oversight: current.oversight?.oversightNeeded
        ? current.oversight
        : buildBlockedOversight('Sudo orchestration failed before it could safely hand back control.', [message]),
      error: current.error || message,
    }));
    throw error;
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
