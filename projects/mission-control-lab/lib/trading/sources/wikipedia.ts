import 'server-only';

import type { TickerCompanyLogo, TickerCompanyProfile, TickerProfileFact, TickerSourceMeta } from '../contracts';

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
      extract?: string;
      pageprops?: { wikibase_item?: string };
    }>;
  };
}

interface WikidataClaim {
  rank?: 'deprecated' | 'normal' | 'preferred';
  mainsnak?: {
    datavalue?: {
      value?: string | number | { id?: string; time?: string; amount?: string };
    };
  };
}

interface WikidataEntityResponse {
  entities?: Record<string, {
    claims?: Record<string, WikidataClaim[]>;
  }>;
}

interface CommonsImageInfoResponse {
  query?: {
    pages?: Record<string, {
      imageinfo?: Array<{ thumburl?: string; url?: string }>;
    }>;
  };
}

const WIKI_USER_AGENT = 'MissionControlLab/1.0 (https://motiondisplay.cloud; ticker-profile-enrichment)';

const knownWikipediaTitles: Record<string, string> = {
  AAPL: 'Apple Inc.',
  AMZN: 'Amazon (company)',
  MSFT: 'Microsoft',
  MU: 'Micron Technology',
  'MU.US': 'Micron Technology',
  NVDA: 'Nvidia',
  TSM: 'TSMC',
  VRT: 'Vertiv',
  'VRT.US': 'Vertiv',
  'WAWI.OL': 'Wallenius Wilhelmsen',
  '9988.HK': 'Alibaba Group',
  '2454.TW': 'MediaTek',
  '2646.TW': 'Starlux Airlines',
  IREN: 'Iris Energy',
  'IREN.US': 'Iris Energy',
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
  const normalizedSymbol = symbol.toUpperCase();
  const known = knownWikipediaTitles[normalizedSymbol] ?? knownWikipediaTitles[normalizedSymbol.replace(/\.US$/, '')];
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
  const value = preferred?.mainsnak?.datavalue?.value;
  return typeof value === 'string' ? value : null;
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


function firstClaim(entity: WikidataEntityResponse, wikidataId: string, property: string) {
  const claims = entity.entities?.[wikidataId]?.claims?.[property] ?? [];
  const usable = claims.filter((claim) => claim.rank !== 'deprecated' && claim.mainsnak?.datavalue?.value != null);
  return usable.find((claim) => claim.rank === 'preferred') ?? usable[0] ?? null;
}

function claimText(entity: WikidataEntityResponse, wikidataId: string, property: string) {
  const value = firstClaim(entity, wikidataId, property)?.mainsnak?.datavalue?.value;
  return typeof value === 'string' ? value : null;
}

function claimTime(entity: WikidataEntityResponse, wikidataId: string, property: string) {
  const value = firstClaim(entity, wikidataId, property)?.mainsnak?.datavalue?.value;
  if (typeof value === 'object' && value && 'time' in value && typeof value.time === 'string') {
    const match = value.time.match(/([+-]?\d{4})/);
    return match?.[1]?.replace(/^\+/, '') ?? null;
  }
  return null;
}

async function resolveWikidataLabel(entityId: string) {
  const data = await fetchJson<{ entities?: Record<string, { labels?: { en?: { value?: string } } }> }>(
    `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(entityId)}.json`,
  );
  return data?.entities?.[entityId]?.labels?.en?.value ?? null;
}

async function claimEntityLabel(entity: WikidataEntityResponse, wikidataId: string, property: string) {
  const value = firstClaim(entity, wikidataId, property)?.mainsnak?.datavalue?.value;
  if (typeof value === 'object' && value && 'id' in value && typeof value.id === 'string') {
    return resolveWikidataLabel(value.id);
  }
  return null;
}

function protectAbbreviations(text: string) {
  return text
    .replace(/\.com/gi, '§com')
    .replace(/\bU\.S\./g, 'U§S§')
    .replace(/\bU\.K\./g, 'U§K§')
    .replace(/\bU\.A\.E\./g, 'U§A§E§')
    .replace(/\bE\.U\./g, 'E§U§')
    .replace(/\bNo\./g, 'No§')
    .replace(/\bN\.\s*V\./gi, 'N§V§')
    .replace(/\bInc\./g, 'Inc§')
    .replace(/\bLtd\./g, 'Ltd§')
    .replace(/\bCo\./g, 'Co§')
    .replace(/\bCorp\./g, 'Corp§');
}

function restoreAbbreviations(text: string) {
  return text
    .replace(/§com/g, '.com')
    .replace(/U§S§/g, 'U.S.')
    .replace(/U§K§/g, 'U.K.')
    .replace(/U§A§E§/g, 'U.A.E.')
    .replace(/E§U§/g, 'E.U.')
    .replace(/No§/g, 'No.')
    .replace(/N§V§/g, 'N.V.')
    .replace(/Inc§/g, 'Inc.')
    .replace(/Ltd§/g, 'Ltd.')
    .replace(/Co§/g, 'Co.')
    .replace(/Corp§/g, 'Corp.');
}

function compactSummary(extract: string | undefined, fallbackName: string) {
  const protectedText = protectAbbreviations(extract ?? '')
    .replace(/\([^)]*(?:pronounced|IPA|ə|ɪ|ʊ|ˈ|VID|ee)[^)]*\)/gi, '');
  const cleaned = protectedText.replace(/\s+/g, ' ').trim();
  if (!cleaned) return `${fallbackName} profile data is unavailable from Wikipedia right now.`;
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) ?? [cleaned];
  return restoreAbbreviations(sentences.slice(0, 2).join(' ')).replace(/\s+/g, ' ').trim();
}

