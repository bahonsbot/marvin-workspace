#!/usr/bin/env node
/**
 * Static board sync script
 * Reads AUTONOMOUS.md (Open Backlog) and memory/tasks-log.md to generate static board.json
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = '/data/.openclaw/workspace';
const AUTONOMOUS_PATH = path.join(WORKSPACE, 'AUTONOMOUS.md');
const TASKS_LOG_PATH = path.join(WORKSPACE, 'memory/tasks-log.md');
const OUTPUT_PATH = path.join(__dirname, '../public/board.json');

function extractOpenBacklog(content) {
  const tasks = [];
  const lines = content.split('\n');
  let inBacklog = false;
  
  for (const line of lines) {
    if (line.startsWith('## Open Backlog') || line.startsWith('##open backlog')) {
      inBacklog = true;
      continue;
    }
    if (inBacklog && line.startsWith('- ')) {
      // Match: - [Category] Task description or - [ ] Task
      // Support both checkbox format and [Category] format
      let match = line.match(/- \[([^\]]+)\] (.+)/);
      if (match) {
        const text = match[2].trim();
        const id = Buffer.from(text).toString('base64url').slice(0, 8);
        tasks.push({ id, text, column: 'todo' });
      } else {
        // Try checkbox format
        match = line.match(/- \[([ xX])\] (.+)/);
        if (match) {
          const text = match[2].trim();
          const id = Buffer.from(text).toString('base64url').slice(0, 8);
          tasks.push({ id, text, column: 'todo' });
        }
      }
    }
    if (inBacklog && line.startsWith('##') && !line.toLowerCase().includes('open backlog')) {
      break;
    }
  }
  return tasks;
}

function extractCompletedTasks(content) {
  const tasks = [];
  const lines = content.split('\n');
  let inLog = false;
  
  for (const line of lines) {
    if (line.startsWith('##') && line.toLowerCase().includes('completed')) {
      inLog = true;
      continue;
    }
    if (inLog && line.startsWith('- [')) {
      const match = line.match(/- \[([ xX])\] (.+)/);
      if (match) {
        const text = match[2].trim();
        const id = Buffer.from(text).toString('base64url').slice(0, 8);
        tasks.push({ id, text, column: 'done' });
      }
    }
  }
  return tasks;
}

function main() {
  console.log('🔄 Syncing static board...');
  
  // Read source files
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
  
  // Extract tasks
  const todoTasks = extractOpenBacklog(autonomousContent);
  const doneTasks = extractCompletedTasks(tasksLogContent);
  
  const board = {
    todo: todoTasks,
    inprogress: [],
    done: doneTasks
  };
  
  const output = {
    board,
    updatedAt: new Date().toISOString()
  };
  
  // Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  
  console.log(`✅ Generated ${OUTPUT_PATH}`);
  console.log(`   - Todo: ${board.todo.length}`);
  console.log(`   - In Progress: ${board.inprogress.length}`);
  console.log(`   - Done: ${board.done.length}`);
}

main();