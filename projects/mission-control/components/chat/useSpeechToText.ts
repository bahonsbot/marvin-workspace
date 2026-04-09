'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type SpeechToTextStatus = 'idle' | 'recording' | 'transcribing' | 'error';

type UseSpeechToTextParams = {
  onTranscript: (text: string) => void;
};

type UseSpeechToTextResult = {
  status: SpeechToTextStatus;
  error: string | null;
  isSupported: boolean;
  supportReason: string | null;
  toggleRecording: () => Promise<void>;
};

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }

  return MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

function speechErrorMessage(cause: unknown): string {
  if (cause instanceof DOMException) {
    if (cause.name === 'NotAllowedError' || cause.name === 'SecurityError') {
      return 'Microphone access was denied. Allow microphone permission and try again.';
    }
    if (cause.name === 'NotFoundError' || cause.name === 'DevicesNotFoundError') {
      return 'No microphone was found on this device.';
    }
    if (cause.name === 'NotReadableError') {
      return 'Microphone is busy in another app. Close it there, then try again.';
    }
  }

  if (cause instanceof Error && cause.message.trim().length > 0) {
    return cause.message;
  }

  return 'Voice input failed. Please try again.';
}

function detectSpeechSupport(): { isSupported: boolean; reason: string | null } {
  if (typeof window === 'undefined') {
    return { isSupported: false, reason: 'Voice input is only available in the browser.' };
  }

  if (!window.isSecureContext) {
    return {
      isSupported: false,
      reason: 'Microphone capture requires a secure browser context. Open Mission Control over HTTPS or a trusted local origin.',
    };
  }

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return {
      isSupported: false,
      reason: 'This browser does not expose microphone capture (`getUserMedia`) here.',
    };
  }

  if (typeof window.MediaRecorder === 'undefined') {
    return {
      isSupported: false,
      reason: 'This browser does not expose `MediaRecorder` here. Safari/private-mode compatibility may be the blocker.',
    };
  }

  return { isSupported: true, reason: null };
}

export function useSpeechToText({ onTranscript }: UseSpeechToTextParams): UseSpeechToTextResult {
  const [status, setStatus] = useState<SpeechToTextStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptHandlerRef = useRef(onTranscript);

  useEffect(() => {
    transcriptHandlerRef.current = onTranscript;
  }, [onTranscript]);

  const support = useMemo(() => detectSpeechSupport(), []);
  const isSupported = support.isSupported;
  const supportReason = support.reason;

  const stopActiveTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      try {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      } catch {
        // no-op
      }
      stopActiveTracks();
    };
  }, [stopActiveTracks]);

  const transcribeBlob = useCallback(async (blob: Blob, extension: string) => {
    const form = new FormData();
    form.set('audio', new File([blob], `recording.${extension}`, { type: blob.type || 'application/octet-stream' }));

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: form,
    });

    const payload = (await response.json()) as {
      ok?: boolean;
      text?: string;
      error?: { message?: string };
    };

    if (!response.ok || !payload.ok || typeof payload.text !== 'string') {
      throw new Error(payload.error?.message || 'Transcription failed.');
    }

    const transcript = payload.text.trim();
    if (!transcript) {
      throw new Error('Transcription came back empty.');
    }

    transcriptHandlerRef.current(transcript);
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError(supportReason || 'Voice input is not supported in this browser.');
      setStatus('error');
      return;
    }

    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = (event: Event) => {
        const recorderError = (event as Event & { error?: DOMException }).error;
        setError(speechErrorMessage(recorderError || new Error('Recording failed.')));
        setStatus('error');
      };

      recorder.onstop = () => {
        const finalize = async () => {
          recorderRef.current = null;
          stopActiveTracks();

          if (chunks.length === 0) {
            setError('No audio was captured. Try speaking a bit longer and retry.');
            setStatus('error');
            return;
          }

          try {
            setStatus('transcribing');
            const firstChunkType = chunks[0] instanceof Blob ? chunks[0].type : '';
            const fallbackMime = mimeType || firstChunkType || 'audio/webm';
            const blobType = recorder.mimeType || fallbackMime || 'audio/webm';
            const blob = new Blob(chunks, { type: blobType });
            const extension = blob.type.includes('ogg')
              ? 'ogg'
              : blob.type.includes('mp4')
                ? 'm4a'
                : blob.type.includes('mpeg') || blob.type.includes('mp3')
                  ? 'mp3'
                  : blob.type.includes('wav')
                    ? 'wav'
                    : 'webm';
            await transcribeBlob(blob, extension);
            setStatus('idle');
            setError(null);
          } catch (cause) {
            setError(speechErrorMessage(cause));
            setStatus('error');
          }
        };

        void finalize();
      };

      recorder.start();
      setStatus('recording');
    } catch (cause) {
      setError(speechErrorMessage(cause));
      setStatus('error');
      stopActiveTracks();
    }
  }, [isSupported, supportReason, stopActiveTracks, transcribeBlob]);

  const toggleRecording = useCallback(async () => {
    if (status === 'transcribing') return;

    const recorder = recorderRef.current;
    if (status === 'recording' && recorder && recorder.state !== 'inactive') {
      recorder.stop();
      return;
    }

    await startRecording();
  }, [startRecording, status]);

  return {
    status,
    error,
    isSupported,
    supportReason,
    toggleRecording,
  };
}
