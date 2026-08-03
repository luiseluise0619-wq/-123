# Real ML Training — honest result

Trained a real TF-IDF + LightGBM vulnerability classifier on real repos, labeled by
a real SAST tool (Bandit), evaluated with repo-level GroupKFold (tested on unseen
repositories — the honest split; random function split would leak).

## Result (reproduce: `python train_real_model.py`)
- Data: 5 repos, 1,916 functions, **12 vulnerable / 1,904 safe** (0.6% — severe imbalance)
- ROC-AUC (repo holdout): **0.708** (real; > 0.5 random baseline)
- Accuracy: 95.1% — **misleading**: an "always safe" baseline scores 99.4%
- Vulnerable-class recall: **0.000** — the model catches no vulnerabilities on unseen repos

## What this proves
- The ML pipeline is real and the evaluation is honest.
- 12 tool-labeled positives are far too few / imbalanced to learn a useful classifier.
- To get a usable model: real CVE-labeled corpora (DiverseVul ~18.9k vulns, CVEfixes),
  class balancing, and CodeBERT/GraphCodeBERT fine-tuning on GPU.
- Accuracy is a trap under imbalance; report AUC / precision-recall on a repo holdout.
