import 'server-only';

import type { TickerProfile, TickerResourceGroup, TickerSourceMeta } from '../contracts';

interface XbrlEntityDocument {
  data?: Array<{
    attributes?: {
      name?: string;
      identifier?: string;
    };
  }>;
}

interface XbrlFilingsDocument {
  data?: Array<{
    id?: string;
    attributes?: {
      processed?: string;
      country?: string;
      period_end?: string;
      viewer_url?: string;
      report_url?: string;
      json_url?: string;
      package_url?: string;
      error_count?: number;
      warning_count?: number;
      inconsistency_count?: number;
    };
  }>;
}

interface XbrlRegistryEntry {
  symbol: string;
  entityName: string;
  identifier: string;
}

export interface NonUsFilingsResult {
  source: TickerSourceMeta;
  resources: TickerResourceGroup[];
}

const XBRL_BASE_URL = 'https://filings.xbrl.org';
const XBRL_API_BASE_URL = `${XBRL_BASE_URL}/api`;
const XBRL_USER_AGENT = 'MotionDisplay MissionControlLab marvin@motiondisplay.cloud';
const DART_BASE_URL = 'https://dart.fss.or.kr';
const ENGLISH_DART_BASE_URL = 'https://englishdart.fss.or.kr';
const KIND_BASE_URL = 'https://kind.krx.co.kr';
const MOPS_BASE_URL = 'https://emops.twse.com.tw';

const XBRL_ENTITY_REGISTRY: Record<string, XbrlRegistryEntry> = {
  'ASRNL.AS': {
    symbol: 'ASRNL.AS',
    entityName: 'ASR Nederland N.V.',
    identifier: '7245000G0HS48PZWUD53',
  },
  'ASML.AS': {
    symbol: 'ASML.AS',
    entityName: 'ASML Holding N.V.',
    identifier: '724500Y6DUVHQD6OXN27',
  },
  'ADYEN.AS': {
    symbol: 'ADYEN.AS',
    entityName: 'Adyen N.V.',
    identifier: '724500973ODKK3IFQ447',
  },
};

const ESEF_EXCHANGE_SUFFIXES = [
  '.AS', '.BR', '.PA', '.DE', '.F', '.MU', '.DU', '.BE', '.SG', '.MI', '.MC', '.LS', '.VI', '.IR', '.HE', '.ST', '.CO', '.OL', '.WA', '.PR', '.IC', '.AT', '.L',
];

export function hasRegisteredNonUsFilingsSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  return Boolean(XBRL_ENTITY_REGISTRY[normalized]) || isEsefCandidateSymbol(normalized) || isKoreanDisclosureSymbol(normalized) || isTaiwanDisclosureSymbol(normalized);
}

function regulatorSource(source: TickerSourceMeta['source'], asOf: string, note: string, freshness: TickerSourceMeta['freshness'] = 'fresh'): TickerSourceMeta {
  return {
    source,
    asOf,
    freshness,
    note,
  };
}

