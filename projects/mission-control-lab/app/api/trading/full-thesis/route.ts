import { NextResponse } from 'next/server';
import { buildFullThesisPrompt, type FullThesisPayload } from '@/lib/trading/full-thesis';
import { runShellCommand } from '@/lib/adapters/runtime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GATEWAY_CALL_TIMEOUT_MS = 180_000;
const ROUTE_TIMEOUT_MS = 190_000;
const HISTORY_CALL_TIMEOUT_MS = 60_000;
const HISTORY_ROUTE_TIMEOUT_MS = 70_000;
const MILOU_SESSION_KEY = 'agent:trading-advisor:main';
const MILOU_SEAT_CONTEXT = 'Milou trading-advisor specialist seat using the registered trading-advisor runtime workspace and skill posture.';
const THESIS_HISTORY_LIMIT = 50;
const THESIS_POLL_DELAYS_MS = [1_000, 1_800, 2_800, 4_000, 5_500, 7_000, 9_000, 11_000, 14_000, 17_000, 21_000, 25_000, 30_000] as const;

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

function extractThesisAnswer(payload: Record<string, unknown>): string {
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
  return result ? extractThesisAnswer(result) : '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractAssistantTextFromMessage(message: Record<string, unknown>): string {
  if (message.role !== 'assistant') return '';
  return textFromUnknown(message.content ?? message.message ?? message.output ?? message.text);
}

async function loadLatestThesisAnswer(sessionKey: string, runStartedAt: number): Promise<string> {
  const params = { sessionKey, limit: THESIS_HISTORY_LIMIT };
  const command = `openclaw gateway call chat.history --json --timeout ${HISTORY_CALL_TIMEOUT_MS} --params ${shellQuote(JSON.stringify(params))}`;

  for (let attempt = 0; attempt < THESIS_POLL_DELAYS_MS.length; attempt += 1) {
    await sleep(THESIS_POLL_DELAYS_MS[attempt]);
    const { stdout } = await runShellCommand(command, HISTORY_ROUTE_TIMEOUT_MS);
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = asRecord(messages[index]);
      if (!message) continue;
      const timestamp = typeof message.timestamp === 'number' ? message.timestamp : 0;
      if (timestamp && timestamp < runStartedAt - 1_000) continue;
      const answer = extractAssistantTextFromMessage(message).trim();
      if (answer) return answer;
    }
  }

  return '';
}

function isFullThesisPayload(value: unknown): value is FullThesisPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<FullThesisPayload>;
  return Boolean(payload.selected)
    && typeof payload.selected === 'object'
    && Boolean(payload.valuation)
    && typeof payload.valuation === 'object';
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isFullThesisPayload(payload)) {
    return NextResponse.json({ ok: false, error: 'A selected ticker and valuation context are required.' }, { status: 400 });
  }

  const prompt = buildFullThesisPrompt(payload);
  const params = {
    sessionKey: MILOU_SESSION_KEY,
    message: `${prompt}\n\nRuntime routing note: ${MILOU_SEAT_CONTEXT}`,
    deliver: false,
    idempotencyKey: `lab-full-thesis-${Date.now()}`,
  };

  try {
    const runStartedAt = Date.now();
    const { stdout } = await runShellCommand(
      `openclaw gateway call chat.send --expect-final --json --timeout ${GATEWAY_CALL_TIMEOUT_MS} --params ${shellQuote(JSON.stringify(params))}`,
      ROUTE_TIMEOUT_MS,
    );
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    const directAnswer = extractThesisAnswer(parsed);
    const thesis = directAnswer || await loadLatestThesisAnswer(MILOU_SESSION_KEY, runStartedAt);
    return NextResponse.json({ ok: true, sessionKey: MILOU_SESSION_KEY, thesis, result: parsed }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (cause) {
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : 'Full thesis generation failed.' }, { status: 502 });
  }
}
