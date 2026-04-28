export const marketTape = [
  { label: 'S&P 500', value: '5,983.42', change: '+0.42%' },
  { label: 'Nasdaq', value: '19,284.10', change: '+0.68%' },
  { label: 'Dow', value: '42,118.55', change: '-0.12%' },
  { label: 'VIX', value: '14.8', change: '-2.10%' },
  { label: '10Y', value: '4.21%', change: '+0.03' },
  { label: 'Gold', value: '2,386.20', change: '+0.31%' },
  { label: 'Oil', value: '78.44', change: '-0.46%' },
];

export const portfolioSnapshot = {
  value: '€486,134.47',
  dayChange: '-€1,942.18',
  dayChangePct: '-0.40%',
  totalGain: '€34,836.79',
  totalGainPct: '+7.72%',
  cash: '€49,039.05',
  buyingPower: '€122,400.00',
  netLiquidity: '€490,202.15',
  updatedAt: '28 Apr 11:27 ICT',
};

export const performanceSeries = [18, 22, 21, 28, 26, 34, 38, 35, 43, 48, 45, 52, 58, 55, 62, 68, 66, 74, 71, 82];

export const performanceRangeTabs = ['1D', '1W', '1M', 'YTD', '1Y', 'ALL'];

export const performanceAxisLabels = ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'];

export const healthItems = [
  {
    label: 'Concentration',
    summary: 'Top holdings remain prominent but controlled.',
    value: 'Moderate',
    detail: 'Top 5 names carry 55.8% of portfolio weight.',
    tone: 'warning',
    icon: 'concentration',
  },
  {
    label: 'ESG Alignment',
    summary: 'Core holdings pass the current alignment screen.',
    value: 'Good',
    detail: 'No high-friction exclusions in the tracked core.',
    tone: 'good',
    icon: 'alignment',
  },
  {
    label: 'Risk Level',
    summary: 'Drawdown posture is worth watching, not alarming.',
    value: 'Moderate',
    detail: 'Two names need review, no broad stress cluster.',
    tone: 'neutral',
    icon: 'risk',
  },
  {
    label: 'Diversification',
    summary: 'Coverage is improving across core sectors.',
    value: 'Good',
    detail: 'Five sectors represented, technology still leads.',
    tone: 'good',
    icon: 'diversification',
  },
];

export const watchlistRows = [
  { symbol: 'MSFT', name: 'Microsoft', price: '$422.26', change: '-0.56%', thesis: 'AI infrastructure and software durability.' },
  { symbol: 'TSM', name: 'Taiwan Semiconductor', price: '$214.80', change: '+1.24%', thesis: 'Semiconductor backbone, monitor geopolitical risk.' },
  { symbol: 'AMZN', name: 'Amazon', price: '$188.32', change: '+0.18%', thesis: 'Cloud margin recovery and retail operating leverage.' },
  { symbol: 'ADYEN', name: 'Adyen', price: '€1,493.40', change: '-1.02%', thesis: 'Payments quality name, valuation discipline required.' },
];

export const exposureRows = [
  { label: 'Information Technology', value: '33.4%' },
  { label: 'Financial Services', value: '31.6%' },
  { label: 'Consumer Discretionary', value: '18.2%' },
  { label: 'Communication Services', value: '11.7%' },
  { label: 'Consumer Staples', value: '5.1%' },
];

export const newsItems = [
  { title: 'Mega-cap software earnings week ahead', source: 'Market calendar', time: 'Today', tag: 'Earnings' },
  { title: 'Semiconductor supply chain stays firm into next quarter', source: 'Watchlist news', time: '2h ago', tag: 'Watchlist' },
  { title: 'Fed speakers keep rate-cut timing uncertain', source: 'Macro desk', time: '4h ago', tag: 'Macro' },
];

