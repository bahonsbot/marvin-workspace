'use client';

import { useEffect, useRef, useState } from 'react';

type ReadAloudButtonProps = {
  text: string;
  title?: string;
};

let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let activeToken: symbol | null = null;
let activeController: AbortController | null = null;
const subscribers = new Set<() => void>();

function canUseSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber());
}

function sanitizeSpeechText(text: string): string {
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

function splitSpeechChunks(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  const maxLength = 80;

  for (const paragraph of paragraphs.length ? paragraphs : [text]) {
    const sentences = paragraph.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [paragraph];
    let current = '';
    for (const sentence of sentences.map((part) => part.trim()).filter(Boolean)) {
      if (!current) {
        current = sentence;
      } else if (`${current} ${sentence}`.length <= maxLength) {
        current = `${current} ${sentence}`;
      } else {
        chunks.push(current);
        current = sentence;
      }

      while (current.length > maxLength) {
        const slicePoint = current.lastIndexOf(' ', maxLength);
        const end = slicePoint > 28 ? slicePoint : maxLength;
        chunks.push(current.slice(0, end).trim());
        current = current.slice(end).trim();
      }
    }
    if (current) chunks.push(current);
  }

  return chunks.filter(Boolean);
}

function releaseAudioUrl() {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

function stopReading() {
  activeController?.abort();
  activeController = null;
  activeUtterance = null;
  activeToken = null;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = '';
    activeAudio = null;
  }
  releaseAudioUrl();
  if (canUseSpeechSynthesis()) {
    window.speechSynthesis.cancel();
  }
  notifySubscribers();
}

function subscribeToSpeechState(subscriber: () => void): () => void {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

function getIsReading(token: symbol): boolean {
  const audioActive = activeToken === token && activeAudio !== null && !activeAudio.paused && !activeAudio.ended;
  const browserActive = canUseSpeechSynthesis() && activeToken === token && (window.speechSynthesis.speaking || window.speechSynthesis.pending);
  return audioActive || browserActive;
}

function ReadAloudIcon({ active, loading }: { active: boolean; loading: boolean }) {
  if (loading) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.7" opacity="0.26" />
        <path d="M19 12a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (active) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
        <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9.5v5h3.2L12 18.4V5.6L7.2 9.5H4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M16 8.2a5.2 5.2 0 0 1 0 7.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M18.8 5.6a9.1 9.1 0 0 1 0 12.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function speakWithBrowserFallback(text: string, token: symbol) {
  if (!canUseSpeechSynthesis()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.addEventListener('start', notifySubscribers);
  utterance.addEventListener('end', () => {
    if (activeUtterance === utterance) {
      activeUtterance = null;
      activeToken = null;
    }
    notifySubscribers();
  });
  utterance.addEventListener('error', (event) => {
    if (event.error !== 'canceled' && event.error !== 'interrupted') {
      console.warn('Read aloud failed:', event.error);
    }
    if (activeUtterance === utterance) {
      activeUtterance = null;
      activeToken = null;
    }
    notifySubscribers();
  });
  activeUtterance = utterance;
  activeToken = token;
  window.speechSynthesis.speak(utterance);
  notifySubscribers();
}

async function fetchTtsChunk(text: string, signal: AbortSignal): Promise<Blob> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, speed: 1 }),
    signal,
  });
  if (!response.ok) throw new Error(`TTS returned HTTP ${response.status}`);
  return response.blob();
}

function playAudioBlob(blob: Blob, token: symbol, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    releaseAudioUrl();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    activeAudio = audio;
    activeObjectUrl = url;
    activeToken = token;

    const cleanup = () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
      if (activeAudio === audio) activeAudio = null;
      releaseAudioUrl();
      notifySubscribers();
    };
    const onEnded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Audio playback failed.'));
    };
    const onAbort = () => {
      audio.pause();
      audio.src = '';
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    signal.addEventListener('abort', onAbort, { once: true });
    audio.play().then(() => notifySubscribers()).catch((error) => {
      cleanup();
      reject(error);
    });
  });
}

async function playTtsChunks(chunks: string[], token: symbol, signal: AbortSignal) {
  let nextChunkPromise: Promise<Blob> = fetchTtsChunk(chunks[0], signal);

  for (let index = 0; index < chunks.length; index += 1) {
    if (signal.aborted || activeToken !== token) return;
    const currentBlob = await nextChunkPromise;
    const followingChunkPromise = index + 1 < chunks.length ? fetchTtsChunk(chunks[index + 1], signal) : null;
    await playAudioBlob(currentBlob, token, signal);
    if (!followingChunkPromise) return;
    nextChunkPromise = followingChunkPromise;
  }
}

export function ReadAloudButton({ text, title = 'Read aloud' }: ReadAloudButtonProps) {
  const [token] = useState(() => Symbol('read-aloud'));
  const [supported, setSupported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, forceRender] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const speechText = sanitizeSpeechText(text);
  const active = supported && (activeToken === token || getIsReading(token));

  useEffect(() => {
    setSupported(canUseSpeechSynthesis() || typeof Audio !== 'undefined');
    return subscribeToSpeechState(() => forceRender((value) => value + 1));
  }, []);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (activeToken === token) stopReading();
  }, [token]);

  if (!supported || !speechText) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        if (active || loading) {
          abortRef.current?.abort();
          stopReading();
          setLoading(false);
          return;
        }

        stopReading();
        activeToken = token;
        setLoading(true);
        notifySubscribers();
        const controller = new AbortController();
        abortRef.current = controller;
        activeController = controller;
        const chunks = splitSpeechChunks(speechText);

        try {
          await playTtsChunks(chunks, token, controller.signal);
        } catch (error) {
          if (!(error instanceof Error && error.name === 'AbortError') && !controller.signal.aborted) {
            console.warn('Local read aloud failed, falling back to browser speech:', error);
            speakWithBrowserFallback(speechText, token);
          }
        } finally {
          if (abortRef.current === controller) abortRef.current = null;
          if (activeController === controller) activeController = null;
          if (activeToken === token && !getIsReading(token)) activeToken = null;
          setLoading(false);
          notifySubscribers();
        }
      }}
      aria-label={loading ? 'Generating speech' : active ? 'Stop speaking' : title}
      title={loading ? 'Generating speech' : active ? 'Stop speaking' : title}
      style={{
        border: '1px solid rgba(200, 195, 188, 0.28)',
        background: active ? 'rgba(232, 239, 235, 0.94)' : 'rgba(255, 255, 255, 0.72)',
        color: active ? '#163b31' : 'var(--text-muted)',
        borderRadius: 999,
        minWidth: 34,
        height: 34,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: loading ? 'wait' : 'pointer',
        opacity: loading ? 0.72 : 1,
      }}
    >
      <ReadAloudIcon active={active} loading={loading} />
    </button>
  );
}
