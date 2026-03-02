#!/usr/bin/env python3
"""
Signal Accuracy Dashboard
Displays signal tracking statistics and accuracy metrics
"""
import json
from datetime import datetime
from pathlib import Path
from collections import defaultdict

# Paths
DATA_DIR = Path(__file__).parent / 'data'
TRACKED_FILE = DATA_DIR / 'tracked_signals.json'
HISTORY_FILE = DATA_DIR / 'signal_accuracy_history.json'

def load_data():
    """Load tracked signals and history data"""
    tracked = []
    if TRACKED_FILE.exists():
        with open(TRACKED_FILE, 'r') as f:
            tracked = json.load(f)
    
    history = {}
    if HISTORY_FILE.exists():
        with open(HISTORY_FILE, 'r') as f:
            history = json.load(f)
    
    return tracked, history

def calculate_stats(tracked):
    """Calculate accuracy statistics"""
    verified = [s for s in tracked if s.get('verified')]
    pending = [s for s in tracked if not s.get('verified')]
    
    correct = sum(1 for s in verified if s.get('actual_outcome') == 'correct')
    partial = sum(1 for s in verified if s.get('actual_outcome') == 'partial')
    incorrect = sum(1 for s in verified if s.get('actual_outcome') == 'incorrect')
    
    accuracy = round(correct / len(verified) * 100, 1) if verified else 0
    
    return {
        'total': len(tracked),
        'verified': len(verified),
        'pending': len(pending),
        'correct': correct,
        'partial': partial,
        'incorrect': incorrect,
        'accuracy': accuracy
    }

def get_category_breakdown(tracked):
    """Get accuracy breakdown by category"""
    categories = defaultdict(lambda: {'total': 0, 'correct': 0, 'partial': 0, 'incorrect': 0})
    
    for entry in tracked:
        if not entry.get('verified'):
            continue
        
        cat = entry.get('signal', {}).get('category', 'unknown')
        outcome = entry.get('actual_outcome', 'unknown')
        
        categories[cat]['total'] += 1
        if outcome in ['correct', 'partial', 'incorrect']:
            categories[cat][outcome] += 1
    
    return dict(categories)

def get_accuracy_over_time(tracked):
    """Calculate accuracy over time (by day)"""
    daily = defaultdict(lambda: {'verified': 0, 'correct': 0})
    
    for entry in tracked:
        if not entry.get('verified'):
            continue
        
        date = entry.get('evaluated_at', '')[:10]
        if date:
            daily[date]['verified'] += 1
            if entry.get('actual_outcome') == 'correct':
                daily[date]['correct'] += 1
    
    # Calculate running accuracy
    result = []
    running_correct = 0
    running_total = 0
    
    for date in sorted(daily.keys()):
        running_correct += daily[date]['correct']
        running_total += daily[date]['verified']
        acc = round(running_correct / running_total * 100, 1) if running_total else 0
        result.append({
            'date': date,
            'verified': running_total,
            'correct': running_correct,
            'accuracy': acc
        })
    
    return result

def render_console():
    """Render dashboard to console"""
    tracked, history = load_data()
    stats = calculate_stats(tracked)
    categories = get_category_breakdown(tracked)
    time_series = get_accuracy_over_time(tracked)
    
    print("\n" + "=" * 60)
    print("           SIGNAL ACCURACY DASHBOARD")
    print("=" * 60)
    
    # Overview
    print("\n📊 OVERVIEW")
    print("-" * 40)
    print(f"  Total signals tracked:     {stats['total']}")
    print(f"  Verified:                 {stats['verified']}")
    print(f"  Pending evaluation:       {stats['pending']}")
    
    # Accuracy
    print("\n🎯 ACCURACY")
    print("-" * 40)
    print(f"  Correct:                   {stats['correct']}")
    print(f"  Partial:                   {stats['partial']}")
    print(f"  Incorrect:                 {stats['incorrect']}")
    print(f"  Overall accuracy:          {stats['accuracy']}%")
    
    # Category breakdown
    if categories:
        print("\n📁 BY CATEGORY")
        print("-" * 40)
        for cat, data in sorted(categories.items(), key=lambda x: -x[1]['total']):
            cat_acc = round(data['correct'] / data['total'] * 100, 1) if data['total'] else 0
            print(f"  {cat:20}  {data['correct']}/{data['total']}  ({cat_acc}%)")
    
    # Time series
    if time_series:
        print("\n📈 ACCURACY OVER TIME")
        print("-" * 40)
        for entry in time_series:
            bar_len = int(entry['accuracy'] / 5)
            bar = "█" * bar_len + "░" * (20 - bar_len)
            print(f"  {entry['date']}  {bar} {entry['accuracy']}%")
    
    # Recent signals
    print("\n📋 RECENT SIGNALS")
    print("-" * 40)
    recent = sorted(tracked, key=lambda x: x.get('added_at', ''), reverse=True)[:5]
    for i, entry in enumerate(recent):
        title = entry.get('signal', {}).get('title', 'Unknown')[:40]
        status = "✅" if entry.get('actual_outcome') == 'correct' else \
                 "⚠️" if entry.get('actual_outcome') == 'partial' else \
                 "❌" if entry.get('actual_outcome') == 'incorrect' else "⏳"
        print(f"  {status} {title}...")
    
    print("\n" + "=" * 60 + "\n")

