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
        
        # Pattern-specific keywords with scoring
        pattern_keywords = {
            'p001': {'keywords': ['saudi', 'opec', 'abqaiq', 'aramco', 'oil attack', 'drone'], 'weight': 3},
            'p002': {'keywords': ['ukraine', 'russia', 'putin', 'kremlin', 'kyiv', 'moscow', 'invasion'], 'weight': 3},
            'p003': {'keywords': ['nvidia', 'amd', 'gpu', 'semiconductor', 'chip shortage'], 'weight': 2},
            'p004': {'keywords': ['covid', 'pandemic', 'coronavirus', 'who outbreak'], 'weight': 3},
            'p005': {'keywords': ['gme', 'gamestop', 'wsb', 'wallstreetbets', 'short squeeze', 'meme stock'], 'weight': 3},
            'p006': {'keywords': ['svb', 'silicon valley bank', 'regional bank', 'bank failure', 'bank collapse'], 'weight': 3},
            'p007': {'keywords': ['evergrande', 'china property', 'country garden'], 'weight': 2},
            'p008': {'keywords': ['ftx', 'sam bankman', 'alameda', 'SBF'], 'weight': 3},
            'p009': {'keywords': ['brexit', 'uk referendum', 'eu referendum', 'british pound'], 'weight': 3},
            'p010': {'keywords': ['tesla', 'nvidia', 'nvda', 'stock split', '5-for-1'], 'weight': 2}
        }
        
        # Check each pattern
        for pattern in self.patterns:
            rule = pattern_keywords.get(pattern['id'], {'keywords': [], 'weight': 1})
            keywords = rule['keywords']
            weight = rule['weight']
            
            for kw in keywords:
                if kw in text:
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
            print(f"{icon} [{s['source'].upper()}] {s['title'][:55]}")
            print(f"    → {s['pattern']} ({s['category']})")
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
