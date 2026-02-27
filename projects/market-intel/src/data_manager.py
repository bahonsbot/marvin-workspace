#!/usr/bin/env python3
"""
Data Manager: Prunes old data and tracks accuracy over time
"""
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

class DataManager:
    def __init__(self):
        self.data_dir = Path('data')
        self.max_entries = 50  # Keep last 50 entries
        
    def prune_files(self):
        """Prune old entries, keep last 50"""
        files_to_prune = [
            'rss_alerts.json',
            'reddit_alerts.json', 
            'signals.json',
            'enhanced_signals.json'
        ]
        
        for filename in files_to_prune:
            filepath = self.data_dir / filename
            
            if not filepath.exists():
                continue
            
            with open(filepath, 'r') as f:
                data = json.load(f)
            
            original_count = len(data)
            
            # Keep only last 50
            pruned = data[:self.max_entries]
            
            with open(filepath, 'w') as f:
                json.dump(pruned, f, indent=2)
            
            removed = original_count - len(pruned)
            if removed > 0:
                print(f"  ✓ {filename}: kept {len(pruned)}, removed {removed}")
            else:
                print(f"  ✓ {filename}: {len(pruned)} entries (no pruning needed)")
    
    def archive_old_data(self):
        """Archive data older than 7 days to monthly files"""
        # This is a placeholder - would need timestamp tracking
        print("  ℹ Archive functionality: TBD")
    
    def get_stats(self):
        """Get current data stats"""
        files = ['rss_alerts.json', 'reddit_alerts.json', 'signals.json', 'enhanced_signals.json']
        
        print("\n=== Data Stats ===")
        for f in files:
            path = self.data_dir / f
            if path.exists():
                with open(path, 'r') as fp:
                    data = json.load(fp)
                print(f"  {f}: {len(data)} entries")
        
        print(f"\n  Max entries per file: {self.max_entries}")
    
    def run(self):
        print("=== Data Manager: Pruning ===")
        self.prune_files()
        self.get_stats()


if __name__ == "__main__":
    dm = DataManager()
    dm.run()
