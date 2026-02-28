#!/usr/bin/env python3
"""
Reasoning Engine: Enhanced signal analysis with confidence scoring and time horizon
Integrates with Knowledge Graph for outcome prediction
"""
import json
import os
from datetime import datetime
from typing import List, Dict

# Import knowledge graph
import sys
sys.path.insert(0, 'src')
from knowledge_graph import KnowledgeGraph

# Import accuracy tracker
from accuracy_tracker import AccuracyTracker

class ReasoningEngine:
    def __init__(self):
        self.patterns = []
        self.signals = []
        self.kg = KnowledgeGraph()  # Initialize knowledge graph
        self.minimum_actionable_score = 50.0
        self.load_data()
    
    def load_data(self):
        """Load patterns and signals"""
        with open('data/patterns.json', 'r') as f:
            self.patterns = json.load(f)['patterns']
        
        if os.path.exists('data/signals.json'):
            with open('data/signals.json', 'r') as f:
                self.signals = json.load(f)
    
    def calculate_source_credibility(self, source: str) -> float:
        """Calculate source credibility score (0-1)"""
        credibility = {
            # RSS Sources (higher = more reliable)
            'reuters': 0.95,
            'financial_times': 0.90,
            'market_watch': 0.75,
            'business': 0.70,
            'financialjuice': 0.65,
            'zerohedge': 0.55,
            'techcrunch': 0.50,
            'the_verge': 0.45,
            'ycombinator': 0.40,
            'unusualwhales': 0.40,
            # Reddit (lower = more noisy)
            'r/wallstreetbets': 0.30,
            'r/investing': 0.50,
            'r/options': 0.45,
            'r/stockmarket': 0.45,
            'r/securityanalysis': 0.60
        }
        return credibility.get(source.lower(), 0.50)
    
    def calculate_pattern_strength(self, pattern_id: str) -> float:
        """Calculate historical pattern strength (0-1)"""
        for p in self.patterns:
            if p['id'] == pattern_id:
                conf = p.get('confidence', 'MEDIUM')
                mapping = {'HIGH': 0.90, 'MEDIUM_HIGH': 0.70, 'MEDIUM': 0.50, 'LOW': 0.30}
                return mapping.get(conf, 0.50)
        return 0.50
    
    def calculate_time_horizon_score(self, signal: Dict) -> float:
        """Score how well signal matches expected time horizon"""
        # Get pattern's typical time horizon
        for p in self.patterns:
            if p['name'] == signal.get('pattern'):
                expected_horizon = p.get('time_horizon', 'short-term')
                # Simple scoring - can be enhanced
                return 1.0 if expected_horizon else 0.7
        return 0.5
    
    def calculate_reasoning_score(self, signal: Dict) -> Dict:
        """Calculate overall reasoning score for a signal"""
        source = signal.get('feed', '')
        pattern_id = signal.get('pattern_id', '')

        # Find matching pattern
        matched_pattern = None
        for p in self.patterns:
            if p['name'] == signal.get('pattern') or p['id'] == pattern_id:
                matched_pattern = p
                break

        # Component scores
        source_cred = self.calculate_source_credibility(source)
        pattern_strength = self.calculate_pattern_strength(matched_pattern['id']) if matched_pattern else 0.5
        horizon_score = self.calculate_time_horizon_score(signal)

        # Weighted final score
        # Source credibility: 30%, Pattern strength: 50%, Time horizon: 20%
        final_score = (source_cred * 0.30) + (pattern_strength * 0.50) + (horizon_score * 0.20)
        score_100 = round(final_score * 100, 1)

        return {
            'reasoning_score': score_100,
            'components': {
                'source_credibility': round(source_cred * 100, 1),
                'pattern_strength': round(pattern_strength * 100, 1),
                'time_horizon_fit': round(horizon_score * 100, 1)
            },
            'confidence_level': self.get_confidence_label(score_100),
            'recommendation': 'TAKE' if score_100 >= self.minimum_actionable_score else 'SKIP',
            'reasoning': self.generate_reasoning(source_cred, pattern_strength, matched_pattern, signal)
        }
    
    def get_confidence_label(self, score_100: float) -> str:
        if score_100 >= 75:
            return "STRONG BUY"
        elif score_100 >= 60:
            return "BUY"
        elif score_100 >= self.minimum_actionable_score:
            return "HOLD"
        elif score_100 >= 35:
            return "WEAK"
        else:
            return "SKIP"
    
    def generate_reasoning(self, source_cred: float, pattern_strength: float, pattern: Dict, signal: Dict) -> str:
        """Generate human-readable reasoning"""
        reasons = []
        
        # Source analysis
        if source_cred >= 0.7:
            reasons.append("high-credibility source")
        elif source_cred >= 0.5:
            reasons.append("moderate source")
        else:
            reasons.append("social media - verify independently")
        
        # Pattern analysis
        if pattern_strength >= 0.7:
            reasons.append("strong historical pattern match")
        elif pattern_strength >= 0.5:
            reasons.append("moderate pattern match")
        else:
            reasons.append("weak historical precedent")
        
        return f"{', '.join(reasons)}."
    
    def build_fallback_predictions(self, signal: Dict) -> Dict:
        """Generate causal chains even when KG has sparse coverage."""
        category = signal.get('category', '')
        text = f"{signal.get('title', '')} {signal.get('pattern', '')}".lower()

        templates = {
            'financial_credit': {
                'causal_chain': ['Funding stress', 'Credit spreads widen', 'Bank equities underperform', 'Policy support expectations rise'],
                'outcomes': ['financials_volatility', 'treasury_bid', 'credit_tightening']
            },
            'corporate': {
                'causal_chain': ['Earnings/deal catalyst', 'Sector repricing', 'Analyst estimate revisions', 'Momentum continuation/reversal'],
                'outcomes': ['single_name_gap_move', 'sector_rotation', 'options_iv_spike']
            },
            'macroeconomic': {
                'causal_chain': ['Macro print/policy signal', 'Rates reprice', 'USD and yields react', 'Risk assets rotate'],
                'outcomes': ['rates_volatility', 'fx_move', 'equity_factor_rotation']
            },
            'sentiment_social': {
                'causal_chain': ['Retail/social narrative acceleration', 'Options positioning imbalance', 'Dealer hedging feedback loop', 'Sharp squeeze or unwind'],
                'outcomes': ['short_squeeze_risk', 'gamma_instability', 'intraday_mean_reversion']
            }
        }

        selected = templates.get(category, {
            'causal_chain': ['Headline catalyst', 'Positioning adjustment', 'Cross-asset reaction'],
            'outcomes': ['volatility_spike', 'risk_repricing']
        })

        if 'merger' in text or 'acquisition' in text or 'buyout' in text:
            selected = {
                'causal_chain': ['Deal headline', 'Spread trading and arb positioning', 'Sector peer sympathy moves'],
                'outcomes': ['mna_spread_widening', 'peer_repricing', 'deal_completion_probability_updates']
            }
        elif 'cpi' in text or 'fed' in text or 'fomc' in text or 'rate' in text:
            selected = {
                'causal_chain': ['Inflation/rates surprise', 'Bond market reprices terminal rate', 'Equity duration factor moves'],
                'outcomes': ['front_end_yield_move', 'usd_trend_shift', 'growth_value_rotation']
            }
        elif 'short squeeze' in text or 'gamma squeeze' in text:
            selected = {
                'causal_chain': ['Crowded short setup', 'Call buying surge', 'Dealer hedging amplifies upside'],
                'outcomes': ['forced_covering', 'borrow_fee_spike', 'volatility_clustering']
            }

        return selected

    def analyze_signals(self) -> List[Dict]:
        """Apply reasoning to all signals"""
        enhanced_signals = []

        for signal in self.signals:
            reasoning = self.calculate_reasoning_score(signal)

            graph_outcomes = self.kg.predict_outcomes(signal.get('pattern', ''))
            root_causes = self.kg.find_root_causes(signal.get('pattern', ''))
            fallback = self.build_fallback_predictions(signal)

            predicted_outcomes = list(dict.fromkeys(graph_outcomes + fallback['outcomes']))[:8]

            enhanced = {
                **signal,
                'reasoning_score': reasoning['reasoning_score'],
                'confidence_level': reasoning['confidence_level'],
                'recommendation': reasoning['recommendation'],
                'reasoning_components': reasoning['components'],
                'reasoning': reasoning['reasoning'],
                'predicted_outcomes': predicted_outcomes,
                'predicted_causal_chain': fallback['causal_chain'],
                'root_causes': root_causes,
                'timestamp': datetime.now().isoformat()
            }
            enhanced_signals.append(enhanced)

        # Sort by reasoning score
        enhanced_signals.sort(key=lambda x: x['reasoning_score'], reverse=True)
        return enhanced_signals
    
    def print_analysis(self, signals: List[Dict]):
        """Print reasoning analysis"""
        print("=== MARKET INTEL: REASONING ANALYSIS ===\n")
        
        strong = [s for s in signals if s['confidence_level'] == 'STRONG BUY']
        buy = [s for s in signals if s['confidence_level'] == 'BUY']
        hold = [s for s in signals if s['confidence_level'] == 'HOLD']
        
        print(f"📊 Total: {len(signals)}")
        print(f"   🟢 STRONG BUY: {len(strong)}")
        print(f"   🟢 BUY: {len(buy)}")
        print(f"   🟡 HOLD: {len(hold)}\n")
        
        # Show top 5 with reasoning
        print("🎯 TOP SIGNALS WITH REASONING:\n")
        for s in signals[:5]:
            print(f"[{s['confidence_level']}] {s['reasoning_score']:.0f}/100")
            print(f"  {s['title'][:60]}...")
            print(f"  Source: {s['feed']}")
            print(f"  Reasoning: {s['reasoning']}")
            
            if s.get('predicted_outcomes'):
                print(f"  📈 Predicted: {' → '.join(s['predicted_outcomes'][:3])}")
            
            print()
    
    def save(self, signals: List[Dict]):
        """Save enhanced signals"""
        with open('data/enhanced_signals.json', 'w') as f:
            json.dump(signals, f, indent=2)
    
    def run(self):
        """Run reasoning engine"""
        print("=== Running Reasoning Engine ===\n")
        
        if not self.signals:
            print("No signals to analyze. Run signal_generator.py first.")
            return []
        
        enhanced = self.analyze_signals()
        self.print_analysis(enhanced)
        self.save(enhanced)
        
        # Auto-track top HIGH confidence signals
        tracker = AccuracyTracker()
        tracker.auto_track_top_signals()
        
        print(f"✓ Saved {len(enhanced)} enhanced signals to data/enhanced_signals.json")
        return enhanced


if __name__ == "__main__":
    engine = ReasoningEngine()
    engine.run()
