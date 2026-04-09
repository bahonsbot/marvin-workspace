import crypto from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const openClawAgentsRoot = '/data/.openclaw/agents';
const lockRetryMs = 50;
const lockMaxAttempts = 80;

const modelAliasSpecs = {
  'minimax2.7': {
    provider: 'minimax',
    model: 'MiniMax-M2.7',
    hints: ['minimax', 'm2.7'],
  },
  codex: {
    provider: 'openai-codex',
    model: 'gpt-5.3-codex',
    hints: ['codex', 'gpt-5.3-codex'],
  },
  'codex5.4': {
    provider: 'openai-codex',
    model: 'gpt-5.4',
    hints: ['gpt-5.4', 'codex/gpt-5.4'],
  },
  'codex5.4mini': {
    provider: 'openai-codex',
    model: 'gpt-5.4-mini',
    hints: ['gpt-5.4-mini', 'codex/gpt-5.4-mini'],
  },
  gemini: {
    provider: 'google',
    model: 'gemini-3.1-pro-preview',
    hints: ['gemini', 'gemini-3.1-pro-preview'],
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAgentId(value) {
  const text = String(value || '').trim();
  return text || 'main';
}

function resolveAgentIdFromSessionKey(sessionKey) {
  const match = String(sessionKey || '').match(/^agent:([^:]+):/);
  return normalizeAgentId(match?.[1]);
}

function resolveSessionStorePath(agentId) {
  return path.join(openClawAgentsRoot, normalizeAgentId(agentId), 'sessions', 'sessions.json');
}

async function readSessionStore(storePath) {
  try {
    const raw = await readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(tempPath, filePath);
}

async function withStoreLock(storePath, fn) {
  const lockPath = `${storePath}.mission-control.lock`;
  let handle = null;

  for (let attempt = 0; attempt < lockMaxAttempts; attempt += 1) {
    try {
      await mkdir(path.dirname(storePath), { recursive: true });
      handle = await open(lockPath, 'wx');
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST' || attempt === lockMaxAttempts - 1) {
        throw error;
      }
      await sleep(lockRetryMs);
    }
  }

  try {
    const store = await readSessionStore(storePath);
    const result = await fn(store);
    await writeJsonAtomic(storePath, store);
    return result;
  } finally {
    try {
      await handle?.close();
    } finally {
      try {
        await unlink(lockPath);
      } catch {}
    }
  }
}

function resolveModelAliasSpec(modelAlias) {
  const spec = modelAliasSpecs[String(modelAlias || '').trim()];
  if (!spec) {
    throw new Error(`Unsupported Mission Control model alias: ${modelAlias}`);
  }
  return spec;
}

function buildSyntheticSessionKey(agentId, label) {
  const safeLabel = String(label || 'mission-control')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'mission-control';
  return `agent:${normalizeAgentId(agentId)}:${safeLabel}:${crypto.randomUUID()}`;
}

function clearStaleRuntimeModelFields(entry, spec) {
  const runtimeModel = String(entry?.model || '').trim();
  const runtimeProvider = String(entry?.modelProvider || '').trim();
  const runtimeAligned = runtimeModel === spec.model && (!runtimeProvider || runtimeProvider === spec.provider);

  if (runtimeModel && !runtimeAligned) delete entry.model;
  if (runtimeProvider && !runtimeAligned) delete entry.modelProvider;
}

function sessionModelInfo(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const provider = String(entry.modelProvider || '').trim();
  const model = String(entry.model || '').trim();
  if (!provider && !model) return null;
  return {
    provider: provider || null,
    model: model || null,
    source: 'session-store-runtime',
  };
}

function sessionOverrideInfo(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const provider = String(entry.providerOverride || '').trim();
  const model = String(entry.modelOverride || '').trim();
  if (!provider && !model) return null;
  return {
    provider: provider || null,
    model: model || null,
    source: 'session-store-override',
    limitation: 'Runtime metadata did not expose an effective model; relying on the prepared session override.',
  };
}

function runtimeModelInfo(parsed) {
  const candidates = [
    parsed?.result?.meta?.agentMeta,
    parsed?.meta?.agentMeta,
    parsed?.result?.meta,
    parsed?.meta,
    parsed?.result,
    parsed,
  ];

  for (const candidate of candidates) {
    const provider = String(candidate?.modelProvider || candidate?.provider || '').trim();
    const model = String(candidate?.model || '').trim();
    if (!provider && !model) continue;
    return {
      provider: provider || null,
      model: model || null,
      source: 'runtime-metadata',
    };
  }

  return null;
}

function modelInfoMatchesAlias(info, modelAlias) {
  if (!info) return false;
  const spec = resolveModelAliasSpec(modelAlias);
  const provider = String(info.provider || '').toLowerCase();
  const model = String(info.model || '').toLowerCase();
  const exactMatch = provider === spec.provider.toLowerCase() && model === spec.model.toLowerCase();
  if (exactMatch) return true;
  return spec.hints.some((hint) => model.includes(String(hint).toLowerCase()) || provider.includes(String(hint).toLowerCase()));
}

async function lookupSessionEntryBySessionId(storePath, sessionId, preferredSessionKey) {
  const store = await readSessionStore(storePath);
  if (preferredSessionKey && store[preferredSessionKey]) {
    return {
      sessionKey: preferredSessionKey,
      entry: store[preferredSessionKey],
    };
  }

  const match = Object.entries(store).find(([, entry]) => entry?.sessionId === sessionId);
  if (!match) return { sessionKey: preferredSessionKey || null, entry: null };
  return {
    sessionKey: match[0],
    entry: match[1],
  };
}

export function createMissionControlSessionTarget({ agentId = 'main', label, sessionId }) {
  const resolvedAgentId = normalizeAgentId(agentId);
  return {
    agentId: resolvedAgentId,
    sessionId: String(sessionId || crypto.randomUUID()),
    sessionKey: buildSyntheticSessionKey(resolvedAgentId, label),
  };
}

export async function prepareSessionModel({ agentId = 'main', sessionId, sessionKey, modelAlias }) {
  const resolvedSessionId = String(sessionId || '').trim();
  if (!resolvedSessionId) throw new Error('prepareSessionModel requires a sessionId.');

  const resolvedAgentId = normalizeAgentId(agentId || resolveAgentIdFromSessionKey(sessionKey));
  const storePath = resolveSessionStorePath(resolvedAgentId);
  const spec = resolveModelAliasSpec(modelAlias);
  const fallbackSessionKey = String(sessionKey || '').trim() || buildSyntheticSessionKey(resolvedAgentId, 'mission-control');

  const preparedSessionKey = await withStoreLock(storePath, async (store) => {
    const existingMatch = Object.entries(store).find(([, entry]) => entry?.sessionId === resolvedSessionId);
    const targetSessionKey = existingMatch?.[0] || fallbackSessionKey;
    const current = store[targetSessionKey] && typeof store[targetSessionKey] === 'object' ? store[targetSessionKey] : {};
    const next = {
      ...current,
      sessionId: resolvedSessionId,
      updatedAt: Date.now(),
      providerOverride: spec.provider,
      modelOverride: spec.model,
    };

    clearStaleRuntimeModelFields(next, spec);
    store[targetSessionKey] = next;
    return targetSessionKey;
  });

  return {
    agentId: resolvedAgentId,
    sessionId: resolvedSessionId,
    sessionKey: preparedSessionKey,
    storePath,
    provider: spec.provider,
    model: spec.model,
    modelAlias,
  };
}

export async function verifySessionModel({ agentId = 'main', sessionId, sessionKey, modelAlias, runtimeResult }) {
  const resolvedSessionId = String(sessionId || '').trim();
  if (!resolvedSessionId) throw new Error('verifySessionModel requires a sessionId.');

  const resolvedAgentId = normalizeAgentId(agentId || resolveAgentIdFromSessionKey(sessionKey));
  const storePath = resolveSessionStorePath(resolvedAgentId);
  const runtimeInfo = runtimeModelInfo(runtimeResult);
  if (modelInfoMatchesAlias(runtimeInfo, modelAlias)) {
    return {
      ok: true,
      source: runtimeInfo.source,
      provider: runtimeInfo.provider,
      model: runtimeInfo.model,
      sessionKey: String(sessionKey || '').trim() || null,
      limitation: null,
    };
  }

  const sessionEntryResult = await lookupSessionEntryBySessionId(storePath, resolvedSessionId, String(sessionKey || '').trim() || null);
  const actualInfo = sessionModelInfo(sessionEntryResult.entry);
  if (modelInfoMatchesAlias(actualInfo, modelAlias)) {
    return {
      ok: true,
      source: actualInfo.source,
      provider: actualInfo.provider,
      model: actualInfo.model,
      sessionKey: sessionEntryResult.sessionKey,
      limitation: null,
    };
  }

  const fallbackInfo = sessionOverrideInfo(sessionEntryResult.entry);
  if (modelInfoMatchesAlias(fallbackInfo, modelAlias)) {
    return {
      ok: true,
      source: fallbackInfo.source,
      provider: fallbackInfo.provider,
      model: fallbackInfo.model,
      sessionKey: sessionEntryResult.sessionKey,
      limitation: fallbackInfo.limitation,
    };
  }

  return {
    ok: false,
    source: runtimeInfo?.source || actualInfo?.source || null,
    provider: runtimeInfo?.provider || actualInfo?.provider || fallbackInfo?.provider || null,
    model: runtimeInfo?.model || actualInfo?.model || fallbackInfo?.model || null,
    sessionKey: sessionEntryResult.sessionKey,
    limitation: null,
  };
}

export function formatModelVerificationError(prefix, verification, modelAlias) {
  const observedModel = verification?.provider && verification?.model
    ? `${verification.provider}/${verification.model}`
    : verification?.model || verification?.provider || 'unavailable';
  const source = verification?.source ? ` Source: ${verification.source}.` : '';
  const limitation = verification?.limitation ? ` ${verification.limitation}` : '';
  return `${prefix} Requested ${modelAlias}; observed ${observedModel}.${source}${limitation}`.trim();
}