export const pinnedWatchlists = [
  {
    name: 'Core Compounding',
    itemCount: 6,
    rows: [
      { symbol: 'MSFT', name: 'Microsoft', price: '$422.26', change: '-2.37', changePct: '-0.56%', trend: [24, 26, 25, 27, 30, 28, 29, 27] },
      { symbol: 'AMZN', name: 'Amazon', price: '$188.32', change: '+0.34', changePct: '+0.18%', trend: [15, 14, 16, 17, 18, 17, 18, 19] },
      { symbol: 'GOOGL', name: 'Alphabet', price: '$172.88', change: '+1.51', changePct: '+0.88%', trend: [18, 17, 19, 20, 21, 20, 22, 23] },
    ],
  },
  {
    name: 'Tactical Radar',
    itemCount: 4,
    rows: [
      { symbol: 'TSM', name: 'Taiwan Semi', price: '$214.80', change: '+2.63', changePct: '+1.24%', trend: [11, 12, 11, 13, 15, 14, 16, 17] },
      { symbol: 'ASML', name: 'ASML Holding', price: '€918.40', change: '-6.72', changePct: '-0.73%', trend: [23, 22, 21, 20, 21, 20, 19, 18] },
      { symbol: 'ADYEN', name: 'Adyen', price: '€1,493.40', change: '-15.38', changePct: '-1.02%', trend: [28, 26, 25, 24, 23, 24, 22, 21] },
    ],
  },
];

export const topMoverRows = [
  { symbol: 'NVDA', name: 'NVIDIA', price: '$1,102.12', changePct: '+2.44%', volume: '58.4M' },
  { symbol: 'TSLA', name: 'Tesla', price: '$171.20', changePct: '+1.98%', volume: '102.8M' },
  { symbol: 'META', name: 'Meta', price: '$493.78', changePct: '-1.14%', volume: '24.1M' },
  { symbol: 'NFLX', name: 'Netflix', price: '$636.14', changePct: '-0.92%', volume: '6.7M' },
];

export const earningsPreview = [
  { symbol: 'MSFT', when: 'Today · After close', estimate: '$2.81 EPS' },
  { symbol: 'AMZN', when: 'Tomorrow · After close', estimate: '$0.89 EPS' },
  { symbol: 'ADYEN', when: 'Thu · Pre-market', estimate: '€5.42 EPS' },
];

export const newsPreview = [
  { title: 'US yields drift higher as cut timing gets repriced', source: 'Macro desk', time: '45m' },
  { title: 'Cloud spending checks stay resilient into Q2', source: 'Tech earnings wire', time: '1h' },
  { title: 'Chip equipment backlog remains elevated', source: 'Semi tracker', time: '2h' },
];

export const analyticsTabs = ['Performance', 'Attribution', 'Exposure', 'Dividends', 'Charts / Technical'];
export const newsTabs = ['Market News', 'Watchlist News', 'Earnings / Calendar', 'Reports', 'Filings'];

export const tickerPriceSeries = [31, 34, 37, 39, 42, 46, 49, 51, 55, 58, 63, 67, 70, 72, 78, 82, 86, 83, 88, 92, 95, 93, 99, 103];

export const tickerFinancialOverviewSeries = [
  { year: '2018', revenue: 117, netIncome: 30 },
  { year: '2019', revenue: 109, netIncome: 27 },
  { year: '2020', revenue: 166, netIncome: 43 },
  { year: '2021', revenue: 269, netIncome: 97 },
  { year: '2022', revenue: 270, netIncome: 44 },
  { year: '2023', revenue: 609, netIncome: 297 },
  { year: '2024', revenue: 1305, netIncome: 728 },
];

