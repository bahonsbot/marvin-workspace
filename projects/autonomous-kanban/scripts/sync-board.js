#!/usr/bin/env node
/**
 * Static board sync script
 * Reads AUTONOMOUS.md (Open Backlog + In Progress) and memory/tasks-log.md to generate static board.json.
 * Supports current task log format: `- ✅ [YYYY-MM-DD HH:MM] [Category] task text`
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORKSPACE = '/data/.openclaw/workspace';
const AUTONOMOUS_PATH = path.join(WORKSPACE, 'AUTONOMOUS.md');
const TASKS_LOG_PATH = path.join(WORKSPACE, 'memory/tasks-log.md');
const QUEUE_PATH = path.join(WORKSPACE, 'memory/executor-subagent-queue.json');
const OUTPUT_PATH = path.join(__dirname, '../public/board.json');

function makeId(text) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 8);
}

function extractSectionTasks(content, sectionName, column) {
  const tasks = [];
  const lines = content.split('\n');
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith(`## ${sectionName}`)) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith('## ')) {
      break;
    }
    if (inSection && line.startsWith('- ')) {
      const text = line.slice(2).trim();
      if (!text || text.startsWith('*(')) continue;
      tasks.push({ id: makeId(text), text, column });
    }
  }

  return tasks;
}

function verifiedOutputExists(outputPath) {
  return String(outputPath || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .every((relPath) => fs.existsSync(path.join(WORKSPACE, relPath)));
}

function extractCompletedTasks(content) {
  const tasks = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^- ✅ \[[^\]]+\](?: \[[^\]]+\])? (.+?) \| Output: (.+)$/);
    if (match) {
      const text = match[1].trim();
      const outputPath = match[2].trim();
      if (!verifiedOutputExists(outputPath)) continue;
      tasks.push({ id: makeId(text), text, column: 'done', outputPath, source: 'tasks-log' });
    }
  }

  return tasks;
}

function extractCompletedQueueTasks(queueContent) {
  let queue = [];
  try {
    queue = JSON.parse(queueContent);
  } catch {
    return [];
  }

  if (!Array.isArray(queue)) return [];

  const tasks = [];
  for (const entry of queue) {
    if (entry?.status !== 'completed') continue;
    const text = String(entry.task || '').trim();
    const outputPath = String(entry.outputPath || '').trim();
    if (!text || !outputPath || !verifiedOutputExists(outputPath)) continue;
    tasks.push({ id: makeId(text), text, column: 'done', outputPath, source: 'queue' });
  }

  return tasks;
}

function main() {
  console.log('🔄 Syncing static board...');

  let autonomousContent = '';
  let tasksLogContent = '';
  let queueContent = '[]';

  try {
    autonomousContent = fs.readFileSync(AUTONOMOUS_PATH, 'utf-8');
  } catch (err) {
    console.error('⚠️  Could not read AUTONOMOUS.md:', err.message);
  }

  try {
    tasksLogContent = fs.readFileSync(TASKS_LOG_PATH, 'utf-8');
  } catch (err) {
    console.log('⚠️  No tasks-log.md found (starting fresh)');
  }

  try {
    queueContent = fs.readFileSync(QUEUE_PATH, 'utf-8');
  } catch (err) {
    console.log('⚠️  No executor queue found (skipping queue-backed completions)');
  }

  const todoTasks = extractSectionTasks(autonomousContent, 'Open Backlog', 'todo');
  const inProgressTasks = extractSectionTasks(autonomousContent, 'In Progress', 'inprogress');
  const doneTasks = [...extractCompletedTasks(tasksLogContent), ...extractCompletedQueueTasks(queueContent)]
    .filter((task, index, arr) => arr.findIndex((candidate) => candidate.text.toLowerCase() === task.text.toLowerCase()) === index);

  const board = {
    todo: todoTasks,
    inprogress: inProgressTasks,
    done: doneTasks,
  };

  const output = {
    board,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log(`✅ Generated ${OUTPUT_PATH}`);
  console.log(`   - Todo: ${board.todo.length}`);
  console.log(`   - In Progress: ${board.inprogress.length}`);
  console.log(`   - Done: ${board.done.length}`);
}

main();
