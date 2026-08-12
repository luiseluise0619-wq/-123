"""Evaluate CVEfixes-trained Blue-Team models and simulate safe Red-Team exercises.

The evaluator reads method text from a local CVEfixes SQLite database, scores
pre-fix and post-fix revisions with language-specific models, and reports
accuracy, precision, recall, and false-positive rate. The simulator runs only
approved local code strings through the static-analysis judge; it does not
execute code, contact targets, or deliver exploit payloads.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Sequence

from security_ai_core import patch_agent
from security_engine.cvefixes_patch_pipeline import CVEfixesPatchPair, CVEfixesPatchPipeline, PatchEvidenceIndex
from security_engine.language_model_tuner import LanguageModelTuner, _metrics, normalize_language
from security_engine.real_detector import scan_python_with_bandit
from security_engine.red_blue_arena import SAFE_TRAINING_SCENARIOS


class BlueTeamEvaluator:
    """Evaluate language models and simulate judge-verified defensive responses."""

    def __init__(self, database_path: str, minimum_recall: float = 0.80, limit: int | None = None):
        self.pipeline = CVEfixesPatchPipeline(database_path)
        self.minimum_recall = minimum_recall
        self.limit = limit
        self.pairs: List[CVEfixesPatchPair] = []
        self.models = {}
        self.training_report: Dict[str, Any] = {}
        self.evidence_index: PatchEvidenceIndex | None = None

    def train(self) -> Dict[str, Any]:
        self.pairs = self.pipeline.load_pairs(limit=self.limit)
        self.models, self.training_report = self.pipeline.train_language_models(
            minimum_recall=self.minimum_recall,
            limit=self.limit,
        )
        self.evidence_index = PatchEvidenceIndex(self.pairs)
        return self.training_report

    def evaluate_patch_detection(self) -> Dict[str, Any]:
        """Measure model decisions on CVEfixes pre-fix versus post-fix methods.

        Post-fix rows are the false-positive test population: if the model flags
        them above the language-specific threshold, they count as false positives.
        """
        if not self.models:
            self.train()

        by_language: Dict[str, List[tuple[int, float]]] = {}
        skipped_pairs = 0
        for pair in self.pairs:
            language = normalize_language(pair.language)
            model = self.models.get(language)
            if model is None:
                skipped_pairs += 1
                continue
            by_language.setdefault(language, []).extend(
                [
                    (1, model.predict_vulnerability_probability(pair.vulnerable_code)),
                    (0, model.predict_vulnerability_probability(pair.fixed_code)),
                ]
            )

        language_metrics: Dict[str, Any] = {}
        all_labels: List[int] = []
        all_decisions: List[int] = []
        for language, rows in sorted(by_language.items()):
            model = self.models[language]
            labels = [label for label, _ in rows]
            probabilities = [probability for _, probability in rows]
            metric = _metrics(labels, probabilities, model.decision_threshold)
            metric["decision_threshold"] = model.decision_threshold
            metric["patch_pairs_evaluated"] = len(rows) // 2
            language_metrics[language] = metric
            all_labels.extend(labels)
            all_decisions.extend([int(probability >= model.decision_threshold) for probability in probabilities])

        true_positive = sum(label == 1 and decision == 1 for label, decision in zip(all_labels, all_decisions))
        false_positive = sum(label == 0 and decision == 1 for label, decision in zip(all_labels, all_decisions))
        true_negative = sum(label == 0 and decision == 0 for label, decision in zip(all_labels, all_decisions))
        false_negative = sum(label == 1 and decision == 0 for label, decision in zip(all_labels, all_decisions))
        total = len(all_labels)
        overall = {
            "evaluated_documents": total,
            "patch_pairs_evaluated": total // 2,
            "accuracy": round((true_positive + true_negative) / total, 6) if total else None,
            "precision": round(true_positive / (true_positive + false_positive), 6)
            if true_positive + false_positive
            else None,
            "recall": round(true_positive / (true_positive + false_negative), 6)
            if true_positive + false_negative
            else None,
            "false_positive_rate": round(false_positive / (false_positive + true_negative), 6)
            if false_positive + true_negative
            else None,
            "true_positive": true_positive,
            "false_positive": false_positive,
            "true_negative": true_negative,
            "false_negative": false_negative,
        }
        return {
            "data_source": "CVEfixes local SQLite pre-fix/post-fix method pairs",
            "source_execution": False,
            "source_persisted": False,
            "models_trained": sorted(self.models),
            "skipped_pairs_without_language_model": skipped_pairs,
            "overall": overall,
            "by_language": language_metrics,
            "interpretation": (
                "False-positive rate is calculated on post-fix method revisions. Results are model evaluations, "
                "not a claim that a patch is safe without static-analysis verification."
            ),
        }

    @staticmethod
    def _verified_rules(before: Sequence[Dict[str, Any]], after: Sequence[Dict[str, Any]], attempted: Iterable[str]) -> List[str]:
        after_rules = {str(finding.get("rule_id", "UNKNOWN")) for finding in after}
        return sorted(set(attempted) - after_rules)

    def simulate_red_team_response(self, scenario_ids: Sequence[str] | None = None) -> Dict[str, Any]:
        """Run safe local Red-Team code strings through Blue-Team and the judge."""
        if not self.models:
            self.train()
        allowed = {scenario.scenario_id: scenario for scenario in SAFE_TRAINING_SCENARIOS}
        chosen_ids = list(scenario_ids) if scenario_ids else list(allowed)
        simulations = []
        for scenario_id in chosen_ids:
            scenario = allowed.get(scenario_id)
            if scenario is None:
                raise ValueError(f"Unknown approved training scenario: {scenario_id}")
            # Current approved arena scenarios are Python snippets; no execution occurs.
            language = "python"
            before = scan_python_with_bandit(scenario.source_code)
            model_result = LanguageModelTuner.predict(self.models, scenario.source_code, language)
            patched = scenario.source_code
            attempted_rules: List[str] = []
            human_review_rules: List[str] = []
            for finding in before:
                rule_id = str(finding.get("rule_id", "UNKNOWN"))
                patch = patch_agent(patched, {"rule_id": rule_id})
                if patch["patched"]:
                    patched = patch["code"]
                    attempted_rules.append(rule_id)
                elif patch.get("needs_llm"):
                    human_review_rules.append(rule_id)
            after = scan_python_with_bandit(patched)
            verified = self._verified_rules(before, after, attempted_rules)
            evidence = self.evidence_index.rank(scenario.source_code, language) if self.evidence_index else []
            simulations.append(
                {
                    "scenario_id": scenario.scenario_id,
                    "category": scenario.category,
                    "source_execution": False,
                    "red_team_static_findings": len(before),
                    "red_team_rule_ids": sorted({str(finding.get("rule_id", "UNKNOWN")) for finding in before}),
                    "language_model": model_result,
                    "blue_team_attempted_rule_ids": sorted(set(attempted_rules)),
                    "blue_team_human_review_rule_ids": sorted(set(human_review_rules)),
                    "judge_after_findings": len(after),
                    "judge_verified_fixed_rule_ids": verified,
                    "patch_verified_by_rescan": bool(verified),
                    "historical_patch_evidence": evidence,
                }
            )
        return {
            "mode": "safe-local-red-blue-response-simulation",
            "safety_boundary": "Static analysis only; no source execution, network target, exploit delivery, or automatic patch application.",
            "simulations": simulations,
        }
