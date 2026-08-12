"""Train AegisAI's local risk model from public, pre-labelled code corpora.

The trainer consumes text-only code-gadget files already published by the
VulDeePecker project. It does not import, compile, run, or otherwise execute
any downloaded sample. Labels, groups, and source provenance are retained only
as aggregate metadata in the returned report; raw source is not persisted by
this module.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple

from cve_train import dedup, parse
from security_engine.red_blue_arena import LocalRiskModel


@dataclass(frozen=True)
class PublicCorpusSample:
    source: str
    label: int
    group: str


class PublicVulnerabilityCorpusTrainer:
    """Fit a local model with publicly distributed, pre-labelled code text."""

    def __init__(self, data_directory: str | Path):
        self.data_directory = Path(data_directory).resolve()

    def _load_samples(self) -> Tuple[List[PublicCorpusSample], List[str], int]:
        files = sorted(self.data_directory.glob("cwe*.txt"))
        if not files:
            raise FileNotFoundError(
                f"No public vulnerability corpus files found in {self.data_directory}. "
                "Run fetch_cve_data.py first."
            )
        raw_codes, raw_labels, raw_groups = parse([str(path) for path in files])
        raw_count = len(raw_codes)
        codes, labels, groups = dedup(raw_codes, raw_labels, raw_groups)
        samples = [
            PublicCorpusSample(source=code, label=int(label), group=str(group))
            for code, label, group in zip(codes, labels, groups)
            if code.strip()
        ]
        return samples, [path.name for path in files], raw_count

    @staticmethod
    def _is_holdout(group: str) -> bool:
        """Deterministically retain approximately one fifth of source groups."""
        return hashlib.sha256(group.encode("utf-8")).digest()[0] % 5 == 0

    def _split(self, samples: Sequence[PublicCorpusSample]) -> Tuple[List[PublicCorpusSample], List[PublicCorpusSample]]:
        train = [sample for sample in samples if not self._is_holdout(sample.group)]
        holdout = [sample for sample in samples if self._is_holdout(sample.group)]
        if not train or not holdout or {sample.label for sample in train} != {0, 1}:
            ordered = sorted(samples, key=lambda sample: hashlib.sha256(sample.group.encode("utf-8")).hexdigest())
            pivot = max(2, int(len(ordered) * 0.8))
            train, holdout = ordered[:pivot], ordered[pivot:]
        if not holdout or {sample.label for sample in train} != {0, 1}:
            raise ValueError("Public corpus cannot create a trainable group-level holdout split.")
        return train, holdout

    @staticmethod
    def _metrics(model: LocalRiskModel, samples: Sequence[PublicCorpusSample]) -> Dict[str, Any]:
        true_positive = false_positive = true_negative = false_negative = 0
        for sample in samples:
            prediction = int(model.predict_vulnerability_probability(sample.source) >= 0.5)
            if prediction == 1 and sample.label == 1:
                true_positive += 1
            elif prediction == 1 and sample.label == 0:
                false_positive += 1
            elif prediction == 0 and sample.label == 0:
                true_negative += 1
            else:
                false_negative += 1
        total = len(samples)
        return {
            "evaluated_documents": total,
            "accuracy": round((true_positive + true_negative) / total, 6) if total else None,
            "precision": round(true_positive / (true_positive + false_positive), 6)
            if true_positive + false_positive
            else None,
            "recall": round(true_positive / (true_positive + false_negative), 6)
            if true_positive + false_negative
            else None,
            "true_positive": true_positive,
            "false_positive": false_positive,
            "true_negative": true_negative,
            "false_negative": false_negative,
        }

    def train(self) -> Tuple[LocalRiskModel, Dict[str, Any]]:
        """Use all deduplicated local corpus rows for a group-held-out evaluation."""
        samples, filenames, raw_count = self._load_samples()
        if len(samples) < 4 or {sample.label for sample in samples} != {0, 1}:
            raise ValueError("Public corpus requires at least four samples with both labels.")
        train, holdout = self._split(samples)
        model = LocalRiskModel()
        model.fit(
            [(sample.source, sample.label) for sample in train],
            label_source="VulDeePecker dataset-provided labels on non-executed public code text",
        )
        report = {
            "data_source": "public GitHub-hosted VulDeePecker code-gadget corpus",
            "source_execution": False,
            "source_persisted": False,
            "label_source": "dataset-provided vulnerability labels; source code is read as text only",
            "split_strategy": "deterministic program-group holdout (approximately 80/20)",
            "corpus": {
                "dataset_files": filenames,
                "raw_documents": raw_count,
                "deduplicated_documents": len(samples),
                "positive_documents": sum(sample.label for sample in samples),
                "negative_documents": sum(1 - sample.label for sample in samples),
                "source_groups": len({sample.group for sample in samples}),
            },
            "training_documents": len(train),
            "holdout_documents": len(holdout),
            "model": model.metadata(),
            "holdout_metrics": self._metrics(model, holdout),
            "accuracy_interpretation": (
                "Accuracy is reported with precision and recall. The model is an advisory prioritisation signal; "
                "static-analysis evidence remains the security judge."
            ),
        }
        return model, report
