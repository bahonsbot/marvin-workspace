export type AgentSectionId = 'control' | 'teams' | 'specialists';

export type AgentSurfaceKind = 'control' | 'team' | 'specialist';

export type AgentHealthStatus = 'active' | 'ready' | 'quiet' | 'staged' | 'attention';

export type AgentActionAvailability = 'live' | 'staged' | 'unavailable';

export type AgentReadinessState = 'ready' | 'partial' | 'marvin-routed' | 'internal-only' | 'staged';

export type AgentChatActivationRouting = 'direct' | 'marvin-routed';

export type AgentSeatRuntimeMode = 'direct-control' | 'lead-route' | 'seat-mode';

export type AgentSeatModelAlias = 'codex5.4' | 'codex' | 'codex5.4mini' | 'minimax2.7';

export type SessionMatchMode = 'exact' | 'marker' | 'role' | 'keyword' | 'reviewer-like';

export type SessionMatchHint = {
  mode: SessionMatchMode;
  value?: string;
};

export type AgentMemberDefinition = {
  id: string;
  label: string;
  role: string;
  matchers?: SessionMatchHint[];
};

export type AgentDefinition = {
  id: string;
  seatSlug: string;
  sectionId: AgentSectionId;
  kind: AgentSurfaceKind;
  label: string;
  role: string;
  summary: string;
  expectedOutputs?: string[];
  workspaceReadiness: AgentReadinessState;
  chatReadiness: AgentReadinessState;
  actionMode: 'control' | 'marvin-routed' | 'internal' | 'staged';
  activation?: {
    routing: AgentChatActivationRouting;
    runtimeMode: AgentSeatRuntimeMode;
    targetSessionKey: string;
    defaultModel: AgentSeatModelAlias;
    defaultThinking: 'low' | 'medium' | 'high' | 'xhigh';
    supervisorLabel?: string;
    childSeatLabels?: string[];
    starterPrompt: string;
    starterLabel: string;
    nextStep: string;
  };
  workspace?: {
    slug: string;
    path: string;
    memoryFile: string;
    starterFiles: string[];
    artifactDir: string;
    ignoredArtifactFiles?: string[];
  };
  members?: AgentMemberDefinition[];
  matchers?: SessionMatchHint[];
};

export type AgentAction = {
  id: string;
  label: string;
  availability: AgentActionAvailability;
  href?: string;
  external?: boolean;
  note?: string;
};

export type AgentEvidence = {
  id: string;
  label: string;
  detail: string;
};

export type AgentAlertSeverity = 'attention' | 'warning';

export type AgentIssueState = 'active' | 'acknowledged';

export type AgentAlert = {
  id: string;
  unitId: string;
  unitLabel: string;
  title: string;
  detail: string;
  severity: AgentAlertSeverity;
  state: AgentIssueState;
  acknowledgedAt?: string | null;
  actions: AgentAction[];
};

export type AgentMemberState = {
  id: string;
  label: string;
  role: string;
  status: AgentHealthStatus;
  detail: string;
};

export type AgentSessionSignal = {
  id: string;
  label: string;
  state: 'running' | 'idle' | 'unknown';
  kind?: string;
  model?: string | null;
  lastActiveAt?: string | null;
  ageMs?: number | null;
  matchReason?: string;
};

export type AgentUnitPayload = {
  id: string;
  kind: AgentSurfaceKind;
  label: string;
  role: string;
  summary: string;
  workspaceReadiness: AgentReadinessState;
  chatReadiness: AgentReadinessState;
  health: {
    status: AgentHealthStatus;
    label: string;
    evidence: AgentEvidence[];
  };
  alerts: AgentAlert[];
  note: string;
  expectedOutputs: string[];
  actions: AgentAction[];
  members: AgentMemberState[];
  sessions: AgentSessionSignal[];
  oversight?: {
    activeIssues: number;
    acknowledgedIssues: number;
    seatsNeedingAttention: number;
    activeUnits: number;
    quietSessions: number;
  };
};

export type AgentSectionPayload = {
  id: AgentSectionId;
  title: string;
  description: string;
  items: AgentUnitPayload[];
};

