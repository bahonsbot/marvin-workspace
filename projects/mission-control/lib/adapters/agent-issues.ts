import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AgentIssueState } from '@/lib/agents/definitions';

const WORKSPACE_ROOT = process.env.OPENCLAW_WORKSPACE_ROOT ?? '/data/.openclaw/workspace';
const AGENT_ISSUES_PATH = path.join(WORKSPACE_ROOT, 'projects/mission-control/data/agent-issues.json');

type PersistedIssueState = {
  state: Extract<AgentIssueState, 'acknowledged'>;
  acknowledgedAt: string;
  updatedAt: string;
};

type AgentIssuesStore = {
  version: 1;
  issues: Record<string, PersistedIssueState>;
};

const EMPTY_STORE: AgentIssuesStore = {
  version: 1,
  issues: {},
};

async function readStore(): Promise<AgentIssuesStore> {
  try {
    const raw = await fs.readFile(AGENT_ISSUES_PATH, 'utf8');
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1 || typeof parsed.issues !== 'object' || !parsed.issues) {
      return EMPTY_STORE;
    }

    return {
      version: 1,
      issues: Object.fromEntries(
        Object.entries(parsed.issues).filter((entry): entry is [string, PersistedIssueState] => isPersistedIssueState(entry[1])),
      ),
    };
  } catch {
    return EMPTY_STORE;
  }
}

function isPersistedIssueState(value: unknown): value is PersistedIssueState {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<PersistedIssueState>;
  return (
    candidate.state === 'acknowledged' &&
    typeof candidate.acknowledgedAt === 'string' &&
    typeof candidate.updatedAt === 'string'
  );
}

async function writeStore(store: AgentIssuesStore) {
  await fs.mkdir(path.dirname(AGENT_ISSUES_PATH), { recursive: true });
  await fs.writeFile(AGENT_ISSUES_PATH, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export async function getAgentIssueStateMap() {
  return readStore();
}

export async function setAgentIssueState(issueId: string, state: AgentIssueState) {
  const normalizedIssueId = issueId.trim();
  if (!normalizedIssueId) {
    throw new Error('INVALID_ISSUE_ID');
  }

  const store = await readStore();

  if (state === 'active') {
    delete store.issues[normalizedIssueId];
    await writeStore(store);
    return { issueId: normalizedIssueId, state };
  }

  const now = new Date().toISOString();
  store.issues[normalizedIssueId] = {
    state: 'acknowledged',
    acknowledgedAt: now,
    updatedAt: now,
  };
  await writeStore(store);

  return {
    issueId: normalizedIssueId,
    state,
    acknowledgedAt: now,
  };
}
