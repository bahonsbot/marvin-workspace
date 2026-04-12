'use client';

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRuntimeBridge, type RuntimeBridgeState } from '@/hooks/useRuntimeBridge';
import type { OrchestratorIntegrationSummary, RuntimeBridgeTranscriptHistory, TaskLifecycleEvent } from '@/lib/types/contracts';

const LIFECYCLE_POLL_INTERVAL_MS = 4000;
const TOAST_SEEN_STORAGE_KEY = 'mission-control-lifecycle-toast-seen';
const MAX_TOAST_SEEN_IDS = 120;

export type MissionControlLifecycleToast = {
  event: TaskLifecycleEvent;
  dismissAt: number;
};

type MissionControlRuntimeContextValue = {
  bridge: RuntimeBridgeState | null;
  summary: OrchestratorIntegrationSummary | null;
  lifecycleEvents: TaskLifecycleEvent[];
  visibleToasts: MissionControlLifecycleToast[];
  hydrateSummary: (summary: OrchestratorIntegrationSummary) => void;
  hydrateTranscriptHistory: (history: RuntimeBridgeTranscriptHistory) => void;
  dismissToast: (eventId: string) => void;
};

const MissionControlRuntimeContext = createContext<MissionControlRuntimeContextValue | null>(null);

function shouldReplaceSummary(
  current: OrchestratorIntegrationSummary | null,
  incoming: OrchestratorIntegrationSummary,
): boolean {
  if (!current) return true;
  if (current.refreshedAt !== incoming.refreshedAt) return true;
  if (current.sessionContext.recent.length !== incoming.sessionContext.recent.length) return true;
  if (current.sessionContext.roots.map((session) => session.key).join('|') !== incoming.sessionContext.roots.map((session) => session.key).join('|')) return true;
  if (current.sessionContext.mainSession.exists !== incoming.sessionContext.mainSession.exists) return true;
  if (current.runtimeBridge.status !== incoming.runtimeBridge.status) return true;
  return false;
}

function MissionControlRuntimeBridgeManager({
  summary,
  transcriptHistory,
  lifecycleEvents,
  visibleToasts,
  hydrateSummary,
  hydrateTranscriptHistory,
  dismissToast,
  children,
}: {
  summary: OrchestratorIntegrationSummary;
  transcriptHistory: RuntimeBridgeTranscriptHistory | null;
  lifecycleEvents: TaskLifecycleEvent[];
  visibleToasts: MissionControlLifecycleToast[];
  hydrateSummary: (summary: OrchestratorIntegrationSummary) => void;
  hydrateTranscriptHistory: (history: RuntimeBridgeTranscriptHistory) => void;
  dismissToast: (eventId: string) => void;
  children: ReactNode;
}) {
  const bridge = useRuntimeBridge(summary, transcriptHistory);

  const value = useMemo<MissionControlRuntimeContextValue>(
    () => ({
      bridge,
      summary: bridge.summary,
      lifecycleEvents,
      visibleToasts,
      hydrateSummary,
      hydrateTranscriptHistory,
      dismissToast,
    }),
    [bridge, dismissToast, hydrateSummary, hydrateTranscriptHistory, lifecycleEvents, visibleToasts],
  );

  return <MissionControlRuntimeContext.Provider value={value}>{children}</MissionControlRuntimeContext.Provider>;
}

