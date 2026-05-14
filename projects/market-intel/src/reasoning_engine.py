#!/usr/bin/env python3
"""
Reasoning Engine: Enhanced signal analysis with confidence scoring and time horizon
Integrates with Knowledge Graph for outcome prediction
"""
import json
import os
from pathlib import Path
from datetime import datetime
from typing import List, Dict

# Import knowledge graph
import sys
sys.path.insert(0, 'src')
from knowledge_graph import KnowledgeGraph

# Import accuracy tracker
from accuracy_tracker import AccuracyTracker
from value_chain_tagger import enrich_signals

class ReasoningEngine:
    def __init__(self):
        self.patterns = []
        self.signals = []
        self.feedback = {}
        self.kg = KnowledgeGraph()  # Initialize knowledge graph
        self.minimum_actionable_score = 60.0
        self.minimum_feedback_sample_size = 20
        self.minimum_bucket_sample_size = 5
        self.data_dir = Path(__file__).resolve().parent.parent / 'data'
        self.load_data()

    def canonical_source(self, source: str) -> str:
        """Normalize feed names to the credibility-map namespace."""
        value = (source or '').strip().lower().replace('-', '_').replace(' ', '_')
        aliases = {
            'reuters_finance': 'reuters',
            'reuters_business': 'reuters',
            'reuters_breakingviews': 'reuters',
            'reuters_breaking_views': 'reuters',
            'financial_times': 'financial_times',
            'ft': 'financial_times',
            'ap_top': 'ap_top',
            'associated_press': 'ap_top',
            'business_bloomberg': 'business',
            'bloomberg': 'business',
            'marketwatch': 'market_watch',
            'market_watch': 'market_watch',
            'financialjuice': 'financialjuice',
            'firstsquawk': 'financialjuice',
            'deltaone': 'financialjuice',
            'unusual_whales': 'unusualwhales',
        }
        return aliases.get(value, value)
    
    def load_data(self):
        """Load patterns and signals"""
        patterns_path = self.data_dir / 'patterns.json'
        signals_path = self.data_dir / 'signals.json'
        feedback_path = self.data_dir / 'model_feedback.json'

        with patterns_path.open('r') as f:
            self.patterns = json.load(f)['patterns']
        
        if signals_path.exists():
            with signals_path.open('r') as f:
                self.signals = json.load(f)

        if feedback_path.exists():
            with feedback_path.open('r') as f:
                self.feedback = json.load(f)
    
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
        return credibility.get(self.canonical_source(source), 0.50)
    
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
    
    def get_feedback_bias(self, signal: Dict) -> Dict:
        """Return bias points learned from validated historical outcomes."""
        if not self.feedback:
            return {
                'category_bias_points': 0.0,
                'pattern_bias_points': 0.0,
                'total_bias_points': 0.0,
                'feedback_sample_size': 0,
            }

        category = (signal.get('category') or '').lower()
        pattern = signal.get('pattern') or signal.get('pattern_id') or ''

        feedback_sample_size = int(self.feedback.get('sample_size', 0) or 0)
        category_bucket = self.feedback.get('by_category', {}).get(category, {})
        pattern_bucket = self.feedback.get('by_pattern', {}).get(pattern, {})
        category_count = int(category_bucket.get('count', 0) or 0)
        pattern_count = int(pattern_bucket.get('count', 0) or 0)

        if feedback_sample_size < self.minimum_feedback_sample_size:
            return {
                'category_bias_points': 0.0,
                'pattern_bias_points': 0.0,
                'total_bias_points': 0.0,
                'feedback_sample_size': feedback_sample_size,
                'feedback_status': 'insufficient_sample',
            }

        category_bias = category_bucket.get('bias_points', 0.0) if category_count >= self.minimum_bucket_sample_size else 0.0
        pattern_bias = pattern_bucket.get('bias_points', 0.0) if pattern_count >= self.minimum_bucket_sample_size else 0.0

        # keep small and stable so learned feedback nudges, not dominates
        total = max(-7.5, min(7.5, category_bias + (0.7 * pattern_bias)))
        return {
            'category_bias_points': round(category_bias, 2),
            'pattern_bias_points': round(pattern_bias, 2),
            'total_bias_points': round(total, 2),
            'feedback_sample_size': feedback_sample_size,
            'feedback_status': 'applied',
        }

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

        # Weighted base score
        # Source credibility: 30%, Pattern strength: 50%, Time horizon: 20%
        final_score = (source_cred * 0.30) + (pattern_strength * 0.50) + (horizon_score * 0.20)
        base_score_100 = round(final_score * 100, 1)

        feedback_bias = self.get_feedback_bias(signal)
        score_100 = round(max(0.0, min(100.0, base_score_100 + feedback_bias['total_bias_points'])), 1)

        return {
            'reasoning_score': score_100,
            'components': {
                'source_credibility': round(source_cred * 100, 1),
                'pattern_strength': round(pattern_strength * 100, 1),
                'time_horizon_fit': round(horizon_score * 100, 1),
                'base_score': base_score_100,
                'feedback_bias_points': feedback_bias['total_bias_points'],
                'feedback_sample_size': feedback_bias['feedback_sample_size'],
                'feedback_status': feedback_bias.get('feedback_status', 'none')
            },
            'confidence_level': self.get_confidence_label(score_100),
            'recommendation': 'TAKE' if score_100 >= self.minimum_actionable_score else 'SKIP',
            'reasoning': self.generate_reasoning(source_cred, pattern_strength, matched_pattern, signal)
        }
    
    def get_confidence_label(self, score_100: float) -> str:
        if score_100 >= 75:
            return "HIGH_PRIORITY"
        elif score_100 >= 60:
            return "WATCH"
        elif score_100 >= 50:
            return "OBSERVE"
        elif score_100 >= 35:
            return "LOW_CONFIDENCE"
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
            
            # Get detailed predictions with briefings
            kg_predictions = self.kg.predict_signal_outcomes(signal)
            predicted_outcomes = list(dict.fromkeys(graph_outcomes + fallback['outcomes']))[:8]
            
            # Extract briefing if available
            signal_briefing = ''
            if kg_predictions and kg_predictions[0].get('briefing'):
                signal_briefing = kg_predictions[0]['briefing']

            enhanced = {
                **signal,
                'reasoning_score': reasoning['reasoning_score'],
                'confidence_level': reasoning['confidence_level'],
                'recommendation': reasoning['recommendation'],
                'reasoning_components': reasoning['components'],
                'reasoning': reasoning['reasoning'],
                'predicted_outcomes': predicted_outcomes,
                'predicted_causal_chain': fallback['causal_chain'],
                'signal_briefing': signal_briefing,
                'root_causes': root_causes,
                'timestamp': datetime.now().isoformat()
            }
            enhanced_signals.append(enhanced)

        # Add structural value-chain fields before downstream consumers read the file.
        enhanced_signals = enrich_signals(enhanced_signals)

        # Sort by reasoning score
        enhanced_signals.sort(key=lambda x: x['reasoning_score'], reverse=True)
        return enhanced_signals
    
    def print_analysis(self, signals: List[Dict]):
        """Print reasoning analysis"""
        print("=== MARKET INTEL: REASONING ANALYSIS ===\n")
        
        strong = [s for s in signals if s['confidence_level'] == 'HIGH_PRIORITY']
        buy = [s for s in signals if s['confidence_level'] == 'WATCH']
        hold = [s for s in signals if s['confidence_level'] == 'OBSERVE']
        
        print(f"📊 Total: {len(signals)}")
        print(f"   🟢 HIGH_PRIORITY: {len(strong)}")
        print(f"   🟢 WATCH: {len(buy)}")
        print(f"   🟡 OBSERVE: {len(hold)}\n")
        
        # Show top 5 with reasoning
        print("🎯 TOP SIGNALS WITH REASONING:\n")
        for s in signals[:5]:
            print(f"[{s['confidence_level']}] {s['reasoning_score']:.0f}/100")
            print(f"  {s['title'][:60]}...")
            print(f"  Source: {s['feed']}")
            print(f"  Reasoning: {s['reasoning']}")

            chain_layer = s.get('chain_layer')
            if chain_layer and chain_layer != 'none_clear':
                chain_bits = [chain_layer]
                if s.get('chain_sublayer') and s.get('chain_sublayer') != 'none_clear':
                    chain_bits.append(s['chain_sublayer'])
                print(f"  🧭 Chain: {' / '.join(chain_bits)}")

            structural_bits = []
            if s.get('bottleneck_type') and s.get('bottleneck_type') != 'none_clear':
                structural_bits.append(f"bottleneck={s['bottleneck_type']}")
            if s.get('moat_type') and s.get('moat_type') != 'none_clear':
                structural_bits.append(f"moat={s['moat_type']}")
            if s.get('fragility_type') and s.get('fragility_type') != 'none_clear':
                structural_bits.append(f"fragility={s['fragility_type']}")
            if structural_bits:
                print(f"  🏗️ Structure: {', '.join(structural_bits)}")

            market_bits = []
            if s.get('beneficiary_class') and s.get('beneficiary_class') != 'none_clear':
                market_bits.append(f"beneficiary={s['beneficiary_class']}")
            if s.get('loser_class') and s.get('loser_class') != 'none_clear':
                market_bits.append(f"fragile={s['loser_class']}")
            if market_bits:
                print(f"  ⚖️ Positioning: {', '.join(market_bits)}")
            
            if s.get('predicted_outcomes'):
                print(f"  📈 Predicted: {' → '.join(s['predicted_outcomes'][:3])}")
            
            if s.get('signal_briefing'):
                print(f"  💡 {s['signal_briefing']}")
            if s.get('value_chain_notes'):
                print(f"  🔎 {s['value_chain_notes']}")
            
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
