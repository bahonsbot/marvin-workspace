#!/usr/bin/env python3
"""
Signal Generator: Matches RSS/Reddit alerts against historical patterns
Generates actionable market signals
"""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Tuple, Optional

# Import context manager for cron pipeline
sys.path.insert(0, str(Path(__file__).parent))
from cron_context import CronContext

class SignalGenerator:
    def __init__(self):
        self.base_dir = Path(__file__).resolve().parents[1]
        self.patterns = []
        self.rss_alerts = []
        self.reddit_alerts = []
        self.load_data()

    def resolve_path(self, path: str) -> Path:
        p = Path(path)
        if p.is_absolute():
            return p
        return self.base_dir / p
    
    def load_data(self):
        """Load patterns and alerts"""
        patterns_path = self.resolve_path('data/patterns.json')
        with patterns_path.open('r', encoding='utf-8') as f:
            data = json.load(f)
            self.patterns = data['patterns']

        rss_path = self.resolve_path('data/rss_alerts.json')
        if rss_path.exists():
            with rss_path.open('r', encoding='utf-8') as f:
                self.rss_alerts = json.load(f)

        reddit_path = self.resolve_path('data/reddit_alerts.json')
        if reddit_path.exists():
            with reddit_path.open('r', encoding='utf-8') as f:
                self.reddit_alerts = json.load(f)
    
    def _alert_text_baseline(self, alert: Dict) -> str:
        """Original matching corpus (no enrichment influence)."""
        source = (alert.get('source') or '').lower()
        if source == 'reddit' or 'subreddit' in alert:
            parts = [alert.get('title', '')]
        else:
            parts = [alert.get('title', ''), alert.get('summary', '')]
        return ' '.join(p for p in parts if p).lower()

    def _clean_reddit_enrichment_text(self, text: str) -> str:
        """Strip common Reddit enrichment boilerplate/noise before matching."""
        if not text:
            return ''
        cleaned = text
        boilerplate_patterns = [
            r'\*\*user report\*\*[\s\S]*?(?:discord\.gg/\S+)?',
            r'join wsb discord',
            r'first seen in wsb',
            r'total submissions',
            r'total comments',
            r'previous best dd',
            r'account age',
            r'this post contains content not supported on old reddit.*',
        ]
        for pat in boilerplate_patterns:
            cleaned = re.sub(pat, ' ', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'https?://\S+', ' ', cleaned)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned

    def _alert_text_enriched(self, alert: Dict) -> str:
        """Enriched matching corpus with Reddit-specific noise control."""
        source = (alert.get('source') or '').lower()
        is_reddit = source == 'reddit' or 'subreddit' in alert

        if is_reddit:
            parts = [
                alert.get('title', ''),
                alert.get('selftext_snippet', '') or alert.get('selftext', ''),
                alert.get('article_excerpt', ''),
                alert.get('top_comment_snippet', ''),
            ]
            cleaned_parts = []
            seen = set()
            for part in parts:
                cleaned = self._clean_reddit_enrichment_text(str(part))
                if cleaned and cleaned not in seen:
                    cleaned_parts.append(cleaned)
                    seen.add(cleaned)
            return ' '.join(cleaned_parts).lower()

        parts = [
            alert.get('title', ''),
            alert.get('summary', ''),
            alert.get('selftext', ''),
            alert.get('selftext_snippet', ''),
            alert.get('article_excerpt', ''),
            alert.get('top_comment_snippet', ''),
        ]
        top_comments = alert.get('top_comments') or []
        if isinstance(top_comments, list):
            parts.append(' '.join(str(x) for x in top_comments if isinstance(x, str)))
        return ' '.join(p for p in parts if p).lower()

    def _phrase_in_text(self, phrase: str, text: str) -> bool:
        """Match phrases on token boundaries instead of raw substrings."""
        phrase = (phrase or '').strip().lower()
        if not phrase:
            return False
        pattern = r'(?<![a-z0-9])' + re.escape(phrase) + r'(?![a-z0-9])'
        return re.search(pattern, text, flags=re.IGNORECASE) is not None

    def _pattern_context_ok(self, pattern_id: str, matched_keyword: str, text: str) -> bool:
        """Require extra context for historically noisy keyword families."""
        matched_keyword = (matched_keyword or '').lower()

        if pattern_id == 'p005':  # meme / squeeze signals
            meme_context = [
                'short squeeze', 'gamma squeeze', 'meme stock', 'gamestop', 'gme',
                'amc', 'bbby', 'robinhood', 'short interest', 'borrow fee',
                'call buying', 'calls surge', 'retail traders', 'reddit rally'
            ]
            noisy_keywords = {'navy', 'chewy', 'retail investors'}
            if matched_keyword in noisy_keywords:
                return any(self._phrase_in_text(term, text) for term in meme_context)

        if pattern_id == 'p018':  # regional bank / credit stress
            broad_credit_terms = {'private credit', 'bank deposits', 'merchant bank', 'bank stocks'}
            stress_context = [
                'deposit outflows', 'funding pressure', 'liquidity crunch', 'bank run',
                'bank failure', 'bank collapse', 'fdic', 'credit spread widening',
                'regional banking crisis', 'interbank stress', 'credit crunch'
            ]
            if matched_keyword in broad_credit_terms:
                return any(self._phrase_in_text(term, text) for term in stress_context)

        return True

    def match_alert_to_patterns(self, alert: Dict, use_enriched: bool = False) -> List[Dict]:
        """Match an alert to relevant patterns.

        use_enriched=False keeps legacy behavior for A/B testing.
        """
        matches = []
        text = self._alert_text_enriched(alert) if use_enriched else self._alert_text_baseline(alert)
        
        # Pattern-specific keywords with scoring - REFINED
        pattern_keywords = {
            'p001': {  # Saudi Oil - ONLY Middle East
                'keywords': ['saudi', 'opec', 'abqaiq', 'khurais', 'aramco', 'gulf oil'],
                'exclude': ['ukraine', 'russia', 'drone strike', 'military facility'],
                'weight': 3
            },
            'p002': {  # Russia-Ukraine / war escalation, sanctions, energy spillover
                'keywords': [
                    'ukraine', 'kyiv', 'zelenskiy', 'zelensky', 'donbas', 'crimea',
                    'russia invad', 'russian invasion', 'russia-ukraine', 'ukraine war',
                    'moscow missile', 'sanctions on russia', 'eu sanctions', 'g7 sanctions',
                    'black sea grain', 'nord stream', 'europe gas crisis'
                ],
                'exclude': ['saudi', 'opec', 'middle east', 'cuba', 'gallium', 'germanium'],
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
                    'gme', 'gamestop', 'short squeeze', 'meme stock',
                    'gamma squeeze', 'call buying frenzy', 'retail traders pile', 'days to cover',
                    'amc', 'bbby', 'bed bath', 'robinhood', 'meme rally', 'reddit rally',
                    'short interest', 'navy', 'chewy', 'retail investors', 'options call',
                    'calls surge', 'volume surge', 'meme basket'
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
            'p010': {  # Single-name catalyst momentum
                'keywords': [
                    'tesla', 'tsla', 'stock split', '5-for-1', '3-for-1',
                    'profit warning', 'guidance raised', 'guidance cut', 'outlook raised', 'outlook cut',
                    'take-private', 'buyout bid', 'sale of company', 'strategic review',
                    'ceo resigns', 'chief executive resigns', 'board shakeup',
                    'index inclusion', 'sp500 inclusion', 'activist stake'
                ],
                'exclude': ['broad market', 'macro outlook', 'fed'],
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
            'p014': {  # US macro / rates regime stress (kept under existing id)
                'keywords': [
                    's&p downgrade', 'credit rating', 'aaa downgrade',
                    'federal reserve', 'fed chair', 'jerome powell', 'fed minutes', 'fomc',
                    'cpi', 'core cpi', 'pce inflation', 'inflation data', 'consumer prices',
                    'rate hike', 'rate cut', 'rate decision', 'fed funds rate',
                    'treasury yield', 'yield spike', 'yield curve inversion', '10-year yield', '2-year yield',
                    'recession fears', 'hard landing', 'soft landing', 'gdp slowdown',
                    'jobs report', 'nonfarm payroll', 'labor market cooling',
                    'monetary policy'
                ],
                'exclude': ['x-date', 'debt ceiling', 'extraordinary measures', 't-bill', 'default risk'],
                'weight': 2
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
            'p024': {  # Retail options positioning instability
                'keywords': [
                    'gamma squeeze', '0dte', 'dealer gamma', 'dealer hedging', 'unusual options activity',
                    'call sweep', 'put sweep', 'short-dated options', 'options positioning',
                    'volatility squeeze', 'days to cover', 'forced covering'
                ],
                'exclude': ['iron condor', 'credit spread tutorial', 'options strategy guide'],
                'weight': 2
            },
            'p035': {  # Red Sea shipping disruption
                'keywords': ['red sea', 'houthi', 'bab el-mandeb', 'suez traffic', 'shipping reroute', 'rerouting around africa', 'shipping insurance'],
                'exclude': ['tourism', 'cruise'],
                'weight': 3
            },
            'p036': {  # US debt ceiling X-date stress
                'keywords': ['x-date', 'debt ceiling', 'extraordinary measures', 't-bill stress', 'treasury cash balance', 'default risk'],
                'exclude': ['corporate debt ceiling', 'household debt'],
                'weight': 3
            },
            'p037': {  # Treasury dash for cash / basis unwind
                'keywords': ['dash for cash', 'basis trade', 'treasury market dislocation', 'repo stress', 'funding liquidity', 'forced unwind'],
                'exclude': [],
                'weight': 3
            },
            'p038': {  # AI packaging bottleneck
                'keywords': ['cowos', 'advanced packaging', 'packaging bottleneck', 'tsmc capacity', 'blackwell delay', 'ai server backlog'],
                'exclude': ['consumer packaging'],
                'weight': 3
            },
            'p039': {  # AI memory / HBM shortage
                'keywords': ['hbm shortage', 'high bandwidth memory', 'dram price spike', 'server memory shortage', 'memory supply crunch', 'sk hynix'],
                'exclude': ['pc memory upgrade'],
                'weight': 3
            },
            'p040': {  # China critical minerals export controls
                'keywords': ['gallium', 'germanium', 'antimony export', 'chipmaking materials', 'export controls on metals', 'export licensing'],
                'exclude': ['gallium nitride product launch'],
                'weight': 3
            },
            'p041': {  # Consumer trade-down / retail margin shock
                'keywords': ['trade down', 'essentials over discretionary', 'retail margin warning', 'inventory glut', 'consumer pullback', 'discretionary purchases'],
                'exclude': [],
                'weight': 3
            },
            'p042': {  # Ever Given / Suez blockage
                'keywords': ['ever given', 'suez blockage', 'suez canal blockage', 'grounded vessel', 'queue of ships', 'canal closure'],
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
                if self._phrase_in_text(kw, text):
                    # Check exclusions - skip if any exclusion keyword found
                    should_exclude = False
                    for exc in excludes:
                        if self._phrase_in_text(exc, text):
                            should_exclude = True
                            break
                    
                    if not should_exclude and self._pattern_context_ok(pattern['id'], kw, text):
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
    
    def generate_signals(self, use_enriched: bool = False) -> List[Dict]:
        """Generate signals from all alerts.

        use_enriched=False keeps production behavior in testing phase.
        """
        signals = []

        for alert in self.rss_alerts[:120]:
            matches = self.match_alert_to_patterns(alert, use_enriched=use_enriched)
            if matches:
                best = max(matches, key=lambda x: (self.confidence_score(x['confidence']), x['match_weight'], len(x.get('matched_keyword', ''))))
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
            matches = self.match_alert_to_patterns(alert, use_enriched=use_enriched)
            if matches:
                best = max(matches, key=lambda x: (self.confidence_score(x['confidence']), x['match_weight'], len(x.get('matched_keyword', ''))))
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
        output_path = self.resolve_path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open('w', encoding='utf-8') as f:
            json.dump(signals, f, indent=2)

    def compare_signal_sets(self, baseline: List[Dict], enriched: List[Dict]) -> Dict:
        """Build lightweight A/B comparison metrics."""
        def key(s: Dict) -> Tuple[str, str, str]:
            return (s.get('source', ''), s.get('title', ''), s.get('pattern_id', ''))

        bset = {key(s) for s in baseline}
        eset = {key(s) for s in enriched}
        overlap = len(bset & eset)

        return {
            'timestamp': datetime.now().isoformat(),
            'baseline_count': len(baseline),
            'enriched_count': len(enriched),
            'overlap_count': overlap,
            'baseline_only_count': len(bset - eset),
            'enriched_only_count': len(eset - bset),
            'enriched_lift': len(eset - bset),
            'baseline_top5': [s.get('title', '') for s in baseline[:5]],
            'enriched_top5': [s.get('title', '') for s in enriched[:5]],
        }

    def print_summary(self, signals: List[Dict], label: str = "PRODUCTION"):
        print(f"=== MARKET INTEL SIGNALS ({label}) ===\n")
        
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

        mode = os.environ.get('MI_ENRICHMENT_MODE', 'shadow').strip().lower()
        # Modes:
        # - shadow (default): production stays baseline; enriched run saved for A/B comparison only
        # - baseline: baseline only
        # - enriched: enriched only (explicit opt-in)

        if mode == 'enriched':
            signals = self.generate_signals(use_enriched=True)
            if signals:
                self.print_summary(signals, label='ENRICHED')
                self.save_signals(signals)
                print(f"✓ Saved {len(signals)} signals to data/signals.json (enriched mode)")
            else:
                print("No signals generated - run RSS and Reddit monitors first.")
            return signals

        baseline = self.generate_signals(use_enriched=False)
        if not baseline:
            print("No signals generated - run RSS and Reddit monitors first.")
            return []

        self.print_summary(baseline, label='BASELINE')
        self.save_signals(baseline)
        print(f"✓ Saved {len(baseline)} signals to data/signals.json (baseline production)")

        if mode == 'shadow':
            enriched = self.generate_signals(use_enriched=True)
            self.save_signals(enriched, output_file='data/signals_enriched_shadow.json')
            comparison = self.compare_signal_sets(baseline, enriched)
            self.save_signals([comparison], output_file='data/signal_ab_comparison.json')
            print(
                "✓ Shadow A/B: "
                f"baseline={comparison['baseline_count']} | "
                f"enriched={comparison['enriched_count']} | "
                f"overlap={comparison['overlap_count']} | "
                f"enriched_only={comparison['enriched_only_count']}"
            )
            print("  Saved: data/signals_enriched_shadow.json + data/signal_ab_comparison.json")

        # Write to shared cron context for pipeline
        self._update_cron_context(baseline, enriched if mode == 'shadow' else None)

        return baseline

    def _update_cron_context(self, baseline: List[Dict], enriched: Optional[List[Dict]] = None) -> None:
        """Update shared cron context with signal generation results."""
        try:
            ctx = CronContext.load()
            
            # Count by confidence
            high_count = len([s for s in baseline if s.get('confidence') == 'HIGH'])
            strong_buy_count = len([s for s in baseline if s.get('confidence_level') in {'HIGH_PRIORITY', 'STRONG BUY'}])
            buy_count = len([s for s in baseline if s.get('confidence_level') in {'WATCH', 'BUY'}])
            hold_count = len([s for s in baseline if s.get('confidence_level') in {'OBSERVE', 'HOLD'}])
            
            # Count by category
            categories = {}
            for s in baseline:
                cat = s.get('category', 'unknown')
                categories[cat] = categories.get(cat, 0) + 1
            
            signals_generated = len(baseline)
            summary = f"{signals_generated} signals generated ({strong_buy_count} high priority, {buy_count} watch, {hold_count} observe). Top categories: {', '.join([f'{k}={v}' for k, v in sorted(categories.items(), key=lambda x: x[1], reverse=True)[:3]])}"
            
            ctx.update_job('market-signal-generator', {
                'last_run': datetime.now(timezone.utc).isoformat(),
                'status': 'ok',
                'signals_generated': signals_generated,
                'summary': summary,
                'context': {
                    'by_confidence': {
                        'HIGH_PRIORITY': strong_buy_count,
                        'WATCH': buy_count,
                        'OBSERVE': hold_count,
                        'HIGH_confidence': high_count
                    },
                    'by_category': categories,
                    'shadow_mode': enriched is not None,
                    'enriched_count': len(enriched) if enriched else None
                }
            })
            
            ctx.save()
            print("✓ Updated cron-context.json")
        except Exception as e:
            print(f"⚠️  Failed to update cron context: {e}")


if __name__ == "__main__":
    generator = SignalGenerator()
    generator.run()
