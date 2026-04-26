import { execFileSync, spawn } from 'node:child_process';
import { accessSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { initWhisper } from '@fugood/whisper.node';
import type { WhisperContext, TranscribeOptions } from '@fugood/whisper.node';

const DEFAULT_PROVIDER = 'openai';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini-transcribe';
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_WHISPER_MODEL = 'base.en';
const DEFAULT_WHISPER_MODEL_DIR = join(homedir(), '.nerve', 'models');
const DEFAULT_MOONSHINE_MODEL = 'tiny-streaming';
const DEFAULT_MOONSHINE_SCRIPT = '/data/.openclaw/workspace/projects/mission-control/scripts/moonshine-transcribe.py';
const DEFAULT_MOONSHINE_PYTHONPATH = '/data/.openclaw/tools/moonshine-voice-python';
const DEFAULT_MOONSHINE_CACHE_DIR = '/data/.openclaw/tools/moonshine-voice-cache';
const DEFAULT_MOONSHINE_WORKER_HOST = '127.0.0.1';
const DEFAULT_MOONSHINE_WORKER_PORT = '3023';

const WHISPER_MODEL_FILES: Record<string, string> = {
  'tiny.en': 'ggml-tiny.en.bin',
  'base.en': 'ggml-base.en.bin',
  'small.en': 'ggml-small.en.bin',
  tiny: 'ggml-tiny.bin',
  base: 'ggml-base.bin',
  small: 'ggml-small.bin',
};

export type TranscribeSuccess = {
  provider: string;
  model: string;
  text: string;
  durationMs: number;
};

export class TranscribeProviderError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: string;

  constructor(params: { status: number; code: string; message: string; details?: string }) {
    super(params.message);
    this.name = 'TranscribeProviderError';
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
  }
}

let whisperContext: WhisperContext | null = null;
let whisperContextModelPath: string | null = null;
let whisperContextInitializing: Promise<WhisperContext> | null = null;
let ffmpegAvailable: boolean | null = null;
let ffmpegCommand: string | null = null;

function normalizeBaseUrl(raw: string | undefined): string {
  const input = (raw || DEFAULT_BASE_URL).trim();
  return input.endsWith('/') ? input.slice(0, -1) : input;
}

function parseTimeoutMs(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.max(2_000, Math.floor(parsed));
}

function parseProviderError(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const nested = record.error;
  if (nested && typeof nested === 'object') {
    const message = (nested as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim().length > 0) return message.trim();
  }
  const message = record.message;
  return typeof message === 'string' && message.trim().length > 0 ? message.trim() : null;
}

function resolveProvider(): string {
  return (process.env.MISSION_CONTROL_TRANSCRIBE_PROVIDER || DEFAULT_PROVIDER).trim().toLowerCase();
}

function resolveWhisperModel(): string {
  const model = (process.env.MISSION_CONTROL_WHISPER_MODEL || DEFAULT_WHISPER_MODEL).trim();
  return WHISPER_MODEL_FILES[model] ? model : DEFAULT_WHISPER_MODEL;
}

function resolveWhisperModelDir(): string {
  const raw = (process.env.MISSION_CONTROL_WHISPER_MODEL_DIR || DEFAULT_WHISPER_MODEL_DIR).trim();
  if (raw.startsWith('~/')) return join(homedir(), raw.slice(2));
  return raw;
}

function resolveWhisperModelPath(): { model: string; path: string } {
  const explicitPath = (process.env.MISSION_CONTROL_WHISPER_MODEL_PATH || '').trim();
  if (explicitPath) {
    const normalized = explicitPath.startsWith('~/') ? join(homedir(), explicitPath.slice(2)) : explicitPath;
    return {
      model: resolveWhisperModel(),
      path: normalized,
    };
  }
  const model = resolveWhisperModel();
  const filename = WHISPER_MODEL_FILES[model];
  return {
    model,
    path: join(resolveWhisperModelDir(), filename),
  };
}

function ffmpegMissingError(details?: string): TranscribeProviderError {
  return new TranscribeProviderError({
    status: 503,
    code: 'ffmpeg_missing',
    message: 'ffmpeg is not available for local transcription.',
    details: details || 'Install ffmpeg, set MISSION_CONTROL_FFMPEG_PATH, or switch MISSION_CONTROL_TRANSCRIBE_PROVIDER=openai.',
  });
}

