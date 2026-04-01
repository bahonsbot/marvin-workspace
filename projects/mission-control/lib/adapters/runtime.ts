import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function runJsonCommand(command: string, timeoutMs = 15000): Promise<unknown> {
  const { stdout } = await execFileAsync('bash', ['-lc', command], {
    timeout: timeoutMs,
    maxBuffer: 5 * 1024 * 1024,
  });

  return JSON.parse(stdout);
}

export async function readJsonlFile(path: string, limit = 200): Promise<Array<Record<string, unknown>>> {
  const raw = await fs.readFile(path, 'utf8');
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(-limit);

  return lines
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
}
