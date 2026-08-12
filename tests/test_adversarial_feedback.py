import sys
import unittest
from pathlib import Path
import tempfile

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from security_engine.adversarial_feedback_trainer import AdversarialFeedbackTrainer


class AdversarialFeedbackTrainerTests(unittest.TestCase):
    def test_feedback_loop_updates_models_and_tracks_evolution(self):
        with tempfile.TemporaryDirectory() as directory:
            trainer = AdversarialFeedbackTrainer(Path(directory), target_rounds=1000)
            texts = ["def a(): eval(x)", "def b(): return 1", "def c(): os.system(cmd)"]
            labels = [1, 0, 1]
            snapshot = trainer.simulate_feedback_loop(texts, labels)
            self.assertEqual(snapshot["completed_rounds"], 3)
            self.assertGreater(snapshot["red_intelligence_score"], 0.5)
            self.assertGreater(snapshot["blue_defense_accuracy"], 0.5)


if __name__ == "__main__":
    unittest.main(verbosity=2)
