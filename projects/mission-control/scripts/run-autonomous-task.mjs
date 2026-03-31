#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const workspaceRoot = '/data/.openclaw/workspace';
const storePath = path.join(workspaceRoot, 'projects', 'mission-control', 'data', 'autonomous-tasks.json');
const autonomyPath = path.join(workspaceRoot, 'AUTONOMOUS.md');

function now() { return Date.now(); }
function safeSummary(text) {
  const clean = String(text || '').trim().replace(/\s+/g, ' ');
  return clean.length > 220 ? `${clean.slice(0, 217).trimEnd()}…` : clean;
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
    if (normalizeLegacyTaskText(text) !== link.taskTextNormalized) continue;
    if (currentSection !== link.section && currentSection !== 'open-backlog' && currentSection !== 'in-progress' && currentSection !== 'needs-input' && currentSection !== 'review') continue;
    lines.splice(i, 1);
    return lines.join('\n');
  }
  return markdown;
}
function insertTaskIntoSection(markdown, section, taskText) {
  const heading = section === 'open-backlog' ? '## Open Backlog'
    : section === 'in-progress' ? '## In Progress'
    : section === 'needs-input' ? '## Needs Input'
    : section === 'review' ? '## Review'
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
  store.meta = { schemaVersion: 1, updatedAt: now() };
  await writeFile(storePath, JSON.stringify(store, null, 2) + '\n', 'utf8');
}
async function updateTask(taskId, updater) {
  const store = await loadStore();
  const idx = store.tasks.findIndex((task) => task.id === taskId);
  if (idx === -1) throw new Error(`Task not found: ${taskId}`);
  const current = store.tasks[idx];
  const next = updater(current);
  store.tasks[idx] = { ...next, updatedAt: now(), version: Math.max((current.version ?? 1) + 1, next.version ?? 1) };
  await saveStore(store);
  return store.tasks[idx];
}

const taskId = process.argv[2];
if (!taskId) {
  console.error('Missing task id');
  process.exit(1);
}

const task = await updateTask(taskId, (current) => current);
const sessionId = `mc-auto-${task.id}-${Date.now()}`;
const thinking = task.priority === 'critical' || task.priority === 'high' ? 'medium' : 'low';
const message = [
  `Autonomous task: ${task.title}`,
  task.description ? `Description: ${task.description}` : null,
  `Agent target: ${task.agentTarget}`,
  'Work on this task directly and return a concise result summary plus any created artifact paths if applicable.',
].filter(Boolean).join('\n');

await updateTask(taskId, (current) => ({
  ...current,
  status: 'in-progress',
  run: {
    sessionKey: current.run?.sessionKey ?? sessionId,
    sessionId,
    startedAt: current.run?.startedAt ?? now(),
    status: 'running',
    summary: current.run?.summary,
  },
}));

try {
  const { stdout } = await execFileAsync('bash', ['-lc', `openclaw agent --session-id ${JSON.stringify(sessionId)} --message ${JSON.stringify(message)} --thinking ${JSON.stringify(thinking)} --json --timeout 600`], {
    cwd: workspaceRoot,
    timeout: 620000,
    maxBuffer: 10 * 1024 * 1024,
  });

  let parsed = null;
  try { parsed = JSON.parse(stdout); } catch {}
  const resultText = parsed ? JSON.stringify(parsed, null, 2) : stdout;
  const summary = safeSummary(parsed?.response?.text ?? parsed?.text ?? stdout ?? 'Task completed.');
  const sessionKey = parsed?.sessionKey ?? parsed?.session?.key ?? sessionId;
  const childSessionKey = parsed?.childSessionKey ?? parsed?.session?.childSessionKey;
  const runId = parsed?.runId ?? parsed?.run?.id;

  const updated = await updateTask(taskId, (current) => ({
    ...current,
    status: 'review',
    linkedAutonomyRef: current.linkedAutonomyRef
      ? { ...current.linkedAutonomyRef, section: 'review' }
      : current.linkedAutonomyRef,
    run: {
      sessionKey,
      childSessionKey,
      sessionId,
      runId,
      startedAt: current.run?.startedAt ?? now(),
      endedAt: now(),
      status: 'done',
      summary,
      result: resultText,
    },
  }));
  if (updated.linkedAutonomyRef?.kind === 'autonomous-md') {
    await moveLinkedLegacyTask(updated.linkedAutonomyRef, 'review');
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Autonomous execution failed.';
  const updated = await updateTask(taskId, (current) => ({
    ...current,
    status: 'todo',
    linkedAutonomyRef: current.linkedAutonomyRef
      ? { ...current.linkedAutonomyRef, section: 'open-backlog' }
      : current.linkedAutonomyRef,
    feedback: [
      ...(Array.isArray(current.feedback) ? current.feedback : []),
      { at: now(), by: 'agent:system', note: `Execution failed: ${message}` },
    ],
    run: {
      sessionKey: current.run?.sessionKey ?? sessionId,
      sessionId,
      startedAt: current.run?.startedAt ?? now(),
      endedAt: now(),
      status: 'error',
      error: message,
    },
  }));
  if (updated.linkedAutonomyRef?.kind === 'autonomous-md') {
    await moveLinkedLegacyTask(updated.linkedAutonomyRef, 'open-backlog');
  }
  process.exit(1);
}
