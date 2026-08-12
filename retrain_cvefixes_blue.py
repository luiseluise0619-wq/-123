"""Train language-specific Blue-Team models from a local CVEfixes SQLite database.

Example:
  python retrain_cvefixes_blue.py \
      --db /data/CVEfixes.db \
      --models-dir models/cvefixes_languages \
      --minimum-recall 0.85

The script reads source text from CVEfixes but never imports, compiles, or
executes it. Post-fix revisions are kept as hard-negative examples. Outputs
contain model objects and aggregate metrics only, not raw database source.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from security_engine.cvefixes_patch_pipeline import CVEfixesPatchPipeline, PatchEvidenceIndex


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train language-specific local models with CVEfixes pre-fix/post-fix pairs."
    )
    parser.add_argument("--db", required=True, help="Path to a converted official CVEfixes SQLite database.")
    parser.add_argument("--models-dir", default="models/cvefixes_languages", help="Directory for local model artifacts.")
    parser.add_argument("--minimum-recall", type=float, default=0.80, help="Validation recall target for threshold tuning.")
    parser.add_argument("--limit", type=int, default=None, help="Optional maximum number of patch pairs for a dry run.")
    args = parser.parse_args()

    pipeline = CVEfixesPatchPipeline(args.db)
    pairs = pipeline.load_pairs(limit=args.limit)
    if not pairs:
        raise SystemExit("No matching CVEfixes pre-fix/post-fix method pairs were found.")
    models, report = pipeline.train_language_models(minimum_recall=args.minimum_recall, limit=args.limit)

    output_directory = Path(args.models_dir)
    output_directory.mkdir(parents=True, exist_ok=True)
    try:
        import joblib

        def save_model(model, path):
            joblib.dump(model, path)

        artifact_extension = "joblib"
    except ImportError:
        import pickle

        def save_model(model, path):
            with open(path, "wb") as artifact_file:
                pickle.dump(model, artifact_file)

        artifact_extension = "pkl"

    for language, model in models.items():
        save_model(model, output_directory / f"{language}_risk_model.{artifact_extension}")
    evidence = PatchEvidenceIndex(pairs)
    evidence_metadata = {
        "patch_pairs": len(pairs),
        "languages": sorted({pair.language for pair in pairs}),
        "retrieval_returns_source_code": False,
        "auto_apply_allowed": False,
        "requires_static_rescan": True,
        "artifact_extension": artifact_extension,
    }
    (output_directory / "training_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (output_directory / "patch_evidence_metadata.json").write_text(
        json.dumps(evidence_metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    # Keep the local evidence index alive only for the current process. Its
    # metadata is saved above, but raw patch source is deliberately not emitted.
    _ = evidence

    print(json.dumps({"models": sorted(models), "report": report, "evidence": evidence_metadata}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
