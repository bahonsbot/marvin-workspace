#!/usr/bin/env node
import { readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const workspaceRoot = '/data/.openclaw/workspace';
const storePath = path.join(workspaceRoot, 'projects', 'mission-control', 'data', 'autonomous-tasks.json');
const lifecycleEventsPath = path.join(workspaceRoot, 'projects', 'mission-control', 'data', 'task-lifecycle-events.json');
const autonomyPath = path.join(workspaceRoot, 'AUTONOMOUS.md');
const queuePath = path.join(workspaceRoot, 'memory', 'executor-subagent-queue.json');
const tasksLogPath = path.join(workspaceRoot, 'memory', 'tasks-log.md');
const managedPaths = [autonomyPath, storePath, queuePath, tasksLogPath];

function now() {
  return Date.now();
}

function safeSummary(text) {
  const clean = String(text || '').trim().replace(/\s+/g, ' ');
  return clean.length > 220 ? `${clean.slice(0, 217).trimEnd()}…` : clean;
}

function isMeaningfulRetryFeedback(entry) {
  const note = String(entry?.note || '').trim();
  if (!note) return false;
  if (entry?.by !== 'operator') return false;
  if (note === 'Rejected without note.') return false;
  if (/^Execution failed:/i.test(note)) return false;
  if (/^Imported from AUTONOMOUS\.md/i.test(note)) return false;
  if (/^Queue execution blocked\.?$/i.test(note)) return false;
  if (/^(approved|accepted|looks good|lgtm|done|completed|ship it|works as is)\b/i.test(note)) return false;
  return true;
}

async function loadStore() {
  const raw = await readFile(storePath, 'utf8');
  return JSON.parse(raw);
}

async function loadAutonomyMarkdown() {
  return readFile(autonomyPath, 'utf8');
}

function parseSectionName(line) {
  const text = String(line || '').trim().replace(/^##\s+/, '').toLowerCase();
  if (text === 'open backlog') return 'open-backlog';
  if (text === 'in progress') return 'in-progress';
  if (text === 'needs input') return 'needs-input';
  if (text === 'review') return 'review';
  if (text === 'done today') return 'done-today';
  return null;
}

function normalizeLegacyTaskText(text) {
  return String(text || '').trim().replace(/^[-*]\s+/, '').replace(/\s+/g, ' ').toLowerCase();
}

function removeLegacyTaskLine(markdown, link) {
  const lines = markdown.split('\n');
  let currentSection = null;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith('## ')) {
      currentSection = parseSectionName(lines[i]);
      continue;
    }
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith('- ')) continue;
    const text = trimmed.slice(2).trim();
    const normalizedText = normalizeLegacyTaskText(text);
    const completedPrefix = normalizeLegacyTaskText(`${link.taskText} | ✅`);
    if (normalizedText !== link.taskTextNormalized && !normalizedText.startsWith(completedPrefix)) continue;
    if (
      currentSection !== link.section
      && currentSection !== 'open-backlog'
      && currentSection !== 'in-progress'
      && currentSection !== 'needs-input'
      && currentSection !== 'review'
      && currentSection !== 'done-today'
    ) {
      continue;
    }
    lines.splice(i, 1);
    return lines.join('\n');
  }
  return markdown;
}

function insertTaskIntoSection(markdown, section, taskText) {
  const heading = section === 'open-backlog'
    ? '## Open Backlog'
    : section === 'in-progress'
      ? '## In Progress'
      : section === 'needs-input'
        ? '## Needs Input'
        : section === 'review'
          ? '## Review'
          : null;
  if (!heading) return markdown;

  const lines = markdown.split('\n');
  let headingIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === heading) {
      headingIndex = i;
      break;
    }
  }

  if (headingIndex === -1) {
    if (!markdown.endsWith('\n')) markdown += '\n';
    return `${markdown}${heading}\n- ${taskText}\n`;
  }

  let insertAt = headingIndex + 1;
  while (insertAt < lines.length && lines[insertAt].trim().startsWith('- ')) insertAt += 1;
  lines.splice(insertAt, 0, `- ${taskText}`);
  return lines.join('\n');
}

