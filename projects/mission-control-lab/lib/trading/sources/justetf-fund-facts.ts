import 'server-only';

import type { TickerDisplayMetric, TickerProfile, TickerProfileFact, TickerSourceMeta, TickerSupplementalData } from '../contracts';

const JUSTETF_BASE_URL = 'https://www.justetf.com/en/etf-profile.html';
const JUSTETF_TIMEOUT_MS = 7000;

export interface JustEtfFundFacts {
  isin: string;
  name?: string;
  summary?: string;
  facts: TickerProfileFact[];
  holdingsMetrics: TickerDisplayMetric[];
  exposureMetrics: TickerDisplayMetric[];
  costMetrics: TickerDisplayMetric[];
  resources: {
    name: string;
    href: string;
    meta: string;
  }[];
  source: TickerSourceMeta;
}

function sourceMeta(note = 'Fund facts parsed from the public justETF profile page by ISIN.'): TickerSourceMeta {
  return {
    source: 'justetf',
    asOf: new Date().toISOString(),
    freshness: 'fresh',
    note,
  };
}

function factValue(facts: TickerProfileFact[], label: string) {
  return facts.find((fact) => fact.label.trim().toLowerCase() === label.trim().toLowerCase())?.value?.trim() ?? null;
}

function cleanText(value: string | undefined | null) {
  return (value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

function stripHtml(raw: string) {
  const withoutScripts = raw
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  return cleanText(withoutScripts
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&euro;/g, '€'));
}

function normalizeName(value: string | null | undefined) {
  return cleanText(value).replace(/\s+\|\s+.*$/, '');
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }
  return null;
}

function compactNumber(value: string | null | undefined) {
  return cleanText(value).replace(/([0-9]),([0-9]{3})(\b)/g, '$1,$2$3');
}

function addFact(facts: TickerProfileFact[], label: string, value: string | null | undefined) {
  const cleaned = cleanText(value);
  if (!cleaned || facts.some((fact) => fact.label === label)) return;
  facts.push({ label, value: cleaned });
}

function metric(label: string, value: string | null | undefined, source: TickerSourceMeta, note?: string): TickerDisplayMetric | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  return { label, value: cleaned, status: 'available', source, note };
}

