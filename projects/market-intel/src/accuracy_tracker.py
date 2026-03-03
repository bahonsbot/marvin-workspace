#!/usr/bin/env python3
"""
Signal Accuracy Tracker: Tracks signal accuracy over time
"""
import json
import os
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

    def __init__(self):
        self.data_dir = Path('data')
        self.tracked_file = self.data_dir / 'tracked_signals.json'
        self.history_file = self.data_dir / 'signal_accuracy_history.json'
        self.feedback_file = self.data_dir / 'model_feedback.json'
        
        # Load tracked signals
        self.tracked: List[Dict[str, Any]] = []
        if self.tracked_file.exists():
            with open(self.tracked_file, 'r') as f:
                self.tracked = json.load(f)
    
    def _normalize_outcome(self, outcome: str) -> str:
        return (outcome or '').strip().lower()

    def _outcome_score(self, outcome: str) -> float:
        return self.OUTCOME_SCORE.get(self._normalize_outcome(outcome), 0.0)

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

        print(f"  ✓ Evaluated signal {index}: {normalized_outcome}")
        self.update_accuracy_history()
    
    def update_accuracy_history(self):
        """Update accuracy statistics and learning feedback."""
        verified = [s for s in self.tracked if s.get('verified')]

        if not verified:
            return

        strong_buy = sum(1 for s in verified if self._normalize_outcome(s.get('actual_outcome', '')) == 'strong buy')
        buy = sum(1 for s in verified if self._normalize_outcome(s.get('actual_outcome', '')) == 'buy')
        hold = sum(1 for s in verified if self._normalize_outcome(s.get('actual_outcome', '')) in {'hold', 'partial'})
        miss = sum(1 for s in verified if self._normalize_outcome(s.get('actual_outcome', '')) in {'miss', 'incorrect'})

        weighted_score = sum(self._outcome_score(s.get('actual_outcome', '')) for s in verified)
        weighted_accuracy = round((weighted_score / len(verified)) * 100, 1)

        evidence_coverage = round(
            100 * sum(1 for s in verified if s.get('evidence_pack', {}).get('summary') or s.get('notes')) / len(verified),
            1,
        )

        stats = {
            'total_verified': len(verified),
            'strong_buy': strong_buy,
            'buy': buy,
            'hold': hold,
            'miss': miss,
            'weighted_accuracy': weighted_accuracy,
            'evidence_coverage': evidence_coverage,
            'last_updated': datetime.now().isoformat()
        }

        with open(self.history_file, 'w') as f:
            json.dump(stats, f, indent=2)

        self.update_model_feedback(verified)
        print(f"  ✓ Weighted accuracy: {weighted_accuracy}% across {len(verified)} verified signals")
    
    def update_model_feedback(self, verified: List[Dict[str, Any]]):
        """Build lightweight learning feedback for reasoning engine."""
        by_category: Dict[str, List[float]] = {}
        by_pattern: Dict[str, List[float]] = {}

        for row in verified:
            signal = row.get('signal', {})
            score = self._outcome_score(row.get('actual_outcome', ''))
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
            verified = [s for s in self.tracked if s.get('verified')]
            pending = [s for s in self.tracked if not s.get('verified')]
            
            print(f"  Tracked signals: {len(self.tracked)}")
            print(f"    Verified: {len(verified)}")
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
        pending = [s for s in self.tracked if not s.get('verified')]
        
        if not pending:
            print("\nNo pending signals to review.")
            return
        
        print("\n=== Pending Signal Reviews ===")
        for i, s in enumerate(pending):
            signal = s.get('signal', {})
            print(f"\n[{i}] {signal.get('title', 'Unknown')[:60]}")
            print(f"    Pattern: {signal.get('pattern_name', 'N/A')}")
            print(f"    Confidence: {signal.get('confidence_level', 'N/A')}")
            print(f"    Added: {s.get('added_at', 'N/A')[:10]}")
            if signal.get('predicted_outcomes'):
                print(f"    Predicted: {' → '.join(signal.get('predicted_outcomes', [])[:2])}")
        
        print("\n--- To evaluate a signal, run with --eval INDEX OUTCOME ---")
        print("    Example: accuracy_tracker.py --eval 0 correct")
        print("    Outcomes: correct, partial, incorrect")
    
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
            
            if not already_tracked and top.get('confidence_level') in ['STRONG BUY', 'BUY']:
                self.add_signal(top)
    
    def run(self, auto_track=False, review=False, eval_args=None):
        print("=== Signal Accuracy Tracker ===")
        
        if auto_track:
            self.auto_track_top_signals()
        
        if review:
            self.review_pending()
        
        if eval_args:
            try:
                idx = int(eval_args[0])
                outcome = eval_args[1]
                if outcome not in ['correct', 'partial', 'incorrect']:
                    print(f"  Invalid outcome: {outcome}")
                else:
                    self.evaluate_signal(idx, outcome)
            except (ValueError, IndexError) as e:
                print(f"  Usage: --eval INDEX OUTCOME")
                print(f"  Example: --eval 0 correct")
        
        self.get_stats()


if __name__ == "__main__":
    import sys
    
    tracker = AccuracyTracker()
    
    # Parse arguments
    auto_track = '--track' in sys.argv
    review = '--review' in sys.argv
    
    eval_args = None
    if '--eval' in sys.argv:
        idx = sys.argv.index('--eval')
        if len(sys.argv) > idx + 2:
            eval_args = [sys.argv[idx + 1], sys.argv[idx + 2]]
    
    tracker.run(auto_track=auto_track, review=review, eval_args=eval_args)
