import { NextResponse } from 'next/server';
import { synthesizeLocalSpeech } from '@/lib/local-tts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120;

const MAX_BODY_BYTES = 64 * 1024;

type TtsRequest = {
  text?: unknown;
  speed?: unknown;
};

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: 'piper',
    providers: ['piper'],
    voices: {
      piper: ['joe-medium-int8'],
    },
    defaults: {
      provider: 'piper',
      voice: 'joe-medium-int8',
      speed: 1,
    },
  });
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return errorResponse(413, 'body_too_large', 'TTS request is too large.');
    }

    const payload = await request.json().catch(() => null) as TtsRequest | null;
    const text = typeof payload?.text === 'string' ? payload.text : '';
    if (!text.trim()) {
      return errorResponse(400, 'missing_text', 'No text was provided for read aloud.');
    }

    const speed = typeof payload?.speed === 'number' ? payload.speed : undefined;
    const result = await synthesizeLocalSpeech({ text, speed });

    return new NextResponse(new Uint8Array(result.audio), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Mission-Control-TTS-Provider': result.provider,
        'X-Mission-Control-TTS-Voice': result.voice,
        'X-Mission-Control-TTS-Speed': String(result.speed),
        'X-Mission-Control-TTS-Cached': result.cached ? '1' : '0',
        'X-Mission-Control-TTS-Bytes': String(result.bytes),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TTS generation failed.';
    return errorResponse(500, 'tts_failed', message);
  }
}
