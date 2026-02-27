#!/usr/bin/env python3
"""
Signal Accuracy Tracker: Tracks signal accuracy over time
"""
import json
import os
from datetime import datetime
from pathlib import Path

class AccuracyTracker:
    def __init__(self):
        self.data_dir = Path('data')
        self.tracked_file = self.data_dir / 'tracked_signals.json'
        self.history_file = self.data_dir / 'signal_accuracy_history.json'
        
        # Load tracked signals
        self.tracked = []
        if self.tracked_file.exists():
            with open(self.tracked_file, 'r') as f:
                self.tracked = json.load(f)
    
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
    
    def evaluate_signal(self, index: int, actual_outcome: str, notes: str = ''):
        """Manually evaluate a tracked signal"""
        if index >= len(self.tracked):
            print(f"  ✗ Invalid index {index}")
            return
        
        self.tracked[index]['verified'] = True
        self.tracked[index]['actual_outcome'] = actual_outcome
        self.tracked[index]['evaluated_at'] = datetime.now().isoformat()
        self.tracked[index]['notes'] = notes
        
        with open(self.tracked_file, 'w') as f:
            json.dump(self.tracked, f, indent=2)
        
        print(f"  ✓ Evaluated signal {index}: {actual_outcome}")
        self.update_accuracy_history()
    
    def update_accuracy_history(self):
        """Update accuracy statistics"""
        verified = [s for s in self.tracked if s.get('verified')]
        
        if not verified:
            return
        
        # Simple accuracy calculation
        correct = sum(1 for s in verified if s.get('actual_outcome') == 'correct')
        partial = sum(1 for s in verified if s.get('actual_outcome') == 'partial')
        
        stats = {
            'total_verified': len(verified),
            'correct': correct,
            'partial': partial,
            'accuracy_rate': round(correct / len(verified) * 100, 1) if verified else 0,
            'last_updated': datetime.now().isoformat()
        }
        
        with open(self.history_file, 'w') as f:
            json.dump(stats, f, indent=2)
        
        print(f"  ✓ Accuracy: {stats['accuracy_rate']}% ({correct}/{len(verified)})")
    
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
                print(f"\n  Accuracy: {stats.get('accuracy_rate', 0)}%")
        else:
            print("  No signals tracked yet.")
    
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
    
    def run(self, auto_track=False):
        print("=== Signal Accuracy Tracker ===")
        
        if auto_track:
            self.auto_track_top_signals()
        
        self.get_stats()


if __name__ == "__main__":
    import sys
    tracker = AccuracyTracker()
    tracker.run(auto_track='--track' in sys.argv)
