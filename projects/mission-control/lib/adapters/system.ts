import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cache } from 'react';

const execFileAsync = promisify(execFile);

export type SystemStripSummary = {
  hostname: string;
  uptimeSeconds: number;
  cpuCount: number;
  loadAverage: number[];
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPercent: number;
  };
  disk: {
    filesystem: string | null;
    size: string | null;
    used: string | null;
    available: string | null;
    usedPercent: number | null;
    mount: string | null;
  } | null;
  refreshedAt: string;
};

async function getDiskSummary() {
  try {
    const { stdout } = await execFileAsync('bash', ['-lc', "df -kP /data/.openclaw/workspace | tail -1"], {
      timeout: 8000,
      maxBuffer: 1024 * 1024,
    });

    const parts = stdout.trim().split(/\s+/);
    if (parts.length < 6) return null;

    const [filesystem, sizeKb, usedKb, availableKb, usedPercentRaw, ...mountParts] = parts;
    const usedPercent = Number(String(usedPercentRaw).replace('%', ''));
    const sizeGiB = Number(sizeKb) / 1024 / 1024;
    const usedGiB = Number(usedKb) / 1024 / 1024;
    const availGiB = Number(availableKb) / 1024 / 1024;

    return {
      filesystem,
      size: Number.isFinite(sizeGiB) ? `${sizeGiB.toFixed(1)} GB` : null,
      used: Number.isFinite(usedGiB) ? `${usedGiB.toFixed(1)} GB` : null,
      available: Number.isFinite(availGiB) ? `${availGiB.toFixed(1)} GB` : null,
      usedPercent: Number.isFinite(usedPercent) ? usedPercent : null,
      mount: mountParts.join(' ') || null,
    };
  } catch {
    return null;
  }
}

export const getSystemStripSummary = cache(async function getSystemStripSummary(): Promise<SystemStripSummary> {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

  return {
    hostname: os.hostname(),
    uptimeSeconds: os.uptime(),
    cpuCount: os.cpus().length,
    loadAverage: os.loadavg(),
    memory: {
      totalBytes,
      freeBytes,
      usedBytes,
      usedPercent,
    },
    disk: await getDiskSummary(),
    refreshedAt: new Date().toISOString(),
  };
});
