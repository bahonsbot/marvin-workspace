#!/usr/bin/env python3
"""
Signal Accuracy Tracker: Tracks signal accuracy over time
"""
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

class AccuracyTracker:
    OUTCOME_SCORE = {
        'strong buy': 1.0,
        'buy': 0.75,
        'hold': 0.5,
        'miss': 0.0,
        'incorrect': 0.0,
        'partial': 0.5,
        'correct': 1.0,
    }
    STOPWORDS = {
        'about', 'after', 'against', 'amid', 'and', 'are', 'but', 'can', 'could',
        'from', 'into', 'near', 'over', 'said', 'says', 'that', 'the', 'their',
        'this', 'through', 'with', 'would', 'will', 'while', 'what', 'when',
    }
    TOPIC_KEYWORDS = {
        'saudi_oil': {
            'saudi', 'aramco', 'opec', 'gulf', 'hormuz', 'iran', 'tehran',
            'riyadh', 'oil', 'crude', 'brent', 'tanker', 'tankers', 'middle east'
        },
        'russia_ukraine': {
            'russia', 'russian', 'ukraine', 'ukrainian', 'putin', 'kremlin',
            'zelensky', 'zelenskiy', 'kyiv', 'donetsk', 'ruble'
        },
        'fed_rates': {
            'fed', 'federal reserve', 'warsh', 'powell', 'fomc', 'inflation',
            'senate', 'rate cut', 'rate hike', 'treasury', 'yields'
        },
        'meme_squeeze': {
            'gamestop', 'gme', 'ebay', 'ryan cohen', 'short squeeze',
            'gamma squeeze', 'borrow fees', 'meme', 'retail traders'
        },
        'red_sea_shipping': {
            'houthi', 'red sea', 'suez', 'bab el-mandeb', 'shipping', 'container',
            'freight', 'reroute', 'rerouting'
        },
        'japan_shipping': {
            'nyk', 'japan', 'japanese', 'tanker', 'tankers', 'shipping'
        },
        'central_bank_independence': {
            'central bank', 'independence', 'ecb', 'fed', 'political pressure'
        },
    }
    CONFLICTING_TOPIC_PAIRS = {
        frozenset({'saudi_oil', 'russia_ukraine'}),
        frozenset({'meme_squeeze', 'fed_rates'}),
        frozenset({'meme_squeeze', 'saudi_oil'}),
        frozenset({'meme_squeeze', 'russia_ukraine'}),
        frozenset({'fed_rates', 'red_sea_shipping'}),
    }

    def __init__(self):
        self.data_dir = Path('data')
        self.tracked_file = self.data_dir / 'tracked_signals.json'
        self.review_ledger_file = self.data_dir / 'signal_review_ledger.jsonl'
        self.history_file = self.data_dir / 'signal_accuracy_history.json'
        self.feedback_file = self.data_dir / 'model_feedback.json'
        
        # Load tracked signals
        self.tracked: List[Dict[str, Any]] = []
        if self.tracked_file.exists():
            with open(self.tracked_file, 'r') as f:
                self.tracked = json.load(f)
    
    def _normalize_outcome(self, outcome: str) -> str:
        return (outcome or '').strip().lower()

    def _is_reviewed(self, row: Dict[str, Any]) -> bool:
        return bool(
            row.get('verified')
            or row.get('verified_at')
            or row.get('evaluated_at')
            or row.get('actual_outcome')
            or row.get('outcome')
        )

    def _is_duplicate(self, row: Dict[str, Any]) -> bool:
        outcome = self._normalize_outcome(row.get('outcome') or row.get('actual_outcome') or '')
        return outcome == 'duplicate'

    def _outcome_score(self, outcome: str) -> float:
        return self.OUTCOME_SCORE.get(self._normalize_outcome(outcome), 0.0)

    def _review_outcome(self, row: Dict[str, Any]) -> str:
        return self._normalize_outcome(row.get('actual_outcome', '') or row.get('outcome', ''))

    def _has_structured_evidence(self, row: Dict[str, Any]) -> bool:
        evidence = row.get('evidence_pack') or {}
        if not isinstance(evidence, dict):
            return False
        if not str(evidence.get('summary') or '').strip():
            return False

        drivers = evidence.get('drivers') or []
        sector_impact = evidence.get('sector_impact') or []
        metrics = evidence.get('metrics') or {}
        has_drivers = isinstance(drivers, list) and any(str(item).strip() for item in drivers)
        has_sector_impact = isinstance(sector_impact, list) and any(str(item).strip() for item in sector_impact)
        has_metrics = bool(metrics) if isinstance(metrics, dict) else bool(metrics)
        return has_drivers or has_sector_impact or has_metrics

    def _load_review_ledger(self) -> List[Dict[str, Any]]:
        if not self.review_ledger_file.exists():
            return []
        rows: List[Dict[str, Any]] = []
        with open(self.review_ledger_file, 'r') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    item = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if isinstance(item, dict):
                    rows.append(item)
        return rows

    def _review_corpus(self) -> List[Dict[str, Any]]:
        ledger = self._load_review_ledger()
        return ledger if ledger else self.tracked

    def _token_set(self, text: str) -> set[str]:
        tokens = set(re.findall(r"[a-z0-9][a-z0-9'/-]{2,}", (text or '').lower()))
        return {t for t in tokens if t not in self.STOPWORDS}

    def _flatten_values(self, value: Any) -> List[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [value]
        if isinstance(value, (int, float, bool)):
            return [str(value)]
        if isinstance(value, list):
            output: List[str] = []
            for item in value:
                output.extend(self._flatten_values(item))
            return output
        if isinstance(value, dict):
            output: List[str] = []
            for key, item in value.items():
                output.append(str(key))
                output.extend(self._flatten_values(item))
            return output
        return [str(value)]

    def _evidence_text(self, row: Dict[str, Any]) -> str:
        evidence = row.get('evidence_pack') or {}
        parts = self._flatten_values(evidence)
        parts.extend([
            str(row.get('verification_note') or ''),
            str(row.get('notes') or ''),
        ])
        return ' '.join(part for part in parts if part)

    def _signal_text(self, row: Dict[str, Any]) -> str:
        signal = row.get('signal') or {}
        parts = [
            signal.get('title'),
            signal.get('pattern'),
            signal.get('pattern_name'),
            signal.get('category'),
        ]
        return ' '.join(str(part) for part in parts if part)

    def _topic_hits(self, text: str) -> Dict[str, List[str]]:
        lowered = (text or '').lower()
        hits: Dict[str, List[str]] = {}
        for topic, terms in self.TOPIC_KEYWORDS.items():
            matched = []
            for term in terms:
                pattern = r'(?<![a-z0-9])' + re.escape(term.lower()) + r'(?![a-z0-9])'
                if re.search(pattern, lowered):
                    matched.append(term)
            if matched:
                hits[topic] = sorted(matched)
        return hits

    def _evidence_integrity_flags(self, row: Dict[str, Any]) -> List[Dict[str, Any]]:
        if not self._is_reviewed(row) or self._is_duplicate(row):
            return []

        signal_text = self._signal_text(row)
        evidence_text = self._evidence_text(row)
        if not signal_text.strip() or not evidence_text.strip():
            return []

        signal_topics = self._topic_hits(signal_text)
        evidence_topics = self._topic_hits(evidence_text)
        flags: List[Dict[str, Any]] = []

        for signal_topic in signal_topics:
            for evidence_topic in evidence_topics:
                if signal_topic == evidence_topic:
                    continue
                pair = frozenset({signal_topic, evidence_topic})
                if pair in self.CONFLICTING_TOPIC_PAIRS:
                    signal_terms = signal_topics[signal_topic]
                    evidence_terms = evidence_topics[evidence_topic]
                    # Avoid flagging one-word geopolitical ambiguity. Require a richer
                    # off-topic evidence cluster, e.g. Putin/Kremlin/Ukraine together,
                    # before calling it semantic cross-wiring.
                    if len(signal_terms) < 2 or len(evidence_terms) < 2:
                        continue
                    flags.append({
                        'type': 'semantic_topic_conflict',
                        'signal_topic': signal_topic,
                        'evidence_topic': evidence_topic,
                        'signal_terms': signal_terms,
                        'evidence_terms': evidence_terms,
                    })

        signal_tokens = self._token_set(signal_text)
        evidence_tokens = self._token_set(evidence_text)
        overlap = sorted(signal_tokens & evidence_tokens)
        if signal_topics and evidence_topics and not overlap:
            flags.append({
                'type': 'low_title_evidence_overlap',
                'signal_topics': sorted(signal_topics),
                'evidence_topics': sorted(evidence_topics),
            })

        return flags

    def evidence_integrity_report(self) -> Dict[str, Any]:
        """Build a non-destructive report of suspicious reviewed evidence rows."""
        corpus = self._review_corpus()
        source = 'signal_review_ledger.jsonl' if self._load_review_ledger() else 'tracked_signals.json'
        reviewed = [row for row in corpus if self._is_reviewed(row)]
        suspicious = []

        for idx, row in enumerate(corpus):
            flags = self._evidence_integrity_flags(row)
            if not flags:
                continue
            signal = row.get('signal') or {}
            evidence = row.get('evidence_pack') or {}
            suspicious.append({
                'corpus_index': idx,
                'title': signal.get('title') or row.get('title') or '',
                'pattern': signal.get('pattern') or signal.get('pattern_name') or signal.get('pattern_id') or '',
                'outcome': row.get('outcome') or row.get('actual_outcome') or '',
                'evidence_summary': evidence.get('summary') if isinstance(evidence, dict) else '',
                'flags': flags,
            })

        return {
            'generated_at': datetime.now().isoformat(),
            'source_corpus': source,
            'total_rows': len(corpus),
            'reviewed_rows': len(reviewed),
            'suspicious_count': len(suspicious),
            'suspicious_rows': suspicious,
            'mode': 'report_only_no_mutation',
        }

    def write_evidence_integrity_report(self, output_file: str = 'data/evidence_integrity_report.json') -> Dict[str, Any]:
        report = self.evidence_integrity_report()
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2)
        return report

    def _append_review_ledger(self, row: Dict[str, Any]) -> None:
        self.review_ledger_file.parent.mkdir(parents=True, exist_ok=True)
        payload = {**row, 'ledger_recorded_at': datetime.now().isoformat()}
        with open(self.review_ledger_file, 'a') as f:
            f.write(json.dumps(payload, sort_keys=True) + '\n')

    def _extract_evidence_pack(self, notes: str = '', evidence_pack: Dict[str, Any] | None = None) -> Dict[str, Any]:
        if evidence_pack:
            return evidence_pack

        # Backward-compatible fallback: keep raw notes in a structured container
        return {
            'summary': notes.strip() if notes else '',
            'drivers': [],
            'metrics': [],
            'sector_impact': [],
            'confidence': 'MEDIUM' if notes else 'LOW'
        }

    def add_signal(self, signal: dict):
        """Add a signal to track for accuracy"""
        entry = {
            'signal': signal,
            'added_at': datetime.now().isoformat(),
            'verified': False,
            'actual_outcome': None,
            'notes': ''
        }
        
        self.tracked.append(entry)
        
        # Keep only last 20 tracked
        self.tracked = self.tracked[-20:]
        
        with open(self.tracked_file, 'w') as f:
            json.dump(self.tracked, f, indent=2)
        
        print(f"  ✓ Added signal to track: {signal.get('title', '')[:40]}...")
    
    def evaluate_signal(
        self,
        index: int,
        actual_outcome: str,
        notes: str = '',
        evidence_pack: Dict[str, Any] | None = None,
    ):
        """Manually evaluate a tracked signal."""
        if index >= len(self.tracked):
            print(f"  ✗ Invalid index {index}")
            return

        normalized_outcome = actual_outcome.strip().upper()
        self.tracked[index]['verified'] = True
        self.tracked[index]['actual_outcome'] = normalized_outcome
        self.tracked[index]['evaluated_at'] = datetime.now().isoformat()
        self.tracked[index]['notes'] = notes
        self.tracked[index]['evidence_pack'] = self._extract_evidence_pack(notes, evidence_pack)

        with open(self.tracked_file, 'w') as f:
            json.dump(self.tracked, f, indent=2)

        self._append_review_ledger(self.tracked[index])

        print(f"  ✓ Evaluated signal {index}: {normalized_outcome}")
        self.update_accuracy_history()
    
    def update_accuracy_history(self):
        """Update accuracy statistics and learning feedback."""
        corpus = self._review_corpus()
        reviewed = [s for s in corpus if self._is_reviewed(s)]
        unique_verified = [s for s in reviewed if not self._is_duplicate(s)]
        duplicates = [s for s in reviewed if self._is_duplicate(s)]

        if not reviewed:
            return

        strong_buy = sum(1 for s in unique_verified if self._review_outcome(s) == 'strong buy')
        buy = sum(1 for s in unique_verified if self._review_outcome(s) == 'buy')
        hold = sum(1 for s in unique_verified if self._review_outcome(s) in {'hold', 'partial'})
        miss = sum(1 for s in unique_verified if self._review_outcome(s) in {'miss', 'incorrect'})

        weighted_score = sum(self._outcome_score(self._review_outcome(s)) for s in unique_verified)
        weighted_accuracy = round((weighted_score / len(unique_verified)) * 100, 1) if unique_verified else 0.0

        evidence_coverage = round(
            100 * sum(1 for s in unique_verified if self._has_structured_evidence(s)) / len(unique_verified),
            1,
        ) if unique_verified else 0.0

        stats = {
            'total_reviewed_raw': len(reviewed),
            'duplicate_count': len(duplicates),
            'total_verified': len(unique_verified),
            'strong_buy': strong_buy,
            'buy': buy,
            'hold': hold,
            'miss': miss,
            'weighted_accuracy': weighted_accuracy,
            'evidence_coverage': evidence_coverage,
            'review_corpus': 'signal_review_ledger.jsonl' if self._load_review_ledger() else 'tracked_signals.json',
            'last_updated': datetime.now().isoformat()
        }

        with open(self.history_file, 'w') as f:
            json.dump(stats, f, indent=2)

        self.update_model_feedback(unique_verified)
        print(f"  ✓ Weighted accuracy: {weighted_accuracy}% across {len(unique_verified)} unique verified signals ({len(duplicates)} duplicates excluded)")
    
    def update_model_feedback(self, verified: List[Dict[str, Any]]):
        """Build lightweight learning feedback for reasoning engine."""
        by_category: Dict[str, List[float]] = {}
        by_pattern: Dict[str, List[float]] = {}

        for row in verified:
            signal = row.get('signal', {})
            score = self._outcome_score(self._review_outcome(row))
            category = (signal.get('category') or 'unknown').lower()
            pattern = signal.get('pattern') or signal.get('pattern_id') or 'unknown'
            by_category.setdefault(category, []).append(score)
            by_pattern.setdefault(pattern, []).append(score)

        def summarize(bucket: Dict[str, List[float]]) -> Dict[str, Dict[str, float]]:
            output: Dict[str, Dict[str, float]] = {}
            for key, vals in bucket.items():
                avg = sum(vals) / len(vals)
                # Convert score into bounded bias points for reasoning engine.
                bias = round((avg - 0.5) * 10, 2)  # range approx -5..+5
                output[key] = {
                    'count': len(vals),
                    'avg_outcome_score': round(avg, 3),
                    'bias_points': max(-5.0, min(5.0, bias)),
                }
            return output

        feedback = {
            'generated_at': datetime.now().isoformat(),
            'sample_size': len(verified),
            'by_category': summarize(by_category),
            'by_pattern': summarize(by_pattern),
        }

        with open(self.feedback_file, 'w') as f:
            json.dump(feedback, f, indent=2)

    def get_stats(self):
        """Show current tracking stats"""
        print("\n=== Signal Accuracy Tracker ===")
        
        if self.tracked:
            reviewed = [s for s in self.tracked if self._is_reviewed(s)]
            pending = [s for s in self.tracked if not self._is_reviewed(s)]
            duplicates = [s for s in reviewed if self._is_duplicate(s)]
            unique_verified = [s for s in reviewed if not self._is_duplicate(s)]
            
            print(f"  Tracked signals: {len(self.tracked)}")
            print(f"    Verified: {len(unique_verified)}")
            print(f"    Duplicates: {len(duplicates)}")
            print(f"    Pending: {len(pending)}")
            
            if self.history_file.exists():
                with open(self.history_file, 'r') as f:
                    stats = json.load(f)
                print(f"\n  Weighted accuracy: {stats.get('weighted_accuracy', 0)}%")
                print(f"  Evidence coverage: {stats.get('evidence_coverage', 0)}%")
        else:
            print("  No signals tracked yet.")
    
    def review_pending(self):
        """Show pending signals for review"""
        rendered = self.format_pending_reviews()
        print(rendered)

    def format_pending_reviews(self) -> str:
        """Render pending reviews using original tracked indexes, not filtered indexes."""
        pending = [(i, s) for i, s in enumerate(self.tracked) if not self._is_reviewed(s)]
        
        if not pending:
            return "\nNo pending signals to review."
        
        lines = ["\n=== Pending Signal Reviews ==="]
        for i, s in pending:
            signal = s.get('signal', {})
            lines.append(f"\n[{i}] {signal.get('title', 'Unknown')[:60]}")
            lines.append(f"    Pattern: {signal.get('pattern_name') or signal.get('pattern') or 'N/A'}")
            lines.append(f"    Confidence: {signal.get('confidence_level', 'N/A')}")
            lines.append(f"    Added: {s.get('added_at', 'N/A')[:10]}")
            if signal.get('predicted_outcomes'):
                lines.append(f"    Predicted: {' → '.join(signal.get('predicted_outcomes', [])[:2])}")
        
        lines.extend([
            "\n--- To evaluate a signal, run with --eval TRACKED_INDEX OUTCOME ---",
            "    Example: accuracy_tracker.py --eval 7 correct",
            "    Outcomes: correct, partial, incorrect, duplicate",
        ])
        return "\n".join(lines)
    
    def auto_track_top_signals(self):
        """Auto-track HIGH confidence signals"""
        signals_file = self.data_dir / 'enhanced_signals.json'
        
        if not signals_file.exists():
            print("  No enhanced signals found.")
            return
        
        with open(signals_file, 'r') as f:
            signals = json.load(f)
        
        # Track top signal if not already tracked
        if signals:
            top = signals[0]
            title = top.get('title', '')
            
            # Check if already tracked
            already_tracked = any(
                title[:30] in t.get('signal', {}).get('title', '')[:30] 
                for t in self.tracked
            )
            
            if not already_tracked and top.get('confidence_level') in ['HIGH_PRIORITY', 'WATCH', 'STRONG BUY', 'BUY']:
                self.add_signal(top)
    
    def run(self, auto_track=False, review=False, eval_args=None, integrity_report=False):
        print("=== Signal Accuracy Tracker ===")
        
        if auto_track:
            self.auto_track_top_signals()
        
        if review:
            self.review_pending()
        
        if eval_args:
            try:
                idx = int(eval_args[0])
                outcome = eval_args[1]
                if outcome not in ['correct', 'partial', 'incorrect', 'duplicate']:
                    print(f"  Invalid outcome: {outcome}")
                else:
                    self.evaluate_signal(idx, outcome)
            except (ValueError, IndexError) as e:
                print(f"  Usage: --eval INDEX OUTCOME")
                print(f"  Example: --eval 0 correct")

        if integrity_report:
            report = self.write_evidence_integrity_report()
            print(
                "  ✓ Evidence integrity report: "
                f"{report['suspicious_count']} suspicious / {report['reviewed_rows']} reviewed "
                f"({report['source_corpus']})"
            )

        self.get_stats()


if __name__ == "__main__":
    import sys
    
    tracker = AccuracyTracker()
    
    # Parse arguments
    auto_track = '--track' in sys.argv
    review = '--review' in sys.argv
    integrity_report = '--integrity-report' in sys.argv
    
    eval_args = None
    if '--eval' in sys.argv:
        idx = sys.argv.index('--eval')
        if len(sys.argv) > idx + 2:
            eval_args = [sys.argv[idx + 1], sys.argv[idx + 2]]
    
    tracker.run(auto_track=auto_track, review=review, eval_args=eval_args, integrity_report=integrity_report)
