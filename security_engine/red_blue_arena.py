"""Safe local Red-Team / Blue-Team training arena for AegisAI.

The arena never contacts a network target and never executes a submitted or
training-code sample. "Red" means selecting a small, audited catalogue of
local code strings that demonstrate static-analysis findings. "Blue" means
applying only the repository's deterministic patch rules. Bandit is the judge
for both labels and patch verification.

The risk model is a small, from-scratch multinomial Naive Bayes classifier. It
is intentionally a prioritisation aid: all security verdicts and all scores
still come from the judge's real scan results.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Sequence, Tuple

from security_ai_core import patch_agent, reasoning_agent
from security_engine.real_detector import scan_python_with_bandit


_TOKEN_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*|[^\sA-Za-z0-9_]")
MODEL_VERSION = "local-multinomial-naive-bayes-v1"


@dataclass(frozen=True)
class TrainingScenario:
    """Audited local source used only to exercise defensive analysis."""

    scenario_id: str
    category: str
    description: str
    source_code: str


SAFE_TRAINING_SCENARIOS: Tuple[TrainingScenario, ...] = (
    TrainingScenario(
        scenario_id="weak-hash",
        category="cryptography",
        description="Weak hash identification and verified upgrade exercise.",
        source_code=(
            "import hashlib\n\n"
            "def digest(data):\n"
            "    return hashlib.md5(data).hexdigest()\n"
        ),
    ),
    TrainingScenario(
        scenario_id="shell-flag",
        category="command-handling",
        description="Shell flag identification and removal exercise.",
        source_code=(
            "import subprocess\n\n"
            "def execute(command):\n"
            "    return subprocess.call(command, shell=True)\n"
        ),
    ),
    TrainingScenario(
        scenario_id="insecure-tempfile",
        category="temporary-files",
        description="Unsafe temporary-file API identification exercise.",
        source_code=(
            "import tempfile\n\n"
            "def make_path():\n"
            "    return tempfile.mktemp()\n"
        ),
    ),
    TrainingScenario(
        scenario_id="assert-check",
        category="runtime-validation",
        description="Production assertion identification exercise.",
        source_code=(
            "def validate(value):\n"
            "    assert value > 0\n"
            "    return value\n"
        ),
    ),
)


CLEAN_TRAINING_SAMPLES: Tuple[str, ...] = (
    "def add(left, right):\n    return left + right\n",
    "def normalize(name):\n    return name.strip().lower()\n",
    "def in_range(value, low, high):\n    return low <= value <= high\n",
    "def unique(items):\n    return sorted(set(items))\n",
)


def _tokens(code: str) -> List[str]:
    """Tokenise source without parsing, evaluating, or executing it."""
    return [token.lower() for token in _TOKEN_RE.findall(code)]


def _rule_ids(findings: Iterable[Dict[str, Any]]) -> List[str]:
    return sorted({str(finding.get("rule_id", "UNKNOWN")) for finding in findings})


class LocalRiskModel:
    """A small local classifier trained only on judge-labelled code samples.

    This is implemented directly instead of relying on a hosted model or an
    external AI API. Its probability ranks exercises but cannot override the
    Bandit judge's findings.
    """

    def __init__(self) -> None:
        self.class_document_counts: Counter[int] = Counter()
        self.class_token_counts: Dict[int, Counter[str]] = {0: Counter(), 1: Counter()}
        self.class_total_tokens: Counter[int] = Counter()
        self.vocabulary: set[str] = set()
        self.trained_at: str | None = None

    @property
    def is_trained(self) -> bool:
        return self.class_document_counts[0] > 0 and self.class_document_counts[1] > 0

    def fit(self, samples: Sequence[Tuple[str, int]]) -> Dict[str, Any]:
        self.class_document_counts.clear()
        self.class_token_counts = {0: Counter(), 1: Counter()}
        self.class_total_tokens.clear()
        self.vocabulary.clear()

        for code, label in samples:
            if label not in (0, 1):
                raise ValueError("Risk-model labels must be 0 or 1.")
            tokens = _tokens(code)
            self.class_document_counts[label] += 1
            self.class_token_counts[label].update(tokens)
            self.class_total_tokens[label] += len(tokens)
            self.vocabulary.update(tokens)

        if not self.is_trained:
            raise ValueError("The local risk model requires judge-labelled positive and negative samples.")
        self.trained_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        return self.metadata()

    def predict_vulnerability_probability(self, code: str) -> float:
        if not self.is_trained:
            raise RuntimeError("The local risk model has not been trained.")

        tokens = _tokens(code)
        vocabulary_size = max(len(self.vocabulary), 1)
        total_docs = self.class_document_counts[0] + self.class_document_counts[1]
        log_scores: Dict[int, float] = {}
        for label in (0, 1):
            # Laplace smoothing keeps probabilities defined for unseen tokens.
            log_probability = math.log((self.class_document_counts[label] + 1) / (total_docs + 2))
            denominator = self.class_total_tokens[label] + vocabulary_size
            for token in tokens:
                count = self.class_token_counts[label][token]
                log_probability += math.log((count + 1) / denominator)
            log_scores[label] = log_probability

        maximum = max(log_scores.values())
        exp_zero = math.exp(log_scores[0] - maximum)
        exp_one = math.exp(log_scores[1] - maximum)
        return exp_one / (exp_zero + exp_one)

    def metadata(self) -> Dict[str, Any]:
        return {
            "model_type": "local multinomial naive bayes (from scratch)",
            "model_version": MODEL_VERSION,
            "trained": self.is_trained,
            "trained_at": self.trained_at,
            "training_documents": int(sum(self.class_document_counts.values())),
            "positive_documents": int(self.class_document_counts[1]),
            "negative_documents": int(self.class_document_counts[0]),
            "vocabulary_size": len(self.vocabulary),
            "label_source": "Bandit static-analysis judge on local non-executed training samples",
            "decision_limit": "Model probability is advisory; the judge decides findings and scores.",
        }


class RedBlueTrainingArena:
    """Coordinates safe exercise selection, defence, independent judging, and training."""

    def __init__(self) -> None:
        self.risk_model = LocalRiskModel()
        self.training_history: List[Dict[str, Any]] = []

    @staticmethod
    def judge(code: str) -> List[Dict[str, Any]]:
        """Run the real local static analyser; code is never executed."""
        return scan_python_with_bandit(code)

    def train_risk_model(self) -> Dict[str, Any]:
        """Create labels with the real judge, then fit the local model."""
        labelled_samples: List[Tuple[str, int]] = []
        for scenario in SAFE_TRAINING_SCENARIOS:
            label = int(bool(self.judge(scenario.source_code)))
            labelled_samples.append((scenario.source_code, label))
        for clean_sample in CLEAN_TRAINING_SAMPLES:
            label = int(bool(self.judge(clean_sample)))
            labelled_samples.append((clean_sample, label))
        return self.risk_model.fit(labelled_samples)

    def run_rounds(self, rounds: int = 4, retrain_model: bool = True) -> Dict[str, Any]:
        """Run bounded, local code exercises and return judge-backed results only."""
        if not 1 <= rounds <= 16:
            raise ValueError("rounds must be between 1 and 16.")
        if retrain_model or not self.risk_model.is_trained:
            self.train_risk_model()

        scoreboard = {"red_points": 0, "blue_points": 0, "judge_verified_fixes": 0}
        exercises: List[Dict[str, Any]] = []

        for round_index in range(rounds):
            scenario = SAFE_TRAINING_SCENARIOS[round_index % len(SAFE_TRAINING_SCENARIOS)]
            before = self.judge(scenario.source_code)
            before_rule_ids = _rule_ids(before)
            probability = self.risk_model.predict_vulnerability_probability(scenario.source_code)
            red_detected = bool(before)
            model_predicted_vulnerable = probability >= 0.5
            if red_detected:
                scoreboard["red_points"] += 100

            patched_code = scenario.source_code
            attempted_rules: List[str] = []
            needs_human_review: List[str] = []
            for finding in before:
                rule_id = str(finding.get("rule_id", "UNKNOWN"))
                patch = patch_agent(patched_code, {"rule_id": rule_id})
                if patch["patched"]:
                    patched_code = patch["code"]
                    attempted_rules.append(rule_id)
                elif patch.get("needs_llm"):
                    needs_human_review.append(rule_id)

            after = self.judge(patched_code)
            after_rule_ids = _rule_ids(after)
            verified_rules = sorted(set(attempted_rules) - set(after_rule_ids))
            if verified_rules:
                scoreboard["blue_points"] += 100 * len(verified_rules)
                scoreboard["judge_verified_fixes"] += len(verified_rules)

            exercise = {
                "round": round_index + 1,
                "scenario_id": scenario.scenario_id,
                "category": scenario.category,
                "red_detected_by_judge": red_detected,
                "model_vulnerability_probability": round(probability, 6),
                "model_predicted_vulnerable": model_predicted_vulnerable,
                "model_judge_agreement": model_predicted_vulnerable == red_detected,
                "judge_before_rule_ids": before_rule_ids,
                "judge_before_findings": len(before),
                "blue_attempted_rule_ids": sorted(set(attempted_rules)),
                "blue_needs_human_review_rule_ids": sorted(set(needs_human_review)),
                "judge_after_rule_ids": after_rule_ids,
                "judge_after_findings": len(after),
                "judge_verified_fixed_rule_ids": verified_rules,
                "blue_fix_verified": bool(verified_rules),
                "source_persisted": False,
                "source_executed": False,
            }
            exercises.append(exercise)
            self.training_history.append(exercise)

        return {
            "mode": "safe-local-red-blue-training",
            "safety_boundary": "Local static analysis only. No source execution, network target, or exploit delivery.",
            "scoreboard": scoreboard,
            "model": self.risk_model.metadata(),
            "exercises": exercises,
        }
