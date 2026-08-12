"""Run bounded safe Red-Team / Blue-Team self-play and emit round-cycle metrics.

Example:
  python run_autonomous_red_blue.py --cycles 8 --rounds-per-cycle 5 \
      --log reports/selfplay_cycles.jsonl --summary reports/selfplay_summary.json

The run uses only approved local educational snippets. No snippet is executed,
no external system is contacted, and the JSONL log contains aggregate metrics
rather than source code.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from security_engine.autonomous_selfplay import AutonomousRedBlueSelfPlay, write_jsonl


def main() -> None:
    parser = argparse.ArgumentParser(description="Run bounded local Red-Team / Blue-Team self-play.")
    parser.add_argument("--cycles", type=int, default=5, help="Number of bounded training cycles (1-32).")
    parser.add_argument("--rounds-per-cycle", type=int, default=5, help="Local exercise rounds in each cycle (1-16).")
    parser.add_argument("--log", default="reports/autonomous_selfplay.jsonl", help="Aggregate cycle log output path.")
    parser.add_argument("--summary", default="reports/autonomous_selfplay_summary.json", help="Summary output path.")
    args = parser.parse_args()

    result = AutonomousRedBlueSelfPlay().run(cycles=args.cycles, rounds_per_cycle=args.rounds_per_cycle)
    write_jsonl(result["cycle_logs"], args.log)
    summary_path = Path(args.summary)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print("cycle | red-detect | model-agree | blue-verified | human-review | red/blue points")
    for row in result["cycle_logs"]:
        print(
            f"{row['cycle']:>5} | "
            f"{row['red_judge_detection_rate']:.1%} | "
            f"{row['model_judge_agreement_rate']:.1%} | "
            f"{row['blue_patch_verified_rate']:.1%} | "
            f"{row['blue_human_review_rate']:.1%} | "
            f"{row['red_points']}/{row['blue_points']}"
        )
    print(f"\nJSONL log: {args.log}\nSummary: {args.summary}")


if __name__ == "__main__":
    main()
