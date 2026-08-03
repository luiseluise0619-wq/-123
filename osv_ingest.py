"""
Knowledge Base ingestion — the "remembers every security fix" memory, built real.

Pulls REAL vulnerability + fix data from OSV.dev (free public API) and appends it
to a growable knowledge base (knowledge_base.jsonl). This is the retrieval memory
the Security AI Core searches: given new code, find similar past CVE fixes.

Design follows the user's pipeline:
  OSV/GHSA  ->  CVE/CWE + fixed version/commit + references  ->  dedup  ->  KB

Note: needs network to api.osv.dev (blocked in some sandboxes, works locally/CI).
No fabrication: if the API is unreachable it reports the error and writes nothing.
"""

import json
import os
import urllib.request
from typing import Dict, Any, List

OSV_QUERY = "https://api.osv.dev/v1/query"
OSV_VULN = "https://api.osv.dev/v1/vulns/"
KB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge_base.jsonl")


def _post(url: str, body: Dict[str, Any]) -> Dict[str, Any]:
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)


def _get(url: str) -> Dict[str, Any]:
    with urllib.request.urlopen(url, timeout=25) as r:
        return json.load(r)


def normalize(v: Dict[str, Any]) -> Dict[str, Any]:
    """OSV 레코드 -> KB 엔트리 (CVE/CWE/수정정보/참조)."""
    fixed = []
    for aff in v.get("affected", []):
        for rng in aff.get("ranges", []):
            for ev in rng.get("events", []):
                if "fixed" in ev:
                    fixed.append(ev["fixed"])
    return {
        "id": v.get("id"),
        "cve": [a for a in v.get("aliases", []) if a.startswith("CVE-")],
        "cwe": v.get("database_specific", {}).get("cwe_ids", []),
        "summary": v.get("summary", ""),
        "fixed_versions": sorted(set(fixed)),
        "fix_references": [r["url"] for r in v.get("references", [])
                           if r.get("type") in ("FIX", "WEB") and "commit" in r.get("url", "").lower()][:5],
        "source": "osv.dev",
    }


def ingest_package(name: str, ecosystem: str = "PyPI") -> List[Dict[str, Any]]:
    """한 패키지의 실제 취약점+패치를 OSV에서 수집."""
    resp = _post(OSV_QUERY, {"package": {"name": name, "ecosystem": ecosystem}})
    entries = []
    for stub in resp.get("vulns", []):
        full = _get(OSV_VULN + stub["id"]) if "affected" not in stub else stub
        entries.append(normalize(full))
    return entries


def append_kb(entries: List[Dict[str, Any]]) -> int:
    """중복(id 기준) 제거하며 KB에 추가."""
    seen = set()
    if os.path.exists(KB_PATH):
        with open(KB_PATH, encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    seen.add(json.loads(line)["id"])
    added = 0
    with open(KB_PATH, "a", encoding="utf-8") as f:
        for e in entries:
            if e["id"] and e["id"] not in seen:
                f.write(json.dumps(e, ensure_ascii=False) + "\n")
                seen.add(e["id"]); added += 1
    return added


def main():
    packages = [("flask", "PyPI"), ("django", "PyPI"), ("requests", "PyPI"),
                ("lodash", "npm"), ("express", "npm")]
    total = 0
    for name, eco in packages:
        try:
            entries = ingest_package(name, eco)
            n = append_kb(entries)
            total += n
            print(f"  {name} ({eco}): {len(entries)}건 조회, {n}건 신규 추가")
        except Exception as exc:  # noqa: BLE001
            print(f"  ! {name}: 수집 실패 (네트워크?) - {str(exc)[:70]}")
    print(f"\nKnowledge Base 총 신규 {total}건 -> {KB_PATH}")
    print("이제 Security AI Core가 새 코드를 이 실제 CVE 패치들과 대조/검색할 수 있음.")


if __name__ == "__main__":
    main()
