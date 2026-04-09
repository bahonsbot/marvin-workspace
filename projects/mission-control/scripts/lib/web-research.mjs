import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_PAGE_EXCERPTS = 4;
const USER_AGENT = 'Mozilla/5.0 (compatible; MissionControlAutonomousResearch/1.0; +https://docs.openclaw.ai)';
const DEFAULT_SEARXNG_BASE_URL = 'http://72.60.232.55:32768';

function htmlDecode(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/')
    .replace(/&#47;/g, '/');
}

function stripHtml(value) {
  return htmlDecode(String(value || ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanQuery(value, maxLength = 220) {
  return String(value || '')
    .replace(/[#*_`>\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function dedupe(items) {
  return [...new Set(items.filter(Boolean))];
}

function normalizeUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (value.startsWith('//')) return `https:${value}`;
  return value;
}

function decodeDuckDuckGoTarget(rawHref) {
  const normalized = normalizeUrl(rawHref);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    const direct = url.searchParams.get('uddg');
    return direct ? decodeURIComponent(direct) : normalized;
  } catch {
    return normalized;
  }
}

function resolveSearxngBaseUrl(env = process.env) {
  const raw = String(env.MISSION_CONTROL_SEARXNG_BASE_URL || DEFAULT_SEARXNG_BASE_URL).trim();
  return raw.replace(/\/+$/, '');
}

async function fetchText(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export function resolveWebResearchProvider(env = process.env) {
  if (String(env.MISSION_CONTROL_WEB_RESEARCH_ENABLED || '') !== '1') return null;
  const explicit = String(env.MISSION_CONTROL_SEARCH_PROVIDER || '').trim().toLowerCase();
  if (!explicit) return 'duckduckgo-html';
  if (['duckduckgo-html', 'ddg-html'].includes(explicit)) return 'duckduckgo-html';
  if (['searxng', 'searx'].includes(explicit)) return 'searxng';
  return explicit;
}

export function webResearchCapabilityConfigured(env = process.env) {
  return Boolean(resolveWebResearchProvider(env));
}

export function buildResearchQueries(task) {
  const title = cleanQuery(task?.title, 180);
  const description = cleanQuery(task?.description, 260);
  const agentTarget = cleanQuery(task?.agentTarget, 120);
  const queries = dedupe([
    title,
    title && description ? `${title} ${description}` : '',
    title && agentTarget ? `${title} ${agentTarget}` : '',
  ]).filter(Boolean);
  return queries.slice(0, 3);
}

export async function searchDuckDuckGoHtml(query, options = {}) {
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchText(url, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const blocks = html.split('<div class="result results_links').slice(1);
  const results = [];

  for (const block of blocks) {
    const linkMatch = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i) || block.match(/<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);
    const title = stripHtml(linkMatch[2]);
    const href = decodeDuckDuckGoTarget(linkMatch[1]);
    const snippet = stripHtml(snippetMatch?.[1] || '');
    if (!title || !href) continue;
    results.push({ title, url: href, snippet });
    if (results.length >= maxResults) break;
  }

  return results;
}

export async function searchSearxng(query, options = {}) {
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
  const baseUrl = resolveSearxngBaseUrl(options.env ?? process.env);
  const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json`;
  const payload = await fetchJson(url, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const rawResults = Array.isArray(payload?.results) ? payload.results : [];
  return rawResults
    .map((entry) => ({
      title: stripHtml(entry?.title || ''),
      url: normalizeUrl(entry?.url || ''),
      snippet: stripHtml(entry?.content || entry?.snippet || ''),
    }))
    .filter((entry) => entry.title && entry.url)
    .slice(0, maxResults);
}

async function fetchPageExcerpt(url) {
  try {
    const html = await fetchText(url, DEFAULT_TIMEOUT_MS);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const text = stripHtml(html).slice(0, 2200);
    return {
      ok: true,
      title: stripHtml(titleMatch?.[1] || ''),
      excerpt: text,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown fetch error',
    };
  }
}

export async function runWebResearch(task, options = {}) {
  const provider = resolveWebResearchProvider(options.env ?? process.env);
  if (!provider) {
    throw new Error('Web research is not enabled for Mission Control autonomous tasks.');
  }

  const queries = buildResearchQueries(task);
  if (queries.length === 0) {
    throw new Error('No usable web research query could be derived from the task.');
  }

  const searchFn = provider === 'duckduckgo-html'
    ? searchDuckDuckGoHtml
    : provider === 'searxng'
      ? searchSearxng
      : null;

  if (!searchFn) {
    throw new Error(`Unsupported Mission Control search provider: ${provider}`);
  }

  const queryResults = [];
  const uniqueUrls = [];
  const urlSet = new Set();

  for (const query of queries) {
    const results = await searchFn(query, {
      maxResults: options.maxResults ?? DEFAULT_MAX_RESULTS,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      env: options.env ?? process.env,
    });
    queryResults.push({ query, results });
    for (const result of results) {
      if (!urlSet.has(result.url)) {
        urlSet.add(result.url);
        uniqueUrls.push(result.url);
      }
    }
  }

  const pageExcerpts = [];
  for (const url of uniqueUrls.slice(0, options.maxPageExcerpts ?? DEFAULT_PAGE_EXCERPTS)) {
    const excerpt = await fetchPageExcerpt(url);
    pageExcerpts.push({ url, ...excerpt });
  }

  return {
    provider,
    generatedAt: new Date().toISOString(),
    queries: queryResults,
    pageExcerpts,
  };
}

export function renderResearchMarkdown(task, packet) {
  const lines = [
    `# Autonomous web research packet: ${task.title}`,
    '',
    `Generated: ${packet.generatedAt}`,
    `Provider: ${packet.provider}`,
    '',
    '## Search queries and results',
    '',
  ];

  for (const queryEntry of packet.queries) {
    lines.push(`### Query: ${queryEntry.query}`);
    lines.push('');
    if (!queryEntry.results.length) {
      lines.push('- No results returned');
      lines.push('');
      continue;
    }
    queryEntry.results.forEach((result, index) => {
      lines.push(`${index + 1}. [${result.title}](${result.url})`);
      if (result.snippet) lines.push(`   - ${result.snippet}`);
    });
    lines.push('');
  }

  if (packet.pageExcerpts.length > 0) {
    lines.push('## Page excerpts');
    lines.push('');
    packet.pageExcerpts.forEach((entry) => {
      lines.push(`### ${entry.title || entry.url}`);
      lines.push(entry.url);
      lines.push('');
      if (entry.ok) {
        lines.push(entry.excerpt || '_No excerpt available._');
      } else {
        lines.push(`_Fetch failed: ${entry.error}_`);
      }
      lines.push('');
    });
  }

  return lines.join('\n');
}

export async function writeResearchPacketArtifact(workspaceRoot, relativePath, markdown) {
  const absolutePath = join(workspaceRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, markdown, 'utf8');
  return absolutePath;
}
