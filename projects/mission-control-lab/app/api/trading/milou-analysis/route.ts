import { NextResponse } from 'next/server';
import { buildMilouAnalysisPrompt, type MilouContextPayload } from '@/lib/trading/milou-analysis';
import { runShellCommand } from '@/lib/adapters/runtime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GATEWAY_CALL_TIMEOUT_MS = 45_000;
const ROUTE_TIMEOUT_MS = 50_000;
const MILOU_SESSION_KEY = 'agent:main:main';
const MILOU_SEAT_CONTEXT = 'Milou trading-advisor specialist seat (currently routed through the configured main OpenClaw runtime because standalone trading-advisor agent id is not present).';

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

function extractMilouAnswer(payload: Record<string, unknown>): string {
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
  return result ? extractMilouAnswer(result) : '';
}

function isMilouPayload(value: unknown): value is MilouContextPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<MilouContextPayload>;
  return typeof payload.question === 'string'
    && payload.question.trim().length > 0
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

  if (!isMilouPayload(payload)) {
    return NextResponse.json({ ok: false, error: 'Question and valuation context are required.' }, { status: 400 });
  }

  const prompt = buildMilouAnalysisPrompt(payload);
  const params = {
    sessionKey: MILOU_SESSION_KEY,
    message: `${prompt}\n\nRuntime routing note: ${MILOU_SEAT_CONTEXT}`,
    deliver: false,
    idempotencyKey: `lab-milou-${Date.now()}`,
  };

  try {
    const { stdout } = await runShellCommand(
      `openclaw gateway call chat.send --expect-final --json --timeout ${GATEWAY_CALL_TIMEOUT_MS} --params ${shellQuote(JSON.stringify(params))}`,
      ROUTE_TIMEOUT_MS,
    );
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    const answer = extractMilouAnswer(parsed);
    return NextResponse.json({ ok: true, sessionKey: MILOU_SESSION_KEY, answer, result: parsed }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (cause) {
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : 'Milou analysis failed.' }, { status: 502 });
  }
}