async function moveLinkedLegacyTask(link, targetSection) {
  if (!link || link.kind !== 'autonomous-md') return;
  const markdown = await loadAutonomyMarkdown();
  const withoutCurrent = removeLegacyTaskLine(markdown, link);
  const nextMarkdown = insertTaskIntoSection(withoutCurrent, targetSection, link.taskText);
  await writeFile(autonomyPath, nextMarkdown, 'utf8');
}

async function saveStore(store) {
  store.meta = {
    schemaVersion: 2,
    updatedAt: now(),
    suppressedLegacyTaskKeys: Array.isArray(store.meta?.suppressedLegacyTaskKeys)
      ? store.meta.suppressedLegacyTaskKeys
      : [],
  };
  await writeFile(storePath, JSON.stringify(store, null, 2) + '\n', 'utf8');
}

async function loadLifecycleEventStore() {
  try {
    const raw = await readFile(lifecycleEventsPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      events: Array.isArray(parsed?.events) ? parsed.events : [],
      meta: {
        schemaVersion: 1,
        updatedAt: typeof parsed?.meta?.updatedAt === 'string' ? parsed.meta.updatedAt : new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        events: [],
        meta: {
          schemaVersion: 1,
          updatedAt: new Date().toISOString(),
        },
      };
    }
    throw error;
  }
}

