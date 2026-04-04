export type IntegrationStatus = 'partial' | 'stub';

export interface HomeSummary {
  status: IntegrationStatus;
  statusLabel: 'adapter-backed' | 'partial visibility' | 'unavailable';
  sessions: { active: number; totalVisible: number } | null;
  cron: { dueOrRunning: number; jobsVisible: number } | null;
  activity: Array<{ id: string; message: string; at: string }>;
  ambient: {
    weather: {
      location: string;
      temperatureC: number | null;
      condition: string;
    } | null;
    greeting: string;
    focusLine: string;
    quote: string;
  };
  refreshedAt: string;
}

export interface SessionSummary {
  status: IntegrationStatus;
  sessions: Array<{
    id: string;
    label: string;
    rawKey?: string;
    state: 'running' | 'idle' | 'unknown';
    kind?: string;
    model?: string | null;
    lastActiveAt?: string | null;
    ageMs?: number | null;
  }>;
  refreshedAt: string;
}

export interface CronJobsSummary {
  status: IntegrationStatus;
  jobs: Array<{
    id: string;
    name: string;
    schedule: string;
    enabled: boolean;
    type?: 'runner-backed' | 'mixed' | 'model-backed';
    executionPath?: 'host-deterministic' | 'openclaw-cron' | 'mixed';
    sourceLabel?: string | null;
    sourceNote?: string | null;
    model?: string | null;
    timeoutSeconds?: number | null;
    nextRunAt?: string | null;
    lastRunAt?: string | null;
    lastRunStatus?: string | null;
  }>;
  refreshedAt: string;
}

export interface CronRunsSummary {
  status: IntegrationStatus;
  runs: Array<{
    id: string;
    jobId: string;
    state: 'success' | 'failed' | 'running';
    startedAt: string;
    finishedAt?: string | null;
    durationMs?: number | null;
    source?: 'runner-log';
    clusterCount?: number;
    windowStartAt?: string | null;
    windowEndAt?: string | null;
    notes?: string[];
  }>;
  refreshedAt: string;
}

export interface TaskBoardSummary {
  status: IntegrationStatus;
  columns: Array<{
    id: string;
    title: string;
    count: number;
    tasks: Array<{
      id: string;
      text: string;
      column: 'backlog' | 'todo' | 'inprogress' | 'review' | 'done';
      detail: {
        summary: string;
        why?: string;
        proof?: string;
        unlocks?: string;
        completed?: string;
      };
      meta?: {
        priority?: string;
        agentTarget?: string;
        model?: string;
        sourceType?: string;
        runStatus?: string;
        feedback?: string[];
        createdAt?: number;
        artifactPath?: string;
        resultSummary?: string;
      };
    }>;
  }>;
  boardUpdatedAt?: string | null;
  sourceContext?: {
    autonomous: { path: string; mtime: string | null; counts: { backlog: number; inProgress: number; doneToday: number } | null };
    tasksLog: { path: string; mtime: string | null; completedEntries: number | null };
  };
  refreshedAt: string;
}

export interface TaskSyncStatus {
  status: IntegrationStatus;
  state: 'unknown' | 'ok' | 'drift';
  details: string;
  boardUpdatedAt?: string | null;
  sourceContext?: {
    autonomousMtime: string | null;
    tasksLogMtime: string | null;
    countComparison?: {
      board: { backlog: number; todo: number; inProgress: number; review: number; done: number };
      autonomous: { backlog: number; todo: number; inProgress: number; review: number; doneToday: number };
    };
  };
  refreshedAt: string;
}

export type TaskLifecycleEventType = 'task.moved_to_review' | 'task.needs_input';

export interface TaskLifecycleEvent {
  id: string;
  dedupeKey: string;
  type: TaskLifecycleEventType;
  taskId: string;
  title: string;
  at: string;
  fromStatus: 'backlog' | 'todo' | 'in-progress' | 'review' | 'done' | null;
  toStatus: 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
  summary?: string;
  artifactPath?: string;
  needsInputReason?: 'rejected' | 'execution-failed' | 'queue-blocked';
}

export interface ActivityFeed {
  status: IntegrationStatus;
  items: Array<{
    id: string;
    source: string;
    message: string;
    at: string;
    state?: 'success' | 'failed' | 'running';
    startedAt?: string | null;
    finishedAt?: string | null;
    durationMs?: number | null;
    summary?: string | null;
    notes?: string | null;
  }>;
  refreshedAt: string;
}

