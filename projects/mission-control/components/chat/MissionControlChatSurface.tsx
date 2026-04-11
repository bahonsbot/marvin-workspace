'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from 'react';
import type { CSSProperties } from 'react';
import {
  buildFilesHref,
  monoFont,
  renderPlainTextWithFileLinks,
  renderRichText,
} from '@/components/chat/chat-rich-text';
import {
  formatEventTime,
  ToolGroupBlock,
  type ToolGroupRow,
} from '@/components/chat/chat-tool-groups';
import {
  actionButtonStyle,
  composerIconButtonStyle,
  contextTone,
  pillStyle,
} from '@/components/chat/chat-ui-helpers';
import { listPreferredChatSeatActivations, type ChatSeatActivation } from '@/lib/agents/chat-activation';
import type {
  SudoDelegatedRun,
  SudoDelegationLane,
  SudoLaneSlug,
  SudoOrchestrationDecision,
  SudoOversightState,
  SudoOrchestrationRun,
} from '@/lib/agents/sudo-delegation';
import type {
  RuntimeBridgeChatMessage,
  RuntimeBridgeLiveEvent,
  RuntimeBridgeToolEvent,
  RuntimeBridgeTransientNotice,
  RuntimeBridgeState,
} from '@/hooks/useRuntimeBridge';
import { buildChatSurfaceModel } from '@/lib/chat/thread-model';
import { useSpeechToText } from '@/components/chat/useSpeechToText';
import type { OrchestratorIntegrationSummary } from '@/lib/types/contracts';

