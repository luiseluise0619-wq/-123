"""
Extreme Streaming Engine for AegisAI (Public Massive Scale).
Orchestrates high-throughput data ingestion from public code corpora
using Hugging Face datasets streaming and multi-processing.
"""

from __future__ import annotations
import os
import time
import json
import logging
from pathlib import Path
from typing import Iterator, Dict, Any, List, Optional

from datasets import load_dataset
from security_engine.massive_streaming_trainer import MassiveStreamingTrainer

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Public datasets that don't require gated access
PUBLIC_DATASETS = [
    {"path": "code_search_net", "name": "python", "split": "train"},
    {"path": "code_search_net", "name": "go", "split": "train"},
    {"path": "code_search_net", "name": "java", "split": "train"},
    {"path": "code_search_net", "name": "javascript", "split": "train"},
    {"path": "code_search_net", "name": "php", "split": "train"},
    {"path": "code_search_net", "name": "ruby", "split": "train"},
    {"path": "common-pile/github_archive", "split": "train"}
]

class ExtremeStreamingEngine:
    def __init__(self, model_dir: Path):
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self.trainers: Dict[str, MassiveStreamingTrainer] = {}
        self.start_time = time.time()
        self.total_processed = 0

    def _get_trainer(self, lang: str) -> MassiveStreamingTrainer:
        if lang not in self.trainers:
            self.trainers[lang] = MassiveStreamingTrainer(self.model_dir, target_samples=100_000_000)
        return self.trainers[lang]

    def stream_and_train(self, max_samples: int = 1_000_000):
        """
        Streams data from multiple public Hugging Face datasets.
        """
        logger.info("Starting extreme streaming from public datasets...")
        
        for ds_info in PUBLIC_DATASETS:
            if self.total_processed >= max_samples:
                break
                
            ds_path = ds_info["path"]
            ds_name = ds_info.get("name")
            lang = ds_name or "general"
            
            logger.info(f"Accessing dataset: {ds_path} ({lang})")
            try:
                ds = load_dataset(ds_path, name=ds_name, streaming=True, split=ds_info["split"])
                
                batch_texts = []
                batch_labels = []
                ds_count = 0
                
                for entry in ds:
                    if self.total_processed >= max_samples:
                        break
                    
                    content = entry.get("whole_func_string") or entry.get("content") or entry.get("text") or ""
                    if not content or len(content) < 10:
                        continue
                        
                    batch_texts.append(content)
                    # Simple weak supervision: mark common dangerous patterns
                    label = 1 if any(kw in content for kw in ["eval(", "exec(", "os.system(", "shell=True", "dangerouslySetInnerHTML"]) else 0
                    batch_labels.append(label)
                    
                    if len(batch_texts) >= 1000:
                        trainer = self._get_trainer(lang)
                        trainer.partial_fit_chunk(batch_texts, batch_labels)
                        self.total_processed += len(batch_texts)
                        ds_count += len(batch_texts)
                        batch_texts = []
                        batch_labels = []
                        if ds_count % 10000 == 0:
                            logger.info(f"[{ds_path}:{lang}] Processed {ds_count} samples (Total: {self.total_processed})")
                            
                if batch_texts:
                    trainer = self._get_trainer(lang)
                    trainer.partial_fit_chunk(batch_texts, batch_labels)
                    self.total_processed += len(batch_texts)
                
                logger.info(f"Finished {ds_path}:{lang}. Samples: {ds_count}")
                
            except Exception as e:
                logger.error(f"Error streaming {ds_path}: {e}")

        # Final save
        for lang, trainer in self.trainers.items():
            trainer.save_model(lang)

    def get_status(self) -> Dict[str, Any]:
        elapsed = time.time() - self.start_time
        return {
            "total_processed": self.total_processed,
            "throughput_eps": self.total_processed / elapsed if elapsed > 0 else 0,
            "languages": {lang: t.progress() for lang, t in self.trainers.items()},
            "engine": "ExtremeStreaming-V2-Public",
            "scale": "Maximized Public Access"
        }

if __name__ == "__main__":
    engine = ExtremeStreamingEngine(Path("./models/extreme_v2"))
    # Run a maximized run within time limits
    engine.stream_and_train(max_samples=200000)
    print(json.dumps(engine.get_status(), indent=2))
