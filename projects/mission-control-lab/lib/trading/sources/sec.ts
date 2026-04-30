import 'server-only';

import type {
  TickerBalanceSheetSnapshot,
  TickerCashDebtSnapshot,
  TickerDisplayMetric,
  TickerFinancialOverview,
  TickerFinancialHighlight,
  TickerProfile,
  TickerResourceGroup,
  TickerSourceMeta,
} from '../contracts';

interface SecTickerRow {
  cik_str: number;
  ticker: string;
  title: string;
}

interface SecCompanyTickersResponse {
  [key: string]: SecTickerRow;
}

interface SecFactUnit {
  val?: number;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  end?: string;
  frame?: string;
}

interface SecCompanyFactsResponse {
  facts?: {
    'us-gaap'?: Record<string, { units?: Record<string, SecFactUnit[]> }>;
  };
}

interface SecSubmissionsResponse {
  cik?: string;
  name?: string;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
      form?: string[];
      primaryDocument?: string[];
      primaryDocDescription?: string[];
      items?: string[];
    };
  };
}

interface SecAnnualStatements {
  revenue: Record<string, number>;
  netIncome: Record<string, number>;
  assets: Record<string, number>;
  liabilities: Record<string, number>;
  equity: Record<string, number>;
  cash: Record<string, number>;
  currentAssets: Record<string, number>;
  currentLiabilities: Record<string, number>;
  operatingCashFlow: Record<string, number>;
  capex: Record<string, number>;
  debtCurrent: Record<string, number>;
  debtNoncurrent: Record<string, number>;
}

export interface SecTickerFundamentals {
  cik: string;
  companyName: string;
  asOf: string;
  source: TickerSourceMeta;
  financialHighlights: TickerFinancialHighlight[];
  financialOverview: TickerFinancialOverview;
  cashDebtSnapshot: TickerCashDebtSnapshot;
  balanceSheetSnapshot: TickerBalanceSheetSnapshot;
  keyRatios: TickerDisplayMetric[];
  resources: TickerResourceGroup[];
}

const SEC_USER_AGENT = 'MotionDisplay MissionControlLab marvin@motiondisplay.cloud';
const SEC_TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';
const SEC_COMPANY_URL = 'https://www.sec.gov/Archives/edgar/data';

function secSource(asOf: string, note: string): TickerSourceMeta {
  return { source: 'sec', asOf, freshness: 'fresh', note };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': SEC_USER_AGENT,
      },
      next: { revalidate: 86_400 },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function padCik(cik: number | string) {
  return String(cik).padStart(10, '0');
}

async function resolveSecTicker(symbol: string) {
  const data = await fetchJson<SecCompanyTickersResponse>(SEC_TICKERS_URL);
  const row = Object.values(data ?? {}).find((item) => item.ticker?.toUpperCase() === symbol.toUpperCase());
  if (!row) return null;
  return { cik: padCik(row.cik_str), title: row.title };
}

function unitsForTag(facts: SecCompanyFactsResponse, tag: string) {
  return facts.facts?.['us-gaap']?.[tag]?.units ?? {};
}

function usdFacts(facts: SecCompanyFactsResponse, tag: string) {
  const units = unitsForTag(facts, tag);
  return [...(units.USD ?? []), ...(units['USD/shares'] ?? [])].filter((item) => typeof item.val === 'number' && Number.isFinite(item.val));
}

