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
