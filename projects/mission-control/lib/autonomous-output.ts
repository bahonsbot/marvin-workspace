export type LightweightMarkdownBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'code'; text: string }
  | { type: 'heading'; level: 2 | 3; text: string };

export type AutonomousArtifactKind = 'file' | 'dir' | 'url' | 'log';
export type AutonomousArtifactLike = { path?: string; kind?: AutonomousArtifactKind; label?: string };
export type NormalizedAutonomousRunResult = {
  summary?: string;
  proof?: string;
  artifactPath?: string;
  metadataOnly: boolean;
};

type JsonRecord = Record<string, unknown>;

const WORKSPACE_ROOT = '/data/.openclaw/workspace';
const NOISE_ROOT_FILES = new Set([
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'HEARTBEAT.md',
  'BOOTSTRAP.md',
  'MEMORY.md',
]);
const REVIEW_FALLBACK_SUMMARY = 'No meaningful output artifact captured.';
const METADATA_TEXT_MARKERS = [
  'systemPromptReport',
  'injectedWorkspaceFiles',
  'bootstrapTruncation',
  'agentMeta',
  'promptTokens',
  'warningSignaturesSeen',
  'runId',
  'stopReason',
];

function stripRunnerNoise(value: string): string {
  return value
    .replace(/\n?⚠️\s*✍️\s*Write:[\s\S]*$/u, '')
    .replace(/\n?<parameter name="content">[\s\S]*$/u, '')
    .trim();
}

function stripMarkdownDecorators(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^>\s*/gm, '')
    .trim();
}

function normalizeWhitespace(value: string): string {
  return stripMarkdownDecorators(value).replace(/\s+/g, ' ').trim();
}

function sanitizeArtifactCandidate(value: string): string {
  return value.replace(/[),.;:!?]+$/g, '').replace(/^["'`(]+|["'`]+$/g, '').trim();
}

function parseJsonString<T = unknown>(value: string | undefined): T | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function unwrapJsonString(value: unknown, maxDepth = 3): unknown {
  let current = value;
  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (typeof current !== 'string') break;
    const parsed = parseJsonString(current);
    if (parsed === null) break;
    current = parsed;
  }
  return current;
}

function toWorkspaceRelativePath(value: string): string | null {
  if (!value) return null;
  if (value.startsWith(`${WORKSPACE_ROOT}/`)) return value.slice(WORKSPACE_ROOT.length + 1);
  if (/^(projects|memory|notes|tmp)\//.test(value)) return value;
  if (!value.includes('/') && NOISE_ROOT_FILES.has(value)) return value;
  return null;
}

function isNoiseArtifactPath(value: string): boolean {
  return NOISE_ROOT_FILES.has(value) || /^\.?\/?(AGENTS|SOUL|TOOLS|IDENTITY|USER|HEARTBEAT|BOOTSTRAP|MEMORY)\.md$/i.test(value);
}

function artifactPriority(path: string, kind?: string): boolean {
  if (isNoiseArtifactPath(path)) return false;
  // Directory artifacts are always skipped (we want the file, not the folder)
  const isDir = kind === 'dir' || (path.endsWith('/') && kind !== 'file');
  if (isDir) return false;
  return true;
}

/** Score for path-based ranking when multiple file artifacts exist (higher = more preferred). */
function artifactPathScore(path: string): number {
  let score = 0;
  // Prefer paths in projects/market-intel/notes (primary deliverable location for this task type)
  if (/^projects\/market-intel\/notes\//.test(path)) score += 30;
  // Prefer paths ending in shortlist
  if (/shortlist/i.test(path)) score += 20;
  // Deprioritize web-research packets and docs/autonomous-research/ (supporting artifacts)
  if (/\/autonomous-research\//.test(path)) score -= 40;
  if (/web.research/i.test(path)) score -= 40;
  return score;
}

export function selectPreferredArtifactPath(artifacts: AutonomousArtifactLike[] | undefined): string | undefined {
  if (!Array.isArray(artifacts)) return undefined;
  let best: string | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const artifact of artifacts) {
    const relativePath = toWorkspaceRelativePath(sanitizeArtifactCandidate(String(artifact?.path ?? '')));
    if (!relativePath || isNoiseArtifactPath(relativePath)) continue;
    if (!artifactPriority(relativePath, artifact?.kind)) continue;
    const score = artifactPathScore(relativePath);
    if (score > bestScore) {
      best = relativePath;
      bestScore = score;
    }
  }

  return best;
}

function structuredArtifactCandidates(value: unknown): AutonomousArtifactLike[] {
  const root = unwrapJsonString(value);
  const seen = new Map<string, AutonomousArtifactLike>();

  const add = (candidate: unknown, kind?: AutonomousArtifactKind, label?: string) => {
    if (typeof candidate !== 'string') return;
    const path = toWorkspaceRelativePath(sanitizeArtifactCandidate(candidate));
    if (!path || isNoiseArtifactPath(path) || seen.has(path)) return;
    seen.set(path, { path, kind, label });
  };

  const visit = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const entry of node) visit(entry);
      return;
    }

    const record = asRecord(node);
    if (!record) return;

    add(record.path, typeof record.kind === 'string' ? (record.kind as AutonomousArtifactKind) : undefined, typeof record.label === 'string' ? record.label : undefined);
    add(record.outputPath);
    add(record.filePath);
    add(record.dirPath, 'dir');
    add(record.directoryPath, 'dir');
    add(record.projectPath, 'dir');
    add(record.createdPath);

    if (Array.isArray(record.createdPaths)) {
      for (const entry of record.createdPaths) add(entry);
    }
    if (Array.isArray(record.outputPaths)) {
      for (const entry of record.outputPaths) add(entry);
    }
    if (Array.isArray(record.paths)) {
      for (const entry of record.paths) add(entry);
    }

    visit(record.artifacts);
    visit(record.payloads);
    visit(record.files);
    visit(record.outputs);
    visit(record.results);
    visit(record.response);
    visit(record.result);
    visit(record.data);
  };

  visit(root);
  return [...seen.values()];
}

