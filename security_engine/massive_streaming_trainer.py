"""
Massive streaming trainer for AegisAI.

This module is designed for 10M+ samples while keeping memory bounded. It uses
HashingVectorizer and SGDClassifier.partial_fit, so callers can stream rows from
Hugging Face, Parquet, JSONL, or GitHub-derived manifests without materialising the
entire corpus. It records actual processed samples separately from the configured
target and never fabricates completion metrics.
"""

from __future__ import annotations

import json
import pickle
from pathlib import Path
from typing import Any, Iterable, Sequence

import numpy as np
from sklearn.feature_extraction.text import HashingVectorizer
from sklearn.linear_model import SGDClassifier


class MassiveStreamingTrainer:
    def __init__(
        self,
        model_dir: Path,
        n_features: int = 262_144,
        target_samples: int = 10_000_000,
    ) -> None:
        if target_samples < 1:
            raise ValueError("target_samples must be positive")
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self.n_features = int(n_features)
        self.target_samples = int(target_samples)
        self.vectorizer = HashingVectorizer(
            analyzer="word",
            ngram_range=(1, 2),
            n_features=self.n_features,
            alternate_sign=False,
            norm="l2",
        )
        self.classifier = SGDClassifier(
            loss="log_loss",
            penalty="l2",
            alpha=1e-5,
            max_iter=1,
            tol=None,
            random_state=42,
        )
        self.classes = np.array([0, 1])
        self.total_seen = 0
        self.chunks_seen = 0

    @property
    def target_reached(self) -> bool:
        return self.total_seen >= self.target_samples

    def partial_fit_chunk(self, texts: Sequence[str], labels: Sequence[int]) -> int:
        """Fit one bounded chunk and return the number of accepted rows."""
        if len(texts) != len(labels):
            raise ValueError("texts and labels must have the same length")
        if not texts:
            return 0
        clean_texts: list[str] = []
        clean_labels: list[int] = []
        for text, label in zip(texts, labels):
            if text is None or not str(text).strip():
                continue
            integer_label = int(label)
            if integer_label not in (0, 1):
                raise ValueError("labels must be 0 or 1")
            clean_texts.append(str(text))
            clean_labels.append(integer_label)
        if not clean_texts:
            return 0
        X = self.vectorizer.transform(clean_texts)
        self.classifier.partial_fit(X, np.asarray(clean_labels, dtype=int), classes=self.classes)
        accepted = len(clean_texts)
        self.total_seen += accepted
        self.chunks_seen += 1
        return accepted

    def fit_stream(
        self,
        rows: Iterable[tuple[str, int]],
        chunk_size: int = 4096,
        max_samples: int | None = None,
    ) -> dict[str, Any]:
        """Consume an iterable until exhaustion, a cap, or the target is reached."""
        if chunk_size < 1:
            raise ValueError("chunk_size must be positive")
        texts: list[str] = []
        labels: list[int] = []
        processed_before = self.total_seen
        for text, label in rows:
            if max_samples is not None and self.total_seen >= max_samples:
                break
            texts.append(text)
            labels.append(label)
            if len(texts) >= chunk_size:
                remaining = None if max_samples is None else max_samples - self.total_seen
                if remaining is not None and remaining < len(texts):
                    texts, labels = texts[:remaining], labels[:remaining]
                self.partial_fit_chunk(texts, labels)
                texts, labels = [], []
                if self.target_reached:
                    break
        if texts and not self.target_reached and (max_samples is None or self.total_seen < max_samples):
            remaining = None if max_samples is None else max_samples - self.total_seen
            if remaining is not None:
                texts, labels = texts[:remaining], labels[:remaining]
            self.partial_fit_chunk(texts, labels)
        return self.progress(processed_before=processed_before)

    def progress(self, processed_before: int = 0) -> dict[str, Any]:
        return {
            "target_samples": self.target_samples,
            "processed_samples": self.total_seen,
            "processed_this_call": self.total_seen - processed_before,
            "chunks_seen": self.chunks_seen,
            "target_reached": self.target_reached,
            "completion_ratio": min(1.0, self.total_seen / self.target_samples),
            "scale_status": "target_reached" if self.target_reached else "in_progress",
        }

    def save_model(self, language: str) -> Path:
        model_path = self.model_dir / f"massive_{language}_model_10m.pkl"
        with model_path.open("wb") as handle:
            pickle.dump(
                {
                    "vectorizer": self.vectorizer,
                    "classifier": self.classifier,
                    "total_seen": self.total_seen,
                    "chunks_seen": self.chunks_seen,
                    "target_samples": self.target_samples,
                    "n_features": self.n_features,
                },
                handle,
            )
        return model_path

    def load_model(self, language: str) -> bool:
        model_path = self.model_dir / f"massive_{language}_model_10m.pkl"
        if not model_path.exists():
            return False
        with model_path.open("rb") as handle:
            data = pickle.load(handle)
        self.vectorizer = data["vectorizer"]
        self.classifier = data["classifier"]
        self.total_seen = int(data.get("total_seen", 0))
        self.chunks_seen = int(data.get("chunks_seen", 0))
        self.target_samples = int(data.get("target_samples", self.target_samples))
        self.n_features = int(data.get("n_features", self.n_features))
        return True

    def write_progress_report(self, path: Path, extra: dict[str, Any] | None = None) -> Path:
        report = {"model": "massive-streaming-sgd-v1", **self.progress()}
        if extra:
            report.update(extra)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        return path
