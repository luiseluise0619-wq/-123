import sqlite3
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


class BlueDashboardApiTests(unittest.TestCase):
    def setUp(self):
        main.AUDIT_LOG_TRAIL.clear()
        main.CVEFIXES_EVALUATION_DASHBOARDS.clear()
        main.CVEFIXES_DATA_ROOT.mkdir(parents=True, exist_ok=True)
        self.filename = "test_blue_dashboard_cvefixes.db"
        self.database_path = main.CVEFIXES_DATA_ROOT / self.filename
        if self.database_path.exists():
            self.database_path.unlink()
        self._create_fixture_db(self.database_path)
        self.client = TestClient(main.app)
        self.headers = {
            "X-Org-Id": "blue-dashboard-org",
            "X-User-Email": "security@example.test",
            "X-User-Role": "Security Lead",
        }

    def tearDown(self):
        if self.database_path.exists():
            self.database_path.unlink()

    def _create_fixture_db(self, path: Path) -> None:
        with sqlite3.connect(path) as connection:
            connection.executescript(
                """
                CREATE TABLE file_change (file_change_id INTEGER PRIMARY KEY, hash TEXT, programming_language TEXT);
                CREATE TABLE method_change (method_change_id INTEGER PRIMARY KEY, file_change_id INTEGER, signature TEXT, code TEXT, before_change INTEGER);
                CREATE TABLE fixes (cve_id TEXT, hash TEXT);
                """
            )
            for index in range(1, 4):
                commit = f"blue-dashboard-{index}"
                connection.execute("INSERT INTO file_change VALUES (?, ?, 'C')", (index, commit))
                connection.execute("INSERT INTO fixes VALUES (?, ?)", (f"CVE-BLUE-{index}", commit))
                connection.execute(
                    "INSERT INTO method_change(file_change_id, signature, code, before_change) VALUES (?, ?, ?, 1)",
                    (index, f"validate_{index}()", f"int validate_{index}() {{ return unsafe_validate(); }}"),
                )
                connection.execute(
                    "INSERT INTO method_change(file_change_id, signature, code, before_change) VALUES (?, ?, ?, 0)",
                    (index, f"validate_{index}()", f"int validate_{index}() {{ return safe_validate(); }}"),
                )

    def test_dashboard_page_is_available(self):
        response = self.client.get("/blue-dashboard")
        self.assertEqual(response.status_code, 200)
        self.assertIn("패치 모델의 오탐", response.text)

    def test_cvefixes_evaluation_returns_metrics_and_simulation(self):
        missing = self.client.get("/api/v1/blue-team/dashboard", headers=self.headers)
        self.assertEqual(missing.status_code, 404)

        evaluation = self.client.post(
            "/api/v1/blue-team/evaluate",
            headers=self.headers,
            json={
                "database_filename": self.filename,
                "minimum_recall": 0.5,
                "scenario_ids": ["predictable-session-nonce"],
            },
        )
        self.assertEqual(evaluation.status_code, 200, evaluation.text)
        payload = evaluation.json()
        overall = payload["patch_evaluation"]["overall"]
        self.assertEqual(overall["patch_pairs_evaluated"], 3)
        self.assertIn("false_positive_rate", overall)
        self.assertFalse(payload["patch_evaluation"]["source_execution"])
        self.assertFalse(payload["patch_evaluation"]["source_persisted"])
        simulation = payload["red_blue_simulation"]["simulations"][0]
        self.assertEqual(simulation["scenario_id"], "predictable-session-nonce")
        self.assertIn("B311", simulation["red_team_rule_ids"])

        dashboard = self.client.get("/api/v1/blue-team/dashboard", headers=self.headers)
        self.assertEqual(dashboard.status_code, 200, dashboard.text)
        self.assertEqual(dashboard.json()["patch_evaluation"], payload["patch_evaluation"])

    def test_developer_role_cannot_start_cvefixes_evaluation(self):
        response = self.client.post(
            "/api/v1/blue-team/evaluate",
            headers={**self.headers, "X-User-Role": "Developer"},
            json={"database_filename": self.filename},
        )
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main(verbosity=2)