export type QuietSessionPayload = {
  id: string;
  label: string;
  state: 'running' | 'idle' | 'unknown';
  kind?: string;
  model?: string | null;
  lastActiveAt?: string | null;
  ageMs?: number | null;
};

export type AgentsPageData = {
  summary: {
    controlLive: number;
    activeUnits: number;
    stagedSeats: number;
    quietSessions: number;
    activeIssues: number;
    acknowledgedIssues: number;
    seatsNeedingAttention: number;
  };
  alerts: AgentAlert[];
  sections: AgentSectionPayload[];
  quietSessions: QuietSessionPayload[];
  refreshedAt: string;
};

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    id: 'control.marvin',
    seatSlug: 'marvin',
    sectionId: 'control',
    kind: 'control',
    label: 'Marvin',
    role: 'Control layer',
    summary: 'Primary control seat for continuity, orchestration, and final judgment across the working runtime.',
    workspaceReadiness: 'ready',
    chatReadiness: 'ready',
    actionMode: 'control',
    activation: {
      routing: 'direct',
      runtimeMode: 'direct-control',
      targetSessionKey: 'agent:main:main',
      defaultModel: 'codex5.4',
      defaultThinking: 'medium',
      starterPrompt:
        'Stay in Marvin control mode. Help me move this forward with the clearest next step, and route or delegate only when that is actually warranted.',
      starterLabel: 'Marvin control starter',
      nextStep: 'State the outcome you want, plus any repo/path or operating constraint that matters.',
    },
    matchers: [{ mode: 'exact', value: 'agent:main:main' }],
  },
  {
    id: 'team.dev',
    seatSlug: 'dev-team',
    sectionId: 'teams',
    kind: 'team',
    label: 'Sudo',
    role: 'Dev Team lead',
    summary: 'Pragmatic technical lead for roadmap, architecture alignment, delegation, and release readiness across design, frontend, backend, and QA.',
    expectedOutputs: ['technical roadmap', 'dependency map', 'QA handoff', 'release-status update'],
    workspaceReadiness: 'ready',
    chatReadiness: 'internal-only',
    actionMode: 'internal',
    matchers: [
      { mode: 'marker', value: 'sudo' },
      { mode: 'marker', value: 'dev-team' },
      { mode: 'marker', value: 'dev-team-lead' },
    ],
    activation: {
      routing: 'marvin-routed',
      runtimeMode: 'lead-route',
      targetSessionKey: 'agent:main:main',
      defaultModel: 'codex5.4',
      defaultThinking: 'medium',
      supervisorLabel: 'Marvin',
      childSeatLabels: ['Frontend Developer', 'Backend Developer', 'QA Engineer'],
      starterPrompt:
        'Activate Sudo mode. Act as the dev-team lead inside Mission Control. Break the request into the clearest technical path, decide whether it needs frontend, backend, or QA lanes, and stay honest that Sudo itself still runs through the main runtime. When lane work is warranted, use real delegated FE/BE/QA child runs instead of roleplaying them. Start by asking for the repo path, product goal, constraints, Definition of Done, and verification bar.',
      starterLabel: 'Sudo lead-route starter',
      nextStep: 'Describe the product requirement, constraints, and delivery bar. Sudo should lead the plan from here, delegate to FE/BE/QA child runs when needed, and keep Marvin in oversight.',
    },
    workspace: {
      slug: 'dev-team-lead',
      path: 'agent-workspaces/dev-team-lead',
      memoryFile: 'agent-workspaces/dev-team-lead/MEMORY.md',
      starterFiles: ['SOUL.md', 'MEMORY.md', 'WORKSPACE.md', 'memory/README.md'],
      artifactDir: 'artifacts',
      ignoredArtifactFiles: ['README.md', '.gitkeep', '.keep'],
    },
    members: [
      {
        id: 'seat.designer',
        label: 'Designer',
        role: 'Product / UI Designer',
        matchers: [{ mode: 'marker', value: 'designer' }, { mode: 'role', value: 'product design' }, { mode: 'keyword', value: 'design' }],
      },
      {
        id: 'seat.frontend',
        label: 'Frontend Developer',
        role: 'Client implementation',
        matchers: [
          { mode: 'marker', value: 'frontend' },
          { mode: 'marker', value: 'front-end' },
          { mode: 'role', value: 'frontend developer' },
          { mode: 'role', value: 'client implementation' },
          { mode: 'keyword', value: 'frontend' },
        ],
      },
      {
        id: 'seat.backend',
        label: 'Backend Developer',
        role: 'Services and APIs',
        matchers: [
          { mode: 'marker', value: 'backend' },
          { mode: 'marker', value: 'back-end' },
          { mode: 'role', value: 'backend developer' },
          { mode: 'role', value: 'service layer' },
          { mode: 'keyword', value: 'backend' },
        ],
      },
      {
        id: 'seat.qa',
        label: 'QA Engineer',
        role: 'Release confidence',
        matchers: [
          { mode: 'marker', value: 'qa' },
          { mode: 'marker', value: 'quality-assurance' },
          { mode: 'role', value: 'qa engineer' },
          { mode: 'role', value: 'release confidence' },
          { mode: 'keyword', value: 'tester' },
          { mode: 'reviewer-like' },
        ],
      },
    ],
  },
  {
    id: 'team.content_seo',
    seatSlug: 'content-seo-team',
    sectionId: 'teams',
    kind: 'team',
    label: 'Vantage',
    role: 'Content / SEO Team lead',
    summary: 'Sharp editorial strategist who turns search signals and market context into topical-authority plans, briefs, and narrative direction.',
    expectedOutputs: ['editorial playbook', 'SEO brief', 'topic-priority map', 'performance summary'],
    workspaceReadiness: 'staged',
    chatReadiness: 'marvin-routed',
    actionMode: 'marvin-routed',
    matchers: [
      { mode: 'marker', value: 'vantage' },
      { mode: 'marker', value: 'content-seo-team' },
      { mode: 'marker', value: 'content-seo-team-lead' },
    ],
    activation: {
      routing: 'marvin-routed',
      runtimeMode: 'lead-route',
      targetSessionKey: 'agent:main:main',
      defaultModel: 'codex5.4',
      defaultThinking: 'medium',
      supervisorLabel: 'Marvin',
      childSeatLabels: ['Signals Scout', 'Keyword / Gap Analyst', 'Editorial Strategist', 'Writer / Draft Publisher'],
      starterPrompt:
        'Activate Vantage mode. Help me turn this into a topical-authority and editorial strategy play, without pretending there is a separate direct runtime. Start by asking for audience, brand voice, objective, source material, performance context, and deadline.',
      starterLabel: 'Vantage activation starter',
      nextStep: 'Provide the content goal, source material, and strategic context. Vantage should lead the strategy from here, with Marvin staying in oversight.',
    },
    workspace: {
      slug: 'content-seo-team-lead',
      path: 'agent-workspaces/content-seo-team-lead',
      memoryFile: 'agent-workspaces/content-seo-team-lead/MEMORY.md',
      starterFiles: ['SOUL.md', 'MEMORY.md', 'WORKSPACE.md', 'memory/README.md'],
      artifactDir: 'artifacts',
      ignoredArtifactFiles: ['README.md', '.gitkeep', '.keep'],
    },
    members: [
      {
        id: 'seat.signals',
        label: 'Signals Scout',
        role: 'Trend discovery',
        matchers: [
          { mode: 'marker', value: 'signals-scout' },
          { mode: 'marker', value: 'signal-scout' },
          { mode: 'role', value: 'trend discovery' },
          { mode: 'keyword', value: 'signals' },
          { mode: 'keyword', value: 'trend' },
        ],
      },
      {
        id: 'seat.keyword-gap',
        label: 'Keyword / Gap Analyst',
        role: 'Search opportunity mapping',
        matchers: [
          { mode: 'marker', value: 'keyword-gap' },
          { mode: 'marker', value: 'gap-analyst' },
          { mode: 'role', value: 'search opportunity mapping' },
          { mode: 'keyword', value: 'keyword' },
          { mode: 'keyword', value: 'gap' },
        ],
      },
      {
        id: 'seat.editorial-strategist',
        label: 'Editorial Strategist',
        role: 'Angle and priority',
        matchers: [
          { mode: 'marker', value: 'editorial-strategist' },
          { mode: 'role', value: 'editorial strategist' },
          { mode: 'role', value: 'angle and priority' },
          { mode: 'keyword', value: 'editorial' },
        ],
      },
      {
        id: 'seat.writer',
        label: 'Writer / Draft Publisher',
        role: 'Draft execution',
        matchers: [
          { mode: 'marker', value: 'writer' },
          { mode: 'marker', value: 'draft-publisher' },
          { mode: 'marker', value: 'copywriter' },
          { mode: 'role', value: 'draft execution' },
          { mode: 'keyword', value: 'draft' },
        ],
      },
      {
        id: 'seat.gsc',
        label: 'GSC Performance Analyst',
        role: 'Feedback loop',
        matchers: [
          { mode: 'marker', value: 'gsc' },
          { mode: 'marker', value: 'search-console' },
          { mode: 'role', value: 'feedback loop' },
          { mode: 'keyword', value: 'gsc' },
          { mode: 'keyword', value: 'search console' },
        ],
      },
    ],
  },
  {
    id: 'specialist.sportsbet',
    seatSlug: 'sportsbet-advisor',
    sectionId: 'specialists',
    kind: 'specialist',
    label: 'Johan',
    role: 'Sportsbet Advisor',
    summary: 'Analytically detached sports probability analyst focused on data-backed picks, market skepticism, and disciplined thesis-evidence-risk framing.',
    expectedOutputs: ['pick thesis', 'matchup brief', 'probability assessment', 'betting research artifact'],
    workspaceReadiness: 'staged',
    chatReadiness: 'marvin-routed',
    actionMode: 'marvin-routed',
    activation: {
      routing: 'marvin-routed',
      runtimeMode: 'seat-mode',
      targetSessionKey: 'agent:main:main',
      defaultModel: 'codex5.4',
      defaultThinking: 'medium',
      supervisorLabel: 'Marvin',
      starterPrompt:
        'Activate Johan mode. Help me analyze this sports spot with a thesis-evidence-risk structure and no hype. Start by asking for the sport, event, market, current line or odds, sportsbook, and any constraints. Focus on probability, data quality, and downside risk.',
      starterLabel: 'Johan activation starter',
      nextStep: 'Share the matchup or market with current odds. Marvin will keep the chat in Johan mode from main chat.',
    },
    workspace: {
      slug: 'sportsbet-advisor',
      path: 'agent-workspaces/sportsbet-advisor',
      memoryFile: 'agent-workspaces/sportsbet-advisor/MEMORY.md',
      starterFiles: ['SOUL.md', 'MEMORY.md', 'WORKSPACE.md', 'memory/README.md'],
      artifactDir: 'artifacts',
      ignoredArtifactFiles: ['README.md', '.gitkeep', '.keep'],
    },
    matchers: [
      { mode: 'marker', value: 'sportsbet-advisor' },
      { mode: 'marker', value: 'johan' },
      { mode: 'role', value: 'sportsbet advisor' },
      { mode: 'keyword', value: 'sportsbet' },
    ],
  },
  {
    id: 'specialist.trading',
    seatSlug: 'trading-advisor',
    sectionId: 'specialists',
    kind: 'specialist',
    label: 'Milou',
    role: 'Trading Advisor',
    summary: 'Disciplined technical-analysis and risk-first trading mentor focused on conditional planning, structure, and execution discipline.',
    expectedOutputs: ['risk framework', 'technical thesis', 'market summary', 'trade-planning note'],
    workspaceReadiness: 'staged',
    chatReadiness: 'marvin-routed',
    actionMode: 'marvin-routed',
    activation: {
      routing: 'marvin-routed',
      runtimeMode: 'seat-mode',
      targetSessionKey: 'agent:main:main',
      defaultModel: 'codex5.4',
      defaultThinking: 'medium',
      supervisorLabel: 'Marvin',
      starterPrompt:
        'Activate Milou mode. Help me assess this setup with conditional, risk-first technical analysis and no fake certainty. Start by asking for the ticker or market, timeframe, chart context, risk tolerance, and any open-position context. Establish stop, size, and risk-to-reward before discussing upside.',
      starterLabel: 'Milou activation starter',
      nextStep: 'Share the ticker, timeframe, and setup context. Marvin will keep the chat in Milou mode from main chat.',
    },
    workspace: {
      slug: 'trading-advisor',
      path: 'agent-workspaces/trading-advisor',
      memoryFile: 'agent-workspaces/trading-advisor/MEMORY.md',
      starterFiles: ['SOUL.md', 'MEMORY.md', 'WORKSPACE.md', 'memory/README.md'],
      artifactDir: 'artifacts',
      ignoredArtifactFiles: ['README.md', '.gitkeep', '.keep'],
    },
    matchers: [
      { mode: 'marker', value: 'trading-advisor' },
      { mode: 'marker', value: 'milou' },
      { mode: 'role', value: 'trading advisor' },
      { mode: 'keyword', value: 'trading' },
    ],
  },
  {
    id: 'specialist.language',
    seatSlug: 'language-tutor',
    sectionId: 'specialists',
    kind: 'specialist',
    label: 'Japin',
    role: 'Language Tutor',
    summary: 'Encouraging, high-agency language mentor blending structured learning, real-world usage, and cultural context to drive fast retention.',
    expectedOutputs: ['lesson note', 'exercise', 'homework checklist', 'session artifact'],
    workspaceReadiness: 'ready',
    chatReadiness: 'ready',
    actionMode: 'control',
    activation: {
      routing: 'direct',
      runtimeMode: 'seat-mode',
      targetSessionKey: 'agent:language-tutor:main',
      defaultModel: 'codex5.4',
      defaultThinking: 'medium',
      starterPrompt:
        'Activate Japin mode. Before planning the lesson, review `memory/continuity.md`, `memory/learner-profile.md`, and `.learnings/corrections.md` in the language-tutor workspace, then continue with what is actually logged there. Start by confirming target language, current level, learning goal, preferred exercise format, and whether grammar, conversation, vocabulary, or script practice should come first.',
      starterLabel: 'Japin activation starter',
      nextStep:
        'State target language, current level, and what to practice next. Japin runs as its own direct specialist seat and should continue from `memory/continuity.md`, updating continuity after each lesson, `memory/learner-profile.md` when the learner baseline changes, recurring patterns in `.learnings/corrections.md`, and a lesson note in `memory/lessons/` for substantial sessions.',
    },
    workspace: {
      slug: 'language-tutor',
      path: 'agent-workspaces/language-tutor',
      memoryFile: 'agent-workspaces/language-tutor/memory/continuity.md',
      starterFiles: ['SOUL.md', 'MEMORY.md', 'WORKSPACE.md', 'memory/README.md'],
      artifactDir: 'artifacts',
      ignoredArtifactFiles: ['README.md', '.gitkeep', '.keep'],
    },
    matchers: [
      { mode: 'exact', value: 'agent:language-tutor:main' },
      { mode: 'marker', value: 'language-tutor' },
      { mode: 'marker', value: 'japin' },
      { mode: 'role', value: 'language tutor' },
      { mode: 'keyword', value: 'tutor' },
      { mode: 'keyword', value: 'language' },
    ],
  },
];

export const AGENT_SECTION_META: Record<AgentSectionId, Pick<AgentSectionPayload, 'title' | 'description'>> = {
  control: {
    title: 'Control',
    description: 'One clear control layer. Keep the main operating seat distinct from the rest of the roster.',
  },
  teams: {
    title: 'Teams',
    description: 'Operating units with grouped seats, mixed readiness, and truthful visibility into what is actually live today.',
  },
  specialists: {
    title: 'Standalone Specialists',
    description: 'Dedicated specialist seats can be staged early, but direct routing only appears once it is real.',
  },
};

export function getAgentDefinitionBySeatSlug(seatSlug: string) {
  return AGENT_DEFINITIONS.find((definition) => definition.seatSlug === seatSlug) ?? null;
}
