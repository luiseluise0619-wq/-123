"""Read-only registry for locally trained strong vulnerability models.

Model files are produced by train_strong_models.py. Loading is explicit and
local; no source code is executed and no model file is fetched from a URL.
"""

from __future__ import annotations

import json
import pickle
from pathlib import Path
from typing import Any, Dict, Mapping


class StrongModelRegistry:
    def __init__(self, model_root: str | Path):
        self.model_root = Path(model_root).resolve()
        self.models: Dict[str, Any] = {}
        self.report: Dict[str, Any] = {}

    def load(self) -> Dict[str, Any]:
        report_path = self.model_root / "strong_training_report.json"
        if not report_path.exists():
            raise FileNotFoundError("Strong model report is not present. Train strong models first.")
        self.report = json.loads(report_path.read_text(encoding="utf-8"))
        for language in self.report.get("languages", {}):
            artifact = self.model_root / f"{language}_model.pkl"
            if artifact.exists():
                with artifact.open("rb") as model_file:
                    self.models[language] = pickle.load(model_file)
        if not self.models:
            raise FileNotFoundError("No strong model artifacts were found.")
        return self.metadata()

    def metadata(self) -> Dict[str, Any]:
        return {
            "model_family": self.report.get("model_family", "strong_vulnerability_model_v1"),
            "languages_available": sorted(self.models),
            "training_report": self.report,
            "source_execution": False,
            "source_persisted": False,
        }

    def predict(self, code: str, language: str) -> Dict[str, Any]:
        normalized = language.strip().lower().replace("c++", "c_cpp").replace("cpp", "c_cpp")
        model = self.models.get(normalized)
        if model is None:
            return {
                "model_available": False,
                "language": normalized,
                "reason": "no_strong_model_for_language",
                "source_execution": False,
            }
        result = model.predict_code(code)
        result["model_available"] = True
        return result


class StrongPythonRiskAdapter:
    """Adapt the trained Python model to the arena's advisory-risk interface."""

    def __init__(self, registry: StrongModelRegistry):
        if "python" not in registry.models:
            raise ValueError("A trained Python strong model is required for Python arena exercises.")
        self.registry = registry
        self.model = registry.models["python"]

    @property
    def is_trained(self) -> bool:
        return True

    def predict_vulnerability_probability(self, code: str) -> float:
        return float(self.model.predict_code(code)["vulnerability_probability"])

    @property
    def decision_threshold(self) -> float:
        return float(self.model.threshold)

    def metadata(self) -> Dict[str, Any]:
        metadata = dict(self.model.metadata)
        metadata["decision_threshold"] = self.model.threshold
        metadata["decision_limit"] = "Strong model is advisory; the Bandit judge decides findings and scores."
        return metadata
