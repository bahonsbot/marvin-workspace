import { NextResponse } from 'next/server';
import { transcribeAudio, TranscribeProviderError } from '@/lib/transcribe';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
]);

type ErrorCode =
  | 'method_not_allowed'
  | 'missing_audio'
  | 'invalid_mime_type'
  | 'file_too_large'
  | 'transcription_failed'
  | 'internal_error';

function normalizeMimeType(input: string): string {
  return input.split(';')[0]?.trim().toLowerCase() || '';
}

function errorResponse(status: number, code: ErrorCode, message: string, details?: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status },
  );
}

function pickAudioFile(form: FormData): File | null {
  const fromAudio = form.get('audio');
  if (fromAudio instanceof File) return fromAudio;
  const fromFile = form.get('file');
  if (fromFile instanceof File) return fromFile;
  return null;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = pickAudioFile(form);

    if (!file) {
      return errorResponse(400, 'missing_audio', 'No audio file was uploaded. Use multipart field "audio" or "file".');
    }

    if (file.size <= 0) {
      return errorResponse(400, 'missing_audio', 'Audio upload is empty.');
    }

    if (file.size > MAX_AUDIO_BYTES) {
      return errorResponse(
        413,
        'file_too_large',
        `Audio file is too large. Max size is ${Math.floor(MAX_AUDIO_BYTES / (1024 * 1024))}MB.`,
      );
    }

    const mimeType = normalizeMimeType(file.type);
    if (!ALLOWED_AUDIO_MIME_TYPES.has(mimeType)) {
      return errorResponse(
        415,
        'invalid_mime_type',
        `Unsupported audio MIME type: ${mimeType || 'unknown'}.`,
        `Allowed types: ${Array.from(ALLOWED_AUDIO_MIME_TYPES).join(', ')}`,
      );
    }

    const result = await transcribeAudio(file);

    return NextResponse.json(
      {
        ok: true,
        text: result.text,
        meta: {
          provider: result.provider,
          model: result.model,
          mimeType,
          bytes: file.size,
          durationMs: result.durationMs,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  } catch (error) {
    if (error instanceof TranscribeProviderError) {
      return errorResponse(error.status, 'transcription_failed', error.message, error.details);
    }

    const details = error instanceof Error ? error.message : undefined;
    return errorResponse(500, 'internal_error', 'Unexpected server error during transcription.', details);
  }
}
