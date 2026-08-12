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

import main


@unittest.skipUnless(
    (PROJECT_ROOT / "models" / "strong_v1" / "python_model.pkl").exists(),
    "Run train_strong_models.py before integration testing local strong artifacts.",
)
class StrongModelApiTests(unittest.TestCase):
    def setUp(self):
        main.STRONG_MODEL_REGISTRY = None
        main.TRAINING_DASHBOARDS.clear()
        self.client = TestClient(main.app)
        self.headers = {
            "X-Org-Id": "strong-model-org",
            "X-User-Email": "security@example.test",
            "X-User-Role": "Security Lead",
        }

    def test_report_and_python_prediction_use_trained_artifact(self):
        report = self.client.get("/api/v1/strong-models/report", headers=self.headers)
        self.assertEqual(report.status_code, 200, report.text)
        self.assertEqual(report.json()["languages_available"], ["c_cpp", "python"])
        self.assertFalse(report.json()["source_execution"])

        prediction = self.client.post(
            "/api/v1/strong-models/predict",
            headers=self.headers,
            json={"language": "python", "source_code": "import subprocess\nsubprocess.call(command, shell=True)\n"},
        )
        self.assertEqual(prediction.status_code, 200, prediction.text)
        self.assertTrue(prediction.json()["model_available"])
        self.assertIn("vulnerability_probability", prediction.json())
        self.assertFalse(prediction.json()["source_persisted"])

    def test_strong_model_can_drive_bounded_red_blue_training(self):
        response = self.client.post(
            "/api/v1/training/red-blue",
            headers=self.headers,
            json={"rounds": 2, "training_corpus": "strong-language-models", "retrain_model": False},
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["training_corpus"], "strong-language-models")
        self.assertEqual(payload["model"]["model_type"], "hashing word-bigram plus averaged SGD logistic classifier")
        self.assertFalse(payload["exercises"][0]["source_executed"])
        self.assertIn("judge_verified_fixes", payload["scoreboard"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
