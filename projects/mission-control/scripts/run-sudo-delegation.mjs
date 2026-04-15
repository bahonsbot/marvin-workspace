#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const {
  createMissionControlSessionTarget,
  formatModelVerificationError,
  prepareSessionModel,
  verifySessionModel,
} = await import(pathToFileURL(path.join(process.cwd(), 'scripts', 'lib', 'openclaw-session-model.mjs')).href);

const execFileAsync = promisify(execFile);
const storePath = path.join(process.cwd(), 'data', 'sudo-delegations.json');
const workspaceRoot = '/data/.openclaw/workspace';

function nowIso() {
  return new Date().toISOString();
}

function summarizeText(value, max = 220) {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3).trimEnd()}...`;
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

async function updateRun(runId, updater) {
  const store = await loadStore();
  const index = Array.isArray(store.runs) ? store.runs.findIndex((run) => run.id === runId) : -1;
  if (index === -1) throw new Error(`Delegated run not found: ${runId}`);
  const current = store.runs[index];
  const next = {
    ...updater(current),
    updatedAt: nowIso(),
  };
  store.runs[index] = next;
  await saveStore(store);
  return next;
}

function extractTexts(value, output = []) {
  if (!value) return output;
  if (typeof value === 'string') {
    const clean = summarizeText(value, 400);
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

function isLowSignalSummary(value) {
  const clean = String(value || '').trim().toLowerCase();
  return clean === 'completed' || clean === 'done' || clean === 'ok' || clean === 'success' || clean === 'succeeded';
}

function firstInformativeSummary(candidates) {
  const normalized = candidates
    .map((value) => summarizeText(value))
    .filter(Boolean);
  return normalized.find((value) => !isLowSignalSummary(value)) || normalized[0] || '';
}

function deriveResultSummary(parsed, stdout) {
  const summary = firstInformativeSummary([
    ...(extractTexts(parsed?.result) || []),
    ...(extractTexts(parsed) || []),
    parsed?.result?.message,
    parsed?.result?.text,
    parsed?.result?.summary,
    parsed?.summary,
    stdout,
  ]);

  return summary || 'Delegated lane run completed without a concise summary payload.';
}

function buildLanePrompt(run) {
  return [
    `You are the ${run.lane.seatLabel} lane delegated by Sudo inside Mission Control.`,
    'Runtime truth:',
    '- This is a real delegated child run under the main OpenClaw runtime and main agent session boundary.',
    '- Sudo itself still routes through the main session; do not claim a separate dedicated lane backend exists.',
    `Lane focus: ${run.lane.role}.`,
    'Work only the lane-specific part of the request. Be explicit about concrete code changes, tests, risks, and any gaps.',
    'Return a concise result summary first, then the key implementation or verification details.',
    '',
    'Task delegated by Sudo:',
    run.requestedPrompt,
  ].join('\n');
}

async function run() {
  const runId = process.argv[2];
  if (!runId) throw new Error('Usage: run-sudo-delegation.mjs <run-id>');

  const queuedRun = await updateRun(runId, (current) => ({
    ...current,
    status: 'running',
    startedAt: current.startedAt || nowIso(),
    error: undefined,
  }));

  const childSession = createMissionControlSessionTarget({
    agentId: 'main',
    label: `sudo-${queuedRun.lane.slug}`,
    sessionId: `mc-sudo-${queuedRun.lane.slug}-${Date.now()}`,
  });
  const modelAlias = queuedRun.lane.defaultModel;

  try {
    const preparedSession = await prepareSessionModel({
      agentId: childSession.agentId,
      sessionId: childSession.sessionId,
      sessionKey: childSession.sessionKey,
      modelAlias,
    });

    const result = await execFileAsync(
      'bash',
      [
        '-lc',
        `openclaw agent --session-id ${JSON.stringify(preparedSession.sessionId)} --message ${JSON.stringify(buildLanePrompt(queuedRun))} --thinking ${JSON.stringify(queuedRun.lane.defaultThinking)} --json --timeout 900`,
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

    const verification = await verifySessionModel({
      agentId: preparedSession.agentId,
      sessionId: preparedSession.sessionId,
      sessionKey: preparedSession.sessionKey,
      modelAlias,
      runtimeResult: parsed,
    });
    if (!verification.ok) {
      throw new Error(formatModelVerificationError('Delegated lane model verification failed.', verification, modelAlias));
    }

    const sessionKey = parsed?.childSessionKey || parsed?.sessionKey || parsed?.session?.key || verification.sessionKey || preparedSession.sessionKey;
    const resultSummary = deriveResultSummary(parsed, result.stdout);

    await updateRun(runId, (current) => ({
      ...current,
      status: 'done',
      completedAt: nowIso(),
      childSessionKey: sessionKey,
      runId: parsed?.runId || parsed?.run?.id,
      resultSummary,
      error: undefined,
    }));
  } catch (error) {
    await updateRun(runId, (current) => ({
      ...current,
      status: 'error',
      completedAt: nowIso(),
      childSessionKey: current.childSessionKey || childSession.sessionKey,
      error: error instanceof Error ? error.message : 'Delegated lane run failed.',
    }));
    throw error;
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