def render_html():
    """Render dashboard as HTML"""
    tracked, history = load_data()
    stats = calculate_stats(tracked)
    categories = get_category_breakdown(tracked)
    time_series = get_accuracy_over_time(tracked)
    
    # Build category rows
    cat_rows = ""
    for cat, data in sorted(categories.items(), key=lambda x: -x[1]['total']):
        cat_acc = round(data['correct'] / data['total'] * 100, 1) if data['total'] else 0
        cat_rows += f"""
        <tr>
            <td>{cat}</td>
            <td>{data['correct']}</td>
            <td>{data['partial']}</td>
            <td>{data['incorrect']}</td>
            <td>{data['total']}</td>
            <td><strong>{cat_acc}%</strong></td>
        </tr>"""
    
    # Build time series rows
    time_rows = ""
    for entry in time_series:
        bar_len = int(entry['accuracy'] / 5)
        bar = "█" * bar_len + "░" * (20 - bar_len)
        time_rows += f"""
        <tr>
            <td>{entry['date']}</td>
            <td>{entry['verified']}</td>
            <td>{entry['correct']}</td>
            <td>
                <div class="progress">
                    <div class="bar" style="width: {entry['accuracy']}%">{entry['accuracy']}%</div>
                </div>
            </td>
        </tr>"""
    
    # Recent signals
    recent = sorted(tracked, key=lambda x: x.get('added_at', ''), reverse=True)[:10]
    recent_rows = ""
    for entry in recent:
        title = entry.get('signal', {}).get('title', 'Unknown')[:50]
        cat = entry.get('signal', {}).get('category', 'unknown')
        status = entry.get('actual_outcome', 'pending')
        status_icon = "✅" if status == "correct" else "⚠️" if status == "partial" else "❌" if status == "incorrect" else "⏳"
        date = entry.get('added_at', '')[:10]
        recent_rows += f"""
        <tr>
            <td>{status_icon}</td>
            <td>{title}...</td>
            <td>{cat}</td>
            <td>{date}</td>
        </tr>"""
    
    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Signal Accuracy Dashboard</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #eee; margin: 0; padding: 20px; }}
        h1, h2 {{ color: #fff; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        .header {{ text-align: center; margin-bottom: 30px; }}
        .grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }}
        .card {{ background: #16213e; border-radius: 12px; padding: 20px; }}
        .card h3 {{ margin: 0 0 10px 0; color: #aaa; font-size: 14px; text-transform: uppercase; }}
        .card .value {{ font-size: 36px; font-weight: bold; color: #4ade80; }}
        .card .value.warning {{ color: #fbbf24; }}
        .card .value.error {{ color: #f87171; }}
        .section {{ background: #16213e; border-radius: 12px; padding: 20px; margin-bottom: 20px; }}
        table {{ width: 100%; border-collapse: collapse; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #2a2a4a; }}
        th {{ color: #aaa; font-weight: 600; font-size: 12px; text-transform: uppercase; }}
        .progress {{ background: #2a2a4a; border-radius: 4px; height: 20px; width: 150px; }}
        .bar {{ background: linear-gradient(90deg, #4ade80, #22c55e); border-radius: 4px; height: 100%; text-align: center; font-size: 12px; color: #000; font-weight: bold; }}
        .timestamp {{ color: #666; font-size: 12px; text-align: center; margin-top: 20px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Signal Accuracy Dashboard</h1>
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>Total Tracked</h3>
                <div class="value">{stats['total']}</div>
            </div>
            <div class="card">
                <h3>Verified</h3>
                <div class="value">{stats['verified']}</div>
            </div>
            <div class="card">
                <h3>Pending</h3>
                <div class="value warning">{stats['pending']}</div>
            </div>
            <div class="card">
                <h3>Accuracy</h3>
                <div class="value">{stats['accuracy']}%</div>
            </div>
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>Correct</h3>
                <div class="value" style="color: #4ade80;">{stats['correct']}</div>
            </div>
            <div class="card">
                <h3>Partial</h3>
                <div class="value warning">{stats['partial']}</div>
            </div>
            <div class="card">
                <h3>Incorrect</h3>
                <div class="value error">{stats['incorrect']}</div>
            </div>
            <div class="card">
                <h3>Last Updated</h3>
                <div class="value" style="font-size: 18px;">{datetime.now().strftime('%Y-%m-%d')}</div>
            </div>
        </div>
        
        <div class="section">
            <h2>📁 By Category</h2>
            <table>
                <thead>
                    <tr>
                        <th>Category</th>
                        <th>Correct</th>
                        <th>Partial</th>
                        <th>Incorrect</th>
                        <th>Total</th>
                        <th>Accuracy</th>
                    </tr>
                </thead>
                <tbody>
                    {cat_rows or '<tr><td colspan="6">No verified signals yet</td></tr>'}
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <h2>📈 Accuracy Over Time</h2>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Verified</th>
                        <th>Correct</th>
                        <th>Running Accuracy</th>
                    </tr>
                </thead>
                <tbody>
                    {time_rows or '<tr><td colspan="4">No time series data</td></tr>'}
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <h2>📋 Recent Signals</h2>
            <table>
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Added</th>
                    </tr>
                </thead>
                <tbody>
                    {recent_rows or '<tr><td colspan="4">No signals tracked</td></tr>'}
                </tbody>
            </table>
        </div>
        
        <div class="timestamp">
            Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        </div>
    </div>
</body>
</html>"""
    
    output_file = Path(__file__).parent / 'dashboard.html'
    with open(output_file, 'w') as f:
        f.write(html)
    
    print(f"HTML dashboard saved to: {output_file}")

if __name__ == "__main__":
    import sys
    
    if '--html' in sys.argv:
        render_html()
    else:
        render_console()
        # Also generate HTML
        render_html()
