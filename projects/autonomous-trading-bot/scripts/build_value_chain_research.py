#!/usr/bin/env python3
"""Build research-layer strongest/weakest + pair-trade candidate view from execution candidates."""

from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "projects" / "autonomous-trading-bot" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from value_chain_research import VALUE_CHAIN_FIELDS, build_theme_research  # noqa: E402

INPUT = ROOT / "projects" / "market-intel" / "data" / "execution_candidates.json"
JSON_OUT = ROOT / "projects" / "autonomous-trading-bot" / "data" / "value_chain_research.json"
MD_OUT = ROOT / "projects" / "autonomous-trading-bot" / "data" / "value_chain_research.md"


def main() -> int:
    rows = json.loads(INPUT.read_text())
    reports = build_theme_research(rows)
    payload = {
        "generated_from": str(INPUT.relative_to(ROOT)),
        "value_chain_fields": VALUE_CHAIN_FIELDS,
        "theme_reports": reports,
    }
    JSON_OUT.write_text(json.dumps(payload, indent=2) + "\n")

    lines = ["# Value Chain Research Board", "", f"Source: `{INPUT.relative_to(ROOT)}`", ""]
    for report in reports:
        lines.append(f"## {report['theme']} / {report['chain_layer']} / {report['chain_sublayer']}")
        lines.append(f"- Candidates: {report['candidate_count']}")
        lines.append(f"- Unique primary symbols: {report.get('unique_symbol_count', 0)} ({', '.join(report.get('symbols', []))})")
        lines.append(f"- Operator symbols: {', '.join(report.get('operator_symbols', []))}")
        lines.append(f"- Pair-trade ready: {report['pair_trade_ready']} ({report.get('pair_trade_style', 'not_ready')})")
        strongest = report['strongest']
        weakest = report['weakest']
        lines.append(
            f"- Strongest: `{strongest.get('pattern_id')}` {report.get('strongest_symbol') or 'n/a'} score={strongest.get('research_score')} | {strongest.get('source_title','')[:120]}"
        )
        lines.append(
            f"- Weakest: `{weakest.get('pattern_id')}` {report.get('weakest_symbol') or 'n/a'} score={weakest.get('research_score')} | {weakest.get('source_title','')[:120]}"
        )
        if report.get('best_long_operator'):
            lines.append(f"- Best long operator: {report['best_long_operator'].get('symbol')} ({report['best_long_operator'].get('mapping_type')})")
        if report.get('best_short_operator'):
            lines.append(f"- Best short operator: {report['best_short_operator'].get('symbol')} ({report['best_short_operator'].get('mapping_type')})")
        if report.get('pair_trade_rationale'):
            lines.append(f"- Pair-trade rationale: {report['pair_trade_rationale']}")
        lines.append("")
    MD_OUT.write_text("\n".join(lines) + "\n")
    print(JSON_OUT)
    print(MD_OUT)
    print(f"reports={len(reports)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