function domainFromUrl(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  }
}

function upsertFact(facts: TickerProfileFact[], label: string, value: string | null) {
  if (!value) return;
  const existing = facts.find((fact) => fact.label === label);
  if (existing) existing.value = value;
  else facts.push({ label, value });
}

async function fetchWikipediaPage(title: string) {
  const page = await fetchJson<WikipediaPageResponse>(
    `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops|info|extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(title)}&inprop=url&format=json&origin=*`,
  );
  return firstPage(page?.query?.pages);
}


function normalizeIdentityText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function hasKnownWikipediaTitle(symbol: string) {
  const normalizedSymbol = symbol.toUpperCase();
  return Boolean(knownWikipediaTitles[normalizedSymbol] ?? knownWikipediaTitles[normalizedSymbol.replace(/\.US$/, '')]);
}

function isAmbiguousWikipediaProfile(pageTitle: string, extract: string | undefined, companyName: string, trustKnownTitle = false) {
  const title = pageTitle.trim().toLowerCase();
  const cleanedExtract = (extract ?? '').trim().toLowerCase();
  const cleanedCompany = companyName.trim().toLowerCase();
  const identityTitle = normalizeIdentityText(pageTitle);
  const identityCompany = normalizeIdentityText(companyName);
  const meaningfulParts = identityCompany.split(' ').filter((part) => !['corporation', 'corp', 'inc', 'limited', 'ltd', 'company', 'co', 'plc', 'holdings', 'holding', 'group'].includes(part));
  const companyLead = meaningfulParts.slice(0, 2).join(' ');
  const hasMeaningfulIdentityOverlap = meaningfulParts.some((part) => part.length >= 4 && (identityTitle.includes(part) || normalizeIdentityText(cleanedExtract).includes(part)));
  if (cleanedExtract.includes(' may refer to:')) return true;
  if (title.startsWith('list of ')) return true;
  if (title.includes('s&p 500') || title.includes('stock market index')) return true;
  if (cleanedExtract.includes(' is a stock market index ')) return true;
  if (cleanedExtract.includes('comprises') && cleanedExtract.includes('companies traded on')) return true;
  if (cleanedExtract.includes('tracks') && cleanedExtract.includes('stock market index')) return true;
  if (cleanedExtract.includes('hang seng index')) return true;
  if (cleanedExtract.includes('antisemitic treatise')) return true;
  if (cleanedExtract.includes('martin luther') && cleanedExtract.includes('jews')) return true;
  if (title.length <= 4 && !cleanedCompany.startsWith(title)) return true;
  if (!trustKnownTitle && companyLead && !identityTitle.includes(companyLead) && !normalizeIdentityText(cleanedExtract).includes(companyLead) && !hasMeaningfulIdentityOverlap) return true;
  return false;
}

export interface WikipediaCompanyProfileResult {
  profile: TickerCompanyProfile;
  title: string;
  wikidataId: string;
}

export async function fetchWikipediaCompanyProfile(symbol: string, companyName: string, baseFacts: TickerProfileFact[] = []): Promise<WikipediaCompanyProfileResult | null> {
  const title = await resolveWikipediaTitle(symbol, companyName);
  if (!title) return null;

  const page = await fetchWikipediaPage(title);
  if (isAmbiguousWikipediaProfile(page?.title ?? title, page?.extract, companyName, hasKnownWikipediaTitle(symbol))) return null;
  const wikidataId = page?.pageprops?.wikibase_item;
  if (!wikidataId) return null;

  const entity = await fetchJson<WikidataEntityResponse>(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(wikidataId)}.json`);
  if (!entity) return null;

  void baseFacts;
  const facts: TickerProfileFact[] = [];
  const headquarters = await claimEntityLabel(entity, wikidataId, 'P159');
  const website = domainFromUrl(claimText(entity, wikidataId, 'P856'));
  const founded = claimTime(entity, wikidataId, 'P571');

  upsertFact(facts, 'Founded', founded);
  upsertFact(facts, 'Headquarters', headquarters);
  upsertFact(facts, 'Website', website);
  upsertFact(facts, 'Wikidata', wikidataId);

  const asOf = new Date().toISOString();
  return {
    title,
    wikidataId,
    profile: {
      summary: compactSummary(page?.extract, companyName),
      facts,
      source: wikipediaSource(asOf, `Profile summary and company facts resolved from Wikipedia page ${title} and Wikidata entity ${wikidataId}.`),
    },
  };
}
