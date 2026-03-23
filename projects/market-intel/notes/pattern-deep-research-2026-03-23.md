# Market Intel Pattern Deep Research — Stage 2

Date: 2026-03-23

## Goal
Propose the next batch of high-utility patterns to add to Market Intel after the Stage 1 audit. Focus is not maximum pattern count, but maximum practical lift for the current feed stack.

## Summary recommendation
Add **12** patterns in the next wave, with an implementation order of:
- **Tier 1 (add first): 8 patterns**
- **Tier 2 (add if capacity allows): 4 patterns**

Why 12?
- enough to materially expand coverage
- small enough to avoid taxonomy sprawl
- fits the Stage 1 conclusion that the current constraint is specificity and mapping quality, not just raw count

## Selection criteria
A pattern was favored when it met most of these:
1. strong overlap with current feed mix (oil, war, tariffs, shipping, semis, macro, consumer, China)
2. clear market transmission path
3. historically specific enough to avoid becoming a vague umbrella
4. not already well covered by an existing pattern
5. likely to improve signal interpretation rather than just add trivia

---

## Tier 1 — add first

### 1) Red Sea Shipping Disruption 2024
**Proposed category:** geopolitical or macroeconomic
**Why add:** This is one of the cleanest missing analogies for the current feed stack. Your intake already sees war, shipping, rerouting, freight costs, and inflation spillovers. Existing oil-war patterns do not fully capture freight-route disruption.
**What it captures:** attacks on shipping, rerouting around the Cape, longer delivery times, freight spikes, supply-chain inflation, spillover into trade-sensitive sectors
**Early signals to match:** Red Sea attacks, Houthi attacks, Bab el-Mandeb, rerouting, shipping insurance spikes, Suez traffic decline, freight surge
**Why it matters now:** UNCTAD says the 2024 Red Sea crisis drove freight-rate surges and rerouting, with ongoing concern about spillovers into the Strait of Hormuz.
**Evidence anchors:**
- UNCTAD, Sept 2025: disruptions such as the 2024 Red Sea crisis drove freight-rate surges; geopolitical tensions keep spillover risk alive
- Atlas Institute / UNCTAD secondary confirmation of delivery-time and transport-cost effects

### 2) Ever Given / Suez Canal Blockage 2021
**Proposed category:** macroeconomic
**Why add:** Distinct from Red Sea military disruption. This is the archetype for single-point chokepoint blockage and immediate logistics bottlenecks.
**What it captures:** canal obstruction, backlog shock, delayed inventories, container chain disruptions, time-cost effects
**Early signals:** Suez blockage, canal shutdown, grounded vessel, backlog, queues, delayed transits
**Why it matters now:** useful whenever maritime chokepoints or one-off transport accidents dominate headlines
**Evidence anchors:**
- port economics source: about $9B/day in trade delayed during blockage
- academic / trade literature consistently frames it as a global-trade chokepoint shock

### 3) U.S. Debt Ceiling X-Date Stress 2011/2023
**Proposed category:** political or macroeconomic
**Why add:** You already have `US Credit Rating Downgrade`, but that label is too broad. Debt-ceiling brinkmanship is a cleaner pattern with specific triggers and market behavior.
**What it captures:** X-date countdown, front-end Treasury bill stress, CDS widening, policy brinkmanship, temporary funding distortions, risk-off moves
**Early signals:** X-date, debt ceiling, Treasury cash balance, T-bill stress, default risk, CDS, extraordinary measures
**Why it matters now:** current macro/news feeds frequently surface debt-ceiling and Washington funding stress
**Evidence anchors:**
- FactSet and CME analyses explicitly compare current debt-ceiling stress to 2011
- PIIE notes 2023 raised borrowing costs, especially around X-date maturities