function parseTopHoldings(text: string, source: TickerSourceMeta) {
  const start = text.indexOf('Top 10 Holdings');
  if (start < 0) return [];
  const endCandidates = ['Countries ', 'Sectors ', 'ETF Savings plan', 'Performance ', 'Risk ']
    .map((needle) => text.indexOf(needle, start + 16))
    .filter((index) => index > start);
  const end = endCandidates.length ? Math.min(...endCandidates) : Math.min(text.length, start + 900);
  const segment = text.slice(start, end);
  const matches = Array.from(segment.matchAll(/([A-Z0-9][A-Za-z0-9&.,'’()\- ]{2,80}?)\s+([0-9]+(?:\.[0-9]+)?%)/g));
  return matches
    .map((match) => ({ name: cleanText(match[1]), weight: match[2] }))
    .filter((item) => item.name && !/^(Top 10 Holdings|Weight of top|out of|Show more)/i.test(item.name))
    .slice(0, 10)
    .map((item) => metric(item.name, item.weight, source))
    .filter((item): item is TickerDisplayMetric => Boolean(item));
}

function parseExposureSegment(text: string, heading: 'Countries' | 'Sectors', source: TickerSourceMeta) {
  const start = text.indexOf(`${heading} `);
  if (start < 0) return [];
  const endCandidates = ['Countries ', 'Sectors ', 'As of ', 'ETF Savings plan', 'Performance ', 'Risk ']
    .map((needle) => text.indexOf(needle, start + heading.length + 1))
    .filter((index) => index > start);
  const end = endCandidates.length ? Math.min(...endCandidates) : Math.min(text.length, start + 600);
  const segment = text.slice(start + heading.length, end);
  return Array.from(segment.matchAll(/([A-Z][A-Za-z ()&.,'’\-]{2,50}?)\s+([0-9]+(?:\.[0-9]+)?%)/g))
    .map((match) => metric(match[1], match[2], source))
    .filter((item): item is TickerDisplayMetric => Boolean(item))
    .slice(0, 8);
}

function parseJustEtfHtml(html: string, isin: string): JustEtfFundFacts | null {
  const text = stripHtml(html);
  if (!text.toUpperCase().includes(isin.toUpperCase())) return null;
  const source = sourceMeta();
  const title = firstMatch(html, [/<title>([^<]+)<\/title>/i, /<meta property="og:title" content="([^"]+)"/i]);
  const name = normalizeName(title);
  const facts: TickerProfileFact[] = [];

  const index = firstMatch(text, [
    /seeks to track the ([^.]+?) index\./i,
    /Data Index ([A-Za-z0-9 .&'’\-()/]+?) Investment focus/i,
  ]);
  const strategySentence = firstMatch(text, [/(The [^.]+? seeks to track [^.]+\.)/i]);
  const description = firstMatch(text, [/(The [^.]+? seeks to track [\s\S]{80,900}?domiciled in [A-Za-z]+\.)/i]);
  const expenseRatio = firstMatch(text, [/Total expense ratio ([0-9]+(?:\.[0-9]+)?% p\.a\.)/i, /TER ([0-9]+(?:\.[0-9]+)?% p\.a\.)/i]);
  const fundSize = firstMatch(text, [/Fund size (EUR [0-9,.]+\s*[mb])/i, /has ([0-9,.]+m Euro) assets under management/i]);
  const replication = firstMatch(text, [/Replication ([A-Za-z]+(?: \([^)]+\))?)/i, /by (full replication|sampling technique)/i]);
  const distribution = firstMatch(text, [/Distribution policy ([A-Za-z]+)/i, /dividends in the ETF are (accumulated|distributed[^.]+)\./i]);
  const domicile = firstMatch(text, [/Fund domicile ([A-Za-z]+)/i, /domiciled in ([A-Za-z]+)/i]);
  const provider = firstMatch(text, [/Fund Provider ([A-Za-z0-9 .&'’\-]+?) Legal structure/i]);
  const holdingsCount = firstMatch(text, [/Holdings ([0-9,]+) Advertisement/i, /out of ([0-9,]+)/i]);
  const top10Weight = firstMatch(text, [/Weight of top 10 holdings out of [0-9,]+ ([0-9]+(?:\.[0-9]+)?%)/i]);
  const asOf = firstMatch(text, [/As of ([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i]);

  addFact(facts, 'Fund Provider', provider);
  addFact(facts, 'Benchmark', index);
  addFact(facts, 'Expense Ratio', expenseRatio);
  addFact(facts, 'AUM / Fund Size', fundSize ? compactNumber(fundSize) : null);
  addFact(facts, 'Replication', replication?.replace(/^full replication$/i, 'Physical (Full replication)').replace(/^sampling technique$/i, 'Physical (Sampling)'));
  addFact(facts, 'Distribution Policy', distribution?.replace(/^accumulated$/i, 'Accumulating'));
  addFact(facts, 'Fund Domicile', domicile);
  addFact(facts, 'Holdings Count', holdingsCount);
  addFact(facts, 'Top 10 Weight', top10Weight);
  addFact(facts, 'Holdings As Of', asOf);

  const costMetrics = [
    metric('Expense ratio', expenseRatio, source),
    metric('AUM / fund size', fundSize ? compactNumber(fundSize) : null, source),
    metric('Replication', replication?.replace(/^full replication$/i, 'Physical (Full replication)').replace(/^sampling technique$/i, 'Physical (Sampling)'), source),
    metric('Distribution policy', distribution?.replace(/^accumulated$/i, 'Accumulating'), source),
  ].filter((item): item is TickerDisplayMetric => Boolean(item));

  const holdingsMetrics = [
    metric('Holdings', holdingsCount, source),
    metric('Top 10 weight', top10Weight, source, asOf ? `Holdings date ${asOf}` : undefined),
    ...parseTopHoldings(text, source),
  ].filter((item): item is TickerDisplayMetric => Boolean(item));

  const exposureMetrics = [
    ...parseExposureSegment(text, 'Countries', source),
    ...parseExposureSegment(text, 'Sectors', source),
  ];

  const resources = [{
    name: 'justETF profile',
    href: `${JUSTETF_BASE_URL}?isin=${encodeURIComponent(isin)}`,
    meta: 'Fund facts, TER, holdings, and exposure by ISIN',
  }];

  return {
    isin,
    name,
    summary: description ?? strategySentence ?? undefined,
    facts,
    holdingsMetrics,
    exposureMetrics,
    costMetrics,
    resources,
    source,
  };
}

export async function fetchJustEtfFundFacts(profile: TickerProfile): Promise<JustEtfFundFacts | null> {
  const isin = factValue(profile.companyProfile.facts, 'ISIN');
  if (!isin) return null;
  const quoteType = `${factValue(profile.companyProfile.facts, 'Quote Type') ?? ''} ${factValue(profile.companyProfile.facts, 'Instrument Type') ?? ''}`.toUpperCase();
  if (!quoteType.includes('ETF') && !quoteType.includes('FUND') && !profile.name.toUpperCase().includes('ETF')) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JUSTETF_TIMEOUT_MS);
  try {
    const response = await fetch(`${JUSTETF_BASE_URL}?isin=${encodeURIComponent(isin)}`, {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'OpenClaw Mission Control ETF facts enrichment',
      },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return parseJustEtfHtml(await response.text(), isin);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function mergeJustEtfSupplementalData(profile: TickerProfile, justEtf: JustEtfFundFacts): TickerSupplementalData {
  const fallbackSource = justEtf.source;
  const existing = profile.supplemental;
  const ownershipMetrics = [
    ...justEtf.holdingsMetrics,
    ...justEtf.exposureMetrics,
  ];
  return {
    dividends: existing?.dividends ?? { status: 'unavailable', note: 'Dividend data unavailable.', source: fallbackSource, metrics: [] },
    technicals: existing?.technicals ?? { status: 'unavailable', note: 'Technical data unavailable.', source: fallbackSource, metrics: [] },
    estimates: existing?.estimates ?? { status: 'unavailable', note: 'Estimate data unavailable.', source: fallbackSource, metrics: [] },
    ownership: ownershipMetrics.length ? {
      status: 'available',
      note: 'Top holdings and exposure from justETF by ISIN. Treat as a fund-facts snapshot, not live intraday data.',
      source: justEtf.source,
      metrics: ownershipMetrics,
    } : (existing?.ownership ?? { status: 'unavailable', note: 'Holdings data unavailable.', source: fallbackSource, metrics: [] }),
  };
}
