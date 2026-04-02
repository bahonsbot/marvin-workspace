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

export function webResearchCapabilityConfigured(): boolean {
  return process.env.MISSION_CONTROL_WEB_RESEARCH_ENABLED === '1';
}

export function autonomousTaskPreflight(input: {
  title?: string | null;
  description?: string | null;
  agentTarget?: string | null;
}): {
  ok: boolean;
  requiresWebResearch: boolean;
  warning: string | null;
} {
  const requiresWebResearch = isResearchTaskLike(input);
  if (!requiresWebResearch) {
    return { ok: true, requiresWebResearch, warning: null };
  }

  if (webResearchCapabilityConfigured()) {
    return { ok: true, requiresWebResearch, warning: null };
  }

  return {
    ok: false,
    requiresWebResearch,
    warning: 'This task requests web research, but the current runtime has no web-search capability configured. Enable web-backed research for Mission Control or revise the task to use workspace-only sources before executing.',
  };
}
