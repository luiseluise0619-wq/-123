import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main


VULNERABLE_SOURCE = """import hashlib
import subprocess


def digest(data):
    return hashlib.md5(data).hexdigest()


def run(command):
    return subprocess.call(command, shell=True)
"""


class AegisApiTests(unittest.TestCase):
    def setUp(self):
        main.AUDIT_LOG_TRAIL.clear()
        main.AUDIT_REPORTS.clear()
        self.client = TestClient(main.app)
        self.headers = {
            "X-Org-Id": "acme-security",
            "X-User-Email": "lead@acme.example",
            "X-User-Role": "Security Lead",
        }

    def test_health_endpoint_is_available(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_audit_runs_real_scan_and_verifies_safe_patch(self):
        response = self.client.post(
            "/api/v1/audit-code",
            headers=self.headers,
            json={"source_code": VULNERABLE_SOURCE, "apply_safe_fixes": True},
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        audit = payload["audit"]

        self.assertGreaterEqual(audit["findings_count"], 2)
        self.assertTrue(audit["patch_applied"])
        self.assertTrue(audit["fix_verified_by_rescan"])
        self.assertIn("hashlib.sha256", audit["patched_code"])
        self.assertIn("shell=False", audit["patched_code"])
        self.assertFalse(payload["source_persisted"])

        stored = self.client.get(f"/api/v1/audits/{audit['audit_id']}", headers=self.headers)
        self.assertEqual(stored.status_code, 200)
        self.assertIsNone(stored.json()["patched_code"])
        self.assertGreaterEqual(len(stored.json()["findings"]), 2)

    def test_audit_can_disable_the_patch_stage(self):
        response = self.client.post(
            "/api/v1/audit-code",
            headers=self.headers,
            json={"source_code": VULNERABLE_SOURCE, "apply_safe_fixes": False},
        )
        self.assertEqual(response.status_code, 200, response.text)
        audit = response.json()["audit"]
        self.assertGreaterEqual(audit["findings_count"], 2)
        self.assertFalse(audit["patch_applied"])
        self.assertFalse(audit["fix_verified_by_rescan"])
        self.assertIsNone(audit["patched_code"])
        self.assertIsNone(audit["evidence"])

    def test_findings_are_scoped_to_the_requesting_organization(self):
        created = self.client.post(
            "/api/v1/audit-code",
            headers=self.headers,
            json={"source_code": VULNERABLE_SOURCE},
        )
        self.assertEqual(created.status_code, 200, created.text)
        audit_id = created.json()["audit"]["audit_id"]

        own_findings = self.client.get("/api/v1/findings?severity=HIGH", headers=self.headers)
        self.assertEqual(own_findings.status_code, 200)
        self.assertGreaterEqual(own_findings.json()["total_findings"], 1)

        other_headers = {**self.headers, "X-Org-Id": "other-organization"}
        missing = self.client.get(f"/api/v1/audits/{audit_id}", headers=other_headers)
        self.assertEqual(missing.status_code, 404)
        other_findings = self.client.get("/api/v1/findings", headers=other_headers)
        self.assertEqual(other_findings.status_code, 200)
        self.assertEqual(other_findings.json()["total_findings"], 0)

    def test_authentication_headers_are_required_and_roles_are_validated(self):
        missing_headers = self.client.post("/api/v1/audit-code", json={"source_code": "print('ok')"})
        self.assertEqual(missing_headers.status_code, 422)

        invalid_headers = {**self.headers, "X-User-Role": "Untrusted"}
        invalid_role = self.client.post(
            "/api/v1/audit-code",
            headers=invalid_headers,
            json={"source_code": "print('ok')"},
        )
        self.assertEqual(invalid_role.status_code, 403)

    def test_repository_audit_is_explicitly_not_claimed_as_implemented(self):
        response = self.client.post(
            "/api/v1/audit",
            headers=self.headers,
            json={"repository_url": "https://example.invalid/repository.git"},
        )
        self.assertEqual(response.status_code, 501)
        self.assertIn("no audit was performed", response.json()["detail"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
