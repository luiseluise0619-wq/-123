"""Repository-backed, non-executing training for the AegisAI local risk model.

Only Python source text in a checked-out repository is read. Bandit supplies
function labels from static findings; no source file is imported, evaluated, or
executed. The learned model is the project-local LocalRiskModel and remains an
advisory signal. Security findings and patch verification remain Bandit-driven.
"""

from __future__ import annotations

import ast
import hashlib
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence, Tuple

from security_engine.red_blue_arena import LocalRiskModel


@dataclass(frozen=True)
class FunctionSample:
    """A non-persisted function snippet and its static-analysis label."""

    source: str
    label: int
    file_group: str


class RepositoryRiskTrainer:
    """Train and evaluate a local model from a repository without running code."""

    def __init__(self, repository_root: str | Path, excluded_directories: Sequence[str] = (".git", "tests")):
        self.repository_root = Path(repository_root).resolve()
        self.excluded_directories = set(excluded_directories)

    def _python_files(self) -> List[Path]:
        files: List[Path] = []
        for path in self.repository_root.rglob("*.py"):
            relative_parts = path.relative_to(self.repository_root).parts
            if any(part in self.excluded_directories for part in relative_parts):
                continue
            if path.is_file():
                files.append(path)
        return sorted(files)

    def _bandit_findings_by_path(self) -> Dict[Path, set[int]]:
        """Execute Bandit only; a non-zero exit with findings is expected."""
        exclude_paths = [str(self.repository_root / directory) for directory in self.excluded_directories]
        command = [
            "bandit",
            "-r",
            str(self.repository_root),
            "-f",
            "json",
            "-q",
            "--exclude",
            ",".join(exclude_paths),
        ]
        completed = subprocess.run(command, capture_output=True, text=True, timeout=300)
        try:
            payload = json.loads(completed.stdout or "{}")
        except json.JSONDecodeError as exc:
            raise RuntimeError("Bandit returned invalid JSON; the repository was not trained.") from exc

        findings: Dict[Path, set[int]] = {}
        for result in payload.get("results", []):
            filename = result.get("filename")
            line = result.get("line_number")
            if not filename or not isinstance(line, int):
                continue
            path = Path(filename).resolve()
            findings.setdefault(path, set()).add(line)
        return findings

    @staticmethod
    def _function_ranges(path: Path) -> Iterable[Tuple[str, int, int]]:
        """Extract source text via AST only; malformed files are skipped safely."""
        try:
            source = path.read_text(encoding="utf-8", errors="ignore")
            tree = ast.parse(source)
        except (OSError, SyntaxError, UnicodeError):
            return []
        lines = source.splitlines()
        samples: List[Tuple[str, int, int]] = []
        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            start = node.lineno
            end = getattr(node, "end_lineno", start)
            snippet = "\n".join(lines[start - 1 : end])
            if snippet.strip():
                samples.append((snippet, start, end))
        return samples

    def collect_samples(self) -> Tuple[List[FunctionSample], Dict[str, int]]:
        """Build function-level labels from Bandit line findings without persistence."""
        files = self._python_files()
        findings_by_path = self._bandit_findings_by_path()
        samples: List[FunctionSample] = []
        for path in files:
            vulnerable_lines = findings_by_path.get(path.resolve(), set())
            group = str(path.relative_to(self.repository_root))
            for snippet, start, end in self._function_ranges(path):
                label = int(any(start <= line <= end for line in vulnerable_lines))
                samples.append(FunctionSample(source=snippet, label=label, file_group=group))

        metadata = {
            "python_files_scanned": len(files),
            "functions_extracted": len(samples),
            "positive_function_labels": sum(sample.label for sample in samples),
            "negative_function_labels": sum(1 - sample.label for sample in samples),
            "static_findings": sum(len(lines) for lines in findings_by_path.values()),
        }
        return samples, metadata

    @staticmethod
    def _is_holdout(file_group: str) -> bool:
        """Hold out roughly 20% of source files deterministically by file name."""
        digest = hashlib.sha256(file_group.encode("utf-8")).digest()
        return digest[0] % 5 == 0

    def _split_samples(self, samples: Sequence[FunctionSample]) -> Tuple[List[FunctionSample], List[FunctionSample]]:
        training = [sample for sample in samples if not self._is_holdout(sample.file_group)]
        holdout = [sample for sample in samples if self._is_holdout(sample.file_group)]
        # Preserve a meaningful model fit even on small repositories.
        if not training or not holdout or {sample.label for sample in training} != {0, 1}:
            midpoint = max(1, int(len(samples) * 0.8))
            training = list(samples[:midpoint])
            holdout = list(samples[midpoint:])
        return training, holdout

    @staticmethod
    def _metrics(model: LocalRiskModel, samples: Sequence[FunctionSample]) -> Dict[str, Any]:
        if not samples:
            return {
                "evaluated_documents": 0,
                "accuracy": None,
                "precision": None,
                "recall": None,
                "true_positive": 0,
                "false_positive": 0,
                "true_negative": 0,
                "false_negative": 0,
            }
        predictions = [int(model.predict_vulnerability_probability(sample.source) >= 0.5) for sample in samples]
        labels = [sample.label for sample in samples]
        true_positive = sum(prediction == 1 and label == 1 for prediction, label in zip(predictions, labels))
        false_positive = sum(prediction == 1 and label == 0 for prediction, label in zip(predictions, labels))
        true_negative = sum(prediction == 0 and label == 0 for prediction, label in zip(predictions, labels))
        false_negative = sum(prediction == 0 and label == 1 for prediction, label in zip(predictions, labels))
        total = len(labels)
        return {
            "evaluated_documents": total,
            "accuracy": round((true_positive + true_negative) / total, 6),
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
        """Fit a local model and return real file-level holdout metrics.

        A learning curve is recomputed from incrementally larger prefixes of the
        actual training split. It is a measurement, not a claimed constant.
        """
        samples, corpus = self.collect_samples()
        if len(samples) < 4 or {sample.label for sample in samples} != {0, 1}:
            raise ValueError(
                "Repository training requires at least four extracted functions with both Bandit-labelled classes."
            )
        training, holdout = self._split_samples(samples)
        if not holdout or {sample.label for sample in training} != {0, 1}:
            raise ValueError("Repository split cannot produce a trainable file-level holdout evaluation.")

        training = sorted(training, key=lambda sample: hashlib.sha256(sample.file_group.encode("utf-8")).hexdigest())
        learning_curve: List[Dict[str, Any]] = []
        for percentage in (25, 50, 75, 100):
            count = max(2, int(len(training) * percentage / 100))
            stage_samples = training[:count]
            if {sample.label for sample in stage_samples} != {0, 1}:
                continue
            stage_model = LocalRiskModel()
            stage_model.fit([(sample.source, sample.label) for sample in stage_samples])
            learning_curve.append(
                {
                    "training_percentage": percentage,
                    "training_documents": len(stage_samples),
                    **self._metrics(stage_model, holdout),
                }
            )

        model = LocalRiskModel()
        model.fit([(sample.source, sample.label) for sample in training])
        evaluation = self._metrics(model, holdout)
        report = {
            "data_source": "checked-out GitHub repository Python source",
            "source_execution": False,
            "source_persisted": False,
            "label_source": "Bandit static-analysis findings mapped to AST function ranges",
            "split_strategy": "deterministic source-file-level holdout (approximately 80/20)",
            "corpus": corpus,
            "training_documents": len(training),
            "holdout_documents": len(holdout),
            "model": model.metadata(),
            "holdout_metrics": evaluation,
            "learning_curve": learning_curve,
            "accuracy_interpretation": (
                "Accuracy is shown because it was requested, but precision and recall must be read alongside it "
                "when vulnerability labels are imbalanced."
            ),
        }
        return model, report
