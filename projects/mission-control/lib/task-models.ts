export const AUTONOMOUS_TASK_MODEL_ALIASES = [
  'minimax2.7',
  'codex',
  'codex5.4',
  'codex5.4mini',
  'gemini',
] as const;

export type AutonomousTaskModelAlias = (typeof AUTONOMOUS_TASK_MODEL_ALIASES)[number];

export const AUTONOMOUS_TASK_MODEL_DEFAULT = 'agent-default' as const;

const AUTONOMOUS_AGENT_DEFAULT_MODEL: Record<string, { alias: string; runtime: string }> = {
  marvin: { alias: 'codex5.4', runtime: 'gpt-5.4' },
  builder: { alias: 'codex', runtime: 'gpt-5.3-codex' },
  reviewer: { alias: 'minimax2.7', runtime: 'MiniMax-M2.7' },
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
  return agentDefault ? `Agent default (${agentDefault.alias} → ${agentDefault.runtime})` : 'Agent default';
}

export function formatAutonomousTaskModel(value: string | null | undefined, agentTarget?: string | null): string {
  if (!value) return agentDefaultModelLabel(agentTarget);
  return value;
}