export function MissionControlRuntimeProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<OrchestratorIntegrationSummary | null>(null);
  const [transcriptHistory, setTranscriptHistory] = useState<RuntimeBridgeTranscriptHistory | null>(null);
  const [lifecycleEvents, setLifecycleEvents] = useState<TaskLifecycleEvent[]>([]);
  const [visibleToasts, setVisibleToasts] = useState<MissionControlLifecycleToast[]>([]);
  const seenToastIdsRef = useRef<Set<string>>(new Set());
  const audioUnlockedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastPlayedEventIdRef = useRef<string | null>(null);

  const hydrateSummary = useCallback((incoming: OrchestratorIntegrationSummary) => {
    setSummary((current) => (shouldReplaceSummary(current, incoming) ? incoming : current));
  }, []);

  const hydrateTranscriptHistory = useCallback((incoming: RuntimeBridgeTranscriptHistory) => {
    setTranscriptHistory((current) => {
      if (
        current?.sessionKey === incoming.sessionKey &&
        current.messages.length === incoming.messages.length &&
        current.messages.every((message, index) => message.id === incoming.messages[index]?.id)
      ) {
        return current;
      }
      return incoming;
    });
  }, []);

  const dismissToast = useCallback((eventId: string) => {
    setVisibleToasts((current) => current.filter((toast) => toast.event.id !== eventId));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = JSON.parse(window.localStorage.getItem(TOAST_SEEN_STORAGE_KEY) ?? '[]');
      if (Array.isArray(stored)) {
        seenToastIdsRef.current = new Set(stored.filter((value): value is string => typeof value === 'string'));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unlockAudio = () => {
      audioUnlockedRef.current = true;
      if (!audioContextRef.current && typeof window.AudioContext !== 'undefined') {
        audioContextRef.current = new window.AudioContext();
      }
      void audioContextRef.current?.resume?.().catch(() => {});
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (!audioUnlockedRef.current) return;
    const latestToast = visibleToasts[visibleToasts.length - 1];
    if (!latestToast) return;
    if (lastPlayedEventIdRef.current === latestToast.event.id) return;
    if (latestToast.event.type !== 'task.moved_to_review' && latestToast.event.type !== 'task.needs_input') return;

    lastPlayedEventIdRef.current = latestToast.event.id;

    try {
      const AudioCtor = typeof window !== 'undefined' ? window.AudioContext : undefined;
      if (!AudioCtor) return;
      const context = audioContextRef.current ?? new AudioCtor();
      audioContextRef.current = context;
      const now = context.currentTime;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      gain.connect(context.destination);

      const primary = context.createOscillator();
      primary.type = 'sine';
      primary.frequency.setValueAtTime(latestToast.event.type === 'task.needs_input' ? 523.25 : 659.25, now);
      primary.frequency.exponentialRampToValueAtTime(latestToast.event.type === 'task.needs_input' ? 466.16 : 783.99, now + 0.24);
      primary.connect(gain);
      primary.start(now);
      primary.stop(now + 0.42);

      const shimmer = context.createOscillator();
      shimmer.type = 'triangle';
      shimmer.frequency.setValueAtTime(1046.5, now + 0.02);
      shimmer.connect(gain);
      shimmer.start(now + 0.02);
      shimmer.stop(now + 0.22);
    } catch {}
  }, [visibleToasts]);

  useEffect(() => {
    if (visibleToasts.length === 0) return;
    const timers = visibleToasts.map((toast) =>
      window.setTimeout(() => {
        setVisibleToasts((current) => current.filter((entry) => entry.event.id !== toast.event.id));
      }, Math.max(0, toast.dismissAt - Date.now())),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [visibleToasts]);

  useEffect(() => {
    let cancelled = false;

    const persistSeenToastIds = (ids: Set<string>) => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(TOAST_SEEN_STORAGE_KEY, JSON.stringify(Array.from(ids).slice(-MAX_TOAST_SEEN_IDS)));
      } catch {}
    };

    const loadLifecycleEvents = async () => {
      try {
        const res = await fetch('/api/tasks/lifecycle-events', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          throw new Error(`Lifecycle event request failed (${res.status})`);
        }
        const payload = (await res.json()) as { events?: TaskLifecycleEvent[] };
        if (cancelled) return;
        const nextEvents = Array.isArray(payload.events) ? payload.events : [];

        startTransition(() => {
          setLifecycleEvents(nextEvents);
          setVisibleToasts((current) => {
            const queued = [...current];
            const seenIds = seenToastIdsRef.current;

            for (const event of nextEvents) {
              const isImportant = event.type === 'task.moved_to_review' || event.type === 'task.needs_input';
              if (!isImportant) continue;
              if (seenIds.has(event.id)) continue;
              seenIds.add(event.id);
              queued.push({
                event,
                dismissAt: Date.now() + (event.type === 'task.needs_input' ? 12000 : 7000),
              });
            }

            persistSeenToastIds(seenIds);

            return queued
              .sort((a, b) => Date.parse(a.event.at) - Date.parse(b.event.at))
              .slice(-3);
          });
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Lifecycle event polling failed.', error);
        }
      }
    };

    void loadLifecycleEvents();
    const interval = window.setInterval(() => {
      void loadLifecycleEvents();
    }, LIFECYCLE_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  if (!summary) {
    return (
      <MissionControlRuntimeContext.Provider
        value={{
          bridge: null,
          summary: null,
          lifecycleEvents,
          visibleToasts,
          hydrateSummary,
          hydrateTranscriptHistory,
          dismissToast,
        }}
      >
        {children}
      </MissionControlRuntimeContext.Provider>
    );
  }

  return (
    <MissionControlRuntimeBridgeManager
      summary={summary}
      transcriptHistory={transcriptHistory}
      lifecycleEvents={lifecycleEvents}
      visibleToasts={visibleToasts}
      hydrateSummary={hydrateSummary}
      hydrateTranscriptHistory={hydrateTranscriptHistory}
      dismissToast={dismissToast}
    >
      {children}
    </MissionControlRuntimeBridgeManager>
  );
}

export function useMissionControlRuntime() {
  const context = useContext(MissionControlRuntimeContext);
  if (!context) {
    throw new Error('useMissionControlRuntime must be used inside MissionControlRuntimeProvider');
  }
  return context;
}
