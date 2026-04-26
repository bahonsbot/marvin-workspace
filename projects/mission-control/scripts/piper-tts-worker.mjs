#!/usr/bin/env node
import { createServer } from 'node:http';
import sherpa from 'sherpa-onnx';

const HOST = process.env.MISSION_CONTROL_PIPER_TTS_HOST || process.env.MISSION_CONTROL_TTS_HOST || '127.0.0.1';
const PORT = Number(process.env.MISSION_CONTROL_PIPER_TTS_PORT || 3022);
const MODEL_DIR = process.env.MISSION_CONTROL_PIPER_TTS_MODEL_DIR || '/data/.openclaw/tools/sherpa-onnx-tts/models/vits-piper-en_US-joe-medium-int8';
const MODEL_NAME = process.env.MISSION_CONTROL_PIPER_TTS_MODEL_NAME || 'joe-medium-int8';
const MODEL_FILE = process.env.MISSION_CONTROL_PIPER_TTS_MODEL_FILE || `${MODEL_DIR}/en_US-joe-medium.onnx`;
const TOKENS_FILE = process.env.MISSION_CONTROL_PIPER_TTS_TOKENS_FILE || `${MODEL_DIR}/tokens.txt`;
const DATA_DIR = process.env.MISSION_CONTROL_PIPER_TTS_DATA_DIR || `${MODEL_DIR}/espeak-ng-data`;

let ttsPromise;
let loadedAt = null;
let sampleRate = 22050;

function createConfig() {
  return {
    offlineTtsModelConfig: {
      offlineTtsVitsModelConfig: {
        model: MODEL_FILE,
        tokens: TOKENS_FILE,
        dataDir: DATA_DIR,
        noiseScale: 0.667,
        noiseScaleW: 0.8,
        lengthScale: 1,
      },
      offlineTtsMatchaModelConfig: { acousticModel: '', vocoder: '', lexicon: '', tokens: '', dataDir: '', noiseScale: 0.667, lengthScale: 1 },
      offlineTtsKokoroModelConfig: { model: '', voices: '', tokens: '', dataDir: '', lengthScale: 1, lexicon: '', lang: '' },
      offlineTtsKittenModelConfig: { model: '', voices: '', tokens: '', dataDir: '', lengthScale: 1 },
      offlineTtsZipVoiceModelConfig: { tokens: '', encoder: '', decoder: '', vocoder: '', dataDir: '', lexicon: '', featScale: 0.1, tShift: 0.5, targetRMS: 0.1, guidanceScale: 1 },
      offlineTtsPocketModelConfig: { lmFlow: '', lmMain: '', encoder: '', decoder: '', textConditioner: '', vocabJson: '', tokenScoresJson: '', voiceEmbeddingCacheCapacity: 50 },
      numThreads: Number(process.env.MISSION_CONTROL_PIPER_TTS_THREADS || 1),
      debug: 0,
      provider: 'cpu',
    },
    ruleFsts: '',
    ruleFars: '',
    maxNumSentences: 1,
    silenceScale: 0.2,
  };
}

async function getTts() {
  if (!ttsPromise) {
    const started = Date.now();
    ttsPromise = Promise.resolve().then(() => {
      const tts = sherpa.createOfflineTts(createConfig());
      sampleRate = tts.sampleRate || sampleRate;
      loadedAt = Date.now();
      console.log(`[piper-tts-worker] loaded ${MODEL_NAME} in ${loadedAt - started}ms sampleRate=${sampleRate}`);
      return tts;
    }).catch((error) => {
      ttsPromise = undefined;
      throw error;
    });
  }
  return ttsPromise;
}

function json(res, status, body) {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': String(payload.byteLength),
  });
  res.end(payload);
}

function readBody(req, maxBytes = 128 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.byteLength;
      if (total > maxBytes) {
        reject(new Error('Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function wavFromFloat32(samples, rate = sampleRate) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i] || 0));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return buffer;
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/healthz') {
      json(res, 200, { ok: true, provider: 'piper', model: MODEL_NAME, loaded: Boolean(loadedAt), sampleRate });
      return;
    }

    if (req.method === 'POST' && req.url === '/warm') {
      const started = Date.now();
      await getTts();
      json(res, 200, { ok: true, provider: 'piper', model: MODEL_NAME, loadedMs: Date.now() - started });
      return;
    }

    if (req.method === 'POST' && req.url === '/synthesize') {
      const payload = JSON.parse(await readBody(req));
      const text = String(payload.text || '').trim();
      const speed = Number.isFinite(Number(payload.speed)) ? Number(payload.speed) : 1;
      if (!text) {
        json(res, 400, { ok: false, error: 'No text provided.' });
        return;
      }

      const started = Date.now();
      const tts = await getTts();
      const audio = tts.generate({ text, speed });
      const wav = wavFromFloat32(audio.samples, audio.sampleRate || sampleRate);
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': String(wav.byteLength),
        'X-Mission-Control-TTS-Worker-Ms': String(Date.now() - started),
        'X-Mission-Control-TTS-Provider': 'piper',
        'X-Mission-Control-TTS-Model': MODEL_NAME,
      });
      res.end(wav);
      return;
    }

    json(res, 404, { ok: false, error: 'Not found.' });
  } catch (error) {
    json(res, 500, { ok: false, error: error instanceof Error ? error.message : 'Piper TTS worker failed.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[piper-tts-worker] listening on http://${HOST}:${PORT}`);
});

function shutdown() {
  server.close(async () => {
    try {
      const tts = ttsPromise ? await ttsPromise : null;
      tts?.free?.();
    } catch {}
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
