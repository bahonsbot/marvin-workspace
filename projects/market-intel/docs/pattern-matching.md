# Pattern Matching Logic

This document explains how the Market Intel system matches incoming alerts (RSS feeds and Reddit posts) against historical market patterns to generate actionable signals.

## Overview

The pattern matching system works in two stages:

1. **Signal Generation** (`signal_generator.py`) — Matches raw alerts to historical patterns using keyword-based scoring
2. **Reasoning Engine** (`reasoning_engine.py`) — Enhances matched signals with confidence scoring and causal predictions

---

## 1. What Patterns Exist

The system maintains 24 historical market patterns across 7 categories:

| Category | Count | Patterns |
|----------|-------|----------|
| `geopolitical` | 7 | Saudi Oil Attacks, Russia-Ukraine, Arab Spring, Iran Nuclear Deal, Taiwan/China Tension, Evergrande |
| `macroeconomic` | 7 | COVID Crash, Black Monday 1987, Japan Lost Decade, US Credit Downgrade, China Devaluation, European Debt Crisis, EM Crisis 2018 |
| `financial_credit` | 3 | SVB Collapse, Regional Banking Crisis 2023, LTCM Collapse |
| `sentiment_social` | 3 | GameStop Short Squeeze, Reddit GPU/Semis, Retail Options Sentiment |
| `corporate` | 2 | Tesla Stock Splits, Dot-com Bubble |
| `crypto_credit` | 1 | FTX Collapse |
| `political` | 1 | Brexit Vote |

### Pattern Attributes

Each pattern contains:

```json
{
  "id": "p001",
  "name": "Saudi Oil Attacks",
  "category": "geopolitical",
  "date": "2019-09-14",
  "time_horizon": "intraday",
  "market_impact": { "asset": "crude_oil", "direction": "spike", "magnitude": "~20%" },
  "early_signals": ["regional_conflict_elevated", "social_media_videos"],
  "confidence": "HIGH"
}
```

---

## 2. How Matching Works

### Stage 1: Keyword Matching (Signal Generator)

The `match_alert_to_patterns()` function performs keyword-based matching:

#### Text Sources

- **Baseline mode**: title + summary
- **Enriched mode**: title, summary, selftext, article_excerpt, top_comments

#### Scoring Algorithm

```python
pattern_keywords = {
    'p001': {           # Pattern ID
        'keywords': ['saudi', 'opec', 'abqaiq', 'aramco', 'gulf oil'],
        'exclude': ['ukraine', 'russia'],  # Negative filters
        'weight': 3     # 1-3 weight multiplier
    },
    ...
}
```

**Match logic:**
1. Scan alert text for any keyword in the pattern's list
2. If exclusion keyword found → reject match
3. If match found → add to candidate list with weight
4. Return all matching patterns sorted by (confidence × weight)

#### Confidence Levels

| Level | Score | Description |
|-------|-------|-------------|
| `HIGH` | 100 | Strong historical precedent, clear因果 |
| `MEDIUM_HIGH` | 75 | Good historical match |
| `MEDIUM` | 50 | Moderate correlation |
| `LOW` | 25 | Weak signal |

#### Category Distribution

The matcher prefers HIGH confidence patterns and weighs them higher. Categories with most historical data (`geopolitical`, `macroeconomic`) have more refined keyword rules.

---

### Stage 2: Reasoning Score (Reasoning Engine)

After initial matching, the reasoning engine calculates a more nuanced score:

```python
# Component weights
final_score = (source_credibility × 0.30) + (pattern_strength × 0.50) + (time_horizon_fit × 0.20)
```

#### Source Credibility Matrix

| Source | Credibility |
|--------|-------------|
| Reuters | 0.95 |
| Financial Times | 0.90 |
| Market Watch | 0.75 |
| Business | 0.70 |
| r/investing | 0.50 |
| r/wallstreetbets | 0.30 |

#### Confidence Labels (Final)

| Score Range | Label |
|-------------|-------|
| 75+ | STRONG BUY |
| 60-74 | BUY |
| 50-59 | HOLD |
| 35-49 | WEAK |
| <35 | SKIP |

---

## 3. Examples

### Example A: High Confidence Match

**Alert:**
```
Title: "SVB collapse triggers regional bank selloff"
Source: Reuters
```

**Matching Process:**

1. Keyword match finds `svb`, `regional bank`, `bank failure` → matches pattern p006 (SVB Collapse)
2. Exclusion check: none triggered
3. Pattern confidence: HIGH (weight: 3)
4. Signal score: 100 × 3 = 300

**Reasoning Score:**
- Source credibility: Reuters = 0.95
- Pattern strength: HIGH = 0.90
- Time horizon fit: intraday match = 1.0

```
Final score = (0.95 × 0.30) + (0.90 × 0.50) + (1.0 × 0.20) = 0.935 → 93.5/100
Confidence: STRONG BUY
```

---

### Example B: Weak Match (Exclusion Filter)

**Alert:**
```
Title: "Russia announces new oil production cuts"
Source: RSS
```

**Matching Process:**

1. Keyword match finds `russia`, `oil` → initially matches p002 (Russia-Ukraine)
2. Exclusion check: finds `oil` → triggers exclusion for p002 (excludes "saudi", "opec" but...) Wait, let's check actual rules:

Looking at p002:
```python
'p002': {
    'keywords': ['ukraine', 'russia', 'putin', 'kremlin', 'kyiv', 'moscow', 'invasion'],
    'exclude': ['saudi', 'opec', 'middle east'],
    'weight': 3
}
```

Actually `oil` is not an exclusion. But the keyword `russia` alone might match. However, the pattern keywords for p002 are specific to Ukraine conflict, not general Russia news.

The keyword matching scans all patterns — `russia` would match p002, but unless there's Ukraine context, it won't score highly.

---

### Example C: Category-Wide Pattern

**Alert:**
```
Title: "Fed signals rate pause, markets rally"
Source: Financial Times
```

**Matching Process:**

1. Keywords match: `fed`, `rate`, `fomc` → match p014 (US Credit Rating / Macro)
2. Confidence: HIGH (p014 has weight 3)
3. Signal score: 100 × 3 = 300

**Reasoning Enhancement:**
The reasoning engine also checks for causal chains:
- Macro signal → rates reprice → equity duration factor moves
- Predicted outcomes: `front_end_yield_move`, `usd_trend_shift`, `growth_value_rotation`

---

## Data Flow

```
RSS Feed / Reddit Alert
        │
        ▼
┌───────────────────┐
│  signal_generator │  ← Keyword matching + weights
│   match_alert()   │
└─────────┬─────────┘
          │ signals.json
          ▼
┌───────────────────┐
│ reasoning_engine  │  ← Credibility + confidence scoring
│  analyze_signals  │
└─────────┬─────────┘
          │ enhanced_signals.json
          ▼
     Telegram Alert
```

---

## Configuration

Key parameters in `signal_generator.py`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `use_enriched` | `False` | Enable expanded text matching |
| Max signals | 50 | Cap on output signals |
| A/B mode | `shadow` | Production stays baseline; enriched tested separately |

Run with:
```bash
MI_ENRICHMENT_MODE=enriched python src/signal_generator.py
```

---

## Adding New Patterns

1. Add entry to `data/patterns.json`
2. Add keyword rules to `pattern_keywords` dict in `signal_generator.py`
3. Set appropriate weight (1-3) and exclusions
4. Test matching with sample alerts

---

_Last updated: 2026-03-02_