export interface OrchestratorIntegrationSummary {
  status: IntegrationStatus;
  integrationMode: 'hybrid-reuse';
  chatEmbeddingStatus: 'not-implemented' | 'embedded-reuse';
  honestyNotes: string[];
  runtimeBridge: {
    descriptorVersion: 'v2';
    status: 'ready' | 'degraded' | 'unavailable';
    mode: 'polling-handoff' | 'polling-ws-sidecar';
    transport: {
      kind: 'http-poll' | 'http-poll+ws-sidecar';
      liveEvents: false;
      wsProxySupported: boolean;
      pollingIntervalMs: number;
      websocket: {
        configured: boolean;
        browserUrl: string | null;
        browserReachability: 'explicit' | 'loopback-only' | 'unavailable';
      };
    };
    auth: {
      strategy: 'mission-control-basic-auth';
      sameOriginApi: true;
      websocketBridgeToken: boolean;
      gatewaySessionAuthConfigured: boolean;
    };
    capabilities: {
      runtimeSnapshot: boolean;
      sessionList: boolean;
      controlHandoff: boolean;
      composerSend: boolean;
      stop: boolean;
      reset: false;
      eventStream: false;
    };
    endpoints: {
      descriptor: string;
      launchControl: string | null;
      websocket: string | null;
      websocketHealth: string | null;
      websocketBridgeToken: string | null;
      gatewaySessionToken: string | null;
    };
    limitations: string[];
  };
  controlPath: {
    label: string;
    href: string | null;
    endpoint: string | null;
    guidance: string;
    note: string;
    sameAuthBoundary: boolean;
    embeddable: boolean;
    reason: 'browser-reachable' | 'loopback-only' | 'unavailable' | 'invalid';
  };
  runtime: {
    defaultAgentId: string | null;
    gateway: {
      mode: string | null;
      url: string | null;
      reachable: boolean;
      version: string | null;
    };
    health: {
      ok: boolean;
      channels: Array<{ channel: string; ok: boolean }>;
    };
  };
  sessionContext: {
    totalSessionsVisible: number | null;
    activeDirectLast5m: number;
    roots: Array<{
      key: string;
      model: string | null;
      updatedAt: string | null;
    }>;
    mainSession: {
      key: string;
      exists: boolean;
      model: string | null;
      updatedAt: string | null;
    };
    recent: Array<{
      key: string;
      model: string | null;
      thinkingLevel?: string | null;
      kind: string;
      ageMs: number | null;
      updatedAt: string | null;
      tokenUsage: {
        totalTokens: number;
        contextTokens: number;
        percentUsed: number;
      } | null;
    }>;
  };
  integrationShape: {
    now: string;
    next: string;
  };
  refreshedAt: string;
}

export type MarketIntelOutcome = 'correct' | 'incorrect' | 'duplicate' | 'pending';

export interface MarketIntelExecutionCandidate {
  candidateId: string;
  signalId: string | null;
  sourceType: string;
  sourceFeed: string;
  sourceTitle: string;
  sourceUrl: string | null;
  generatedAt: string | null;
  sourceTimestamp: string | null;
  category: string;
  patternName: string | null;
  confidenceLevel: string | null;
  recommendation: string | null;
  expectedHorizon: string | null;
  reasoning: string | null;
  reasoningScore: number | null;
  evidenceStrength: number | null;
  signalScore: number | null;
  executionPriority: number | null;
  executionBias: string | null;
  riskOverlayHint: string | null;
  theme: string | null;
  chainLayer: string | null;
  chainSublayer: string | null;
  beneficiaryClass: string | null;
  loserClass: string | null;
  pairTradeCandidate: boolean;
  pairTradeRationale: string | null;
  valueChainNotes: string | null;
  structuralInterpretationConfidence: number | null;
  dispatchReady: boolean;
  dispatchReasons: string[];
  primaryInstrument: {
    symbol: string | null;
    instrumentType: string | null;
    directionBias: string | null;
    mappingConfidence: number | null;
    relevanceScore: number | null;
  } | null;
  instrumentCandidates: Array<{
    symbol: string;
    instrumentType: string | null;
    directionBias: string | null;
    mappingConfidence: number | null;
    relevanceScore: number | null;
    reason: string | null;
  }>;
  predictedOutcomes: string[];
  predictedCausalChain: string[];
  signalBriefing: string | null;
}

export interface MarketIntelTrackedSignal {
  id: string;
  title: string;
  url: string | null;
  source: string;
  feed: string;
  category: string;
  pattern: string | null;
  confidenceLevel: string | null;
  recommendation: string | null;
  reasoningScore: number | null;
  signalScore: number | null;
  predictedOutcomes: string[];
  predictedCausalChain: string[];
  addedAt: string | null;
  signalTimestamp: string | null;
  verified: boolean;
  outcome: MarketIntelOutcome;
  verifiedAt: string | null;
  notes: string | null;
  verificationNote: string | null;
  evidencePack: {
    summary: string | null;
    confidence: string | null;
    causalVerdict: string | null;
    assetExpressionVerdict: string | null;
    duplicateOf: string | null;
    drivers: string[];
  } | null;
}