async function appendLifecycleEvent(event) {
  const store = await loadLifecycleEventStore();
  if (store.events.some((entry) => entry.id === event.id || entry.dedupeKey === event.dedupeKey)) {
    return false;
  }
  store.events.push(event);
  store.meta.updatedAt = new Date().toISOString();
  await writeFile(
    lifecycleEventsPath,
    JSON.stringify(
      {
        ...store,
        events: store.events.slice(-120),
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  return true;
}

async function updateTask(taskId, attemptId, updater) {
  const store = await loadStore();
  const idx = store.tasks.findIndex((task) => task.id === taskId);
  if (idx === -1) throw new Error(`Task not found: ${taskId}`);
  const current = store.tasks[idx];
  if (attemptId && current.run?.attemptId !== attemptId) {
    throw new Error(`Attempt ${attemptId} is no longer active for ${taskId}.`);
  }

  const next = updater(current);
  store.tasks[idx] = {
    ...next,
    updatedAt: now(),
    version: Math.max((current.version ?? 1) + 1, next.version ?? 1),
  };
  await saveStore(store);
  return store.tasks[idx];
}

async function readManagedFileSnapshot(filePath) {
  try {
    return {
      path: filePath,
      exists: true,
      content: await readFile(filePath, 'utf8'),
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { path: filePath, exists: false, content: null };
    }
    throw error;
  }
}

async function snapshotManagedFiles() {
  return Promise.all(managedPaths.map((filePath) => readManagedFileSnapshot(filePath)));
}

async function restoreManagedFiles(snapshot) {
  const warnings = [];

  for (const entry of snapshot) {
    const current = await readManagedFileSnapshot(entry.path);
    const changed = current.exists !== entry.exists || current.content !== entry.content;
    if (!changed) continue;

    if (entry.exists) {
      await writeFile(entry.path, entry.content, 'utf8');
    } else if (current.exists) {
      await unlink(entry.path);
    }

    warnings.push(`Managed task-state edit ignored: ${entry.path}`);
  }

  return warnings;
}

function parseJsonString(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function cleanCandidateText(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^[#>*`-]+/gm, ' ')
    .replace(/^"?(summary|result|proof|rawOutput)"?\s*:\s*/gim, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyMetadataText(value) {
  const raw = String(value || '').trim();
  const text = cleanCandidateText(raw);
  if (!text) return true;
  if (/^(completed|ok|success|done|null)$/i.test(text)) return true;
  if (/^[\[{][\s\S]*[\]}]$/.test(raw)) return true;
  if (/"runId"\s*:/.test(raw) && /"status"\s*:/.test(raw) && /"result"\s*:/.test(raw)) return true;
  if (/systemPromptReport|injectedWorkspaceFiles|bootstrapTruncation|agentMeta|promptTokens|warningSignaturesSeen|stopReason/.test(raw)) return true;
  return false;
}

function scoreSummaryCandidate(value) {
  const text = cleanCandidateText(value);
  if (!text || isLikelyMetadataText(value)) return Number.NEGATIVE_INFINITY;

  let score = Math.min(text.length, 220) / 40;
  if (text.length < 12) score -= 2;
  if (/^(summary|result|completed|delivered|implemented|fixed|updated|created|wrote|added)\b/i.test(text)) score += 3;
  if (/\b(completed|implemented|fixed|updated|created|added|addressed|verified|artifact)\b/i.test(text)) score += 2;
  if (/^(warning|error|failed|failure|traceback|exception)\b/i.test(text)) score -= 5;
  if (/\/data\/\.openclaw\/workspace\//.test(text) && text.length < 96) score -= 1;
  if (/⚠️|✍️|<parameter name=/u.test(text)) score -= 8;
  return score;
}

function bestSummaryFromTextBlock(value) {
  const clean = cleanCandidateText(value);
  if (!clean) return undefined;

  const segments = String(value)
    .split(/\n{2,}|\n/)
    .map((segment) => cleanCandidateText(segment))
    .filter(Boolean);

  const candidates = [clean, ...segments];
  let best = undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const score = scoreSummaryCandidate(candidate);
    if (score >= bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function collectSummaryCandidates(parsed, stdout) {
  const candidates = [];
  const visit = (value) => {
    if (!value) return;
    if (typeof value === 'string') {
      const nested = parseJsonString(value);
      if (nested) {
        visit(nested);
        return;
      }
      const summary = bestSummaryFromTextBlock(value);
      if (summary && !isLikelyMetadataText(summary)) candidates.push(summary);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    if (typeof value !== 'object') return;

    visit(value.summary);
    visit(value.text);
    visit(value.message);
    visit(value.completion);
    visit(value.content);
    visit(value.response?.text);
    visit(value.result?.summary);
    visit(value.result?.text);
    visit(value.result?.message);
    if (Array.isArray(value.result?.payloads)) {
      for (const payload of value.result.payloads) visit(payload?.text);
    }
    if (Array.isArray(value.payloads)) {
      for (const payload of value.payloads) visit(payload?.text);
    }
  };

  visit(stdout);
  visit(parsed);

  return candidates;
}

function summarizeExecution(parsed, stdout, warnings, artifacts = []) {
  const candidates = collectSummaryCandidates(parsed, stdout);

  let best = undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const score = scoreSummaryCandidate(candidate);
    if (score >= bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  const fallbackArtifact = Array.isArray(artifacts)
    ? artifacts.find((artifact) => artifact?.path && !/^(AGENTS\.md|SOUL\.md|TOOLS\.md|USER\.md|MEMORY\.md|HEARTBEAT\.md)$/i.test(String(artifact.path)))
    : null;
  const fallbackSummary = fallbackArtifact?.path
    ? `Created output: ${fallbackArtifact.path}`
    : 'Task completed and moved to Review.';

  const baseSummary = safeSummary(best || fallbackSummary);
  return warnings.length > 0
    ? safeSummary(`${baseSummary} Managed task-state edits were ignored.`)
    : baseSummary;
}

function sanitizeArtifactCandidate(value) {
  return String(value || '')
    .replace(/[),.;:!?]+$/g, '')
    .replace(/^["'`(]+|["'`]+$/g, '')
    .trim();
}

function toWorkspaceRelativePath(value) {
  if (!value) return null;
  if (value.startsWith(`${workspaceRoot}/`)) return value.slice(workspaceRoot.length + 1);
  if (/^(projects|memory|notes|tmp)\//.test(value)) return value;
  return null;
}

async function detectArtifactKind(relativePath) {
  const absolutePath = path.isAbsolute(relativePath) ? relativePath : path.join(workspaceRoot, relativePath);
  try {
    const stats = await stat(absolutePath);
    return stats.isDirectory() ? 'dir' : 'file';
  } catch {
    return null;
  }
}

async function collectArtifacts(parsed, stdout) {
  const artifactMap = new Map();
  const pathPattern = /\/data\/\.openclaw\/workspace\/[^\s"'`<>]+|(?:projects|memory|notes|tmp)\/[^\s"'`<>]+/g;
  const excludedPaths = new Set(managedPaths.map((filePath) => toWorkspaceRelativePath(filePath)).filter(Boolean));

  const addArtifact = async (value, artifact = {}) => {
    const relativePath = toWorkspaceRelativePath(sanitizeArtifactCandidate(value));
    if (!relativePath || excludedPaths.has(relativePath) || artifactMap.has(relativePath)) return;
    const kind = await detectArtifactKind(relativePath);
    if (!kind) return;
    artifactMap.set(relativePath, {
      path: relativePath,
      label: artifact.label,
      kind: artifact.kind || kind,
    });
  };

  const collectFromText = async (value) => {
    if (typeof value !== 'string') return;
    const matches = value.match(pathPattern) ?? [];
    for (const match of matches) {
      await addArtifact(match);
    }
  };

  await collectFromText(stdout);
  await collectFromText(parsed?.summary);
  await collectFromText(parsed?.text);
  await collectFromText(parsed?.response?.text);

  if (Array.isArray(parsed?.result?.payloads)) {
    for (const payload of parsed.result.payloads) {
      await collectFromText(payload?.text);
    }
  }

  return [...artifactMap.values()];
}

function buildExecutionEnvelope({ summary, warnings, artifacts, proof, rawOutput }) {
  return JSON.stringify({
    schema: 'mission-control-autonomous-run-v1',
    summary,
    warnings,
    artifacts,
    proof,
    rawOutput,
  }, null, 2);
}

function agentProofText(parsed, stdout) {
  const payloadTexts = Array.isArray(parsed?.result?.payloads)
    ? parsed.result.payloads.map((payload) => payload?.text).filter((value) => typeof value === 'string')
    : [];
  const payloadText = payloadTexts.join('\n\n');
  return parsed?.response?.text ?? parsed?.text ?? (payloadText || stdout);
}

const taskId = process.argv[2];
if (!taskId) {
  console.error('Missing task id');
  process.exit(1);
}

const store = await loadStore();
const task = store.tasks.find((entry) => entry.id === taskId);
if (!task) {
  console.error(`Task not found: ${taskId}`);
  process.exit(1);
}

const activeRun = task.run;
const attemptId = activeRun?.attemptId;
if (!attemptId) {
  console.error(`Task ${taskId} is missing an active attempt id.`);
  process.exit(1);
}

const sessionId = activeRun.sessionId || activeRun.sessionKey || `mc-auto-${task.id}-${Date.now()}`;
const thinking = task.priority === 'critical' || task.priority === 'high' ? 'medium' : 'low';
const retryFeedbackEntry = Array.isArray(task.feedback)
  ? [...task.feedback].reverse().find(isMeaningfulRetryFeedback) ?? null
  : null;
const latestFeedback = retryFeedbackEntry?.note ?? null;
const isRetry = Boolean(task.status === 'in-progress' && latestFeedback);
const message = [
  `Autonomous task: ${task.title}`,
  task.description ? `Description: ${task.description}` : null,
  `Agent target: ${task.agentTarget}`,
  isRetry ? 'This is a retry after operator rejection. Treat the latest feedback as a required revision brief, not as optional context.' : null,
  latestFeedback ? `Latest operator feedback to address: ${latestFeedback}` : null,
  'You are executing work only. Do not claim authority over task state, approval, review, or completion.',
  'Do not edit AUTONOMOUS.md, autonomous-tasks.json, queue files, or any task-system state file.',
  'Return a concise result summary plus any created artifact paths if applicable.',
  isRetry ? 'Your result should clearly reflect how you addressed the feedback.' : null,
].filter(Boolean).join('\n');

const managedSnapshot = await snapshotManagedFiles();

let parsed = null;
let stdout = '';
let restoreWarnings = [];

try {
  const result = await execFileAsync(
    'bash',
    ['-lc', `openclaw agent --session-id ${JSON.stringify(sessionId)} --message ${JSON.stringify(message)} --thinking ${JSON.stringify(thinking)} --json --timeout 600`],
    {
      cwd: workspaceRoot,
      timeout: 620000,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  stdout = result.stdout;
  try {
    parsed = JSON.parse(stdout);
  } catch {}

  restoreWarnings = await restoreManagedFiles(managedSnapshot);

  const artifacts = await collectArtifacts(parsed, stdout);
  const summary = summarizeExecution(parsed, stdout, restoreWarnings, artifacts);
  const sessionKey = parsed?.sessionKey ?? parsed?.session?.key ?? sessionId;
  const childSessionKey = parsed?.childSessionKey ?? parsed?.session?.childSessionKey;
  const runId = parsed?.runId ?? parsed?.run?.id;
  const proof = agentProofText(parsed, stdout);
  const resultText = buildExecutionEnvelope({
    summary,
    warnings: restoreWarnings,
    artifacts,
    proof,
    rawOutput: stdout,
  });

  const updated = await updateTask(taskId, attemptId, (current) => ({
    ...current,
    status: 'review',
    needsInput: undefined,
    artifacts,
    linkedAutonomyRef: current.linkedAutonomyRef
      ? { ...current.linkedAutonomyRef, section: 'review' }
      : current.linkedAutonomyRef,
    run: {
      ...current.run,
      attemptId,
      attemptNumber: current.run?.attemptNumber ?? 1,
      trigger: current.run?.trigger ?? 'direct',
      sessionKey,
      childSessionKey,
      sessionId,
      runId,
      startedAt: current.run?.startedAt ?? now(),
      endedAt: now(),
      status: 'done',
      summary,
      result: resultText,
      error: undefined,
    },
  }));

  if (updated.linkedAutonomyRef?.kind === 'autonomous-md') {
    await moveLinkedLegacyTask(updated.linkedAutonomyRef, 'review');
  }
  await appendLifecycleEvent({
    id: `task.moved_to_review:${updated.id}:task.moved_to_review:${updated.id}:${attemptId}:${updated.run?.endedAt ?? now()}`,
    dedupeKey: `task.moved_to_review:${updated.id}:${attemptId}:${updated.run?.endedAt ?? now()}`,
    type: 'task.moved_to_review',
    taskId: updated.id,
    title: updated.title,
    at: new Date(updated.run?.endedAt ?? now()).toISOString(),
    fromStatus: 'in-progress',
    toStatus: 'review',
    summary,
    artifactPath: artifacts[0]?.path,
  });
} catch (error) {
  if (typeof error?.stdout === 'string' && error.stdout) {
    stdout = error.stdout;
    try {
      parsed = JSON.parse(stdout);
    } catch {}
  }
  restoreWarnings = await restoreManagedFiles(managedSnapshot);
  const messageText = error instanceof Error ? error.message : 'Autonomous execution failed.';

  if (!/no longer active/.test(messageText)) {
    const summary = restoreWarnings.length > 0
      ? 'Execution failed. Managed task-state edits were ignored.'
      : 'Execution failed. Fix input and execute again.';
    const resultText = buildExecutionEnvelope({
      summary,
      warnings: restoreWarnings,
      artifacts: [],
      proof: stdout || undefined,
      rawOutput: stdout || undefined,
    });

    const updated = await updateTask(taskId, attemptId, (current) => ({
      ...current,
      status: 'todo',
      needsInput: {
        reason: 'execution-failed',
        at: now(),
        note: messageText,
      },
      artifacts: [],
      linkedAutonomyRef: current.linkedAutonomyRef
        ? { ...current.linkedAutonomyRef, section: 'needs-input' }
        : current.linkedAutonomyRef,
      run: {
        ...current.run,
        attemptId,
        attemptNumber: current.run?.attemptNumber ?? 1,
        trigger: current.run?.trigger ?? 'direct',
        sessionKey: current.run?.sessionKey ?? sessionId,
        sessionId,
        startedAt: current.run?.startedAt ?? now(),
        endedAt: now(),
        status: 'error',
        summary,
        result: resultText,
        error: messageText,
      },
    }));

    if (updated.linkedAutonomyRef?.kind === 'autonomous-md') {
      await moveLinkedLegacyTask(updated.linkedAutonomyRef, 'needs-input');
    }
    await appendLifecycleEvent({
      id: `task.needs_input:${updated.id}:task.needs_input:${updated.id}:${attemptId}:${updated.run?.endedAt ?? now()}`,
      dedupeKey: `task.needs_input:${updated.id}:${attemptId}:${updated.run?.endedAt ?? now()}`,
      type: 'task.needs_input',
      taskId: updated.id,
      title: updated.title,
      at: new Date(updated.run?.endedAt ?? now()).toISOString(),
      fromStatus: 'in-progress',
      toStatus: 'todo',
      summary: messageText,
      needsInputReason: 'execution-failed',
    });
  }

  process.exit(1);
}
