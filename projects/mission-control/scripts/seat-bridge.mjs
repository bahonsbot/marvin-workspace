#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  ensureSessionTarget,
  formatModelVerificationError,
  prepareSessionModel,
  verifySessionModel,
} from './lib/openclaw-session-model.mjs';

const execFileAsync = promisify(execFile);
const workspaceRoot = '/data/.openclaw/workspace';
const sudoStorePath = path.join(process.cwd(), 'data', 'sudo-delegations.json');
const sudoRunnerPath = path.join(process.cwd(), 'scripts', 'run-sudo-orchestration.mjs');

const seatConfigs = [
  {
    seatSlug: 'dev-team',
    aliases: ['sudo', 'dev-team', 'dev-team-lead'],
    kind: 'sudo-orchestration',
    label: 'Sudo',
    role: 'Dev Team lead',
    defaultModel: 'codex5.4',
    defaultThinking: 'medium',
    runtimeNote:
      'Sudo remains a Mission Control lead-route seat. The bridge triggers the real Sudo orchestration path instead of a fake subagent wrapper.',
  },
  {
    seatSlug: 'content-seo-team',
    aliases: ['vantage', 'content-seo-team', 'content-seo-team-lead'],
    kind: 'lead-session',
    label: 'Vantage',
    role: 'Content / SEO Team lead',
    agentId: 'main',
    sessionKey: 'agent:main:content-seo-team-lead',
    defaultModel: 'codex5.4',
    defaultThinking: 'medium',
    workspaceFiles: [
      'agent-workspaces/content-seo-team-lead/SOUL.md',
      'agent-workspaces/content-seo-team-lead/MEMORY.md',
      'agent-workspaces/content-seo-team-lead/TEAM.md',
      'agent-workspaces/content-seo-team-lead/WORKSPACE.md',
    ],
    starterPrompt:
      'Activate Vantage mode. Act as the content-and-SEO team lead inside Mission Control. Break the request into the clearest editorial/SEO path, decide whether it needs signal scouting, keyword-gap analysis, editorial strategy, draft-production handoff, or GSC/performance review, and stay honest that Vantage still runs through the main runtime. Start by asking for audience, brand voice, objective, source material, current site or URL, performance context, and deadline.',
    runtimeNote:
      'Vantage does not yet have a dedicated orchestration backend like Sudo. The bridge therefore uses a persistent lead-session under the main runtime, with explicit Vantage operating instructions and continuity files.',
  },
  {
    seatSlug: 'language-tutor',
    aliases: ['language-tutor', 'japin'],
    kind: 'seat-session',
    label: 'Japin',
    role: 'Language Tutor',
    agentId: 'main',
    sessionKey: 'agent:language-tutor:main',
    defaultModel: 'codex5.4',
    defaultThinking: 'medium',
    workspaceFiles: [
      'agent-workspaces/language-tutor/SOUL.md',
      'agent-workspaces/language-tutor/MEMORY.md',
      'agent-workspaces/language-tutor/WORKSPACE.md',
      'agent-workspaces/language-tutor/memory/continuity.md',
      'agent-workspaces/language-tutor/memory/learner-profile.md',
      'agent-workspaces/language-tutor/.learnings/corrections.md',
    ],
    starterPrompt:
      'Activate Japin mode. Before planning the lesson, review `agent-workspaces/language-tutor/memory/continuity.md`, `agent-workspaces/language-tutor/memory/learner-profile.md`, and `agent-workspaces/language-tutor/.learnings/corrections.md`, then continue with what is actually logged there. Start by confirming target language, current level, learning goal, preferred exercise format, and whether grammar, conversation, vocabulary, or script practice should come first.',
    runtimeNote:
      'Japin is bridged through a persistent specialist seat session under the main runtime, with Japin-specific activation and continuity context, instead of a fake spawned subagent.',
  },
  {
    seatSlug: 'sportsbet-advisor',
    aliases: ['sportsbet-advisor', 'johan'],
    kind: 'seat-session',
    label: 'Johan',
    role: 'Sportsbet Advisor',
    agentId: 'main',
    sessionKey: 'agent:sportsbet-advisor:main',
    defaultModel: 'codex5.4',
    defaultThinking: 'medium',
    workspaceFiles: [
      'agent-workspaces/sportsbet-advisor/SOUL.md',
      'agent-workspaces/sportsbet-advisor/MEMORY.md',
      'agent-workspaces/sportsbet-advisor/WORKSPACE.md',
      'agent-workspaces/sportsbet-advisor/memory/continuity.md',
      'agent-workspaces/sportsbet-advisor/memory/bettor-profile.md',
      'agent-workspaces/sportsbet-advisor/.learnings/corrections.md',
    ],
    starterPrompt:
      'Activate Johan mode. Before analyzing the bet, review `agent-workspaces/sportsbet-advisor/memory/continuity.md`, `agent-workspaces/sportsbet-advisor/memory/bettor-profile.md`, and `agent-workspaces/sportsbet-advisor/.learnings/corrections.md`, then continue from what is actually logged there. Start by asking for the sport, event, market, current line or odds, sportsbook, and any constraints. Focus on probability, data quality, downside risk, and bias control.',
    runtimeNote:
      'Johan is bridged through a persistent specialist seat session under the main runtime, with Johan-specific activation and continuity context, instead of a fake spawned subagent.',
  },
  {
    seatSlug: 'trading-advisor',
    aliases: ['trading-advisor', 'milou'],
    kind: 'seat-session',
    label: 'Milou',
    role: 'Trading Advisor',
    agentId: 'main',
    sessionKey: 'agent:trading-advisor:main',
    defaultModel: 'codex5.4',
    defaultThinking: 'medium',
    workspaceFiles: [
      'agent-workspaces/trading-advisor/SOUL.md',
      'agent-workspaces/trading-advisor/MEMORY.md',
      'agent-workspaces/trading-advisor/WORKSPACE.md',
      'agent-workspaces/trading-advisor/memory/continuity.md',
      'agent-workspaces/trading-advisor/memory/trader-profile.md',
      'agent-workspaces/trading-advisor/.learnings/corrections.md',
    ],
    starterPrompt:
      'Activate Milou mode. Before assessing the setup, review `agent-workspaces/trading-advisor/memory/continuity.md`, `agent-workspaces/trading-advisor/memory/trader-profile.md`, and `agent-workspaces/trading-advisor/.learnings/corrections.md`, then continue from what is actually logged there. Start by asking for the ticker or market, timeframe, chart context, risk tolerance, and any open-position context. Establish stop, size, and risk-to-reward before discussing upside.',
    runtimeNote:
      'Milou is bridged through a persistent specialist seat session under the main runtime, with Milou-specific activation and continuity context, instead of a fake spawned subagent.',
  },
  {
    seatSlug: 'job-advisor',
    aliases: ['job-advisor', 'link'],
    kind: 'seat-session',
    label: 'Link',
    role: 'Job Advisor',
    agentId: 'main',
    sessionKey: 'agent:job-advisor:main',
    defaultModel: 'codex5.4',
    defaultThinking: 'medium',
    workspaceFiles: [
      'agent-workspaces/job-advisor/SOUL.md',
      'agent-workspaces/job-advisor/MEMORY.md',
      'agent-workspaces/job-advisor/WORKSPACE.md',
      'agent-workspaces/job-advisor/SKILLS.md',
      'agent-workspaces/job-advisor/memory/continuity.md',
      'agent-workspaces/job-advisor/memory/candidate-profile.md',
      'agent-workspaces/job-advisor/.learnings/corrections.md',
    ],
    starterPrompt:
      'Activate Link mode. First read `skills/job-advisor/SKILL.md`, then review `agent-workspaces/job-advisor/memory/continuity.md`, `agent-workspaces/job-advisor/memory/candidate-profile.md`, and `agent-workspaces/job-advisor/.learnings/corrections.md` before drafting anything. Continue only from what is actually logged there. Start by asking for the target role, company, location or remote constraints, seniority, job description, and any existing resume or cover-letter material. Prioritize role fit, evidence-backed wording, ATS-safe clarity, and honest positioning.',
    runtimeNote:
      'Link is bridged through a persistent specialist seat session under the main runtime, with Link-specific activation and continuity context, instead of a fake spawned subagent.',
  },
];

