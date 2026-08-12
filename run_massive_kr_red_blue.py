"""
Integrated Korean Red-Team / Blue-Team loop for AegisAI.

The loop is bounded and metadata-only. It demonstrates how the Korean scenario
agent hands a scenario to the defensive workflow while the 10M streaming trainer
tracks actual rows. It does not claim that 10M rows were processed unless a real
corpus stream supplied that many rows.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

from security_engine.korean_red_team_generator import KoreanRedTeamGenerator
from security_engine.massive_streaming_trainer import MassiveStreamingTrainer


def run_autonomous_loop(
    rounds: int = 5,
    rows: Iterable[tuple[str, int]] | None = None,
    target_samples: int = 10_000_000,
) -> Path:
    """Run bounded Korean rounds and optionally consume a real data stream."""
    red_team = KoreanRedTeamGenerator(seed=42)
    trainer = MassiveStreamingTrainer(
        model_dir=Path("./models/massive_v1"),
        target_samples=target_samples,
    )

    stream_progress: dict[str, Any] = trainer.progress()
    if rows is not None:
        stream_progress = trainer.fit_stream(rows, chunk_size=4096)

    rounds_out = []
    for round_index in range(rounds):
        generated = red_team.generate_scenario()
        scenario = generated["scenario"]
        exercise = red_team.simulate_attack_and_defense(scenario["id"])
        rounds_out.append(
            {
                "round": round_index + 1,
                "scenario": generated,
                "exercise": exercise,
                "blue_team_status": "awaiting_static_rescan",
            }
        )

    report = {
        "agent": "AegisAI-RedTeam-KR",
        "language": "ko",
        "data_scale_target": target_samples,
        "stream_progress": stream_progress,
        "rounds": rounds_out,
        "safety_scope": "static scenario text only; no payload delivery, source execution, or network contact",
    }
    report_path = Path("./models/massive_v1/massive_kr_report.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report_path


if __name__ == "__main__":
    path = run_autonomous_loop(rounds=3)
    print(f"한국어 자율 대항 결과 저장: {path}")