function annualByFiscalYear(facts: SecCompanyFactsResponse, tags: string[], preferInstant = false) {
  const candidates: Array<SecFactUnit & { score: number }> = [];

  tags.forEach((tag, tagIndex) => {
    for (const fact of usdFacts(facts, tag)) {
      if (!fact.fy || typeof fact.val !== 'number') continue;
      if (fact.fp !== 'FY' || fact.form !== '10-K') continue;

      // SEC companyfacts includes comparative facts repeated in later 10-Ks.
      // A fact with fy=2026 but end=2024 is a comparison, not FY2026 data.
      const endYear = fact.end ? Number(fact.end.slice(0, 4)) : null;
      if (endYear && Math.abs(endYear - fact.fy) > 1) continue;

      const hasAnnualFrame = /^CY\d{4}$/.test(fact.frame ?? '');
      const hasYearEndFrame = /^CY\d{4}Q4I$/.test(fact.frame ?? '');
      const frameMatchesKind = preferInstant ? hasYearEndFrame || !fact.frame : hasAnnualFrame || !fact.frame;
      if (!frameMatchesKind) continue;

      const score =
        (fact.frame ? 4 : 0) +
        (endYear === fact.fy ? 3 : 0) +
        (fact.filed ? Date.parse(fact.filed) / 1_000_000_000_000 : 0) -
        tagIndex * 0.01;
      candidates.push({ ...fact, score });
    }
  });

  const byYear = new Map<string, SecFactUnit & { score: number }>();
  for (const candidate of candidates) {
    const year = String(candidate.fy);
    const existing = byYear.get(year);
    if (!existing || candidate.score > existing.score) byYear.set(year, candidate);
  }

  return Object.fromEntries(
    Array.from(byYear.entries())
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([year, fact]) => [year, fact.val as number]),
  );
}

