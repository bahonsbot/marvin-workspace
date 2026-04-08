import { existsSync, promises as fs } from "node:fs";

export type ColumnKey = "todo" | "inprogress" | "done";

export type KanbanTask = {
  id: string;
  text: string;
  column: ColumnKey;
};

export type BoardData = {
  todo: KanbanTask[];
  inprogress: KanbanTask[];
  done: KanbanTask[];
};

const AUTONOMOUS_PATH =
  process.env.AUTONOMOUS_FILE_PATH ?? "/data/.openclaw/workspace/AUTONOMOUS.md";
const TASK_LOG_PATH =
  process.env.TASK_LOG_FILE_PATH ??
  "/data/.openclaw/workspace/memory/tasks-log.md";
const QUEUE_PATH =
  process.env.EXECUTOR_QUEUE_FILE_PATH ??
  "/data/.openclaw/workspace/memory/executor-subagent-queue.json";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function toTaskId(column: ColumnKey, text: string, index: number): string {
  const slug = slugify(text) || `task-${index + 1}`;
  return `${column}-${slug}-${index + 1}`;
}

function readSectionBullets(md: string, heading: string): string[] {
  const lines = md.split(/\r?\n/);
  const header = `## ${heading}`;
  const start = lines.findIndex((line) => line.trim() === header);

  if (start < 0) return [];

  const tasks: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();

    if (line.startsWith("## ")) break;

    if (line.startsWith("- ")) {
      const text = line.slice(2).trim();
      if (text && !text.startsWith("*(Empty")) {
        tasks.push(text);
      }
    }
  }

  return tasks;
}

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? "/data/.openclaw/workspace";

function verifiedOutputExists(outputPath: string): boolean {
  return outputPath
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .every((relPath) => existsSync(`${WORKSPACE_ROOT}/${relPath}`));
}

function parseCompletedTasks(md: string): string[] {
  return md
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(/^- ✅ \[[^\]]+\](?: \[[^\]]+\])? (.+?) \| Output: (.+)$/);
      if (!match) return "";
      const [, text, outputPath] = match;
      return verifiedOutputExists(outputPath.trim()) ? text.trim() : "";
    })
    .filter(Boolean);
}

function parseCompletedQueueTasks(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as Array<{ status?: string; task?: string; outputPath?: string }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry?.status === "completed" && entry.task && entry.outputPath)
      .filter((entry) => verifiedOutputExists(String(entry.outputPath)))
      .map((entry) => String(entry.task).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function upsertSectionBullets(md: string, heading: string, tasks: string[]): string {
  const lines = md.split(/\r?\n/);
  const header = `## ${heading}`;
  const sectionStart = lines.findIndex((line) => line.trim() === header);
  const normalized = tasks.map((task) => `- ${task}`);

  if (sectionStart < 0) {
    const appendBlock = ["", header, "", ...normalized];
    return `${md.replace(/\s*$/, "")}\n${appendBlock.join("\n")}\n`;
  }

  let sectionEnd = lines.length;
  for (let i = sectionStart + 1; i < lines.length; i += 1) {
    if (lines[i].trim().startsWith("## ")) {
      sectionEnd = i;
      break;
    }
  }

  const replacement = [header, "", ...normalized];
  const next = [...lines.slice(0, sectionStart), ...replacement, ...lines.slice(sectionEnd)];

  return `${next.join("\n").replace(/\s*$/, "")}\n`;
}

function dedupeTasks(tasks: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const task of tasks) {
    const key = task.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(task);
    }
  }

  return out;
}

export async function readBoardData(): Promise<BoardData> {
  const [autonomousMd, logMd, queueRaw] = await Promise.all([
    fs.readFile(AUTONOMOUS_PATH, "utf8"),
    fs.readFile(TASK_LOG_PATH, "utf8").catch(() => ""),
    fs.readFile(QUEUE_PATH, "utf8").catch(() => "[]"),
  ]);

  const todo = readSectionBullets(autonomousMd, "Open Backlog");
  const inprogress = readSectionBullets(autonomousMd, "In Progress");
  const done = dedupeTasks([...parseCompletedTasks(logMd), ...parseCompletedQueueTasks(queueRaw)]);

  return {
    todo: todo.map((text, index) => ({ id: toTaskId("todo", text, index), text, column: "todo" })),
    inprogress: inprogress.map((text, index) => ({
      id: toTaskId("inprogress", text, index),
      text,
      column: "inprogress",
    })),
    done: done.map((text, index) => ({ id: toTaskId("done", text, index), text, column: "done" })),
  };
}

export async function moveTask(taskText: string, from: ColumnKey, to: ColumnKey): Promise<void> {
  if (!taskText.trim() || from === to) return;

  const [autonomousMdRaw, taskLogRaw] = await Promise.all([
    fs.readFile(AUTONOMOUS_PATH, "utf8"),
    fs.readFile(TASK_LOG_PATH, "utf8"),
  ]);

  let todo = readSectionBullets(autonomousMdRaw, "Open Backlog");
  let inprogress = readSectionBullets(autonomousMdRaw, "In Progress");

  if (from === "todo") {
    todo = todo.filter((task) => task.toLowerCase() !== taskText.toLowerCase());
  }
  if (from === "inprogress") {
    inprogress = inprogress.filter((task) => task.toLowerCase() !== taskText.toLowerCase());
  }

  if (to === "todo") {
    todo = dedupeTasks([taskText, ...todo]);
  }

  if (to === "inprogress") {
    inprogress = dedupeTasks([taskText, ...inprogress]);
  }

  let autonomousMd = upsertSectionBullets(autonomousMdRaw, "Open Backlog", todo);
  autonomousMd = upsertSectionBullets(autonomousMd, "In Progress", inprogress);

  let nextTaskLog = taskLogRaw;
  if (to === "done") {
    nextTaskLog = `${taskLogRaw.replace(/\s*$/, "")}\n- ✅ ${taskText}\n`;
  }

  await Promise.all([
    fs.writeFile(AUTONOMOUS_PATH, autonomousMd, "utf8"),
    fs.writeFile(TASK_LOG_PATH, nextTaskLog, "utf8"),
  ]);
}
