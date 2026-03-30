#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const workspaceRoot = '/data/.openclaw/workspace';
const storePath = path.join(workspaceRoot, 'projects', 'mission-control', 'data', 'autonomous-tasks.json');

function now() { return Date.now(); }
function safeSummary(text) {
  const clean = String(text || '').trim().replace(/\s+/g, ' ');
  return clean.length > 220 ? `${clean.slice(0, 217).trimEnd()}…` : clean;
}
async function loadStore() {
  const raw = await readFile(storePath, 'utf8');
  return JSON.parse(raw);
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

  await updateTask(taskId, (current) => ({
    ...current,
    status: 'review',
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
} catch (error) {
  const message = error instanceof Error ? error.message : 'Autonomous execution failed.';
  await updateTask(taskId, (current) => ({
    ...current,
    status: 'todo',
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
  process.exit(1);
}
