'use client';

import Link from 'next/link';
import { Bot, Brain, Cpu } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from 'react';
import type { CSSProperties } from 'react';
import {
  buildFilesHref,
  monoFont,
  renderPlainTextWithFileLinks,
} from '@/components/chat/chat-rich-text';
import { ChatComposer } from '@/components/chat/chat-composer';
import { assistantLabelForSeat } from '@/components/chat/chat-message-blocks';
import { ChatSessionRail } from '@/components/chat/chat-session-rail';
import {
  LiveTranscriptSection,
  type ChatTranscriptItem,
} from '@/components/chat/chat-transcript-adjacent';
import {
  formatEventTime,
} from '@/components/chat/chat-tool-groups';
import {
  actionButtonStyle,
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
  RuntimeBridgeState,
} from '@/hooks/useRuntimeBridge';
import { buildChatSurfaceModel } from '@/lib/chat/thread-model';
import { useSpeechToText } from '@/components/chat/useSpeechToText';
import { shapeTranscriptEntriesForRender } from '@/lib/chat/runtime-bridge-transcript';
import type { OrchestratorIntegrationSummary } from '@/lib/types/contracts';

const TOOL_BURST_WINDOW_MS = 10000;

type TopControlMenu = 'agent' | 'model' | 'effort' | null;
type RuntimeStatusTone = 'ready' | 'working' | 'finalizing' | 'attention' | 'recovering' | 'disconnected';

type RuntimeStatus = {
  label: 'Ready' | 'Working' | 'Finalizing' | 'Attention' | 'Recovering' | 'Disconnected';
  tone: RuntimeStatusTone;
  detail: string;
};

type RunStatus = {
  label: 'Idle' | 'Running' | 'Syncing';
  tone: RuntimeStatusTone;
  detail: string;
};

type AgentMenuOption = {
  id: string;
  seatSlug: string | null;
  label: string;
  note?: string;
  detail?: string;
  runtimeTag?: string;
};

type ModelMenuOption = {
  id: 'codex5.5' | 'codex5.4' | 'codex' | 'minimax2.7';
  label: string;
  command: string;
};

function runtimeModelCommand(modelAlias: ModelMenuOption['id'] | ChatSeatActivation['defaultModel']): string {
  if (modelAlias === 'codex5.5') return '/model openai-codex/gpt-5.5';
  if (modelAlias === 'codex5.4') return '/model openai-codex/gpt-5.4';
  if (modelAlias === 'codex5.4mini') return '/model openai-codex/gpt-5.4-mini';
  if (modelAlias === 'codex') return '/model codex';
  if (modelAlias === 'minimax2.7') return '/model minimax2.7';
  return `/model ${modelAlias}`;
}

const modelMenuOptions: ModelMenuOption[] = [
  { id: 'codex5.5', label: 'gpt-5.5', command: runtimeModelCommand('codex5.5') },
  { id: 'codex5.4', label: 'gpt-5.4', command: runtimeModelCommand('codex5.4') },
  { id: 'codex', label: 'codex-5.3', command: runtimeModelCommand('codex') },
  { id: 'minimax2.7', label: 'minimax-2.7', command: runtimeModelCommand('minimax2.7') },
];

const effortMenuOptions = ['low', 'medium', 'high', 'xhigh'] as const;
type EffortMenuOption = (typeof effortMenuOptions)[number];

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

