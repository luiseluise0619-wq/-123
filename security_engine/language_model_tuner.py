"""Language-aware local vulnerability-model training and threshold calibration.

This module trains a separate LocalRiskModel per language. It treats validated
post-fix functions as hard negatives: they are structurally close to
vulnerable pre-fix functions but carry a safe label. Thresholds are selected
only on a held-out validation split, never on the fitting rows. No sample is
executed.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Mapping, Sequence, Tuple

from security_engine.red_blue_arena import LocalRiskModel


_WHITESPACE = re.compile(r"\s+")
_LANGUAGE_ALIASES = {
    "c++": "cpp",
    "cxx": "cpp",
    "cc": "cpp",
    "py": "python",
    "js": "javascript",
    "ts": "typescript",
}


@dataclass(frozen=True)
class LanguageExample:
    """A read-only labelled function or code gadget used for model fitting."""

    code: str
    label: int
    language: str
    group: str
    source_kind: str = "base"


def normalize_language(language: str | None) -> str:
    normalized = (language or "unknown").strip().lower()
    return _LANGUAGE_ALIASES.get(normalized, normalized or "unknown")


def _normalised_code(code: str) -> str:
    return _WHITESPACE.sub(" ", code).strip()


def _is_validation_group(group: str) -> bool:
    """Use a deterministic group-level validation split of roughly 20 percent."""
    return hashlib.sha256(group.encode("utf-8")).digest()[0] % 5 == 0


def _confusion(labels: Sequence[int], probabilities: Sequence[float], threshold: float) -> Dict[str, int]:
    tp = fp = tn = fn = 0
    for label, probability in zip(labels, probabilities):
        prediction = int(probability >= threshold)
        if prediction and label:
            tp += 1
        elif prediction and not label:
            fp += 1
        elif not prediction and not label:
            tn += 1
        else:
            fn += 1
    return {"true_positive": tp, "false_positive": fp, "true_negative": tn, "false_negative": fn}


def _metrics(labels: Sequence[int], probabilities: Sequence[float], threshold: float) -> Dict[str, Any]:
    counts = _confusion(labels, probabilities, threshold)
    tp, fp = counts["true_positive"], counts["false_positive"]
    tn, fn = counts["true_negative"], counts["false_negative"]
    total = len(labels)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    false_positive_rate = fp / (fp + tn) if fp + tn else 0.0
    return {
        "evaluated_documents": total,
        "accuracy": round((tp + tn) / total, 6) if total else None,
        "precision": round(precision, 6),
        "recall": round(recall, 6),
        "f1": round(f1, 6),
        "false_positive_rate": round(false_positive_rate, 6),
        **counts,
    }


def choose_threshold(
    labels: Sequence[int],
    probabilities: Sequence[float],
    minimum_recall: float = 0.80,
) -> Dict[str, Any]:
    """Select a validation-only threshold that reduces false positives.

    Candidates meeting the requested recall are ranked by precision, then F1,
    then lower false-positive rate. If none meet the target, the best F1 point
    is chosen and that limitation is recorded.
    """
    if not labels or len(labels) != len(probabilities):
        raise ValueError("Threshold tuning requires aligned validation labels and probabilities.")
    candidates = sorted({0.05, 0.95, *[round(value, 4) for value in probabilities]})
    scored = []
    for threshold in candidates:
        metric = _metrics(labels, probabilities, threshold)
        scored.append({"threshold": threshold, **metric})
    meets_recall = [row for row in scored if row["recall"] >= minimum_recall]
    if meets_recall:
        selected = max(
            meets_recall,
            key=lambda row: (row["precision"], row["f1"], -row["false_positive_rate"], row["threshold"]),
        )
        selection_reason = f"max_precision_subject_to_recall_at_least_{minimum_recall:.2f}"
    else:
        selected = max(scored, key=lambda row: (row["f1"], row["recall"], -row["false_positive_rate"]))
        selection_reason = "best_f1_no_candidate_met_minimum_recall"
    return {"selected": selected, "selection_reason": selection_reason, "minimum_recall": minimum_recall, "candidates": scored}


class LanguageModelTuner:
    """Fit one local text model per programming language with calibrated thresholds."""

    def __init__(self, minimum_recall: float = 0.80):
        if not 0 < minimum_recall <= 1:
            raise ValueError("minimum_recall must be in (0, 1].")
        self.minimum_recall = minimum_recall

    @staticmethod
    def add_hard_negatives(examples: Iterable[LanguageExample]) -> List[LanguageExample]:
        """Deduplicate and retain post-fix, structurally similar safe examples.

        Callers provide `source_kind="post_fix_hard_negative"` for CVEfixes
        after-change methods. The method prevents a duplicate code string from
        appearing with inconsistent labels within the same language.
        """
        seen: Dict[Tuple[str, str], LanguageExample] = {}
        for example in examples:
            language = normalize_language(example.language)
            if example.label not in (0, 1):
                raise ValueError("Language example labels must be 0 or 1.")
            key = (language, _normalised_code(example.code))
            current = seen.get(key)
            normalized = LanguageExample(
                code=example.code,
                label=example.label,
                language=language,
                group=str(example.group),
                source_kind=example.source_kind,
            )
            if current is None:
                seen[key] = normalized
            elif current.label != normalized.label:
                # A conflicting label is not suitable as a hard-negative row.
                seen.pop(key, None)
        return list(seen.values())

    @staticmethod
    def _split(examples: Sequence[LanguageExample]) -> Tuple[List[LanguageExample], List[LanguageExample]]:
        train = [example for example in examples if not _is_validation_group(example.group)]
        validation = [example for example in examples if _is_validation_group(example.group)]
        if not validation or {example.label for example in train} != {0, 1}:
            ordered = sorted(examples, key=lambda example: hashlib.sha256(example.group.encode("utf-8")).hexdigest())
            split_at = max(2, int(len(ordered) * 0.8))
            train, validation = ordered[:split_at], ordered[split_at:]
        if not validation or {example.label for example in train} != {0, 1}:
            raise ValueError("Language data cannot produce a trainable validation split with both labels in training.")
        return train, validation

    def train(self, examples: Iterable[LanguageExample]) -> Tuple[Dict[str, LocalRiskModel], Dict[str, Any]]:
        clean_examples = self.add_hard_negatives(examples)
        by_language: Dict[str, List[LanguageExample]] = {}
        for example in clean_examples:
            by_language.setdefault(example.language, []).append(example)

        models: Dict[str, LocalRiskModel] = {}
        report: Dict[str, Any] = {"minimum_recall": self.minimum_recall, "languages": {}}
        for language, rows in sorted(by_language.items()):
            if len(rows) < 4 or {row.label for row in rows} != {0, 1}:
                report["languages"][language] = {
                    "trained": False,
                    "reason": "insufficient_rows_or_labels",
                    "documents": len(rows),
                }
                continue
            train, validation = self._split(rows)
            model = LocalRiskModel()
            hard_negative_count = sum(row.source_kind == "post_fix_hard_negative" for row in train)
            model.fit(
                [(row.code, row.label) for row in train],
                label_source="language-specific CVE-labelled samples with post-fix hard negatives",
            )
            probabilities = [model.predict_vulnerability_probability(row.code) for row in validation]
            threshold_report = choose_threshold(
                [row.label for row in validation], probabilities, self.minimum_recall
            )
            threshold = float(threshold_report["selected"]["threshold"])
            model.decision_threshold = threshold
            models[language] = model
            report["languages"][language] = {
                "trained": True,
                "training_documents": len(train),
                "validation_documents": len(validation),
                "positive_training_documents": sum(row.label for row in train),
                "negative_training_documents": sum(1 - row.label for row in train),
                "hard_negative_training_documents": hard_negative_count,
                "threshold_tuning": threshold_report,
                "selected_threshold": threshold,
                "validation_metrics": _metrics(
                    [row.label for row in validation], probabilities, threshold
                ),
                "model": model.metadata(),
            }
        return models, report

    @staticmethod
    def predict(models: Mapping[str, LocalRiskModel], code: str, language: str) -> Dict[str, Any]:
        normalized_language = normalize_language(language)
        model = models.get(normalized_language)
        if model is None:
            return {
                "model_available": False,
                "language": normalized_language,
                "reason": "no_language_specific_model",
            }
        probability = model.predict_vulnerability_probability(code)
        return {
            "model_available": True,
            "language": normalized_language,
            "vulnerability_probability": probability,
            "decision_threshold": model.decision_threshold,
            "predicted_vulnerable": probability >= model.decision_threshold,
        }