const TOOL_BURST_WINDOW_MS = 10000;

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 3 10 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 3 14 21l-4-7-7-4 18-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NewSessionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 10h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 14h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 3c5 0 9 3.58 9 8s-4 8-9 8a10.6 10.6 0 0 1-4-.77L3 21l1.55-4.12A7.4 7.4 0 0 1 3 11c0-4.42 4.03-8 9-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 5.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.5 7.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 11a6 6 0 0 0 12 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21.44 11.05 12 20.5a6 6 0 1 1-8.49-8.49l10.6-10.61a4 4 0 1 1 5.66 5.66L8.46 18.36a2 2 0 1 1-2.83-2.82l9.2-9.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function copyTextToClipboard(text: string): boolean {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function assistantLabelForSeat(seatSlug: string | null | undefined) {
  if (seatSlug === 'language-tutor') return 'Japin';
  if (seatSlug === 'trading-advisor') return 'Milou';
  if (seatSlug === 'sportsbet-advisor') return 'Johan';
  if (seatSlug === 'job-advisor') return 'Link';
  if (seatSlug === 'content-seo-team') return 'Vantage';
  if (seatSlug === 'dev-team') return 'Sudo';
  return 'Marvin';
}

function LiveMessageBlock({ message, assistantLabel }: { message: RuntimeBridgeChatMessage; assistantLabel: string }) {
  const [copied, setCopied] = useState(false);

  if (message.role === 'system') {
    if (message.variant === 'activity') {
      return (
        <div style={{ display: 'grid', justifyItems: 'center', marginBottom: 10 }}>
          <section
            style={{
              maxWidth: 'min(74ch, 82%)',
              borderRadius: 999,
              padding: '9px 14px',
              background: 'rgba(232, 239, 235, 0.84)',
              border: '1px solid rgba(111, 140, 126, 0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              color: '#4a5f55',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#60796d' }}>
              Activity
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.45 }}>{message.body}</span>
          </section>
        </div>
      );
    }

    return (
      <section
        style={{
          borderRadius: 18,
          padding: '14px 16px',
          background: 'rgba(154, 75, 67, 0.08)',
          border: '1px solid rgba(154, 75, 67, 0.22)',
          display: 'grid',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={pillStyle()}>Bridge note</span>
          <span style={pillStyle()}>{message.status}</span>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.7, color: '#8a433b' }}>{renderRichText(message.body)}</div>
      </section>
    );
  }

  const isOperator = message.role === 'user';

  return (
    <div
      style={{
        display: 'grid',
        justifyItems: isOperator ? 'end' : 'start',
        gap: 12,
        marginTop: 2,
        marginBottom: 10,
      }}
    >
      <div style={{ display: 'grid', gap: 10, maxWidth: 'min(78ch, 78%)', justifyItems: isOperator ? 'end' : 'start' }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-mid)' }}>
            {isOperator ? 'Philippe' : assistantLabel}
          </div>
          {!isOperator ? (
            <button
              type="button"
              onClick={() => {
                const ok = copyTextToClipboard(message.body);
                setCopied(ok);
                window.setTimeout(() => setCopied(false), 1400);
              }}
              aria-label="Copy message"
              title={copied ? 'Copied' : 'Copy'}
              style={{
                border: '1px solid rgba(200, 195, 188, 0.28)',
                background: 'rgba(255, 255, 255, 0.72)',
                color: copied ? '#163b31' : 'var(--text-muted)',
                borderRadius: 999,
                minWidth: 34,
                height: 34,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <CopyIcon />
            </button>
          ) : null}
        </div>
        <div
          style={{
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            borderRadius: 24,
            padding: '14px 16px',
            color: 'var(--text-body)',
            fontSize: 15,
            lineHeight: 1.8,
            textAlign: 'left',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            background: isOperator ? 'rgba(236, 244, 240, 0.72)' : 'rgba(250, 246, 240, 0.94)',
            border: isOperator ? '1px solid rgba(200, 195, 188, 0.24)' : '1px solid rgba(255, 255, 255, 0.92)',
          }}
        >
          {renderRichText(message.body)}
        </div>
        {message.status === 'streaming' ? <div style={{ fontSize: 11, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Streaming</div> : null}
      </div>
    </div>
  );
}

function LiveEventBlock({ event }: { event: RuntimeBridgeLiveEvent }) {
  return (
    <div
      style={{
        border: '1px solid rgba(200, 195, 188, 0.28)',
        borderRadius: 14,
        background: 'rgba(255, 255, 255, 0.82)',
        padding: 12,
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={pillStyle()}>{event.name}</span>
        <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{formatEventTime(event.at)}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{event.detail}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {event.sessionKey ? <span style={pillStyle()}>{shortKey(event.sessionKey)}</span> : null}
        {event.runId ? <span style={pillStyle()}>{`run ${shortKey(event.runId)}`}</span> : null}
        {event.seq !== null ? <span style={pillStyle()}>{`seq ${event.seq}`}</span> : null}
      </div>
    </div>
  );
}

function shortKey(value: string): string {
  if (value.length <= 32) return value;
  return `${value.slice(0, 14)}...${value.slice(-10)}`;
}

type TopControlMenu = 'agent' | 'model' | 'effort' | null;

type AgentMenuOption = {
  id: string;
  seatSlug: string | null;
  label: string;
  note?: string;
  detail?: string;
  runtimeTag?: string;
};

type ModelMenuOption = {
  id: 'codex5.4' | 'codex' | 'minimax2.7';
  label: string;
  command: string;
};

const modelMenuOptions: ModelMenuOption[] = [
  { id: 'codex5.4', label: 'gpt-5.4', command: '/model codex5.4' },
  { id: 'codex', label: 'codex-5.3', command: '/model codex' },
  { id: 'minimax2.7', label: 'minimax-2.7', command: '/model minimax2.7' },
];

const effortMenuOptions = ['low', 'medium', 'high', 'xhigh'] as const;
type EffortMenuOption = (typeof effortMenuOptions)[number];

function formatAge(ageMs: number | null): string {
  if (ageMs === null || Number.isNaN(ageMs)) return 'freshness unavailable';
  const minutes = Math.round(ageMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m ago` : `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type SudoDelegationPayload = {
  lanes?: SudoDelegationLane[];
  runs?: SudoDelegatedRun[];
  orchestrations?: SudoOrchestrationRun[];
  error?: string;
};

function delegationStatusStyle(status: SudoDelegatedRun['status']): CSSProperties {
  if (status === 'done') return pillStyle({ active: true });
  if (status === 'error') {
    return {
      ...pillStyle(),
      border: '1px solid rgba(181, 88, 74, 0.34)',
      background: 'rgba(244, 224, 220, 0.88)',
      color: '#7c2e24',
    };
  }
  return {
    ...pillStyle(),
    border: '1px solid rgba(177, 138, 73, 0.32)',
    background: 'rgba(247, 236, 212, 0.88)',
    color: '#6b4d19',
  };
}

function orchestrationStatusStyle(status: SudoOrchestrationRun['status']): CSSProperties {
  if (status === 'done') return pillStyle({ active: true });
  if (status === 'error') {
    return {
      ...pillStyle(),
      border: '1px solid rgba(181, 88, 74, 0.34)',
      background: 'rgba(244, 224, 220, 0.88)',
      color: '#7c2e24',
    };
  }
  if (status === 'waiting') {
    return {
      ...pillStyle(),
      border: '1px solid rgba(114, 96, 31, 0.3)',
      background: 'rgba(247, 241, 219, 0.92)',
      color: '#5d4814',
    };
  }
  return {
    ...pillStyle(),
    border: '1px solid rgba(177, 138, 73, 0.32)',
    background: 'rgba(247, 236, 212, 0.88)',
    color: '#6b4d19',
  };
}

function decisionModeLabel(mode: SudoOrchestrationDecision['mode']): string {
  if (mode === 'direct_answer') return 'Direct answer';
  if (mode === 'ask_question') return 'Needs Philippe';
  if (mode === 'propose_alternative') return 'Alternative first';
  return 'Delegating';
}

function oversightLabel(oversight: SudoOversightState): string {
  if (oversight.approvalNeeded || oversight.oversightLevel === 'approval') return 'Approval required';
  if (oversight.oversightLevel === 'blocker') return 'Marvin review required';
  return 'Marvin oversight';
}

function oversightReasonLabel(reason?: SudoOversightState['oversightReason']): string | null {
  if (reason === 'risk') return 'Risk';
  if (reason === 'ambiguity') return 'Ambiguity';
  if (reason === 'conflict') return 'Conflict';
  if (reason === 'blocked') return 'Blocked';
  if (reason === 'tradeoff') return 'Tradeoff';
  if (reason === 'uncertainty') return 'Uncertainty';
  return null;
}

function oversightStyle(oversight: SudoOversightState): CSSProperties {
  if (oversight.approvalNeeded || oversight.oversightLevel === 'approval') {
    return {
      ...pillStyle(),
      border: '1px solid rgba(168, 131, 52, 0.34)',
      background: 'rgba(247, 238, 210, 0.92)',
      color: '#6b4d19',
    };
  }
  if (oversight.oversightLevel === 'blocker') {
    return {
      ...pillStyle(),
      border: '1px solid rgba(181, 88, 74, 0.34)',
      background: 'rgba(244, 224, 220, 0.88)',
      color: '#7c2e24',
    };
  }
  return {
    ...pillStyle(),
    border: '1px solid rgba(96, 118, 145, 0.32)',
    background: 'rgba(230, 236, 245, 0.9)',
    color: '#314b66',
  };
}

function laneLabelFromSlug(laneSlug: SudoLaneSlug, lanes: SudoDelegationLane[]) {
  return lanes.find((lane) => lane.slug === laneSlug)?.seatLabel ?? laneSlug;
}

function laneSequenceLabel(lanePlan: SudoLaneSlug[], lanes: SudoDelegationLane[]) {
  if (lanePlan.length === 0) return 'No lane work';
  return lanePlan.map((laneSlug) => laneLabelFromSlug(laneSlug, lanes)).join(' -> ');
}

const SUDO_DISMISSED_RUNS_STORAGE_KEY = 'mission-control:sudo-dismissed-runs';

function buildSudoReviewPrompt(run: SudoOrchestrationRun) {
  const sequence = run.decision?.lanePlan?.length ? reviewLaneSequence(run.decision.lanePlan) : 'No lane delegation';
  const summary = run.synthesis?.summary || run.error || run.decision?.rationale || run.promptSummary;
  return [
    'Review this completed Sudo run and take over from here.',
    '',
    `Original brief: ${run.promptSummary}`,
    `Status: ${run.status}`,
    `Lane sequence: ${sequence}`,
    `Result summary: ${summary}`,
  ].join('\n');
}

function laneLabelForReview(laneSlug: SudoLaneSlug) {
  if (laneSlug === 'frontend') return 'Frontend Developer';
  if (laneSlug === 'backend') return 'Backend Developer';
  return 'QA Engineer';
}

function reviewLaneSequence(lanePlan: SudoLaneSlug[]) {
  if (lanePlan.length === 0) return 'No lane delegation';
  return lanePlan.map((laneSlug) => laneLabelForReview(laneSlug)).join(' -> ');
}

function isLikelyPlanPrompt(run: SudoOrchestrationRun) {
  const text = `${run.requestedPrompt || ''}\n${run.promptSummary || ''}`.toLowerCase();
  return /(implementation plan|plan\b|proposal|design doc|technical spec|spec\b)/.test(text);
}

function SudoRunCard({
  run,
  lanes,
  childRuns,
  featured = false,
  showDismiss = false,
  onDismiss,
  onReviewWithMarvin,
}: {
  run: SudoOrchestrationRun;
  lanes: SudoDelegationLane[];
  childRuns: SudoDelegatedRun[];
  featured?: boolean;
  showDismiss?: boolean;
  onDismiss?: (runId: string) => void;
  onReviewWithMarvin?: (run: SudoOrchestrationRun) => void;
}) {
  const decision = run.decision;
  const oversight = run.oversight;
  const longDecisionText =
    decision?.mode === 'ask_question'
      ? decision.question
      : decision?.mode === 'propose_alternative'
        ? decision.suggestion
        : decision?.mode === 'direct_answer'
          ? decision.directAnswer
          : undefined;
  const laneSequence = decision ? laneSequenceLabel(decision.lanePlan, lanes) : 'Pending';
  const completed = run.status === 'done' || run.status === 'error';
  const planLike = isLikelyPlanPrompt(run);
  const topSummary = run.synthesis?.summary || longDecisionText || run.error || 'Sudo is deciding how to handle this brief.';
  const artifacts = Array.isArray(run.artifacts) ? run.artifacts.filter((artifact) => artifact?.path) : [];
  const showPromptHint = !completed && !planLike;
  const showRationale = Boolean(decision?.rationale) && !completed;
  const showExecutionDetails = Boolean(
    decision && (decision.lanePlanSteps.length > 0 || childRuns.length > 0 || (!completed && (decision.orderRationale || decision.mode !== 'direct_answer'))),
  );
  const showSynthesisBlock = Boolean(
    run.synthesis && !String(run.synthesis.summary || '').trim().startsWith(String(topSummary || '').trim().slice(0, 120)),
  );

  return (
    <div
      style={{
        border: featured ? '1px solid rgba(121, 166, 148, 0.32)' : '1px solid rgba(200, 195, 188, 0.28)',
        borderRadius: featured ? 18 : 16,
        padding: featured ? '12px 13px' : '11px 12px',
        display: 'grid',
        gap: 8,
        background: featured
          ? 'linear-gradient(135deg, rgba(255, 253, 250, 0.98) 0%, rgba(247, 251, 249, 0.98) 100%)'
          : run.status === 'error'
            ? 'rgba(252, 248, 246, 0.92)'
            : 'rgba(255, 255, 255, 0.94)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: 6, minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={orchestrationStatusStyle(run.status)}>{run.status}</span>
            {decision ? <span style={pillStyle()}>{decisionModeLabel(decision.mode)}</span> : <span style={pillStyle()}>Deciding</span>}
            {oversight.oversightNeeded ? <span style={oversightStyle(oversight)}>{oversightLabel(oversight)}</span> : null}
            {decision?.lanePlan?.length ? <span style={pillStyle()}>{laneSequence}</span> : null}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-body)',
              lineHeight: 1.6,
              display: '-webkit-box',
              WebkitLineClamp: completed ? 3 : 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {topSummary}
          </div>
          {showPromptHint ? <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{run.promptSummary}</div> : null}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
          {completed && onReviewWithMarvin ? (
            <button
              type="button"
              onClick={() => onReviewWithMarvin(run)}
              style={{ ...actionButtonStyle(true, true), padding: '8px 11px', fontSize: 11 }}
            >
              Review with Marvin
            </button>
          ) : null}
          {showDismiss && onDismiss ? (
            <button
              type="button"
              onClick={() => onDismiss(run.id)}
              aria-label="Dismiss this Sudo decision"
              title="Dismiss this Sudo decision"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '1px solid rgba(200, 195, 188, 0.36)',
                background: 'rgba(255, 255, 255, 0.72)',
                color: 'var(--text-muted)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          ) : null}
          <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{formatEventTime(Date.parse(run.updatedAt))}</span>
        </div>
      </div>

      {showRationale ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {decision?.rationale}
        </div>
      ) : null}

      {artifacts.length > 0 ? (
        <div
          style={{
            border: '1px solid rgba(121, 166, 148, 0.24)',
            borderRadius: 14,
            padding: '10px 11px',
            display: 'grid',
            gap: 8,
            background: 'rgba(246, 251, 248, 0.92)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#305448', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {planLike ? 'Plan deliverable' : 'Deliverables'}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{artifacts.length}</span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {artifacts.map((artifact, index) => {
              const href = artifact.kind === 'url' ? artifact.path : buildFilesHref(artifact.path);
              const label = artifact.label || artifact.path.split('/').pop() || artifact.path;
              return (
                <div
                  key={`${run.id}-artifact-${artifact.path}-${index}`}
                  style={{
                    border: '1px solid rgba(200, 195, 188, 0.22)',
                    borderRadius: 12,
                    padding: '9px 10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    background: '#ffffff',
                  }}
                >
                  <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#173128', fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: monoFont, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {artifact.path}
                    </div>
                  </div>
                  <Link href={href} style={{ ...actionButtonStyle(true, true), padding: '8px 11px', fontSize: 11 }}>
                    {planLike ? 'Open plan' : 'Open'}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {oversight.oversightNeeded ? (
        <div
          style={{
            border: oversight.oversightLevel === 'blocker'
              ? '1px solid rgba(181, 88, 74, 0.24)'
              : oversight.approvalNeeded || oversight.oversightLevel === 'approval'
                ? '1px solid rgba(168, 131, 52, 0.24)'
                : '1px solid rgba(96, 118, 145, 0.24)',
            borderRadius: 14,
            padding: '10px 11px',
            display: 'grid',
            gap: 8,
            background: oversight.oversightLevel === 'blocker'
              ? 'rgba(252, 244, 242, 0.96)'
              : oversight.approvalNeeded || oversight.oversightLevel === 'approval'
                ? 'rgba(252, 248, 239, 0.96)'
                : 'rgba(241, 245, 250, 0.96)',
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={oversightStyle(oversight)}>{oversightLabel(oversight)}</span>
            {oversightReasonLabel(oversight.oversightReason) ? <span style={pillStyle()}>{oversightReasonLabel(oversight.oversightReason)}</span> : null}
            {oversight.approvalNeeded ? <span style={pillStyle()}>Blocking approval</span> : null}
          </div>
          <div style={{ fontSize: 12, color: '#173128', lineHeight: 1.6 }}>
            {oversight.marvinSummary || 'Sudo surfaced a structural oversight boundary for Marvin rather than silently continuing.'}
          </div>
          {oversight.recommendedDecision ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Recommended decision: {oversight.recommendedDecision}
            </div>
          ) : null}
          {oversight.nextHumanDecision ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Next human decision: {oversight.nextHumanDecision}
            </div>
          ) : null}
        </div>
      ) : null}

      {decision && showExecutionDetails ? (
        <details open={featured && !completed && decision.lanePlanSteps.length > 0} style={{ border: '1px solid rgba(200, 195, 188, 0.24)', borderRadius: 14, background: 'rgba(255, 252, 247, 0.92)' }}>
          <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '10px 11px', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {completed ? 'Execution summary' : 'Execution plan'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {decision.lanePlanSteps.length > 0 ? `${decision.lanePlanSteps.length} steps` : laneSequence}
            </span>
          </summary>
          <div style={{ padding: '0 11px 11px', display: 'grid', gap: 8 }}>
            {decision.lanePlanSteps.length > 0 ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {decision.lanePlanSteps.map((step) => (
                  <div
                    key={`${run.id}-plan-${step.order}-${step.lane}`}
                    style={{
                      border: '1px solid rgba(200, 195, 188, 0.22)',
                      borderRadius: 12,
                      padding: '9px 10px',
                      display: 'grid',
                      gap: 5,
                      background: '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={pillStyle()}>{`Step ${step.order}`}</span>
                      <span style={pillStyle()}>{laneLabelFromSlug(step.lane, lanes)}</span>
                      {step.validationFocus ? <span style={pillStyle()}>{step.validationFocus}</span> : null}
                    </div>
                    <div style={{ fontSize: 12, color: '#173128', lineHeight: 1.5 }}>{step.purpose || 'Lane-specific execution step.'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      Expected output: {step.expectedOutput || 'Lane output recorded in the child run.'}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {!completed && decision.orderRationale ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Why this order: {decision.orderRationale}
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {childRuns.length > 0 ? (
        <details open={featured && !completed} style={{ border: '1px solid rgba(200, 195, 188, 0.24)', borderRadius: 14, background: 'rgba(255, 253, 250, 0.9)' }}>
          <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '10px 11px', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Child lane runs</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{childRuns.length}</span>
          </summary>
          <div style={{ padding: '0 11px 11px', display: 'grid', gap: 8 }}>
            {childRuns.map((childRun) => (
              <div
                key={childRun.id}
                style={{
                  border: '1px solid rgba(200, 195, 188, 0.24)',
                  borderRadius: 12,
                  padding: '9px 10px',
                  display: 'grid',
                  gap: 6,
                  background: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={delegationStatusStyle(childRun.status)}>{childRun.status}</span>
                    <span style={pillStyle()}>{childRun.lane.seatLabel}</span>
                    <span style={pillStyle()}>{childRun.lane.defaultModel}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>
                    {childRun.orchestrationSequence ? `Step ${childRun.orchestrationSequence}` : 'Child run'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-body)', lineHeight: 1.6 }}>
                  {childRun.resultSummary || childRun.error || childRun.promptSummary}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {showSynthesisBlock && run.synthesis ? (
        <div
          style={{
            border: '1px solid rgba(121, 166, 148, 0.24)',
            borderRadius: 14,
            padding: '10px 11px',
            display: 'grid',
            gap: 8,
            background: 'linear-gradient(135deg, rgba(232, 242, 236, 0.84) 0%, rgba(255, 253, 250, 0.96) 100%)',
          }}
        >
          <div style={{ fontSize: 11, color: '#305448', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Final synthesis</div>
          <div style={{ fontSize: 12, color: '#173128', lineHeight: 1.6 }}>{run.synthesis.summary}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>Decision: {run.synthesis.decided}</div>
        </div>
      ) : null}

      {(longDecisionText || run.requestedPrompt) ? (
        <details style={{ border: '1px solid rgba(200, 195, 188, 0.22)', borderRadius: 14, background: 'rgba(255, 255, 255, 0.82)' }}>
          <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '9px 11px', fontSize: 11, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Full answer and brief
          </summary>
          <div style={{ padding: '0 11px 11px', display: 'grid', gap: 10 }}>
            {longDecisionText ? (
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 11, color: '#305448', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Full answer</div>
                <div style={{ fontSize: 12, color: '#173128', lineHeight: 1.6 }}>{renderPlainTextWithFileLinks(longDecisionText, `${run.id}-full-answer`)}</div>
              </div>
            ) : null}
            {run.requestedPrompt ? (
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 11, color: '#305448', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Original brief</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>{run.requestedPrompt}</div>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      <details style={{ border: '1px solid rgba(200, 195, 188, 0.22)', borderRadius: 14, background: 'rgba(255, 255, 255, 0.82)' }}>
        <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '9px 11px', fontSize: 11, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Technical details
        </summary>
        <div style={{ padding: '0 11px 11px', display: 'grid', gap: 6 }}>
          {run.decisionSessionKey ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Decision session: <span style={{ fontFamily: monoFont }}>{run.decisionSessionKey}</span></div> : null}
          {run.decisionRunId ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Decision run: <span style={{ fontFamily: monoFont }}>{run.decisionRunId}</span></div> : null}
          {childRuns.map((childRun) => (
            <div key={`${childRun.id}-tech`} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {childRun.lane.seatLabel}: {childRun.childSessionKey ? <span style={{ fontFamily: monoFont }}>{childRun.childSessionKey}</span> : 'No child session id'}{childRun.runId ? ` / ${childRun.runId}` : ''}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function SudoDelegationPanel({
  draftPrompt,
  activePrompt,
  sourceSessionKey,
  orchestrationTrigger,
  onReviewWithMarvin,
}: {
  draftPrompt: string;
  activePrompt: string;
  sourceSessionKey: string;
  orchestrationTrigger: number;
  onReviewWithMarvin: (run: SudoOrchestrationRun) => void;
}) {
  const [lanes, setLanes] = useState<SudoDelegationLane[]>([]);
  const [orchestrations, setOrchestrations] = useState<SudoOrchestrationRun[]>([]);
  const [runs, setRuns] = useState<SudoDelegatedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [orchestrating, setOrchestrating] = useState(false);
  const [dismissedRunIds, setDismissedRunIds] = useState<string[]>([]);
  const trimmedPrompt = draftPrompt.trim() || activePrompt.trim();
  const childRunsByOrchestration = useMemo(() => {
    const next = new Map<string, SudoDelegatedRun[]>();
    runs.forEach((run) => {
      if (!run.orchestrationId) return;
      const group = next.get(run.orchestrationId) ?? [];
      group.push(run);
      next.set(run.orchestrationId, group);
    });
    next.forEach((group) => {
      group.sort((left, right) => (left.orchestrationSequence ?? 0) - (right.orchestrationSequence ?? 0));
    });
    return next;
  }, [runs]);
  const visibleOrchestrations = useMemo(() => {
    const filtered = orchestrations.filter((run) => !dismissedRunIds.includes(run.id));
    return [...filtered].sort((left, right) => {
      const rightTs = Date.parse(right.updatedAt || right.completedAt || right.requestedAt || '') || 0;
      const leftTs = Date.parse(left.updatedAt || left.completedAt || left.requestedAt || '') || 0;
      return rightTs - leftTs;
    });
  }, [dismissedRunIds, orchestrations]);
  const featuredRun = useMemo(
    () => visibleOrchestrations[0] ?? null,
    [visibleOrchestrations],
  );
  const historicalRuns = useMemo(
    () => visibleOrchestrations.filter((run) => run.id !== featuredRun?.id),
    [featuredRun?.id, visibleOrchestrations],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!quiet) setLoading(true);
      try {
        const response = await fetch('/api/agents/sudo-orchestration', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        const payload = (await response.json()) as SudoDelegationPayload;
        if (!response.ok) {
          throw new Error(payload.error || `Delegation request failed (${response.status})`);
        }
        if (cancelled) return;
        setLanes(Array.isArray(payload.lanes) ? payload.lanes : []);
        setOrchestrations(Array.isArray(payload.orchestrations) ? payload.orchestrations : []);
        setRuns(Array.isArray(payload.runs) ? payload.runs : []);
        setRefreshError(null);
      } catch (cause) {
        if (cancelled) return;
        setRefreshError(cause instanceof Error ? cause.message : 'Mission Control could not load delegated runs.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const interval = window.setInterval(() => {
      void load({ quiet: true });
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SUDO_DISMISSED_RUNS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        setDismissedRunIds(parsed.filter((entry): entry is string => typeof entry === 'string'));
      }
    } catch {
      // Ignore malformed local state.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SUDO_DISMISSED_RUNS_STORAGE_KEY, JSON.stringify(dismissedRunIds));
  }, [dismissedRunIds]);

  const handleOrchestrate = useCallback(async () => {
    if (!trimmedPrompt) {
      setRefreshError('Add the task brief to the composer first, then let Sudo handle it.');
      return;
    }

    setOrchestrating(true);
    try {
      const response = await fetch('/api/agents/sudo-orchestration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          sourceSessionKey,
        }),
      });
      const payload = (await response.json()) as { orchestration?: SudoOrchestrationRun; error?: string };
      if (!response.ok || !payload.orchestration) {
        throw new Error(payload.error || 'Sudo orchestration could not be started.');
      }
      setRefreshError(null);
      setOrchestrations((current) => [payload.orchestration as SudoOrchestrationRun, ...current.filter((run) => run.id !== payload.orchestration?.id)].slice(0, 8));
      setDismissedRunIds((current) => current.filter((runId) => runId !== payload.orchestration?.id));
    } catch (cause) {
      setRefreshError(cause instanceof Error ? cause.message : 'Sudo orchestration could not be started.');
    } finally {
      setOrchestrating(false);
    }
  }, [sourceSessionKey, trimmedPrompt]);

  useEffect(() => {
    if (orchestrationTrigger <= 0) return;
    if (!trimmedPrompt) return;
    void handleOrchestrate();
  }, [handleOrchestrate, orchestrationTrigger, trimmedPrompt]);

  return (
    <section
      style={{
        position: 'relative',
        zIndex: 1,
        border: '1px solid rgba(200, 195, 188, 0.48)',
        borderRadius: 22,
        background: '#fffdfa',
        boxShadow: '0 14px 30px rgba(26, 61, 50, 0.08)',
        padding: '12px 14px',
        display: 'grid',
        gap: 10,
        maxHeight: 'min(62vh, 720px)',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={pillStyle({ active: true })}>Sudo orchestration</span>
        {orchestrating ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sudo deciding…</span> : null}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {loading ? <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>Loading…</span> : null}
        </div>
        {featuredRun ? (
          <SudoRunCard
            run={featuredRun}
            lanes={lanes}
            childRuns={childRunsByOrchestration.get(featuredRun.id) ?? []}
            featured
            onReviewWithMarvin={onReviewWithMarvin}
          />
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>No Sudo orchestration runs recorded yet.</div>
        )}
        {historicalRuns.length > 0 ? (
          <details style={{ border: '1px solid rgba(200, 195, 188, 0.28)', borderRadius: 16, background: 'rgba(255, 255, 255, 0.84)' }}>
            <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div style={{ display: 'grid', gap: 3 }}>
                <div style={{ fontSize: 11, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>History</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{historicalRuns.length} older runs hidden by default.</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{historicalRuns.length}</span>
            </summary>
            <div style={{ padding: '0 12px 12px', display: 'grid', gap: 8 }}>
              {historicalRuns.map((run) => (
                <SudoRunCard
                  key={run.id}
                  run={run}
                  lanes={lanes}
                  childRuns={childRunsByOrchestration.get(run.id) ?? []}
                  showDismiss
                  onDismiss={(runId) => setDismissedRunIds((current) => (current.includes(runId) ? current : [...current, runId]))}
                  onReviewWithMarvin={onReviewWithMarvin}
                />
              ))}
            </div>
          </details>
        ) : null}
        {refreshError ? <div style={{ fontSize: 11, color: '#7c2e24', lineHeight: 1.5 }}>{refreshError}</div> : null}
      </div>
    </section>
  );
}

export function MissionControlChatSurface({
  summary,
  bridge,
  fallbackNotice,
  activation,
}: {
  summary: OrchestratorIntegrationSummary;
  bridge?: RuntimeBridgeState;
  fallbackNotice?: string;
  activation?: ChatSeatActivation | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const model = useMemo(() => buildChatSurfaceModel(summary), [summary]);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const sessionsRef = useRef<HTMLDivElement | null>(null);
  const contextStyles = contextTone(model.contextPercent);
  const bridgeRefreshing = Boolean(bridge?.refreshing);
  const bridgeError = bridge?.error ?? null;
  const effectiveBridgeError = fallbackNotice ?? bridgeError;
  const wsState = bridge?.wsState ?? 'unavailable';
  const wsDetail = bridge?.wsDetail ?? null;
  const sessionState = bridge?.session.state ?? 'unavailable';
  const sessionDetail = bridge?.session.detail ?? null;
  const sessionId = bridge?.session.sessionId ?? null;
  const sessionLastEvent = bridge?.session.lastEvent ?? null;
  const live = bridge?.live;
  const liveTargetSession = live?.targetSession.key ?? null;
  const liveTargetLabel = live?.targetSession.label ?? 'No target session';
  const liveMessages = useMemo(
    () => (live?.messages ?? []).slice().sort((a, b) => (a.at ?? 0) - (b.at ?? 0)),
    [live?.messages],
  );
  const liveEvents = live?.events ?? [];
  const liveNotices = (live?.notices ?? []) as RuntimeBridgeTransientNotice[];
  const liveCanSend = Boolean(live?.canSend);
  const liveSendState = live?.sendState ?? 'idle';
  const liveSendError = live?.sendError ?? null;
  const [composerValue, setComposerValue] = useState('');
  const [composerError, setComposerError] = useState<string | null>(null);
  const [sudoOrchestrationTrigger, setSudoOrchestrationTrigger] = useState(0);
  const [speechMessage, setSpeechMessage] = useState<string | null>(null);
  const {
    status: speechStatus,
    error: speechError,
    isSupported: speechSupported,
    supportReason: speechSupportReason,
    toggleRecording,
  } = useSpeechToText({
    onTranscript: (text) => {
      setComposerValue((current) => {
        const trimmed = text.trim();
        if (!trimmed) return current;
        if (!current.trim()) return trimmed;
        const separator = current.endsWith('\n') || /\s$/.test(current) ? '' : ' ';
        return `${current}${separator}${trimmed}`;
      });
      setSpeechMessage('Transcript added to composer. Edit before sending.');
      setComposerError(null);
    },
  });
  const [sudoBrief, setSudoBrief] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; path: string; size: number; mimeType: string }>>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [bridgeEventsOpen, setBridgeEventsOpen] = useState(false);
  const [topControlMenu, setTopControlMenu] = useState<TopControlMenu>(null);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [modelSwitchError, setModelSwitchError] = useState<string | null>(null);
  const [modelSwitchBusy, setModelSwitchBusy] = useState(false);
  const [effortSwitchBusy, setEffortSwitchBusy] = useState(false);
  const [runtimeDefaultsBusy, setRuntimeDefaultsBusy] = useState(false);
  const [optimisticModelLabel, setOptimisticModelLabel] = useState<string | null>(null);
  const [lastRequestedEffort, setLastRequestedEffort] = useState<EffortMenuOption | null>(null);
  const [pendingModelLabel, setPendingModelLabel] = useState<string | null>(null);
  const [pendingEffortLabel, setPendingEffortLabel] = useState<EffortMenuOption | null>(null);
  const [isNearTranscriptBottom, setIsNearTranscriptBottom] = useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const speechButtonEnabled = speechSupported && !uploadBusy && speechStatus !== 'transcribing';
  const statusDropdownRef = useRef<HTMLDivElement | null>(null);
  const bridgeEventsRef = useRef<HTMLDivElement | null>(null);
  const topControlMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (sessionsRef.current && !sessionsRef.current.contains(event.target as Node)) {
        setSessionsOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false);
      }
      if (bridgeEventsRef.current && !bridgeEventsRef.current.contains(event.target as Node)) {
        setBridgeEventsOpen(false);
      }
      if (topControlMenuRef.current && !topControlMenuRef.current.contains(event.target as Node)) {
        setTopControlMenu(null);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!speechMessage) return;
    const timeout = window.setTimeout(() => setSpeechMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [speechMessage]);

  useEffect(() => {
    if (controlsExpanded) return;
    setTopControlMenu(null);
    setSessionsOpen(false);
  }, [controlsExpanded]);

  const runtimeModelLabel = model.modelLabel.includes('gpt-5.4')
    ? 'gpt-5.4'
    : model.modelLabel.toLowerCase().includes('minimax')
      ? 'minimax-2.7'
      : model.modelLabel.toLowerCase().includes('codex') || model.modelLabel.toLowerCase().includes('5.3')
        ? 'codex-5.3'
        : model.modelLabel;
  const modelMenuLabel = optimisticModelLabel ?? pendingModelLabel ?? runtimeModelLabel;
  const xhighCapable = modelMenuLabel === 'gpt-5.4' || modelMenuLabel === 'codex-5.3';
  const boundedThinkCapable = modelMenuLabel === 'minimax-2.7';
  const effortInteractive = xhighCapable || boundedThinkCapable;
  const availableEffortOptions = xhighCapable ? effortMenuOptions : boundedThinkCapable ? effortMenuOptions.filter((level) => level !== 'xhigh') : [];
  const confirmedEffortLabel = model.effortLabel && model.effortLabel !== 'Not exposed yet' ? model.effortLabel : null;
  const effortMenuLabel = effortInteractive
    ? pendingEffortLabel
      ? `Last requested: ${pendingEffortLabel}`
      : lastRequestedEffort
        ? `Last requested: ${lastRequestedEffort}`
        : confirmedEffortLabel
          ? confirmedEffortLabel
          : 'Last requested: low'
    : 'Last requested: low';
  const visibleModelMenuOptions = modelMenuOptions.filter((option) => option.label !== modelMenuLabel);

  const lastRealModelRef = useRef(model.modelLabel.toLowerCase() !== 'runtime controlled' ? model.modelLabel : 'MiniMax-M2.7');

  if (model.modelLabel && model.modelLabel.toLowerCase() !== 'runtime controlled') {
    lastRealModelRef.current = model.modelLabel;
  }

  const selectedSeatLabel = activation?.label ?? 'Marvin';
  const assistantSeatLabel = assistantLabelForSeat(activation?.seatSlug);
  const selectedSeatDetail = activation
    ? activation.routing === 'direct'
      ? `Direct runtime · ${activation.targetSessionLabel}`
      : `${activation.supervisorLabel ?? 'Marvin'}-routed ${activation.runtimeModeLabel.toLowerCase()}`
    : 'Direct main runtime';
  const displayModelLabel = model.modelLabel.toLowerCase() === 'runtime controlled' ? lastRealModelRef.current : model.modelLabel;
  const agentMenuOptions = useMemo<AgentMenuOption[]>(
    () =>
      listPreferredChatSeatActivations().map((seat) => ({
        id: seat.seatId,
        seatSlug: seat.seatSlug,
        label: seat.label,
        note: seat.role,
        detail: seat.routing === 'direct' ? `Direct runtime · ${seat.targetSessionLabel}` : `${seat.supervisorLabel ?? 'Marvin'}-routed lead seat`,
        runtimeTag: seat.routingLabel,
      })),
    [],
  );

  async function handleModelSwitch(option: ModelMenuOption) {
    if (!live?.sendPrompt) {
      setModelSwitchError('Live bridge is unavailable for model switching right now.');
      return;
    }

    const previousLabel = modelMenuLabel;
    const previousEffort = lastRequestedEffort;
    setTopControlMenu(null);
    setOptimisticModelLabel(option.label);
    setPendingModelLabel(option.label);
    setLastRequestedEffort(null);
    setPendingEffortLabel(null);
    setModelSwitchBusy(true);
    setModelSwitchError(null);

    try {
      await live.sendPrompt(option.command);
      void bridge?.refresh();
    } catch (cause) {
      setOptimisticModelLabel(previousLabel);
      setPendingModelLabel(null);
      setLastRequestedEffort(previousEffort);
      setPendingEffortLabel(previousEffort);
      setModelSwitchError(cause instanceof Error ? cause.message : 'Mission Control could not switch models.');
    } finally {
      setModelSwitchBusy(false);
    }
  }

  async function handleEffortSwitch(option: EffortMenuOption) {
    if (!effortInteractive || !live?.sendPrompt) return;

    const previousEffort = lastRequestedEffort;
    setTopControlMenu(null);
    setLastRequestedEffort(option);
    setPendingEffortLabel(option);
    setEffortSwitchBusy(true);
    setModelSwitchError(null);

    try {
      await live.sendPrompt(`/think:${option}`);
      void bridge?.refresh();
    } catch (cause) {
      setLastRequestedEffort(previousEffort);
      setPendingEffortLabel(previousEffort);
      setModelSwitchError(cause instanceof Error ? cause.message : 'Mission Control could not change effort.');
    } finally {
      setEffortSwitchBusy(false);
    }
  }

  useEffect(() => {
    if (pendingModelLabel && runtimeModelLabel === pendingModelLabel) {
      setOptimisticModelLabel(null);
      setPendingModelLabel(null);
    }
  }, [pendingModelLabel, runtimeModelLabel]);

  useEffect(() => {
    if (!activation) return;
    if (!bridge) return;
    if (sessionState !== 'connected') return;
    if (liveTargetSession === activation.targetSessionKey) return;
    void bridge.switchSession(activation.targetSessionKey);
  }, [activation, bridge, liveTargetSession, sessionState]);

  useEffect(() => {
    if (!confirmedEffortLabel) return;
    const normalizedConfirmed = confirmedEffortLabel.toLowerCase();
    if (pendingEffortLabel && normalizedConfirmed === pendingEffortLabel) {
      setPendingEffortLabel(null);
      setLastRequestedEffort(null);
      return;
    }
    if (!pendingEffortLabel && lastRequestedEffort && normalizedConfirmed === lastRequestedEffort) {
      setLastRequestedEffort(null);
    }
  }, [confirmedEffortLabel, lastRequestedEffort, pendingEffortLabel]);

  async function applyRuntimeDefaults(modelAlias: ChatSeatActivation['defaultModel'], effort: EffortMenuOption) {
    if (!live?.sendPrompt) {
      throw new Error('Live bridge is unavailable for runtime-default changes right now.');
    }

    const matchingModelOption = modelMenuOptions.find((option) => option.id === modelAlias);
    const nextModelLabel = matchingModelOption?.label ?? modelAlias;
    const previousModelLabel = modelMenuLabel;
    const previousEffort = lastRequestedEffort;

    setOptimisticModelLabel(nextModelLabel);
    setPendingModelLabel(nextModelLabel);
    setLastRequestedEffort(effort);
    setPendingEffortLabel(effort);

    try {
      setModelSwitchError(null);
      await live.sendPrompt(`/model ${modelAlias}`);
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      await live.sendPrompt(`/think:${effort}`);
      void bridge?.refresh();
    } catch (cause) {
      setOptimisticModelLabel(previousModelLabel);
      setPendingModelLabel(null);
      setLastRequestedEffort(previousEffort);
      setPendingEffortLabel(previousEffort);
      throw cause;
    }
  }

  async function handleApplySeatDefaults() {
    if (!activation) return;

    setTopControlMenu(null);
    setRuntimeDefaultsBusy(true);
    try {
      await applyRuntimeDefaults(activation.defaultModel, activation.defaultThinking);
    } catch (cause) {
      setModelSwitchError(cause instanceof Error ? cause.message : 'Mission Control could not apply seat defaults.');
    } finally {
      setRuntimeDefaultsBusy(false);
    }
  }

  async function handleResetToDefaults() {
    setTopControlMenu(null);
    if (!live?.sendPrompt) {
      window.location.reload();
      return;
    }
    try {
      setModelSwitchBusy(true);
      setEffortSwitchBusy(true);
      await applyRuntimeDefaults('minimax2.7', 'low');
    } catch {
      window.location.reload();
    } finally {
      setModelSwitchBusy(false);
      setEffortSwitchBusy(false);
    }
  }

  async function uploadSelectedFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploadBusy(true);
    setComposerError(null);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      const response = await fetch('/api/files/upload', { method: 'POST', body: formData });
      const payload = (await response.json()) as { uploaded?: Array<{ name: string; path: string; size: number; mimeType: string }>; error?: string };
      if (!response.ok || !payload.uploaded) {
        throw new Error(payload.error || 'Upload failed.');
      }
      setAttachedFiles((current) => [...current, ...payload.uploaded!]);
    } catch (cause) {
      setComposerError(cause instanceof Error ? cause.message : 'Mission Control could not upload the selected files.');
    } finally {
      setUploadBusy(false);
    }
  }

  async function submitComposerPrompt(nextPrompt: string) {
    if (!nextPrompt && attachedFiles.length === 0) return;

    const attachmentNote = attachedFiles.length
      ? `\n\nAttached files uploaded to workspace:\n${attachedFiles.map((file) => `- ${file.path}`).join('\n')}`
      : '';
    const finalPrompt = `${nextPrompt}${attachmentNote}`.trim();

    if (activation?.seatSlug === 'dev-team') {
      try {
        setComposerError(null);
        setSudoBrief(finalPrompt);
        setComposerValue('');
        setAttachedFiles([]);
        setSudoOrchestrationTrigger((current) => current + 1);
      } catch (cause) {
        setComposerError(cause instanceof Error ? cause.message : 'Mission Control could not hand the brief to Sudo.');
      }
      return;
    }

    if (!live?.sendPrompt) return;

    try {
      setComposerError(null);
      await live.sendPrompt(finalPrompt);
      setComposerValue('');
      setAttachedFiles([]);
    } catch (cause) {
      setComposerError(cause instanceof Error ? cause.message : 'Mission Control could not send the prompt.');
    }
  }

  async function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitComposerPrompt(composerValue.trim());
  }

  async function handleNewSession() {
    await submitComposerPrompt('/new');
  }

  async function handleStop() {
    if (!live?.abortPrompt) return;

    try {
      setComposerError(null);
      await live.abortPrompt();
    } catch (cause) {
      setComposerError(cause instanceof Error ? cause.message : 'Mission Control could not stop the active response.');
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter') return;
    if (event.shiftKey) return;
    event.preventDefault();
    void submitComposerPrompt(composerValue.trim());
  }

  function handleComposerDragOver(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDraggingFiles(true);
  }

  function handleComposerDragLeave(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDraggingFiles(false);
  }

  function handleComposerDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDraggingFiles(false);
    if (event.dataTransfer.files.length > 0) {
      void uploadSelectedFiles(event.dataTransfer.files);
    }
  }

  function handleSeatSelection(seatSlug: string | null) {
    setTopControlMenu(null);

    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (seatSlug) {
      params.set('seat', seatSlug);
    } else {
      params.delete('seat');
    }

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }

  function handleSudoReviewWithMarvin(run: SudoOrchestrationRun) {
    handleSeatSelection('marvin');
    setComposerValue(buildSudoReviewPrompt(run));
    setComposerError(null);
  }

  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const container = transcriptScrollRef.current;
    if (!container) return;

    const updateBottomState = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const nearBottom = distanceFromBottom < 96;
      setIsNearTranscriptBottom(nearBottom);
      if (nearBottom) {
        setShowJumpToLatest(false);
      }
    };

    updateBottomState();
    container.addEventListener('scroll', updateBottomState, { passive: true });
    return () => container.removeEventListener('scroll', updateBottomState);
  }, []);

  useEffect(() => {
    const container = transcriptScrollRef.current;
    const bottom = transcriptBottomRef.current;
    if (!container || !bottom) return;

    requestAnimationFrame(() => {
      if (isNearTranscriptBottom) {
        bottom.scrollIntoView({ block: 'end' });
        setShowJumpToLatest(false);
      } else {
        setShowJumpToLatest(true);
      }
    });
  }, [isNearTranscriptBottom, liveMessages.length, liveEvents.length, liveSendState]);

  const toolRows = liveEvents
    .filter((event): event is RuntimeBridgeLiveEvent & { tool: RuntimeBridgeToolEvent } => Boolean(event.tool))
    .map((event) => ({ id: `${event.id}-${event.tool.toolCallId ?? 'tool'}`, event, tool: event.tool }));

  const transcriptItems: Array<
    | { type: 'message'; id: string; at: number; message: RuntimeBridgeChatMessage }
    | { type: 'tools'; id: string; at: number; rows: ToolGroupRow[]; keepOpen: boolean }
  > = [];

  const toolCallGroups = new Map<string, ToolGroupRow[]>();
  for (const row of toolRows) {
    const key = `${row.event.runId ?? 'runless'}:${row.tool.toolCallId ?? row.id}`;
    const group = toolCallGroups.get(key) ?? [];
    group.push(row);
    toolCallGroups.set(key, group);
  }

  const sortedToolCallGroups = Array.from(toolCallGroups.values())
    .map((rows) => rows.slice().sort((a, b) => a.event.at - b.event.at))
    .sort((a, b) => (a[0]?.event.at ?? 0) - (b[0]?.event.at ?? 0));

  const toolBursts: Array<{ id: string; at: number; endAt: number; runId: string | null; rows: ToolGroupRow[] }> = [];

  for (const rows of sortedToolCallGroups) {
    const startAt = rows[0]?.event.at ?? Date.now();
    const endAt = rows[rows.length - 1]?.event.at ?? startAt;
    const runId = rows[0]?.event.runId ?? null;
    const previous = toolBursts[toolBursts.length - 1];

    if (previous && previous.runId === runId && startAt - previous.endAt <= TOOL_BURST_WINDOW_MS) {
      previous.rows.push(...rows);
      previous.endAt = Math.max(previous.endAt, endAt);
      continue;
    }

    toolBursts.push({
      id: `tools-${rows[0]?.id ?? 'group'}`,
      at: startAt,
      endAt,
      runId,
      rows: [...rows],
    });
  }

  toolBursts.forEach((burst, index) => {
    transcriptItems.push({
      type: 'tools',
      id: burst.id,
      at: burst.at,
      rows: burst.rows,
      keepOpen: index === toolBursts.length - 1,
    });
  });

  for (const message of liveMessages) {
    transcriptItems.push({ type: 'message', id: message.id, at: message.at ?? Date.now(), message });
  }

  transcriptItems.sort((a, b) => a.at - b.at);
  const controlsDetailsId = 'chat-surface-top-controls';

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', gap: 8, minHeight: '100%', height: '100%' }}>
      <section
        style={{
          border: '1px solid rgba(200, 195, 188, 0.42)',
          borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(255, 253, 251, 0.94) 0%, rgba(245, 240, 235, 0.92) 54%, rgba(233, 244, 238, 0.88) 100%)',
          boxShadow: '0 14px 38px rgba(26, 61, 50, 0.08)',
          padding: '10px 16px',
          display: 'grid',
          gap: 10,
          position: 'sticky',
          top: 4,
          zIndex: 12,
        }}
      >
        {/* Row 1: WS + Session status (left) / Refresh, Stop, Context Meter (right) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Left: WS OPEN / SESSION CONNECTED / Status dropdown */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={pillStyle({ active: wsState === 'open' })}>{`ws ${wsState}`}</span>
            <span style={pillStyle({ active: sessionState === 'connected' })}>{`session ${sessionState}`}</span>
            
            {/* Status dropdown trigger */}
            <div ref={statusDropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setStatusDropdownOpen((v) => !v)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '1px solid rgba(200, 195, 188, 0.4)',
                  background: effectiveBridgeError ? 'rgba(248, 113, 113, 0.14)' : 'rgba(255, 255, 255, 0.7)',
                  color: effectiveBridgeError ? '#f87171' : 'var(--text-body)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}
                title={effectiveBridgeError ? 'Bridge error' : wsDetail || 'WS status'}
              >
                {effectiveBridgeError ? '!' : 'ⓘ'}
              </button>
              {statusDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    width: 'min(320px, 92vw)',
                    border: '1px solid rgba(200, 195, 188, 0.4)',
                    borderRadius: 14,
                    background: 'rgba(255, 253, 251, 0.98)',
                    boxShadow: '0 12px 32px rgba(26, 61, 50, 0.12)',
                    padding: 12,
                    display: 'grid',
                    gap: 8,
                    zIndex: 20,
                  }}
                >
                  {effectiveBridgeError ? (
                    <div style={{ fontSize: 12, color: '#9a4b43', lineHeight: 1.6 }}>
                      Bridge refresh failed: {effectiveBridgeError}
                    </div>
                  ) : wsDetail ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {wsDetail}
                    </div>
                  ) : sessionDetail ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {sessionDetail}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      WS sidecar socket is open. Waiting for gateway handshake.
                    </div>
                  )}
                  {sessionId && (
                    <div style={{ fontSize: 11, fontFamily: monoFont, color: 'var(--text-ghost)' }}>
                      Session: {sessionId}
                    </div>
                  )}
                  {sessionLastEvent && (
                    <div style={{ fontSize: 11, color: 'var(--text-ghost)' }}>
                      Last event: {sessionLastEvent}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Refresh / Stop / Context Meter */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {bridge ? (
              <button
                type="button"
                onClick={() => void bridge.refresh()}
                disabled={bridgeRefreshing}
                title="Refresh the bounded runtime bridge snapshot."
                style={{
                  ...actionButtonStyle(true),
                  border: '1px solid rgba(200, 195, 188, 0.46)',
                  background: 'rgba(255, 255, 255, 0.78)',
                  color: 'var(--text-body)',
                  cursor: bridgeRefreshing ? 'progress' : 'pointer',
                  padding: '8px 12px',
                  fontSize: 11,
                }}
              >
                {bridgeRefreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleStop()}
              disabled={!live?.canAbort}
              title={live?.canAbort ? 'Stop the active Mission Control chat response.' : 'Stop becomes available while a Mission Control chat response is active.'}
              style={{ ...actionButtonStyle(Boolean(live?.canAbort)), border: '1px solid rgba(200, 195, 188, 0.46)', background: 'rgba(255, 255, 255, 0.78)', color: live?.canAbort ? 'var(--text-body)' : 'var(--text-muted)', padding: '8px 12px', fontSize: 11 }}
            >
              Stop
            </button>
            {/* Context Meter inline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid rgba(200, 195, 188, 0.34)', borderRadius: 999, background: 'rgba(255, 255, 255, 0.7)' }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Context</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: contextStyles.text }}>{model.contextPercent !== null ? `${model.contextPercent}%` : 'n/a'}</span>
              <div style={{ width: 48, height: 6, borderRadius: 999, background: 'rgba(221, 215, 209, 0.62)', overflow: 'hidden' }}>
                <div style={{ width: `${model.contextPercent ?? 18}%`, minWidth: model.contextPercent === null ? 24 : undefined, height: '100%', borderRadius: 999, background: contextStyles.bar }} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setControlsExpanded((current) => !current)}
              aria-controls={controlsDetailsId}
              aria-expanded={controlsExpanded}
              style={{
                border: '1px solid rgba(200, 195, 188, 0.34)',
                borderRadius: 14,
                background: 'rgba(255, 255, 255, 0.7)',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Controls</span>
              <span style={{ fontSize: 11, color: 'var(--text-body)' }}>{controlsExpanded ? '▴' : '▾'}</span>
            </button>
          </div>
        </div>

        {/* Row 2: SESSION/AGENT / MODEL / EFFORT / RESET / RECENT SESSIONS */}
        <details
          id={controlsDetailsId}
          open={controlsExpanded}
          onToggle={(event) => setControlsExpanded((event.currentTarget as HTMLDetailsElement).open)}
          style={{
            border: '1px solid rgba(200, 195, 188, 0.34)',
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.45)',
            padding: '8px 10px',
          }}
        >
          <summary
            style={{
              listStyle: 'none',
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            Chat controls
          </summary>
          <div ref={topControlMenuRef} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setTopControlMenu((current) => (current === 'agent' ? null : 'agent'))}
              style={{ border: '1px solid rgba(200, 195, 188, 0.34)', borderRadius: 14, background: 'rgba(255, 255, 255, 0.7)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 228, minHeight: 32, textAlign: 'left', cursor: 'pointer' }}
            >
              <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Seat</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedSeatLabel}</div>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-ghost)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedSeatDetail}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-ghost)', flexShrink: 0 }}>▾</span>
            </button>
            {topControlMenu === 'agent' ? (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 260, maxHeight: 'min(360px, calc(100vh - 180px))', overflowY: 'auto', border: '1px solid rgba(200, 195, 188, 0.4)', borderRadius: 16, background: 'rgba(255, 253, 251, 0.98)', boxShadow: '0 18px 40px rgba(26, 61, 50, 0.14)', padding: 8, display: 'grid', gap: 6, zIndex: 20 }}>
                {agentMenuOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSeatSelection(option.seatSlug)}
                    style={{ border: 'none', borderRadius: 12, background: option.label === selectedSeatLabel ? 'rgba(212, 231, 221, 0.66)' : 'transparent', padding: '10px 12px', display: 'grid', gap: 4, textAlign: 'left', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)' }}>{option.label}</span>
                      {option.runtimeTag ? <span style={pillStyle(option.label === selectedSeatLabel ? { active: true } : undefined)}>{option.runtimeTag}</span> : null}
                    </div>
                    {option.note ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{option.note}</span> : null}
                    {option.detail ? <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{option.detail}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setTopControlMenu((current) => (current === 'model' ? null : 'model'))}
              disabled={modelSwitchBusy}
              style={{ border: '1px solid rgba(200, 195, 188, 0.34)', borderRadius: 14, background: 'rgba(255, 255, 255, 0.7)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 188, minHeight: 32, textAlign: 'left', cursor: modelSwitchBusy ? 'progress' : 'pointer', opacity: modelSwitchBusy ? 0.82 : 1 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Model</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{optimisticModelLabel ?? displayModelLabel}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-ghost)', flexShrink: 0 }}>▾</span>
            </button>
            {topControlMenu === 'model' ? (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 220, border: '1px solid rgba(200, 195, 188, 0.4)', borderRadius: 16, background: 'rgba(255, 253, 251, 0.98)', boxShadow: '0 18px 40px rgba(26, 61, 50, 0.14)', padding: 8, display: 'grid', gap: 6, zIndex: 20 }}>
                {visibleModelMenuOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => void handleModelSwitch(option)}
                    disabled={modelSwitchBusy}
                    style={{ border: 'none', borderRadius: 12, padding: '10px 12px', display: 'grid', gap: 2, textAlign: 'left', background: 'transparent', cursor: modelSwitchBusy ? 'progress' : 'pointer', opacity: modelSwitchBusy ? 0.76 : 1 }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)' }}>{option.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{option.command}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => effortInteractive && setTopControlMenu((current) => (current === 'effort' ? null : 'effort'))}
              disabled={!effortInteractive || effortSwitchBusy}
              style={{ border: '1px solid rgba(200, 195, 188, 0.34)', borderRadius: 14, background: effortInteractive ? 'rgba(255, 255, 255, 0.7)' : 'rgba(247, 242, 236, 0.82)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 188, minHeight: 32, textAlign: 'left', cursor: effortInteractive && !effortSwitchBusy ? 'pointer' : 'not-allowed', opacity: effortInteractive ? 1 : 0.72 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Effort</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{effortMenuLabel}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-ghost)', flexShrink: 0 }}>{effortInteractive ? '▾' : '—'}</span>
            </button>
            {topControlMenu === 'effort' ? (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 220, border: '1px solid rgba(200, 195, 188, 0.4)', borderRadius: 16, background: 'rgba(255, 253, 251, 0.98)', boxShadow: '0 18px 40px rgba(26, 61, 50, 0.14)', padding: 8, display: 'grid', gap: 6, zIndex: 20 }}>
                {availableEffortOptions.filter((label) => label !== lastRequestedEffort).map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => void handleEffortSwitch(label)}
                    disabled={effortSwitchBusy}
                    style={{ border: 'none', borderRadius: 12, padding: '10px 12px', display: 'grid', gap: 2, textAlign: 'left', background: 'transparent', cursor: effortSwitchBusy ? 'progress' : 'pointer', opacity: effortSwitchBusy ? 0.76 : 1 }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)', textTransform: 'capitalize' }}>{label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{`/think:${label}`}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {activation ? (
            <button
              type="button"
              onClick={() => void handleApplySeatDefaults()}
              disabled={runtimeDefaultsBusy}
              title={`Apply ${activation.label} seat defaults`}
              style={{
                ...actionButtonStyle(!runtimeDefaultsBusy, true),
                padding: '8px 12px',
                fontSize: 11,
                cursor: runtimeDefaultsBusy ? 'progress' : 'pointer',
              }}
            >
              {runtimeDefaultsBusy ? 'Applying…' : 'Apply seat defaults'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleResetToDefaults}
            title="Reset to defaults: Marvin / MiniMax-M2.7 / None"
            style={{
              ...actionButtonStyle(true),
              border: '1px solid rgba(200, 195, 188, 0.46)',
              background: 'rgba(255, 255, 255, 0.78)',
              color: 'var(--text-body)',
              cursor: 'pointer',
              padding: '8px 14px',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Reset
          </button>
          <div ref={sessionsRef} style={{ position: 'relative', marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={() => setSessionsOpen((value) => !value)}
              style={{
                border: '1px solid rgba(200, 195, 188, 0.34)',
                borderRadius: 14,
                background: 'rgba(255, 255, 255, 0.7)',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 32,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Recent Sessions</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)', lineHeight: 1 }}>{model.recentSessions.length}</span>
            </button>
            {sessionsOpen ? (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 'min(360px, 92vw)',
                  border: '1px solid rgba(200, 195, 188, 0.4)',
                  borderRadius: 18,
                  background: 'rgba(255, 253, 251, 0.96)',
                  boxShadow: '0 18px 40px rgba(26, 61, 50, 0.14)',
                  padding: 12,
                  display: 'grid',
                  gap: 10,
                  zIndex: 10,
                }}
              >
                {model.recentSessions.length > 0 ? (
                  model.recentSessions.slice(0, 6).map((session) => {
                    const isActive = session.key === liveTargetSession;
                    return (
                      <button
                        key={session.key}
                        type="button"
                        onClick={() => {
                          setSessionsOpen(false);
                          if (session.key !== liveTargetSession) {
                            void bridge?.switchSession(session.key);
                          }
                        }}
                        style={{ border: `1px solid ${isActive ? 'rgba(121, 166, 148, 0.42)' : 'rgba(200, 195, 188, 0.34)'}`, borderRadius: 14, background: isActive ? 'rgba(212, 231, 221, 0.52)' : 'rgba(255, 255, 255, 0.78)', padding: 12, display: 'grid', gap: 8, textAlign: 'left', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)' }}>{session.key.includes('builder') ? 'Builder' : session.key.includes('reviewer') ? 'Reviewer' : session.kind}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{isActive ? 'Current' : formatAge(session.ageMs)}</span>
                        </div>
                        <div style={{ fontFamily: monoFont, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.key}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span style={pillStyle()}>{session.model ?? 'runtime controlled'}</span>
                          <span style={pillStyle()}>{session.tokenUsage?.percentUsed != null ? `${session.tokenUsage.percentUsed}% ctx` : 'ctx unknown'}</span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                    No recent sessions were exposed by the adapter in this environment.
                  </div>
                )}
              </div>
            ) : null}
          </div>
          </div>
        </details>
        {modelSwitchError ? (
          <div style={{ fontSize: 12, color: '#9a4b43', lineHeight: 1.6, paddingLeft: 4 }}>
            {modelSwitchError}
          </div>
        ) : null}
      </section>

      {activation?.seatSlug === 'dev-team' ? (
        <div style={{ paddingTop: 4, paddingBottom: 2 }}>
          <SudoDelegationPanel
            draftPrompt={composerValue}
            activePrompt={sudoBrief}
            sourceSessionKey={liveTargetSession || activation.targetSessionKey}
            orchestrationTrigger={sudoOrchestrationTrigger}
            onReviewWithMarvin={handleSudoReviewWithMarvin}
          />
        </div>
      ) : null}

      <section
        ref={transcriptScrollRef}
        style={{
          position: 'relative',
          zIndex: 0,
          border: 'none',
          borderRadius: 0,
          background: 'transparent',
          boxShadow: 'none',
          padding: '10px 0 2px',
          display: 'grid',
          gap: 14,
          minHeight: 0,
          overflow: 'auto',
          overflowAnchor: 'none',
          scrollPaddingBottom: 8,
        }}
      >
        <section style={{ border: '1px solid rgba(200, 195, 188, 0.32)', borderRadius: 18, background: 'rgba(255, 255, 255, 0.84)', padding: 16, display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)' }}>Live bridge session</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={pillStyle()}>{liveTargetLabel}</span>
              <div ref={bridgeEventsRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setBridgeEventsOpen((value) => !value)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: '1px solid rgba(200, 195, 188, 0.38)',
                    background: 'rgba(255, 255, 255, 0.76)',
                    color: 'var(--text-body)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                  }}
                  title="Recent bridge events"
                >
                  ⓘ
                </button>
                {bridgeEventsOpen ? (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 'min(360px, 92vw)', border: '1px solid rgba(200, 195, 188, 0.4)', borderRadius: 16, background: 'rgba(255, 253, 251, 0.98)', boxShadow: '0 18px 40px rgba(26, 61, 50, 0.14)', padding: 10, display: 'grid', gap: 8, zIndex: 20 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Recent bridge events</div>
                    {liveEvents.length > 0 ? (
                      liveEvents.slice().reverse().map((eventItem) => <LiveEventBlock key={eventItem.id} event={eventItem} />)
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                        No bridge events observed yet beyond the connection handshake.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 18 }}>
            {liveNotices.length > 0 ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {liveNotices.slice().reverse().map((notice) => (
                  <div
                    key={notice.id}
                    style={{
                      border: '1px solid rgba(121, 166, 148, 0.28)',
                      borderRadius: 12,
                      background: 'rgba(240, 248, 244, 0.9)',
                      color: '#163b31',
                      padding: '8px 10px',
                      fontSize: 12,
                      lineHeight: 1.5,
                      fontWeight: 600,
                    }}
                  >
                    SYSTEM NOTICE · {notice.message}
                  </div>
                ))}
              </div>
            ) : null}
            {transcriptItems.length > 0 ? (
              transcriptItems.map((item) =>
                item.type === 'message'
                  ? <LiveMessageBlock key={item.id} message={item.message} assistantLabel={assistantSeatLabel} />
                  : <ToolGroupBlock key={item.id} rows={item.rows} keepOpen={item.keepOpen} />,
              )
            ) : (
              <div style={{ padding: '6px 2px', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                No live transcript yet. Send one prompt after the gateway session is connected to this target: <span style={{ fontFamily: monoFont }}>{liveTargetLabel}</span>.
              </div>
            )}
          </div>
          {showJumpToLatest ? (
            <div style={{ position: 'sticky', bottom: 10, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <button
                type="button"
                onClick={() => {
                  transcriptBottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
                  setShowJumpToLatest(false);
                }}
                style={{ pointerEvents: 'auto', border: '1px solid rgba(121, 166, 148, 0.28)', borderRadius: 999, background: 'rgba(255, 253, 251, 0.96)', color: 'var(--text-body)', boxShadow: '0 10px 26px rgba(26, 61, 50, 0.12)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Jump to latest ↓
              </button>
            </div>
          ) : null}
        </section>
        <div ref={transcriptBottomRef} style={{ height: 1, width: '100%' }} />
      </section>

      <form onSubmit={handleComposerSubmit} onDragOver={handleComposerDragOver} onDragLeave={handleComposerDragLeave} onDrop={handleComposerDrop} style={{ border: isDraggingFiles ? '1px solid rgba(121, 166, 148, 0.54)' : '1px solid rgba(200, 195, 188, 0.32)', borderRadius: 18, background: isDraggingFiles ? 'rgba(244, 249, 246, 0.96)' : 'rgba(255, 255, 255, 0.9)', padding: 12, display: 'grid', gap: 8, zIndex: 11, boxShadow: '0 -8px 24px rgba(26, 61, 50, 0.08)' }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(event) => {
              if (event.target.files?.length) {
                void uploadSelectedFiles(event.target.files);
                event.target.value = '';
              }
            }}
            style={{ display: 'none' }}
          />
          {attachedFiles.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {attachedFiles.map((file) => (
                <div key={`${file.path}-${file.name}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 999, border: '1px solid rgba(200, 195, 188, 0.28)', background: 'rgba(250, 248, 245, 0.92)', fontSize: 12, color: 'var(--text-muted)' }}>
                  <span style={{ fontFamily: monoFont }}>{file.name}</span>
                  <button type="button" onClick={() => setAttachedFiles((current) => current.filter((entry) => entry.path !== file.path))} style={{ border: 'none', background: 'transparent', color: 'var(--text-ghost)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          ) : null}
          {isDraggingFiles ? <div style={{ fontSize: 12, color: '#163b31', padding: '2px 2px 0' }}>Drop files here to upload them into <span style={{ fontFamily: monoFont }}>uploads/mission-control/</span>.</div> : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'end' }}>
            <textarea
              value={composerValue}
              onChange={(event) => setComposerValue(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={2}
              disabled={!liveTargetSession || sessionState !== 'connected' || liveSendState === 'sending' || liveSendState === 'streaming'}
              placeholder={
                sessionState === 'connected'
                  ? liveTargetSession
                    ? `Message to ${liveTargetLabel}.`
                    : 'A connected bridge still needs one visible runtime session key before Mission Control can send.'
                  : 'Composer unlocks after the real gateway session connects.'
              }
              aria-label="Composer"
              style={{
                width: '100%',
                minHeight: 64,
                maxHeight: 120,
                resize: 'none',
                borderRadius: 16,
                border: '1px solid rgba(200, 195, 188, 0.32)',
                background: 'rgba(250, 248, 245, 0.94)',
                padding: '12px 14px',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 2 }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadBusy}
                aria-label="Add attachment"
                title={uploadBusy ? 'Uploading...' : 'Add attachment'}
                style={composerIconButtonStyle(!uploadBusy)}
              >
                <PaperclipIcon />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSpeechMessage(null);
                  void toggleRecording();
                }}
                disabled={!speechButtonEnabled}
                aria-label={
                  speechStatus === 'recording'
                    ? 'Stop recording'
                    : speechStatus === 'transcribing'
                      ? 'Transcribing audio'
                      : 'Start voice input'
                }
                title={
                  !speechSupported
                    ? 'Voice input is not supported in this browser'
                    : speechStatus === 'recording'
                      ? 'Stop recording'
                      : speechStatus === 'transcribing'
                        ? 'Transcribing...'
                        : 'Start voice input'
                }
                style={{
                  ...composerIconButtonStyle(speechButtonEnabled),
                  background:
                    speechStatus === 'recording'
                      ? 'rgba(183, 76, 67, 0.18)'
                      : speechStatus === 'transcribing'
                        ? 'rgba(121, 166, 148, 0.2)'
                        : composerIconButtonStyle(speechButtonEnabled).background,
                  border:
                    speechStatus === 'recording'
                      ? '1px solid rgba(183, 76, 67, 0.46)'
                      : speechStatus === 'transcribing'
                        ? '1px solid rgba(121, 166, 148, 0.42)'
                        : composerIconButtonStyle(speechButtonEnabled).border,
                  color: speechStatus === 'recording' ? '#8e2f26' : undefined,
                }}
              >
                <MicIcon />
              </button>
              <button
                type="button"
                onClick={() => void handleNewSession()}
                disabled={!liveCanSend || liveSendState === 'sending' || liveSendState === 'streaming'}
                aria-label="New session"
                title="New session"
                style={composerIconButtonStyle(liveCanSend && liveSendState !== 'sending' && liveSendState !== 'streaming')}
              >
                <NewSessionIcon />
              </button>
              <button
                type="submit"
                disabled={(!(activation?.seatSlug === 'dev-team') && !liveCanSend) || (composerValue.trim().length === 0 && attachedFiles.length === 0)}
                aria-label={activation?.seatSlug === 'dev-team' ? 'Let Sudo handle this' : liveSendState === 'sending' ? 'Sending' : liveSendState === 'streaming' ? 'Waiting' : 'Send'}
                title={activation?.seatSlug === 'dev-team' ? 'Let Sudo handle this' : liveSendState === 'sending' ? 'Sending...' : liveSendState === 'streaming' ? 'Waiting...' : 'Send'}
                style={composerIconButtonStyle(((activation?.seatSlug === 'dev-team') || liveCanSend) && (composerValue.trim().length > 0 || attachedFiles.length > 0))}
              >
                <SendIcon />
              </button>
            </div>
          </div>
        {(!speechSupported || speechStatus === 'recording' || speechStatus === 'transcribing' || speechError || speechMessage) ? (
          <div
            style={{
              fontSize: 12,
              color: speechError ? '#9a4b43' : speechStatus === 'recording' ? '#8e2f26' : 'var(--text-muted)',
              maxWidth: 720,
            }}
          >
            {!speechSupported
              ? (speechSupportReason || 'Voice input is not available in this browser.')
              : speechError
                ? `Voice input error: ${speechError}`
                : speechStatus === 'recording'
                  ? 'Recording… click the mic again to stop.'
                  : speechStatus === 'transcribing'
                    ? 'Transcribing…'
                    : speechMessage}
          </div>
        ) : null}
        {(composerError || liveSendError || effectiveBridgeError || (!liveTargetSession && sessionState === 'connected')) ? (
          <div style={{ fontSize: 12, color: composerError || liveSendError || effectiveBridgeError ? '#9a4b43' : 'var(--text-muted)', maxWidth: 720 }}>
            {composerError || liveSendError || (effectiveBridgeError ? `Last refresh error: ${effectiveBridgeError}` : 'The gateway session is live, but Mission Control still needs one visible runtime session key before it can issue a real prompt.')}
          </div>
        ) : null}
      </form>
    </div>
  );
}