function nowIso() {
  return new Date().toISOString();
}

function summarizeText(value, max = 280) {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3).trimEnd()}...`;
}

function extractTexts(value, output = []) {
  if (!value) return output;
  if (typeof value === 'string') {
    const clean = summarizeText(value, 900);
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

function deriveResultSummary(parsed, stdout) {
  const summary =
    summarizeText(parsed?.result?.message)
    || summarizeText(parsed?.result?.text)
    || summarizeText(parsed?.result?.content)
    || summarizeText(parsed?.result?.summary)
    || summarizeText(extractTexts(parsed?.result)[0])
    || summarizeText(extractTexts(parsed)[0])
    || summarizeText(parsed?.summary)
    || summarizeText(stdout);

  return summary || 'Seat bridge run completed without a concise summary payload.';
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = {
    seat: '',
    prompt: '',
    sourceSessionKey: 'agent:main:main',
    timeoutSeconds: 900,
    dryRun: false,
    list: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--seat') {
      args.seat = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (token === '--prompt') {
      args.prompt = String(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (token === '--source-session-key') {
      args.sourceSessionKey = String(argv[index + 1] || '').trim() || 'agent:main:main';
      index += 1;
      continue;
    }
    if (token === '--timeout') {
      const parsed = Number(argv[index + 1]);
      args.timeoutSeconds = Number.isFinite(parsed) && parsed > 0 ? parsed : 900;
      index += 1;
      continue;
    }
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--list') {
      args.list = true;
      continue;
    }
  }

  return args;
}

function resolveSeat(input) {
  const needle = String(input || '').trim().toLowerCase();
  if (!needle) return null;
  return seatConfigs.find((seat) => seat.aliases.includes(needle)) || null;
}

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildSudoOrchestration(prompt, sourceSessionKey) {
  const requestedAt = nowIso();
  return {
    id: `sudo-orchestration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    delegatedBy: 'Sudo',
    sourceSeatSlug: 'dev-team',
    sourceSessionKey: sourceSessionKey || 'agent:main:main',
    sourceSessionLabel: 'Sudo via main session',
    sourceRuntimeNote:
      'Sudo itself remains routed through the main session. This orchestration records the parent decision and only delegated lanes spawn real child runs.',
    requestedPrompt: prompt.trim(),
    promptSummary: summarizeText(prompt, 180),
    status: 'queued',
    requestedAt,
    updatedAt: requestedAt,
    childRunIds: [],
    waitingForPhilippe: false,
    oversight: {
      oversightNeeded: false,
      approvalNeeded: false,
      blockedBy: [],
      safeToAutoContinue: true,
    },
  };
}

