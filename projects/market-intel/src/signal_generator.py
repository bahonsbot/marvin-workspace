#!/usr/bin/env python3
"""
Signal Generator: Matches RSS/Reddit alerts against historical patterns
Generates actionable market signals
"""
import json
import os
from datetime import datetime
from typing import List, Dict

class SignalGenerator:
    def __init__(self):
        self.patterns = []
        self.rss_alerts = []
        self.reddit_alerts = []
        self.load_data()
    
    def load_data(self):
        """Load patterns and alerts"""
        with open('data/patterns.json', 'r') as f:
            data = json.load(f)
            self.patterns = data['patterns']
        
        if os.path.exists('data/rss_alerts.json'):
            with open('data/rss_alerts.json', 'r') as f:
                self.rss_alerts = json.load(f)
        
        if os.path.exists('data/reddit_alerts.json'):
            with open('data/reddit_alerts.json', 'r') as f:
                self.reddit_alerts = json.load(f)
    
    def match_alert_to_patterns(self, alert: Dict) -> List[Dict]:
        """Match an alert to relevant patterns"""
        matches = []
        title = alert.get('title', '').lower()
        summary = alert.get('summary', '').lower()
        text = f"{title} {summary}"
        
        # Pattern-specific keywords with scoring - REFINED
        pattern_keywords = {
            'p001': {  # Saudi Oil - ONLY Middle East
                'keywords': ['saudi', 'opec', 'abqaiq', 'khurais', 'aramco', 'gulf oil'],
                'exclude': ['ukraine', 'russia', 'drone strike', 'military facility'],
                'weight': 3
            },
            'p002': {  # Russia-Ukraine - ONLY Eastern Europe conflict
                'keywords': ['ukraine', 'russia', 'putin', 'kremlin', 'kyiv', 'moscow', 'invasion', 'kremlin'],
                'exclude': ['saudi', 'opec', 'middle east'],
                'weight': 3
            },
            'p003': {  # GPU/Semis
                'keywords': ['nvidia', 'amd', 'gpu shortage', 'semiconductor shortage', 'chip shortage', 'h100'],
                'exclude': [],
                'weight': 2
            },
            'p004': {  # COVID - health crisis
                'keywords': ['covid', 'pandemic', 'coronavirus', 'who outbreak', 'virus variant'],
                'exclude': ['election', 'political'],
                'weight': 3
            },
            'p005': {  # GameStop - meme stocks
                'keywords': ['gme', 'gamestop', 'wallstreetbets', 'wsb', 'short squeeze', 'meme stock'],
                'exclude': ['real estate', 'housing'],
                'weight': 3
            },
            'p006': {  # SVB - banking
                'keywords': ['svb', 'silicon valley bank', 'regional bank', 'bank failure', 'bank collapse', 'fdic'],
                'exclude': [],
                'weight': 3
            },
            'p007': {  # Evergrande - China property
                'keywords': ['evergrande', 'china property', 'country garden', 'chinese developer'],
                'exclude': [],
                'weight': 2
            },
            'p008': {  # FTX - crypto
                'keywords': ['ftx', 'sam bankman', 'alameda', 'SBF', 'crypto exchange'],
                'exclude': [],
                'weight': 3
            },
            'p009': {  # Brexit - UK politics
                'keywords': ['brexit', 'uk referendum', 'eu referendum', 'british pound', 'uk parliament'],
                'exclude': [],
                'weight': 3
            },
            'p010': {  # Tesla - tech/auto
                'keywords': ['tesla', 'tsla', 'stock split', '5-for-1', 'elon'],
                'exclude': [],
                'weight': 2
            },
            # NEW PATTERNS
            'p011': {  # Black Monday 1987
                'keywords': ['black monday', '1987 crash', 'program trading', 'portfolio insurance'],
                'exclude': [],
                'weight': 3
            },
            'p012': {  # Japan Lost Decade
                'keywords': ['japan bubble', 'nikkei', 'lost decade', 'japanese real estate'],
                'exclude': [],
                'weight': 2
            },
            'p013': {  # Arab Spring
                'keywords': ['arab spring', 'middle east protests', 'tunisia', 'egypt revolution'],
                'exclude': [],
                'weight': 2
            },
            'p014': {  # US Credit Downgrade
                'keywords': ['s&p downgrade', 'credit rating', 'aaa downgrade', 'us debt'],
                'exclude': [],
                'weight': 3
            },
            'p015': {  # China Devaluation
                'keywords': ['china devaluation', 'yuan devalue', 'currency war', 'china export'],
                'exclude': [],
                'weight': 3
            },
            'p016': {  # Iran Nuclear Deal
                'keywords': ['iran nuclear', 'sanctions lifted', 'jcpoa', 'iran deal'],
                'exclude': [],
                'weight': 2
            },
            'p017': {  # Taiwan/China Tension
                'keywords': ['taiwan', 'pelosi', 'china military', 'china drills', 'cross strait'],
                'exclude': [],
                'weight': 3
            },
            'p018': {  # Regional Banking Crisis 2023
                'keywords': ['signature bank', 'first republic', 'regional banking crisis', 'bank fears'],
                'exclude': [],
                'weight': 3
            }
        }
        
        # Check each pattern
        for pattern in self.patterns:
            rule = pattern_keywords.get(pattern['id'], {'keywords': [], 'exclude': [], 'weight': 1})
            keywords = rule.get('keywords', [])
            excludes = rule.get('exclude', [])
            weight = rule.get('weight', 1)
            
            for kw in keywords:
                if kw in text:
                    # Check exclusions - skip if any exclusion keyword found
                    should_exclude = False
                    for exc in excludes:
                        if exc in text:
                            should_exclude = True
                            break
                    
                    if not should_exclude:
                        matches.append({
                        'pattern_id': pattern['id'],
                        'pattern_name': pattern['name'],
                        'category': pattern['category'],
                        'confidence': pattern['confidence'],
                        'time_horizon': pattern['time_horizon'],
                        'matched_keyword': kw,
                        'match_weight': weight
                    })
                    break  # Only match once per pattern
        
        return matches
    
    def generate_signals(self) -> List[Dict]:
        """Generate signals from all alerts"""
        signals = []
        
        for alert in self.rss_alerts[:20]:
            matches = self.match_alert_to_patterns(alert)
            if matches:
                best = max(matches, key=lambda x: (self.confidence_score(x['confidence']), x['match_weight']))
                signals.append({
                    'source': 'rss',
                    'feed': alert.get('feed', 'unknown'),
                    'title': alert.get('title', '')[:80],
                    'url': alert.get('link', ''),
                    'timestamp': alert.get('timestamp', ''),
                    'pattern': best['pattern_name'],
                    'category': best['category'],
                    'confidence': best['confidence'],
                    'time_horizon': best['time_horizon'],
                    'signal_score': self.confidence_score(best['confidence']) * best['match_weight']
                })
        
        for alert in self.reddit_alerts[:20]:
            matches = self.match_alert_to_patterns(alert)
            if matches:
                best = max(matches, key=lambda x: (self.confidence_score(x['confidence']), x['match_weight']))
                signals.append({
                    'source': 'reddit',
                    'feed': f"r/{alert.get('subreddit', 'unknown')}",
                    'title': alert.get('title', '')[:80],
                    'url': alert.get('url', ''),
                    'timestamp': alert.get('timestamp', ''),
                    'pattern': best['pattern_name'],
                    'category': best['category'],
                    'confidence': best['confidence'],
                    'time_horizon': best['time_horizon'],
                    'score': alert.get('score', 0),
                    'signal_score': self.confidence_score(best['confidence']) * best['match_weight']
                })
        
        signals.sort(key=lambda x: x['signal_score'], reverse=True)
        return signals[:10]
    
    def confidence_score(self, confidence: str) -> int:
        mapping = {'HIGH': 100, 'MEDIUM_HIGH': 75, 'MEDIUM': 50, 'LOW': 25}
        return mapping.get(confidence, 0)
    
    def save_signals(self, signals: List[Dict], output_file: str = "data/signals.json"):
        with open(output_file, 'w') as f:
            json.dump(signals, f, indent=2)
    
    def print_summary(self, signals: List[Dict]):
        print("=== MARKET INTEL SIGNALS ===\n")
        
        high = [s for s in signals if s['confidence'] == 'HIGH']
        medium = [s for s in signals if s['confidence'] in ['MEDIUM_HIGH', 'MEDIUM']]
        
        print(f"📊 Total: {len(signals)} | HIGH: {len(high)} | MEDIUM: {len(medium)}\n")
        
        for s in signals[:8]:
            icon = "🔴" if s['confidence'] == 'HIGH' else "🟡"
            print(f"{icon} {s['confidence']} - {s['pattern']}")
            print(f"   {s['title'][:60]}...")
            print(f"   Source: {s['source'].upper()} | Category: {s['category']}")
            print()

    def run(self):
        print("=== Generating Market Signals ===\n")
        
        signals = self.generate_signals()
        
        if signals:
            self.print_summary(signals)
            self.save_signals(signals)
            print(f"✓ Saved {len(signals)} signals to data/signals.json")
        else:
            print("No signals generated - run RSS and Reddit monitors first.")
        
        return signals


if __name__ == "__main__":
    generator = SignalGenerator()
    generator.run()
