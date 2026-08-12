import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from security_engine.ensemble_vulnerability_detector import EnsembleVulnerabilityDetector


class EnsembleDetectorTests(unittest.TestCase):
    def test_ensemble_detects_high_risk_code(self):
        detector = EnsembleVulnerabilityDetector(base_model=None)
        res = detector.predict_vulnerability("def unsafe(): eval(user_input)")
        self.assertTrue(res["vulnerable"])
        self.assertGreaterEqual(res["confidence"], 0.65)

    def test_ensemble_passes_safe_code(self):
        detector = EnsembleVulnerabilityDetector(base_model=None)
        res = detector.predict_vulnerability("def safe(): return 42")
        self.assertFalse(res["vulnerable"])
        self.assertLess(res["confidence"], 0.5)


if __name__ == "__main__":
    unittest.main(verbosity=2)
