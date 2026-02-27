#!/usr/bin/env python3
"""
Pattern Matcher: Match incoming events against historical patterns
"""
import json
from datetime import datetime
from typing import List, Dict, Optional

class PatternMatcher:
    def __init__(self, patterns_file: str = "data/patterns.json"):
        with open(patterns_file, 'r') as f:
            data = json.load(f)
            self.patterns = data['patterns']
            self.metadata = data['metadata']
    
    def find_by_category(self, category: str) -> List[Dict]:
        """Find all patterns matching a category"""
        return [p for p in self.patterns if p['category'] == category]
    
    def find_by_confidence(self, min_confidence: str) -> List[Dict]:
        """Find patterns by minimum confidence level"""
        levels = {'LOW': 0, 'MEDIUM': 1, 'MEDIUM_HIGH': 2, 'HIGH': 3}
        return [p for p in self.patterns 
                if levels.get(p['confidence'], 0) >= levels.get(min_confidence, 0)]
    
    def find_by_time_horizon(self, horizon: str) -> List[Dict]:
        """Find patterns matching time horizon"""
        return [p for p in self.patterns if p['time_horizon'] == horizon]
    
    def match_event(self, event_category: str, time_horizon: str = None) -> List[Dict]:
        """Match an incoming event against historical patterns"""
        matches = self.find_by_category(event_category)
        
        if time_horizon:
            matches = [m for m in matches if m['time_horizon'] == time_horizon]
        
        # Sort by confidence
        levels = {'LOW': 0, 'MEDIUM': 1, 'MEDIUM_HIGH': 2, 'HIGH': 3}
        matches.sort(key=lambda x: levels.get(x['confidence'], 0), reverse=True)
        
        return matches
    
    def get_early_signals(self, pattern_id: str) -> Optional[List[str]]:
        """Get early signal sources for a pattern"""
        for p in self.patterns:
            if p['id'] == pattern_id:
                return p.get('early_signals', [])
        return None
    
    def suggest_monitoring(self, category: str) -> Dict:
        """Suggest what to monitor based on category"""
        pattern = self.match_event(category)
        if not pattern:
            return {"error": "No patterns found for category"}
        
        return {
            "category": category,
            "related_patterns": [p['name'] for p in pattern],
            "recommended_signals": pattern[0].get('early_signals', []),
            "expected_time_horizon": pattern[0].get('time_horizon'),
            "typical_lag_hours": pattern[0].get('time_lag_hours', {}),
            "confidence": pattern[0].get('confidence')
        }
    
    def get_summary(self) -> Dict:
        """Get summary of all patterns"""
        return self.metadata


if __name__ == "__main__":
    matcher = PatternMatcher()
    
    print("=== Market Intel Pattern Database ===\n")
    print(f"Total patterns: {matcher.metadata['total_patterns']}")
    print(f"Confidence: {matcher.metadata['confidence_distribution']}")
    print(f"Categories: {matcher.metadata['category_distribution']}")
    
    # Example: What to monitor for geopolitical events
    print("\n=== Geopolitical Monitoring ===")
    result = matcher.suggest_monitoring("geopolitical")
    print(f"Patterns: {result.get('related_patterns')}")
    print(f"Signals to watch: {result.get('recommended_signals')}")
    
    # Example: High confidence patterns
    print("\n=== High Confidence Patterns ===")
    high = matcher.find_by_confidence("HIGH")
    for p in high:
        print(f"- {p['name']} ({p['category']})")