function xbrlSource(asOf: string, note: string, freshness: TickerSourceMeta['freshness'] = 'fresh'): TickerSourceMeta {
  return regulatorSource('xbrl', asOf, note, freshness);
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/vnd.api+json, application/json',
        'user-agent': XBRL_USER_AGENT,
      },
      next: { revalidate: 86_400 },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function absoluteUrl(path: string | undefined) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${XBRL_BASE_URL}${path}`;
}

function formatDate(value: string | undefined) {
  if (!value) return 'Date unavailable';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  if (Number.isNaN(parsed.getTime())) {
    const fallback = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(fallback.getTime())) return value;
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(fallback);
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function latestAsOf(filings: NonNullable<XbrlFilingsDocument['data']>) {
  const timestamps = filings
    .map((filing) => filing.attributes?.processed)
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      const normalized = value.replace(' ', 'T');
      const parsed = new Date(`${normalized}Z`);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    })
    .filter((value): value is string => Boolean(value));
  return timestamps[0] ?? new Date().toISOString();
}

function filingName(periodEnd: string | undefined) {
  if (!periodEnd) return 'Official ESEF filing';
  if (periodEnd.endsWith('-12-31')) return `Annual report · FY ${periodEnd.slice(0, 4)}`;
  return `Official filing · ${periodEnd}`;
}

function filingMeta(filing: NonNullable<XbrlFilingsDocument['data']>[number]) {
  const attrs = filing.attributes ?? {};
  const parts = [`ESEF ${attrs.country ?? 'filing'}`];
  if (attrs.period_end) parts.push(`period ${formatDate(attrs.period_end)}`);
  if (attrs.processed) parts.push(`processed ${formatDate(attrs.processed)}`);
  const quality = [];
  if (typeof attrs.error_count === 'number') quality.push(`${attrs.error_count} errors`);
  if (typeof attrs.warning_count === 'number') quality.push(`${attrs.warning_count} warnings`);
  if (typeof attrs.inconsistency_count === 'number') quality.push(`${attrs.inconsistency_count} inconsistencies`);
  if (quality.length) parts.push(quality.join(', '));
  return parts.join(' · ');
}

function normalizeEntityName(value: string) {
  return value
    .replace(/\bN\.?\s*V\.?/gi, 'N.V.')
    .replace(/\bB\.?\s*V\.?\b/gi, 'B.V.')
    .replace(/\bS\.?\s*A\.?\b/gi, 'S.A.')
    .replace(/[.,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function entityNameQueryCandidates(value: string) {
  const trimmed = value.trim();
  const variants = [
    trimmed,
    trimmed.replace(/\bN\.\s*V\./gi, 'N.V.'),
    trimmed.replace(/\bN\.\s+V\./gi, 'N.V.'),
    trimmed.replace(/\bN\.?\s*V\.?\b/gi, 'N.V.'),
    trimmed.replace(/\bB\.?\s*V\.?\b/gi, 'B.V.'),
    trimmed.replace(/\bS\.?\s*A\.?\b/gi, 'S.A.'),
  ];
  return variants;
}

function companyNameCandidates(profile: TickerProfile) {
  const candidates = [
    profile.companyProfile.facts.find((fact) => fact.label.toLowerCase() === 'company name')?.value,
    profile.name,
    profile.companyProfile.summary.match(/^(.+?)\s+is\s+/i)?.[1],
    profile.companyProfile.summary.length < 120 ? profile.companyProfile.summary : undefined,
  ].filter((value): value is string => Boolean(value));
  return Array.from(new Set(candidates
    .flatMap(entityNameQueryCandidates)
    .map((value) => value.trim())
    .filter((value) => value && value.toUpperCase() !== profile.symbol.toUpperCase())));
}

function isEsefCandidateSymbol(symbol: string) {
  return ESEF_EXCHANGE_SUFFIXES.some((suffix) => symbol.endsWith(suffix));
}

function isKoreanDisclosureSymbol(symbol: string) {
  return /^\d{6}\.(KS|KQ)$/.test(symbol);
}

function isTaiwanDisclosureSymbol(symbol: string) {
  return /^\d{4,6}\.(TW|TWO)$/.test(symbol);
}

function baseSymbol(symbol: string) {
  return symbol.trim().toUpperCase().split('.')[0];
}

async function resolveEntity(entry: XbrlRegistryEntry) {
  const byIdentifier = await fetchJson<XbrlEntityDocument>(`${XBRL_API_BASE_URL}/entities?filter[identifier]=${encodeURIComponent(entry.identifier)}`);
  const entity = byIdentifier?.data?.[0];
  if (entity) return entity;
  const byName = await fetchJson<XbrlEntityDocument>(`${XBRL_API_BASE_URL}/entities?filter[name]=${encodeURIComponent(entry.entityName)}`);
  return byName?.data?.[0] ?? null;
}

async function resolveEntityFromProfile(profile: TickerProfile) {
  if (!isEsefCandidateSymbol(profile.symbol.toUpperCase())) return null;

  for (const candidate of companyNameCandidates(profile)) {
    const byName = await fetchJson<XbrlEntityDocument>(`${XBRL_API_BASE_URL}/entities?filter[name]=${encodeURIComponent(candidate)}`);
    const entity = byName?.data?.find((item) => normalizeEntityName(item.attributes?.name ?? '') === normalizeEntityName(candidate));
    if (entity?.attributes?.identifier) {
      return {
        symbol: profile.symbol,
        entityName: entity.attributes.name ?? candidate,
        identifier: entity.attributes.identifier,
      } satisfies XbrlRegistryEntry;
    }
  }

  return null;
}

function buildEsefResources(source: TickerSourceMeta, filings: NonNullable<XbrlFilingsDocument['data']>) {
  const latest = filings[0];
  const latestJsonUrl = absoluteUrl(latest.attributes?.json_url);
  const latestPackageUrl = absoluteUrl(latest.attributes?.package_url);
  const latestReportUrl = absoluteUrl(latest.attributes?.report_url);

  const resources: TickerResourceGroup[] = [
    {
      label: 'Official ESEF filings',
      items: filings.map((filing) => ({
        name: filingName(filing.attributes?.period_end),
        meta: filingMeta(filing),
        href: absoluteUrl(filing.attributes?.viewer_url)!,
        source,
        kind: filing.attributes?.period_end?.endsWith('-12-31') ? 'annual' : 'resource',
        form: 'ESEF',
        filedAt: filing.attributes?.processed,
        reportDate: filing.attributes?.period_end,
        accession: filing.id,
        document: filing.attributes?.viewer_url ?? undefined,
      })),
    },
  ];

  const structuredDataItems = [
    latestJsonUrl
      ? {
          name: 'xBRL-JSON data',
          meta: `Latest structured data export · ${formatDate(latest.attributes?.processed)}`,
          href: latestJsonUrl,
          source,
          kind: 'resource' as const,
          form: 'JSON',
          filedAt: latest.attributes?.processed,
          reportDate: latest.attributes?.period_end,
          accession: latest.id,
          document: latest.attributes?.json_url ?? undefined,
        }
      : null,
    latestPackageUrl
      ? {
          name: 'Filing package',
          meta: `Original filing package / report archive · ${formatDate(latest.attributes?.processed)}`,
          href: latestPackageUrl,
          source,
          kind: 'resource' as const,
          form: 'ZIP',
          filedAt: latest.attributes?.processed,
          reportDate: latest.attributes?.period_end,
          accession: latest.id,
          document: latest.attributes?.package_url ?? undefined,
        }
      : latestReportUrl
        ? {
            name: 'Report document',
            meta: `Official report document · ${formatDate(latest.attributes?.processed)}`,
            href: latestReportUrl,
            source,
            kind: 'resource' as const,
            form: 'HTML',
            filedAt: latest.attributes?.processed,
            reportDate: latest.attributes?.period_end,
            accession: latest.id,
            document: latest.attributes?.report_url ?? undefined,
          }
        : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (structuredDataItems.length) {
    resources.push({
      label: 'Structured XBRL data',
      items: structuredDataItems,
    });
  }

  return resources;
}

async function fetchEsefResources(profile: TickerProfile): Promise<NonUsFilingsResult | null> {
  const normalizedSymbol = profile.symbol.toUpperCase();
  const registryEntry = XBRL_ENTITY_REGISTRY[normalizedSymbol];
  const entry = registryEntry ?? await resolveEntityFromProfile(profile);
  if (!entry) return null;

  const entity = registryEntry ? await resolveEntity(entry) : null;
  const identifier = entity?.attributes?.identifier ?? entry.identifier;
  const entityName = entity?.attributes?.name ?? entry.entityName;
  const filingsDocument = await fetchJson<XbrlFilingsDocument>(`${XBRL_API_BASE_URL}/entities/${encodeURIComponent(identifier)}/filings?sort=-processed&page[size]=4`);
  const filings = filingsDocument?.data?.filter((item) => absoluteUrl(item.attributes?.viewer_url)) ?? [];
  if (!filings.length) return null;

  const asOf = latestAsOf(filings);
  const source = xbrlSource(asOf, `Official ESEF filing index via filings.xbrl.org for ${entityName} (${identifier}).`);
  return { source, resources: buildEsefResources(source, filings) };
}

function koreaDisclosureResources(symbol: string): NonUsFilingsResult | null {
  const normalizedSymbol = symbol.toUpperCase();
  if (!isKoreanDisclosureSymbol(normalizedSymbol)) return null;
  const code = baseSymbol(normalizedSymbol);
  const asOf = new Date().toISOString();
  const source = regulatorSource('dart', asOf, `Official Korean disclosure search links for ${code}. OpenDART ticker-to-corp-code API integration can replace these search links when an API key is configured.`);
  return {
    source,
    resources: [
      {
        label: 'Official Korean disclosures',
        items: [
          {
            name: 'DART disclosure search',
            meta: `Official Financial Supervisory Service DART search for Korean stock code ${code}.`,
            href: `${DART_BASE_URL}/dsab007/main.do?option=corp&textCrpNm=${encodeURIComponent(code)}`,
            source,
            kind: 'resource',
            form: 'DART',
          },
          {
            name: 'English DART disclosure search',
            meta: `English DART search for Korean stock code ${code}.`,
            href: `${ENGLISH_DART_BASE_URL}/dsbb007/main.do?option=corp&textCrpNm=${encodeURIComponent(code)}`,
            source,
            kind: 'resource',
            form: 'DART',
          },
          {
            name: 'KRX KIND company search',
            meta: `Official KRX KIND company search for ${code}.`,
            href: `${KIND_BASE_URL}/corpgeneral/corpList.do?method=searchCorpList&comAbbrv=${encodeURIComponent(code)}`,
            source,
            kind: 'resource',
            form: 'KIND',
          },
        ],
      },
    ],
  };
}

function taiwanDisclosureResources(symbol: string): NonUsFilingsResult | null {
  const normalizedSymbol = symbol.toUpperCase();
  if (!isTaiwanDisclosureSymbol(normalizedSymbol)) return null;
  const code = baseSymbol(normalizedSymbol);
  const asOf = new Date().toISOString();
  const source = regulatorSource('mops', asOf, `Official Taiwan MOPS disclosure landing for stock code ${code}. MOPS uses stateful flows for many deeper report links, so Mission Control links to the verified ticker landing instead of guessing report URLs.`);
  return {
    source,
    resources: [
      {
        label: 'Official Taiwan disclosures',
        items: [
          {
            name: 'MOPS disclosure landing',
            meta: `Official TWSE/TPEx Market Observation Post System landing for stock code ${code}.`,
            href: `${MOPS_BASE_URL}/server-java/t58query?co_id=${encodeURIComponent(code)}&step=0a&caption_id=000001`,
            source,
            kind: 'resource',
            form: 'MOPS',
          },
        ],
      },
    ],
  };
}

export async function fetchNonUsFilingsResources(profile: TickerProfile): Promise<NonUsFilingsResult | null> {
  const symbol = profile.symbol.toUpperCase();

  const esef = await fetchEsefResources(profile);
  if (esef) return esef;

  return koreaDisclosureResources(symbol) ?? taiwanDisclosureResources(symbol);
}