function ffmpegCandidates(): string[] {
  const explicit = (process.env.MISSION_CONTROL_FFMPEG_PATH || '').trim();
  return Array.from(new Set([
    ...(explicit ? [explicit] : []),
    'ffmpeg',
    '/home/linuxbrew/.linuxbrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
  ]));
}

function resolveFfmpegCommand(): string {
  if (ffmpegAvailable === true && ffmpegCommand) return ffmpegCommand;
  if (ffmpegAvailable === false) {
    throw ffmpegMissingError();
  }

  const checked: string[] = [];
  for (const candidate of ffmpegCandidates()) {
    checked.push(candidate);
    try {
      execFileSync(candidate, ['-version'], { stdio: 'pipe', timeout: 5000 });
      ffmpegAvailable = true;
      ffmpegCommand = candidate;
      return candidate;
    } catch {
      // Try the next known runtime location before surfacing the missing-tool error.
    }
  }

  ffmpegAvailable = false;
  throw ffmpegMissingError(`Checked: ${checked.join(', ')}. Install ffmpeg, set MISSION_CONTROL_FFMPEG_PATH, or switch MISSION_CONTROL_TRANSCRIBE_PROVIDER=openai.`);
}

function ensureFfmpegAvailable() {
  resolveFfmpegCommand();
}

function ensureWhisperModelExists(modelPath: string) {
  try {
    accessSync(modelPath);
  } catch {
    throw new TranscribeProviderError({
      status: 503,
      code: 'local_model_missing',
      message: 'Local Whisper model is not available.',
      details: `Expected model file at ${modelPath}. Set MISSION_CONTROL_WHISPER_MODEL_PATH or MISSION_CONTROL_WHISPER_MODEL_DIR, or switch provider.`,
    });
  }
}

async function releaseWhisperContext() {
  if (whisperContext) {
    await whisperContext.release();
    whisperContext = null;
    whisperContextModelPath = null;
  }
}

async function getWhisperContext(modelPath: string): Promise<WhisperContext> {
  if (whisperContext && whisperContextModelPath === modelPath) return whisperContext;

  if (whisperContext && whisperContextModelPath !== modelPath) {
    await releaseWhisperContext();
  }

  if (whisperContextInitializing) return whisperContextInitializing;

  whisperContextInitializing = initWhisper({
    filePath: modelPath,
    useGpu: true,
  }).then((ctx) => {
    whisperContext = ctx;
    whisperContextModelPath = modelPath;
    whisperContextInitializing = null;
    return ctx;
  }).catch((error) => {
    whisperContextInitializing = null;
    throw error;
  });

  return whisperContextInitializing;
}

function convertToWav(inputPath: string, outputPath: string) {
  execFileSync(resolveFfmpegCommand(), [
    '-i', inputPath,
    '-ar', '16000',
    '-ac', '1',
    '-sample_fmt', 's16',
    '-f', 'wav',
    '-y',
    outputPath,
  ], { stdio: 'pipe', timeout: 30_000 });
}

function runMoonshineScript(wavPath: string): Promise<{ text: string; model: string; durationMs?: number }> {
  return new Promise((resolve, reject) => {
    const script = (process.env.MISSION_CONTROL_MOONSHINE_SCRIPT || DEFAULT_MOONSHINE_SCRIPT).trim();
    const child = spawn('python3', [script, wavPath], {
      env: {
        ...process.env,
        PYTHONPATH: process.env.MISSION_CONTROL_MOONSHINE_PYTHONPATH || DEFAULT_MOONSHINE_PYTHONPATH,
        MISSION_CONTROL_MOONSHINE_PYTHONPATH: process.env.MISSION_CONTROL_MOONSHINE_PYTHONPATH || DEFAULT_MOONSHINE_PYTHONPATH,
        MISSION_CONTROL_MOONSHINE_CACHE_DIR: process.env.MISSION_CONTROL_MOONSHINE_CACHE_DIR || DEFAULT_MOONSHINE_CACHE_DIR,
        MISSION_CONTROL_MOONSHINE_MODEL: process.env.MISSION_CONTROL_MOONSHINE_MODEL || DEFAULT_MOONSHINE_MODEL,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timeoutMs = parseTimeoutMs(process.env.MISSION_CONTROL_MOONSHINE_TIMEOUT_MS || '60000');
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new TranscribeProviderError({
        status: 504,
        code: 'provider_timeout',
        message: 'Moonshine transcription timed out.',
      }));
    }, timeoutMs);

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      let payload: Record<string, unknown> | null = null;
      try {
        payload = JSON.parse(stdout.trim().split('\n').filter(Boolean).at(-1) || '{}') as Record<string, unknown>;
      } catch {
        payload = null;
      }

      if (code !== 0 || !payload?.ok) {
        reject(new TranscribeProviderError({
          status: 502,
          code: 'provider_unreachable',
          message: 'Moonshine transcription failed.',
          details: typeof payload?.error === 'string' ? payload.error : stderr.trim() || stdout.trim() || undefined,
        }));
        return;
      }

      const text = typeof payload.text === 'string' ? payload.text.trim() : '';
      const model = typeof payload.model === 'string' ? payload.model : `moonshine-voice/${DEFAULT_MOONSHINE_MODEL}`;
      const durationMs = typeof payload.durationMs === 'number' ? payload.durationMs : undefined;
      resolve({ text, model, durationMs });
    });
  });
}

