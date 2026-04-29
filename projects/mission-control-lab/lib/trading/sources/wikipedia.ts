import 'server-only';

import type { TickerCompanyLogo, TickerSourceMeta } from '../contracts';

interface WikipediaSearchResponse {
  query?: {
    search?: Array<{ pageid?: number; title?: string }>;
  };
}

interface WikipediaPageResponse {
  query?: {
    pages?: Record<string, {
      pageid?: number;
      title?: string;
      fullurl?: string;
      pageprops?: { wikibase_item?: string };
    }>;
  };
}

interface WikidataEntityResponse {
  entities?: Record<string, {
    claims?: Record<string, Array<{
      rank?: 'deprecated' | 'normal' | 'preferred';
      mainsnak?: { datavalue?: { value?: string } };
    }>>;
  }>;
}

interface CommonsImageInfoResponse {
  query?: {
    pages?: Record<string, {
      imageinfo?: Array<{ thumburl?: string; url?: string }>;
    }>;
  };
}

const WIKI_USER_AGENT = 'MissionControlLab/1.0 (https://motiondisplay.cloud; ticker-logo-enrichment)';

const knownWikipediaTitles: Record<string, string> = {
  AAPL: 'Apple Inc.',
  AMZN: 'Amazon (company)',
  MSFT: 'Microsoft',
  NVDA: 'Nvidia',
  TSM: 'TSMC',
};

const knownLogoFiles: Record<string, string> = {
  AAPL: 'Apple logo black.svg',
};

function wikipediaSource(asOf: string, note: string): TickerSourceMeta {
  return {
    source: 'wikipedia',
    asOf,
    freshness: 'fresh',
    note,
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': WIKI_USER_AGENT,
      },
      next: { revalidate: 86_400 },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function firstPage<T extends object>(pages: Record<string, T> | undefined): T | null {
  if (!pages) return null;
  return Object.values(pages)[0] ?? null;
}

async function resolveWikipediaTitle(symbol: string, companyName: string) {
  const known = knownWikipediaTitles[symbol.toUpperCase()];
  if (known) return known;

  const search = await fetchJson<WikipediaSearchResponse>(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${companyName} company`)}&srlimit=1&format=json&origin=*`,
  );
  return search?.query?.search?.[0]?.title ?? null;
}

async function resolveWikidataId(title: string) {
  const page = await fetchJson<WikipediaPageResponse>(
    `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops|info&titles=${encodeURIComponent(title)}&inprop=url&format=json&origin=*`,
  );
  const resolved = firstPage(page?.query?.pages);
  return resolved?.pageprops?.wikibase_item ?? null;
}

function pickCurrentLogoFile(entity: WikidataEntityResponse, wikidataId: string, symbol: string) {
  const knownLogo = knownLogoFiles[symbol.toUpperCase()];
  if (knownLogo) return knownLogo;
  const logoClaims = entity.entities?.[wikidataId]?.claims?.P154 ?? [];
  const usable = logoClaims.filter((claim) => claim.rank !== 'deprecated' && typeof claim.mainsnak?.datavalue?.value === 'string');
  const preferred = usable.find((claim) => claim.rank === 'preferred') ?? usable.at(-1);
  return preferred?.mainsnak?.datavalue?.value ?? null;
}

async function resolveCommonsImageUrl(fileName: string) {
  const data = await fetchJson<CommonsImageInfoResponse>(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${fileName}`)}&prop=imageinfo&iiprop=url&iiurlwidth=250&format=json&origin=*`,
  );
  const page = firstPage(data?.query?.pages);
  const info = page?.imageinfo?.[0];
  return info?.thumburl ?? info?.url ?? null;
}

export async function fetchWikipediaCompanyLogo(symbol: string, companyName: string): Promise<TickerCompanyLogo | null> {
  const title = await resolveWikipediaTitle(symbol, companyName);
  if (!title) return null;

  const wikidataId = await resolveWikidataId(title);
  if (!wikidataId) return null;

  const entity = await fetchJson<WikidataEntityResponse>(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(wikidataId)}.json`);
  if (!entity) return null;

  const logoFile = pickCurrentLogoFile(entity, wikidataId, symbol);
  if (!logoFile) return null;

  const logoUrl = await resolveCommonsImageUrl(logoFile);
  if (!logoUrl) return null;

  const asOf = new Date().toISOString();
  return {
    url: logoUrl,
    alt: `${companyName} logo`,
    source: wikipediaSource(asOf, `Resolved from Wikipedia/Wikidata entity ${wikidataId} and Wikimedia Commons file ${logoFile}.`),
    attribution: 'Wikimedia Commons',
  };
}