### 4) March 2020 Treasury “Dash for Cash” / Basis Unwind
**Proposed category:** financial_credit
**Why add:** This is a missing high-value pattern for funding stress, Treasury illiquidity, hedge-fund unwind, and repo-market strain. Your current library has bank stress but not this specific sovereign-market plumbing pattern.
**What it captures:** Treasury market dysfunction, basis-trade unwind, repo/funding stress, dealer balance-sheet constraints, forced selling in “safe” assets
**Early signals:** Treasury liquidity strain, basis widening, repo stress, dash for cash, funding dislocation, forced unwind
**Why it matters now:** excellent for interpreting sudden Treasury volatility, funding scares, or “safe haven not acting safe” episodes
**Evidence anchors:**
- NY Fed 2025 remarks contrast current conditions with March 2020, when basis jumped around 100 bps and unwinds worsened dislocation
- OFR / Treasury / Brookings all treat March 2020 as a core market-structure stress case

### 5) AI Packaging Bottleneck / CoWoS Constraint 2024-2025
**Proposed category:** corporate or macroeconomic
**Why add:** Existing semis/social patterns are too retail-thread flavored. This pattern would better fit the real industrial bottleneck currently showing up in AI hardware, foundry capacity, and capex headlines.
**What it captures:** advanced packaging constraints, delayed AI server rollouts, supplier bottlenecks, second-order winners/losers across semis supply chain
**Early signals:** CoWoS, advanced packaging, TSMC capacity, Blackwell delays, packaging bottleneck, AI server backlog
**Why it matters now:** directly aligned with modern AI infrastructure headlines, unlike the current `Reddit GPU/Semis Thread` label
**Evidence anchors:**
- Reuters Jan 2025: Nvidia packaging needs shifting; CoWoS remains a critical supply-chain topic
- multiple industry trackers point to packaging capacity as a binding AI volume constraint

### 6) AI Memory / HBM Shortage 2024-2025
**Proposed category:** corporate or macroeconomic
**Why add:** Packaging is one bottleneck; memory is another. This deserves its own pattern because it hits different names, margins, and capex dynamics.
**What it captures:** HBM scarcity, DRAM price spikes, AI infrastructure rationing, hyperscaler pre-buying, delayed buildouts
**Early signals:** HBM shortage, DRAM spike, SK Hynix, Samsung server memory, open-ended orders, memory crunch
**Why it matters now:** useful for reading semiconductor and AI-infra stories that are not about end-demand, but about constrained supply economics
**Evidence anchors:**
- Reuters Dec 2025: AI frenzy driving a memory-chip supply crisis; shortage could delay future data-center projects
- secondary summaries cite large year-over-year server-memory price increases

### 7) China Critical Minerals Export Controls 2023-
**Proposed category:** geopolitical or corporate
**Why add:** This is a cleaner semis/geopolitics pattern than broad Taiwan tension for certain headlines. It handles the materials choke-point side of the chip war.
**What it captures:** gallium/germanium/antimony restrictions, export licensing, semiconductor materials squeeze, trade retaliation
**Early signals:** gallium, germanium, antimony, export controls, licensing, chip materials, retaliatory trade move
**Why it matters now:** your feeds already pull tariffs, China policy, and semiconductor conflict. This gives a specific pattern with direct supply-chain relevance.
**Evidence anchors:**
- Reuters July/Aug 2023: China imposed export controls on gallium and germanium used in semiconductors
- USITC noted major price increases following the controls

### 8) Consumer Trade-Down / Retail Margin Shock 2022
**Proposed category:** macroeconomic or corporate
**Why add:** Existing patterns do not cleanly capture the “consumer still spending, but rotating to essentials and crushing discretionary margins” regime.
**What it captures:** Walmart/Target-style warnings, inventory mismatches, margin hits, discretionary slowdown before full recession confirmation
**Early signals:** trade-down, essentials over discretionary, margin compression, consumer pullback, retail warning, inventory glut
**Why it matters now:** very useful for interpreting U.S. consumer-health headlines without over-jumping to full crisis templates
**Evidence anchors:**
- Reuters May and July 2022: investors were jolted by retailer results showing consumers reducing discretionary purchases, with discretionary stocks hit hard

