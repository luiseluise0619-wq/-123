"""Train and evaluate the stronger language-specific vulnerability models.

Examples:
  python train_strong_models.py --data-root /home/ubuntu/cvedata \
      --output-dir models/strong_v1 --language c_cpp
  python train_strong_models.py --data-root /home/ubuntu/cvedata \
      --output-dir models/strong_v1 --language python

The script consumes the full downloaded train split by default and evaluates
on the untouched validation and test splits. It stores models and aggregate
metrics, never source code.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from strong_vulnerability_trainer import StrongVulnerabilityModel, collect


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the stronger language-specific vulnerability model.")
    parser.add_argument("--data-root", default="/home/ubuntu/cvedata")
    parser.add_argument("--output-dir", default="models/strong_v1")
    parser.add_argument("--language", choices=["c_cpp", "python"], action="append", required=True)
    parser.add_argument("--alpha", type=float, default=1e-5)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--features", type=int, default=2**18)
    parser.add_argument("--minimum-recall", type=float, default=0.80)
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    report = {
        "model_family": "strong_vulnerability_model_v1",
        "data_root": str(Path(args.data_root).resolve()),
        "source_execution": False,
        "source_persisted": False,
        "languages": {},
    }

    for language in args.language:
        train_rows = collect(args.data_root, language, "train")
        valid_rows = collect(args.data_root, language, "validation") if language == "c_cpp" else collect(args.data_root, language, "test")
        test_rows = collect(args.data_root, language, "test")
        model = StrongVulnerabilityModel(language, alpha=args.alpha, n_features=args.features, epochs=args.epochs)
        model.fit(train_rows)
        threshold_report = model.tune_threshold(valid_rows, minimum_recall=args.minimum_recall)
        validation_metrics = model.evaluate(valid_rows)
        test_metrics = model.evaluate(test_rows)
        artifact_path = model.save(output_dir / f"{language}_model.pkl")
        report["languages"][language] = {
            "train_documents": len(train_rows),
            "validation_documents": len(valid_rows),
            "test_documents": len(test_rows),
            "threshold_tuning": threshold_report,
            "validation_metrics": validation_metrics,
            "test_metrics": test_metrics,
            "model_metadata": model.metadata,
            "artifact": str(artifact_path),
        }
        print(
            f"{language}: train={len(train_rows)} valid={len(valid_rows)} test={len(test_rows)} "
            f"test PR-AUC={test_metrics['pr_auc']:.4f} recall={test_metrics['recall']:.4f} "
            f"FPR={test_metrics['false_positive_rate']:.4f} threshold={model.threshold:.4f}"
        )

    report_path = output_dir / "strong_training_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
