export const AUTONOMOUS_TASK_MODEL_ALIASES = [
  'minimax2.7',
  'qwenplus',
  'codex',
  'codex5.4',
  'codex5.4mini',
  'gemini',
] as const;

export type AutonomousTaskModelAlias = (typeof AUTONOMOUS_TASK_MODEL_ALIASES)[number];

export const AUTONOMOUS_TASK_MODEL_DEFAULT = 'agent-default' as const;

const AUTONOMOUS_AGENT_DEFAULT_MODEL: Record<string, string> = {
  marvin: 'gpt-5.4',
  builder: 'codex',
  reviewer: 'qwenplus',
};

export function isAutonomousTaskModelAlias(value: unknown): value is AutonomousTaskModelAlias {
  return typeof value === 'string'
    && (AUTONOMOUS_TASK_MODEL_ALIASES as readonly string[]).includes(value);
}

export function normalizeAutonomousTaskModel(value: unknown): AutonomousTaskModelAlias | undefined {
  if (isAutonomousTaskModelAlias(value)) return value;
  return undefined;
}

export function agentDefaultModelLabel(agentTarget?: string | null): string {
  const agentDefault = agentTarget ? AUTONOMOUS_AGENT_DEFAULT_MODEL[agentTarget] : undefined;
  return agentDefault ? `Agent default (${agentDefault})` : 'Agent default';
}

export function formatAutonomousTaskModel(value: string | null | undefined, agentTarget?: string | null): string {
  if (!value) return agentDefaultModelLabel(agentTarget);
  return value;
}
