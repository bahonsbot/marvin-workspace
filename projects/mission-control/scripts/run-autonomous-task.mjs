#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const workspaceRoot = '/data/.openclaw/workspace';
const storePath = path.join(workspaceRoot, 'projects', 'mission-control', 'data', 'autonomous-tasks.json');
const autonomyPath = path.join(workspaceRoot, 'AUTONOMOUS.md');

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
  ? [...task.feedback]
    .reverse()
    .find(isMeaningfulRetryFeedback) ?? null
  : null;
const latestFeedback = retryFeedbackEntry?.note ?? null;
const isRetry = Boolean(task.status === 'in-progress' && latestFeedback);
const message = [
  `Autonomous task: ${task.title}`,
  task.description ? `Description: ${task.description}` : null,
  `Agent target: ${task.agentTarget}`,
  isRetry ? 'This is a retry after operator rejection. Treat the latest feedback as a required revision brief, not as optional context.' : null,
  latestFeedback ? `Latest operator feedback to address: ${latestFeedback}` : null,
  'Work on this task directly and return a concise result summary plus any created artifact paths if applicable.',
  isRetry ? 'Your result should clearly reflect how you addressed the feedback.' : null,
].filter(Boolean).join('\n');

try {
  const { stdout } = await execFileAsync(
    'bash',
    ['-lc', `openclaw agent --session-id ${JSON.stringify(sessionId)} --message ${JSON.stringify(message)} --thinking ${JSON.stringify(thinking)} --json --timeout 600`],
    {
      cwd: workspaceRoot,
      timeout: 620000,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  let parsed = null;
  try {
    parsed = JSON.parse(stdout);
  } catch {}

  const resultText = parsed ? JSON.stringify(parsed, null, 2) : stdout;
  const summary = safeSummary(parsed?.response?.text ?? parsed?.text ?? stdout ?? 'Task completed.');
  const sessionKey = parsed?.sessionKey ?? parsed?.session?.key ?? sessionId;
  const childSessionKey = parsed?.childSessionKey ?? parsed?.session?.childSessionKey;
  const runId = parsed?.runId ?? parsed?.run?.id;

  const updated = await updateTask(taskId, attemptId, (current) => ({
    ...current,
    status: 'review',
    needsInput: undefined,
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
} catch (error) {
  const messageText = error instanceof Error ? error.message : 'Autonomous execution failed.';

  if (!/no longer active/.test(messageText)) {
    const updated = await updateTask(taskId, attemptId, (current) => ({
      ...current,
      status: 'todo',
      needsInput: {
        reason: 'execution-failed',
        at: now(),
        note: messageText,
      },
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
        summary: 'Execution failed. Fix input and execute again.',
        result: undefined,
        error: messageText,
      },
    }));

    if (updated.linkedAutonomyRef?.kind === 'autonomous-md') {
      await moveLinkedLegacyTask(updated.linkedAutonomyRef, 'needs-input');
    }
  }

  process.exit(1);
}