export interface MarketIntelResearchRadarItem {
  id: string;
  symbol: string;
  origin: 'system' | 'manual';
  company: string | null;
  thesis: string | null;
  whyNow: string | null;
  theme: string | null;
  chainLayer: string | null;
  chainSublayer: string | null;
  recurrence: number;
  surfacedAt: string | null;
  confidence: 'high' | 'medium' | 'low';
  sourceCount: number;
  pairTradeStyle: string | null;
  pairTradeReady: boolean;
  bestLongOperator: string | null;
  bestShortOperator: string | null;
  operatorSymbols: string[];
  notes: string[];
}

export interface MarketIntelManualWatchCandidate {
  id: string;
  symbol: string;
  company: string | null;
  thesis: string;
  sourceOrigin: string;
  conviction: 'low' | 'medium' | 'high';
  reviewStatus: 'active' | 'paused' | 'archived';
  tags: string[];
  notes: string | null;
  linkedTheme: string | null;
  linkedChainLayer: string | null;
  linkedChainSublayer: string | null;
  addedAt: string | null;
}

export interface MarketContextQuote {
  id: string;
  label: string;
  symbol: string;
  category: 'index' | 'commodity';
  price: number | null;
  change: number | null;
  changePct: number | null;
  currency: string | null;
  source: string | null;
  freshness: 'live' | 'delayed' | 'snapshot' | 'unavailable';
  updatedAt: string | null;
  note: string | null;
}

export interface MarketIntelDashboardSummary {
  status: IntegrationStatus;
  kpis: {
    weightedAccuracy: number | null;
    totalVerified: number;
    duplicateCount: number;
    evidenceCoverage: number | null;
    candidateCount: number;
    pendingCount: number;
    lastUpdated: string | null;
  };
  executionCandidates: MarketIntelExecutionCandidate[];
  trackedSignals: MarketIntelTrackedSignal[];
  researchRadar: {
    items: MarketIntelResearchRadarItem[];
    generatedAt: string | null;
    note: string;
  };
  manualWatch: {
    items: MarketIntelManualWatchCandidate[];
    path: string;
    note: string;
  };
  marketContext: {
    indices: MarketContextQuote[];
    commodities: MarketContextQuote[];
    note: string;
  };
  accuracySnapshot: {
    totalReviewedRaw: number | null;
    correctCount: number;
    incorrectCount: number;
    duplicateCount: number;
    pendingCount: number;
    weightedAccuracy: number | null;
  };
  refreshedAt: string;
}

export type MemorySection = 'durable' | 'daily' | 'learnings';
export type LearningKind = 'corrections' | 'errors' | 'requests';
export type MemoryDocumentKind = 'durable' | 'daily' | LearningKind;

export interface MemoryOverviewItem {
  path: string;
  title: string;
  kind: MemoryDocumentKind;
  updatedAt: string | null;
}

export interface MemoryDocument {
  path: string;
  title: string;
  kind: MemoryDocumentKind;
  updatedAt: string | null;
  mtimeMs: number | null;
  writable: boolean;
  content: string;
  exists: boolean;
}

export interface MemoryOverview {
  status: IntegrationStatus;
  refreshedAt: string;
  durable: {
    path: string;
    updatedAt: string | null;
    exists: boolean;
  };
  daily: {
    files: MemoryOverviewItem[];
    today: string;
    defaultDate: string | null;
  };
  learnings: {
    files: MemoryOverviewItem[];
    defaultKind: LearningKind;
  };
}

export type FileEntryKind = 'file' | 'directory';
export type FilePreviewKind = 'text' | 'image' | 'unsupported';

export interface FilesRoot {
  id: string;
  label: string;
  path: string;
}

export interface FilesEntry {
  name: string;
  path: string;
  kind: FileEntryKind;
  size: number | null;
  updatedAt: string | null;
  previewable: boolean;
}

export interface FilesListing {
  status: IntegrationStatus;
  refreshedAt: string;
  directory: {
    path: string;
    breadcrumb: Array<{ label: string; path: string }>;
  };
  roots: FilesRoot[];
  entries: FilesEntry[];
}

export interface FilesPreview {
  status: IntegrationStatus;
  refreshedAt: string;
  file: {
    name: string;
    path: string;
    mimeType: string;
    kind: FilePreviewKind;
    size: number;
    updatedAt: string | null;
    mtimeMs: number | null;
    writable: boolean;
    previewable: boolean;
  } | null;
  textContent?: string;
  imageUrl?: string;
  message?: string;
}

export type SearchScope = 'all' | 'memory' | 'files' | 'docs' | 'projects' | 'scripts';
export type SearchSourceKind = Exclude<SearchScope, 'all'>;

export interface SearchResultItem {
  id: string;
  sourceKind: SearchSourceKind;
  title: string;
  path: string;
  snippet: string;
  line?: number;
  targetHref: string;
  targetModule: 'memory' | 'files';
}

export interface SearchQueryResponse {
  status: IntegrationStatus;
  query: string;
  scope: SearchScope;
  limit: number;
  total: number;
  scannedFiles: number;
  truncated: boolean;
  results: SearchResultItem[];
  refreshedAt: string;
}