function cleanSummaryCandidate(value: string): string {
  return stripRunnerNoise(value)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^[#>*`-]+/gm, ' ')
    .replace(/^"?(summary|proof|result|rawOutput)"?\s*:\s*/gim, '')
    .replace(/^[{[]|[}\]]$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyMetadataText(value: string): boolean {
  const text = cleanSummaryCandidate(value);
  if (!text) return true;
  if (/^(completed|ok|success|done|null)$/i.test(text)) return true;
  if (/^[\[{][\s\S]*[\]}]$/.test(value.trim())) return true;
  const markers = METADATA_TEXT_MARKERS.filter((marker) => text.includes(marker));
  if (markers.length >= 2) return true;
  if (/\"runId\"\s*:/.test(value) && /\"status\"\s*:/.test(value) && /\"result\"\s*:/.test(value)) return true;
  return false;
}

function scoreSummaryCandidate(value: string): number {
  const text = cleanSummaryCandidate(value);
  if (!text) return Number.NEGATIVE_INFINITY;

  let score = Math.min(text.length, 220) / 40;
  if (text.length < 12) score -= 2;
  if (/^(summary|result|completed|delivered|implemented|fixed|updated|created|wrote|added)\b/i.test(text)) score += 3;
  if (/\b(completed|implemented|fixed|updated|created|added|addressed|verified|artifact)\b/i.test(text)) score += 2;
  if (/^(warning|error|failed|failure|traceback|exception)\b/i.test(text)) score -= 5;
  if (/[\[{].*[\]}]/.test(text)) score -= 1.5;
  if (/\/data\/\.openclaw\/workspace\//.test(text) && text.length < 96) score -= 1;
  if (/⚠️|✍️|<parameter name=/u.test(text)) score -= 8;
  if (/^task complete\.?\s*\*\*/i.test(text)) score -= 3;
  return score;
}

function pushSummaryCandidate(candidates: string[], value: unknown): void {
  if (typeof value !== 'string') return;
  const clean = cleanSummaryCandidate(value);
  if (!clean) return;
  candidates.push(clean);
  for (const segment of value.split(/\n{2,}|\n/)) {
    const next = cleanSummaryCandidate(segment);
    if (next) candidates.push(next);
  }
}

function pushHumanTextCandidate(candidates: string[], value: unknown): void {
  if (typeof value !== 'string') return;
  const clean = cleanSummaryCandidate(value);
  if (!clean || isLikelyMetadataText(value)) return;
  candidates.push(clean);
}

function extractHumanPayloadTexts(value: unknown): string[] {
  const texts: string[] = [];

  const visit = (node: unknown) => {
    const current = unwrapJsonString(node);
    if (!current) return;

    if (typeof current === 'string') {
      pushHumanTextCandidate(texts, current);
      return;
    }

    if (Array.isArray(current)) {
      for (const entry of current) visit(entry);
      return;
    }

    const record = asRecord(current);
    if (!record) return;

    pushHumanTextCandidate(texts, record.text);
    pushHumanTextCandidate(texts, record.summary);
    pushHumanTextCandidate(texts, record.message);
    pushHumanTextCandidate(texts, record.completion);
    pushHumanTextCandidate(texts, record.content);

    visit(record.payloads);
    visit(record.outputs);
    visit(record.results);
    visit(record.response);
    visit(record.result);
    visit(record.data);
  };

  visit(value);
  return texts;
}

function summarizeProofLead(proof: string): string | undefined {
  const cleaned = stripRunnerNoise(proof);
  if (!cleaned) return undefined;

  const lines = cleaned.split('\n');
  let lead: string | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? '';
    if (!line || line === '---' || line.startsWith('```')) continue;
    if (/^(##?\s+|[-*]\s+|[|].*[|])/.test(line)) continue;

    const plain = normalizeWhitespace(line)
      .replace(/^Task complete\.?\s*/i, '')
      .replace(/^Completed\.?\s*/i, '')
      .trim();
    if (!plain) continue;

    if (/at:?$/i.test(plain)) {
      const nextPath = lines.slice(index + 1).find((candidate) => candidate.trim().startsWith('projects/'));
      if (nextPath) return `${plain} ${nextPath.trim()}`.trim();
    }

    lead = plain;
    break;
  }

  return lead;
}

export function summarizeAutonomousResult(result: string | undefined): string | undefined {
  if (!result) return undefined;

  const candidates: string[] = [];
  for (const text of extractHumanPayloadTexts(result)) candidates.push(text);
  pushSummaryCandidate(candidates, result);

  try {
    const parsed = JSON.parse(result) as Record<string, unknown>;
    if (parsed?.schema === 'mission-control-autonomous-run-v1') {
      const proofLead = typeof parsed.proof === 'string' ? summarizeProofLead(parsed.proof) : undefined;
      if (proofLead && !isLikelyMetadataText(proofLead)) candidates.unshift(proofLead);
      for (const text of extractHumanPayloadTexts(parsed.summary)) candidates.push(text);
      for (const text of extractHumanPayloadTexts(parsed.proof)) candidates.push(text);
      for (const text of extractHumanPayloadTexts(parsed.rawOutput)) candidates.push(text);
      pushSummaryCandidate(candidates, parsed.summary);
      pushSummaryCandidate(candidates, parsed.proof);
      pushSummaryCandidate(candidates, parsed.rawOutput);
    } else {
      for (const text of extractHumanPayloadTexts(parsed)) candidates.push(text);
      pushSummaryCandidate(candidates, parsed.summary);
      pushSummaryCandidate(candidates, parsed.text);
      pushSummaryCandidate(candidates, (parsed.response as { text?: unknown } | undefined)?.text);
      pushSummaryCandidate(candidates, (parsed.result as { summary?: unknown } | undefined)?.summary);
      const payloads = (parsed.result as { payloads?: Array<{ text?: unknown }> } | undefined)?.payloads;
      if (Array.isArray(payloads)) {
        for (const payload of payloads) pushSummaryCandidate(candidates, payload?.text);
      }
    }
  } catch {}

  let best: string | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const score = scoreSummaryCandidate(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

export function cleanReviewText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = stripRunnerNoise(value).trim();
  if (!cleaned || isLikelyMetadataText(cleaned)) return undefined;
  return cleaned;
}

export function previewReviewText(value: string | undefined, maxLength = 280): { text?: string; truncated: boolean } {
  const cleaned = cleanReviewText(value);
  if (!cleaned) return { text: undefined, truncated: false };
  const plain = normalizeWhitespace(cleaned);
  if (plain.length <= maxLength) return { text: plain, truncated: false };
  return { text: `${plain.slice(0, maxLength - 1).trimEnd()}…`, truncated: true };
}

export function parseLightweightMarkdown(value: string | undefined): LightweightMarkdownBlock[] {
  const cleaned = cleanReviewText(value);
  if (!cleaned) return [];

  const blocks: LightweightMarkdownBlock[] = [];
  const lines = cleaned.split('\n');
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index] ?? '';
    const line = rawLine.trim();

    if (!line || line === '---') {
      index += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      if (codeLines.length > 0) blocks.push({ type: 'code', text: codeLines.join('\n').trimEnd() });
      continue;
    }

    const headingMatch = line.match(/^(#{2,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length === 2 ? 2 : 3,
        text: normalizeWhitespace(headingMatch[2]),
      });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(normalizeWhitespace(lines[index].trim().replace(/^[-*]\s+/, '')));
        index += 1;
      }
      if (items.length > 0) blocks.push({ type: 'bullet-list', items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const candidate = lines[index].trim();
      if (!candidate || candidate === '---' || candidate.startsWith('```') || /^[-*]\s+/.test(candidate) || /^(#{2,3})\s+/.test(candidate)) break;
      if (/^[|].*[|]$/.test(candidate)) {
        index += 1;
        continue;
      }
      paragraphLines.push(candidate);
      index += 1;
    }

    const paragraph = normalizeWhitespace(paragraphLines.join(' '));
    if (paragraph) blocks.push({ type: 'paragraph', text: paragraph });
  }

  return blocks;
}

export function extractAutonomousArtifactsFromResult(result: string | undefined): Array<{ path: string; kind?: AutonomousArtifactKind; label?: string }> {
  if (!result) return [];

  const artifacts = new Map<string, { path: string; kind?: AutonomousArtifactKind; label?: string }>();
  const addArtifact = (value: string, artifact?: { kind?: AutonomousArtifactKind; label?: string }) => {
    const relativePath = toWorkspaceRelativePath(sanitizeArtifactCandidate(value));
    if (!relativePath || isNoiseArtifactPath(relativePath) || artifacts.has(relativePath)) return;
    artifacts.set(relativePath, { path: relativePath, kind: artifact?.kind, label: artifact?.label });
  };

  for (const artifact of structuredArtifactCandidates(result)) {
    if (artifact.path) addArtifact(artifact.path, artifact);
  }

  const pathPattern = /\/data\/\.openclaw\/workspace\/[^\s"'`<>]+|(?:projects|memory|notes|tmp)\/[^\s"'`<>]+/g;
  const fromText = (value: unknown) => {
    if (typeof value !== 'string') return;
    const matches = stripRunnerNoise(value).match(pathPattern) ?? [];
    for (const match of matches) addArtifact(match);
  };

  fromText(result);

  try {
    const parsed = JSON.parse(result) as Record<string, unknown>;
    if (parsed?.schema === 'mission-control-autonomous-run-v1') {
      if (Array.isArray(parsed.artifacts)) {
        for (const entry of parsed.artifacts) {
          if (!entry || typeof entry !== 'object' || typeof (entry as { path?: unknown }).path !== 'string') continue;
          addArtifact((entry as { path: string }).path, entry as { kind?: AutonomousArtifactKind; label?: string });
        }
      }
      fromText(parsed.proof);
      fromText(parsed.rawOutput);
    } else {
      fromText(parsed.summary);
      fromText(parsed.text);
      fromText((parsed.response as { text?: unknown } | undefined)?.text);
      const payloads = (parsed.result as { payloads?: Array<{ text?: unknown }> } | undefined)?.payloads;
      if (Array.isArray(payloads)) {
        for (const payload of payloads) fromText(payload?.text);
      }
    }
  } catch {}

  return [...artifacts.values()];
}

function hasMeaningfulPayloadContent(value: unknown): boolean {
  return extractHumanPayloadTexts(value).length > 0;
}

function detectMetadataOnlyRun(result: string | undefined, artifactPath?: string): boolean {
  if (!result) return false;
  const parsed = parseJsonString<JsonRecord>(result);
  if (!parsed) return false;

  const envelope = parsed.schema === 'mission-control-autonomous-run-v1' ? parsed : null;
  const inner = unwrapJsonString(envelope?.rawOutput ?? envelope?.proof ?? envelope?.summary ?? parsed);
  const innerRecord = asRecord(inner);
  const innerResult = asRecord(innerRecord?.result);
  const payloads = Array.isArray(innerResult?.payloads) ? innerResult.payloads : [];
  const hasPromptReport = Boolean(asRecord(innerResult?.meta)?.systemPromptReport) || Boolean(asRecord(innerRecord?.meta)?.systemPromptReport);
  const hasHumanText = hasMeaningfulPayloadContent(inner) || hasMeaningfulPayloadContent(envelope?.proof) || hasMeaningfulPayloadContent(envelope?.summary);
  return !artifactPath && payloads.length === 0 && !hasHumanText && hasPromptReport;
}

export function normalizeAutonomousRunResult(
  result: string | undefined,
  artifacts?: AutonomousArtifactLike[],
): NormalizedAutonomousRunResult {
  const artifactPath = selectPreferredArtifactPath([
    ...(Array.isArray(artifacts) ? artifacts : []),
    ...extractAutonomousArtifactsFromResult(result),
  ]);
  const parsed = parseJsonString<JsonRecord>(result);
  const envelope = parsed?.schema === 'mission-control-autonomous-run-v1' ? parsed : null;
  const summary = summarizeAutonomousResult(result);
  const proof = cleanReviewText(
    typeof envelope?.proof === 'string'
      ? envelope.proof
      : typeof envelope?.rawOutput === 'string'
        ? envelope.rawOutput
        : result,
  );
  const metadataOnly = detectMetadataOnlyRun(result, artifactPath);

  if (metadataOnly) {
    return {
      summary: REVIEW_FALLBACK_SUMMARY,
      proof: undefined,
      artifactPath: undefined,
      metadataOnly: true,
    };
  }

  return {
    summary: summary ?? (artifactPath ? `Output captured at ${artifactPath}` : undefined),
    proof,
    artifactPath,
    metadataOnly: false,
  };
}