---

## Tier 2 — add if capacity allows

### 9) OPEC+ Surprise Production Cut / Supply Rebalancing 2020-2023
**Proposed category:** macroeconomic or geopolitical
**Why add:** Distinct from the existing Saudi attack pattern because this is policy-driven supply engineering, not physical disruption.
**What it captures:** coordinated production cuts, inventory tightening, oil-price floors, inflation spillovers
**Early signals:** OPEC+ cut, surprise cut, inventory draw, production target, Saudi/Russia support prices
**Evidence anchors:**
- EIA: initial 9.7 mb/d cut from May 2020, largest on record at the time
- Columbia CGEP: 2022/2023 cuts supported oil prices and reduced stock-build risk

### 10) China Property Stimulus Head-Fake / Rescue Rally
**Proposed category:** macroeconomic
**Why add:** You already have Evergrande, but not the later phase where easing temporarily stabilizes prices or risk appetite without fully solving the property slump.
**What it captures:** policy easing, temporary stabilization, commodity bounce, China-risk rally, then renewed weakness
**Early signals:** mortgage easing, property rescue package, home-price stabilization, local-government support, faded rebound
**Evidence anchors:**
- Reuters Jan 2025: home prices stabilized after multiple rounds of stimulus
- broader China property data shows repeated temporary stabilization without a full durable bottom

### 11) LME Nickel Short Squeeze 2022
**Proposed category:** financial_credit or macroeconomic
**Why add:** Strong pattern for commodities position squeezes, exchange dysfunction, forced short covering, and market-structure breaks.
**What it captures:** extreme commodity short squeeze, exchange halts, trade cancellation, industrial-user stress
**Early signals:** nickel squeeze, exchange halt, trade cancellation, price gap, physical shortage plus speculative positioning
**Evidence anchors:**
- LME independent review: events in nickel were a short squeeze
- S&P Global: price spike above $100,000/t triggered major trading disruption

### 12) Credit Suisse AT1 Wipeout 2023
**Proposed category:** financial_credit
**Why add:** You have SVB and regional banks, but not the specific subordinated-capital / bondholder hierarchy shock that matters for bank funding and euro credit markets.
**What it captures:** AT1 write-downs, capital-structure shock, subordinated-bank-bond repricing, contagion to bank credit
**Early signals:** AT1, CoCo bonds, subordinated debt, write-down, hierarchy shock, Swiss regulator, capital stack panic
**Evidence anchors:**
- Reuters Mar/Dec 2023: $17B of AT1 wiped out, shocking credit markets and later defining a recovery narrative

---

## What not to add yet
Avoid adding more of these before matcher refinement:
- more meme / social chatter variants
- generic “war shock” duplicates that overlap existing oil-war patterns
- overly broad recession templates that will become umbrella buckets
- decorative long-horizon macro history with weak near-term mapping utility

## Best implementation order
### Wave A (highest utility)
1. Red Sea Shipping Disruption 2024
2. U.S. Debt Ceiling X-Date Stress 2011/2023
3. March 2020 Treasury Dash for Cash / Basis Unwind
4. AI Packaging Bottleneck / CoWoS Constraint
5. AI Memory / HBM Shortage
6. Consumer Trade-Down / Retail Margin Shock 2022
7. China Critical Minerals Export Controls 2023-
8. Ever Given / Suez Canal Blockage 2021

### Wave B (good additions after that)
9. OPEC+ Surprise Production Cut / Supply Rebalancing
10. China Property Stimulus Head-Fake / Rescue Rally
11. LME Nickel Short Squeeze 2022
12. Credit Suisse AT1 Wipeout 2023

## Recommended follow-up after approval
1. add these patterns in a draft-only branch/file first
2. simultaneously refine the broad umbrella patterns from Stage 1, especially `p014` and `p002`
3. update matcher logic so new patterns do not just become keyword-collision buckets
4. after implementation, monitor which of the new patterns actually get selected and whether they improve signal quality
