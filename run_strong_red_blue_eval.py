"""Simulate the trained Python strong model against approved local exercises.

This is a bounded static-analysis evaluation. It does not execute the snippets,
contact a target, or apply an arbitrary patch. Bandit remains the judge.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from security_engine.red_blue_arena import RedBlueTrainingArena
from security_engine.strong_model_registry import StrongModelRegistry, StrongPythonRiskAdapter


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate a trained strong Python model in the safe Red/Blue arena.")
    parser.add_argument("--models-dir", default="models/strong_v1")
    parser.add_argument("--rounds", type=int, default=5)
    parser.add_argument("--output", default="reports/strong_red_blue_eval.json")
    args = parser.parse_args()

    registry = StrongModelRegistry(args.models_dir)
    registry.load()
    arena = RedBlueTrainingArena()
    arena.risk_model = StrongPythonRiskAdapter(registry)
    result = arena.run_rounds(rounds=args.rounds, retrain_model=False)
    output = {
        "training_model": registry.metadata(),
        "arena_result": result,
        "source_executed": False,
        "source_persisted": False,
    }
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")

    print("round | scenario | probability | threshold | model/judge | patch verified")
    for row in result["exercises"]:
        print(
            f"{row['round']:>5} | {row['scenario_id']} | "
            f"{row['model_vulnerability_probability']:.4f} | "
            f"{result['model']['decision_threshold']:.4f} | "
            f"{str(row['model_judge_agreement']):>11} | "
            f"{str(row['blue_fix_verified']):>14}"
        )
    print(f"Summary: {output_path}")


if __name__ == "__main__":
    main()