async function transcribeWithMoonshineWorker(wavPath: string): Promise<{ text: string; model: string; durationMs?: number } | null> {
  const host = (process.env.MISSION_CONTROL_MOONSHINE_STT_HOST || DEFAULT_MOONSHINE_WORKER_HOST).trim();
  const port = (process.env.MISSION_CONTROL_MOONSHINE_STT_PORT || DEFAULT_MOONSHINE_WORKER_PORT).trim();
  const timeoutMs = parseTimeoutMs(process.env.MISSION_CONTROL_MOONSHINE_WORKER_TIMEOUT_MS || '60000');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`http://${host}:${port}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wavPath }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok || !payload?.ok) {
      return null;
    }
    return {
      text: typeof payload.text === 'string' ? payload.text.trim() : '',
      model: typeof payload.model === 'string' ? payload.model : `moonshine-voice/${DEFAULT_MOONSHINE_MODEL}`,
      durationMs: typeof payload.durationMs === 'number' ? payload.durationMs : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function transcribeMoonshine(file: File): Promise<TranscribeSuccess> {
  ensureFfmpegAvailable();
  const id = randomUUID().slice(0, 8);
  const inputTmp = join(tmpdir(), `mc-moonshine-in-${id}-${file.name || 'recording.webm'}`);
  const wavTmp = join(tmpdir(), `mc-moonshine-${id}.wav`);
  const startedAt = Date.now();

  try {
    const arrayBuffer = await file.arrayBuffer();
    writeFileSync(inputTmp, Buffer.from(arrayBuffer));

    try {
      convertToWav(inputTmp, wavTmp);
    } catch (error) {
      throw new TranscribeProviderError({
        status: 500,
        code: 'audio_conversion_failed',
        message: 'Audio format conversion failed.',
        details: error instanceof Error ? error.message : undefined,
      });
    }

    const result = await transcribeWithMoonshineWorker(wavTmp) ?? await runMoonshineScript(wavTmp);
    if (!result.text) {
      throw new TranscribeProviderError({
        status: 502,
        code: 'provider_empty_transcript',
        message: 'Moonshine returned an empty transcript.',
      });
    }

    return {
      provider: 'moonshine',
      model: result.model,
      text: result.text,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof TranscribeProviderError) throw error;
    throw new TranscribeProviderError({
      status: 502,
      code: 'provider_unreachable',
      message: 'Moonshine transcription failed.',
      details: error instanceof Error ? error.message : undefined,
    });
  } finally {
    try { unlinkSync(inputTmp); } catch {}
    try { unlinkSync(wavTmp); } catch {}
  }
}

async function transcribeLocal(file: File): Promise<TranscribeSuccess> {
  ensureFfmpegAvailable();
  const { model, path: modelPath } = resolveWhisperModelPath();
  ensureWhisperModelExists(modelPath);

  const id = randomUUID().slice(0, 8);
  const inputTmp = join(tmpdir(), `mc-stt-in-${id}-${file.name || 'recording.webm'}`);
  const wavTmp = join(tmpdir(), `mc-stt-${id}.wav`);
  const startedAt = Date.now();

  try {
    const arrayBuffer = await file.arrayBuffer();
    writeFileSync(inputTmp, Buffer.from(arrayBuffer));

    try {
      convertToWav(inputTmp, wavTmp);
    } catch (error) {
      throw new TranscribeProviderError({
        status: 500,
        code: 'audio_conversion_failed',
        message: 'Audio format conversion failed.',
        details: error instanceof Error ? error.message : undefined,
      });
    }

    const context = await getWhisperContext(modelPath);
    const language = model.endsWith('.en') ? 'en' : ((process.env.MISSION_CONTROL_TRANSCRIBE_LANGUAGE || '').trim() || undefined);
    const options: TranscribeOptions = {
      temperature: 0,
      ...(language ? { language } : {}),
    };

    const { promise } = context.transcribeFile(wavTmp, options);
    const result = await promise;

    if (result.isAborted) {
      throw new TranscribeProviderError({
        status: 500,
        code: 'local_transcription_aborted',
        message: 'Local transcription was aborted.',
      });
    }

    const text = result.result?.trim() || '';
    if (!text) {
      throw new TranscribeProviderError({
        status: 502,
        code: 'provider_empty_transcript',
        message: 'Local transcription returned an empty transcript.',
      });
    }

    return {
      provider: 'local',
      model,
      text,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof TranscribeProviderError) throw error;
    throw new TranscribeProviderError({
      status: 502,
      code: 'provider_unreachable',
      message: 'Local transcription failed.',
      details: error instanceof Error ? error.message : undefined,
    });
  } finally {
    try { unlinkSync(inputTmp); } catch {}
    try { unlinkSync(wavTmp); } catch {}
  }
}

async function transcribeOpenAi(file: File): Promise<TranscribeSuccess> {
  const apiKey = (process.env.MISSION_CONTROL_TRANSCRIBE_API_KEY || '').trim();
  if (!apiKey) {
    throw new TranscribeProviderError({
      status: 503,
      code: 'provider_not_configured',
      message: 'Transcription provider is not configured.',
      details: 'MISSION_CONTROL_TRANSCRIBE_API_KEY is missing.',
    });
  }

  const model = (process.env.MISSION_CONTROL_TRANSCRIBE_MODEL || DEFAULT_OPENAI_MODEL).trim();
  const baseUrl = normalizeBaseUrl(process.env.MISSION_CONTROL_TRANSCRIBE_BASE_URL);
  const timeoutMs = parseTimeoutMs(process.env.MISSION_CONTROL_TRANSCRIBE_TIMEOUT_MS);

  const form = new FormData();
  form.set('model', model);
  form.set('response_format', 'json');
  form.set('file', file, file.name || 'recording.webm');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      signal: controller.signal,
    });

    const textBody = await response.text();
    let parsedBody: unknown = null;
    try {
      parsedBody = textBody.length > 0 ? JSON.parse(textBody) : null;
    } catch {
      parsedBody = null;
    }

    if (!response.ok) {
      const message = parseProviderError(parsedBody) || `Transcription provider returned HTTP ${response.status}.`;
      throw new TranscribeProviderError({
        status: response.status >= 500 ? 502 : response.status,
        code: 'provider_request_failed',
        message,
      });
    }

    const text =
      parsedBody && typeof parsedBody === 'object' && typeof (parsedBody as Record<string, unknown>).text === 'string'
        ? (parsedBody as Record<string, string>).text.trim()
        : '';

    if (!text) {
      throw new TranscribeProviderError({
        status: 502,
        code: 'provider_empty_transcript',
        message: 'Transcription provider returned an empty transcript.',
      });
    }

    return {
      provider: 'openai',
      model,
      text,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof TranscribeProviderError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new TranscribeProviderError({
        status: 504,
        code: 'provider_timeout',
        message: 'Transcription timed out.',
      });
    }

    throw new TranscribeProviderError({
      status: 502,
      code: 'provider_unreachable',
      message: 'Failed to reach transcription provider.',
      details: error instanceof Error ? error.message : undefined,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function transcribeAudio(file: File): Promise<TranscribeSuccess> {
  const provider = resolveProvider();
  if (provider === 'local') {
    return transcribeLocal(file);
  }
  if (provider === 'moonshine') {
    return transcribeMoonshine(file);
  }
  if (provider === 'openai') {
    return transcribeOpenAi(file);
  }
  throw new TranscribeProviderError({
    status: 500,
    code: 'provider_not_supported',
    message: `Unsupported transcription provider: ${provider}`,
  });
}
