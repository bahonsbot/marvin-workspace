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