function runtimeStatusStyle(tone: RuntimeStatusTone): CSSProperties {
  if (tone === 'attention') {
    return {
      ...pillStyle(),
      border: '1px solid rgba(181, 88, 74, 0.34)',
      background: 'rgba(244, 224, 220, 0.88)',
      color: '#7c2e24',
    };
  }
  if (tone === 'recovering') {
    return {
      ...pillStyle(),
      border: '1px solid rgba(96, 118, 145, 0.32)',
      background: 'rgba(230, 236, 245, 0.9)',
      color: '#314b66',
    };
  }
  if (tone === 'disconnected') {
    return {
      ...pillStyle(),
      border: '1px solid rgba(200, 195, 188, 0.42)',
      background: 'rgba(247, 242, 236, 0.9)',
      color: 'var(--text-muted)',
    };
  }
  if (tone === 'working') {
    return {
      ...pillStyle(),
      border: '1px solid rgba(114, 96, 31, 0.3)',
      background: 'rgba(247, 241, 219, 0.92)',
      color: '#5d4814',
    };
  }
  if (tone === 'finalizing') {
    return {
      ...pillStyle(),
      border: '1px solid rgba(96, 118, 145, 0.32)',
      background: 'rgba(230, 236, 245, 0.9)',
      color: '#314b66',
    };
  }
  return pillStyle({ active: true });
}

function friendlySessionLabel(key: string | null | undefined, fallback = 'Marvin'): string {
  if (!key) return 'No active chat';
  if (key === 'agent:main:main') return fallback;
  if (key.startsWith('agent:') && key.endsWith(':main')) return fallback;
  return 'Selected chat';
}

function friendlyRuntimeDetail(text: string | null | undefined): string | null {
  if (!text) return null;
  return text
    .replace(/server-owned\s+/gi, '')
    .replace(/HTTP runtime bridge/gi, 'chat connection')
    .replace(/runtime bridge/gi, 'chat connection')
    .replace(/gateway session/gi, 'chat session')
    .replace(/gateway handshake/gi, 'chat handshake')
    .replace(/websocket/gi, 'live connection')
    .replace(/sidecar/gi, 'service')
    .replace(/visible runtime session key/gi, 'active chat')
    .replace(/agent:main:main/g, 'Marvin')
    .replace(/\s+/g, ' ')
    .trim();
}

