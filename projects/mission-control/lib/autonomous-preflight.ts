export function isResearchTaskLike(input: {
  title?: string | null;
  description?: string | null;
  agentTarget?: string | null;
}): boolean {
  const combined = [input.title, input.description, input.agentTarget]
    .map((value) => String(value || '').toLowerCase())
    .join(' | ');
  return /\bresearch\b|\binvestigate\b|\banaly[sz]e\b|\bmarket intel\b|\bdeep research\b|\blive sources\b|\bcompetitor\b|\bweb\b/.test(combined);
}

export function resolveWebResearchProvider(): string | null {
  const enabled =
    process.env.MISSION_CONTROL_WEB_RESEARCH_ENABLED === '1'
    || process.env.NEXT_PUBLIC_MISSION_CONTROL_WEB_RESEARCH_ENABLED === '1';
  if (!enabled) return null;
  const explicit = String(
    process.env.MISSION_CONTROL_SEARCH_PROVIDER
      || process.env.NEXT_PUBLIC_MISSION_CONTROL_SEARCH_PROVIDER
      || '',
  ).trim().toLowerCase();
  if (!explicit) return 'duckduckgo-html';
  if (explicit === 'ddg-html') return 'duckduckgo-html';
  if (explicit === 'searx') return 'searxng';
  return explicit;
}

export function webResearchCapabilityConfigured(): boolean {
  return Boolean(resolveWebResearchProvider());
}

export function autonomousTaskPreflight(input: {
  title?: string | null;
  description?: string | null;
  agentTarget?: string | null;
  webResearchEnabled?: boolean | null;
}): {
  ok: boolean;
  requiresWebResearch: boolean;
  warning: string | null;
} {
  const requiresWebResearch = isResearchTaskLike(input);
  const webResearchEnabled = typeof input.webResearchEnabled === 'boolean' ? input.webResearchEnabled : webResearchCapabilityConfigured();
  if (!requiresWebResearch) {
    return { ok: true, requiresWebResearch, warning: null };
  }

  if (webResearchEnabled) {
    return { ok: true, requiresWebResearch, warning: null };
  }

  return {
    ok: false,
    requiresWebResearch,
    warning: 'This task requests web research, but the current runtime has no web-search capability configured. Enable web-backed research for Mission Control or revise the task to use workspace-only sources before executing.',
  };
}
