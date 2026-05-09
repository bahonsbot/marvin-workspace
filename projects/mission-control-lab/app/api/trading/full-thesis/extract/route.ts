import { NextResponse } from 'next/server';
import { runShellCommand } from '@/lib/adapters/runtime';
import { buildFullThesisExtractionPrompt, type FullThesisExtractionKind } from '@/lib/trading/full-thesis-extraction';
import { getDefeatBetaTranscriptDetail } from '@/lib/trading/sources/defeatbeta';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GATEWAY_CALL_TIMEOUT_MS = 180_000;
const ROUTE_TIMEOUT_MS = 190_000;
const HISTORY_CALL_TIMEOUT_MS = 60_000;
const HISTORY_ROUTE_TIMEOUT_MS = 70_000;
const MILOU_SESSION_KEY = 'agent:trading-advisor:main';
const EXTRACTION_HISTORY_LIMIT = 50;
const EXTRACTION_POLL_DELAYS_MS = [1_000, 1_800, 2_800, 4_000, 5_500, 7_000, 9_000, 11_000, 14_000, 17_000, 21_000, 25_000, 30_000] as const;
const EXTRACTION_KINDS = new Set<FullThesisExtractionKind>(['key-data', 'metric-changes', 'forecast-drivers']);

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function textFromUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textFromUnknown).filter(Boolean).join('');
  const record = asRecord(value);
  if (!record) return '';
  if (typeof record.text === 'string') return record.text;
  if (typeof record.content === 'string') return record.content;
  return textFromUnknown(record.content ?? record.message ?? record.output);
}

function extractAnswer(payload: Record<string, unknown>): string {
  const direct = textFromUnknown(payload.answer ?? payload.final ?? payload.message ?? payload.output ?? payload.content);
  if (direct.trim()) return direct.trim();
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = asRecord(messages[index]);
    if (message?.role && message.role !== 'assistant') continue;
    const text = textFromUnknown(messages[index]);
    if (text.trim()) return text.trim();
  }
  const result = asRecord(payload.result);
  return result ? extractAnswer(result) : '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadLatestExtractionAnswer(sessionKey: string, runStartedAt: number): Promise<string> {
  const params = { sessionKey, limit: EXTRACTION_HISTORY_LIMIT };
  const command = `openclaw gateway call chat.history --json --timeout ${HISTORY_CALL_TIMEOUT_MS} --params ${shellQuote(JSON.stringify(params))}`;
  for (let attempt = 0; attempt < EXTRACTION_POLL_DELAYS_MS.length; attempt += 1) {
    await sleep(EXTRACTION_POLL_DELAYS_MS[attempt]);
    const { stdout } = await runShellCommand(command, HISTORY_ROUTE_TIMEOUT_MS);
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = asRecord(messages[index]);
      if (!message || message.role !== 'assistant') continue;
      const timestamp = typeof message.timestamp === 'number' ? message.timestamp : 0;
      if (timestamp && timestamp < runStartedAt - 1_000) continue;
      const answer = textFromUnknown(message.content ?? message.message ?? message.output ?? message.text).trim();
      if (answer) return answer;
    }
  }
  return '';
}

function validSymbol(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9._-]{1,24}$/i.test(value.trim());
}

export async function POST(request: Request) {
  let payload: { symbol?: unknown; companyName?: unknown; kind?: unknown; fiscalYear?: unknown; fiscalQuarter?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!validSymbol(payload.symbol)) {
    return NextResponse.json({ ok: false, error: 'A valid ticker symbol is required.' }, { status: 400 });
  }
  if (typeof payload.kind !== 'string' || !EXTRACTION_KINDS.has(payload.kind as FullThesisExtractionKind)) {
    return NextResponse.json({ ok: false, error: 'A valid extraction kind is required.' }, { status: 400 });
  }

  const symbol = payload.symbol.trim().toUpperCase();
  const kind = payload.kind as FullThesisExtractionKind;
  const transcript = await getDefeatBetaTranscriptDetail(symbol, {
    fiscalYear: typeof payload.fiscalYear === 'number' ? payload.fiscalYear : null,
    fiscalQuarter: typeof payload.fiscalQuarter === 'number' ? payload.fiscalQuarter : null,
    timeoutMs: 60_000,
  });
  if (transcript.status !== 'available' || !transcript.paragraphs.length) {
    return NextResponse.json({ ok: false, error: 'Transcript detail is unavailable for this symbol/quarter.', transcript: { status: transcript.status, resolvedSymbol: transcript.resolvedSymbol, fiscalYear: transcript.fiscalYear, fiscalQuarter: transcript.fiscalQuarter, paragraphCount: transcript.paragraphCount } }, { status: 424 });
  }

  const prompt = buildFullThesisExtractionPrompt({
    symbol,
    companyName: typeof payload.companyName === 'string' ? payload.companyName : null,
    kind,
    transcript,
  });
  const params = {
    sessionKey: MILOU_SESSION_KEY,
    message: prompt,
    deliver: false,
    idempotencyKey: `lab-full-thesis-extract-${kind}-${Date.now()}`,
  };

  try {
    const runStartedAt = Date.now();
    const { stdout } = await runShellCommand(
      `openclaw gateway call chat.send --expect-final --json --timeout ${GATEWAY_CALL_TIMEOUT_MS} --params ${shellQuote(JSON.stringify(params))}`,
      ROUTE_TIMEOUT_MS,
    );
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    const directAnswer = extractAnswer(parsed);
    const analysis = directAnswer || await loadLatestExtractionAnswer(MILOU_SESSION_KEY, runStartedAt);
    return NextResponse.json({
      ok: true,
      kind,
      symbol,
      sessionKey: MILOU_SESSION_KEY,
      transcript: {
        status: transcript.status,
        resolvedSymbol: transcript.resolvedSymbol,
        fiscalYear: transcript.fiscalYear,
        fiscalQuarter: transcript.fiscalQuarter,
        reportDate: transcript.reportDate,
        paragraphCount: transcript.paragraphCount,
        includedParagraphCount: transcript.includedParagraphCount,
      },
      analysis,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (cause) {
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : 'Full Thesis extraction failed.', transcript: { status: transcript.status, resolvedSymbol: transcript.resolvedSymbol, fiscalYear: transcript.fiscalYear, fiscalQuarter: transcript.fiscalQuarter, paragraphCount: transcript.paragraphCount } }, { status: 502 });
  }
}
