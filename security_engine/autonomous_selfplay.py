"""Bounded autonomous Red-Team / Blue-Team self-play with judge-backed logs.

The loop cycles only through AegisAI's approved local educational scenarios.
It never executes source code, scans a network target, or generates exploit
payloads. Each cycle records judge findings, model agreement, and rescan-
verified Blue-Team outcomes as aggregate metrics without storing source code.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

from security_engine.red_blue_arena import CLEAN_TRAINING_SAMPLES, SAFE_TRAINING_SCENARIOS, RedBlueTrainingArena


class AutonomousRedBlueSelfPlay:
    """Run deterministic, bounded self-play cycles and emit aggregate learning logs."""

    def __init__(self) -> None:
        self.arena = RedBlueTrainingArena()
        self.feedback_samples: List[Tuple[str, int]] = []

    def _base_judge_labels(self) -> List[Tuple[str, int]]:
        labels: List[Tuple[str, int]] = []
        for scenario in SAFE_TRAINING_SCENARIOS:
            labels.append((scenario.source_code, int(bool(self.arena.judge(scenario.source_code)))))
        for clean_sample in CLEAN_TRAINING_SAMPLES:
            labels.append((clean_sample, int(bool(self.arena.judge(clean_sample)))))
        return labels

    def _fit_from_judge_feedback(self) -> Dict[str, Any]:
        labelled = self._base_judge_labels() + self.feedback_samples
        return self.arena.risk_model.fit(
            labelled,
            label_source="local static-analysis judge labels plus prior safe self-play feedback",
        )

    @staticmethod
    def _rate(numerator: int, denominator: int) -> float | None:
        return round(numerator / denominator, 6) if denominator else None

    def run(self, cycles: int = 5, rounds_per_cycle: int = 5) -> Dict[str, Any]:
        if not 1 <= cycles <= 32:
            raise ValueError("cycles must be between 1 and 32.")
        if not 1 <= rounds_per_cycle <= 16:
            raise ValueError("rounds_per_cycle must be between 1 and 16.")

        logs: List[Dict[str, Any]] = []
        previous: Dict[str, Any] | None = None
        for cycle_index in range(cycles):
            model_before_cycle = self._fit_from_judge_feedback()
            training = self.arena.run_rounds(
                rounds=rounds_per_cycle,
                retrain_model=False,
                start_round=cycle_index * rounds_per_cycle,
            )
            exercises = training["exercises"]
            agreement_count = sum(item["model_judge_agreement"] for item in exercises)
            verified_count = sum(item["blue_fix_verified"] for item in exercises)
            human_review_count = sum(bool(item["blue_needs_human_review_rule_ids"]) for item in exercises)
            red_detected_count = sum(item["red_detected_by_judge"] for item in exercises)

            # The next cycle sees only judge-backed labels, never model self-labels.
            scenario_by_id = {scenario.scenario_id: scenario for scenario in SAFE_TRAINING_SCENARIOS}
            for item in exercises:
                scenario = scenario_by_id[item["scenario_id"]]
                self.feedback_samples.append((scenario.source_code, int(item["red_detected_by_judge"])))
            clean_sample = CLEAN_TRAINING_SAMPLES[cycle_index % len(CLEAN_TRAINING_SAMPLES)]
            self.feedback_samples.append((clean_sample, int(bool(self.arena.judge(clean_sample)))))

            metric = {
                "cycle": cycle_index + 1,
                "timestamp_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "rounds": rounds_per_cycle,
                "scenario_start_offset": cycle_index * rounds_per_cycle,
                "red_judge_detection_rate": self._rate(red_detected_count, rounds_per_cycle),
                "model_judge_agreement_rate": self._rate(agreement_count, rounds_per_cycle),
                "blue_patch_verified_rate": self._rate(verified_count, rounds_per_cycle),
                "blue_human_review_rate": self._rate(human_review_count, rounds_per_cycle),
                "red_points": training["scoreboard"]["red_points"],
                "blue_points": training["scoreboard"]["blue_points"],
                "judge_verified_fixes": training["scoreboard"]["judge_verified_fixes"],
                "model_before_cycle": model_before_cycle,
                "judge_backed_feedback_documents": len(self.feedback_samples),
                "source_executed": False,
                "source_persisted": False,
            }
            if previous is not None:
                metric["change_from_previous_cycle"] = {
                    key: round(metric[key] - previous[key], 6)
                    for key in (
                        "red_judge_detection_rate",
                        "model_judge_agreement_rate",
                        "blue_patch_verified_rate",
                        "blue_human_review_rate",
                    )
                    if metric[key] is not None and previous[key] is not None
                }
            else:
                metric["change_from_previous_cycle"] = {}
            logs.append(metric)
            previous = metric

        final_model = self._fit_from_judge_feedback()
        return {
            "mode": "bounded-safe-autonomous-red-blue-self-play",
            "safety_boundary": "Approved local static-analysis exercises only. No source execution, network target, exploit delivery, or autonomous patch application.",
            "cycles": cycles,
            "rounds_per_cycle": rounds_per_cycle,
            "cycle_logs": logs,
            "final_model": final_model,
        }


def write_jsonl(logs: Iterable[Dict[str, Any]], output_path: str | Path) -> Path:
    """Persist aggregate performance logs only; source code is never written."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as log_file:
        for log in logs:
            log_file.write(json.dumps(log, ensure_ascii=False, sort_keys=True) + "\n")
    return path
