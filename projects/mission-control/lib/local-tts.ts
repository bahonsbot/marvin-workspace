import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PIPER_MODEL_ID = 'sherpa-onnx/vits-piper-en_US-joe-medium-int8';
const DEFAULT_SPEED = 1;
const MAX_TEXT_LENGTH = 1200;
const CACHE_DIR = '/data/.openclaw/workspace/projects/mission-control/.preview-runtime/tts-cache';
const PIPER_VOICE = 'joe-medium-int8';

type SynthesizeOptions = {
  text: string;
  speed?: number;
};

function sanitizeText(text: string): string {
  return text
    .replace(/```(?:[\w.-]+)?\n([\s\S]*?)```/g, '$1')
    .replace(/```([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
    .replace(/_{1,3}(.*?)_{1,3}/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeSpeed(speed: number | undefined): number {
  if (typeof speed !== 'number' || !Number.isFinite(speed)) return DEFAULT_SPEED;
  return Math.min(1.4, Math.max(0.75, Number(speed.toFixed(2))));
}

function cacheKey(text: string, speed: number): string {
  return createHash('sha256')
    .update(JSON.stringify({ model: PIPER_MODEL_ID, provider: 'piper', voice: PIPER_VOICE, speed, text }))
    .digest('hex')
    .slice(0, 32);
}

async function requestPiperWorker(payload: { text: string; speed: number }): Promise<Buffer> {
  const host = process.env.MISSION_CONTROL_PIPER_TTS_HOST || process.env.MISSION_CONTROL_TTS_HOST || '127.0.0.1';
  const port = process.env.MISSION_CONTROL_PIPER_TTS_PORT || '3022';
  const response = await fetch(`http://${host}:${port}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Piper TTS worker returned HTTP ${response.status}${details ? `: ${details}` : ''}`);
  }
  const audio = await response.arrayBuffer();
  return Buffer.from(audio);
}

export async function synthesizeLocalSpeech({ text, speed }: SynthesizeOptions): Promise<{
  audio: Buffer;
  provider: 'piper';
  voice: string;
  speed: number;
  cached: boolean;
  bytes: number;
}> {
  const cleanText = sanitizeText(text);
  if (!cleanText) {
    throw new Error('No speakable text was provided.');
  }

  if (cleanText.length > MAX_TEXT_LENGTH) {
    throw new Error(`TTS chunk is too long. Maximum ${MAX_TEXT_LENGTH} characters per request.`);
  }

  const selectedSpeed = normalizeSpeed(speed);
  const key = cacheKey(cleanText, selectedSpeed);
  const cachePath = join(CACHE_DIR, `${key}.wav`);

  try {
    const cached = await readFile(cachePath);
    return {
      audio: cached,
      provider: 'piper',
      voice: PIPER_VOICE,
      speed: selectedSpeed,
      cached: true,
      bytes: cached.byteLength,
    };
  } catch {
    // Cache miss.
  }

  await mkdir(CACHE_DIR, { recursive: true });
  const wav = await requestPiperWorker({ text: cleanText, speed: selectedSpeed });
  await writeFile(cachePath, wav);

  return {
    audio: wav,
    provider: 'piper',
    voice: PIPER_VOICE,
    speed: selectedSpeed,
    cached: false,
    bytes: wav.byteLength,
  };
}
