#!/usr/bin/env python3
"""
Knowledge Graph: Maps cause-effect relationships for market events
"""
import json
from typing import List, Dict

class KnowledgeGraph:
    def __init__(self):
        self.causal_chains = []
        self.events = {}
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
    
    def add_event(self, event: str, category: str, impact: str = "unknown"):
        """Add an event to the graph"""
        if event not in self.events:
            self.events[event] = {
                'category': category,
                'impact': impact,
                'linked_events': []
            }
    
    def add_causal_link(self, cause: str, effect: str, strength: str = "medium"):
        """Add a causal link between events"""
        # Add to events
        self.add_event(cause, 'cause', 'unknown')
        self.add_event(effect, 'effect', 'unknown')
        
        # Add link
        if effect not in self.events[cause].get('linked_events', []):
            self.events[cause]['linked_events'].append({
                'event': effect,
                'strength': strength
            })
    
    def add_causal_chain(self, chain: List[str], strength: str = "medium"):
        """Add a full causal chain"""
        for i in range(len(chain) - 1):
            self.add_causal_link(chain[i], chain[i+1], strength)
        
        self.causal_chains.append({
            'chain': chain,
            'strength': strength
        })
    
    def find_related(self, event: str) -> List[Dict]:
        """Find related events"""
        related = []
        
        # Direct links
        if event in self.events:
            for link in self.events[event].get('linked_events', []):
                related.append({
                    'event': link['event'],
                    'relationship': 'direct_effect',
                    'strength': link['strength']
                })
        
        # Reverse links (what causes this?)
        for cause, data in self.events.items():
            for link in data.get('linked_events', []):
                if link['event'] == event:
                    related.append({
                        'event': cause,
                        'relationship': 'root_cause',
                        'strength': link['strength']
                    })
        
        return related
    
    def predict_outcomes(self, event: str) -> List[str]:
        """Predict downstream effects of an event"""
        outcomes = []
        related = self.find_related(event)
        
        for r in related:
            if r['relationship'] == 'direct_effect':
                outcomes.append(r['event'])
                # Recursively find more
                outcomes.extend(self.predict_outcomes(r['event']))
        
        return list(set(outcomes))[:5]  # Top 5
    
    def find_root_causes(self, event: str) -> List[str]:
        """Find root causes of an event"""
        causes = []
        related = self.find_related(event)
        
        for r in related:
            if r['relationship'] == 'root_cause':
                causes.append(r['event'])
                causes.extend(self.find_root_causes(r['event']))
        
        return list(set(causes))[:5]
    
    def save(self):
        """Save knowledge graph"""
        with open('data/knowledge_graph.json', 'w') as f:
            json.dump({
                'causal_chains': self.causal_chains,
                'events': self.events
            }, f, indent=2)
    
    def build_default_graph(self):
        """Build initial knowledge from case studies"""
        
        # COVID → Market Crash
        self.add_causal_chain([
            "COVID-19 outbreak",
            "Lockdowns",
            "Economic slowdown",
            "Oil demand collapse",
            "Oil price war",
            "Market crash"
        ], "strong")
        
        # SVB Collapse
        self.add_causal_chain([
            "Fed rate hikes",
            "Bond prices fall",
            "Bank unrealized losses",
            "SVB bank run",
            "Regional bank crisis",
            "Fed emergency action"
        ], "strong")
        
        # Russia-Ukraine
        self.add_causal_chain([
            "Russia invasion",
            "Sanctions",
            "Energy crisis",
            "Natural gas spike",
            "European recession fear",
            "Energy stock rally"
        ], "strong")
        
        # GameStop
        self.add_causal_chain([
            "Reddit coordination",
            "Short squeeze",
            "Melvin Capital losses",
            "Broker liquidity concerns",
            "Trading restrictions",
            "Congressional hearing"
        ], "medium")
        
        # Evergrande
        self.add_causal_chain([
            "China three red lines",
            "Property debt crackdown",
            "Evergrande default",
            "China property crisis",
            "Developer bankruptcies",
            "China GDP impact"
        ], "medium")
        
        self.save()
        print("✓ Built default knowledge graph from case studies")
    
    def print_graph(self):
        """Print knowledge graph summary"""
        print("=== Market Intel: Knowledge Graph ===\n")
        print(f"Causal chains: {len(self.causal_chains)}")
        print(f"Events tracked: {len(self.events)}\n")
        
        print("Sample chains:")
        for chain in self.causal_chains[:3]:
            print(f"  → ".join(chain['chain'][:4]))
            print()
    
    def run(self, build_default=False):
        """Run knowledge graph"""
        if build_default:
            self.build_default_graph()
        
        self.print_graph()
        self.save()


if __name__ == "__main__":
    import sys
    kg = KnowledgeGraph()
    kg.run(build_default='--build' in sys.argv)
