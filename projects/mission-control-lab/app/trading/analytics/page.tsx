import { MarketTapeClient } from '@/components/pages/trading/MarketTapeClient';
import { MiniLineChart, TabScaffold, TradingPageFrame, tradingCardStyle } from '@/components/pages/trading/shared';
import { getMarketTape } from '@/lib/trading/market-tape';

const valuationSeries = [108, 112, 118, 115, 123, 132, 138, 146, 151, 158, 164, 161, 168, 176];
const benchmarkSeries = [100, 104, 102, 109, 112, 118, 121, 127, 126, 132, 136, 139, 141, 145];
const riskSeries = [64, 58, 61, 54, 49, 46, 51, 44, 41, 38, 36, 34];
const tabs = ['Valuation', 'Performance', 'Fundamentals', 'Income & Events', 'Technical', 'Milou'];

const valuationMethods = [
  { name: 'DCF base case', range: '$148-$184', weight: '40%', note: 'FCF path, WACC, terminal growth' },
  { name: 'Multiples check', range: '$136-$171', weight: '25%', note: 'PE, EV/EBITDA, PS vs history and peers' },
  { name: 'Reverse DCF', range: '$128-$166', weight: '20%', note: 'Growth implied by current market price' },
  { name: 'Quality adjustment', range: '+6%', weight: '15%', note: 'ROIC-WACC spread, balance sheet, cyclicality' },
];

const evidenceItems = [
  ['Revenue trend', '5Y CAGR, quarterly slope, consensus stress'],
  ['Cash conversion', 'Operating cash flow, capex intensity, FCF margin'],
  ['Capital quality', 'ROE, ROIC, WACC, reinvestment runway'],
  ['Market context', 'Relative strength, sector momentum, rate sensitivity'],
];

const milouPrompts = [
  'Challenge the bull case',
  'What assumption moves fair value most?',
  'Explain this DCF simply',
  'Compare this against QQQ/SPY',
];

export default async function TradingAnalyticsPage() {
  const marketTape = await getMarketTape();

  return (
    <TradingPageFrame
      title="Analytics"
      description="Generate a valuation thesis from ticker data, DefeatBeta fundamentals, market context, and Milou’s reasoning layer. Portfolio lens is intentionally left out for now."
    >
      <MarketTapeClient initialData={marketTape} />
      <div className="trading-analytics-workbench">
        <section className="trading-analytics-command" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
          <div>
            <div className="trading-section-label">Analyze a ticker</div>
            <h2>From symbol to fair-value range.</h2>
            <p>
              Validate the company, choose the depth, then generate a valuation pack. DefeatBeta supplies analytical depth; Milou turns the evidence into a clear thesis.
            </p>
          </div>
          <form className="trading-analytics-search" aria-label="Ticker analysis setup">
            <label>
              <span>Ticker</span>
              <input placeholder="ASML.AS, AAPL, TSM…" defaultValue="ASML.AS" />
            </label>
            <label>
              <span>Mode</span>
              <select defaultValue="full">
                <option value="quick">Quick valuation</option>
                <option value="full">Full thesis</option>
              </select>
            </label>
            <button type="button">Generate analysis</button>
          </form>
          <div className="trading-analytics-validation">
            <span>Validated match</span>
            <strong>ASML Holding N.V.</strong>
            <em>Amsterdam · EUR · mapped to DefeatBeta: ASML</em>
          </div>
        </section>

        <TabScaffold tabs={tabs} />

        <section className="trading-analytics-hero" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
          <div className="trading-analytics-verdict">
            <div className="trading-section-label">Valuation verdict</div>
            <h2>$142-$178</h2>
            <p>Base case: <strong>$161</strong> · 12-24 month horizon · confidence medium</p>
            <div className="trading-analytics-verdict-row">
              <span>Current price</span><strong>$149</strong>
              <span>Implied upside</span><strong className="positive">+8.1%</strong>
              <span>Decision zone</span><strong>Watch / Buy weakness</strong>
            </div>
          </div>
          <div className="trading-analytics-chart-panel">
            <div className="trading-ticker-chart-head">
              <div>
                <div className="trading-section-label">Fair value corridor</div>
                <h3>Base case sits above spot, but the margin is assumption-sensitive.</h3>
              </div>
              <div className="trading-ticker-range-tabs" role="tablist" aria-label="Analysis ranges">
                {['Bear', 'Base', 'Bull'].map((range, index) => (
                  <button key={range} type="button" className={index === 1 ? 'active' : ''}>{range}</button>
                ))}
              </div>
            </div>
            <MiniLineChart values={valuationSeries} />
            <div className="trading-ticker-chart-axis"><span>DCF</span><span>Multiples</span><span>Reverse DCF</span><span>Quality</span><span>Blend</span><span>Risk</span><span>Verdict</span></div>
          </div>
        </section>

        <div className="trading-analytics-grid">
          <section style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
            <div className="trading-ticker-head">
              <div>
                <span>Valuation stack</span>
                <h2>Four models, one blended range</h2>
              </div>
              <em>Editable weights later</em>
            </div>
            <dl className="trading-analytics-methods">
              {valuationMethods.map((method) => (
                <div key={method.name}>
                  <dt>{method.name}<span>{method.note}</span></dt>
                  <dd><strong>{method.range}</strong><em>{method.weight}</em></dd>
                </div>
              ))}
            </dl>
          </section>

          <section style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
            <div className="trading-ticker-head">
              <div>
                <span>Market comparison</span>
                <h2>Relative performance</h2>
              </div>
              <em>SPY · QQQ · sector ETF</em>
            </div>
            <MiniLineChart values={benchmarkSeries} />
            <dl className="trading-ticker-chart-stats">
              <div><dt>Vs QQQ</dt><dd className="positive">+4.8%</dd></div>
              <div><dt>Vs SPY</dt><dd className="positive">+7.2%</dd></div>
              <div><dt>Momentum</dt><dd>Constructive</dd></div>
              <div><dt>Trend risk</dt><dd>Medium</dd></div>
            </dl>
          </section>

          <section style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
            <div className="trading-ticker-head">
              <div>
                <span>Evidence map</span>
                <h2>What the model reads</h2>
              </div>
              <em>DefeatBeta + providers</em>
            </div>
            <dl className="trading-profile-facts trading-analytics-evidence">
              {evidenceItems.map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          </section>

          <section style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
            <div className="trading-ticker-head">
              <div>
                <span>Risk sensitivity</span>
                <h2>Assumptions that matter</h2>
              </div>
              <em>Bear/base/bull</em>
            </div>
            <MiniLineChart values={riskSeries} />
            <p className="trading-analytics-note">The final range should always show which variable changed the answer most: WACC, terminal margin, revenue growth, or multiple compression.</p>
          </section>
        </div>

        <section className="trading-analytics-milou" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
          <div className="trading-analytics-milou-copy">
            <div className="trading-section-label">Milou analysis panel</div>
            <h2>Ask the stock expert inside the context of this valuation.</h2>
            <p>
              Milou should receive the selected ticker, valuation assumptions, DefeatBeta summary, benchmark context, and generated thesis. She answers against the evidence, not from a blank chat box.
            </p>
          </div>
          <div className="trading-analytics-chat-panel">
            <div className="trading-analytics-chat-message expert">
              <span>Milou</span>
              <p>Base case looks reasonable, but I would challenge terminal growth and margin durability before calling this cheap.</p>
            </div>
            <div className="trading-analytics-prompt-grid">
              {milouPrompts.map((prompt) => <button key={prompt} type="button">{prompt}</button>)}
            </div>
          </div>
        </section>
      </div>
    </TradingPageFrame>
  );
}
