"""Optimise language-specific local models on the full local CVEfixes SQLite dataset.

By default, every available pre-fix/post-fix method pair is used. Search is
performed with group-held-out validation before the selected configuration is
refit on all rows for each language.

Example:
  python optimize_cvefixes_languages.py --db /data/CVEfixes.db \
      --output-dir models/cvefixes_optimized

Use --limit only for a small dry run; omit it for the complete local dataset.
No source code is executed or emitted in artifacts.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from security_engine.cvefixes_hyperopt import CVEfixesLanguageHyperOptimizer


def parse_float_list(value: str) -> tuple[float, ...]:
    try:
        parsed = tuple(float(item.strip()) for item in value.split(",") if item.strip())
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Expected a comma-separated list of decimal values.") from exc
    if not parsed:
        raise argparse.ArgumentTypeError("At least one numeric value is required.")
    return parsed


def save_model(model, target: Path) -> str:
    try:
        import joblib
        joblib.dump(model, target.with_suffix(".joblib"))
        return "joblib"
    except ImportError:
        import pickle
        with target.with_suffix(".pkl").open("wb") as artifact_file:
            pickle.dump(model, artifact_file)
        return "pickle"


def main() -> None:
    parser = argparse.ArgumentParser(description="Optimise CVEfixes language models using group-held-out validation.")
    parser.add_argument("--db", required=True, help="Path to a converted official CVEfixes SQLite database.")
    parser.add_argument("--output-dir", default="models/cvefixes_optimized", help="Directory for metadata and local model artifacts.")
    parser.add_argument("--alphas", type=parse_float_list, default=(0.25, 0.5, 1.0, 2.0), help="Comma-separated smoothing alphas.")
    parser.add_argument("--minimum-recalls", type=parse_float_list, default=(0.75, 0.80, 0.85, 0.90), help="Comma-separated validation recall targets.")
    parser.add_argument("--limit", type=int, default=None, help="Optional patch-pair cap for a dry run; omit for full dataset.")
    args = parser.parse_args()

    optimiser = CVEfixesLanguageHyperOptimizer(
        args.db,
        smoothing_alphas=args.alphas,
        minimum_recalls=args.minimum_recalls,
        limit=args.limit,
    )
    models, report = optimiser.optimize()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    artifact_formats = {}
    for language, model in models.items():
        artifact_formats[language] = save_model(model, output_dir / f"{language}_risk_model")
    report["artifact_formats"] = artifact_formats
    (output_dir / "hyperparameter_search_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print("language | alpha | recall target | threshold | F1 | FPR | objective")
    for language, result in sorted(report["languages"].items()):
        if not result.get("optimized"):
            print(f"{language} | not optimized: {result.get('reason')}")
            continue
        selected = result["selected"]
        metrics = selected["validation_metrics"]
        print(
            f"{language} | {selected['smoothing_alpha']:.3g} | {selected['minimum_recall']:.0%} | "
            f"{selected['selected_threshold']:.4f} | {metrics['f1']:.1%} | "
            f"{metrics['false_positive_rate']:.1%} | {selected['objective']:.4f}"
        )
    print(f"\nReport: {output_dir / 'hyperparameter_search_report.json'}")


if __name__ == "__main__":
    main()
