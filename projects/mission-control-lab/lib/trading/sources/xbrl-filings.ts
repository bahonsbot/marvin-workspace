import 'server-only';

import type { TickerResourceGroup, TickerSourceMeta } from '../contracts';

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

export function hasRegisteredNonUsFilingsSymbol(symbol: string) {
  return Boolean(XBRL_ENTITY_REGISTRY[symbol.trim().toUpperCase()]);
}

function xbrlSource(asOf: string, note: string, freshness: TickerSourceMeta['freshness'] = 'fresh'): TickerSourceMeta {
  return {
    source: 'xbrl',
    asOf,
    freshness,
    note,
  };
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

async function resolveEntity(entry: XbrlRegistryEntry) {
  const byIdentifier = await fetchJson<XbrlEntityDocument>(`${XBRL_API_BASE_URL}/entities?filter[identifier]=${encodeURIComponent(entry.identifier)}`);
  const entity = byIdentifier?.data?.[0];
  if (entity) return entity;
  const byName = await fetchJson<XbrlEntityDocument>(`${XBRL_API_BASE_URL}/entities?filter[name]=${encodeURIComponent(entry.entityName)}`);
  return byName?.data?.[0] ?? null;
}

export async function fetchNonUsFilingsResources(symbol: string): Promise<NonUsFilingsResult | null> {
  const entry = XBRL_ENTITY_REGISTRY[symbol.toUpperCase()];
  if (!entry) return null;

  const entity = await resolveEntity(entry);
  const identifier = entity?.attributes?.identifier ?? entry.identifier;
  const filingsDocument = await fetchJson<XbrlFilingsDocument>(`${XBRL_API_BASE_URL}/entities/${encodeURIComponent(identifier)}/filings?sort=-processed&page[size]=4`);
  const filings = filingsDocument?.data?.filter((item) => absoluteUrl(item.attributes?.viewer_url)) ?? [];
  if (!filings.length) return null;

  const asOf = latestAsOf(filings);
  const source = xbrlSource(asOf, `Official ESEF filing index via filings.xbrl.org for ${entry.entityName} (${identifier}).`);
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

  return { source, resources };
}
