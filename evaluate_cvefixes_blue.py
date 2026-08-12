"""Evaluate CVEfixes-trained Blue-Team models and simulate approved Red-Team scenarios.

Example:
  python evaluate_cvefixes_blue.py --db /absolute/path/to/CVEfixes.db \
      --minimum-recall 0.85 --report reports/cvefixes_blue_evaluation.json

Only local database text and approved local scenario strings are read. No code
sample is executed and no external target is contacted.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from security_engine.blue_team_evaluator import BlueTeamEvaluator


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate CVEfixes Blue-Team patch detection and false-positive rate.")
    parser.add_argument("--db", required=True, help="Path to a converted official CVEfixes SQLite database.")
    parser.add_argument("--minimum-recall", type=float, default=0.80, help="Validation recall target for threshold calibration.")
    parser.add_argument("--limit", type=int, default=None, help="Optional maximum patch-pair count for a dry run.")
    parser.add_argument("--scenarios", nargs="*", default=None, help="Optional approved Red-Team scenario IDs to simulate.")
    parser.add_argument("--report", default=None, help="Optional JSON output path for aggregate results only.")
    args = parser.parse_args()

    evaluator = BlueTeamEvaluator(args.db, minimum_recall=args.minimum_recall, limit=args.limit)
    training = evaluator.train()
    patch_evaluation = evaluator.evaluate_patch_detection()
    simulation = evaluator.simulate_red_team_response(args.scenarios)
    output = {
        "training": training,
        "patch_evaluation": patch_evaluation,
        "red_blue_simulation": simulation,
    }
    if args.report:
        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
