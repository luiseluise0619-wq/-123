import json
import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from security_engine.red_blue_arena import RedBlueTrainingArena
import main


class RedBlueArenaTests(unittest.TestCase):
    def setUp(self):
        main.AUDIT_LOG_TRAIL.clear()
        main.TRAINING_ARENA = RedBlueTrainingArena()
        self.client = TestClient(main.app)
        self.headers = {
            "X-Org-Id": "acme-security",
            "X-User-Email": "lead@acme.example",
            "X-User-Role": "Security Lead",
        }

    def test_local_model_is_judge_labelled_and_arena_verifies_fixes(self):
        arena = RedBlueTrainingArena()
        result = arena.run_rounds(rounds=4, retrain_model=True)

        self.assertEqual(result["mode"], "safe-local-red-blue-training")
        self.assertIn("No source execution", result["safety_boundary"])
        self.assertEqual(len(result["exercises"]), 4)
        self.assertEqual(result["model"]["model_type"], "local multinomial naive bayes (from scratch)")
        self.assertEqual(result["model"]["positive_documents"], 4)
        self.assertEqual(result["model"]["negative_documents"], 4)
        self.assertGreaterEqual(result["scoreboard"]["red_points"], 400)
        self.assertGreaterEqual(result["scoreboard"]["judge_verified_fixes"], 2)

        fixed_rules = {
            rule_id
            for exercise in result["exercises"]
            for rule_id in exercise["judge_verified_fixed_rule_ids"]
        }
        self.assertIn("B324", fixed_rules)
        self.assertIn("B602", fixed_rules)
        for exercise in result["exercises"]:
            self.assertFalse(exercise["source_persisted"])
            self.assertFalse(exercise["source_executed"])
            self.assertGreaterEqual(exercise["model_vulnerability_probability"], 0.0)
            self.assertLessEqual(exercise["model_vulnerability_probability"], 1.0)
            self.assertNotIn("source_code", exercise)
            self.assertNotIn("patched_code", exercise)

    def test_round_boundaries_are_enforced(self):
        arena = RedBlueTrainingArena()
        with self.assertRaises(ValueError):
            arena.run_rounds(rounds=0)
        with self.assertRaises(ValueError):
            arena.run_rounds(rounds=17)

    def test_training_api_returns_only_safe_metadata(self):
        response = self.client.post(
            "/api/v1/training/red-blue",
            headers=self.headers,
            json={"rounds": 2, "retrain_model": True},
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["mode"], "safe-local-red-blue-training")
        self.assertEqual(len(payload["exercises"]), 2)
        self.assertIn("No source execution", payload["safety_boundary"])
        serialized = json.dumps(payload)
        self.assertNotIn("source_code", serialized)
        self.assertNotIn("patched_code", serialized)

        logs = self.client.get("/api/v1/audit-logs", headers=self.headers)
        self.assertEqual(logs.status_code, 200)
        self.assertTrue(
            any(entry["action"] == "RUN_SAFE_RED_BLUE_TRAINING" for entry in logs.json()["audit_trail"])
        )

    def test_training_api_rejects_unbounded_round_counts(self):
        response = self.client.post(
            "/api/v1/training/red-blue",
            headers=self.headers,
            json={"rounds": 17},
        )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main(verbosity=2)
