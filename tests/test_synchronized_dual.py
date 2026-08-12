import sys
import unittest
from pathlib import Path
import tempfile

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from security_engine.synchronized_dual_trainer import SynchronizedDualTrainer


class SynchronizedDualTrainerTests(unittest.TestCase):
    def test_dual_trainer_ingests_same_data_and_syncs(self):
        with tempfile.TemporaryDirectory() as directory:
            trainer = SynchronizedDualTrainer(Path(directory), target_samples=100)
            texts = ["def a(): eval(x)", "def b(): return 1"]
            labels = [1, 0]
            exchange = trainer.train_step(texts, labels)
            self.assertEqual(exchange["red_trainer_samples"], 2)
            self.assertEqual(exchange["blue_trainer_samples"], 2)
            self.assertTrue(exchange["adversarial_clash_verified"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
