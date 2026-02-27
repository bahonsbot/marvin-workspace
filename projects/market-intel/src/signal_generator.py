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
        # Load patterns
        with open('data/patterns.json', 'r') as f:
            data = json.load(f)
            self.patterns = data['patterns']
        
        # Load RSS alerts
        if os.path.exists('data/rss_alerts.json'):
            with open('data/rss_alerts.json', 'r') as f:
                self.rss_alerts = json.load(f)
        
        # Load Reddit alerts
        if os.path.exists('data/reddit_alerts.json'):
            with open('data/reddit_alerts.json', 'r') as f:
                self.reddit_alerts = json.load(f)
    
    def match_alert_to_patterns(self, alert: Dict) -> List[Dict]:
        """Match an alert to relevant patterns"""
        matches = []
        text = f"{alert.get('title', '')} {alert.get('summary', '')}".lower()
        
        for pattern in self.patterns:
            # Check category match
            category_keywords = self.get_category_keywords(pattern['category'])
            
            for keyword in category_keywords:
                if keyword.lower() in text:
                    matches.append({
                        'pattern_id': pattern['id'],
                        'pattern_name': pattern['name'],
                        'category': pattern['category'],
                        'confidence': pattern['confidence'],
                        'time_horizon': pattern['time_horizon'],
                        'matched_keyword': keyword,
                        'typical_lag': pattern.get('time_lag_hours', {})
                    })
                    break
        
        return matches
    
    def get_category_keywords(self, category: str) -> List[str]:
        """Map category to relevant keywords"""
        mapping = {
            'geopolitical': ['war', 'invasion', 'troops', 'military', 'sanction', 'oil', 'attack', 'conflict'],
            'financial_credit': ['bank', 'default', 'collapse', 'failure', 'crisis', 'credit', 'svb'],
            'sentiment_social': ['squeeze', 'reddit', 'wallstreetbets', 'meme', 'short'],
            'macroeconomic': ['inflation', 'fed', 'rate', 'cpi', 'recession', 'pandemic'],
            'corporate': ['earnings', 'split', 'dividend', 'buyback', 'acquisition', 'merger'],
            'crypto': ['bitcoin', 'crypto', 'coin', 'token', 'exchange'],
            'political': ['brexit', 'vote', 'election', 'eu']
        }
        return mapping.get(category, [])
    
    def generate_signals(self) -> List[Dict]:
        """Generate signals from all alerts"""
        signals = []
        
        # Process RSS alerts
        for alert in self.rss_alerts[:20]:  # Recent 20
            matches = self.match_alert_to_patterns(alert)
            
            if matches:
                # Get highest confidence match
                best = max(matches, key=lambda x: self.confidence_score(x['confidence']))
                
                signals.append({
                    'source': 'rss',
                    'feed': alert.get('feed', 'unknown'),
                    'title': alert.get('title', '')[:100],
                    'url': alert.get('link', ''),
                    'timestamp': alert.get('timestamp', ''),
                    'pattern': best['pattern_name'],
                    'category': best['category'],
                    'confidence': best['confidence'],
                    'time_horizon': best['time_horizon'],
                    'matched_keyword': best['matched_keyword'],
                    'signal_score': self.confidence_score(best['confidence'])
                })
        
        # Process Reddit alerts
        for alert in self.reddit_alerts[:20]:
            matches = self.match_alert_to_patterns(alert)
            
            if matches:
                best = max(matches, key=lambda x: self.confidence_score(x['confidence']))
                
                signals.append({
                    'source': 'reddit',
                    'feed': f"r/{alert.get('subreddit', 'unknown')}",
                    'title': alert.get('title', '')[:100],
                    'url': alert.get('url', ''),
                    'timestamp': alert.get('timestamp', ''),
                    'pattern': best['pattern_name'],
                    'category': best['category'],
                    'confidence': best['confidence'],
                    'time_horizon': best['time_horizon'],
                    'matched_keyword': best['matched_keyword'],
                    'score': alert.get('score', 0),
                    'signal_score': self.confidence_score(best['confidence'])
                })
        
        # Sort by signal score
        signals.sort(key=lambda x: x.get('signal_score', 0), reverse=True)
        
        return signals[:10]  # Top 10
    
    def confidence_score(self, confidence: str) -> int:
        """Convert confidence to numeric score"""
        mapping = {
            'HIGH': 100,
            'MEDIUM_HIGH': 75,
            'MEDIUM': 50,
            'LOW': 25
        }
        return mapping.get(confidence, 0)
    
    def save_signals(self, signals: List[Dict], output_file: str = "data/signals.json"):
        """Save signals to file"""
        with open(output_file, 'w') as f:
            json.dump(signals, f, indent=2)
    
    def print_summary(self, signals: List[Dict]):
        """Print signal summary"""
        print("=== MARKET INTEL SIGNALS ===\n")
        
        high = [s for s in signals if s['confidence'] == 'HIGH']
        medium = [s for s in signals if s['confidence'] in ['MEDIUM_HIGH', 'MEDIUM']]
        
        print(f"📊 Total Signals: {len(signals)}")
        print(f"   🔴 HIGH: {len(high)}")
        print(f"   🟡 MEDIUM: {len(medium)}\n")
        
        if high:
            print("🔴 HIGH CONFIDENCE SIGNALS:")
            for s in high[:5]:
                print(f"  [{s['source'].upper()}] {s['title'][:60]}...")
                print(f"    Pattern: {s['pattern']} | Category: {s['category']}")
                print(f"    Source: {s['feed']}")
                print()
        
        if medium:
            print("🟡 MEDIUM CONFIDENCE SIGNALS:")
            for s in medium[:3]:
                print(f"  [{s['source'].upper()}] {s['title'][:50]}...")
                print(f"    Pattern: {s['pattern']} | Category: {s['category']}")
                print()

    def run(self):
        """Run signal generation"""
        print("=== Generating Market Signals ===\n")
        
        signals = self.generate_signals()
        
        if signals:
            self.print_summary(signals)
            self.save_signals(signals)
            print(f"✓ Saved {len(signals)} signals to data/signals.json")
        else:
            print("No signals generated yet.")
        
        return signals


if __name__ == "__main__":
    generator = SignalGenerator()
    generator.run()
