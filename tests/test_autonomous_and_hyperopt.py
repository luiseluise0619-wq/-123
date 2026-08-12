import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from security_engine.autonomous_selfplay import AutonomousRedBlueSelfPlay, write_jsonl
from security_engine.cvefixes_hyperopt import CVEfixesLanguageHyperOptimizer


class AutonomousSelfPlayTests(unittest.TestCase):
    def test_cycles_emit_aggregate_judge_backed_performance_logs(self):
        result = AutonomousRedBlueSelfPlay().run(cycles=2, rounds_per_cycle=2)
        self.assertEqual(result["cycles"], 2)
        self.assertEqual(len(result["cycle_logs"]), 2)
        first, second = result["cycle_logs"]
        self.assertEqual(first["cycle"], 1)
        self.assertEqual(second["cycle"], 2)
        self.assertNotEqual(first["scenario_start_offset"], second["scenario_start_offset"])
        self.assertFalse(first["source_executed"])
        self.assertFalse(first["source_persisted"])
        self.assertIn("model_judge_agreement_rate", first)
        self.assertIn("blue_patch_verified_rate", first)
        self.assertIn("change_from_previous_cycle", second)
        self.assertGreater(second["judge_backed_feedback_documents"], first["judge_backed_feedback_documents"])

    def test_jsonl_log_contains_metrics_but_not_source_code(self):
        result = AutonomousRedBlueSelfPlay().run(cycles=1, rounds_per_cycle=1)
        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = write_jsonl(result["cycle_logs"], Path(temp_dir) / "selfplay.jsonl")
            lines = output_path.read_text(encoding="utf-8").splitlines()
            self.assertEqual(len(lines), 1)
            payload = json.loads(lines[0])
            self.assertIn("red_points", payload)
            self.assertNotIn("source_code", payload)


class HyperparameterOptimisationTests(unittest.TestCase):
    def _create_fixture_db(self, path: Path) -> None:
        with sqlite3.connect(path) as connection:
            connection.executescript(
                """
                CREATE TABLE file_change (file_change_id INTEGER PRIMARY KEY, hash TEXT, programming_language TEXT);
                CREATE TABLE method_change (method_change_id INTEGER PRIMARY KEY, file_change_id INTEGER, signature TEXT, code TEXT, before_change INTEGER);
                CREATE TABLE fixes (cve_id TEXT, hash TEXT);
                """
            )
            for index in range(1, 5):
                commit = f"optimise-{index}"
                connection.execute("INSERT INTO file_change VALUES (?, ?, 'C')", (index, commit))
                connection.execute("INSERT INTO fixes VALUES (?, ?)", (f"CVE-OPT-{index}", commit))
                connection.execute(
                    "INSERT INTO method_change(file_change_id, signature, code, before_change) VALUES (?, ?, ?, 1)",
                    (index, f"copy_{index}()", f"int copy_{index}() {{ return unsafe_copy_{index}(); }}"),
                )
                connection.execute(
                    "INSERT INTO method_change(file_change_id, signature, code, before_change) VALUES (?, ?, ?, 0)",
                    (index, f"copy_{index}()", f"int copy_{index}() {{ return bounded_copy_{index}(); }}"),
                )

    def test_language_specific_grid_search_selects_and_refits_best_model(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            database_path = Path(temp_dir) / "CVEfixes.db"
            self._create_fixture_db(database_path)
            models, report = CVEfixesLanguageHyperOptimizer(
                str(database_path),
                smoothing_alphas=(0.5, 1.0),
                minimum_recalls=(0.5, 0.8),
            ).optimize()
            self.assertIn("c", models)
            result = report["languages"]["c"]
            self.assertTrue(result["optimized"])
            self.assertEqual(len(result["candidates_evaluated"]), 4)
            self.assertEqual(result["final_refit_model"]["training_documents"], 8)
            self.assertIn(result["selected"]["smoothing_alpha"], (0.5, 1.0))
            self.assertFalse(report["source_execution"])
            self.assertFalse(report["source_persisted"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
