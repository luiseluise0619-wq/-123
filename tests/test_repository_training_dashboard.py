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

from security_engine.repository_trainer import RepositoryRiskTrainer
import main


class RepositoryTrainingTests(unittest.TestCase):
    def _write_fixture_repository(self, root: Path) -> None:
        (root / "a_vulnerable.py").write_text(
            "import hashlib\n\n"
            "def digest_one(value):\n"
            "    return hashlib.md5(value).hexdigest()\n\n"
            "def digest_two(value):\n"
            "    return hashlib.md5(value).hexdigest()\n\n"
            "def digest_three(value):\n"
            "    return hashlib.md5(value).hexdigest()\n",
            encoding="utf-8",
        )
        (root / "b_clean.py").write_text(
            "def add(left, right):\n"
            "    return left + right\n\n"
            "def subtract(left, right):\n"
            "    return left - right\n\n"
            "def multiply(left, right):\n"
            "    return left * right\n\n"
            "def divide(left, right):\n"
            "    return left / right\n\n"
            "def normalize(value):\n"
            "    return value.strip()\n",
            encoding="utf-8",
        )

    def test_repository_trainer_reads_and_labels_without_executing_source(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self._write_fixture_repository(root)
            original_contents = {path.name: path.read_text(encoding="utf-8") for path in root.glob("*.py")}

            model, report = RepositoryRiskTrainer(root).train()

            self.assertTrue(model.is_trained)
            self.assertFalse(report["source_execution"])
            self.assertFalse(report["source_persisted"])
            self.assertEqual(report["corpus"]["python_files_scanned"], 2)
            self.assertGreaterEqual(report["corpus"]["positive_function_labels"], 1)
            self.assertGreaterEqual(report["corpus"]["negative_function_labels"], 1)
            self.assertGreaterEqual(report["holdout_metrics"]["evaluated_documents"], 1)
            self.assertTrue(report["learning_curve"])
            self.assertEqual(
                original_contents,
                {path.name: path.read_text(encoding="utf-8") for path in root.glob("*.py")},
            )


class TrainingDashboardApiTests(unittest.TestCase):
    def setUp(self):
        main.AUDIT_LOG_TRAIL.clear()
        main.REPOSITORY_TRAINING_MODELS.clear()
        main.REPOSITORY_TRAINING_REPORTS.clear()
        main.TRAINING_DASHBOARDS.clear()
        self.client = TestClient(main.app)
        self.headers = {
            "X-Org-Id": "dashboard-org",
            "X-User-Email": "lead@example.test",
            "X-User-Role": "Security Lead",
        }

    def test_dashboard_page_is_served(self):
        response = self.client.get("/dashboard")
        self.assertEqual(response.status_code, 200)
        self.assertIn("GitHub 코드로 학습한", response.text)

    def test_training_endpoint_uses_repository_backed_model_and_dashboard_result(self):
        missing = self.client.get("/api/v1/training/dashboard", headers=self.headers)
        self.assertEqual(missing.status_code, 404)

        training = self.client.post(
            "/api/v1/training/red-blue",
            headers=self.headers,
            json={"rounds": 1, "retrain_model": True},
        )
        self.assertEqual(training.status_code, 200, training.text)
        result = training.json()
        report = result["repository_training"]
        self.assertEqual(report["data_source"], "checked-out GitHub repository Python source")
        self.assertFalse(report["source_execution"])
        self.assertFalse(report["source_persisted"])
        self.assertGreater(report["corpus"]["python_files_scanned"], 0)
        self.assertGreaterEqual(report["holdout_metrics"]["evaluated_documents"], 1)
        exercise = result["exercises"][0]
        self.assertIn("model_judge_agreement", exercise)
        self.assertNotIn("source_code", exercise)
        self.assertNotIn("patched_code", exercise)

        dashboard = self.client.get("/api/v1/training/dashboard", headers=self.headers)
        self.assertEqual(dashboard.status_code, 200, dashboard.text)
        self.assertEqual(dashboard.json()["repository_training"], report)


if __name__ == "__main__":
    unittest.main(verbosity=2)
