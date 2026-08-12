"""CVEfixes-to-Blue-Team pipeline for non-executing patch evidence learning.

CVEfixes stores method revisions in `method_change`; a row whose
`before_change` flag is true is the vulnerable version and the corresponding
false row is the post-fix version. This module reads those rows from a local
SQLite database, creates language-aware vulnerable/post-fix pairs, trains
with post-fix hard negatives, and retrieves patch evidence by similarity.

It never applies a retrieved patch automatically and never executes database
source code. A Blue-Team change must still be verified by the static-analysis
judge before it is reported as fixed.
"""

from __future__ import annotations

import re
import sqlite3
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence, Tuple

from security_engine.language_model_tuner import LanguageExample, LanguageModelTuner, normalize_language

_TOKEN = re.compile(r"[A-Za-z_][A-Za-z0-9_]*|[^\sA-Za-z0-9_]")


@dataclass(frozen=True)
class CVEfixesPatchPair:
    pair_id: str
    cve_id: str
    language: str
    vulnerable_code: str
    fixed_code: str
    group: str


class CVEfixesPatchPipeline:
    """Read local CVEfixes method revisions and create Blue-Team learning inputs."""

    def __init__(self, database_path: str | Path):
        self.database_path = Path(database_path).resolve()

    @staticmethod
    def _tables(connection: sqlite3.Connection) -> set[str]:
        return {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}

    @staticmethod
    def _columns(connection: sqlite3.Connection, table: str) -> set[str]:
        return {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}

    def _validate_schema(self, connection: sqlite3.Connection) -> None:
        tables = self._tables(connection)
        required = {"file_change", "method_change"}
        missing = required - tables
        if missing:
            raise ValueError(f"CVEfixes database is missing required tables: {sorted(missing)}")
        file_columns = self._columns(connection, "file_change")
        method_columns = self._columns(connection, "method_change")
        file_required = {"file_change_id", "hash", "programming_language"}
        method_required = {"file_change_id", "code", "before_change"}
        if file_required - file_columns or method_required - method_columns:
            raise ValueError("CVEfixes database schema lacks required file_change or method_change columns.")

    def load_pairs(self, limit: int | None = None) -> List[CVEfixesPatchPair]:
        """Extract matching before/after method rows without retaining unrelated code."""
        if not self.database_path.exists():
            raise FileNotFoundError(
                f"CVEfixes SQLite database was not found at {self.database_path}. "
                "Download and convert the official SQL dump first."
            )
        with sqlite3.connect(self.database_path) as connection:
            self._validate_schema(connection)
            tables = self._tables(connection)
            method_columns = self._columns(connection, "method_change")
            method_key = "signature" if "signature" in method_columns else "name"
            cve_join = "LEFT JOIN fixes fx ON fx.hash = f.hash" if "fixes" in tables else ""
            cve_select = "COALESCE(fx.cve_id, '')" if "fixes" in tables else "''"
            query = f"""
                SELECT f.hash, f.file_change_id, f.programming_language,
                       m.{method_key}, m.code, m.before_change, {cve_select}
                FROM file_change f
                JOIN method_change m ON m.file_change_id = f.file_change_id
                {cve_join}
                WHERE m.code IS NOT NULL AND LENGTH(TRIM(m.code)) >= 20
            """
            rows = connection.execute(query).fetchall()

        revisions: Dict[Tuple[str, int, str, str], Dict[bool, str]] = defaultdict(dict)
        metadata: Dict[Tuple[str, int, str, str], Tuple[str, str]] = {}
        for commit_hash, file_change_id, language, method_identity, code, before_change, cve_id in rows:
            normalized_language = normalize_language(language)
            identity = str(method_identity or "<anonymous>")
            key = (str(commit_hash), int(file_change_id), normalized_language, identity)
            revisions[key][bool(before_change)] = str(code)
            metadata[key] = (str(cve_id or "unknown-cve"), normalized_language)

        pairs: List[CVEfixesPatchPair] = []
        for key, version_map in revisions.items():
            if True not in version_map or False not in version_map:
                continue
            before, after = version_map[True], version_map[False]
            if before == after:
                continue
            cve_id, language = metadata[key]
            pair_id = f"{key[0]}:{key[1]}:{key[3]}"
            pairs.append(
                CVEfixesPatchPair(
                    pair_id=pair_id,
                    cve_id=cve_id,
                    language=language,
                    vulnerable_code=before,
                    fixed_code=after,
                    group=cve_id if cve_id != "unknown-cve" else key[0],
                )
            )
            if limit is not None and len(pairs) >= limit:
                break
        return pairs

    @staticmethod
    def language_examples(pairs: Iterable[CVEfixesPatchPair]) -> List[LanguageExample]:
        """Convert each fix pair into vulnerable and structurally close safe rows."""
        examples: List[LanguageExample] = []
        for pair in pairs:
            examples.append(
                LanguageExample(
                    code=pair.vulnerable_code,
                    label=1,
                    language=pair.language,
                    group=pair.group,
                    source_kind="cvefixes_pre_fix",
                )
            )
            examples.append(
                LanguageExample(
                    code=pair.fixed_code,
                    label=0,
                    language=pair.language,
                    group=pair.group,
                    source_kind="post_fix_hard_negative",
                )
            )
        return examples

    def train_language_models(self, minimum_recall: float = 0.80, limit: int | None = None):
        pairs = self.load_pairs(limit=limit)
        tuner = LanguageModelTuner(minimum_recall=minimum_recall)
        models, report = tuner.train(self.language_examples(pairs))
        report["data_source"] = "CVEfixes local SQLite method_change pairs"
        report["source_execution"] = False
        report["source_persisted"] = False
        report["patch_pairs"] = len(pairs)
        report["hard_negative_definition"] = "post-fix method revisions paired with their pre-fix vulnerable revision"
        return models, report


class PatchEvidenceIndex:
    """Language-filtered retrieval of historical patch evidence, not auto-patching."""

    def __init__(self, pairs: Sequence[CVEfixesPatchPair]):
        self.pairs = list(pairs)

    @staticmethod
    def _token_set(code: str) -> set[str]:
        return {token.lower() for token in _TOKEN.findall(code)}

    def rank(self, code: str, language: str, limit: int = 3) -> List[Dict[str, Any]]:
        """Return metadata-only evidence; source code is intentionally excluded."""
        normalized_language = normalize_language(language)
        query_tokens = self._token_set(code)
        scored: List[Tuple[float, CVEfixesPatchPair]] = []
        for pair in self.pairs:
            if pair.language != normalized_language:
                continue
            candidate_tokens = self._token_set(pair.vulnerable_code)
            union = query_tokens | candidate_tokens
            similarity = len(query_tokens & candidate_tokens) / len(union) if union else 0.0
            scored.append((similarity, pair))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [
            {
                "pair_id": pair.pair_id,
                "cve_id": pair.cve_id,
                "language": pair.language,
                "similarity": round(similarity, 6),
                "requires_static_rescan": True,
                "auto_apply_allowed": False,
            }
            for similarity, pair in scored[:limit]
        ]