export const tickerDetailSample = {
  symbol: 'NVDA',
  name: 'NVIDIA Corporation',
  exchange: 'NASDAQ',
  price: '$1,037.89',
  change: '+18.62',
  changePct: '+1.83%',
  priceTime: 'At close · May 16, 2025 · 4:00 PM ET',
  headerStats: [
    { label: 'Market Cap', value: '$2.54T' },
    { label: 'P/E (TTM)', value: '58.21' },
    { label: 'Sector', value: 'Technology' },
    { label: 'Industry', value: 'Semiconductors' },
  ],
  tabs: ['Overview', 'Financials', 'News', 'Metrics', 'Estimates', 'Dividends', 'Ownership', 'SEC Filings'],
  priceRanges: ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'MAX'],
  chartAxis: ["May '24", "Jul '24", "Sep '24", "Nov '24", "Jan '25", "Mar '25", "May '25"],
  chartStats: [
    { label: 'Open', value: '1,023.50' },
    { label: 'High', value: '1,044.30' },
    { label: 'Low', value: '1,014.26' },
    { label: 'Prev Close', value: '1,019.27' },
    { label: 'Volume', value: '29.83M' },
    { label: 'Avg Volume (30D)', value: '35.41M' },
    { label: '52 Week Low', value: '384.30' },
    { label: '52 Week High', value: '1,153.13' },
  ],
  profile: {
    summary:
      'NVIDIA designs accelerated computing platforms, graphics processors, networking systems, and software used across gaming, data center, professional visualization, automotive, and AI infrastructure markets.',
    facts: [
      { label: 'Founded', value: '1993' },
      { label: 'Headquarters', value: 'Santa Clara, CA, USA' },
      { label: 'CEO', value: 'Jensen Huang' },
      { label: 'Employees', value: '29,600' },
      { label: 'Website', value: 'nvidia.com' },
      { label: 'Next Earnings', value: 'May 28, 2025 · After Market' },
    ],
  },
  financialHighlights: [
    { label: 'Revenue (TTM)', value: '$60.92B', delta: '+125.9% YoY', tone: 'positive', trend: [12, 13, 15, 18, 22, 31, 41, 57] },
    { label: 'Net Income (TTM)', value: '$33.09B', delta: '+581.3% YoY', tone: 'positive', trend: [3, 4, 4, 7, 11, 18, 25, 34] },
    { label: 'Gross Margin', value: '75.9%', delta: '+5.1 pp YoY', tone: 'positive', trend: [63, 61, 66, 68, 72, 74, 73, 76] },
    { label: 'Operating Margin', value: '62.7%', delta: '+20.4 pp YoY', tone: 'positive', trend: [31, 34, 39, 41, 50, 58, 61, 63] },
    { label: 'EPS (TTM)', value: '$2.66', delta: '+586.5% YoY', tone: 'positive', trend: [0.4, 0.5, 0.7, 1.1, 1.6, 2.1, 2.4, 2.7] },
    { label: 'Free Cash Flow', value: '$27.30B', delta: '+380.6% YoY', tone: 'positive', trend: [4, 5, 7, 10, 15, 20, 24, 27] },
    { label: 'ROE (TTM)', value: '114.3%', delta: '+63.1 pp YoY', tone: 'positive', trend: [38, 41, 47, 58, 69, 82, 99, 114] },
    { label: 'ROIC (TTM)', value: '116.7%', delta: '+59.4 pp YoY', tone: 'positive', trend: [34, 37, 49, 55, 71, 84, 101, 117] },
    { label: 'Debt / Equity', value: '0.10', delta: '-0.05 YoY', tone: 'neutral', trend: [0.21, 0.2, 0.18, 0.16, 0.15, 0.13, 0.11, 0.1] },
  ],
  recentNews: [
    {
      source: "Barron's",
      time: '2h ago',
      title: 'NVIDIA rallies as AI demand fuels record data center growth',
      summary: 'Analysts continue to revise expectations after another strong infrastructure demand cycle.',
    },
    {
      source: 'CNBC',
      time: '5h ago',
      title: 'NVIDIA unveils next-gen Blackwell Ultra chip at Computex 2025',
      summary: 'Management framed the launch as an acceleration point for large-scale model training and inference.',
    },
    {
      source: 'Reuters',
      time: '1d ago',
      title: 'U.S. to allow certain NVIDIA chip sales to UAE in win for AI expansion',
      summary: 'Export policy remains a key watch item as sovereign AI demand grows outside the U.S.',
    },
  ],
  resources: [
    {
      label: 'Financial statements',
      items: [
        { name: 'Annual Reports', meta: 'Company IR', href: '#' },
        { name: 'Quarterly Reports', meta: 'Company IR', href: '#' },
        { name: '10-K Filings', meta: 'SEC EDGAR', href: '#' },
        { name: '10-Q Filings', meta: 'SEC EDGAR', href: '#' },
      ],
    },
    {
      label: 'Investor presentations',
      items: [
        { name: 'Q1 FY2025 Earnings Presentation', meta: 'May 22, 2024', href: '#' },
        { name: 'Q4 FY2024 Earnings Presentation', meta: 'Feb 21, 2024', href: '#' },
        { name: 'GTC 2024 Keynote Presentation', meta: 'Mar 18, 2024', href: '#' },
      ],
    },
  ],
  keyRatios: [
    { label: 'P/E Ratio', value: '58.21' },
    { label: 'Forward P/E', value: '42.31' },
    { label: 'PEG Ratio', value: '0.68' },
    { label: 'Price / Sales', value: '20.35' },
    { label: 'EV / EBITDA', value: '34.54' },
    { label: 'Price / Book', value: '53.27' },
    { label: 'Current Ratio', value: '2.87' },
    { label: 'Quick Ratio', value: '2.28' },
  ],
};
