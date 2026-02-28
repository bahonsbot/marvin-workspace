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
                'keywords': ['nvidia', 'amd', 'gpu shortage', 'semiconductor shortage', 'chip shortage', 'h100', 
                            'ai chip', 'micron', 'broadcom', 'intel foundry', 'tsmc', 'asml', 'semiconductor stocks',
                            'ai semis', 'ai rally', 'tech rally semis'],
                'exclude': [],
                'weight': 2
            },
            'p004': {  # COVID - health crisis
                'keywords': ['covid', 'pandemic', 'coronavirus', 'who outbreak', 'virus variant'],
                'exclude': ['election', 'political'],
                'weight': 3
            },
            'p005': {  # GameStop - expanded meme/sentiment coverage
                'keywords': [
                    'gme', 'gamestop', 'wallstreetbets', 'wsb', 'short squeeze', 'meme stock',
                    'gamma squeeze', 'call buying frenzy', 'retail traders pile', 'days to cover',
                    'amc', 'bbby', 'bed bath', 'robinhood', 'meme rally', 'reddit rally',
                    'short interest', 'navy', 'chewy', 'retail investors', 'options call',
                    'calls surge', 'volume surge', 'trending', 'meme basket'
                ],
                'exclude': ['real estate', 'housing'],
                'weight': 3
            },
            'p006': {  # SVB - banking / credit stress
                'keywords': [
                    'svb', 'silicon valley bank', 'regional bank', 'bank failure', 'bank collapse', 'fdic',
                    'deposit flight', 'liquidity crunch', 'credit event', 'credit spread widening',
                    'commercial real estate losses', 'bank run fears'
                ],
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
            'p010': {  # Tesla / corporate earnings & M&A - expanded
                'keywords': [
                    'tesla', 'tsla', 'stock split', '5-for-1', 'elon', 'elon musk',
                    'earnings beat', 'earnings miss', 'revenue guidance', 'profit warning',
                    'merger talks', 'acquisition offer', 'take-private', 'buyout bid', 'deal talks',
                    'quarterly results', 'q4 earnings', 'q3 earnings', 'fiscal year', 'annual report',
                    'sales growth', 'revenue miss', 'eps beat', 'revenue beat', 'outlook raised',
                    'outlook cut', 'guidance raised', 'guidance cut', 'forward guidance',
                    'ipo', 'direct listing', 'secondary offering', 'stock offering',
                    'ceo change', 'leadership change', 'executive resign', 'board change',
                    'major acquisition', 'strategic review', 'sale of company', 'privatization'
                ],
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
            'p014': {  # US Credit Downgrade / macro rates-inflation regime - expanded
                'keywords': [
                    's&p downgrade', 'credit rating', 'aaa downgrade', 'us debt', 'us credit',
                    'federal reserve', 'fed chair', 'jerome powell', 'fed minutes', 'fomc', 
                    'cpi', 'core cpi', 'pce inflation', 'inflation data', 'consumer price',
                    'rate hike', 'rate cut', 'rate decision', 'fed Funds rate',
                    'treasury yield', 'yield spike', 'yield curve', 'yield curve inversion',
                    '10-year yield', '2-year yield', '30-year mortgage', 'mortgage rates',
                    'recession fears', 'recession risk', 'recession signal', 'hard landing', 'soft landing',
                    'gdp growth', 'gdp slowdown', 'economic slowdown', 'economy warning',
                    'unemployment', 'jobs report', 'nfp', 'nonfarm payroll', 'labor market',
                    'interest rates', 'monetary policy', 'tightening', 'easing', 'dovish', 'hawkish'
                ],
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
                'keywords': [
                    'signature bank', 'first republic', 'regional banking crisis', 'bank fears',
                    'credit crunch', 'interbank stress', 'funding pressure', 'deposit outflows',
                    'private credit', 'bank deposits', 'bank stocks', 'merchant bank'
                ],
                'exclude': [],
                'weight': 3
            },
            # NEW REGIONAL PATTERNS
            'p019': {  # Asian Financial Crisis 1997
                'keywords': ['asian crisis', 'thailand baht', 'indonesia rupiah', 'korean won', 'asian financial', 'asean currency'],
                'exclude': [],
                'weight': 3
            },
            'p020': {  # European Debt Crisis
                'keywords': ['greece debt', 'portugal bailout', 'italy debt', 'eurozone crisis', 'piigs', 'european sovereign', 'bond spread'],
                'exclude': [],
                'weight': 3
            },
            'p021': {  # Emerging Market Crisis 2018
                'keywords': ['argentina peso', 'turkey lira', 'emerging market crisis', 'em currency', 'capital flight', 'fed rate hike emerging'],
                'exclude': [],
                'weight': 3
            },
            'p022': {  # LTCM Collapse
                'keywords': ['ltcm', 'long-term capital', 'hedge fund collapse', 'hedge fund bailout'],
                'exclude': [],
                'weight': 3
            },
            'p023': {  # Dot-com Bubble
                'keywords': ['dotcom bubble', 'pets.com', 'nasdaq crash', 'tech bubble', 'ipo bubble', 'webvan'],
                'exclude': [],
                'weight': 2
            },
            'p024': {  # Retail Options Sentiment - NEW
                'keywords': [
                    'bought calls', 'bought puts', 'call bought', 'put bought', 'calls bought',
                    'yolo', 'yolo trade', 'rolling options', 'options strategy', 'iron condor',
                    'credit spread', 'debit spread', 'call option', 'put option', 'stock options',
                    'expiring friday', 'itmo', 'otm', 'itm', 'delta', 'gamma', 'vega',
                    'option chain', 'options volume', 'unusual options', 'unusual activity', 'calls'
                ],
                'exclude': [],
                'weight': 2
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
        
        for alert in self.rss_alerts[:120]:
            matches = self.match_alert_to_patterns(alert)
            if matches:
                best = max(matches, key=lambda x: (self.confidence_score(x['confidence']), x['match_weight']))
                signals.append({
                    'source': 'rss',
                    'feed': alert.get('feed', 'unknown'),
                    'title': alert.get('title', '')[:80],
                    'url': alert.get('link', ''),
                    'timestamp': alert.get('timestamp', ''),
                    'pattern_id': best['pattern_id'],
                    'pattern': best['pattern_name'],
                    'category': best['category'],
                    'confidence': best['confidence'],
                    'time_horizon': best['time_horizon'],
                    'signal_score': self.confidence_score(best['confidence']) * best['match_weight']
                })
        
        for alert in self.reddit_alerts[:120]:
            matches = self.match_alert_to_patterns(alert)
            if matches:
                best = max(matches, key=lambda x: (self.confidence_score(x['confidence']), x['match_weight']))
                signals.append({
                    'source': 'reddit',
                    'feed': f"r/{alert.get('subreddit', 'unknown')}",
                    'title': alert.get('title', '')[:80],
                    'url': alert.get('url', ''),
                    'timestamp': alert.get('timestamp', ''),
                    'pattern_id': best['pattern_id'],
                    'pattern': best['pattern_name'],
                    'category': best['category'],
                    'confidence': best['confidence'],
                    'time_horizon': best['time_horizon'],
                    'score': alert.get('score', 0),
                    'signal_score': self.confidence_score(best['confidence']) * best['match_weight']
                })
        
        signals.sort(key=lambda x: x['signal_score'], reverse=True)
        return signals[:50]  # Increased from 25 to capture more categories
    
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
