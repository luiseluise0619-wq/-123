"""
Real, reproducible security benchmark — replaces the fabricated one.

Clones ACTUAL public vulnerable repos and scans their Python files with Bandit
(offline, real). Reports genuine finding counts. Every number here is produced
by a real tool on real code you can clone yourself. No invented percentages,
no fake "expert review" ledger, no non-existent repositories.
"""

import json
import os
import subprocess
import tempfile
from typing import Dict, Any, List

from security_engine.real_detector import scan_python_with_bandit

# Real, public, deliberately-vulnerable apps (clone them yourself to verify).
TARGETS = [
    ("stamparm/DSVW", "https://github.com/stamparm/DSVW.git"),
    ("anxolerd/dvpwa", "https://github.com/anxolerd/dvpwa.git"),
]


def scan_repo(url: str, workdir: str) -> Dict[str, Any]:
    dest = os.path.join(workdir, url.rstrip("/").split("/")[-1].replace(".git", ""))
    try:
        subprocess.run(["git", "clone", "--depth", "1", "-q", url, dest],
                       check=True, timeout=120, capture_output=True)
    except Exception as exc:  # noqa: BLE001
        return {"cloned": False, "error": str(exc)[:120]}

    py_files = []
    for root, _, files in os.walk(dest):
        for fn in files:
            if fn.endswith(".py"):
                py_files.append(os.path.join(root, fn))

    all_findings: List[Dict[str, Any]] = []
    for p in py_files:
        try:
            code = open(p, encoding="utf-8", errors="ignore").read()
            all_findings += scan_python_with_bandit(code)
        except Exception:
            continue

    sev = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for f in all_findings:
        s = str(f.get("severity", "")).upper()
        if s in sev:
            sev[s] += 1
    cwes = sorted({f"CWE-{f['cwe']}" for f in all_findings if f.get("cwe")})
    return {"cloned": True, "py_files": len(py_files),
            "total_findings": len(all_findings), "by_severity": sev, "cwes": cwes}


def main():
    with tempfile.TemporaryDirectory() as tmp:
        results = {name: scan_repo(url, tmp) for name, url in TARGETS}

    lines = ["# Real Security Scan Benchmark (reproducible)\n",
             "> Bandit (offline) on Python files of real public vulnerable repos.",
             "> Clone each repo yourself and re-run to verify every number.\n",
             "| Repo | Py files | Findings | HIGH | MED | LOW | Sample CWEs |",
             "| --- | ---: | ---: | ---: | ---: | ---: | --- |"]
    for name, r in results.items():
        if not r.get("cloned"):
            lines.append(f"| {name} | — | clone failed | | | | {r.get('error','')} |")
            continue
        s = r["by_severity"]
        lines.append(f"| `{name}` | {r['py_files']} | **{r['total_findings']}** | "
                     f"{s['HIGH']} | {s['MEDIUM']} | {s['LOW']} | {', '.join(r['cwes'][:5])} |")
    report = "\n".join(lines) + "\n"
    with open("REAL_SECURITY_SCAN_REPORT.md", "w", encoding="utf-8") as f:
        f.write(report)
    print(report)
    print("저장: REAL_SECURITY_SCAN_REPORT.md")


if __name__ == "__main__":
    main()
