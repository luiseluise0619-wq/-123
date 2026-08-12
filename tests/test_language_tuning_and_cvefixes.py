import sqlite3
import tempfile
import unittest
from pathlib import Path

from security_engine.cvefixes_patch_pipeline import CVEfixesPatchPipeline, PatchEvidenceIndex
from security_engine.language_model_tuner import LanguageExample, LanguageModelTuner, choose_threshold


class LanguageTuningTests(unittest.TestCase):
    def test_threshold_selection_prefers_precision_when_recall_target_is_met(self):
        result = choose_threshold(
            labels=[1, 1, 0, 0, 0],
            probabilities=[0.96, 0.76, 0.67, 0.42, 0.08],
            minimum_recall=1.0,
        )
        selected = result["selected"]
        self.assertEqual(result["selection_reason"], "max_precision_subject_to_recall_at_least_1.00")
        self.assertGreaterEqual(selected["recall"], 1.0)
        self.assertGreater(selected["threshold"], 0.67)
        self.assertEqual(selected["false_positive"], 0)

    def test_language_specific_models_keep_hard_negatives_and_thresholds(self):
        examples = [
            LanguageExample("int a(){ return unsafe_call(); }", 1, "C", "CVE-A", "pre_fix"),
            LanguageExample("int a(){ return safe_call(); }", 0, "C", "CVE-A", "post_fix_hard_negative"),
            LanguageExample("int b(){ return unsafe_copy(); }", 1, "C", "CVE-B", "pre_fix"),
            LanguageExample("int b(){ return bounded_copy(); }", 0, "C", "CVE-B", "post_fix_hard_negative"),
            LanguageExample("int c(){ return unsafe_parse(); }", 1, "C", "CVE-C", "pre_fix"),
            LanguageExample("int c(){ return validated_parse(); }", 0, "C", "CVE-C", "post_fix_hard_negative"),
            LanguageExample("def unsafe(): return eval('x')", 1, "Python", "PY-A", "pre_fix"),
            LanguageExample("def safe(): return {'x': 1}", 0, "Python", "PY-A", "post_fix_hard_negative"),
            LanguageExample("def unsafe_two(): return eval('y')", 1, "Python", "PY-B", "pre_fix"),
            LanguageExample("def safe_two(): return {'y': 2}", 0, "Python", "PY-B", "post_fix_hard_negative"),
        ]
        models, report = LanguageModelTuner(minimum_recall=0.5).train(examples)
        self.assertIn("c", models)
        self.assertIn("python", models)
        self.assertTrue(report["languages"]["c"]["trained"])
        self.assertGreaterEqual(report["languages"]["c"]["hard_negative_training_documents"], 1)
        self.assertGreaterEqual(models["c"].decision_threshold, 0.05)
        prediction = LanguageModelTuner.predict(models, "int x(){ return unsafe_call(); }", "C")
        self.assertTrue(prediction["model_available"])
        self.assertIn("decision_threshold", prediction)


class CVEfixesPatchPipelineTests(unittest.TestCase):
    def _create_fixture_db(self, path: Path) -> None:
        with sqlite3.connect(path) as connection:
            connection.executescript(
                """
                CREATE TABLE file_change (
                    file_change_id INTEGER PRIMARY KEY,
                    hash TEXT NOT NULL,
                    programming_language TEXT NOT NULL
                );
                CREATE TABLE method_change (
                    method_change_id INTEGER PRIMARY KEY,
                    file_change_id INTEGER NOT NULL,
                    signature TEXT,
                    code TEXT NOT NULL,
                    before_change INTEGER NOT NULL
                );
                CREATE TABLE fixes (cve_id TEXT NOT NULL, hash TEXT NOT NULL);
                """
            )
            for index, cve_id in enumerate(("CVE-TEST-1", "CVE-TEST-2", "CVE-TEST-3"), start=1):
                commit_hash = f"commit-{index}"
                connection.execute(
                    "INSERT INTO file_change(file_change_id, hash, programming_language) VALUES (?, ?, ?)",
                    (index, commit_hash, "C"),
                )
                connection.execute("INSERT INTO fixes(cve_id, hash) VALUES (?, ?)", (cve_id, commit_hash))
                connection.execute(
                    "INSERT INTO method_change(file_change_id, signature, code, before_change) VALUES (?, ?, ?, 1)",
                    (index, f"copy_{index}(char *dst)", f"int copy_{index}(char *dst) {{ return unsafe_copy(dst); }}"),
                )
                connection.execute(
                    "INSERT INTO method_change(file_change_id, signature, code, before_change) VALUES (?, ?, ?, 0)",
                    (index, f"copy_{index}(char *dst)", f"int copy_{index}(char *dst) {{ return bounded_copy(dst); }}"),
                )

    def test_pipeline_creates_post_fix_hard_negatives_and_metadata_only_evidence(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            database_path = Path(temp_dir) / "CVEfixes.db"
            self._create_fixture_db(database_path)
            pipeline = CVEfixesPatchPipeline(database_path)
            pairs = pipeline.load_pairs()
            self.assertEqual(len(pairs), 3)
            self.assertEqual(pairs[0].cve_id, "CVE-TEST-1")
            examples = pipeline.language_examples(pairs)
            self.assertEqual(sum(item.label for item in examples), 3)
            self.assertEqual(sum(item.source_kind == "post_fix_hard_negative" for item in examples), 3)

            models, report = pipeline.train_language_models(minimum_recall=0.5)
            self.assertIn("c", models)
            self.assertEqual(report["patch_pairs"], 3)
            self.assertFalse(report["source_execution"])
            self.assertFalse(report["source_persisted"])

            evidence = PatchEvidenceIndex(pairs).rank("int z(char *d) { return unsafe_copy(d); }", "C")
            self.assertTrue(evidence)
            self.assertEqual(evidence[0]["cve_id"], "CVE-TEST-1")
            self.assertTrue(evidence[0]["requires_static_rescan"])
            self.assertFalse(evidence[0]["auto_apply_allowed"])
            self.assertNotIn("vulnerable_code", evidence[0])
            self.assertNotIn("fixed_code", evidence[0])


if __name__ == "__main__":
    unittest.main(verbosity=2)
