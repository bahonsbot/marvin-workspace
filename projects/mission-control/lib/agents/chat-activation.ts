import { getAgentDefinitionBySeatSlug, type AgentChatActivationRouting } from '@/lib/agents/definitions';

export type ChatSeatActivation = {
  seatSlug: string;
  seatId: string;
  label: string;
  role: string;
  summary: string;
  routing: AgentChatActivationRouting;
  routingLabel: string;
  routingNote: string;
  runtimeMode: 'direct-control' | 'lead-route' | 'seat-mode';
  runtimeModeLabel: string;
  defaultModel: 'codex5.4' | 'codex' | 'codex5.4mini' | 'minimax2.7';
  defaultThinking: 'low' | 'medium' | 'high' | 'xhigh';
  runtimeDefaultsNote: string;
  supervisorLabel: string | null;
  childSeatLabels: string[];
  targetSessionKey: string;
  targetSessionLabel: string;
  starterPrompt: string;
  starterLabel: string;
  nextStep: string;
  workspaceHref: string | null;
  memoryHref: string | null;
  expectedOutputs: string[];
};

function runtimeModeLabel(mode: ChatSeatActivation['runtimeMode']) {
  if (mode === 'direct-control') return 'Direct control';
  if (mode === 'lead-route') return 'Lead route';
  return 'Seat mode';
}

function shortSessionLabel(sessionKey: string) {
  if (sessionKey === 'agent:main:main') return 'Marvin main session';
  if (sessionKey === 'agent:language-tutor:main') return 'Japin specialist session';
  if (sessionKey === 'agent:sportsbet-advisor:main') return 'Johan specialist session';
  if (sessionKey === 'agent:trading-advisor:main') return 'Milou specialist session';
  return sessionKey;
}

const CHAT_SEAT_PRIORITY = ['marvin', 'dev-team', 'language-tutor', 'content-seo-team'] as const;

export function resolveChatSeatActivation(seatSlug?: string | null): ChatSeatActivation | null {
  if (!seatSlug) return null;

  const definition = getAgentDefinitionBySeatSlug(seatSlug);
  if (!definition?.activation) return null;

  const runtimeMode = definition.activation.runtimeMode;
  const routing = definition.activation.routing;

  return {
    seatSlug: definition.seatSlug,
    seatId: definition.id,
    label: definition.label,
    role: definition.role,
    summary: definition.summary,
    routing,
    routingLabel: routing === 'direct' ? 'Direct runtime' : 'Marvin-routed',
    routingNote:
      routing === 'direct'
        ? `This seat talks to its own direct runtime session (${shortSessionLabel(definition.activation.targetSessionKey)}).`
        : runtimeMode === 'lead-route'
          ? `${definition.label} leads the operating context here, while Marvin remains the supervising runtime layer. Sudo can now spawn truthful FE, BE, and QA child runs without claiming a separate Sudo runtime exists.`
          : 'This seat mode is real in Chat, but the runtime stays routed through Marvin until direct seat routing exists.',
    runtimeMode,
    runtimeModeLabel: runtimeModeLabel(runtimeMode),
    defaultModel: definition.activation.defaultModel,
    defaultThinking: definition.activation.defaultThinking,
    runtimeDefaultsNote:
      runtimeMode === 'lead-route'
        ? `Default seat runtime: ${definition.activation.defaultModel} with ${definition.activation.defaultThinking} effort. Use this when you want ${definition.label} to lead the work without pretending it has a separate runtime yet; delegated FE/BE/QA child runs are tracked separately below.`
        : `Default seat runtime: ${definition.activation.defaultModel} with ${definition.activation.defaultThinking} effort.`,
    supervisorLabel: definition.activation.supervisorLabel ?? null,
    childSeatLabels: definition.activation.childSeatLabels ?? [],
    targetSessionKey: definition.activation.targetSessionKey,
    targetSessionLabel: shortSessionLabel(definition.activation.targetSessionKey),
    starterPrompt: definition.activation.starterPrompt,
    starterLabel: definition.activation.starterLabel,
    nextStep: definition.activation.nextStep,
    workspaceHref: definition.workspace ? `/general/files?path=${encodeURIComponent(definition.workspace.path)}` : null,
    memoryHref: definition.workspace
      ? `/general/files?path=${encodeURIComponent(definition.workspace.path)}&file=${encodeURIComponent(definition.workspace.memoryFile)}#file-preview`
      : null,
    expectedOutputs: definition.expectedOutputs ?? [],
  };
}

export function listPreferredChatSeatActivations(): ChatSeatActivation[] {
  return CHAT_SEAT_PRIORITY.map((seatSlug) => resolveChatSeatActivation(seatSlug)).filter(
    (activation): activation is ChatSeatActivation => Boolean(activation),
  );
}
