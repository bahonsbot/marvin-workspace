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
};

export const performanceSeries = [18, 22, 21, 28, 26, 34, 38, 35, 43, 48, 45, 52, 58, 55, 62, 68, 66, 74, 71, 82];

export const healthItems = [
  { label: 'Concentration', value: 'Medium', detail: 'Top 5 holdings carry 55.8% of portfolio weight.' },
  { label: 'Diversification', value: 'Improving', detail: '5 sectors represented, technology remains dominant.' },
  { label: 'Cash buffer', value: '10.1%', detail: 'Enough dry powder for staged entries.' },
  { label: 'Drawdown watch', value: '2 names', detail: 'Review thesis on positions below -30%.' },
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

export const analyticsTabs = ['Performance', 'Attribution', 'Exposure', 'Dividends', 'Charts / Technical'];
export const newsTabs = ['Market News', 'Watchlist News', 'Earnings / Calendar', 'Reports', 'Filings'];
