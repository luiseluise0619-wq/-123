"""Language-wise hyperparameter search for CVEfixes local vulnerability models.

The optimiser uses CVEfixes pre-fix/post-fix method pairs, keeps source groups
separated by the existing language tuner, searches only validation-set
performance, and refits the selected model on all local rows. It does not
execute source or access an external target.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, Iterable, List, Sequence, Tuple

from security_engine.cvefixes_patch_pipeline import CVEfixesPatchPipeline
from security_engine.language_model_tuner import LanguageExample, LanguageModelTuner
from security_engine.red_blue_arena import LocalRiskModel


class CVEfixesLanguageHyperOptimizer:
    """Select per-language smoothing and threshold targets using held-out groups."""

    def __init__(
        self,
        database_path: str,
        smoothing_alphas: Sequence[float] = (0.25, 0.5, 1.0, 2.0),
        minimum_recalls: Sequence[float] = (0.75, 0.80, 0.85, 0.90),
        limit: int | None = None,
    ) -> None:
        if not smoothing_alphas or not minimum_recalls:
            raise ValueError("At least one smoothing alpha and minimum recall target are required.")
        if any(alpha <= 0 for alpha in smoothing_alphas):
            raise ValueError("All smoothing alphas must be greater than zero.")
        if any(not 0 < recall <= 1 for recall in minimum_recalls):
            raise ValueError("All minimum recall targets must be in (0, 1].")
        self.pipeline = CVEfixesPatchPipeline(database_path)
        self.smoothing_alphas = tuple(float(alpha) for alpha in smoothing_alphas)
        self.minimum_recalls = tuple(float(recall) for recall in minimum_recalls)
        self.limit = limit

    @staticmethod
    def _objective(metrics: Dict[str, Any]) -> float:
        """Favor F1 and recall while explicitly penalising post-fix false positives."""
        return round(
            0.50 * float(metrics["f1"])
            + 0.25 * float(metrics["recall"])
            + 0.15 * float(metrics["precision"])
            - 0.10 * float(metrics["false_positive_rate"]),
            6,
        )

    @staticmethod
    def _serialize_candidate(
        smoothing_alpha: float,
        minimum_recall: float,
        language_report: Dict[str, Any],
    ) -> Dict[str, Any]:
        metrics = language_report["validation_metrics"]
        return {
            "smoothing_alpha": smoothing_alpha,
            "minimum_recall": minimum_recall,
            "selected_threshold": language_report["selected_threshold"],
            "selection_reason": language_report["threshold_tuning"]["selection_reason"],
            "validation_metrics": metrics,
            "objective": CVEfixesLanguageHyperOptimizer._objective(metrics),
            "training_documents": language_report["training_documents"],
            "validation_documents": language_report["validation_documents"],
            "hard_negative_training_documents": language_report["hard_negative_training_documents"],
        }

    @staticmethod
    def _refit_all(rows: Iterable[LanguageExample], smoothing_alpha: float, threshold: float) -> LocalRiskModel:
        model = LocalRiskModel(smoothing_alpha=smoothing_alpha)
        model.fit(
            [(row.code, row.label) for row in rows],
            label_source="CVEfixes pre-fix labels plus post-fix hard negatives; selected by group-held-out validation",
        )
        model.decision_threshold = threshold
        return model

    def optimize(self) -> Tuple[Dict[str, LocalRiskModel], Dict[str, Any]]:
        pairs = self.pipeline.load_pairs(limit=self.limit)
        raw_examples = self.pipeline.language_examples(pairs)
        clean_examples = LanguageModelTuner.add_hard_negatives(raw_examples)
        by_language: Dict[str, List[LanguageExample]] = defaultdict(list)
        for example in clean_examples:
            by_language[example.language].append(example)

        selected_models: Dict[str, LocalRiskModel] = {}
        language_report: Dict[str, Any] = {}
        for language, rows in sorted(by_language.items()):
            candidates: List[Dict[str, Any]] = []
            for alpha in self.smoothing_alphas:
                for minimum_recall in self.minimum_recalls:
                    tuner = LanguageModelTuner(minimum_recall=minimum_recall, smoothing_alpha=alpha)
                    _, report = tuner.train(rows)
                    result = report["languages"].get(language, {})
                    if not result.get("trained"):
                        continue
                    candidates.append(self._serialize_candidate(alpha, minimum_recall, result))
            if not candidates:
                language_report[language] = {
                    "optimized": False,
                    "reason": "insufficient_rows_or_labels",
                    "documents": len(rows),
                }
                continue
            best = max(
                candidates,
                key=lambda candidate: (
                    candidate["objective"],
                    candidate["validation_metrics"]["f1"],
                    candidate["validation_metrics"]["precision"],
                    -candidate["validation_metrics"]["false_positive_rate"],
                ),
            )
            selected_models[language] = self._refit_all(
                rows,
                smoothing_alpha=float(best["smoothing_alpha"]),
                threshold=float(best["selected_threshold"]),
            )
            language_report[language] = {
                "optimized": True,
                "documents": len(rows),
                "hard_negative_documents": sum(row.source_kind == "post_fix_hard_negative" for row in rows),
                "selected": best,
                "candidates_evaluated": candidates,
                "final_refit_model": selected_models[language].metadata(),
            }

        return selected_models, {
            "data_source": "CVEfixes local SQLite pre-fix/post-fix method pairs",
            "source_execution": False,
            "source_persisted": False,
            "pair_limit": self.limit,
            "patch_pairs_loaded": len(pairs),
            "smoothing_alphas": list(self.smoothing_alphas),
            "minimum_recalls": list(self.minimum_recalls),
            "selection_objective": "0.50*F1 + 0.25*recall + 0.15*precision - 0.10*false_positive_rate",
            "languages": language_report,
        }