async function triggerSudoOrchestration(prompt, sourceSessionKey, dryRun) {
  const orchestration = buildSudoOrchestration(prompt, sourceSessionKey);

  if (!dryRun) {
    const store = await readJson(sudoStorePath, {
      orchestrations: [],
      runs: [],
      meta: {
        schemaVersion: 4,
        updatedAt: nowIso(),
      },
    });

    if (!Array.isArray(store.orchestrations)) store.orchestrations = [];
    if (!Array.isArray(store.runs)) store.runs = [];

    store.orchestrations.unshift(orchestration);
    store.meta = {
      schemaVersion: 4,
      updatedAt: nowIso(),
    };

    await writeJson(sudoStorePath, store);

    const child = spawn('node', [sudoRunnerPath, orchestration.id], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  }

  return {
    seatSlug: 'dev-team',
    kind: 'sudo-orchestration',
    status: dryRun ? 'dry-run' : 'accepted',
    orchestrationId: orchestration.id,
    sourceSessionKey: orchestration.sourceSessionKey,
    storePath: sudoStorePath,
    promptSummary: orchestration.promptSummary,
    runtimeNote:
      'Sudo bridge hit the existing Mission Control orchestration path, not a spawned subagent. FE/BE/QA child runs remain the real delegated execution lanes.',
  };
}

function buildSeatSessionPrompt(seat, prompt, sourceSessionKey) {
  return [
    seat.starterPrompt,
    '',
    'Bridge invocation context:',
    `- This request was routed by Marvin from ${sourceSessionKey || 'agent:main:main'}.`,
    '- Continue inside this seat\'s persistent Mission Control seat session.',
    '- Review these continuity files before deciding anything meaningful:',
    ...(seat.workspaceFiles || []).map((filePath) => `  - ${filePath}`),
    '- Keep the seat truthful to the current runtime. Do not invent hidden dedicated backends or hidden child runtimes.',
    '',
    'Brief from Marvin:',
    prompt,
  ].join('\n');
}

async function runOpenClawTurn({ agentId, sessionId, prompt, thinking, timeoutSeconds }) {
  const args = ['agent', '--session-id', sessionId, '--message', prompt, '--thinking', thinking, '--json', '--timeout', String(timeoutSeconds)];
  if (agentId && agentId !== 'main') {
    args.splice(1, 0, '--agent', agentId);
  }

  const result = await execFileAsync('openclaw', args, {
    cwd: workspaceRoot,
    timeout: (timeoutSeconds + 30) * 1000,
    maxBuffer: 10 * 1024 * 1024,
  });

  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch {
    parsed = null;
  }

  return {
    stdout: result.stdout || '',
    parsed,
  };
}

async function runSeatSession(seat, prompt, sourceSessionKey, timeoutSeconds, dryRun) {
  const ensuredTarget = await ensureSessionTarget({
    agentId: seat.agentId,
    sessionKey: seat.sessionKey,
    label: seat.seatSlug,
  });

  const preparedSession = await prepareSessionModel({
    agentId: ensuredTarget.agentId,
    sessionId: ensuredTarget.sessionId,
    sessionKey: ensuredTarget.sessionKey,
    modelAlias: seat.defaultModel,
  });

  if (dryRun) {
    return {
      seatSlug: seat.seatSlug,
      kind: seat.kind,
      status: 'dry-run',
      agentId: preparedSession.agentId,
      sessionKey: preparedSession.sessionKey,
      sessionId: preparedSession.sessionId,
      modelAlias: seat.defaultModel,
      thinking: seat.defaultThinking,
      runtimeNote: seat.runtimeNote,
    };
  }

  const finalPrompt = seat.starterPrompt
    ? buildSeatSessionPrompt(seat, prompt, sourceSessionKey)
    : prompt;

  const result = await runOpenClawTurn({
    agentId: preparedSession.agentId,
    sessionId: preparedSession.sessionId,
    prompt: finalPrompt,
    thinking: seat.defaultThinking,
    timeoutSeconds,
  });

  const verification = await verifySessionModel({
    agentId: preparedSession.agentId,
    sessionId: preparedSession.sessionId,
    sessionKey: preparedSession.sessionKey,
    modelAlias: seat.defaultModel,
    runtimeResult: result.parsed,
  });

  if (!verification.ok) {
    throw new Error(formatModelVerificationError(`${seat.label} bridge model verification failed.`, verification, seat.defaultModel));
  }

  return {
    seatSlug: seat.seatSlug,
    kind: seat.kind,
    status: 'ok',
    label: seat.label,
    role: seat.role,
    agentId: preparedSession.agentId,
    sessionKey: verification.sessionKey || preparedSession.sessionKey,
    sessionId: preparedSession.sessionId,
    runId: result.parsed?.runId || result.parsed?.run?.id || null,
    modelAlias: seat.defaultModel,
    thinking: seat.defaultThinking,
    summary: deriveResultSummary(result.parsed, result.stdout),
    runtimeNote: seat.runtimeNote,
    verification: {
      source: verification.source || null,
      provider: verification.provider || null,
      model: verification.model || null,
      limitation: verification.limitation || null,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    printJson({
      seats: seatConfigs.map((seat) => ({
        seatSlug: seat.seatSlug,
        aliases: seat.aliases,
        kind: seat.kind,
        label: seat.label,
        role: seat.role,
        runtimeNote: seat.runtimeNote,
      })),
    });
    return;
  }

  const seat = resolveSeat(args.seat);
  if (!seat) {
    throw new Error(`Unknown seat: ${args.seat || '(missing)'}. Use --list to inspect supported seats.`);
  }

  const prompt = String(args.prompt || '').trim();
  if (!prompt) {
    throw new Error('A non-empty --prompt is required.');
  }

  if (seat.kind === 'sudo-orchestration') {
    const result = await triggerSudoOrchestration(prompt, args.sourceSessionKey, args.dryRun);
    printJson(result);
    return;
  }

  const result = await runSeatSession(seat, prompt, args.sourceSessionKey, args.timeoutSeconds, args.dryRun);
  printJson(result);
}

main().catch((error) => {
  printJson({
    status: 'error',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