function statementSet(facts: SecCompanyFactsResponse): SecAnnualStatements {
  return {
    revenue: annualByFiscalYear(facts, ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet']),
    netIncome: annualByFiscalYear(facts, ['NetIncomeLoss', 'ProfitLoss']),
    assets: annualByFiscalYear(facts, ['Assets'], true),
    liabilities: annualByFiscalYear(facts, ['Liabilities'], true),
    equity: annualByFiscalYear(facts, ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'], true),
    cash: annualByFiscalYear(facts, ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'], true),
    currentAssets: annualByFiscalYear(facts, ['AssetsCurrent'], true),
    currentLiabilities: annualByFiscalYear(facts, ['LiabilitiesCurrent'], true),
    operatingCashFlow: annualByFiscalYear(facts, ['NetCashProvidedByUsedInOperatingActivities']),
    capex: annualByFiscalYear(facts, ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets']),
    debtCurrent: annualByFiscalYear(facts, ['LongTermDebtCurrent', 'ShortTermBorrowings'], true),
    debtNoncurrent: annualByFiscalYear(facts, ['LongTermDebtNoncurrent', 'LongTermDebtAndFinanceLeaseObligationsNoncurrent'], true),
  };
}

function intersectYears(...maps: Array<Record<string, number>>) {
  const years = new Set(Object.keys(maps[0] ?? {}));
  for (const map of maps.slice(1)) {
    for (const year of Array.from(years)) {
      if (map[year] == null) years.delete(year);
    }
  }
  return Array.from(years).sort().slice(-4);
}

function formatBillions(raw: number | null | undefined) {
  if (raw == null || Number.isNaN(raw)) return '$—';
  const value = raw / 1_000_000_000;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  return `${sign}$${abs >= 100 ? abs.toFixed(0) : abs.toFixed(1)}B`;
}

function formatRatio(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}x`;
}

function percentDelta(current: number, previous: number) {
  if (!previous) return '—';
  const value = ((current - previous) / Math.abs(previous)) * 100;
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}% YoY`;
}

function toneFromDelta(current: number, previous: number): 'positive' | 'negative' | 'neutral' {
  if (current > previous) return 'positive';
  if (current < previous) return 'negative';
  return 'neutral';
}

function trendForYears(years: string[], values: Record<string, number>) {
  return years.map((year) => Number((values[year] / 1_000_000_000).toFixed(1)));
}

function buildFinancialHighlights(statements: SecAnnualStatements, source: TickerSourceMeta): TickerFinancialHighlight[] {
  const years = intersectYears(statements.revenue, statements.netIncome).slice(-4);
  const last = years.at(-1);
  const previous = years.at(-2);
  if (!last || !previous) return [];

  const latestOcf = statements.operatingCashFlow[last];
  const previousOcf = statements.operatingCashFlow[previous];
  const latestCapex = statements.capex[last] ?? 0;
  const previousCapex = statements.capex[previous] ?? 0;
  const fcf = latestOcf != null ? latestOcf - Math.abs(latestCapex) : null;
  const prevFcf = previousOcf != null ? previousOcf - Math.abs(previousCapex) : null;

  const highlights: TickerFinancialHighlight[] = [
    {
      label: 'Revenue',
      value: formatBillions(statements.revenue[last]),
      delta: percentDelta(statements.revenue[last], statements.revenue[previous]),
      tone: toneFromDelta(statements.revenue[last], statements.revenue[previous]),
      trend: trendForYears(years, statements.revenue),
      source,
      status: 'available',
    },
    {
      label: 'Net Income',
      value: formatBillions(statements.netIncome[last]),
      delta: percentDelta(statements.netIncome[last], statements.netIncome[previous]),
      tone: toneFromDelta(statements.netIncome[last], statements.netIncome[previous]),
      trend: trendForYears(years, statements.netIncome),
      source,
      status: 'available',
    },
  ];

  if (fcf != null && prevFcf != null) {
    highlights.push({
      label: 'Free Cash Flow',
      value: formatBillions(fcf),
      delta: percentDelta(fcf, prevFcf),
      tone: toneFromDelta(fcf, prevFcf),
      trend: years.map((year) => Number(((statements.operatingCashFlow[year] ?? 0) - Math.abs(statements.capex[year] ?? 0)) / 1_000_000_000).toFixed(1)).map(Number),
      source,
      status: 'available',
    });
  }

  return highlights;
}

function buildFinancialOverview(statements: SecAnnualStatements): TickerFinancialOverview {
  const bars = intersectYears(statements.revenue, statements.netIncome).map((year) => ({
    year,
    revenue: Number((statements.revenue[year] / 1_000_000_000).toFixed(1)),
    netIncome: Number((statements.netIncome[year] / 1_000_000_000).toFixed(1)),
  }));

  return {
    bars,
    status: bars.length >= 3 ? 'available' : bars.length > 0 ? 'partial' : 'unavailable',
    note: bars.length >= 3 ? 'SEC annual 10-K XBRL facts.' : 'Revenue/net income trend requires at least three annual SEC facts.',
  };
}

function buildCashDebtSnapshot(statements: SecAnnualStatements, source: TickerSourceMeta): TickerCashDebtSnapshot | null {
  const years = intersectYears(statements.cash).sort();
  const latestYear = years.at(-1);
  if (!latestYear) return null;
  const cash = statements.cash[latestYear] ?? 0;
  const debt = (statements.debtCurrent[latestYear] ?? 0) + (statements.debtNoncurrent[latestYear] ?? 0);
  const ocf = statements.operatingCashFlow[latestYear] ?? latestValueFromRecord(statements.operatingCashFlow);
  const capex = statements.capex[latestYear] ?? 0;
  const fcf = ocf != null ? ocf - Math.abs(capex) : null;
  const total = Math.max(cash + debt, 1);
  const netCash = cash - debt;
  const netCashPositive = netCash >= 0;

  return {
    period: `${latestYear} FY · SEC companyfacts`,
    currency: 'USD',
    cashPercent: Math.round((cash / total) * 100),
    debtPercent: Math.round((debt / total) * 100),
    totalCash: formatBillions(cash),
    totalDebt: formatBillions(debt),
    netCash: formatBillions(Math.abs(netCash)),
    netCashLabel: netCashPositive ? 'Net Cash' : 'Net Debt',
    freeCashFlow: formatBillions(fcf),
    operatingCashFlow: formatBillions(ocf),
    interpretation: netCashPositive ? 'Net cash position' : 'Debt exceeds cash; watch leverage and refinancing risk',
    source,
  };
}

function latestValueFromRecord(values: Record<string, number>) {
  const year = Object.keys(values).sort().at(-1);
  return year ? values[year] : null;
}

function buildBalanceSheetSnapshot(statements: SecAnnualStatements, source: TickerSourceMeta): TickerBalanceSheetSnapshot | null {
  const years = intersectYears(statements.assets, statements.equity, statements.cash).slice(-4);
  if (years.length < 2) return null;

  const annual = years.map((year) => {
    const assets = statements.assets[year];
    const liabilities = statements.liabilities[year] ?? Math.max(assets - statements.equity[year], 0);
    return {
      fiscalYear: year,
      totalAssets: Number((assets / 1_000_000_000).toFixed(1)),
      totalLiabilities: Number((liabilities / 1_000_000_000).toFixed(1)),
      shareholderEquity: Number((statements.equity[year] / 1_000_000_000).toFixed(1)),
      cashAndEquivalents: Number((statements.cash[year] / 1_000_000_000).toFixed(1)),
      totalDebt: Number(((statements.debtCurrent[year] ?? 0) + (statements.debtNoncurrent[year] ?? 0)) / 1_000_000_000),
    };
  });

  const latestYear = years.at(-1)!;
  const latestAssets = statements.assets[latestYear];
  const latestLiabilities = statements.liabilities[latestYear] ?? Math.max(latestAssets - statements.equity[latestYear], 0);
  const latestEquity = statements.equity[latestYear];
  const latestDebt = (statements.debtCurrent[latestYear] ?? 0) + (statements.debtNoncurrent[latestYear] ?? 0);
  const latestCash = statements.cash[latestYear];
  const currentRatio = statements.currentAssets[latestYear] && statements.currentLiabilities[latestYear]
    ? statements.currentAssets[latestYear] / statements.currentLiabilities[latestYear]
    : null;
  const debtEquity = latestEquity ? latestDebt / latestEquity : null;
  const netDebt = latestDebt - latestCash;

  return {
    period: `${years[0]} — ${latestYear} · SEC annual`,
    currency: 'USD',
    kpis: [
      {
        label: 'Debt / Equity',
        value: formatRatio(debtEquity),
        caption: debtEquity == null ? 'SEC debt or equity fact unavailable' : debtEquity < 0.5 ? 'Conservative leverage' : debtEquity < 1.5 ? 'Moderate leverage' : 'Levered capital stack',
        tone: debtEquity == null ? 'neutral' : debtEquity < 1.5 ? 'positive' : 'negative',
      },
      {
        label: 'Current Ratio',
        value: formatRatio(currentRatio),
        caption: currentRatio == null ? 'Current assets/liabilities not reported consistently' : currentRatio >= 1 ? 'Can cover short-term bills' : 'Tight short-term liquidity',
        tone: currentRatio == null ? 'neutral' : currentRatio >= 1 ? 'positive' : 'negative',
      },
      {
        label: netDebt <= 0 ? 'Net Cash' : 'Net Debt',
        value: formatBillions(Math.abs(netDebt)),
        caption: netDebt <= 0 ? 'Cash exceeds total debt' : 'Debt exceeds cash on hand',
        tone: netDebt <= 0 ? 'positive' : 'neutral',
      },
    ],
    annual,
    note: `SEC companyfacts mapped from 10-K XBRL concepts. Latest assets ${formatBillions(latestAssets)}, liabilities ${formatBillions(latestLiabilities)}, equity ${formatBillions(latestEquity)}.`,
    source,
  };
}

function buildKeyRatios(profile: TickerProfile | null, snapshot: TickerBalanceSheetSnapshot | null, source: TickerSourceMeta) {
  const replacements = snapshot ? new Map(snapshot.kpis.map((item) => [item.label, item.value])) : new Map<string, string>();
  const ratios = profile?.keyRatios ?? [
    { label: 'P/E Ratio', value: 'Unavailable' },
    { label: 'Forward P/E', value: 'Unavailable' },
    { label: 'PEG Ratio', value: 'Unavailable' },
    { label: 'Price / Sales', value: 'Unavailable' },
    { label: 'EV / EBITDA', value: 'Unavailable' },
    { label: 'Price / Book', value: 'Unavailable' },
    { label: 'Current Ratio', value: 'Unavailable' },
    { label: 'Debt / Equity', value: 'Unavailable' },
  ];
  return ratios.map((ratio) => {
    if (ratio.label === 'Current Ratio' && replacements.has('Current Ratio')) {
      return { ...ratio, value: replacements.get('Current Ratio')!, status: 'available' as const, source };
    }
    if ((ratio.label === 'Debt / Equity' || ratio.label === 'Debt / Equity Ratio') && replacements.has('Debt / Equity')) {
      return { ...ratio, value: replacements.get('Debt / Equity')!, status: 'available' as const, source };
    }
    return {
      ...ratio,
      value: 'Unavailable',
      status: 'unavailable' as const,
      note: 'Awaiting richer fundamentals/valuation provider such as FMP.',
    };
  });
}

function filingUrl(cik: string, accession: string, primaryDocument: string) {
  const compactCik = String(Number(cik));
  const compactAccession = accession.replace(/-/g, '');
  return `${SEC_COMPANY_URL}/${compactCik}/${compactAccession}/${primaryDocument}`;
}

function formatFilingDate(value: string | undefined) {
  if (!value) return 'SEC filing';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

function filingKind(form: string, items = ''): 'annual' | 'quarterly' | 'current' | 'event' {
  if (form === '10-K') return 'annual';
  if (form === '10-Q') return 'quarterly';
  if (items.split(',').map((item) => item.trim()).includes('2.02')) return 'event';
  return 'current';
}

function filingTitle(form: string, reportDate: string | undefined, items = '') {
  if (form === '10-K') return reportDate ? `Annual report · FY ${reportDate.slice(0, 4)}` : 'Annual report';
  if (form === '10-Q') return reportDate ? `Quarterly report · ${reportDate.slice(0, 7)}` : 'Quarterly report';
  const itemSet = new Set(items.split(',').map((item) => item.trim()).filter(Boolean));
  if (itemSet.has('2.02')) return 'Earnings release / results 8-K';
  if (itemSet.has('5.07')) return 'Shareholder vote 8-K';
  if (itemSet.has('5.02')) return 'Leadership / governance 8-K';
  if (itemSet.has('7.01')) return 'Investor update 8-K';
  if (itemSet.has('1.01')) return 'Material agreement 8-K';
  if (itemSet.has('8.01')) return 'Other material event 8-K';
  return 'Current report 8-K';
}

function filingMeta(form: string, filed: string | undefined, reportDate: string | undefined, items = '', description = '') {
  const parts = [`${form} filed ${formatFilingDate(filed)}`];
  if (reportDate && reportDate !== filed) parts.push(`period ${formatFilingDate(reportDate)}`);
  if (items) parts.push(`items ${items}`);
  if (description && description !== form && description !== `FORM ${form}`) parts.push(description);
  return parts.join(' · ');
}

function filingItems(items = '') {
  return new Set(items.split(',').map((part) => part.trim()).filter(Boolean));
}

function selectFilings<T extends { form: string; items?: string; filed?: string }>(items: T[]) {
  const byNewest = [...items].sort((a, b) => (b.filed ?? '').localeCompare(a.filed ?? ''));
  const selected: T[] = [];
  const seen = new Set<T>();
  const add = (item: T | undefined) => {
    if (!item || seen.has(item)) return;
    seen.add(item);
    selected.push(item);
  };

  add(byNewest.find((item) => item.form === '10-K'));
  byNewest.filter((item) => item.form === '10-Q').slice(0, 3).forEach(add);
  byNewest.filter((item) => filingItems(item.items).has('2.02')).slice(0, 3).forEach(add);
  byNewest.filter((item) => item.form === '8-K' && !filingItems(item.items).has('2.02')).slice(0, 2).forEach(add);

  return selected.slice(0, 8).sort((a, b) => (b.filed ?? '').localeCompare(a.filed ?? ''));
}

function buildResources(profile: TickerProfile | null, cik: string, submissions: SecSubmissionsResponse | null, source: TickerSourceMeta): TickerResourceGroup[] {
  const recent = submissions?.filings?.recent;
  const forms = recent?.form ?? [];
  const filings = forms
    .map((form, index) => ({
      form,
      filed: recent?.filingDate?.[index] ?? recent?.reportDate?.[index] ?? 'SEC filing',
      reportDate: recent?.reportDate?.[index],
      accession: recent?.accessionNumber?.[index],
      primaryDocument: recent?.primaryDocument?.[index],
      description: recent?.primaryDocDescription?.[index] ?? '',
      items: recent?.items?.[index] ?? '',
    }))
    .filter((item) => ['10-K', '10-Q', '8-K'].includes(item.form) && item.accession && item.primaryDocument);

  const selected = selectFilings(filings);
  if (selected.length === 0) return profile?.resources ?? [];

  const secGroup: TickerResourceGroup = {
    label: 'SEC filings',
    items: selected.map((item) => ({
      name: filingTitle(item.form, item.reportDate, item.items),
      meta: filingMeta(item.form, item.filed, item.reportDate, item.items, item.description),
      href: filingUrl(cik, item.accession!, item.primaryDocument!),
      source,
      kind: filingKind(item.form, item.items),
      form: item.form,
      filedAt: item.filed,
      reportDate: item.reportDate,
      accession: item.accession,
      document: item.primaryDocument,
    })),
  };

  return [secGroup];
}

export async function fetchSecTickerFundamentals(symbol: string, baseProfile: TickerProfile | null): Promise<SecTickerFundamentals | null> {
  const resolved = await resolveSecTicker(symbol);
  if (!resolved) return null;

  const [facts, submissions] = await Promise.all([
    fetchJson<SecCompanyFactsResponse>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${resolved.cik}.json`),
    fetchJson<SecSubmissionsResponse>(`https://data.sec.gov/submissions/CIK${resolved.cik}.json`),
  ]);
  if (!facts?.facts?.['us-gaap']) return null;

  const asOf = new Date().toISOString();
  const source = secSource(asOf, `SEC EDGAR companyfacts/submissions for CIK ${resolved.cik}.`);
  const statements = statementSet(facts);
  const financialHighlights = buildFinancialHighlights(statements, source);
  const financialOverview = buildFinancialOverview(statements);
  const cashDebtSnapshot = buildCashDebtSnapshot(statements, source);
  const balanceSheetSnapshot = buildBalanceSheetSnapshot(statements, source);

  if (!cashDebtSnapshot && !balanceSheetSnapshot && financialOverview.bars.length === 0) return null;
  if (!baseProfile && (!cashDebtSnapshot || !balanceSheetSnapshot)) return null;

  return {
    cik: resolved.cik,
    companyName: submissions?.name ?? resolved.title,
    asOf,
    source,
    financialHighlights: financialHighlights.length ? financialHighlights : baseProfile?.financialHighlights ?? [],
    financialOverview: financialOverview.bars.length ? financialOverview : baseProfile?.financialOverview ?? { bars: [], status: 'unavailable', note: 'SEC returned no revenue/net income bars.' },
    cashDebtSnapshot: cashDebtSnapshot ?? baseProfile!.cashDebtSnapshot,
    balanceSheetSnapshot: balanceSheetSnapshot ?? baseProfile!.balanceSheetSnapshot,
    keyRatios: buildKeyRatios(baseProfile, balanceSheetSnapshot, source),
    resources: buildResources(baseProfile, resolved.cik, submissions, source),
  };
}
