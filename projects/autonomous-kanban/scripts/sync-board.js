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

function extractCompletedTasks(content) {
  const tasks = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^- ✅ \[[^\]]+\] \[[^\]]+\] (.+)$/);
    if (match) {
      const text = match[1].trim();
      tasks.push({ id: makeId(text), text, column: 'done' });
    }
  }

  return tasks;
}

function main() {
  console.log('🔄 Syncing static board...');

  let autonomousContent = '';
  let tasksLogContent = '';

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

  const todoTasks = extractSectionTasks(autonomousContent, 'Open Backlog', 'todo');
  const inProgressTasks = extractSectionTasks(autonomousContent, 'In Progress', 'inprogress');
  const doneTasks = extractCompletedTasks(tasksLogContent);

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
