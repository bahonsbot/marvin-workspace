#!/usr/bin/env python3
"""
Knowledge Graph: Maps cause-effect relationships for market events
"""
import json
from typing import List, Dict, Optional, Set


class KnowledgeGraph:
    def __init__(self):
        self.causal_chains = []
        self.events = {}
        self.pattern_aliases = {
            'Saudi Oil Attacks': 'Middle East oil infrastructure attack',
            'Russia-Ukraine Conflict': 'Russia peace talks fail',
            'Tension Taiwan/China': 'Taiwan strait tensions escalate',
        }
        self.signal_prediction_templates = self._build_signal_prediction_templates()
        self.load_graph()

    def load_graph(self):
        """Load existing knowledge"""
        try:
            with open('data/knowledge_graph.json', 'r') as f:
                data = json.load(f)
                self.causal_chains = data.get('causal_chains', [])
                self.events = data.get('events', {})
        except FileNotFoundError:
            self.causal_chains = []
            self.events = {}

    def add_event(self, event: str, category: str, impact: str = 'unknown'):
        """Add an event to the graph"""
        if event not in self.events:
            self.events[event] = {
                'category': category,
                'impact': impact,
                'linked_events': []
            }

    def add_causal_link(self, cause: str, effect: str, strength: str = 'medium'):
        """Add a causal link between events"""
        self.add_event(cause, 'cause', 'unknown')
        self.add_event(effect, 'effect', 'unknown')

        if effect not in [link.get('event') for link in self.events[cause].get('linked_events', [])]:
            self.events[cause]['linked_events'].append({
                'event': effect,
                'strength': strength
            })

    def add_causal_chain(self, chain: List[str], strength: str = 'medium'):
        """Add a full causal chain"""
        for i in range(len(chain) - 1):
            self.add_causal_link(chain[i], chain[i + 1], strength)

        self.causal_chains.append({
            'chain': chain,
            'strength': strength
        })

    def find_related(self, event: str) -> List[Dict]:
        """Find related events"""
        related = []

        if event in self.events:
            for link in self.events[event].get('linked_events', []):
                related.append({
                    'event': link['event'],
                    'relationship': 'direct_effect',
                    'strength': link['strength']
                })

        for cause, data in self.events.items():
            for link in data.get('linked_events', []):
                if link['event'] == event:
                    related.append({
                        'event': cause,
                        'relationship': 'root_cause',
                        'strength': link['strength']
                    })

        return related

    def _predict_outcomes_recursive(self, event: str, visited: Optional[Set[str]] = None) -> List[str]:
        if visited is None:
            visited = set()
        if event in visited:
            return []

        visited.add(event)
        outcomes = []
        related = self.find_related(event)

        for rel in related:
            if rel['relationship'] == 'direct_effect':
                next_event = rel['event']
                outcomes.append(next_event)
                outcomes.extend(self._predict_outcomes_recursive(next_event, visited))

        return outcomes

    def predict_outcomes(self, event: str) -> List[str]:
        """Predict downstream effects of an event"""
        outcomes = self._predict_outcomes_recursive(event)
        return list(dict.fromkeys(outcomes))[:8]

    def find_root_causes(self, event: str, visited: Optional[Set[str]] = None) -> List[str]:
        """Find root causes of an event"""
        if visited is None:
            visited = set()
        if event in visited:
            return []

        visited.add(event)
        causes = []
        related = self.find_related(event)

        for rel in related:
            if rel['relationship'] == 'root_cause':
                cause_event = rel['event']
                causes.append(cause_event)
                causes.extend(self.find_root_causes(cause_event, visited))

        return list(dict.fromkeys(causes))[:8]

    def _build_signal_prediction_templates(self) -> List[Dict]:
        return [
            {
                'name': 'Israel-Iran escalation',
                'keywords': ['israel', 'iran', 'strike', 'strikes', 'retaliation'],
                'pattern_names': [],
                'event': 'Israel strikes Iran',
                'predictions': [
                    {'outcome': 'Crude oil rises 2-5% on risk premium', 'asset': 'crude_oil', 'direction': 'up', 'magnitude': '2-5%', 'horizon': 'intraday'},
                    {'outcome': 'Airline stocks weaken on fuel-cost shock', 'asset': 'airline_stocks', 'direction': 'down', 'magnitude': '1-3%', 'horizon': '1-3d'},
                    {'outcome': 'Defense stocks bid on escalation risk', 'asset': 'defense_stocks', 'direction': 'up', 'magnitude': '1-4%', 'horizon': '1-5d'},
                ]
            },
            {
                'name': 'OPEC+ supply increase',
                'keywords': ['opec', 'supply increase', 'output increase', 'production boost'],
                'pattern_names': ['Saudi Oil Attacks'],
                'event': 'OPEC+ supply increase',
                'predictions': [
                    {'outcome': 'Crude oil drifts lower as supply outlook improves', 'asset': 'crude_oil', 'direction': 'down', 'magnitude': '1-4%', 'horizon': 'intraday-3d'},
                    {'outcome': 'Energy producers underperform on softer oil', 'asset': 'energy_stocks', 'direction': 'down', 'magnitude': '1-3%', 'horizon': '1-5d'},
                    {'outcome': 'Airlines and transport catch relief bid', 'asset': 'transport_stocks', 'direction': 'up', 'magnitude': '0.5-2%', 'horizon': '1-5d'},
                ]
            },
            {
                'name': 'Russia peace talks fail',
                'keywords': ['russia', 'ukraine', 'peace talks fail', 'talks fail', 'ceasefire collapses'],
                'pattern_names': ['Russia-Ukraine Conflict'],
                'allow_pattern_fallback': True,
                'event': 'Russia peace talks fail',
                'predictions': [
                    {'outcome': 'Defense names strengthen on renewed conflict risk', 'asset': 'defense_stocks', 'direction': 'up', 'magnitude': '1-4%', 'horizon': '1-5d'},
                    {'outcome': 'Wheat prices firm on Black Sea disruption risk', 'asset': 'wheat', 'direction': 'up', 'magnitude': '2-6%', 'horizon': '1-10d'},
                    {'outcome': 'European gas risk premium widens', 'asset': 'natural_gas_eu', 'direction': 'up', 'magnitude': '3-8%', 'horizon': 'intraday-1w'},
                ]
            },
            # NEW TEMPLATES
            {
                'name': 'Fed rate hike',
                'keywords': ['rate hike', 'rates higher', 'interest rate hike', 'hike rates', 'hiking rates', 'raised rates', 'fed hikes'],
                'pattern_names': ['US Credit Downgrade'],
                'allow_pattern_fallback': True,
                'event': 'Fed rate hike',
                'predictions': [
                    {'outcome': 'Treasury yields climb on hawkish policy', 'asset': 'treasury_yields', 'direction': 'up', 'magnitude': '5-15bp', 'horizon': 'intraday'},
                    {'outcome': 'Rate-sensitive sectors weaken', 'asset': 'rate_sensitive', 'direction': 'down', 'magnitude': '1-3%', 'horizon': '1-5d'},
                    {'outcome': 'Dollar strengthens on rate differential', 'asset': 'dxy', 'direction': 'up', 'magnitude': '0.5-1.5%', 'horizon': '1-5d'},
                    {'outcome': 'Tech valuations pressure on higher rates', 'asset': 'tech_stocks', 'direction': 'down', 'magnitude': '1-4%', 'horizon': '1-10d'},
                ]
            },
            {
                'name': 'Fed rate cut',
                'keywords': ['rate cut', 'rates lower', 'interest rate cut', 'cut rates', 'cutting rates', 'lowered rates', 'fed cuts', 'fed easing'],
                'pattern_names': [],
                'event': 'Fed rate cut',
                'predictions': [
                    {'outcome': 'Treasury yields fall on dovish policy', 'asset': 'treasury_yields', 'direction': 'down', 'magnitude': '5-20bp', 'horizon': 'intraday'},
                    {'outcome': 'Growth stocks rally on cheaper money', 'asset': 'growth_stocks', 'direction': 'up', 'magnitude': '1-4%', 'horizon': '1-5d'},
                    {'outcome': 'Real estate catches bid', 'asset': 'reits', 'direction': 'up', 'magnitude': '1-3%', 'horizon': '1-5d'},
                    {'outcome': 'Dollar weakens on rate differential', 'asset': 'dxy', 'direction': 'down', 'magnitude': '0.5-1.5%', 'horizon': '1-5d'},
                ]
            },
            {
                'name': 'CPI inflation surprise (hot)',
                'keywords': ['inflation hotter', 'inflation rises', 'inflation surprise', 'cpi rises', 'core inflation up', 'inflation spikes'],
                'pattern_names': [],
                'event': 'CPI inflation hot',
                'predictions': [
                    {'outcome': 'Treasury yields spike on inflation shock', 'asset': 'treasury_yields', 'direction': 'up', 'magnitude': '8-20bp', 'horizon': 'intraday'},
                    {'outcome': 'Rate cut expectations pushed out', 'asset': 'rate_expectations', 'direction': 'down', 'magnitude': '2-4 cuts', 'horizon': '1-5d'},
                    {'outcome': 'Real yields climb', 'asset': 'real_yields', 'direction': 'up', 'magnitude': '5-15bp', 'horizon': '1-5d'},
                    {'outcome': 'TIPS outperform nominal', 'asset': 'tips', 'direction': 'up', 'magnitude': '0.5-2%', 'horizon': '1-10d'},
                ]
            },
            {
                'name': 'CPI inflation surprise (cold)',
                'keywords': ['inflation cools', 'inflation falls', 'inflation slows', 'cpi falls', 'core inflation down', 'disinflation', 'inflation drops'],
                'pattern_names': [],
                'event': 'CPI inflation cold',
                'predictions': [
                    {'outcome': 'Treasury yields fall on soft data', 'asset': 'treasury_yields', 'direction': 'down', 'magnitude': '8-20bp', 'horizon': 'intraday'},
                    {'outcome': 'Rate cut expectations accelerate', 'asset': 'rate_expectations', 'direction': 'up', 'magnitude': '2-4 cuts', 'horizon': '1-5d'},
                    {'outcome': 'Growth stocks rally on easing', 'asset': 'growth_stocks', 'direction': 'up', 'magnitude': '1-3%', 'horizon': '1-5d'},
                    {'outcome': 'Real yields decline', 'asset': 'real_yields', 'direction': 'down', 'magnitude': '5-15bp', 'horizon': '1-5d'},
                ]
            },
            {
                'name': 'Big bank earnings miss',
                'keywords': ['jpmorgan', 'goldman', 'morgan stanley', 'citi', 'bank earnings', 'wells fargo', ' earnings miss', 'revenue miss'],
                'pattern_names': ['Regional Banking Crisis 2023'],
                'allow_pattern_fallback': True,
                'event': 'Big bank earnings miss',
                'predictions': [
                    {'outcome': 'Regional banks sell off on contagion fear', 'asset': 'regional_banks', 'direction': 'down', 'magnitude': '2-5%', 'horizon': 'intraday-3d'},
                    {'outcome': 'Credit spreads widen', 'asset': 'credit_spreads', 'direction': 'up', 'magnitude': '10-25bp', 'horizon': '1-5d'},
                    {'outcome': 'Treasuries bid as safe haven', 'asset': 'treasury_yields', 'direction': 'down', 'magnitude': '3-10bp', 'horizon': '1-3d'},
                    {'outcome': 'Financial sector weakness spreads', 'asset': 'financials', 'direction': 'down', 'magnitude': '1-3%', 'horizon': '1-5d'},
                ]
            },
            {
                'name': 'Major M&A deal announced',
                'keywords': ['merger', 'acquisition', 'takeover', 'buyout', 'deal talks', 'm&a', 'acquire'],
                'pattern_names': [],
                'event': 'Major M&A announced',
                'predictions': [
                    {'outcome': 'Target stock jumps on premium', 'asset': 'target_stock', 'direction': 'up', 'magnitude': '10-30%', 'horizon': 'intraday'},
                    {'outcome': 'Acquirer may dip on cash/equity concern', 'asset': 'acquirer_stock', 'direction': 'down', 'magnitude': '1-3%', 'horizon': '1-3d'},
                    {'outcome': 'Sector peers bid on deal chatter', 'asset': 'sector_peers', 'direction': 'up', 'magnitude': '1-4%', 'horizon': '1-5d'},
                    {'outcome': 'M&A activity surges on deal news', 'asset': 'ma_activity', 'direction': 'up', 'magnitude': 'elevated', 'horizon': '1-10d'},
                ]
            },
            {
                'name': 'Regional banking stress',
                'keywords': ['regional bank', 'bank crisis', 'bank fail', 'bank rescue', 'bank deposit', 'silicon valley bank', 'svb', 'first republic'],
                'pattern_names': ['Regional Banking Crisis 2023'],
                'allow_pattern_fallback': True,
                'event': 'Regional banking stress',
                'predictions': [
                    {'outcome': 'Regional bank indices crater', 'asset': 'regional_bank_index', 'direction': 'down', 'magnitude': '5-15%', 'horizon': 'intraday'},
                    {'outcome': 'Large caps outperform regionals', 'asset': 'large_cap_banks', 'direction': 'up', 'magnitude': '1-3%', 'horizon': '1-5d'},
                    {'outcome': 'Credit conditions tighten', 'asset': 'credit_conditions', 'direction': 'down', 'magnitude': 'tightening', 'horizon': '1-10d'},
                    {'outcome': 'Treasuries rally on flight to safety', 'asset': 'treasury_yields', 'direction': 'down', 'magnitude': '10-25bp', 'horizon': 'intraday-3d'},
                ]
            },
            {
                'name': 'Tech earnings beat',
                'keywords': ['nvidia', 'apple', 'microsoft', 'google', 'meta', 'amazon', 'tesla', ' earnings beat', 'earnings blowout', 'revenue beat'],
                'pattern_names': [],
                'event': 'Tech earnings beat',
                'predictions': [
                    {'outcome': 'Stock rips on beat', 'asset': 'earnings_stock', 'direction': 'up', 'magnitude': '3-10%', 'horizon': 'intraday'},
                    {'outcome': 'Sector peers follow', 'asset': 'tech_sector', 'direction': 'up', 'magnitude': '1-3%', 'horizon': '1-3d'},
                    {'outcome': 'Nasdaq strength', 'asset': 'nasdaq', 'direction': 'up', 'magnitude': '0.5-2%', 'horizon': '1-5d'},
                    {'outcome': 'AI/momentum names bid', 'asset': 'ai_stocks', 'direction': 'up', 'magnitude': '1-4%', 'horizon': '1-10d'},
                ]
            },
            {
                'name': 'China slowdown fears',
                'keywords': ['china', 'chinese', 'beijing', 'chinese economy', 'china slowdown', 'china crisis', 'china property'],
                'pattern_names': [],
                'event': 'China slowdown fears',
                'predictions': [
                    {'outcome': 'Commodities tank on demand fears', 'asset': 'commodities', 'direction': 'down', 'magnitude': '2-5%', 'horizon': 'intraday-3d'},
                    {'outcome': 'Emerging markets underperform', 'asset': 'emerging_markets', 'direction': 'down', 'magnitude': '1-3%', 'horizon': '1-5d'},
                    {'outcome': 'Copper and iron ore slide', 'asset': 'industrial_metals', 'direction': 'down', 'magnitude': '2-6%', 'horizon': '1-10d'},
                    {'outcome': 'Safe haven flows to US assets', 'asset': 'us_assets', 'direction': 'up', 'magnitude': 'bid', 'horizon': '1-5d'},
                ]
            },
            # REGIONAL / GLOBAL
            {
                'name': 'EU recession fears',
                'keywords': ['eu recession', 'europe recession', 'eurozone recession', 'european economy slows', 'eu economy contracts'],
                'pattern_names': [],
                'event': 'EU recession fears',
                'predictions': [
                    {'outcome': 'Euro weakens vs dollar', 'asset': 'eurusd', 'direction': 'down', 'magnitude': '1-3%', 'horizon': '1-5d'},
                    {'outcome': 'European banks underperform', 'asset': 'european_banks', 'direction': 'down', 'magnitude': '2-5%', 'horizon': '1-10d'},
                    {'outcome': 'German bunds bid on safe haven', 'asset': 'bund_yields', 'direction': 'down', 'magnitude': '10-20bp', 'horizon': '1-5d'},
                    {'outcome': 'US equities outperform Europe', 'asset': 'us_vs_eu', 'direction': 'up', 'magnitude': 'relative', 'horizon': '1-10d'},
                ]
            },
            {
                'name': 'Japan Yen surge',
                'keywords': ['yen surges', 'yen spikes', 'yen strengthens', 'japan forex', 'boj', 'bank of japan'],
                'pattern_names': [],
                'event': 'Japan Yen surge',
                'predictions': [
                    {'outcome': 'Yen strengthens vs dollar', 'asset': 'usdjpy', 'direction': 'down', 'magnitude': '2-5%', 'horizon': 'intraday-3d'},
                    {'outcome': 'Japanese equities drop on export concern', 'asset': 'nikkei', 'direction': 'down', 'magnitude': '1-3%', 'horizon': '1-5d'},
                    {'outcome': 'Carry trade unwinds', 'asset': 'carry_trade', 'direction': 'down', 'magnitude': 'risk_off', 'horizon': '1-5d'},
                    {'outcome': 'Global risk assets selloff', 'asset': 'global_risk', 'direction': 'down', 'magnitude': '1-2%', 'horizon': 'intraday'},
                ]
            },
            {
                'name': 'UK economic stress',
                'keywords': ['uk economy', 'british economy', 'brexit impact', 'uk recession', 'bank of england'],
                'pattern_names': [],
                'event': 'UK economic stress',
                'predictions': [
                    {'outcome': 'Pound weakens', 'asset': 'gbpusd', 'direction': 'down', 'magnitude': '1-2%', 'horizon': '1-5d'},
                    {'outcome': 'UK financials pressured', 'asset': 'uk_financials', 'direction': 'down', 'magnitude': '1-3%', 'horizon': '1-5d'},
                    {'outcome': 'Gilts bid on safe haven', 'asset': 'gilt_yields', 'direction': 'down', 'magnitude': '5-15bp', 'horizon': '1-5d'},
                ]
            },
            {
                'name': 'Emerging market crisis',
                'keywords': ['emerging market crisis', 'em crisis', 'developing markets crash', 'latin america crisis', 'asia crisis'],
                'pattern_names': [],
                'event': 'Emerging market crisis',
                'predictions': [
                    {'outcome': 'EM currencies crumble', 'asset': 'em_currencies', 'direction': 'down', 'magnitude': '5-15%', 'horizon': 'intraday-1w'},
                    {'outcome': 'Capital flight to US dollar', 'asset': 'dxy', 'direction': 'up', 'magnitude': '1-3%', 'horizon': '1-5d'},
                    {'outcome': 'US Treasuries bid', 'asset': 'treasury_yields', 'direction': 'down', 'magnitude': '10-25bp', 'horizon': '1-5d'},
                    {'outcome': 'Risk assets globally pressured', 'asset': 'global_risk', 'direction': 'down', 'magnitude': '2-4%', 'horizon': '1-10d'},
                ]
            },
            # SECTORS
            {
                'name': 'Semiconductor shortage',
                'keywords': ['chip shortage', 'semiconductor shortage', 'gpu shortage', 'chip crisis', 'semiconductor crisis'],
                'pattern_names': ['GPU Shortage'],
                'allow_pattern_fallback': True,
                'event': 'Semiconductor shortage',
                'predictions': [
                    {'outcome': 'Semiconductor stocks rally on supply shock', 'asset': 'semis', 'direction': 'up', 'magnitude': '3-8%', 'horizon': 'intraday-3d'},
                    {'outcome': 'Auto producers pressured', 'asset': 'auto_stocks', 'direction': 'down', 'magnitude': '2-5%', 'horizon': '1-10d'},
                    {'outcome': 'Consumer electronics costs rise', 'asset': 'tech_hardware', 'direction': 'up', 'magnitude': '1-3%', 'horizon': '1-5d'},
                    {'outcome': 'Foundries benefit', 'asset': 'foundries', 'direction': 'up', 'magnitude': '3-6%', 'horizon': '1-10d'},
                ]
            },
            {
                'name': 'Retail holiday earnings',
                'keywords': ['retail earnings', 'holiday sales', 'black friday', 'cyber monday', 'retail season'],
                'pattern_names': [],
                'event': 'Retail holiday earnings',
                'predictions': [
                    {'outcome': 'Target and Walmart on report', 'asset': 'big_box_retail', 'direction': 'variable', 'magnitude': '3-10%', 'horizon': 'intraday'},
                    {'outcome': 'Consumer discretionary up on strong results', 'asset': 'consumer_disc', 'direction': 'up', 'magnitude': '1-3%', 'horizon': '1-5d'},
                    {'outcome': 'Amazon and e-commerce rally', 'asset': 'ecommerce', 'direction': 'up', 'magnitude': '2-5%', 'horizon': '1-5d'},
                    {'outcome': 'Weak results trigger retail selloff', 'asset': 'retail_sector', 'direction': 'down', 'magnitude': '2-6%', 'horizon': 'intraday-3d'},
                ]
            },
            {
                'name': 'Pharma drug approval',
                'keywords': ['fda', 'drug approval', 'fda rejects', 'clinical trial', 'biotech breakthrough', 'drug reject'],
                'pattern_names': [],
                'event': 'Pharma drug approval',
                'predictions': [
                    {'outcome': 'Stock rips on approval', 'asset': 'biotech_stock', 'direction': 'up', 'magnitude': '20-100%', 'horizon': 'intraday'},
                    {'outcome': 'Sector peers bid', 'asset': 'biotech_sector', 'direction': 'up', 'magnitude': '1-4%', 'horizon': '1-5d'},
                    {'outcome': 'Rejection sinks stock', 'asset': 'biotech_stock', 'direction': 'down', 'magnitude': '20-50%', 'horizon': 'intraday'},
                    {'outcome': 'Pipeline concerns spread', 'asset': 'biotech_sector', 'direction': 'down', 'magnitude': '1-3%', 'horizon': '1-5d'},
                ]
            },
            {
                'name': 'Energy oil spike',
                'keywords': ['oil spike', 'oil rallies', 'crude surges', 'energy rally', 'oil prices up'],
                'pattern_names': [],
                'event': 'Energy oil spike',
                'predictions': [
                    {'outcome': 'Crude oil jumps', 'asset': 'crude_oil', 'direction': 'up', 'magnitude': '3-7%', 'horizon': 'intraday'},
                    {'outcome': 'Energy sector rip', 'asset': 'energy_stocks', 'direction': 'up', 'magnitude': '2-5%', 'horizon': '1-5d'},
                    {'outcome': 'Airlines pressured', 'asset': 'airlines', 'direction': 'down', 'magnitude': '2-4%', 'horizon': '1-5d'},
                    {'outcome': 'Inflation expectations rise', 'asset': 'inflation_expectations', 'direction': 'up', 'magnitude': '5-15bp', 'horizon': '1-5d'},
                ]
            },
            {
                'name': 'Housing market weakness',
                'keywords': ['housing market', 'home sales', 'housing crash', 'mortgage rates', 'real estate weakness'],
                'pattern_names': [],
                'event': 'Housing market weakness',
                'predictions': [
                    {'outcome': 'Homebuilders tank', 'asset': 'homebuilders', 'direction': 'down', 'magnitude': '3-8%', 'horizon': 'intraday-3d'},
                    {'outcome': 'REITs underperform', 'asset': 'reits', 'direction': 'down', 'magnitude': '2-5%', 'horizon': '1-10d'},
                    {'outcome': 'Mortgage rates fall on safe haven', 'asset': 'mortgage_rates', 'direction': 'down', 'magnitude': '10-25bp', 'horizon': '1-5d'},
                    {'outcome': 'Consumer confidence dips', 'asset': 'consumer_confidence', 'direction': 'down', 'magnitude': '2-5 pts', 'horizon': '1-10d'},
                ]
            },
            {
                'name': 'Utilities rate sensitivity',
                'keywords': ['utilities', 'utility stocks', 'utility rally', 'rate sensitive sectors'],
                'pattern_names': [],
                'event': 'Utilities rate sensitivity',
                'predictions': [
                    {'outcome': 'Utilities rally on rate cut', 'asset': 'utilities', 'direction': 'up', 'magnitude': '2-4%', 'horizon': '1-5d'},
                    {'outcome': 'Utilities pressured on rate hike', 'asset': 'utilities', 'direction': 'down', 'magnitude': '2-5%', 'horizon': '1-5d'},
                    {'outcome': 'Yield differential drives flows', 'asset': 'utilities_flows', 'direction': 'variable', 'magnitude': 'significant', 'horizon': '1-10d'},
                ]
            },
            {
                'name': 'Defense spending increase',
                'keywords': ['defense spending', 'pentagon budget', 'military budget', 'defense contract', 'defense order'],
                'pattern_names': [],
                'event': 'Defense spending increase',
                'predictions': [
                    {'outcome': 'Defense contractors rally', 'asset': 'defense_stocks', 'direction': 'up', 'magnitude': '2-5%', 'horizon': '1-5d'},
                    {'outcome': 'Boeing and Lockheed gain', 'asset': 'defense_primes', 'direction': 'up', 'magnitude': '1-3%', 'horizon': '1-10d'},
                    {'outcome': 'Aerospace benefits', 'asset': 'aerospace', 'direction': 'up', 'magnitude': '1-4%', 'horizon': '1-10d'},
                ]
            },
            {
                'name': 'Airline industry stress',
                'keywords': ['airline crisis', 'airline bankruptcy', 'airline losses', 'airline earnings'],
                'pattern_names': [],
                'event': 'Airline industry stress',
                'predictions': [
                    {'outcome': 'Airlines sell off', 'asset': 'airlines', 'direction': 'down', 'magnitude': '5-15%', 'horizon': 'intraday-3d'},
                    {'outcome': 'Fuel suppliers pressured', 'asset': 'energy_markets', 'direction': 'down', 'magnitude': '1-3%', 'horizon': '1-5d'},
                    {'outcome': 'Travel sector weakens', 'asset': 'travel_leisure', 'direction': 'down', 'magnitude': '2-4%', 'horizon': '1-10d'},
                ]
            },
            {
                'name': 'Bond market stress',
                'keywords': ['bond vigilantes', 'bond selloff', 'treasury crash', 'bond yields spike', 'fixed income crisis', 'bond market stress'],
                'pattern_names': [],
                'event': 'Bond market stress',
                'predictions': [
                    {'outcome': 'Treasuries crash', 'asset': 'treasuries', 'direction': 'down', 'magnitude': '3-8%', 'horizon': 'intraday'},
                    {'outcome': 'Yields spike', 'asset': 'treasury_yields', 'direction': 'up', 'magnitude': '25-50bp', 'horizon': 'intraday-3d'},
                    {'outcome': 'Equities follow bonds lower', 'asset': 'sp500', 'direction': 'down', 'magnitude': '2-5%', 'horizon': '1-5d'},
                    {'outcome': 'Credit spreads widen sharply', 'asset': 'credit_spreads', 'direction': 'up', 'magnitude': '50-100bp', 'horizon': 'intraday-3d'},
                ]
            },
        ]

    def predict_signal_outcomes(self, signal: Dict) -> List[Dict]:
        """Generate causal predictions for a signal from pattern + title context"""
        title = (signal.get('title') or '').lower()
        pattern = signal.get('pattern', '')
        text = f"{pattern} {title}".lower()

        matches = []
        for template in self.signal_prediction_templates:
            keyword_hit = any(k in text for k in template.get('keywords', []))
            pattern_hit = pattern in template.get('pattern_names', [])
            allow_pattern_fallback = template.get('allow_pattern_fallback', False)

            if keyword_hit or (pattern_hit and allow_pattern_fallback):
                matches.append({
                    'trigger': template['event'],
                    'chain_name': template['name'],
                    'predictions': template['predictions']
                })

        return matches

    def save(self):
        """Save knowledge graph"""
        with open('data/knowledge_graph.json', 'w') as f:
            json.dump({
                'causal_chains': self.causal_chains,
                'events': self.events
            }, f, indent=2)

    def build_default_graph(self):
        """Build initial knowledge from case studies"""

        self.add_causal_chain([
            'COVID-19 outbreak',
            'Lockdowns',
            'Economic slowdown',
            'Oil demand collapse',
            'Oil price war',
            'Market crash'
        ], 'strong')

        self.add_causal_chain([
            'Fed rate hikes',
            'Bond prices fall',
            'Bank unrealized losses',
            'SVB bank run',
            'Regional bank crisis',
            'Fed emergency action'
        ], 'strong')

        self.add_causal_chain([
            'Russia invasion',
            'Sanctions',
            'Energy crisis',
            'Natural gas spike',
            'European recession fear',
            'Energy stock rally'
        ], 'strong')

        self.add_causal_chain([
            'Reddit coordination',
            'Short squeeze',
            'Melvin Capital losses',
            'Broker liquidity concerns',
            'Trading restrictions',
            'Congressional hearing'
        ], 'medium')

        self.add_causal_chain([
            'China three red lines',
            'Property debt crackdown',
            'Evergrande default',
            'China property crisis',
            'Developer bankruptcies',
            'China GDP impact'
        ], 'medium')

        # New geopolitical causal chains used for forward predictions
        self.add_causal_chain([
            'Israel strikes Iran',
            'Middle East escalation risk',
            'Oil risk premium',
            'Crude oil rises 2-5%',
            'Airline stocks weaken',
            'Defense stocks strengthen'
        ], 'strong')

        self.add_causal_chain([
            'OPEC+ supply increase',
            'Global crude supply rises',
            'Crude oil falls 1-4%',
            'Energy producers underperform',
            'Transport margin relief'
        ], 'strong')

        self.add_causal_chain([
            'Russia peace talks fail',
            'Renewed war-duration risk',
            'Defense spending expectations rise',
            'Defense stocks strengthen',
            'Wheat supply risk premium'
        ], 'strong')

        self.save()
        print('✓ Built default knowledge graph from case studies')

    def print_graph(self):
        """Print knowledge graph summary"""
        print('=== Market Intel: Knowledge Graph ===\n')
        print(f'Causal chains: {len(self.causal_chains)}')
        print(f'Events tracked: {len(self.events)}\n')

        print('Sample chains:')
        for chain in self.causal_chains[:3]:
            print('  → '.join(chain['chain'][:4]))
            print()

    def run(self, build_default=False):
        """Run knowledge graph"""
        if build_default:
            self.build_default_graph()

        self.print_graph()
        self.save()


if __name__ == '__main__':
    import sys
    kg = KnowledgeGraph()
    kg.run(build_default='--build' in sys.argv)