function iconCircleButtonStyle(active = true): CSSProperties {
  return {
    ...actionButtonStyle(active),
    border: '1px solid rgba(200, 195, 188, 0.46)',
    background: 'rgba(255, 255, 255, 0.78)',
    color: active ? 'var(--text-body)' : 'var(--text-muted)',
    width: 30,
    height: 30,
    padding: 0,
    fontSize: 12,
    borderRadius: 999,
    flexShrink: 0,
  };
}

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
  const bridgeRefreshing = Boolean(bridge?.refreshing);
  const bridgeError = bridge?.error ?? null;
  const effectiveBridgeError = fallbackNotice ?? bridgeError;
  const bridgeTiming = bridge?.timing ?? null;
  const wsState = bridge?.wsState ?? 'unavailable';
  const wsDetail = bridge?.wsDetail ?? null;
  const sessionState = bridge?.session.state ?? 'unavailable';
  const sessionDetail = bridge?.session.detail ?? null;
  const sessionId = bridge?.session.sessionId ?? null;
  const sessionLastEvent = bridge?.session.lastEvent ?? null;
  const live = bridge?.live;
  const historySource = bridge?.history.source ?? 'unavailable';
  const historyNote = bridge?.history.note ?? null;
  const historyThinkingLevel = bridge?.history.thinkingLevel ?? null;
  const historySessionId = bridge?.history.sessionId ?? null;
  const liveTargetSession = live?.targetSession.key ?? null;
  const runtimeBridgeLane = summary.runtimeBridgeLane ?? 'live';
  const runtimeBridgeLaneLabel = runtimeBridgeLane === 'preview' ? 'Preview' : runtimeBridgeLane === 'lab' ? 'Lab' : 'Live';
  const summaryFallbackTargetKey = activation?.targetSessionKey ?? summary.sessionContext.mainSession.key ?? null;
  const summaryFallbackTargetLabel = summaryFallbackTargetKey
    ? summaryFallbackTargetKey === summary.sessionContext.mainSession.key
      ? 'agent:main:main'
      : summaryFallbackTargetKey
    : 'No target session';
  const liveTargetLabel = live?.targetSession.label ?? summaryFallbackTargetLabel;
  const mainRecentSession = useMemo(
    () => summary.sessionContext.recent.find((session) => session.key === summary.sessionContext.mainSession.key) ?? null,
    [summary.sessionContext.mainSession.key, summary.sessionContext.recent],
  );
  const topRailSession = useMemo(() => {
    const targetKey = liveTargetSession ?? activation?.targetSessionKey ?? null;
    if (targetKey) {
      const exactTarget = summary.sessionContext.recent.find((session) => session.key === targetKey);
      if (exactTarget) return exactTarget;
    }

    if (mainRecentSession) return mainRecentSession;

    return model.primarySession;
  }, [activation?.targetSessionKey, liveTargetSession, mainRecentSession, model.primarySession, summary.sessionContext.recent]);
  const topRailContextPercent =
    topRailSession?.tokenUsage?.percentUsed ??
    mainRecentSession?.tokenUsage?.percentUsed ??
    model.primarySession?.tokenUsage?.percentUsed ??
    summary.sessionContext.recent.find((session) => session.tokenUsage?.percentUsed != null)?.tokenUsage?.percentUsed ??
    model.contextPercent;
  const contextStyles = contextTone(topRailContextPercent);
  const liveEntries = useMemo(() => live?.entries ?? [], [live?.entries]);
  const liveEvents = live?.events ?? [];
  const liveCanSend = Boolean(live?.canSend);
  const liveCanAbort = Boolean(live?.canAbort);
  const liveSendState = live?.sendState ?? 'idle';
  const liveSendError = live?.sendError ?? null;
  const liveActiveRunId = live?.activeRunId ?? null;
  const recentTranscriptCutoff = Date.now() - 45_000;
  const hasRunningTranscriptActivity = liveEntries.some((entry) => {
    if (entry.at < recentTranscriptCutoff) return false;
    if (entry.kind === 'tool') return entry.status === 'running';
    if (entry.kind === 'message') return entry.status === 'streaming';
    return false;
  });
  const userFacingTargetLabel = friendlySessionLabel(liveTargetSession ?? summaryFallbackTargetKey, assistantLabelForSeat(activation?.seatSlug));
  const httpInteractiveRuntime = (sessionState === 'connected' && wsState !== 'open' && (liveCanSend || liveCanAbort || liveSendState === 'sending' || liveSendState === 'streaming' || Boolean(liveActiveRunId)));
  const handshakeRuntime = wsState === 'open' && (sessionState === 'waiting' || sessionState === 'connecting' || sessionState === 'challenged');
  const recoveringRuntime = (sessionState === 'connecting' || sessionState === 'waiting') && wsState !== 'unavailable' && (liveCanSend || liveCanAbort || Boolean(liveActiveRunId) || liveSendState === 'idle' || wsState === 'connecting' || wsState === 'open');
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


  const topRailModelLabel = topRailSession?.model ?? summary.sessionContext.mainSession.model ?? model.modelLabel;
  const normalizedTopRailModelLabel = topRailModelLabel.toLowerCase();
  const runtimeModelLabel = normalizedTopRailModelLabel.includes('gpt-5.5')
    ? 'gpt-5.5'
    : normalizedTopRailModelLabel.includes('gpt-5.4')
      ? 'gpt-5.4'
      : normalizedTopRailModelLabel.includes('minimax')
        ? 'minimax-2.7'
        : normalizedTopRailModelLabel.includes('codex') || normalizedTopRailModelLabel.includes('5.3')
          ? 'codex-5.3'
          : topRailModelLabel;
  const modelMenuLabel = optimisticModelLabel ?? pendingModelLabel ?? runtimeModelLabel;
  const xhighCapable = modelMenuLabel === 'gpt-5.5' || modelMenuLabel === 'gpt-5.4' || modelMenuLabel === 'codex-5.3';
  const boundedThinkCapable = modelMenuLabel === 'minimax-2.7';
  const effortInteractive = xhighCapable || boundedThinkCapable;
  const availableEffortOptions = xhighCapable ? effortMenuOptions : boundedThinkCapable ? effortMenuOptions.filter((level) => level !== 'xhigh') : [];
  const confirmedEffortLabel =
    topRailSession?.thinkingLevel && topRailSession.thinkingLevel !== 'Not exposed yet'
      ? topRailSession.thinkingLevel
      : model.effortLabel && model.effortLabel !== 'Not exposed yet'
        ? model.effortLabel
        : null;
  const effortMenuLabel = effortInteractive
    ? pendingEffortLabel
      ? `Last requested: ${pendingEffortLabel}`
      : lastRequestedEffort
        ? `Last requested: ${lastRequestedEffort}`
        : confirmedEffortLabel
          ? confirmedEffortLabel
          : 'Last requested: low'
    : 'Last requested: low';
  const compactEffortLabel = effortMenuLabel.replace(/^Last requested:\s*/i, '').trim();
  const effortTriggerLabel = compactEffortLabel.toLowerCase();
  const visibleModelMenuOptions = modelMenuOptions.filter((option) => option.label !== modelMenuLabel);

  const lastRealModelRef = useRef(topRailModelLabel.toLowerCase() !== 'runtime controlled' ? topRailModelLabel : 'MiniMax-M2.7');

  if (topRailModelLabel && topRailModelLabel.toLowerCase() !== 'runtime controlled') {
    lastRealModelRef.current = topRailModelLabel;
  }

  const selectedSeatLabel = activation?.label ?? 'Marvin';
  const assistantSeatLabel = assistantLabelForSeat(activation?.seatSlug);
  const runtimeStatus: RuntimeStatus = (() => {
    if (liveSendError || effectiveBridgeError || sessionState === 'error' || sessionState === 'rejected') {
      return {
        label: 'Attention',
        tone: 'attention',
        detail: liveSendError || effectiveBridgeError || sessionDetail || `${runtimeBridgeLaneLabel} runtime bridge needs attention.`,
      };
    }
    if (handshakeRuntime || recoveringRuntime) {
      return {
        label: 'Recovering',
        tone: 'recovering',
        detail: handshakeRuntime
          ? sessionDetail || wsDetail || `Mission Control is negotiating the ${runtimeBridgeLane === 'lab' ? 'lab' : 'live'} gateway handshake.`
          : sessionDetail || wsDetail || `Mission Control is reattaching the ${runtimeBridgeLane === 'lab' ? 'lab' : 'live'} websocket while the HTTP bridge remains available.`,
      };
    }
    if (sessionState !== 'connected') {
      return {
        label: 'Disconnected',
        tone: 'disconnected',
        detail: sessionDetail || wsDetail || `${runtimeBridgeLaneLabel} runtime is not connected yet.`,
      };
    }
    if (wsState !== 'open' && !httpInteractiveRuntime) {
      return {
        label: 'Disconnected',
        tone: 'disconnected',
        detail: sessionDetail || wsDetail || `${runtimeBridgeLaneLabel} runtime is not connected yet.`,
      };
    }
    if (liveSendState === 'sending' || liveSendState === 'streaming') {
      return {
        label: 'Working',
        tone: 'working',
        detail: httpInteractiveRuntime
          ? `Marvin is actively working through the server-owned ${runtimeBridgeLane === 'lab' ? 'lab' : 'live'} HTTP bridge.`
          : 'Marvin is actively working on the current run.',
      };
    }
    if (liveActiveRunId) {
      return {
        label: 'Finalizing',
        tone: 'finalizing',
        detail: 'Run is wrapping up and syncing final state.',
      };
    }
    return {
      label: 'Ready',
      tone: 'ready',
      detail: liveCanSend
        ? httpInteractiveRuntime
          ? `Ready through the server-owned ${runtimeBridgeLane === 'lab' ? 'lab' : 'live'} HTTP bridge. Live websocket events are unavailable.`
          : runtimeBridgeLane === 'lab'
            ? 'Lab lane is ready for the next prompt.'
            : 'Ready for the next prompt.'
        : 'Ready state is waiting on runtime session targeting.',
    };
  })();
  const runStatus: RunStatus = (() => {
    if (liveSendState === 'sending' || liveSendState === 'streaming') {
      return {
        label: 'Running',
        tone: 'working',
        detail: 'A chat response is currently active.',
      };
    }

    if (liveActiveRunId || hasRunningTranscriptActivity) {
      return {
        label: 'Syncing',
        tone: 'finalizing',
        detail: 'Recent activity is still being reconciled into the transcript.',
      };
    }

    return {
      label: 'Idle',
      tone: 'ready',
      detail: 'No active chat response is running.',
    };
  })();
  const bridgeTimingSummary = useMemo(() => {
    if (!bridgeTiming?.connectStartedAt) return null;
    const socketOpenMs = bridgeTiming.socketOpenedAt ? bridgeTiming.socketOpenedAt - bridgeTiming.connectStartedAt : null;
    const challengeMs = bridgeTiming.challengeReceivedAt ? bridgeTiming.challengeReceivedAt - bridgeTiming.connectStartedAt : null;
    const connectAckMs = bridgeTiming.connectedAt ? bridgeTiming.connectedAt - bridgeTiming.connectStartedAt : null;
    const challengeToConnectMs = bridgeTiming.challengeReceivedAt && bridgeTiming.connectedAt
      ? bridgeTiming.connectedAt - bridgeTiming.challengeReceivedAt
      : null;

    return {
      socketOpenMs,
      challengeMs,
      connectAckMs,
      challengeToConnectMs,
      closeCode: bridgeTiming.lastCloseCode,
      closeReason: bridgeTiming.lastCloseReason,
    };
  }, [bridgeTiming]);
  const displayModelLabel = topRailModelLabel.toLowerCase() === 'runtime controlled' ? lastRealModelRef.current : topRailModelLabel;
  const modelTriggerLabel = (() => {
    const source = (optimisticModelLabel ?? displayModelLabel).trim();
    const lower = source.toLowerCase();
    if (lower.includes('gpt-5.5')) return 'gpt-5.5';
    if (lower.includes('gpt-5.4')) return 'gpt-5.4';
    if (lower.includes('minimax')) return 'minimax-2.7';
    if (lower.includes('codex') || lower.includes('5.3')) return 'codex-5.3';
    return source;
  })();
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
      await live.sendPrompt(runtimeModelCommand(modelAlias));
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

    const draftComposerValue = composerValue;
    const draftAttachedFiles = attachedFiles;
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
        setComposerValue(draftComposerValue);
        setAttachedFiles(draftAttachedFiles);
        setComposerError(cause instanceof Error ? cause.message : 'Mission Control could not hand the brief to Sudo.');
      }
      return;
    }

    if (!live?.sendPrompt) return;

    try {
      setComposerError(null);
      setComposerValue('');
      setAttachedFiles([]);
      await live.sendPrompt(finalPrompt);
    } catch (cause) {
      setComposerValue(draftComposerValue);
      setAttachedFiles(draftAttachedFiles);
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
  }, [isNearTranscriptBottom, liveEntries.length, liveEvents.length, liveSendState]);

  const transcriptItems = useMemo<ChatTranscriptItem[]>(() => {
    return shapeTranscriptEntriesForRender(liveEntries, {
      burstWindowMs: TOOL_BURST_WINDOW_MS,
    });
  }, [liveEntries]);

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
        <div
          ref={topControlMenuRef}
          className="mc-chat-control-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            minWidth: 0,
            overflow: 'visible',
          }}
        >
          <div className="mc-chat-primary-controls" style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: '1 1 auto' }}>
            <div style={{ position: 'relative', minWidth: 0, flex: '0 1 128px' }}>
              <button
                type="button"
                onClick={() => setTopControlMenu((current) => (current === 'agent' ? null : 'agent'))}
                style={{
                  border: '1px solid rgba(200, 195, 188, 0.34)',
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.7)',
                  padding: '7px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  width: '100%',
                  minHeight: 32,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                title={`Seat: ${selectedSeatLabel}`}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                    <Bot size={13} strokeWidth={1.9} />
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{selectedSeatLabel}</span>
                </span>
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
                  {activation ? (
                    <>
                      <div style={{ borderTop: '1px solid rgba(200, 195, 188, 0.32)', margin: '4px 6px' }} />
                      <button
                        type="button"
                        onClick={() => void handleApplySeatDefaults()}
                        disabled={runtimeDefaultsBusy}
                        title={`Sync runtime model and effort to ${activation.label}`}
                        style={{
                          border: '1px solid rgba(121, 166, 148, 0.34)',
                          borderRadius: 12,
                          background: 'rgba(212, 231, 221, 0.42)',
                          color: 'var(--text-body)',
                          padding: '8px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: runtimeDefaultsBusy ? 'progress' : 'pointer',
                          opacity: runtimeDefaultsBusy ? 0.78 : 1,
                          textAlign: 'left',
                        }}
                      >
                        {runtimeDefaultsBusy ? 'Applying defaults…' : 'Sync seat defaults'}
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div style={{ position: 'relative', minWidth: 0, flex: '0 1 138px' }}>
              <button
                type="button"
                onClick={() => setTopControlMenu((current) => (current === 'model' ? null : 'model'))}
                disabled={modelSwitchBusy}
                style={{ border: '1px solid rgba(200, 195, 188, 0.34)', borderRadius: 14, background: 'rgba(255, 255, 255, 0.7)', padding: '7px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%', minHeight: 32, textAlign: 'left', cursor: modelSwitchBusy ? 'progress' : 'pointer', opacity: modelSwitchBusy ? 0.82 : 1 }}
                title={`Model: ${optimisticModelLabel ?? displayModelLabel}`}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                    <Cpu size={13} strokeWidth={1.9} />
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{modelTriggerLabel}</span>
                </span>
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

            <div style={{ position: 'relative', minWidth: 0, flex: '0 1 112px' }}>
              <button
                type="button"
                onClick={() => effortInteractive && setTopControlMenu((current) => (current === 'effort' ? null : 'effort'))}
                disabled={!effortInteractive || effortSwitchBusy}
                style={{ border: '1px solid rgba(200, 195, 188, 0.34)', borderRadius: 14, background: effortInteractive ? 'rgba(255, 255, 255, 0.7)' : 'rgba(247, 242, 236, 0.82)', padding: '7px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%', minHeight: 32, textAlign: 'left', cursor: effortInteractive && !effortSwitchBusy ? 'pointer' : 'not-allowed', opacity: effortInteractive ? 1 : 0.72 }}
                title={`Effort: ${effortTriggerLabel}`}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                    <Brain size={13} strokeWidth={1.9} />
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{effortTriggerLabel}</span>
                </span>
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
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-body)' }}>{label}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{`/think:${label}`}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mc-chat-status-controls" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minWidth: 0 }}>
            <span style={runtimeStatusStyle(runtimeStatus.tone)} title={friendlyRuntimeDetail(runtimeStatus.detail) ?? runtimeStatus.detail}>
              {runtimeStatus.label}
            </span>
            <span style={runtimeStatusStyle(runStatus.tone)} title={runStatus.detail}>
              {runStatus.label}
            </span>
            <button
              type="button"
              onClick={() => void handleStop()}
              disabled={!live?.canAbort}
              title={live?.canAbort ? 'Stop the active Mission Control chat response.' : 'Stop becomes available while a chat response is active.'}
              style={{
                ...actionButtonStyle(Boolean(live?.canAbort)),
                border: '1px solid rgba(200, 195, 188, 0.46)',
                background: 'rgba(255, 255, 255, 0.78)',
                color: live?.canAbort ? 'var(--text-body)' : 'var(--text-muted)',
                padding: '7px 10px',
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              Stop
            </button>

            <div
              className="mc-chat-context-chip"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 9px',
                border: '1px solid rgba(200, 195, 188, 0.34)',
                borderRadius: 999,
                background: 'rgba(255, 255, 255, 0.7)',
                flexShrink: 0,
              }}
              title={topRailContextPercent !== null ? `Context used ${topRailContextPercent}%` : 'Context usage unavailable'}
            >
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Context used</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: contextStyles.text }}>{topRailContextPercent !== null ? `${topRailContextPercent}%` : 'n/a'}</span>
              <div style={{ width: 40, height: 6, borderRadius: 999, background: 'rgba(221, 215, 209, 0.62)', overflow: 'hidden' }}>
                <div style={{ width: `${topRailContextPercent ?? 18}%`, minWidth: topRailContextPercent === null ? 22 : undefined, height: '100%', borderRadius: 999, background: contextStyles.bar }} />
              </div>
            </div>

            <div ref={statusDropdownRef} style={{ position: 'relative', display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setStatusDropdownOpen((value) => !value)}
                aria-label={effectiveBridgeError ? 'Connection details need attention' : 'Connection details'}
                title="Connection details"
                style={{
                  ...iconCircleButtonStyle(true),
                  border: effectiveBridgeError ? '1px solid rgba(181, 88, 74, 0.34)' : iconCircleButtonStyle(true).border,
                  background: effectiveBridgeError ? 'rgba(244, 224, 220, 0.88)' : iconCircleButtonStyle(true).background,
                  color: effectiveBridgeError ? '#7c2e24' : iconCircleButtonStyle(true).color,
                }}
              >
                {effectiveBridgeError ? '!' : 'ⓘ'}
              </button>
              {bridge ? (
                <button
                  type="button"
                  onClick={() => void bridge.refresh()}
                  disabled={bridgeRefreshing}
                  title="Refresh chat state."
                  style={{ ...iconCircleButtonStyle(true), cursor: bridgeRefreshing ? 'progress' : 'pointer' }}
                >
                  {bridgeRefreshing ? '…' : '↻'}
                </button>
              ) : null}
              {statusDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
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
                      Chat connection needs attention: {friendlyRuntimeDetail(effectiveBridgeError) ?? effectiveBridgeError}
                    </div>
                  ) : wsDetail ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {friendlyRuntimeDetail(wsDetail) ?? wsDetail}
                    </div>
                  ) : sessionDetail ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {friendlyRuntimeDetail(sessionDetail) ?? sessionDetail}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      Chat connection is opening and waiting for confirmation.
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={pillStyle()}>Live: {wsState}</span>
                    <span style={pillStyle()}>Session: {sessionState}</span>
                    <span style={pillStyle()}>History: {historySource}</span>
                  </div>
                  {historyNote ? (
                    <div style={{ fontSize: 11, color: 'var(--text-ghost)', lineHeight: 1.5 }}>
                      {friendlyRuntimeDetail(historyNote) ?? historyNote}
                    </div>
                  ) : null}
                  {(sessionId || historySessionId) && (
                    <div style={{ fontSize: 11, fontFamily: monoFont, color: 'var(--text-ghost)' }}>
                      Session: {sessionId ?? historySessionId}
                    </div>
                  )}
                  {historyThinkingLevel ? (
                    <div style={{ fontSize: 11, color: 'var(--text-ghost)' }}>
                      Thinking level: {historyThinkingLevel}
                    </div>
                  ) : null}
                  {sessionLastEvent && (
                    <div style={{ fontSize: 11, color: 'var(--text-ghost)' }}>
                      Last event: {sessionLastEvent}
                    </div>
                  )}
                  {bridgeTimingSummary ? (
                    <div style={{ display: 'grid', gap: 4, paddingTop: 4, borderTop: '1px solid rgba(200, 195, 188, 0.28)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Connection timing
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Socket open: {bridgeTimingSummary.socketOpenMs != null ? `${bridgeTimingSummary.socketOpenMs}ms` : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Challenge: {bridgeTimingSummary.challengeMs != null ? `${bridgeTimingSummary.challengeMs}ms` : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Connect ack: {bridgeTimingSummary.connectAckMs != null ? `${bridgeTimingSummary.connectAckMs}ms` : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Challenge → connect: {bridgeTimingSummary.challengeToConnectMs != null ? `${bridgeTimingSummary.challengeToConnectMs}ms` : '—'}
                      </div>
                      {bridgeTimingSummary.closeCode ? (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Last close: {bridgeTimingSummary.closeCode}{bridgeTimingSummary.closeReason ? `, ${bridgeTimingSummary.closeReason}` : ''}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <ChatSessionRail
              compact
              sessionsRef={sessionsRef}
              sessionsOpen={sessionsOpen}
              setSessionsOpen={setSessionsOpen}
              recentSessions={model.recentSessions}
              liveTargetSession={liveTargetSession}
              onSwitchSession={(sessionKey) => {
                if (sessionKey !== liveTargetSession) {
                  void bridge?.switchSession(sessionKey);
                }
              }}
            />
          </div>
        </div>
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
        <LiveTranscriptSection
          liveTargetLabel={liveTargetLabel}
          bridgeEventsOpen={bridgeEventsOpen}
          setBridgeEventsOpen={setBridgeEventsOpen}
          bridgeEventsRef={bridgeEventsRef}
          liveEvents={liveEvents}
          transcriptItems={transcriptItems}
          assistantSeatLabel={assistantSeatLabel}
          showJumpToLatest={showJumpToLatest}
          onJumpToLatest={() => {
            transcriptBottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
            setShowJumpToLatest(false);
          }}
          transcriptBottomRef={transcriptBottomRef}
        />
      </section>

      <ChatComposer
        fileInputRef={fileInputRef}
        onSubmit={handleComposerSubmit}
        onDragOver={handleComposerDragOver}
        onDragLeave={handleComposerDragLeave}
        onDrop={handleComposerDrop}
        onFileInputChange={(event) => {
          if (event.target.files?.length) {
            void uploadSelectedFiles(event.target.files);
            event.target.value = '';
          }
        }}
        attachedFiles={attachedFiles}
        setAttachedFiles={setAttachedFiles}
        isDraggingFiles={isDraggingFiles}
        composerValue={composerValue}
        setComposerValue={setComposerValue}
        onComposerKeyDown={handleComposerKeyDown}
        composerDisabled={!liveTargetSession || (sessionState !== 'connected' && !recoveringRuntime) || (!liveCanSend && !httpInteractiveRuntime && !recoveringRuntime) || liveSendState === 'sending' || liveSendState === 'streaming'}
        composerPlaceholder={
          sessionState === 'connected'
            ? liveTargetSession
              ? `Message ${userFacingTargetLabel}.`
              : 'Select an active chat before sending.'
            : 'Chat unlocks once the connection is ready.'
        }
        uploadBusy={uploadBusy}
        speechButtonEnabled={speechButtonEnabled}
        speechSupported={speechSupported}
        speechStatus={speechStatus}
        onToggleRecording={() => {
          setSpeechMessage(null);
          void toggleRecording();
        }}
        onNewSession={() => void handleNewSession()}
        canCreateNewSession={(liveCanSend || recoveringRuntime) && liveSendState !== 'sending' && liveSendState !== 'streaming'}
        canSubmit={((activation?.seatSlug === 'dev-team') || liveCanSend || recoveringRuntime) && (composerValue.trim().length > 0 || attachedFiles.length > 0)}
        sendButtonLabel={activation?.seatSlug === 'dev-team' ? 'Let Sudo handle this' : liveSendState === 'sending' ? 'Sending' : liveSendState === 'streaming' ? 'Waiting' : 'Send'}
        sendButtonTitle={activation?.seatSlug === 'dev-team' ? 'Let Sudo handle this' : liveSendState === 'sending' ? 'Sending...' : liveSendState === 'streaming' ? 'Waiting...' : 'Send'}
        speechSupportReason={speechSupportReason}
        speechError={speechError}
        speechMessage={speechMessage}
        composerError={composerError}
        liveSendError={liveSendError}
        effectiveBridgeError={effectiveBridgeError}
        liveTargetSession={liveTargetSession}
        sessionState={sessionState}
      />
    </div>
  );
}
