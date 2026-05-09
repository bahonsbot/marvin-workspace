import type { DefeatBetaTranscriptDetail } from '@/lib/trading/sources/defeatbeta';

export type FullThesisExtractionKind = 'key-data' | 'metric-changes' | 'forecast-drivers';

export type FullThesisExtractionPayload = {
  symbol: string;
  companyName?: string | null;
  transcript: DefeatBetaTranscriptDetail;
  kind: FullThesisExtractionKind;
};

function transcriptLines(transcript: DefeatBetaTranscriptDetail) {
  if (!transcript.paragraphs.length) return 'No transcript paragraphs supplied.';
  return transcript.paragraphs
    .map((paragraph) => `[${paragraph.paragraphNumber}] ${paragraph.speaker || 'Unknown'}: ${paragraph.content}`)
    .join('\n');
}

function taskInstruction(kind: FullThesisExtractionKind) {
  if (kind === 'key-data') {
    return `Extract key financial data from the earnings-call transcript. Focus on named metrics, time scope, values, currencies/units, and speaker attribution. Return concise bullets grouped by revenue/growth, margins/profitability, cash flow/capex, balance sheet/capital returns, segment/product demand, and guidance/outlook. Include paragraph references like [12]. If a value is not stated, say not stated.`;
  }
  if (kind === 'metric-changes') {
    return `Analyze quarterly financial metric changes and causes discussed in the transcript. Identify what changed, direction/magnitude when stated, management's stated cause, whether it looks temporary or structural, and paragraph references like [12]. Do not infer numbers that are not stated.`;
  }
  return `Analyze forecast and guidance drivers discussed in the transcript. Extract forward-looking metrics, demand/supply drivers, margin/capex expectations, management tone, risks to guidance, and paragraph references like [12]. Distinguish explicit guidance from analyst interpretation.`;
}

export function buildFullThesisExtractionPrompt(input: FullThesisExtractionPayload) {
  const transcript = input.transcript;
  return `You are Milou, Philippe's trading-advisor specialist inside Mission Control Lab Analytics.

Task:
${taskInstruction(input.kind)}

Rules:
- This is analysis and education, not financial advice.
- Use only the transcript text supplied below. Do not use outside knowledge, live prices, or unstated facts.
- Be honest about gaps. If the transcript does not contain enough evidence, say so plainly.
- Keep Markdown light. Use bullets and short sections.
- Every material claim should include paragraph references when possible.

Company:
${input.companyName || input.symbol} (${input.symbol})

Transcript:
- Fiscal period: FY${transcript.fiscalYear ?? '—'} Q${transcript.fiscalQuarter ?? '—'}
- Report date: ${transcript.reportDate || '—'}
- Paragraphs included: ${transcript.includedParagraphCount ?? transcript.paragraphs.length} of ${transcript.paragraphCount ?? transcript.paragraphs.length}

Transcript text:
${transcriptLines(transcript)}

Return with these exact headings:
1. Short answer
2. Extracted evidence
3. Drivers and interpretation
4. Gaps and next checks`;
}
