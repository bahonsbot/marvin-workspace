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

export function isAutonomousTaskModelAlias(value: unknown): value is AutonomousTaskModelAlias {
  return typeof value === 'string'
    && (AUTONOMOUS_TASK_MODEL_ALIASES as readonly string[]).includes(value);
}

export function normalizeAutonomousTaskModel(value: unknown): AutonomousTaskModelAlias | undefined {
  if (isAutonomousTaskModelAlias(value)) return value;
  return undefined;
}

export function formatAutonomousTaskModel(value: string | null | undefined): string {
  if (!value) return 'Agent default';
  return value;
}
