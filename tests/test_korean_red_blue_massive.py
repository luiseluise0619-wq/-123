import json
import sys
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main
from security_engine.massive_streaming_trainer import MassiveStreamingTrainer


class KoreanRedBlueApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.headers = {
            "X-Org-Id": "korean-training-org",
            "X-User-Email": "security@example.test",
            "X-User-Role": "Security Lead",
        }

    def test_korean_scenario_is_structured_and_non_executing(self):
        response = self.client.post(
            "/api/v1/korean-scenarios/generate",
            headers=self.headers,
            json={"category": "SQL"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["language"], "ko")
        self.assertEqual(payload["agent"], "AegisAI-RedTeam-KR")
        self.assertEqual(payload["scenario"]["category"], "SQL Injection")
        self.assertIn("static", payload["safety_scope"])

    def test_korean_arena_returns_safe_round_metadata(self):
        response = self.client.post(
            "/api/v1/korean-scenarios/arena",
            headers=self.headers,
            json={"rounds": 3},
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(len(payload["rounds"]), 3)
        for item in payload["rounds"]:
            self.assertFalse(item["exercise"]["source_executed"])
            self.assertFalse(item["exercise"]["network_contacted"])
            self.assertFalse(item["exercise"]["patch_applied_automatically"])
            self.assertTrue(item["exercise"]["requires_static_rescan"])

    def test_massive_report_exposes_actual_progress(self):
        response = self.client.get("/api/v1/massive-models/report", headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        progress = response.json()["stream_progress"]
        self.assertEqual(progress["target_samples"], 10_000_000)
        self.assertGreaterEqual(progress["processed_samples"], 0)
        self.assertLessEqual(progress["processed_samples"], progress["target_samples"])
        self.assertEqual(progress["target_reached"], progress["processed_samples"] >= progress["target_samples"])


class MassiveStreamingTrainerTests(unittest.TestCase):
    def test_stream_tracks_real_count_without_fabricating_target_completion(self):
        with tempfile.TemporaryDirectory() as directory:
            trainer = MassiveStreamingTrainer(Path(directory), target_samples=10_000_000)
            rows = [(f"def safe_{i}(): return {i}", i % 2) for i in range(7)]
            progress = trainer.fit_stream(rows, chunk_size=3)
            self.assertEqual(progress["processed_samples"], 7)
            self.assertEqual(progress["target_samples"], 10_000_000)
            self.assertFalse(progress["target_reached"])
            self.assertLess(progress["completion_ratio"], 1.0)

    def test_stream_reaches_configured_target_only_after_real_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            trainer = MassiveStreamingTrainer(Path(directory), target_samples=4)
            rows = [(f"def item_{i}(): return {i}", i % 2) for i in range(6)]
            progress = trainer.fit_stream(rows, chunk_size=2)
            self.assertEqual(progress["processed_samples"], 4)
            self.assertTrue(progress["target_reached"])
            self.assertEqual(progress["completion_ratio"], 1.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
